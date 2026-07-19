import { Rule } from "components/ui";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="foot-k">
      <div className="foot-k__top">
        <div className="foot-k__brand">
          CINE<b>MA</b> — THE CINEMATIC EDITORIAL
        </div>
        <div className="foot-k__links">
          <a href="#">Chính sách bảo mật</a>
          <a href="#">Điều khoản dịch vụ</a>
          <a href="#">Trung tâm trợ giúp</a>
        </div>
      </div>
      <Rule />
      <div className="foot-k__copy">
        N°2026 · © THE CINEMATIC EDITORIAL · BẢO LƯU MỌI QUYỀN
      </div>
    </footer>
  );
}
