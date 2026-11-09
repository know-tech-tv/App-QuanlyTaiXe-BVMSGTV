# Điều phối xe – Bệnh viện Mắt Sài Gòn Trà Vinh

Phiên bản **v2.10.1 Local Ready**, dựa trên giao diện doanh nghiệp v2.10.0.

## Flow nghiệp vụ hiện tại

1. **Điều phối tạo chuyến → Hành chính điều phối duyệt → Tài xế nhận chuyến.** Ban Giám đốc không duyệt từng chuyến.
2. **Trưởng khoa gửi đề nghị → Hành chính duyệt đề nghị → Điều phối tạo chuyến → Tài xế.** Không duyệt Hành chính lần hai.
3. **Tài xế tạo chuyến đột xuất → đi ngay → Hành chính/Điều phối xác nhận báo cáo sau.**
4. **Chi phí:** Tài xế gửi → Ban Giám đốc duyệt → Kế toán duyệt → Kế toán xác nhận chi trả.
5. **Sự cố/Bảo dưỡng:** Tài xế hoặc bộ phận gửi → Ban Giám đốc duyệt → Hành chính tiếp nhận/xử lý.
6. **GPS realtime:** Điều phối, Hành chính, Ban Giám đốc và Quản trị được xem; Kế toán không xem vị trí realtime.
7. **BGĐ:** xem báo cáo tổng hợp cuối tháng, duyệt chi phí và xử lý phê duyệt sự cố/bảo dưỡng; không duyệt xe đi.

## Chạy local

Đọc `HUONG-DAN-CHAY-LOCAL-v2.10.1.md`. Cách nhanh nhất trên Windows:

```text
1. Chạy SETUP-LOCAL.cmd
2. Điền .env.local
3. Chạy lại SETUP-LOCAL.cmd
4. Chạy START-LOCAL.cmd
5. Mở http://localhost:5173
```

## Yêu cầu

- Node.js >= 22.12
- npm
- Supabase đã có schema/migration đến v2.9.0
- Edge Function `manage-user` nếu Quản trị tạo/xóa/khóa tài khoản
- Edge Function `analyze-odometer` nếu dùng Gemini OCR

## Build production

```cmd
BUILD-LOCAL.cmd
```

Kết quả ở `dist/`.
