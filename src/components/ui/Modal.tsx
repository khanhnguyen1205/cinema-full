import { useEffect } from "react";
import type { ReactNode } from "react";
import IconButton from "./IconButton";
import "./ui.css";

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ui-modal-overlay" onMouseDown={onClose}>
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ui-modal__head">
          <h2 className="ui-modal__title">{title}</h2>
          <IconButton label="Đóng" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </div>
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}
