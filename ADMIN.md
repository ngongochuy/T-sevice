# Quản trị yêu cầu hỗ trợ

Khi đã cấu hình Supabase, biểu mẫu hỗ trợ và báo giá gửi vào bảng `td_support_requests`. Từ chân trang, mở **Quản trị admin** để đăng nhập bằng Supabase Auth, xem yêu cầu và cập nhật trạng thái xử lý.

Trong trang quản trị, tải ảnh sản phẩm lên bucket công khai `td-product-images`, hoặc thêm và tải tài liệu nội bộ từ bucket riêng tư `td-documents`. Tài liệu hỗ trợ PDF, DOCX, XLSX và PPTX tối đa 20 MB mỗi tệp.

## Chạy thử trên Windows

Để thử chế độ SQLite, dùng Python 3.11 trở lên, để trống cấu hình Supabase và chạy từ thư mục chứa `server.py`.

```powershell
$env:TD_LOCAL_DEMO = '1'
$env:TD_ADMIN_EMAIL = 'admin@tdservice.vn'
$env:TD_ADMIN_PASSWORD = Read-Host 'Nhap mat khau admin'
python server.py
```

Mở `http://127.0.0.1:5502`. Dữ liệu thử được lưu trong `.data/support.sqlite3`.

## Triển khai

### Supabase và GitHub Pages

1. Trong dự án Supabase, chạy migration `supabase/migrations/20261127000100_td_admin.sql` một lần bằng SQL Editor hoặc Supabase CLI.
2. Tạo tài khoản quản trị trong **Authentication → Users**. Dùng mật khẩu riêng và xác nhận email khi tạo tài khoản nếu muốn đăng nhập ngay. Thêm UUID của tài khoản vào danh sách admin bằng SQL Editor:

   ```sql
   insert into td_private.admins (user_id)
   values ('UUID_CUA_NGUOI_DUNG_SUPABASE')
   on conflict do nothing;
   ```

3. Điền **Project URL** và **Publishable key** vào `supabase-config.js`. Giữ khóa secret và service role trong môi trường quản trị. Trang công khai chỉ đọc ảnh sản phẩm và gửi yêu cầu, còn tài khoản trong danh sách admin mới đọc được yêu cầu, thay ảnh hoặc quản lý tài liệu.
4. Mở bản thử để gửi một báo giá, đăng nhập từ `admin.html`, kiểm tra trạng thái và tải thử tài liệu. Xác nhận một người dùng thường không đọc được yêu cầu hay tài liệu. Khi các bước này đạt, đưa cùng bộ tệp lên nhánh xuất bản GitHub Pages.

Bản thử Python vẫn dùng dữ liệu SQLite khi cấu hình Supabase để trống. Khi cấu hình Supabase được điền, website gửi yêu cầu sang Supabase. Tài liệu và ảnh đã tải lên SQLite chỉ xuất hiện trong Supabase sau khi chuyển dữ liệu.

### Render tự cập nhật từ GitHub

1. Trong Render Dashboard, chọn **New → Blueprint** rồi kết nối repo `ngongochuy/T-sevice` và chọn nhánh `admin-ho-tro`.
2. Kiểm tra cấu hình `render.yaml`. Cấu hình tạo một web service trả phí tại Singapore và ổ lưu trữ 1 GB.
3. Blueprint đặt `TD_DATA_BACKEND=supabase`. Với dịch vụ Render đang chạy từ trước, kiểm tra biến này đã có trong mục **Environment** sau khi đồng bộ Blueprint. Kiểm tra chi phí hiển thị trước khi xác nhận triển khai.
4. Sau khi dịch vụ báo **Live**, mở URL HTTPS của dịch vụ. Kiểm tra trang chủ, gửi thử một yêu cầu hỗ trợ và mở `/admin` để đăng nhập bằng tài khoản Supabase và xác nhận yêu cầu đã được lưu.

Mỗi lần nhánh `admin-ho-tro` có commit mới, Render sẽ triển khai lại. Với dịch vụ từng dùng SQLite, dữ liệu cũ nằm tại `/var/data/td-support.sqlite3` trên ổ lưu trữ bền vững và cần được nhập riêng vào Supabase.

### Máy chủ Python khác

- Chạy `server:application` trên máy chủ WSGI production qua HTTPS. Phục vụ cả website và các đường dẫn `/api/support`, `/admin` từ cùng tên miền.
- Đặt `TD_ADMIN_EMAIL`, mật khẩu riêng dài tối thiểu 16 ký tự trong `TD_ADMIN_PASSWORD`, và đường dẫn `TD_DB_PATH` trên ổ lưu trữ bền vững. Tắt `TD_LOCAL_DEMO` khi triển khai.
- Giới hạn tần suất POST tới `/admin/login` và `/api/support` tại reverse proxy. Sao lưu tệp SQLite định kỳ bằng công cụ sao lưu SQLite.
- Cho phép thân yêu cầu tối đa 21 MB tại reverse proxy cho đường dẫn tải tài liệu lên `/admin/documents`.
- GitHub Pages phục vụ tệp tĩnh. Giữ bản đang chạy cho đến khi máy chủ mới có thể nhận yêu cầu qua HTTPS.
