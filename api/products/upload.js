import { put } from "@vercel/blob";
import { isAdminRequest } from "../../server/lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!(await isAdminRequest(req))) {
    return res.status(401).json({ error: "Owner access required." });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Storage not configured." });
  }

  const dataUrl = String(req.body?.dataUrl || "");
  const filename = String(req.body?.filename || "product.jpg").replace(/[^a-zA-Z0-9._-]/g, "");

  if (!dataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "Invalid image data." });
  }

  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ error: "Could not read image." });
  }

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: "Image too large. Max 4 MB." });
  }

  const ext = filename.includes(".") ? filename.split(".").pop() : "jpg";
  const path = `products/upload-${Date.now()}.${ext}`;

  const blob = await put(path, buffer, {
    access: "public",
    contentType,
  });

  return res.status(200).json({ url: blob.url });
}
