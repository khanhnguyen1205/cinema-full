import { MAX_ITEM_QTY } from "lib/pricing";

const CATEGORIES = [
  { key: "combo", label: "Combo tiết kiệm" },
  { key: "popcorn", label: "Bắp rang" },
  { key: "drink", label: "Nước uống" },
  { key: "snack", label: "Snack" },
];

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";

export default function ConcessionStep({ catalog = [], qty = {}, onChange, loading }) {
  if (loading) return <div className="fnb-empty">Đang tải bắp nước...</div>;
  if (!catalog.length) return <div className="fnb-empty">Hiện chưa có bắp nước cho suất chiếu này.</div>;

  return (
    <div className="fnb-step">
      <div className="fnb-head">
        <h2 className="fnb-title">Thêm bắp nước</h2>
        <p className="fnb-sub">Không bắt buộc — bạn có thể xác nhận đặt vé mà không chọn món nào.</p>
      </div>

      {CATEGORIES.map(({ key, label }) => {
        const items = catalog.filter((c) => c.category === key);
        if (!items.length) return null;
        return (
          <section key={key} className="fnb-group">
            <h3 className="fnb-group-title">{label}</h3>
            <div className="fnb-grid">
              {items.map((item) => {
                const n = qty[item.id] || 0;
                return (
                  <article key={item.id} className={`fnb-card ${n > 0 ? "picked" : ""}`}>
                    <div className="fnb-emoji" aria-hidden="true">{item.image}</div>
                    <div className="fnb-info">
                      <h4 className="fnb-name">{item.name}</h4>
                      <p className="fnb-desc">{item.description}</p>
                      <span className="fnb-price">{fmt(item.price)}</span>
                    </div>
                    <div className="fnb-qty">
                      <button
                        className="fnb-btn"
                        disabled={n === 0}
                        onClick={() => onChange(item.id, n - 1)}
                        aria-label={`Bớt ${item.name}`}
                      >
                        −
                      </button>
                      <span className="fnb-count">{n}</span>
                      <button
                        className="fnb-btn"
                        disabled={n >= MAX_ITEM_QTY}
                        onClick={() => onChange(item.id, n + 1)}
                        aria-label={`Thêm ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
