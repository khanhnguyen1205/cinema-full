import { useTranslation } from "react-i18next";
import "./LanguageSwitcher.css";

const LANGS = [
  { code: "vi", label: "VI" },
  { code: "en", label: "EN" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en" : "vi";
  return (
    <div className="lang-k" role="group" aria-label="Ngôn ngữ / Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={"lang-k__btn" + (current === l.code ? " is-active" : "")}
          aria-pressed={current === l.code}
          onClick={() => i18n.changeLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
