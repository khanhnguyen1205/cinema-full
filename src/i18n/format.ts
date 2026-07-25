import i18n from "i18n";

const localeOf = (): string =>
  (i18n.language || "vi").startsWith("en") ? "en-US" : "vi-VN";

// Giá LUÔN VND, chỉ nhóm số theo locale
export const formatPrice = (n: number): string =>
  `${n.toLocaleString(localeOf())} ₫`;

export const formatDateTime = (
  iso: string,
  opts?: Intl.DateTimeFormatOptions,
): string => new Date(iso).toLocaleString(localeOf(), opts);

export const formatDate = (
  iso: string,
  opts?: Intl.DateTimeFormatOptions,
): string => new Date(iso).toLocaleDateString(localeOf(), opts);
