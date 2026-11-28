# Quản trị yêu cầu hỗ trợ

Khi đã cấu hình Supabase, biểu mẫu hỗ trợ và báo giá gửi vào bảng `td_support_requests`. Từ chân trang, mở **Quản trị admin** để đăng nhập bằng Supabase Auth, xem yêu cầu và cập nhật trạng thái xử lý.

Trong trang quản trị, tải ảnh sản phẩm lên bucket công khai `td-product-images`, hoặc thêm và tải tài liệu nội bộ từ bucket riêng tư `td-documents`. Tài liệu hỗ trợ PDF, DOCX, XLSX và PPTX tối đa 20 MB mỗi tệp.

## Supabase và GitHub Pages

1. Trong dự án Supabase, chạy migration `supabase/migrations/20261127000100_td_admin.sql` một lần bằng SQL Editor hoặc Supabase CLI.
2. Tạo tài khoản quản trị trong **Authentication → Users**. Dùng mật khẩu riêng và xác nhận email khi tạo tài khoản nếu muốn đăng nhập ngay. Thêm UUID của tài khoản vào danh sách admin bằng SQL Editor:

   ```sql
   insert into td_private.admins (user_id)
   values ('UUID_CUA_NGUOI_DUNG_SUPABASE')
   on conflict do nothing;
   ```

3. Điền **Project URL** và **Publishable key** vào `supabase-config.js`. Giữ khóa secret và service role trong môi trường quản trị. Trang công khai chỉ đọc ảnh sản phẩm và gửi yêu cầu, còn tài khoản trong danh sách admin mới đọc được yêu cầu, thay ảnh hoặc quản lý tài liệu.
4. Mở bản thử để gửi một báo giá, đăng nhập từ `admin.html`, kiểm tra trạng thái và tải thử tài liệu. Xác nhận một người dùng thường không đọc được yêu cầu hay tài liệu. Khi các bước này đạt, đưa cùng bộ tệp lên nhánh xuất bản GitHub Pages.

Để bật **Quên mật khẩu** trên GitHub Pages, thêm `https://ngongochuy.github.io/T-sevice/admin.html?recover=1` vào **Authentication → URL Configuration → Redirect URLs** của dự án Supabase. Người dùng nhập email trên trang admin, bấm **Quên mật khẩu** rồi mở liên kết trong cùng trình duyệt đã yêu cầu đặt lại.
