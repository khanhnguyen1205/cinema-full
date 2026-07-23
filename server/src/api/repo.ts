import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../db/prisma";
import {
  COLLECTIONS,
  isCollection,
  parseFilters,
  pickWritable,
  type CollectionName,
} from "./collections";

// Các delegate Prisma khác kiểu nhau; ta chỉ dùng đúng 5 phương thức có hình dạng
// tham số giống nhau nên gom về một giao diện chung.
type AnyDelegate = {
  findMany(args: { where?: object; orderBy?: object }): Promise<unknown[]>;
  findUnique(args: { where: { id: number } }): Promise<unknown | null>;
  create(args: { data: object }): Promise<unknown>;
  update(args: { where: { id: number }; data: object }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

function delegate(c: CollectionName): AnyDelegate {
  const map = {
    movies: prisma.movie,
    showtimes: prisma.showtime,
    cinemas: prisma.cinema,
    cities: prisma.city,
    rooms: prisma.room,
    concessions: prisma.concession,
    bookings: prisma.booking,
    users: prisma.user,
  };
  return map[c] as unknown as AnyDelegate;
}

// Prisma đòi Prisma.DbNull cho cột Json khi muốn lưu null (null trần bị từ chối).
function normalizeJson(
  c: CollectionName,
  data: Record<string, unknown>,
): Record<string, unknown> {
  for (const field of COLLECTIONS[c].json) {
    if (field in data && data[field] === null) data[field] = Prisma.DbNull;
  }
  return data;
}

// Thay thế forward(): dịch REST kiểu json-server sang Prisma, giữ nguyên status code.
export async function handleRest(
  req: Request,
  res: Response,
  rest: string,
  extraFilters?: Record<string, string | number>,
): Promise<void> {
  const [name, idPart, ...deeper] = rest.split("/");
  if (!isCollection(name) || deeper.length > 0) {
    res.status(404).json({});
    return;
  }
  const c: CollectionName = name;
  const hasId = idPart != null && idPart !== "";
  const id = hasId ? Number(idPart) : undefined;
  if (hasId && !Number.isFinite(id)) {
    res.status(404).json({}); // json-server: id không tồn tại -> 404
    return;
  }

  try {
    if (req.method === "GET") {
      if (id != null) {
        const row = await delegate(c).findUnique({ where: { id } });
        if (!row) {
          res.status(404).json({});
          return;
        }
        res.json(row);
        return;
      }
      const where = {
        ...parseFilters(c, req.query as Record<string, unknown>),
        ...(extraFilters ?? {}),
      };
      // json-server trả theo thứ tự trong db.json (= id tăng dần) — giữ y hệt.
      const rows = await delegate(c).findMany({
        where,
        orderBy: { id: "asc" },
      });
      res.json(rows);
      return;
    }

    if (req.method === "POST") {
      const data = normalizeJson(
        c,
        pickWritable(c, (req.body ?? {}) as Record<string, unknown>),
      );
      if (c === "bookings" && data.createdAt == null)
        data.createdAt = new Date().toISOString();
      const row = await delegate(c).create({ data });
      res.status(201).json(row); // json-server trả 201 khi tạo
      return;
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      if (id == null) {
        res.status(404).json({});
        return;
      }
      const data = normalizeJson(
        c,
        pickWritable(c, (req.body ?? {}) as Record<string, unknown>),
      );
      const row = await delegate(c).update({ where: { id }, data });
      res.json(row);
      return;
    }

    if (req.method === "DELETE") {
      if (id == null) {
        res.status(404).json({});
        return;
      }
      await delegate(c).delete({ where: { id } });
      res.json({}); // json-server trả {} + 200
      return;
    }

    res.status(405).json({ error: "Phương thức không được hỗ trợ." });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        res.status(404).json({}); // update/delete bản ghi không tồn tại
        return;
      }
      if (e.code === "P2003") {
        res.status(409).json({ error: "Dữ liệu đang được tham chiếu." });
        return;
      }
      if (e.code === "P2002") {
        res.status(409).json({ error: "Dữ liệu đã tồn tại." });
        return;
      }
    }
    console.error("[api]", e);
    res.status(502).json({ error: "Lỗi cổng dữ liệu." });
  }
}
