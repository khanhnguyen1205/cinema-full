import { useTranslation } from "react-i18next";
import { useInstallPrompt } from "hooks/useInstallPrompt";

export default function InstallButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { canInstall, promptInstall } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <button
      type="button"
      className={"install-k" + (className ? " " + className : "")}
      onClick={promptInstall}
    >
      {t("pwa.install")}
    </button>
  );
}
