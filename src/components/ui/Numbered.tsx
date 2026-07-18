import { cx } from "lib/cx";
import "./ui.css";

// Helper thuần đặt cạnh component dùng nó; export chung file nên tắt cảnh báo Fast Refresh.
// eslint-disable-next-line react-refresh/only-export-components
export function formatIndex(n: number): string {
  return `N°${String(n).padStart(2, "0")}`;
}

export default function Numbered({
  n,
  className,
}: {
  n: number;
  className?: string;
}) {
  return <span className={cx("ui-numbered", className)}>{formatIndex(n)}</span>;
}
