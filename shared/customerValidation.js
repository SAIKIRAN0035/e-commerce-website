/** Shared customer field validation (frontend + API). */

export function normalizePhone(raw) {
  let p = String(raw || "").trim().replace(/[\s\-().]/g, "");
  if (!p) return "";

  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  if (!p.startsWith("+")) {
    if (/^91\d{10}$/.test(p)) p = `+${p}`;
    else if (/^\d{10}$/.test(p)) p = `+91${p}`;
    else if (/^\d{11,15}$/.test(p)) p = `+${p}`;
  }

  return p;
}

export function isValidPhone(raw) {
  const p = normalizePhone(raw);
  return /^\+[1-9]\d{9,14}$/.test(p);
}

export function isValidEmail(email) {
  const e = String(email || "").trim();
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e);
}

export function isValidName(name) {
  const n = String(name || "").trim();
  return n.length >= 2 && /^[\p{L}\s.'-]+$/u.test(n);
}

export function isValidAddress(address) {
  const a = String(address || "").trim();
  if (a.length < 12) return false;
  const words = a.split(/\s+/).filter(Boolean);
  const hasPinOrNumber = /\d{4,}/.test(a);
  const hasStructure = /,/.test(a) || words.length >= 4;
  return hasPinOrNumber || hasStructure;
}

export function phonesMatch(stored, entered) {
  const a = normalizePhone(stored);
  const b = normalizePhone(entered);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.slice(-10) === b.slice(-10) && a.slice(-10).length === 10) return true;
  return false;
}

export function validateCustomer(customer) {
  const name = String(customer?.name || "").trim();
  const phoneRaw = String(customer?.phone || "").trim();
  const email = String(customer?.email || "").trim();
  const address = String(customer?.address || "").trim();

  if (!isValidName(name)) {
    return { error: "Enter your full name (at least 2 letters)." };
  }

  const phone = normalizePhone(phoneRaw);
  if (!isValidPhone(phoneRaw)) {
    return {
      error: "Enter a valid phone number with country code (e.g. +91 9876543210).",
    };
  }

  if (!isValidEmail(email)) {
    return { error: "Enter a valid email address for order confirmation." };
  }

  if (!isValidAddress(address)) {
    return {
      error: "Enter your full delivery address (street, area, city, and pincode).",
    };
  }

  return {
    ok: true,
    customer: {
      name,
      phone,
      email: email.toLowerCase(),
      address,
    },
  };
}
