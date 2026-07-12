import Modal from "./Modal";

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Xác nhận" onClose={onCancel}>
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{message}</p>
      <div className="modal-actions">
        <button className="admin-btn ghost" onClick={onCancel}>Hủy</button>
        <button className="admin-btn danger" onClick={onConfirm}>Xóa</button>
      </div>
    </Modal>
  );
}
