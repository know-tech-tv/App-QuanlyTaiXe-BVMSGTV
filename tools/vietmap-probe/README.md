# Vietmap Field Map Probe v4 – BVMSGTV

## Mục đích

Bản v3 đã xác định: `VehicleListV2` có 36 cột; `RefreshVehicle.Data` có 89 cột. V4 chỉ xác định **vị trí tên trường kỹ thuật**, **cột tọa độ** và **cột chuỗi chứa cặp kinh/vĩ độ**, không ghi dữ liệu thật.

## Cài đặt Windows

1. Giải nén vào thư mục riêng. Không chép đè source Điều phối xe.
2. Trong CMD tại thư mục chứa `package.json` chạy:

```cmd
npm.cmd install
npm.cmd run self-test
npm.cmd start
```

3. Chrome mở: đăng nhập tài khoản Vietmap hợp lệ bằng tay, vào **Giám sát xe**, chọn xe, đợi 30–60 giây; sau đó quay lại CMD nhấn Enter.
4. Chỉ gửi file `probe-output/vietmap-field-map-safe.json` vào chat.

## Bảo mật và giới hạn

- Công cụ chạy trên Windows của bạn, sử dụng phiên Chrome tạm thời, không lưu mật khẩu/cookie/phiên đăng nhập vào file báo cáo.
- Chỉ phân tích các endpoint đã quan sát được. Không tự gọi API từ ngoài luồng giao diện và không vượt CAPTCHA/đăng nhập.
- Báo cáo không có giá trị tọa độ, biển số, tài xế hay phản hồi thô.
- Không gửi thư mục trình duyệt, file HAR hoặc token.
- Đây là khảo sát giao diện trong phạm vi tài khoản bạn có quyền truy cập. Kiểm tra điều khoản Vietmap trước khi dùng kỹ thuật này để đồng bộ tự động lâu dài.
- Các trường được xác định chỉ là *ứng viên*. Trước khi đưa vào ứng dụng điều xe, phải đối chiếu với giao diện thật và thử nghiệm một xe.
