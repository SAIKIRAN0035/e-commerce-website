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

export const ORDER_STATUS_CUSTOMER_HINTS = {
  pending_payment: "Complete payment as shared on WhatsApp. We'll email you when payment is confirmed.",
  payment_confirmed: "Payment received. We're getting your order ready.",
  preparing: "Your order is being prepared fresh.",
  shipped: "Your package is on the way.",
  delivered: "Your order has been delivered. Enjoy!",
  cancelled: "This order was cancelled. Contact us on WhatsApp if you have questions.",
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
    cache: "no-store",
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
    cache: "no-store",
    body: JSON.stringify({ id, status, note }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not update order.");
  }

  return data;
}
