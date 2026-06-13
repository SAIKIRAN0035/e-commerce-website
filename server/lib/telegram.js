const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID;

export function isTelegramConfigured() {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

export async function sendOrderAlert(order) {
  if (!isTelegramConfigured()) {
    return { sent: false, reason: "telegram_not_configured" };
  }

  const items = order.items
    .map(
      (item) =>
        `• ${item.name} (${item.weightLabel}) × ${item.qty} = ₹${item.subtotal.toLocaleString("en-IN")}`
    )
    .join("\n");

  const text =
    `🛒 New Vaha Ruchulu Order\n\n` +
    `Order ID: ${order.id}\n` +
    `Total: ₹${order.total.toLocaleString("en-IN")}\n\n` +
    `Items:\n${items}\n\n` +
    `Customer:\n` +
    `Name: ${order.customer.name}\n` +
    `Phone: ${order.customer.phone}\n` +
    `${order.customer.email ? `Email: ${order.customer.email}\n` : ""}` +
    `Address: ${order.customer.address}\n\n` +
    `Status: Awaiting payment\n` +
    `Open website → Footer → Owner → Orders to confirm payment.`;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Telegram alert failed:", err);
    return { sent: false, reason: "telegram_failed" };
  }

  return { sent: true };
}
