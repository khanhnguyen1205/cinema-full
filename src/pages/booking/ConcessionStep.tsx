import type { Concession } from "types";
import { MAX_ITEM_QTY } from "lib/pricing";

// Nhãn cho các danh mục quen thuộc + thứ tự ưu tiên hiển thị.
const KNOWN_LABELS: Record<string, string> = {
  combo: "Combo tiết kiệm",
  popcorn: "Bắp rang",
  drink: "Nước uống",
  snack: "Snack",
};

const labelize = (key: string) =>
  key ? key[0].toUpperCase() + key.slice(1) : "Khác";

// Suy ra danh mục từ chính catalog: nhóm quen đi trước, nhóm lạ nối vào cuối.
function categoriesOf(catalog: Concession[]) {
  const present = [...new Set(catalog.map((c) => c.category || "khac"))];
  const known = Object.keys(KNOWN_LABELS).filter((k) => present.includes(k));
  const extra = present.filter((k) => !(k in KNOWN_LABELS));
  return [...known, ...extra].map((key) => ({
    key,
    label: KNOWN_LABELS[key] || labelize(key),
  }));
}

const fmt = (n: number) => n.toLocaleString("vi-VN") + "₫";

export default function ConcessionStep({
  catalog = [],
  qty = {},
  onChange,
  loading,
  error,
  onRetry,
}: {
  catalog?: Concession[];
  qty?: Record<number, number>;
  onChange: (id: number, delta: number) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (loading) return <div className="fnb-k__msg">Đang tải bắp nước...</div>;
  if (error)
    return (
      <div className="fnb-k__msg">
        <p>Không tải được danh sách bắp nước.</p>
        {onRetry && (
          <button type="button" className="fnb-k__retry" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  if (!catalog.length)
    return <div className="fnb-k__msg">Hiện chưa có bắp nước để chọn.</div>;

  return (
    <div className="fnb-k">
      <div className="fnb-k__head">
        <h2 className="fnb-k__title">Thêm bắp nước</h2>
        <p className="fnb-k__sub">
          Không bắt buộc — bạn có thể xác nhận đặt vé mà không chọn món nào.
        </p>
      </div>

      {categoriesOf(catalog).map(({ key, label }) => {
        const items = catalog.filter((c) => (c.category || "khac") === key);
        if (!items.length) return null;
        return (
          <section key={key} className="fnb-k__group">
            <h3 className="fnb-k__grouptitle">{label}</h3>
            <div className="fnb-k__grid">
              {items.map((item) => {
                const n = qty[item.id] || 0;
                return (
                  <article
                    key={item.id}
                    className={"fnb-k__card" + (n > 0 ? " is-picked" : "")}
                  >
                    <div className="fnb-k__emoji" aria-hidden="true">
                      {item.image}
                    </div>
                    <div className="fnb-k__info">
                      <h4 className="fnb-k__name">{item.name}</h4>
                      <p className="fnb-k__desc">{item.description}</p>
                      <span className="fnb-k__price">{fmt(item.price)}</span>
                    </div>
                    <div className="fnb-k__qty">
                      <button
                        type="button"
                        className="fnb-k__btn"
                        disabled={n === 0}
                        onClick={() => onChange(item.id, -1)}
                        aria-label={`Bớt ${item.name}`}
                      >
                        −
                      </button>
                      <span className="fnb-k__count">{n}</span>
                      <button
                        type="button"
                        className="fnb-k__btn"
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
