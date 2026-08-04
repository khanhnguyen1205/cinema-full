import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "components/Navbar";
import Footer from "components/Footer";
import { Container, Button } from "components/ui";
import "./NotFound.css";

// Trước khi có trang này, <Routes> không khớp đường dẫn lạ nào thì dựng RỖNG:
// nền đen, không thanh điều hướng, không một chữ, không một lối ra. Người dùng
// gõ nhầm một ký tự là mắc kẹt, chỉ còn cách bấm Back của trình duyệt.
export default function NotFound() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="page nf-k">
      <Navbar />
      <Container>
        <div className="nf-k__body">
          <span className="nf-k__code">404</span>
          <h1 className="nf-k__title">{t("notFound.title")}</h1>
          <p className="nf-k__desc">{t("notFound.desc")}</p>
          {/* In ra đúng đường dẫn đã gõ: người dùng tự thấy mình sai ở đâu. */}
          <code className="nf-k__path">{pathname}</code>
          <div className="nf-k__actions">
            <Button size="lg" onClick={() => navigate("/")}>
              {t("notFound.home")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/movies")}
            >
              {t("notFound.movies")}
            </Button>
          </div>
        </div>
      </Container>
      <Footer />
    </div>
  );
}
