-- BVMSGTV v3.0.0 — NỐI CHUYẾN CHO TÀI XẾ
-- Tài xế vừa kết thúc chuyến có thể nối ngay sang chuyến kế tiếp của CÙNG XE
-- mà không phải chụp lại KM đầu: KM cuối + ảnh đồng hồ của chuyến trước được dùng
-- làm KM đầu của chuyến sau, chuyến sau bắt đầu ngay.
--
-- Chạy sau migrate-v2.11.1-fleet-approval-repair.sql. Idempotent: chạy lại an toàn.

begin;

alter table public.trips
  add column if not exists chained_from_trip_id uuid references public.trips(id) on delete set null;

-- Mỗi chuyến chỉ được nối tới đúng một chuyến tiếp theo.
create unique index if not exists trips_chained_from_unique
  on public.trips(chained_from_trip_id)
  where chained_from_trip_id is not null;

-- ---------------------------------------------------------------------------
-- Ràng buộc dữ liệu: dù cập nhật bằng RPC hay REST, liên kết nối chuyến luôn hợp lệ.
-- ---------------------------------------------------------------------------
create or replace function public.validate_trip_chain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.trips%rowtype;
begin
  if new.chained_from_trip_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.chained_from_trip_id is not distinct from old.chained_from_trip_id then return new; end if;

  if new.chained_from_trip_id = new.id then raise exception 'Không thể nối chuyến với chính nó'; end if;

  select * into source from public.trips where id = new.chained_from_trip_id;
  if not found then raise exception 'Không tìm thấy chuyến trước để nối'; end if;
  if source.status <> 'completed' then raise exception 'Chỉ nối được từ chuyến đã hoàn thành'; end if;
  if source.driver_id <> new.driver_id then raise exception 'Chuyến nối phải do cùng một tài xế thực hiện'; end if;
  if source.vehicle_id <> new.vehicle_id then raise exception 'Chuyến nối phải dùng cùng một xe để KM liên tục'; end if;
  if source.end_odometer is null then raise exception 'Chuyến trước chưa có KM cuối'; end if;
  if new.start_odometer is not null and new.start_odometer < source.end_odometer then
    raise exception 'KM đầu của chuyến nối không được nhỏ hơn KM cuối chuyến trước';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_trip_chain_trigger on public.trips;
create trigger validate_trip_chain_trigger
before insert or update of chained_from_trip_id, start_odometer on public.trips
for each row execute function public.validate_trip_chain();

-- ---------------------------------------------------------------------------
-- RPC nối chuyến: chạy 2 bước hợp lệ theo protect_trip_update (vai trò tài xế):
--   1) assigned -> accepted (nếu chuyến sau chưa nhận)
--   2) accepted/ready -> active, sao chép KM cuối + ảnh của chuyến trước.
-- Mọi kiểm tra quyền vẫn do trigger protect_trip_update thực hiện theo auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.chain_trip(p_from_trip uuid, p_to_trip uuid)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  source public.trips%rowtype;
  target public.trips%rowtype;
  max_gap interval := interval '12 hours';
begin
  if me is null then raise exception 'Cần đăng nhập để nối chuyến'; end if;

  select * into source from public.trips where id = p_from_trip for update;
  if not found then raise exception 'Không tìm thấy chuyến trước'; end if;
  select * into target from public.trips where id = p_to_trip for update;
  if not found then raise exception 'Không tìm thấy chuyến cần nối'; end if;

  if source.driver_id <> me or target.driver_id <> me then raise exception 'Chỉ tài xế phụ trách cả hai chuyến được nối chuyến'; end if;
  if source.status <> 'completed' or source.end_odometer is null or source.end_odometer_image_url is null then
    raise exception 'Chuyến trước phải hoàn thành và có ảnh KM cuối';
  end if;
  if coalesce(source.ended_at, source.updated_at) < now() - max_gap then
    raise exception 'Chuyến trước đã kết thúc quá 12 giờ, hãy chụp KM đầu mới';
  end if;
  if source.vehicle_id <> target.vehicle_id then raise exception 'Chỉ nối được chuyến cùng xe'; end if;
  if target.status not in ('assigned','accepted','ready') then raise exception 'Chuyến cần nối không ở trạng thái chờ xuất phát'; end if;
  if target.start_odometer is not null or target.started_at is not null then raise exception 'Chuyến cần nối đã ghi KM đầu'; end if;
  if exists (select 1 from public.trips where chained_from_trip_id = source.id) then
    raise exception 'Chuyến trước đã được nối với một chuyến khác';
  end if;
  if exists (select 1 from public.trips where driver_id = me and status = 'active' and id <> target.id) then
    raise exception 'Bạn đang có chuyến đang chạy, hãy kết thúc trước khi nối chuyến';
  end if;

  if target.status = 'assigned' then
    update public.trips set status = 'accepted' where id = target.id;
  end if;

  update public.trips
     set chained_from_trip_id = source.id,
         start_odometer = source.end_odometer,
         start_odometer_image_url = source.end_odometer_image_url,
         started_at = now(),
         status = 'active'
   where id = target.id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.chain_trip(uuid, uuid) from public;
grant execute on function public.chain_trip(uuid, uuid) to authenticated;

commit;

-- Kiểm tra nhanh sau khi chạy:
-- select column_name from information_schema.columns where table_name = 'trips' and column_name = 'chained_from_trip_id';
-- select proname from pg_proc where proname in ('chain_trip','validate_trip_chain');
