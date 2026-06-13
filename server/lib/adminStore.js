import { head, put } from "@vercel/blob";
import { hashPassword, verifyPassword } from "./password.js";

const BLOB_NAME = "vaha-ruchulu-admin.json";

const EMPTY = { passwordHash: null, reset: null };

async function loadAdmin() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ...EMPTY };

  try {
    const meta = await head(BLOB_NAME);
    const res = await fetch(meta.url);
    if (!res.ok) return { ...EMPTY };
    const data = await res.json();
    return { ...EMPTY, ...data };
  } catch {
    return { ...EMPTY };
  }
}

async function saveAdmin(data) {
  await put(BLOB_NAME, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function verifyAdminPassword(password) {
  if (!password) return false;

  const envPassword = process.env.REVIEWS_ADMIN_PASSWORD;
  if (envPassword && password === envPassword) return true;

  const admin = await loadAdmin();
  if (admin.passwordHash && verifyPassword(password, admin.passwordHash)) {
    return true;
  }

  return false;
}

export async function setAdminPassword(password) {
  const admin = await loadAdmin();
  admin.passwordHash = hashPassword(password);
  admin.reset = null;
  await saveAdmin(admin);
  return true;
}

export async function createPasswordReset() {
  const { generateResetCode } = await import("./password.js");
  const admin = await loadAdmin();
  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  admin.reset = { code, expiresAt };
  await saveAdmin(admin);

  return { code, expiresAt };
}

export async function resetPasswordWithCode(code, newPassword) {
  const admin = await loadAdmin();
  if (!admin.reset || admin.reset.code !== String(code).trim()) {
    return { ok: false, error: "Invalid reset code." };
  }

  if (new Date(admin.reset.expiresAt) < new Date()) {
    return { ok: false, error: "Reset code expired. Request a new one." };
  }

  if (String(newPassword).length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  admin.passwordHash = hashPassword(newPassword);
  admin.reset = null;
  await saveAdmin(admin);

  return { ok: true };
}
