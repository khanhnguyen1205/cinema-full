// Email vé qua cổng phân quyền (:4000/api/emails).
import i18n from "i18n";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export interface EmailConfig {
  enabled: boolean;
}

export const getEmailConfig = (): Promise<EmailConfig> =>
  fetch(`${BASE_URL}/emails/config`, { credentials: "include" }).then(
    (r) => r.json() as Promise<EmailConfig>,
  );

export async function resendTicketEmail(bookingId: number): Promise<void> {
  const r = await fetch(`${BASE_URL}/emails/ticket`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-lang": i18n.language || "vi", // server chọn mẫu mail vi/en theo header này
    },
    body: JSON.stringify({ bookingId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Không gửi được email.");
}
