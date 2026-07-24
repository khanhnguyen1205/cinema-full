import { cx } from "lib/cx";

interface StarRatingProps {
  value: number; // 0..5 (0 = chưa chọn); readonly cho phép số thập phân
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

const STARS = [1, 2, 3, 4, 5];

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  ariaLabel,
}: StarRatingProps) {
  if (readonly) {
    return (
      <span
        className={cx("ui-stars", `ui-stars--${size}`)}
        aria-label={ariaLabel ?? `${value} trên 5 sao`}
        role="img"
      >
        {STARS.map((s) => (
          <span
            key={s}
            className={cx("ui-stars__star", value >= s - 0.5 && "is-on")}
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </span>
    );
  }

  const move = (delta: number) => {
    const next = Math.min(5, Math.max(1, (value || 0) + delta));
    onChange?.(next);
  };

  return (
    <span
      className={cx("ui-stars", "ui-stars--input", `ui-stars--${size}`)}
      role="radiogroup"
      aria-label={ariaLabel ?? "Chấm điểm từ 1 đến 5 sao"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          move(-1);
        } else if (/^[1-5]$/.test(e.key)) {
          e.preventDefault();
          onChange?.(Number(e.key));
        }
      }}
    >
      {STARS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} sao`}
          className={cx(
            "ui-stars__star",
            "ui-stars__btn",
            value >= s && "is-on",
          )}
          tabIndex={-1}
          onClick={() => onChange?.(s)}
        >
          ★
        </button>
      ))}
    </span>
  );
}
