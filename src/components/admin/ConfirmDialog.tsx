import { useTranslation } from "react-i18next";
import Modal from "./Modal";

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={t("common.confirm")} onClose={onCancel}>
      <p className="adm-k__confirm-msg">{message}</p>
      <div className="adm-k__modalact">
        <button className="adm-k__btn ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="adm-k__btn danger" onClick={onConfirm}>
          {t("common.delete")}
        </button>
      </div>
    </Modal>
  );
}
