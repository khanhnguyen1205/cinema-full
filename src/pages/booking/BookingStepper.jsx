export const BOOKING_STEPS = [
  { n: 1, label: "Chọn ghế" },
  { n: 2, label: "Bắp nước" },
  { n: 3, label: "Thanh toán" },
  { n: 4, label: "Vé của bạn" },
];

export default function BookingStepper({ step, steps = BOOKING_STEPS, onBack }) {
  return (
    <div className="stepper">
      <button className="stepper-back" onClick={onBack} disabled={step <= 1}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Quay lại
      </button>
      <ol className="stepper-list">
        {steps.map(({ n, label }, i) => (
          <li key={n} className={`stepper-item ${n === step ? "current" : ""} ${n < step ? "done" : ""}`}>
            <span className="stepper-dot">{n < step ? "✓" : n}</span>
            <span className="stepper-label">{label}</span>
            {i < steps.length - 1 && <span className="stepper-line" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
