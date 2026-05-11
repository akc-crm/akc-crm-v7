# AKC CRM Fullstack v7 Auth Approval

Bản v7 thêm hệ thống đăng ký tài khoản, admin duyệt và phân quyền.

## Tính năng mới
- Đăng ký tài khoản mới
- Tài khoản đăng ký ở trạng thái chờ duyệt
- Admin duyệt/từ chối tài khoản
- Admin phân quyền: sale / manager / admin
- Admin gán cơ sở, owner sale
- Admin khóa/mở tài khoản
- Admin reset mật khẩu
- Tài khoản chờ duyệt không đăng nhập được
- Tài khoản bị khóa không đăng nhập được

## Tài khoản demo
- admin@akc.vn / 123456
- manager.caugiay@akc.vn / 123456
- maianh@akc.vn / 123456
- tuan@akc.vn / 123456

## Chạy local
npm install
npm run dev

## Deploy
Có thể deploy lên Vercel/Netlify. Lưu ý: bản này vẫn dùng localStorage.
Khi deploy thật cho nhiều người dùng, cần chuyển sang Supabase Auth + Database để dữ liệu dùng chung.
