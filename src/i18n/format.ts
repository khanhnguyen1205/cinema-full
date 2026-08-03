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

// Nhãn ngày ngắn trên các dải chọn ngày (Movies / MovieDetail / CinemaDetail)
export const formatDayShort = (iso: string): string =>
  formatDate(iso, { weekday: "short", day: "2-digit", month: "2-digit" });

// Giờ chiếu: đồng hồ 24h CỐ ĐỊNH, không theo locale — en-US sẽ ra "7:30 PM",
// làm vỡ lưới nút giờ và lệch với giờ in trên vé.
export const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

// Nhãn một suất chiếu trong kết quả tìm kiếm: giờ + thứ/ngày/tháng
export const formatShowtimeLabel = (iso: string): string =>
  formatDateTime(iso, {
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
