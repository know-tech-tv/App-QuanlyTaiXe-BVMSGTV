# v3.0.0 — Giao diện mới, logo mới, nối chuyến, sửa camera Navicom

## Việc cần làm khi triển khai

1. **Chạy migration** trên Supabase (SQL editor): `supabase/migrate-v3.0.0-trip-chaining.sql`
   (sau `migrate-v2.11.1-fleet-approval-repair.sql`; chạy lại an toàn).
2. **Đổi khóa TLS**: `.certs/msg-car-key.pem` từng bị commit vào git → coi như đã lộ, cần cấp lại chứng chỉ/khóa mới.
   File đã được gỡ khỏi git và thêm vào `.gitignore`, nhưng vẫn còn trong lịch sử commit cũ.
3. **Cập nhật Navicom gateway** (`server/navicom-gateway`) và khởi động lại dịch vụ.
4. Build lại web: `npm ci && npm run build` (service worker cache đã đổi sang `v3.0.0` để máy tài xế nhận bản mới).

## Giao diện & logo

- Logo mới (huy hiệu tròn): `public/brand/logo-bvmsgtv-2026.png`, `-256.png`; icon PWA 192/512 + maskable, apple-touch-icon, favicon.
- Bảng màu theo logo: xanh navy `#2b2f7e`, xanh trời `#3fbded`, đỏ `#e3141b`; font Be Vietnam Pro.
- Trang đăng nhập thiết kế lại hoàn toàn (desktop 2 cột, mobile dạng thẻ).
- `src/styles/theme-2026.css`: lớp giao diện mới cho sidebar, topbar, panel, nút, modal, app tài xế.

## Nối chuyến cho tài xế

- Sau khi kết thúc chuyến, app tài xế hiện thẻ **“Nối chuyến tiếp theo”** (trong 12 giờ, cùng xe, chưa có chuyến đang chạy):
  - Chọn chuyến đã được phân công cùng xe → nối ngay: KM cuối + ảnh đồng hồ của chuyến trước thành KM đầu, chuyến bắt đầu luôn.
  - Hoặc **tạo chuyến nối đột xuất** (điểm đón = điểm đến chuyến trước).
  - Có nút “Không nối chuyến” để ẩn gợi ý.
- Chuyến được nối có nhãn “Chuyến nối”.
- DB: cột `trips.chained_from_trip_id`, trigger `validate_trip_chain`, RPC `chain_trip(p_from_trip, p_to_trip)` — mọi kiểm tra (cùng tài xế, cùng xe, KM không giảm, mỗi chuyến chỉ nối 1 lần, trong 12 giờ) thực hiện ở server.

## Camera Navicom không hiện khi xe vừa khởi động — nguyên nhân & cách sửa

| Nguyên nhân | Sửa |
|---|---|
| Gateway xác định online chỉ dựa trên lịch sử GPS (bị trễ vài phút sau khi nổ máy) | Gọi thêm API trạng thái realtime CMSV6 `getDeviceOlStatus` / `getDeviceStatus`; trả `online_source`, `online_since` |
| `NavicomMonitor` chặn camera khi GPS cũ hơn 2 phút | Bỏ cổng GPS 2 phút, dùng `cameraLiveness()` dùng chung |
| Iframe player CMSV6 không được tải lại khi xe chuyển offline → online nên kẹt màn đen | Khi phiên online mới bắt đầu: chờ khởi động 6 giây rồi remount player (`useCameraLifecycle`) |
| Một lần poll lỗi là tắt camera | Chỉ báo lỗi sau 3 lần lỗi liên tiếp |

Thêm nút **Tải lại** và **Thử phát camera** (khi trạng thái báo offline nhưng thực tế xe đã nổ máy).

Biến môi trường gateway mới (tùy chọn):
- `NAVICOM_CMSV6_REALTIME_STATUS` (mặc định `true`), `NAVICOM_CMSV6_STATUS_TIMEOUT_MS`
- Chế độ mock để thử: `NAVICOM_MOCK_CYCLE_SECONDS` (đảo online/offline), `NAVICOM_MOCK_PLAYER_URL` (`{deviceId}`, `{channel}`)

## Dọn mã nguồn

- `package.json` bị hỏng (CI build GitHub Pages lỗi) → khôi phục và nâng lên 3.0.0.
- Gỡ khỏi git các bản build cũ (`assets/`, `dist/`, ảnh trùng ở thư mục gốc, `.service/`, `*.tsbuildinfo`).
- Script khảo sát Vietmap chuyển vào `tools/vietmap-probe/`.
- Gộp 2 khung camera trùng lặp thành `src/components/NavicomCameraPane.tsx`.
