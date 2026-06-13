import { verifyAdminPassword } from "../../server/lib/adminStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const password = String(req.body?.password || "");
  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  const valid = await verifyAdminPassword(password);
  if (!valid) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  return res.status(200).json({ ok: true });
}
