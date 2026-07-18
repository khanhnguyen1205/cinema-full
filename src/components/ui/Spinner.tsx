import { cx } from "lib/cx";
import "./ui.css";

export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("ui-spinner", className)}
      role="status"
      aria-label="Đang tải"
    />
  );
}
