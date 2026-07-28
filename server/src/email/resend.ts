// KHÔNG import ./env: env.ts throw khi thiếu DATABASE_URL, mà thư mục email/ có unit
// test chạy trong job CI `checks` (không có database). Cùng khuôn payments/stripe.ts.
const API = "https://api.resend.com/emails";

// Thiếu key => tính năng email tắt êm, server vẫn khởi động bình thường.
export const isEmailEnabled = (): boolean =>
  Boolean(process.env.RESEND_API_KEY);

const sender = (): string =>
  process.env.MAIL_FROM || "Cinema <onboarding@resend.dev>";

export interface MailAttachment {
  filename: string;
  content: string; // base64
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
}

export type SendMailResult =
  { ok: true; id: string } | { ok: false; error: string };

// Gọi thẳng HTTP API của Resend — Node 22 có fetch sẵn nên không cần SDK.
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!isEmailEnabled()) return { ok: false, error: "Chưa cấu hình email." };
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.attachments?.length
          ? { attachments: input.attachments }
          : {}),
      }),
    });
    const data = (await r.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!r.ok)
      return { ok: false, error: data.message || `Resend ${r.status}` };
    return { ok: true, id: data.id || "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Lỗi mạng khi gửi email.",
    };
  }
}
