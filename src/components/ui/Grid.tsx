import type { CSSProperties, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

export default function Grid({
  children,
  min = "220px",
  className,
}: {
  children: ReactNode;
  min?: string;
  className?: string;
}) {
  const style: CSSProperties & Record<string, string> = { "--grid-min": min };
  return (
    <div className={cx("ui-grid", className)} style={style}>
      {children}
    </div>
  );
}
