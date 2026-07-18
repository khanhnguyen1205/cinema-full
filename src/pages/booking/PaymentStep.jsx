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

export default function PaymentStep({ method, onChange }) {
  return (
    <div className="pay-step">
      <div className="pay-head">
        <h2 className="pay-title">Phương thức thanh toán</h2>
        <p className="pay-sub">
          Đây là bản demo — không nhập và không lưu thông tin thẻ thật.
        </p>
      </div>

      <div className="pay-methods">
        {METHODS.map((m) => (
          <label
            key={m.key}
            className={`pay-card ${method === m.key ? "picked" : ""}`}
          >
            <input
              type="radio"
              name="payment"
              value={m.key}
              checked={method === m.key}
              onChange={() => onChange(m.key)}
            />
            <span className="pay-emoji" aria-hidden="true">
              {m.emoji}
            </span>
            <span className="pay-info">
              <span className="pay-name">{m.name}</span>
              <span className="pay-desc">{m.desc}</span>
            </span>
            <span className="pay-radio" aria-hidden="true" />
          </label>
        ))}
      </div>

      <p className="pay-note">
        🔒 Thông tin đơn hàng được mã hoá. Nhấn “Thanh toán” để hoàn tất và nhận
        vé điện tử.
      </p>
    </div>
  );
}
