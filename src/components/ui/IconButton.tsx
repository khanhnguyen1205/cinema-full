import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
> {
  label: string;
  children: ReactNode;
}

export default function IconButton({
  label,
  children,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      className={cx("ui-iconbtn", className)}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}
