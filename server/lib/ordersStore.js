import { head, put } from "@vercel/blob";

const BLOB_NAME = "vaha-ruchulu-orders.json";
const MAX_WRITE_RETRIES = 5;

export function createOrderId() {
  const date = new Date();
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VR-${y}${m}${d}-${rand}`;
}

function isPreconditionError(err) {
  return (
    err?.name === "BlobPreconditionFailedError" ||
    err?.code === "BLOB_PRECONDITION_FAILED" ||
    /precondition/i.test(String(err?.message || ""))
  );
}

async function readOrdersFromMeta(meta) {
  const cacheBust = meta.uploadedAt ? new Date(meta.uploadedAt).getTime() : Date.now();
  const res = await fetch(`${meta.url}?_=${cacheBust}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function readOrdersWithMeta() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { orders: [], etag: null };
  }

  try {
    const meta = await head(BLOB_NAME);
    const orders = await readOrdersFromMeta(meta);
    return { orders, etag: meta.etag };
  } catch {
    return { orders: [], etag: null };
  }
}

async function writeOrders(orders, ifMatch) {
  await put(BLOB_NAME, JSON.stringify(orders), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...(ifMatch ? { ifMatch } : {}),
  });
}

async function writeOrdersWithRetry(mutator) {
  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    const { orders, etag } = await readOrdersWithMeta();
    const result = mutator(orders);
    if (!result) return null;

    try {
      await writeOrders(result.orders, etag || undefined);
      return result.value;
    } catch (err) {
      if (isPreconditionError(err) && attempt < MAX_WRITE_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }
  return null;
}

export async function loadOrders() {
  const { orders } = await readOrdersWithMeta();
  return orders;
}

export async function saveOrders(orders) {
  await writeOrders(orders);
}

export async function getOrderById(id) {
  const orders = await loadOrders();
  const key = String(id).toUpperCase();
  return orders.find((o) => o.id.toUpperCase() === key) || null;
}

export async function addOrder(order) {
  const saved = await writeOrdersWithRetry((orders) => {
    orders.unshift(order);
    return { orders, value: order };
  });
  if (!saved) throw new Error("Could not save order. Please try again.");
  return saved;
}

export async function updateOrder(id, updates) {
  const key = String(id).toUpperCase();

  return writeOrdersWithRetry((orders) => {
    const index = orders.findIndex((o) => o.id.toUpperCase() === key);
    if (index === -1) return null;
    orders[index] = { ...orders[index], ...updates };
    return { orders, value: orders[index] };
  });
}
