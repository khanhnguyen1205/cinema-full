import { useTranslation } from "react-i18next";
import { Rule } from "components/ui";
import "./Footer.css";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="foot-k">
      <div className="foot-k__top">
        {/* Trước đây ở đây là "CINEMA — THE CINEMATIC EDITORIAL". Câu ấy mô tả
            phong cách của chính trang web chứ không nói gì về việc đặt vé, và
            nó bằng tiếng Anh trên một sản phẩm mặc định tiếng Việt. Tên thương
            hiệu tự đứng một mình là đủ. */}
        <div className="foot-k__brand">
          CINE<b>MA</b>
        </div>
        <div className="foot-k__links">
          <a href="#">{t("footer.privacy")}</a>
          <a href="#">{t("footer.terms")}</a>
          <a href="#">{t("footer.help")}</a>
        </div>
      </div>
      <Rule />
      <div className="foot-k__copy">© 2026 Cinema · {t("footer.rights")}</div>
    </footer>
  );
}
