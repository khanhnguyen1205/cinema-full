// Biến môi trường giả cho test server. Prisma bị mock nên chuỗi kết nối này
// không bao giờ được dùng để nối thật — nó chỉ để env.ts không throw.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.DIRECT_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
// Đặt secret riêng để env.ts không cảnh báo "đang dùng JWT_SECRET mặc định".
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-secret-khong-dung-that";
