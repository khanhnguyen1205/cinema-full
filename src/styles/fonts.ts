// Self-host font (thay CDN Google Fonts). Chỉ side-effect import.
//
// Mỗi bộ chữ ở đây PHẢI có subset `vietnamese`. Bebas Neue và Space Mono từng
// đứng ở hai vai trò dưới đây và đều KHÔNG có — chúng chỉ phát hành `latin` +
// `latin-ext`, nên mọi nguyên âm có dấu chồng (ệ, ế, ộ, ư…) rơi sang font dự
// phòng ngay giữa một từ. Tiếng Việt là ngôn ngữ mặc định của app, nên gần như
// mọi tiêu đề đều vỡ. Xem e2e/smoke.spec.ts để biết chốt chặn tái phát.
import "@fontsource/anton/400.css";
import "@fontsource/barlow/300.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
// Barlow Condensed = --font-head: tiêu đề trang/mục/hộp thoại. Anton chỉ còn
// dành cho tên phim, logo và số tiền lớn — xem khối Typography trong tokens.css.
import "@fontsource/barlow-condensed/300.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
