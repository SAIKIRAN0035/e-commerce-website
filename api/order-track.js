import { loadOrders } from "../server/lib/ordersStore.js";

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = String(req.body?.id || "").trim().toUpperCase();
  const phone = normalizePhone(req.body?.phone);

  if (!id || !phone || phone.length < 10) {
    return res.status(400).json({ error: "Order ID and phone number are required." });
  }

  try {
    const orders = await loadOrders();
    const order = orders.find((o) => o.id.toUpperCase() === id);

    if (!order || normalizePhone(order.customer.phone) !== phone) {
      return res.status(404).json({ error: "Order not found. Check your Order ID and phone number." });
    }

    return res.status(200).json({
      id: order.id,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        name: item.name,
        weightLabel: item.weightLabel,
        qty: item.qty,
        subtotal: item.subtotal,
      })),
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        address: order.customer.address,
      },
    });
  } catch {
    return res.status(500).json({ error: "Could not look up order." });
  }
}
