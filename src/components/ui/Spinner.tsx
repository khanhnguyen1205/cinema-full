import { useTranslation } from "react-i18next";
import { cx } from "lib/cx";
import "./ui.css";

export default function Spinner({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cx("ui-spinner", className)}
      role="status"
      aria-label={t("common.loadingLabel")}
    />
  );
}
