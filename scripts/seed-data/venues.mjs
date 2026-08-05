// Thành phố / rạp / phòng mới. Không phần tử nào mang `id` — generator cấp id
// chạy tiếp từ max(id) hiện có, và bản backfill lên production còn để Postgres
// tự cấp rồi ánh xạ lại FK.
export const NEW_CITIES = [{ name: "Hải Phòng" }, { name: "Cần Thơ" }];

export const NEW_CINEMAS = [
  {
    name: "CGV Crescent Mall",
    address: "101 Tôn Dật Tiên, Quận 7, TP.HCM",
    cityName: "TP. Hồ Chí Minh",
  },
  {
    name: "Beta Cinemas Thủ Đức",
    address: "18 Võ Văn Ngân, Thủ Đức, TP.HCM",
    cityName: "TP. Hồ Chí Minh",
  },
  {
    name: "Lotte Cinema Hà Đông",
    address: "8 Quang Trung, Hà Đông, Hà Nội",
    cityName: "Hà Nội",
  },
  {
    name: "Cinestar Mỹ Đình",
    address: "2 Lê Đức Thọ, Nam Từ Liêm, Hà Nội",
    cityName: "Hà Nội",
  },
  {
    name: "CGV Vincom Ngô Quyền",
    address: "910A Ngô Quyền, Sơn Trà, Đà Nẵng",
    cityName: "Đà Nẵng",
  },
  {
    name: "BHD Star Hải Phòng",
    address: "1 Lê Hồng Phong, Ngô Quyền, Hải Phòng",
    cityName: "Hải Phòng",
  },
  {
    name: "Lotte Cinema Cần Thơ",
    address: "84 Mậu Thân, Ninh Kiều, Cần Thơ",
    cityName: "Cần Thơ",
  },
];

// 14 phòng, 2 mỗi rạp. `type` quyết định giá nền: 2D 75k · 3D 95k · IMAX 120k.
//
// Ít nhất 6 phòng có `coupleRows`: hiện toàn hệ thống chỉ 2 phòng có ghế đôi và
// cả hai đều thuộc rạp 1, nên tính năng ghế đôi vô hình ở 4/5 rạp.
export const NEW_ROOMS = [
  // CGV Crescent Mall
  {
    cinemaName: "CGV Crescent Mall",
    name: "Phòng 1",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: ["H"],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "CGV Crescent Mall",
    name: "Phòng IMAX",
    type: "IMAX",
    rows: 10,
    cols: 14,
    vipRows: ["F", "G", "H"],
    coupleRows: ["J"],
    aisleAfterCols: [7],
  },
  // Beta Cinemas Thủ Đức
  {
    cinemaName: "Beta Cinemas Thủ Đức",
    name: "Phòng 1",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: [],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "Beta Cinemas Thủ Đức",
    name: "Phòng 2",
    type: "3D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F", "G"],
    coupleRows: ["H"],
    aisleAfterCols: [6],
  },
  // Lotte Cinema Hà Đông
  {
    cinemaName: "Lotte Cinema Hà Đông",
    name: "Phòng 1",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: [],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "Lotte Cinema Hà Đông",
    name: "Phòng 2",
    type: "3D",
    rows: 9,
    cols: 12,
    vipRows: ["F", "G"],
    coupleRows: ["I"],
    aisleAfterCols: [6],
  },
  // Cinestar Mỹ Đình
  {
    cinemaName: "Cinestar Mỹ Đình",
    name: "Phòng 1",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: [],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "Cinestar Mỹ Đình",
    name: "Phòng IMAX",
    type: "IMAX",
    rows: 10,
    cols: 14,
    vipRows: ["F", "G", "H"],
    coupleRows: ["J"],
    aisleAfterCols: [7],
  },
  // CGV Vincom Ngô Quyền
  {
    cinemaName: "CGV Vincom Ngô Quyền",
    name: "Phòng 1",
    type: "3D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F", "G"],
    coupleRows: [],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "CGV Vincom Ngô Quyền",
    name: "Phòng 2",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: ["H"],
    aisleAfterCols: [6],
  },
  // BHD Star Hải Phòng
  {
    cinemaName: "BHD Star Hải Phòng",
    name: "Phòng 1",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: [],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "BHD Star Hải Phòng",
    name: "Phòng 2",
    type: "3D",
    rows: 9,
    cols: 12,
    vipRows: ["F", "G"],
    coupleRows: ["I"],
    aisleAfterCols: [6],
  },
  // Lotte Cinema Cần Thơ
  {
    cinemaName: "Lotte Cinema Cần Thơ",
    name: "Phòng 1",
    type: "2D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F"],
    coupleRows: [],
    aisleAfterCols: [6],
  },
  {
    cinemaName: "Lotte Cinema Cần Thơ",
    name: "Phòng 2",
    type: "3D",
    rows: 8,
    cols: 12,
    vipRows: ["E", "F", "G"],
    coupleRows: ["H"],
    aisleAfterCols: [6],
  },
];
