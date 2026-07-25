import { useTranslation } from "react-i18next";

const METHODS = [
  {
    key: "momo",
    emoji: "💗",
    nameKey: "booking.momoName",
    descKey: "booking.momoDesc",
  },
  {
    key: "card",
    emoji: "💳",
    nameKey: "booking.cardName",
    descKey: "booking.cardDesc",
  },
  {
    key: "counter",
    emoji: "🏦",
    nameKey: "booking.counterName",
    descKey: "booking.counterDesc",
  },
];

export default function PaymentStep({
  method,
  onChange,
}: {
  method: string;
  onChange: (m: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pay-k">
      <div className="pay-k__head">
        <h2 className="pay-k__title">{t("booking.payTitle")}</h2>
        <p className="pay-k__sub">{t("booking.payDemo")}</p>
      </div>

      <div className="pay-k__methods">
        {METHODS.map((m) => (
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

      <p className="pay-k__note">
        {t("booking.payEncrypted", { action: t("booking.pay") })}
      </p>
    </div>
  );
}
