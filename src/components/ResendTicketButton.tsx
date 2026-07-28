import { useTranslation } from "react-i18next";
import { useEmailConfig, useResendTicket } from "queries/email";
import "./ResendTicketButton.css";

// Không cấu hình email (thiếu RESEND_API_KEY) -> nút biến mất, không báo lỗi gì.
export default function ResendTicketButton({
  bookingId,
}: {
  bookingId: number;
}) {
  const { t } = useTranslation();
  const config = useEmailConfig();
  const resend = useResendTicket();

  if (!config.data?.enabled) return null;

  return (
    <div className="resend-k">
      <button
        type="button"
        className="resend-k__btn"
        disabled={resend.isPending}
        onClick={() => resend.mutate(bookingId)}
      >
        {resend.isPending ? t("email.sending") : t("email.resend")}
      </button>
      {resend.isSuccess && (
        <span className="resend-k__ok" role="status">
          {t("email.resendOk")}
        </span>
      )}
      {resend.isError && (
        <span className="resend-k__err" role="alert">
          {resend.error.message}
        </span>
      )}
    </div>
  );
}
