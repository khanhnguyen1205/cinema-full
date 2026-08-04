import { useTranslation } from "react-i18next";
import { formatIndex } from "components/ui";

const BOOKING_STEPS = [
  { n: 1, key: "booking.stepSeats" },
  { n: 2, key: "booking.stepFnb" },
  { n: 3, key: "booking.stepPay" },
  { n: 4, key: "booking.stepTicket" },
];

export default function BookingStepper({
  step,
  onBack,
}: {
  step: number;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="stepper-k">
      <button
        type="button"
        className="stepper-k__back"
        onClick={onBack}
        disabled={step <= 1}
      >
        ← {t("booking.back")}
      </button>
      <ol className="stepper-k__list">
        {BOOKING_STEPS.map(({ n, key }) => (
          <li
            key={n}
            className={
              "stepper-k__item" +
              (n === step ? " is-current" : "") +
              (n < step ? " is-done" : "")
            }
            aria-current={n === step ? "step" : undefined}
          >
            {/* Chỗ N° thứ hai và cuối cùng còn được giữ: bốn bước đặt vé là
                trình tự thật, phải làm bước 2 xong mới sang bước 3. */}
            <span className="stepper-k__no">
              {n < step ? "✓" : formatIndex(n)}
            </span>
            <span className="stepper-k__label">{t(key)}</span>
          </li>
        ))}
      </ol>
      {/* Chỉ hiện ở khổ hẹp, nơi CSS thu danh sách còn mỗi bước hiện tại:
          "N°03 THANH TOÁN" cho biết đang ở đâu, còn "3/4" cho biết còn bao xa. */}
      <span className="stepper-k__count">
        {step}/{BOOKING_STEPS.length}
      </span>
    </div>
  );
}
