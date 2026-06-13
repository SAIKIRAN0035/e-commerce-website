import { head, put } from "@vercel/blob";

const BLOB_NAME = "vaha-ruchulu-orders.json";

export function createOrderId() {
  const date = new Date();
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VR-${y}${m}${d}-${rand}`;
}

export async function loadOrders() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];

  try {
    const meta = await head(BLOB_NAME);
    const res = await fetch(meta.url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveOrders(orders) {
  await put(BLOB_NAME, JSON.stringify(orders), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function getOrderById(id) {
  const orders = await loadOrders();
  return orders.find((o) => o.id === id) || null;
}

export async function addOrder(order) {
  const orders = await loadOrders();
  orders.unshift(order);
  await saveOrders(orders);
  return order;
}

export async function updateOrder(id, updates, existingOrders = null) {
  const orders = existingOrders || (await loadOrders());
  const index = orders.findIndex((o) => o.id === id);
  if (index === -1) return null;

  orders[index] = { ...orders[index], ...updates };
  await saveOrders(orders);
  return orders[index];
}
