import QRCode from "qrcode";

// PNG cho ảnh đính kèm. Trả null nếu sinh lỗi: email vẫn phải đi được vì mã vé
// dạng chữ đủ dùng ở quầy.
export async function qrPng(value: string): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(value, { type: "png", width: 480, margin: 1 });
  } catch (e) {
    console.error("[email] qr", e);
    return null;
  }
}
