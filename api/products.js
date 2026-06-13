import { adminNotConfigured, isAdminRequest } from "../server/lib/auth.js";
import { PRODUCT_CATEGORIES } from "../server/lib/defaultProducts.js";
import {
  addProduct,
  deleteProduct,
  loadProducts,
  nextProductId,
  normalizeProducts,
  updateProduct,
} from "../server/lib/productsStore.js";

function validateProduct(body, isNew = false) {
  const name = String(body?.name || "").trim();
  const category = String(body?.category || "").trim();
  const price = Number(body?.price);
  const image = String(body?.image || "").trim();
  const imageAlt = String(body?.imageAlt || name).trim();

  if (!name) return { error: "Product name is required." };
  if (!PRODUCT_CATEGORIES.includes(category)) {
    return { error: "Invalid category." };
  }
  if (!Number.isFinite(price) || price < 1) {
    return { error: "Valid price per KG is required." };
  }
  if (!image) return { error: "Product image is required." };

  return {
    product: {
      name,
      category,
      price: Math.round(price),
      unit: "KG",
      image,
      imageAlt,
      inStock: body?.inStock !== false,
    },
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const products = normalizeProducts(await loadProducts());
      const isOwner = process.env.REVIEWS_ADMIN_PASSWORD && (await isAdminRequest(req));
      const visible = isOwner ? products : products.filter((p) => p.inStock);

      return res.status(200).json({
        products: visible,
        categories: ["All", ...PRODUCT_CATEGORIES],
      });
    }

    if (!process.env.REVIEWS_ADMIN_PASSWORD) {
      return adminNotConfigured(res);
    }
    if (!(await isAdminRequest(req))) {
      return res.status(401).json({ error: "Owner access required." });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: "Storage not configured." });
    }

    if (req.method === "POST") {
      const result = validateProduct(req.body, true);
      if (result.error) return res.status(400).json({ error: result.error });

      const products = await loadProducts();
      const product = { id: nextProductId(products), ...result.product };
      await addProduct(product);
      return res.status(201).json(product);
    }

    if (req.method === "PATCH") {
      const id = req.body?.id;
      if (!id) return res.status(400).json({ error: "Product id is required." });

      const updates = {};
      if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
      if (req.body.category !== undefined) {
        if (!PRODUCT_CATEGORIES.includes(req.body.category)) {
          return res.status(400).json({ error: "Invalid category." });
        }
        updates.category = req.body.category;
      }
      if (req.body.price !== undefined) {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price < 1) {
          return res.status(400).json({ error: "Valid price is required." });
        }
        updates.price = Math.round(price);
      }
      if (req.body.image !== undefined) updates.image = String(req.body.image).trim();
      if (req.body.imageAlt !== undefined) updates.imageAlt = String(req.body.imageAlt).trim();
      if (req.body.inStock !== undefined) updates.inStock = Boolean(req.body.inStock);

      const updated = await updateProduct(id, updates);
      if (!updated) return res.status(404).json({ error: "Product not found." });
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const id = req.body?.id;
      if (!id) return res.status(400).json({ error: "Product id is required." });

      const ok = await deleteProduct(id);
      if (!ok) return res.status(404).json({ error: "Product not found." });
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Products API error:", error);
    return res.status(500).json({ error: "Could not process request." });
  }
}
