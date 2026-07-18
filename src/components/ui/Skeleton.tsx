import type { CSSProperties } from "react";
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
  const style: CSSProperties = { width, height };
  return (
    <div
      className={cx("ui-skeleton", className)}
      style={style}
      role="status"
      aria-label="Đang tải"
    />
  );
}
