import { app } from "./app";
import { PORT, DATABASE_URL, WEB_ORIGIN } from "./env";

// Che thông tin đăng nhập của chuỗi kết nối khi in ra log.
const dbLabel = DATABASE_URL.replace(/\/\/[^@]*@/, "//***:***@");

app.listen(PORT, () => {
  console.log(
    `Auth + API server chạy tại http://localhost:${PORT} (db: ${dbLabel}, web: ${WEB_ORIGIN})`,
  );
});
