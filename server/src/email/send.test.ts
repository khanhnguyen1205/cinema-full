import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../test/prismaMock";
import { sendTicketEmail } from "./send";

vi.mock("../db/prisma", async () => {
  const { prismaMock: mock } = await import("../test/prismaMock");
  return { prisma: mock };
});

// Không gọi mạng Resend.
const sendMailMock = vi.fn();
vi.mock("./resend", () => ({
  sendMail: (...args: unknown[]) => sendMailMock(...args),
  isEmailEnabled: () => true,
}));

beforeEach(() => {
  resetPrismaMock();
  sendMailMock.mockReset();
});

// gateway.ts gọi hàm này bằng `void` SAU KHI đã trả đơn cho client. Nếu nó throw,
// lỗi sẽ nổi lên thành unhandled rejection — và một email hỏng không bao giờ
// được phép làm hỏng một tấm vé đã trả tiền.
describe("email/send — không bao giờ throw", () => {
  it("đơn không tồn tại: trả kết quả lỗi, KHÔNG throw", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(null);
    await expect(sendTicketEmail(999, "vi")).resolves.toMatchObject({
      ok: false,
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("DB ném lỗi: nuốt lại thành {ok:false}, KHÔNG throw", async () => {
    prismaMock.booking.findUnique.mockRejectedValue(new Error("db die"));
    await expect(sendTicketEmail(1, "vi")).resolves.toMatchObject({
      ok: false,
    });
  });
});
