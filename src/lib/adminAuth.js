const ADMIN_TOKEN_KEY = "vaha-ruchulu-admin-token";

export function getAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAdminToken(token) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function isAdminLoggedIn() {
  return Boolean(getAdminToken());
}

export async function loginAdmin(password) {
  const res = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Login failed.");
  }

  setAdminToken(password);
  return true;
}

export function logoutAdmin() {
  clearAdminToken();
}

export async function requestPasswordReset() {
  const res = await fetch("/api/admin/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not send reset code.");
  }

  return data;
}

export async function resetAdminPassword(code, password) {
  const res = await fetch("/api/admin/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not reset password.");
  }

  return data;
}
