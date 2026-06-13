import { getAdminToken } from "./adminAuth";
import { buildOrderFromPayload } from "./orderMessage";

export const ORDER_STATUS_LABELS = {
  pending_payment: "Awaiting Payment",
  payment_confirmed: "Payment Confirmed",
  preparing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function adminHeaders() {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function createOrder(payload) {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
  } catch {
    /* fall through to local order for WhatsApp */
  }

  return buildOrderFromPayload(payload);
}

export async function fetchOrdersAdmin() {
  const res = await fetch("/api/orders", {
    headers: adminHeaders(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not load orders.");
  }

  return Array.isArray(data) ? data : [];
}

export async function updateOrderStatus(id, status, note = "") {
  const res = await fetch("/api/orders", {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ id, status, note }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not update order.");
  }

  return data;
}
