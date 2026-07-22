import type { Request, Response } from "express";
import { DATA_URL } from "../env";

// SEAM: proxy json-server. 3c thay bằng truy vấn Prisma.
// Chuyển tiếp request sang json-server, giữ query + body + status + header cần thiết.
export async function forward(
  req: Request,
  res: Response,
  rest: string,
  extraQuery?: Record<string, string | number>,
): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) params.set(k, String(v));
  if (extraQuery)
    for (const [k, v] of Object.entries(extraQuery)) params.set(k, String(v));
  const qs = params.toString();
  const url = `${DATA_URL}/${rest}${qs ? `?${qs}` : ""}`;
  const init: RequestInit = { method: req.method, headers: {} };
  if (!["GET", "HEAD", "DELETE"].includes(req.method)) {
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    init.body = JSON.stringify(req.body || {});
  }
  const r = await fetch(url, init);
  const body = await r.text();
  res.status(r.status);
  const ct = r.headers.get("content-type");
  if (ct) res.set("Content-Type", ct);
  const xtc = r.headers.get("x-total-count");
  if (xtc) res.set("X-Total-Count", xtc);
  res.send(body);
}
