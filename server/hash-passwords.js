// Chay 1 lan: bam bcrypt cho moi user con luu mat khau plaintext trong db.json.
// Mat khau dang nhap khong doi (vd admin123), chi khac la DB khong con plaintext.
// Dung: node server/hash-passwords.js   (can json-server dang chay o :9999)
const bcrypt = require("bcryptjs");
const DATA_URL = process.env.DATA_URL || "http://localhost:9999";

(async () => {
  const users = await (await fetch(`${DATA_URL}/users`)).json();
  let changed = 0;
  for (const u of users) {
    if (typeof u.password === "string" && u.password.startsWith("$2")) continue; // da hash
    if (!u.password) continue;
    const hash = await bcrypt.hash(u.password, 10);
    await fetch(`${DATA_URL}/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: hash }),
    });
    console.log(`hashed user #${u.id} ${u.email}`);
    changed++;
  }
  console.log(`Done. ${changed}/${users.length} user duoc bam.`);
})().catch((e) => { console.error("Loi:", e.message); process.exit(1); });
