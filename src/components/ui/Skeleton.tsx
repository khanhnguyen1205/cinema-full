import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "lib/cx";
import "./ui.css";

export default function Skeleton({
  width = "100%",
  height = "1em",
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const style: CSSProperties = { width, height };
  return (
    <div
      className={cx("ui-skeleton", className)}
      style={style}
      role="status"
      aria-label={t("common.loadingLabel")}
    />
  );
}
