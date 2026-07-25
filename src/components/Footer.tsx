import { useTranslation } from "react-i18next";
import { Rule } from "components/ui";
import "./Footer.css";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="foot-k">
      <div className="foot-k__top">
        <div className="foot-k__brand">
          CINE<b>MA</b> — {t("footer.brand")}
        </div>
        <div className="foot-k__links">
          <a href="#">{t("footer.privacy")}</a>
          <a href="#">{t("footer.terms")}</a>
          <a href="#">{t("footer.help")}</a>
        </div>
      </div>
      <Rule />
      <div className="foot-k__copy">
        N°2026 · © THE CINEMATIC EDITORIAL · {t("footer.rights")}
      </div>
    </footer>
  );
}
