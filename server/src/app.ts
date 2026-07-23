import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { WEB_ORIGIN, IS_PROD } from "./env";
import { authRouter } from "./auth/routes";
import { occupiedRouter } from "./api/occupied";
import { holdsRouter } from "./api/holds";
import { gatewayRouter } from "./api/gateway";
import { mountStatic } from "./static";

export const app = express();
// Render kết thúc TLS ở proxy phía trước => tin X-Forwarded-* (cần cho rate-limit theo IP).
if (IS_PROD) app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
// Dev: web (:3000) khác origin với API (:4000) nên cần CORS.
// Prod: SPA do chính server này phục vụ => cùng origin, không cần CORS.
if (!IS_PROD) app.use(cors({ origin: WEB_ORIGIN, credentials: true }));

app.use("/auth", authRouter);

// Routes riêng PHẢI khai báo trước catch-all "/api" (Express match theo thứ tự).
app.use("/api/occupied-seats", occupiedRouter);
app.use("/api/holds", holdsRouter);
app.use("/api", gatewayRouter);

// SPA đứng CUỐI: chỉ nhận những gì API không nhận.
mountStatic(app);
