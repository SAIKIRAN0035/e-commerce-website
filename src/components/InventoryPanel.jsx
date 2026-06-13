import { useEffect, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  createProduct,
  deleteProductAdmin,
  fetchProductsAdmin,
  updateProductAdmin,
  uploadProductImage,
} from "../lib/productsApi";

const emptyForm = {
  name: "",
  category: PRODUCT_CATEGORIES[0],
  price: 499,
  image: "",
  imageAlt: "",
  inStock: true,
};

export default function InventoryPanel({ onInventoryChange }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchProductsAdmin();
      setProducts(data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setIsNew(true);
    setEditingId(null);
    setForm(emptyForm);
    setImagePreview("");
    setError("");
  };

  const startEdit = (product) => {
    setIsNew(false);
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price,
      image: product.image,
      imageAlt: product.imageAlt || product.name,
      inStock: product.inStock !== false,
    });
    setImagePreview(product.image);
    setError("");
  };

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading(true);
    setError("");
    try {
      const url = await uploadProductImage(file);
      setForm((f) => ({ ...f, image: url }));
      setImagePreview(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    try {
      if (isNew) {
        await createProduct(form);
      } else {
        await updateProductAdmin(editingId, form);
      }
      await load();
      await onInventoryChange?.();
      setEditingId(null);
      setIsNew(false);
      setForm(emptyForm);
      setImagePreview("");
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStock = async (product) => {
    const nextInStock = product.inStock === false;
    setActionLoading(true);
    setError("");
    try {
      await updateProductAdmin(product.id, { inStock: nextInStock });
      await load();
      await onInventoryChange?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this product from the menu?")) return;
    setActionLoading(true);
    setError("");
    try {
      await deleteProductAdmin(id);
      await load();
      await onInventoryChange?.();
      if (editingId === id) {
        setEditingId(null);
        setIsNew(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="admin-empty">Loading inventory...</p>;

  return (
    <>
      <div className="admin-orders-toolbar">
        <p>Add, edit, or hide menu items. Mark out-of-stock items to remove them from the shop until you’re making them again.</p>
        <button type="button" className="btn btn-primary" onClick={startNew}>
          + Add item
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {(isNew || editingId) && (
        <form className="inventory-form" onSubmit={handleSave}>
          <h3>{isNew ? "Add new product" : "Edit product"}</h3>

          <label className="inventory-label">
            Product name (Telugu + English)
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ఆవకాయ (Avakaya Pickle)"
              required
            />
          </label>

          <div className="admin-edit-row">
            <label className="inventory-label">
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="inventory-label">
              Price per 1 KG (₹)
              <input
                type="number"
                min={1}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                required
              />
            </label>
          </div>

          <label className="inventory-label">
            Image description (for accessibility)
            <input
              value={form.imageAlt}
              onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
              placeholder="Homemade mango pickle"
            />
          </label>

          <label className="inventory-label">
            Product photo
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} />
          </label>

          {imagePreview && (
            <div className="inventory-preview">
              <img src={imagePreview} alt="Preview" />
            </div>
          )}

          <label className="inventory-stock-toggle">
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
            />
            Available on website (in stock)
          </label>

          <div className="admin-edit-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setIsNew(false); setEditingId(null); }}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading || !form.image}>
              {actionLoading ? "Saving..." : "Save product"}
            </button>
          </div>
        </form>
      )}

      <div className="inventory-list">
        {products.map((product) => {
          const inStock = product.inStock !== false;
          return (
          <article
            className={`inventory-card${inStock ? "" : " out-of-stock"}`}
            key={product.id}
          >
            <img src={product.image} alt="" className="inventory-thumb" />
            <div className="inventory-card-body">
              <strong>{product.name}</strong>
              <span>
                {product.category} · ₹{product.price}/KG
                {!inStock && <em className="inventory-stock-badge"> · Out of stock</em>}
              </span>
            </div>
            <div className="admin-review-actions">
              <button
                type="button"
                className={`btn ${inStock ? "btn-outline" : "btn-primary"}`}
                onClick={() => handleToggleStock(product)}
                disabled={actionLoading}
              >
                {inStock ? "Mark out of stock" : "Mark in stock"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => startEdit(product)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDelete(product.id)}
                disabled={actionLoading}
              >
                Remove
              </button>
            </div>
          </article>
          );
        })}
      </div>
    </>
  );
}
