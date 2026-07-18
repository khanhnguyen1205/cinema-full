import { useEffect, useRef, useState } from "react";

export default function SeatHoldTimer({
  seconds = 480,
  active = true,
  resetKey = 0,
  onExpire,
}) {
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);

  // resetKey đổi (sau khi hết giờ được reset) -> đếm lại từ đầu
  useEffect(() => {
    setLeft(seconds);
    firedRef.current = false;
  }, [resetKey, seconds]);

  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, active, onExpire]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className={`hold-timer ${left <= 60 ? "warning" : ""}`}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
      <span>
        Giữ ghế {mm}:{ss}
      </span>
    </div>
  );
}
