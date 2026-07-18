import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "lib/cx";
import "./ui.css";

type Variant = "solid" | "outline" | "ghost" | "invert";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export default function Button({
  variant = "solid",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        "ui-btn",
        `ui-btn--${variant}`,
        `ui-btn--${size}`,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
