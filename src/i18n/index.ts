import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    fallbackLng: "vi",
    supportedLngs: ["vi", "en"],
    // CHỈ localStorage + htmlTag, KHÔNG navigator -> mặc định vi, e2e giữ xanh
    detection: {
      order: ["localStorage", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "lang",
    },
    interpolation: { escapeValue: false }, // React đã escape sẵn
  });

// Đồng bộ <html lang> theo ngôn ngữ hiện tại
document.documentElement.lang = i18n.language || "vi";
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
