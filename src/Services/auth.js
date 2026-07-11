const BASE_URL = "http://localhost:9999";

export const loginUser = async (email, password) => {
  const res = await fetch(`${BASE_URL}/users?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
  const users = await res.json();
  if (users.length === 0) throw new Error("Email hoặc mật khẩu không đúng.");
  return users[0];
};

export const registerUser = async ({ fullName, email, password }) => {
  // Check email exists
  const check = await fetch(`${BASE_URL}/users?email=${encodeURIComponent(email)}`);
  const existing = await check.json();
  if (existing.length > 0) throw new Error("Email này đã được đăng ký.");

  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName, email, password })
  });
  return res.json();
};
