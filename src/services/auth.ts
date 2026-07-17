// Auth qua backend that (server/auth-server.js): cookie httpOnly, JS khong cham token.
// Moi request kem credentials:"include" de trinh duyet gui cookie phien.
import type { User } from "types";

const AUTH_URL = import.meta.env.VITE_AUTH_URL || "http://localhost:4000";

const post = async (path: string, body?: unknown): Promise<Response> => {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
};

const readError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const d = await res.json();
    return d?.error || fallback;
  } catch {
    return fallback;
  }
};

export const loginUser = async (email: string, password: string, remember = false): Promise<User> => {
  const res = await post("/auth/login", { email, password, remember });
  if (!res.ok) throw new Error(await readError(res, "Đăng nhập thất bại."));
  return res.json();
};

export const registerUser = async ({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}): Promise<User> => {
  const res = await post("/auth/register", { fullName, email, password });
  if (!res.ok) throw new Error(await readError(res, "Đăng ký thất bại."));
  return res.json();
};

export const logoutUser = async (): Promise<void> => {
  try {
    await post("/auth/logout");
  } catch {
    /* mat mang van cho dang xuat phia client */
  }
};

// Xoay access token bang refresh cookie. Tra user hoac null.
export const refreshSession = async (): Promise<User | null> => {
  const res = await post("/auth/refresh");
  return res.ok ? res.json() : null;
};

// Lay user hien tai tu cookie phien. Neu access het han -> thu refresh 1 lan.
export const fetchMe = async (): Promise<User | null> => {
  const res = await fetch(`${AUTH_URL}/auth/me`, { credentials: "include" });
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) return refreshed;
    return null;
  }
  return res.ok ? res.json() : null;
};
