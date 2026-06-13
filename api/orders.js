import { adminNotConfigured, isAdminRequest } from "../server/lib/auth.js";
// Email is optional — loaded only when configured
async function trySendNewOrderEmails(order) {
  try {
    const { isEmailConfigured, sendNewOrderEmails } = await import("../server/lib/email.js");
    if (!isEmailConfigured()) return { sent: false, reason: "email_not_configured" };

    await Promise.race([
      sendNewOrderEmails(order),
      new Promise((_, reject) => setTimeout(() => reject(new Error("email_timeout")), 4000)),
    ]);
    return { sent: true };
  } catch {
    return { sent: false, reason: "email_failed" };
  }
}

async function trySendPaymentConfirmedEmail(order) {
  try {
    const { isEmailConfigured, sendPaymentConfirmedEmail } = await import("../server/lib/email.js");
    if (!isEmailConfigured()) return { sent: false };

    await Promise.race([
      sendPaymentConfirmedEmail(order),
      new Promise((_, reject) => setTimeout(() => reject(new Error("email_timeout")), 4000)),
    ]);
    return { sent: true };
  } catch {
    return { sent: false };
  }
}

async function trySendTelegramAlert(order) {
  try {
    const { sendOrderAlert } = await import("../server/lib/telegram.js");
    return await sendOrderAlert(order);
  } catch {
    return { sent: false, reason: "telegram_failed" };
  }
}
import {
  addOrder,
  createOrderId,
  loadOrders,
  updateOrder,
} from "../server/lib/ordersStore.js";

const ORDER_STATUSES = [
  "pending_payment",
  "payment_confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

function validateOrderBody(body) {
  const customer = body?.customer || {};
  const name = String(customer.name || "").trim();
  const phone = String(customer.phone || "").trim();
  const address = String(customer.address || "").trim();
  const email = String(customer.email || "").trim();
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!name || !phone || !address) {
    return { error: "Name, phone, and delivery address are required." };
  }
  if (!items.length) {
    return { error: "Order must include at least one item." };
  }

  const normalizedItems = items.map((item) => {
    const qty = Number(item.qty);
    const linePrice = Number(item.linePrice);
    if (!item.name || !item.weightLabel || !Number.isInteger(qty) || qty < 1) {
      return null;
    }
    const subtotal = Math.round(linePrice * qty);
    return {
      id: item.id,
      name: String(item.name),
      weightLabel: String(item.weightLabel),
      qty,
      linePrice,
      subtotal,
    };
  });

  if (normalizedItems.some((item) => !item)) {
    return { error: "Invalid order items." };
  }

  const total = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    order: {
      id: createOrderId(),
      createdAt: new Date().toISOString(),
      status: "pending_payment",
      customer: { name, phone, address, email },
      items: normalizedItems,
      total,
      statusHistory: [
        {
          status: "pending_payment",
          at: new Date().toISOString(),
          note: "Order placed on website",
        },
      ],
    },
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({
          error: "Order storage is not configured. Add Vercel Blob storage to this project.",
        });
      }

      const result = validateOrderBody(req.body);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const saved = await addOrder(result.order);
      const [emailResult, telegramResult] = await Promise.all([
        trySendNewOrderEmails(saved),
        trySendTelegramAlert(saved),
      ]);

      return res.status(201).json({
        ...saved,
        notifications: { email: emailResult, telegram: telegramResult },
      });
    }

  if (req.method === "GET" || req.method === "PATCH") {
    if (!process.env.REVIEWS_ADMIN_PASSWORD) {
      return adminNotConfigured(res);
    }
    if (!(await isAdminRequest(req))) {
      return res.status(401).json({ error: "Owner access required." });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({
        error: "Order storage is not configured.",
      });
    }

    if (req.method === "GET") {
      const orders = await loadOrders();
      return res.status(200).json(orders);
    }

    const id = String(req.body?.id || "").trim();
    const status = String(req.body?.status || "").trim();
    const note = String(req.body?.note || "").trim();

    if (!id || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Valid order id and status are required." });
    }

    const orders = await loadOrders();
    const existing = orders.find((o) => o.id === id);
    if (!existing) {
      return res.status(404).json({ error: "Order not found." });
    }

    const statusHistory = [
      ...(existing.statusHistory || []),
      {
        status,
        at: new Date().toISOString(),
        note: note || `Status updated to ${status}`,
      },
    ];

    const updated = await updateOrder(id, { status, statusHistory }, orders);

    if (status === "payment_confirmed" && existing.status !== "payment_confirmed") {
      trySendPaymentConfirmedEmail(updated);
    }

    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Orders API error:", error);
    return res.status(500).json({
      error: "Could not process order. Please try again or order on WhatsApp.",
    });
  }
}
