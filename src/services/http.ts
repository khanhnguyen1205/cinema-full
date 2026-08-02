// Địa chỉ gốc của backend, dùng chung cho mọi service (api / auth / payments / email).
//
// Prod: SPA do CHÍNH server Express phục vụ => đường dẫn tương đối, cùng origin
// (AUTH_URL rỗng nên `${AUTH_URL}/auth/me` thành "/auth/me").
// Dev: web :3000 và API :4000 khác cổng nên phải ghi rõ host.
//
// Nhánh theo import.meta.env.PROD là BẮT BUỘC, không phải cho đẹp: Docker build
// không có .env (.dockerignore loại nó), nên nếu để fallback localhost lọt vào
// bundle production thì trình duyệt của khách sẽ gọi về chính máy họ và CORS chặn
// — trang live treo mãi ở splash trong khi curl vào API vẫn xanh.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");

export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ||
  (import.meta.env.PROD ? "" : "http://localhost:4000");
