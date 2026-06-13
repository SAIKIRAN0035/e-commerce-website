import { head, put } from "@vercel/blob";
import { DEFAULT_PRODUCTS } from "./defaultProducts.js";

const BLOB_NAME = "vaha-ruchulu-products.json";

export function normalizeProduct(product) {
  return { ...product, inStock: product.inStock !== false };
}

export function normalizeProducts(products) {
  return products.map(normalizeProduct);
}

export async function loadProducts() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return [...DEFAULT_PRODUCTS];
  }

  try {
    const meta = await head(BLOB_NAME);
    const res = await fetch(meta.url);
    if (!res.ok) return [...DEFAULT_PRODUCTS];
    const data = await res.json();
    return Array.isArray(data) && data.length ? data : [...DEFAULT_PRODUCTS];
  } catch {
    return [...DEFAULT_PRODUCTS];
  }
}

export async function saveProducts(products) {
  await put(BLOB_NAME, JSON.stringify(products), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export function nextProductId(products) {
  const maxId = products.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
  return maxId + 1;
}

export async function addProduct(product) {
  const products = await loadProducts();
  products.push(product);
  await saveProducts(products);
  return product;
}

export async function updateProduct(id, updates) {
  const products = await loadProducts();
  const index = products.findIndex((p) => String(p.id) === String(id));
  if (index === -1) return null;

  products[index] = { ...products[index], ...updates, id: products[index].id };
  await saveProducts(products);
  return products[index];
}

export async function deleteProduct(id) {
  const products = await loadProducts();
  const next = products.filter((p) => String(p.id) !== String(id));
  if (next.length === products.length) return false;

  await saveProducts(next);
  return true;
}
