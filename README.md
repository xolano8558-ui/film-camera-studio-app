# Film Camera Studio (web app)

Máy ảnh màu phim chạy trên trình duyệt điện thoại: camera trực tiếp, 5 công thức màu gốc, chỉnh Tông sáng / Tông tối / Độ màu / Hạt phim / Cân bằng trắng, sửa ảnh có sẵn, lưu công thức riêng. Mọi xử lý diễn ra ngay trên máy, không gửi ảnh đi đâu.

## Cài lên iPhone
1. Mở link GitHub Pages của repo này bằng **Safari**.
2. Nhấn nút Chia sẻ → **Thêm vào Màn hình chính**.
3. Mở biểu tượng "Film Cam" vừa thêm, cho phép dùng camera.

## Giới hạn của bản web
- Ảnh chụp lấy từ luồng video của camera (thường 1920×1440 hoặc thấp hơn), không phải ảnh tĩnh 12/48MP như app gốc của iPhone. Không có RAW.
- Không chạm để lấy nét / đo sáng, không chọn ống kính 0.5×/2× (trình duyệt không cho).
- Bộ xử lý màu là bản rút gọn trên ảnh 8-bit, chưa phải color engine trong tài liệu đặc tả.
- Không liên quan và không được Fujifilm bảo trợ. Các công thức màu là thiết kế riêng.

## Mã nguồn
HTML/CSS/JS thuần, WebGL cho xử lý màu, service worker để mở được khi không có mạng.
