import { useTranslation } from "react-i18next";
import type { MutableRefObject } from "react";
import type { IntentResult } from "services/payments";
import StripePayForm, { type PayHandle } from "./StripePayForm";

export default function PaymentStep({
  method,
  onChange,
  cardEnabled,
  publishableKey,
  amount,
  payHandleRef,
  createIntent,
  onPaid,
  onError,
}: {
  method: string;
  onChange: (m: string) => void;
  cardEnabled: boolean;
  publishableKey: string;
  amount: number;
  payHandleRef: MutableRefObject<PayHandle | null>;
  createIntent: () => Promise<IntentResult>;
  onPaid: (paymentRef: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  // Chỉ hiện thẻ khi server đã cấu hình Stripe; "tại quầy" thì luôn có.
  const methods = [
    ...(cardEnabled
      ? [
          {
            key: "card",
            emoji: "💳",
            nameKey: "booking.cardName",
            descKey: "booking.cardDesc",
          },
        ]
      : []),
    {
      key: "counter",
      emoji: "🏦",
      nameKey: "booking.counterName",
      descKey: "booking.counterDesc",
    },
  ];

  return (
    <div className="pay-k">
      <div className="pay-k__head">
        <h2 className="pay-k__title">{t("booking.payTitle")}</h2>
        <p className="pay-k__sub">{t("booking.payDemo")}</p>
      </div>

      <div className="pay-k__methods">
        {methods.map((m) => (
          <label
            key={m.key}
            className={"pay-k__card" + (method === m.key ? " is-picked" : "")}
          >
            <input
              type="radio"
              name="payment"
              value={m.key}
              checked={method === m.key}
              onChange={() => onChange(m.key)}
            />
            <span className="pay-k__emoji" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pay-k__info">
              <span className="pay-k__name">{t(m.nameKey)}</span>
              <span className="pay-k__desc">{t(m.descKey)}</span>
            </span>
          </label>
        ))}
      </div>

      {cardEnabled && method === "card" && amount > 0 && (
        <StripePayForm
          publishableKey={publishableKey}
          amount={amount}
          handleRef={payHandleRef}
          createIntent={createIntent}
          onPaid={onPaid}
          onError={onError}
        />
      )}

      <p className="pay-k__note">
        {t("booking.payEncrypted", { action: t("booking.pay") })}
      </p>
    </div>
  );
}
