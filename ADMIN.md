# Quản trị yêu cầu hỗ trợ

Form hiện tại gửi về `POST /api/support`. Máy chủ lưu yêu cầu trong SQLite. Từ chân trang, mở **Quản trị admin** để đăng nhập, xem yêu cầu mới và cập nhật trạng thái xử lý.

## Chạy thử trên Windows

Dùng Python 3.11 trở lên và chạy từ thư mục chứa `server.py`.

```powershell
$env:TD_LOCAL_DEMO = '1'
$env:TD_ADMIN_EMAIL = 'admin@tdservice.vn'
$env:TD_ADMIN_PASSWORD = Read-Host 'Nhap mat khau admin'
python server.py
```

Mở `http://127.0.0.1:5502`. Dữ liệu thử được lưu trong `.data/support.sqlite3`.

## Triển khai

- Chạy `server:application` trên máy chủ WSGI production qua HTTPS. Phục vụ cả website và các đường dẫn `/api/support`, `/admin` từ cùng tên miền.
- Đặt `TD_ADMIN_EMAIL`, mật khẩu riêng dài tối thiểu 16 ký tự trong `TD_ADMIN_PASSWORD`, và đường dẫn `TD_DB_PATH` trên ổ lưu trữ bền vững. Tắt `TD_LOCAL_DEMO` khi triển khai.
- Giới hạn tần suất POST tới `/admin/login` và `/api/support` tại reverse proxy. Sao lưu tệp SQLite định kỳ bằng công cụ sao lưu SQLite.
- GitHub Pages phục vụ tệp tĩnh. Giữ bản đang chạy cho đến khi máy chủ mới có thể nhận yêu cầu qua HTTPS.

Yêu cầu đã nhận trước đây vẫn nằm trong hệ thống lưu trữ cũ. Cơ sở dữ liệu mới bắt đầu trống.
