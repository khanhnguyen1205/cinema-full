import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { formatDateTime } from "i18n/format";

/** Ngày + giờ như mọi bảng quản trị vẫn hiện; không có mốc thì trả gạch ngang. */
export function adminDateTime(iso?: string): string {
  if (!iso) return "—";
  return formatDateTime(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Bảng tra theo id, thay cho một `find` chạy lại ở từng dòng. */
export function useById<T extends { id: number }>(
  rows: T[],
): Record<string, T | undefined> {
  return useMemo(
    () => Object.fromEntries(rows.map((row) => [String(row.id), row] as const)),
    [rows],
  );
}

type FormValues = Record<string, string>;

type FieldEvent = ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

export interface AdminForm<TRow, TForm extends FormValues> {
  editing: TRow | "new" | null;
  form: TForm;
  error: string;
  setError: (message: string) => void;
  openNew: () => void;
  openEdit: (row: TRow, values: TForm) => void;
  close: () => void;
  set: (key: keyof TForm) => (e: FieldEvent) => void;
}

/**
 * Trạng thái form của một bảng quản trị (đang sửa gì, giá trị các ô, lỗi).
 * Mọi ô giữ kiểu CHUỖI cho khớp với <input>; trang tự đổi sang số lúc lưu.
 * `derive` chạy sau mỗi lần đổi ô, để điền giá trị phụ thuộc — hiện chỉ suất
 * chiếu dùng: chọn phòng thì gợi ý giá theo loại phòng.
 */
export function useAdminForm<TRow, TForm extends FormValues>(
  empty: TForm,
  derive?: (next: TForm, key: keyof TForm) => TForm,
): AdminForm<TRow, TForm> {
  const [editing, setEditing] = useState<TRow | "new" | null>(null);
  const [form, setForm] = useState<TForm>(empty);
  const [error, setError] = useState("");

  const openNew = () => {
    setForm(empty);
    setError("");
    setEditing("new");
  };

  const openEdit = (row: TRow, values: TForm) => {
    setForm(values);
    setError("");
    setEditing(row);
  };

  const set = (key: keyof TForm) => (e: FieldEvent) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value } as TForm;
      return derive ? derive(next, key) : next;
    });
  };

  return {
    editing,
    form,
    error,
    setError,
    openNew,
    openEdit,
    close: () => setEditing(null),
    set,
  };
}

export interface ConfirmDelete {
  confirmId: number | null;
  ask: (id: number) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
}

/**
 * Hộp xác nhận xoá: nhớ id đang hỏi, chạy `remove` rồi tự đóng. `remove` là nơi
 * đặt các chốt chặn của từng trang (vd phim còn suất chiếu thì alert và không
 * gọi API) — bỏ qua việc gọi API vẫn đóng hộp thoại như trước.
 */
export function useConfirmDelete(
  remove: (id: number) => void | Promise<unknown>,
): ConfirmDelete {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  return {
    confirmId,
    ask: setConfirmId,
    cancel: () => setConfirmId(null),
    confirm: async () => {
      if (confirmId == null) return;
      await remove(confirmId);
      setConfirmId(null);
    },
  };
}
