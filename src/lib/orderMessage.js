import { WHATSAPP_DISPLAY } from "../config";
import { ORDER_STATUS_LABELS } from "./orders";

export function createLocalOrderId() {
  const date = new Date();
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VR-${y}${m}${d}-${rand}`;
}

export function buildOrderFromPayload(payload) {
  const items = payload.items.map((item) => ({
    ...item,
    subtotal: item.subtotal ?? item.linePrice * item.qty,
  }));
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    id: createLocalOrderId(),
    createdAt: new Date().toISOString(),
    status: "pending_payment",
    customer: payload.customer,
    items,
    total,
    notifications: { email: { sent: false } },
  };
}

export function buildWhatsAppOrderMessage(order, spiceLevel = "") {
  const items = order.items
    .map(
      (item) =>
        `• ${item.name} (${item.weightLabel}) × ${item.qty} = ₹${item.subtotal.toLocaleString("en-IN")}`
    )
    .join("\n");

  return (
    `*Vaha Ruchulu — New Order*\n` +
    `Order ID: *${order.id}*\n` +
    `Status: ${ORDER_STATUS_LABELS[order.status] || order.status}\n\n` +
    `*Items ordered:*\n${items}\n\n` +
    `*Total: ₹${order.total.toLocaleString("en-IN")}*\n` +
    `${spiceLevel ? `*Spice level:* ${spiceLevel}\n` : ""}\n` +
    `*Customer details:*\n` +
    `Name: ${order.customer.name}\n` +
    `Phone: ${order.customer.phone}\n` +
    `${order.customer.email ? `Email: ${order.customer.email}\n` : ""}` +
    `Address: ${order.customer.address}\n\n` +
    `Please confirm this order and share payment details (UPI/GPay/PhonePe). Thank you!`
  );
}

export function formatOrderDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
