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
  getOrderById,
  loadOrders,
  updateOrder,
} from "../server/lib/ordersStore.js";
import { validateCustomer } from "../shared/customerValidation.js";

const ORDER_STATUSES = [
  "pending_payment",
  "payment_confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

async function parseBody(req) {
  if (req.body != null && req.body !== "") {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  if (typeof req.on !== "function") return {};
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function validateOrderBody(body) {
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!items.length) {
    return { error: "Order must include at least one item." };
  }

  const customerCheck = validateCustomer(body?.customer || {});
  if (!customerCheck.ok) {
    return { error: customerCheck.error };
  }

  const { name, phone, address, email } = customerCheck.customer;

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

  const clientId = String(body?.orderId || "").trim().toUpperCase();
  const id = /^VR-\d{6}-[A-Z0-9]{4}$/.test(clientId) ? clientId : createOrderId();

  return {
    order: {
      id,
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
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "POST") {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return res.status(503).json({
          error: "Order storage is not configured. Add Vercel Blob storage to this project.",
        });
      }

      const body = await parseBody(req);
      const result = validateOrderBody(body);
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

    const body = await parseBody(req);
    const id = String(body?.id || "").trim().toUpperCase();
    const status = String(body?.status || "").trim();
    const note = String(body?.note || "").trim();

    if (!id || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Valid order id and status are required." });
    }

    const existing = await getOrderById(id);
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

    const updated = await updateOrder(id, { status, statusHistory });

    if (!updated) {
      return res.status(500).json({ error: "Could not save order status. Please try again." });
    }

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
