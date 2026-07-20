const BOOKING_STEPS = [
  { n: 1, label: "Chọn ghế" },
  { n: 2, label: "Bắp nước" },
  { n: 3, label: "Thanh toán" },
  { n: 4, label: "Vé của bạn" },
];

export default function BookingStepper({
  step,
  onBack,
}: {
  step: number;
  onBack: () => void;
}) {
  return (
    <div className="stepper-k">
      <button
        type="button"
        className="stepper-k__back"
        onClick={onBack}
        disabled={step <= 1}
      >
        ← Quay lại
      </button>
      <ol className="stepper-k__list">
        {BOOKING_STEPS.map(({ n, label }) => (
          <li
            key={n}
            className={
              "stepper-k__item" +
              (n === step ? " is-current" : "") +
              (n < step ? " is-done" : "")
            }
            aria-current={n === step ? "step" : undefined}
          >
            <span className="stepper-k__no">{n < step ? "✓" : `N°0${n}`}</span>
            <span className="stepper-k__label">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
