import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export default function Card({ children, className, ...rest }: CardProps) {
  return (
    <div className={cx("ui-card", className)} {...rest}>
      {children}
    </div>
  );
}
