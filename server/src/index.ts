import { app } from "./app";
import { PORT, DATABASE_URL, WEB_ORIGIN } from "./env";
import { startShowtimeRefresh } from "./schedule/refresh";

// Che thông tin đăng nhập của chuỗi kết nối khi in ra log.
const dbLabel = DATABASE_URL.replace(/\/\/[^@]*@/, "//***:***@");

app.listen(PORT, () => {
  console.log(
    `Auth + API server chạy tại http://localhost:${PORT} (db: ${dbLabel}, web: ${WEB_ORIGIN})`,
  );
  // Ở index.ts chứ KHÔNG phải app.ts: app.ts bị test supertest import, để ở đó thì mỗi
  // lần chạy unit test là một lần bộ hẹn giờ nổ.
  startShowtimeRefresh();
});
