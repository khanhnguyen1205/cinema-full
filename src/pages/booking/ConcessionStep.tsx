import { useTranslation } from "react-i18next";
import type { Concession } from "types";
import { MAX_ITEM_QTY } from "lib/pricing";
import { formatPrice } from "i18n/format";

// Khoá i18n cho các danh mục quen thuộc + thứ tự ưu tiên hiển thị.
const KNOWN_CAT_KEYS: Record<string, string> = {
  combo: "booking.catCombo",
  popcorn: "booking.catPopcorn",
  drink: "booking.catDrink",
  snack: "booking.catSnack",
};

// Suy ra danh mục từ chính catalog: nhóm quen đi trước, nhóm lạ nối vào cuối.
function categoriesOf(catalog: Concession[]): string[] {
  const present = [...new Set(catalog.map((c) => c.category || "khac"))];
  const known = Object.keys(KNOWN_CAT_KEYS).filter((k) => present.includes(k));
  const extra = present.filter((k) => !(k in KNOWN_CAT_KEYS));
  return [...known, ...extra];
}

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
  const { t } = useTranslation();
  const catLabel = (key: string) =>
    KNOWN_CAT_KEYS[key]
      ? t(KNOWN_CAT_KEYS[key])
      : key
        ? key[0].toUpperCase() + key.slice(1)
        : t("booking.catOther");

  if (loading)
    return <div className="fnb-k__msg">{t("booking.fnbLoading")}</div>;
  if (error)
    return (
      <div className="fnb-k__msg">
        <p>{t("booking.fnbError")}</p>
        {onRetry && (
          <button type="button" className="fnb-k__retry" onClick={onRetry}>
            {t("common.retry")}
          </button>
        )}
      </div>
    );
  if (!catalog.length)
    return <div className="fnb-k__msg">{t("booking.fnbEmpty")}</div>;

  return (
    <div className="fnb-k">
      <div className="fnb-k__head">
        <h2 className="fnb-k__title">{t("booking.fnbTitle")}</h2>
        <p className="fnb-k__sub">{t("booking.fnbSub")}</p>
      </div>

      {categoriesOf(catalog).map((key) => {
        // categoriesOf chỉ trả về danh mục CÓ mặt trong catalog -> items luôn khác rỗng.
        const items = catalog.filter((c) => (c.category || "khac") === key);
        return (
          <section key={key} className="fnb-k__group">
            <h3 className="fnb-k__grouptitle">{catLabel(key)}</h3>
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
                      <span className="fnb-k__price">
                        {formatPrice(item.price)}
                      </span>
                    </div>
                    <div className="fnb-k__qty">
                      <button
                        type="button"
                        className="fnb-k__btn"
                        disabled={n === 0}
                        onClick={() => onChange(item.id, -1)}
                        aria-label={t("booking.fnbDecrease", {
                          name: item.name,
                        })}
                      >
                        −
                      </button>
                      <span className="fnb-k__count">{n}</span>
                      <button
                        type="button"
                        className="fnb-k__btn"
                        disabled={n >= MAX_ITEM_QTY}
                        onClick={() => onChange(item.id, 1)}
                        aria-label={t("booking.fnbIncrease", {
                          name: item.name,
                        })}
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
