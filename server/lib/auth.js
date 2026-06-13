import { verifyAdminPassword } from "./adminStore.js";

export async function isAdminRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  return verifyAdminPassword(token);
}

export function adminNotConfigured(res) {
  return res.status(503).json({
    error: "Owner login is not configured. Set REVIEWS_ADMIN_PASSWORD in Vercel environment variables.",
  });
}
