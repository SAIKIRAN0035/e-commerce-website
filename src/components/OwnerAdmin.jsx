import { useEffect, useState } from "react";
import {
  isAdminLoggedIn,
  loginAdmin,
  logoutAdmin,
  requestPasswordReset,
  resetAdminPassword,
} from "../lib/adminAuth";
import { formatOrderDate } from "../lib/orderMessage";
import {
  ORDER_STATUS_LABELS,
  fetchOrdersAdmin,
  updateOrderStatus,
} from "../lib/orders";
import InventoryPanel from "./InventoryPanel";
import { adminDeleteReview, adminUpdateReview } from "../lib/reviews";

function StarPicker({ rating, onChange }) {
  return (
    <div className="star-picker" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-picker-btn${n <= rating ? " active" : ""}`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await fetchOrdersAdmin();
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatus = async (id, status) => {
    setActionLoading(true);
    setError("");
    const previous = orders;
    setOrders((list) =>
      list.map((order) => (order.id === id ? { ...order, status } : order))
    );
    try {
      const updated = await updateOrderStatus(id, status);
      setOrders((list) => list.map((order) => (order.id === id ? updated : order)));
    } catch (err) {
      setOrders(previous);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="admin-empty">Loading orders...</p>;

  return (
    <>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-orders-toolbar">
        <p>New website orders appear here. Confirm payment when received.</p>
        <button type="button" className="btn btn-outline" onClick={() => loadOrders()}>
          Refresh
        </button>
      </div>
      {orders.length === 0 ? (
        <p className="admin-empty">No orders yet.</p>
      ) : (
        <div className="admin-order-list">
          {orders.map((order) => (
            <article className="admin-order-card" key={order.id}>
              <div className="admin-order-top">
                <div>
                  <strong>{order.id}</strong>
                  <span className={`order-status order-status-${order.status}`}>
                    {ORDER_STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <span className="admin-order-total">₹{order.total.toLocaleString("en-IN")}</span>
              </div>
              <p className="admin-order-meta">
                {order.customer.name} · {order.customer.phone} · {formatOrderDate(order.createdAt)}
              </p>
              <button
                type="button"
                className="admin-order-toggle"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                {expandedId === order.id ? "Hide details" : "View details"}
              </button>
              {expandedId === order.id && (
                <div className="admin-order-details">
                  <ul>
                    {order.items.map((item, i) => (
                      <li key={i}>
                        {item.name} ({item.weightLabel}) × {item.qty} — ₹
                        {item.subtotal.toLocaleString("en-IN")}
                      </li>
                    ))}
                  </ul>
                  <p>
                    <strong>Address:</strong> {order.customer.address}
                  </p>
                  {order.customer.email && (
                    <p>
                      <strong>Email:</strong> {order.customer.email}
                    </p>
                  )}
                </div>
              )}
              <div className="admin-order-actions">
                {order.status === "pending_payment" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={actionLoading}
                    onClick={() => handleStatus(order.id, "payment_confirmed")}
                  >
                    Confirm Payment
                  </button>
                )}
                {order.status === "payment_confirmed" && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={actionLoading}
                    onClick={() => handleStatus(order.id, "preparing")}
                  >
                    Mark Preparing
                  </button>
                )}
                {order.status === "preparing" && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={actionLoading}
                    onClick={() => handleStatus(order.id, "shipped")}
                  >
                    Mark Shipped
                  </button>
                )}
                {order.status === "shipped" && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={actionLoading}
                    onClick={() => handleStatus(order.id, "delivered")}
                  >
                    Mark Delivered
                  </button>
                )}
                {order.status !== "cancelled" && order.status !== "delivered" && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={actionLoading}
                    onClick={() => handleStatus(order.id, "cancelled")}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function ReviewsPanel({ reviews, onReviewsChange }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    location: "",
    text: "",
    rating: 5,
    ownerReply: "",
  });
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const startEdit = (review) => {
    setEditingId(review.id);
    setForm({
      name: review.name,
      location: review.location,
      text: review.text,
      rating: review.rating,
      ownerReply: review.ownerReply || "",
    });
    setActionError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setActionError("");
    setActionLoading(true);
    try {
      await adminUpdateReview(editingId, form);
      await onReviewsChange();
      setEditingId(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this review permanently?")) return;
    setActionError("");
    setActionLoading(true);
    try {
      await adminDeleteReview(id);
      await onReviewsChange();
      if (editingId === id) setEditingId(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {actionError && <p className="admin-error">{actionError}</p>}
      {editingId ? (
        <form className="admin-edit-form" onSubmit={handleSave}>
          <h3>Edit review</h3>
          <div className="admin-edit-row">
            <input
              placeholder="Customer name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <label className="review-rating-label">
            Rating
            <StarPicker rating={form.rating} onChange={(rating) => setForm({ ...form, rating })} />
          </label>
          <textarea
            placeholder="Customer review"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            rows={4}
          />
          <label className="admin-reply-label">
            Your reply (shown publicly under the review)
            <textarea
              placeholder="Thank you for your kind words..."
              value={form.ownerReply}
              onChange={(e) => setForm({ ...form, ownerReply: e.target.value })}
              rows={3}
            />
          </label>
          <div className="admin-edit-actions">
            <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-review-list">
          {reviews.length === 0 ? (
            <p className="admin-empty">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <article className="admin-review-card" key={review.id}>
                <div className="admin-review-top">
                  <strong>{review.name}</strong>
                  <span>{"★".repeat(review.rating)}</span>
                </div>
                <p className="admin-review-text">&ldquo;{review.text}&rdquo;</p>
                <p className="admin-review-meta">
                  {review.location}
                  {review.date && ` · ${review.date}`}
                </p>
                {review.ownerReply && (
                  <p className="admin-review-reply">
                    <strong>Your reply:</strong> {review.ownerReply}
                  </p>
                )}
                <div className="admin-review-actions">
                  <button type="button" className="btn btn-outline" onClick={() => startEdit(review)}>
                    {review.ownerReply ? "Edit / Reply" : "Reply"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(review.id)}
                    disabled={actionLoading}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </>
  );
}

export default function OwnerAdmin({ open, onClose, reviews, onReviewsChange, onInventoryChange }) {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState("orders");
  const [authView, setAuthView] = useState("login");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoggedIn(isAdminLoggedIn());
      setAuthView("login");
      setResetMessage("");
    }
  }, [open]);

  if (!open) return null;

  const handleForgotPassword = async () => {
    setResetMessage("");
    setResetLoading(true);
    try {
      const data = await requestPasswordReset();
      setResetMessage(data.message || "Reset code sent to your email.");
      setAuthView("reset");
    } catch (err) {
      setResetMessage(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage("");
    setResetLoading(true);
    try {
      const data = await resetAdminPassword(resetCode, newPassword);
      setResetMessage(data.message || "Password updated.");
      setAuthView("login");
      setResetCode("");
      setNewPassword("");
      setPassword("");
    } catch (err) {
      setResetMessage(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await loginAdmin(password);
      setLoggedIn(true);
      setPassword("");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logoutAdmin();
    setLoggedIn(false);
    setPassword("");
  };

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel admin-panel-wide" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <div>
            <p className="admin-eyebrow">Owner only</p>
            <h2>Owner Dashboard</h2>
          </div>
          <button type="button" className="admin-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!loggedIn ? (
          authView === "reset" ? (
            <form className="admin-login" onSubmit={handleResetPassword}>
              <p>Enter the 6-digit code from your email and choose a new password.</p>
              <input
                placeholder="6-digit code"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              {resetMessage && (
                <p className={resetMessage.includes("updated") ? "admin-success" : "admin-error"}>
                  {resetMessage}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-full" disabled={resetLoading}>
                {resetLoading ? "Saving..." : "Set new password"}
              </button>
              <button
                type="button"
                className="admin-forgot-link"
                onClick={() => { setAuthView("login"); setResetMessage(""); }}
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form className="admin-login" onSubmit={handleLogin}>
              <p>Sign in to manage orders, payments, and customer reviews.</p>
              <input
                type="password"
                placeholder="Owner password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              {loginError && <p className="admin-error">{loginError}</p>}
              {resetMessage && !loginError && (
                <p className="admin-success">{resetMessage}</p>
              )}
              <button type="submit" className="btn btn-primary btn-full" disabled={loginLoading}>
                {loginLoading ? "Signing in..." : "Sign in"}
              </button>
              <button
                type="button"
                className="admin-forgot-link"
                onClick={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading ? "Sending code..." : "Forgot password?"}
              </button>
            </form>
          )
        ) : (
          <>
            <div className="admin-toolbar">
              <div className="admin-tabs">
                <button
                  type="button"
                  className={`admin-tab${tab === "orders" ? " active" : ""}`}
                  onClick={() => setTab("orders")}
                >
                  Orders
                </button>
                <button
                  type="button"
                  className={`admin-tab${tab === "reviews" ? " active" : ""}`}
                  onClick={() => setTab("reviews")}
                >
                  Reviews
                </button>
                <button
                  type="button"
                  className={`admin-tab${tab === "inventory" ? " active" : ""}`}
                  onClick={() => setTab("inventory")}
                >
                  Inventory
                </button>
              </div>
              <button type="button" className="btn btn-outline" onClick={handleLogout}>
                Sign out
              </button>
            </div>
            {tab === "orders" && <OrdersPanel />}
            {tab === "reviews" && (
              <ReviewsPanel reviews={reviews} onReviewsChange={onReviewsChange} />
            )}
            {tab === "inventory" && (
              <InventoryPanel onInventoryChange={onInventoryChange} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
