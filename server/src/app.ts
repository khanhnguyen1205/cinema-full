import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { WEB_ORIGIN } from "./env";
import { authRouter } from "./auth/routes";
import { occupiedRouter } from "./api/occupied";
import { holdsRouter } from "./api/holds";
import { gatewayRouter } from "./api/gateway";

export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));

app.use("/auth", authRouter);

// Routes riêng PHẢI khai báo trước catch-all "/api" (Express match theo thứ tự).
app.use("/api/occupied-seats", occupiedRouter);
app.use("/api/holds", holdsRouter);
app.use("/api", gatewayRouter);
