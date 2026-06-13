import { ORDER_STATUS_LABELS } from "./orders";

export async function trackOrder(id, phone) {
  const res = await fetch("/api/order-track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, phone }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Order not found.");
  }

  return {
    ...data,
    statusLabel: ORDER_STATUS_LABELS[data.status] || data.status,
  };
}
