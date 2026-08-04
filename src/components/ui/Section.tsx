import type { ReactNode } from "react";
import { cx } from "lib/cx";
import Rule from "./Rule";
import "./ui.css";

// Cố tình KHÔNG có prop `index`. Trước đây mỗi mục đeo một số "N°01/02/03",
// nhưng các mục trên một trang không phải một trình tự — không ai đọc mục 2
// trước mục 3, và cái số ấy chẳng cho biết điều gì. N° chỉ còn ở hai chỗ thứ tự
// là thật: chấm chuyển phim ở hero và bốn bước đặt vé.
export default function Section({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("ui-section", className)}>
      {label !== undefined && (
        <div className="ui-section__head">
          <span className="ui-section__label">{label}</span>
          <Rule />
        </div>
      )}
      {children}
    </section>
  );
}
