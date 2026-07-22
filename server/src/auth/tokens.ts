import jwt from "jsonwebtoken";
import { JWT_SECRET, ACCESS_TTL, REFRESH_TTL } from "../env";

export const signAccess = (id: number, role: string): string =>
  jwt.sign({ sub: id, role }, JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  } as jwt.SignOptions);

export const signRefresh = (id: number, remember: boolean): string =>
  jwt.sign({ sub: id, remember }, JWT_SECRET, {
    expiresIn: REFRESH_TTL,
  } as jwt.SignOptions);

export const verifyToken = (token: string): jwt.JwtPayload =>
  jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
