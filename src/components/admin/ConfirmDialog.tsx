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
  return (
    <Modal title="Xác nhận" onClose={onCancel}>
      <p className="adm-k__confirm-msg">{message}</p>
      <div className="adm-k__modalact">
        <button className="adm-k__btn ghost" onClick={onCancel}>
          Hủy
        </button>
        <button className="adm-k__btn danger" onClick={onConfirm}>
          Xóa
        </button>
      </div>
    </Modal>
  );
}
