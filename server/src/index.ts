import { app } from "./app";
import { PORT, DATA_URL, WEB_ORIGIN } from "./env";

app.listen(PORT, () => {
  console.log(
    `Auth server chạy tại http://localhost:${PORT} (data: ${DATA_URL}, web: ${WEB_ORIGIN})`,
  );
});
