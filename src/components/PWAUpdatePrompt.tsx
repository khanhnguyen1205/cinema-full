import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./PWAUpdatePrompt.css";

export default function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="pwa-k" role="alert">
      <span className="pwa-k__msg">{t("pwa.updateReady")}</span>
      <div className="pwa-k__actions">
        <button
          type="button"
          className="pwa-k__reload"
          onClick={() => updateServiceWorker(true)}
        >
          {t("pwa.reload")}
        </button>
        <button
          type="button"
          className="pwa-k__dismiss"
          aria-label={t("pwa.dismiss")}
          onClick={() => setNeedRefresh(false)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
