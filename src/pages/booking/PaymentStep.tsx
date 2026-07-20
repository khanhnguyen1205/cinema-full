const METHODS = [
  {
    key: "momo",
    emoji: "💗",
    name: "Ví Momo",
    desc: "Quét mã QR trên app Momo để thanh toán.",
  },
  {
    key: "card",
    emoji: "💳",
    name: "Thẻ ATM / Visa",
    desc: "Thẻ nội địa hoặc quốc tế (Visa, Mastercard).",
  },
  {
    key: "counter",
    emoji: "🏦",
    name: "Thanh toán tại quầy",
    desc: "Giữ chỗ và trả tiền mặt khi tới rạp.",
  },
];

export default function PaymentStep({
  method,
  onChange,
}: {
  method: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="pay-k">
      <div className="pay-k__head">
        <h2 className="pay-k__title">Phương thức thanh toán</h2>
        <p className="pay-k__sub">
          Đây là bản demo — không nhập và không lưu thông tin thẻ thật.
        </p>
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
              <span className="pay-k__name">{m.name}</span>
              <span className="pay-k__desc">{m.desc}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="pay-k__note">
        🔒 Thông tin đơn hàng được mã hoá. Nhấn “Thanh toán” để hoàn tất và nhận
        vé điện tử.
      </p>
    </div>
  );
}
