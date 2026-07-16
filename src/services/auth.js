const BASE_URL = "http://localhost:9999";

// Chuẩn hóa email để so khớp nhất quán (json-server so khớp chính xác chuỗi):
// "  Admin@Cinema.VN " và "admin@cinema.vn" phải coi là một.
const normalizeEmail = (email) => (email || "").trim().toLowerCase();

export const loginUser = async (email, password) => {
  const res = await fetch(`${BASE_URL}/users?email=${encodeURIComponent(normalizeEmail(email))}&password=${encodeURIComponent(password)}`);
  const users = await res.json();
  if (users.length === 0) throw new Error("Email hoặc mật khẩu không đúng.");
  return users[0];
};

export const registerUser = async ({ fullName, email, password }) => {
  const normEmail = normalizeEmail(email);

  // Check email exists
  const check = await fetch(`${BASE_URL}/users?email=${encodeURIComponent(normEmail)}`);
  const existing = await check.json();
  if (existing.length > 0) throw new Error("Email này đã được đăng ký.");

  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName: (fullName || "").trim(), email: normEmail, password, role: "user" })
  });
  return res.json();
};
