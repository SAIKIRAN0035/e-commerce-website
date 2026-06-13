import { getAdminToken } from "./adminAuth";
import { products as fallbackProducts, categories as fallbackCategories, PRODUCT_CATEGORIES } from "../data/products";

function adminHeaders() {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function availableOnly(products) {
  return products.filter((p) => p.inStock !== false);
}

export async function fetchProducts() {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      return {
        products: availableOnly(data.products || []),
        categories: data.categories || fallbackCategories,
      };
    }
  } catch {
    /* use fallback */
  }

  return { products: availableOnly(fallbackProducts), categories: fallbackCategories };
}

export async function fetchProductsAdmin() {
  const res = await fetch("/api/products", { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load inventory.");
  return {
    products: data.products || [],
    categories: data.categories || fallbackCategories,
  };
}

export async function createProduct(product) {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(product),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not add product.");
  return data;
}

export async function updateProductAdmin(id, updates) {
  const res = await fetch("/api/products", {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ id, ...updates }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not update product.");
  return data;
}

export async function deleteProductAdmin(id) {
  const res = await fetch("/api/products", {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not delete product.");
  return true;
}

export async function uploadProductImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch("/api/products/upload", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ dataUrl, filename: file.name }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not upload image.");
  return data.url;
}

export { PRODUCT_CATEGORIES };
