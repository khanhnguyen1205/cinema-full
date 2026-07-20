import { useEffect, useRef, useState } from "react";

export default function SeatHoldTimer({
  seconds = 480,
  active = true,
  resetKey = 0,
  onExpire,
}: {
  seconds?: number;
  active?: boolean;
  resetKey?: number;
  onExpire?: () => void;
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
    <div className={`hold-k ${left <= 60 ? "is-warn" : ""}`}>
      <span className="hold-k__label">Giữ ghế</span>
      <span className="hold-k__time">
        {mm}:{ss}
      </span>
    </div>
  );
}
