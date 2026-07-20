import { MAX_ITEM_QTY } from "lib/pricing";

// Nhãn cho các danh mục quen thuộc + thứ tự ưu tiên hiển thị.
const KNOWN_LABELS = {
  combo: "Combo tiết kiệm",
  popcorn: "Bắp rang",
  drink: "Nước uống",
  snack: "Snack",
};

const labelize = (key) => (key ? key[0].toUpperCase() + key.slice(1) : "Khác");

// Suy ra danh mục từ chính catalog: nhóm quen đi trước theo thứ tự KNOWN_LABELS,
// nhóm lạ (thêm mới trong db.json) tự nối vào cuối thay vì biến mất.
function categoriesOf(catalog) {
  const present = [...new Set(catalog.map((c) => c.category || "khac"))];
  const known = Object.keys(KNOWN_LABELS).filter((k) => present.includes(k));
  const extra = present.filter((k) => !(k in KNOWN_LABELS));
  return [...known, ...extra].map((key) => ({
    key,
    label: KNOWN_LABELS[key] || labelize(key),
  }));
}

const fmt = (n) => n.toLocaleString("vi-VN") + "₫";

export default function ConcessionStep({
  catalog,
  qty,
  onChange,
  loading,
  error,
  onRetry,
}) {
  if (loading) return <div className="fnb-empty">Đang tải bắp nước...</div>;
  if (error)
    return (
      <div className="fnb-empty">
        <p>Không tải được danh sách bắp nước.</p>
        {onRetry && (
          <button className="fnb-retry" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  if (!catalog.length)
    return <div className="fnb-empty">Hiện chưa có bắp nước để chọn.</div>;

  return (
    <div className="fnb-step">
      <div className="fnb-head">
        <h2 className="fnb-title">Thêm bắp nước</h2>
        <p className="fnb-sub">
          Không bắt buộc — bạn có thể xác nhận đặt vé mà không chọn món nào.
        </p>
      </div>

      {categoriesOf(catalog).map(({ key, label }) => {
        const items = catalog.filter((c) => (c.category || "khac") === key);
        if (!items.length) return null;
        return (
          <section key={key} className="fnb-group">
            <h3 className="fnb-group-title">{label}</h3>
            <div className="fnb-grid">
              {items.map((item) => {
                const n = qty[item.id] || 0;
                return (
                  <article
                    key={item.id}
                    className={`fnb-card ${n > 0 ? "picked" : ""}`}
                  >
                    <div className="fnb-emoji" aria-hidden="true">
                      {item.image}
                    </div>
                    <div className="fnb-info">
                      <h4 className="fnb-name">{item.name}</h4>
                      <p className="fnb-desc">{item.description}</p>
                      <span className="fnb-price">{fmt(item.price)}</span>
                    </div>
                    <div className="fnb-qty">
                      <button
                        className="fnb-btn"
                        disabled={n === 0}
                        onClick={() => onChange(item.id, -1)}
                        aria-label={`Bớt ${item.name}`}
                      >
                        −
                      </button>
                      <span className="fnb-count">{n}</span>
                      <button
                        className="fnb-btn"
                        disabled={n >= MAX_ITEM_QTY}
                        onClick={() => onChange(item.id, 1)}
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
