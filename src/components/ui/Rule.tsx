import { cx } from "lib/cx";
import "./ui.css";

export default function Rule({ className }: { className?: string }) {
  return <hr className={cx("ui-rule", className)} />;
}
