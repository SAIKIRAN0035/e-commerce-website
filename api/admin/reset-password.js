import { resetPasswordWithCode } from "../../server/lib/adminStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Storage not configured." });
  }

  const code = String(req.body?.code || "").trim();
  const password = String(req.body?.password || "");

  if (!code || !password) {
    return res.status(400).json({ error: "Reset code and new password are required." });
  }

  const result = await resetPasswordWithCode(code, password);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  return res.status(200).json({ ok: true, message: "Password updated. Sign in with your new password." });
}
