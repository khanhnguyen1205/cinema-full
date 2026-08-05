// Người dùng và kho bình luận.
//
// Vì sao cần thêm người: `@@unique([movieId, userId])` đặt trần CỨNG ở số user.
// 4 user nghĩa là tối đa 4 đánh giá mỗi phim, sinh bao nhiêu review cũng vô ích.
//
// Tất cả dùng chung mật khẩu "123456" nên dùng chung một hash — bcrypt nhúng
// salt ngay trong chuỗi hash nên vẫn xác thực bình thường. Hash MỘT LẦN rồi
// nhúng hằng số vào đây: hash lúc sinh thì mỗi lần chạy ra chuỗi khác (salt
// ngẫu nhiên) và diff db.json nhảy lung tung dù dữ liệu không đổi.
//
// Sinh lại bằng: node -e "console.log(require('bcryptjs').hashSync('123456', 10))"
export const PASSWORD_HASH =
  "$2b$10$eDDZNg9F.L9W3hpGQpKDoecLPAR.ut7f7mssHJlKzk9W4zK8NFeRK";

export const NEW_USERS = [
  { fullName: "Trần Thị Mai", email: "mai.tran@cinema.vn" },
  { fullName: "Lê Hoàng Nam", email: "nam.le@cinema.vn" },
  { fullName: "Phạm Thu Hà", email: "ha.pham@cinema.vn" },
  { fullName: "Vũ Đức Anh", email: "anh.vu@cinema.vn" },
  { fullName: "Đỗ Ngọc Linh", email: "linh.do@cinema.vn" },
  { fullName: "Bùi Quang Huy", email: "huy.bui@cinema.vn" },
  { fullName: "Ngô Thanh Trúc", email: "truc.ngo@cinema.vn" },
  { fullName: "Hoàng Minh Tuấn", email: "tuan.hoang@cinema.vn" },
  { fullName: "Đặng Thị Hương", email: "huong.dang@cinema.vn" },
  { fullName: "Lý Gia Bảo", email: "bao.ly@cinema.vn" },
  { fullName: "Trịnh Khánh Vy", email: "vy.trinh@cinema.vn" },
  { fullName: "Phan Trọng Nghĩa", email: "nghia.phan@cinema.vn" },
  { fullName: "Võ Thị Kim Ngân", email: "ngan.vo@cinema.vn" },
  { fullName: "Dương Hải Đăng", email: "dang.duong@cinema.vn" },
  { fullName: "Tạ Phương Thảo", email: "thao.ta@cinema.vn" },
  { fullName: "Chu Việt Hùng", email: "hung.chu@cinema.vn" },
  { fullName: "Mai Thị Lan", email: "lan.mai@cinema.vn" },
  { fullName: "Đinh Bá Lộc", email: "loc.dinh@cinema.vn" },
  { fullName: "Hồ Yến Nhi", email: "nhi.ho@cinema.vn" },
  { fullName: "Nguyễn Tiến Đạt", email: "dat.nguyen@cinema.vn" },
  { fullName: "Lâm Bảo Châu", email: "chau.lam@cinema.vn" },
  { fullName: "Trương Công Định", email: "dinh.truong@cinema.vn" },
  { fullName: "Kiều Thị Diễm", email: "diem.kieu@cinema.vn" },
  { fullName: "Đoàn Nhật Minh", email: "minh.doan@cinema.vn" },
  { fullName: "Huỳnh Tấn Phát", email: "phat.huynh@cinema.vn" },
  { fullName: "Cao Mỹ Duyên", email: "duyen.cao@cinema.vn" },
];

// Bình luận chia theo số sao để giọng văn khớp điểm — 5 sao mà viết "tạm được"
// thì nhìn là biết máy sinh.
export const COMMENTS = {
  5: [
    "Quá đã! Hình ảnh và âm thanh ngoài rạp đúng là khác hẳn xem ở nhà.",
    "Xem xong còn ngồi lại hết credit. Đáng từng đồng tiền vé.",
    "Kịch bản chặt, diễn xuất tốt, không có một phút thừa.",
    "Cảnh cuối nổi da gà thật sự. Sẽ đi xem lại lần nữa.",
    "Phim hay nhất mình xem năm nay, không nói quá.",
    "Rủ cả nhà đi xem, ai cũng khen. Rạp kín ghế mà im phăng phắc.",
    "Âm thanh phòng IMAX làm cả người rung theo. Nên xem màn hình lớn.",
    "Đầu tư chỉn chu từ hình ảnh tới nhạc nền. Xuất sắc.",
    "Cốt truyện cuốn từ phút đầu, hai tiếng trôi cái vèo.",
    "Diễn viên chính gánh cả phim. Xem xong ám ảnh mấy hôm.",
    "Đi xem suất khuya mà tỉnh như sáo. Quá hay.",
    "Bản thân mình không dễ tính nhưng phim này không chê được chỗ nào.",
  ],
  4: [
    "Phim hay, diễn viên tròn vai. Đoạn giữa hơi dài nhưng vẫn đáng xem.",
    "Đáng tiền vé. Chỉ tiếc cái kết hơi vội.",
    "Hình ảnh đẹp, nhạc hay. Nội dung dễ đoán một chút thôi.",
    "Xem thoải mái, không phải suy nghĩ nhiều. Ổn.",
    "Tốt hơn mình nghĩ. Sẽ giới thiệu cho bạn bè.",
    "Mạch phim ổn định, vài chỗ hơi lê thê nhưng tổng thể tốt.",
    "Vai phụ diễn hay hơn cả vai chính, cũng thú vị.",
    "Đi xem cuối tuần rất hợp. Ghế VIP ngồi thoải mái.",
    "Phần hình ảnh trên cả mong đợi, kịch bản thì vừa phải.",
    "Không tiếc tiền vé. Trừ điểm vì đoạn mở đầu hơi chậm.",
    "Xem lần đầu thấy hay, chắc xem lại sẽ còn thấy nhiều chi tiết.",
    "Chất lượng ổn định, đúng kiểu phim đáng ra rạp.",
  ],
  3: [
    "Xem được, không xuất sắc. Đi cho biết thì ổn.",
    "Nửa đầu cuốn, nửa sau đuối dần.",
    "Bình thường. Chờ đợi hơi nhiều nên hơi hụt.",
    "Kỹ xảo đẹp nhưng câu chuyện thì nhạt.",
    "Được cái nhạc hay, còn lại thì tạm.",
    "Không dở, cũng không có gì đáng nhớ.",
    "Xem một lần là đủ. Chờ lên nền tảng cũng được.",
    "Diễn viên cố gắng nhưng kịch bản chưa tới.",
    "Tạm ổn cho một buổi tối rảnh rỗi.",
    "Có vài cảnh hay, tiếc là không đủ để cứu cả phim.",
  ],
  2: [
    "Kịch bản lỏng lẻo, mình hơi tiếc tiền vé.",
    "Dài dòng quá, ngồi hết phim khá mệt.",
    "Nhân vật xây dựng hời hợt, không thấy đồng cảm được.",
    "Trailer hay hơn phim. Hụt hẫng.",
    "Kỹ xảo ổn nhưng nội dung rời rạc.",
    "Xem được nửa là đoán ra kết. Nhạt.",
    "Không hợp gu mình, chắc do kỳ vọng cao quá.",
    "Nhiều chi tiết vô lý, khó vào được phim.",
  ],
  1: [
    "Thật sự không xem nổi, mình ra về sớm.",
    "Mất tiền vé. Không giới thiệu cho ai.",
    "Lộn xộn từ đầu đến cuối, không hiểu phim muốn nói gì.",
    "Chán. Ngồi trong rạp mà cứ nhìn đồng hồ.",
    "Diễn xuất gượng, thoại thì sáo rỗng.",
    "Đây là phim tệ nhất mình xem ở rạp năm nay.",
  ],
};
