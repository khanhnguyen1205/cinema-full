// Mốc thời gian trong DB là chuỗi "YYYY-MM-DDTHH:mm:ss" KHÔNG mang múi giờ, hiểu theo
// giờ địa phương của rạp. Muốn so sánh bằng chuỗi thì "bây giờ" cũng phải ở đúng dạng
// đó — dùng toISOString() (UTC) sẽ lệch đúng bằng offset múi giờ, ở VN là 7 tiếng, tức
// là giấu mất các suất trong 7 giờ tới.
const p2 = (n: number): string => String(n).padStart(2, "0");

export const nowKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` +
  `T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;

// Suất chiếu chưa bắt đầu. Rạp không bán vé cho suất đã chiếu.
export const isUpcoming = (time: string, now: string = nowKey()): boolean =>
  Boolean(time) && time >= now;
