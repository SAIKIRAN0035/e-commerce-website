import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  WHATSAPP,
  WHATSAPP_DISPLAY,
  WEIGHT_OPTIONS,
  calcPrice,
  cartKey,
  getSiteUrl,
} from "./config";
import { products as defaultProducts, categories as defaultCategories } from "./data/products";
import { deliveryInfo, paymentInfo, faqItems } from "./data/siteInfo";
import OwnerAdmin from "./components/OwnerAdmin";
import { buildWhatsAppOrderMessage, formatOrderDate, createLocalOrderId, buildOrderFromPayload } from "./lib/orderMessage";
import { openWhatsAppChat, isMobileDevice } from "./lib/whatsapp";
import { trackOrder } from "./lib/orderTrack";
import { ORDER_STATUS_LABELS, createOrder } from "./lib/orders";
import { fetchAllReviews, postReview } from "./lib/reviews";
import { fetchProducts } from "./lib/productsApi";

const stats = [
  { main: "100%", sub: "Homemade" },
  { main: "No", sub: "Preservatives" },
  { main: "Pan India", sub: "Delivery" },
  { main: "International", sub: "Shipping" },
];

const whyChooseUs = [
  { icon: "🌿", title: "Fresh Ingredients", desc: "Handpicked spices, oils, and produce sourced with care." },
  { icon: "🫕", title: "Traditional Recipes", desc: "Time-honoured family methods passed down through generations." },
  { icon: "❤️", title: "Homemade Quality", desc: "Small-batch preparation with the warmth of Amma's kitchen." },
  { icon: "🚚", title: "Fast Delivery", desc: "Reliable shipping across India and international destinations." },
];

function buildCatalogMessage(productList, categoryList) {
  const grouped = categoryList
    .filter((c) => c !== "All")
    .map((cat) => {
      const items = productList
        .filter((p) => p.category === cat)
        .map((p) => {
          const prices = WEIGHT_OPTIONS.map(
            (w) => `${w.label}: ₹${calcPrice(p.price, w.multiplier)}`
          ).join(" | ");
          return `• ${p.name}\n  ${prices}`;
        })
        .join("\n");
      return `*${cat}*\n${items}`;
    })
    .join("\n\n");

  return (
    `*Vaha Ruchulu — Product Catalog*\n` +
    `Homemade Pickles, Podis & Karams\n\n` +
    `${grouped}\n\n` +
    `📍 India\n📞 ${WHATSAPP_DISPLAY}\n\n` +
    `To order, send item name, size (250g/500g/1KG) & quantity.`
  );
}

function shareSite() {
  const url = getSiteUrl();
  const text = "Check out Vaha Ruchulu — authentic homemade pickles, podis & karams! Order on WhatsApp.";
  if (navigator.share) {
    navigator.share({ title: "Vaha Ruchulu", text, url }).catch(() => {});
  } else {
    openWhatsAppChat(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`);
  }
}

function Stars({ count }) {
  return (
    <span className="stars" aria-label={`${count} out of 5 stars`}>
      {"★".repeat(count)}
    </span>
  );
}

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

export default function App() {
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [orderPlacing, setOrderPlacing] = useState(false);
  const [weightPick, setWeightPick] = useState({});
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ name: "", location: "", text: "", rating: 5 });
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [spiceLevel, setSpiceLevel] = useState("Medium");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [trackForm, setTrackForm] = useState({ id: "", phone: "" });
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [products, setProducts] = useState(defaultProducts);
  const [categories, setCategories] = useState(defaultCategories);

  const getWeight = (productId) => weightPick[productId] || "500g";

  const loadInventory = async () => {
    const data = await fetchProducts();
    setProducts(data.products);
    setCategories(data.categories);
    return data;
  };

  const openWhatsAppCatalog = () => {
    openWhatsAppChat(
      `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(buildCatalogMessage(products, categories))}`
    );
  };

  const loadReviews = async () => {
    const data = await fetchAllReviews();
    setReviews(data);
    setReviewsLoading(false);
    return data;
  };

  useEffect(() => {
    loadReviews();
    loadInventory();
    const placedId = sessionStorage.getItem("vaha_order_placed");
    if (placedId) {
      sessionStorage.removeItem("vaha_order_placed");
      setConfirmedOrder({ id: placedId });
      setOrderSuccess(true);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.linePrice * item.qty, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  const getQty = (productId, weightKey) => {
    const key = cartKey(productId, weightKey);
    return cart.find((item) => item.key === key)?.qty ?? 0;
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const catMatch = activeCategory === "All" || p.category === activeCategory;
      const searchMatch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return catMatch && searchMatch;
    });
  }, [activeCategory, searchQuery, products]);

  const addToCart = (product) => {
    const weightKey = getWeight(product.id);
    const weight = WEIGHT_OPTIONS.find((w) => w.key === weightKey);
    const key = cartKey(product.id, weightKey);
    const linePrice = calcPrice(product.price, weight.multiplier);

    setCartOpen(true);
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          id: product.id,
          name: product.name,
          weightLabel: weight.label,
          linePrice,
          pricePerKg: product.price,
          qty: 1,
        },
      ];
    });
  };

  const updateQty = (key, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.key !== key));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, qty } : item))
    );
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      setOrderError("Please add items to your cart first.");
      return;
    }
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      setOrderError("Please fill in your name, phone, and delivery address.");
      return;
    }

    setOrderError("");

    const orderItems = cart.map((item) => ({
      id: item.id,
      name: item.name,
      weightLabel: item.weightLabel,
      qty: item.qty,
      linePrice: item.linePrice,
      subtotal: item.linePrice * item.qty,
    }));

    const orderId = createLocalOrderId();
    const payload = {
      orderId,
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email.trim(),
        address: customer.address.trim(),
      },
      items: orderItems,
      total,
    };

    const waUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
      buildWhatsAppOrderMessage(buildOrderFromPayload(payload), spiceLevel)
    )}`;

    // Phones block window.open after async — open WhatsApp in the same tap, then save the order.
    openWhatsAppChat(waUrl);

    if (isMobileDevice()) {
      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
      sessionStorage.setItem("vaha_order_placed", orderId);
      setCart([]);
      setCustomer({ name: "", phone: "", email: "", address: "" });
      setCartOpen(false);
      return;
    }

    setOrderPlacing(true);
    try {
      const order = await createOrder(payload);
      setConfirmedOrder(order);
      setOrderSuccess(true);
      setCart([]);
      setCustomer({ name: "", phone: "", email: "", address: "" });
      setCartOpen(false);
    } catch {
      setOrderError("Order saved to WhatsApp. If the shop did not open, tap Place Order again.");
    } finally {
      setOrderPlacing(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewError("");
    setReviewSuccess("");

    if (!reviewForm.name.trim() || !reviewForm.location.trim() || !reviewForm.text.trim()) {
      setReviewError("Please fill in your name, location, and review.");
      return;
    }
    if (reviewForm.text.trim().length < 10) {
      setReviewError("Please write at least 10 characters in your review.");
      return;
    }

    const payload = {
      name: reviewForm.name.trim(),
      location: reviewForm.location.trim(),
      text: reviewForm.text.trim(),
      rating: reviewForm.rating,
    };

    try {
      const saved = await postReview(payload);
      setReviews((prev) => {
        const withoutDup = prev.filter((r) => r.id !== saved.id);
        return [saved, ...withoutDup];
      });
      setReviewForm({ name: "", location: "", text: "", rating: 5 });
      setReviewSuccess("Thank you! Your review is live for everyone to see.");
    } catch (err) {
      setReviewError(err.message || "Could not save review. Please try again.");
    }
  };

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    setTrackError("");
    setTrackResult(null);
    setTrackLoading(true);
    try {
      const result = await trackOrder(trackForm.id, trackForm.phone);
      setTrackResult(result);
    } catch (err) {
      setTrackError(err.message);
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="header">
        <a href="#" className="brand">
          <img src="/logo.jpeg" alt="" className="brand-logo" />
          <span className="brand-name">Vaha Ruchulu</span>
        </a>
        <nav className="nav">
          <a href="#catalog">Menu</a>
          <a href="#track">Track Order</a>
          <a href="#delivery">Delivery</a>
          <a href="#faq">FAQ</a>
          <a href="#testimonials">Reviews</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="header-actions">
          <button type="button" className="btn-share-header" onClick={shareSite} title="Share website">
            Share
          </button>
          <button type="button" className="cart-btn" onClick={() => setCartOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content reveal">
            <p className="eyebrow">Vaha Ruchulu</p>
            <h1>Authentic Homemade Pickles, Podis &amp; Karams</h1>
            <p className="hero-sub">Homemade with Love from Home</p>
            <p className="hero-desc">
              Traditional homestyle flavours crafted in small batches — fresh ingredients,
              zero preservatives, and the taste of home in every jar.
            </p>
            <div className="hero-actions">
              <a href="#catalog" className="btn btn-primary">Order Now</a>
              <a href="#catalog" className="btn btn-catalog">View Catalog</a>
              <button type="button" className="btn btn-outline" onClick={shareSite}>Share</button>
              <a href={`https://wa.me/${WHATSAPP}`} className="btn btn-whatsapp" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
          </div>
          <div className="hero-visual reveal delay-1">
            <div className="logo-card">
              <img src="/logo.jpeg" alt="Vaha Ruchulu — Homemade Pickles & Podis" />
            </div>
          </div>
        </div>
      </section>

      <section className="stats reveal">
        <div className="stats-inner">
          {stats.map((s) => (
            <div className="stat" key={s.sub}>
              <strong>{s.main}</strong>
              <span>{s.sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="catalog" className="section products-section">
        <div className="wa-catalog-header reveal">
          <div className="wa-catalog-top">
            <img src="/logo.jpeg" alt="" className="wa-catalog-avatar" />
            <div>
              <strong>Vaha Ruchulu</strong>
              <span>Business catalog · {products.length} items</span>
            </div>
          </div>
          <p className="wa-catalog-desc">Choose 250g, 500g or 1 KG · Min order 250g per item</p>
        </div>

        <div className="section-head reveal">
          <p className="eyebrow">Our Menu</p>
          <h2>Handcrafted Favourites</h2>
          <p>Veg pickles from ₹125 (250g) · Podis from ₹150 (250g) · Non-veg from ₹300 (250g)</p>
        </div>

        <div className="catalog-banner reveal delay-1">
          <div className="catalog-banner-text">
            <strong>📱 Order via WhatsApp</strong>
            <p>Send our full menu with all sizes to WhatsApp.</p>
          </div>
          <button type="button" className="btn btn-whatsapp" onClick={openWhatsAppCatalog}>
            Send Catalog on WhatsApp
          </button>
        </div>

        <div className="filters reveal delay-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="catalog-search reveal delay-1">
          <input
            type="search"
            placeholder="Search pickles, podis, pachadi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredProducts.length === 0 && (
          <p className="catalog-empty">No products match your search.</p>
        )}

        <div className="product-grid">
          {filteredProducts.map((product, i) => {
            const wKey = getWeight(product.id);
            const qty = getQty(product.id, wKey);
            return (
              <article className={`product-card reveal delay-${(i % 4) + 1}`} key={product.id}>
                <div className="product-image">
                  <img src={product.image} alt={product.imageAlt} loading="lazy" />
                  <span className="product-cat">{product.category}</span>
                </div>
                <div className="product-body">
                  <h3>{product.name}</h3>
                  <div className="weight-options">
                    {WEIGHT_OPTIONS.map((w) => (
                      <button
                        key={w.key}
                        type="button"
                        className={`weight-pill${wKey === w.key ? " active" : ""}`}
                        onClick={() => setWeightPick({ ...weightPick, [product.id]: w.key })}
                      >
                        {w.label}
                        <span>₹{calcPrice(product.price, w.multiplier)}</span>
                      </button>
                    ))}
                  </div>
                  {qty > 0 ? (
                    <div className="qty-control">
                      <button type="button" onClick={() => updateQty(cartKey(product.id, wKey), qty - 1)}>−</button>
                      <span>{qty} in cart</span>
                      <button type="button" onClick={() => addToCart(product)}>+</button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-cart" onClick={() => addToCart(product)}>
                      Add to Cart
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="track" className="section track-section">
        <div className="section-head reveal">
          <p className="eyebrow">Order Status</p>
          <h2>Track Your Order</h2>
          <p>Enter your Order ID and phone number from your confirmation.</p>
        </div>
        <form className="track-form reveal" onSubmit={handleTrackOrder}>
          <input
            placeholder="Order ID (e.g. VR-260612-ABCD)"
            value={trackForm.id}
            onChange={(e) => setTrackForm({ ...trackForm, id: e.target.value })}
          />
          <input
            placeholder="Phone number used when ordering"
            value={trackForm.phone}
            onChange={(e) => setTrackForm({ ...trackForm, phone: e.target.value })}
          />
          {trackError && <p className="review-error">{trackError}</p>}
          <button type="submit" className="btn btn-primary" disabled={trackLoading}>
            {trackLoading ? "Looking up..." : "Track Order"}
          </button>
        </form>
        {trackResult && (
          <div className="track-result reveal">
            <p className="order-id-badge">Order ID: <strong>{trackResult.id}</strong></p>
            <p className={`track-status order-status-${trackResult.status}`}>
              {trackResult.statusLabel}
            </p>
            <ul className="order-summary-list">
              {trackResult.items.map((item, i) => (
                <li key={i}>
                  {item.name} ({item.weightLabel}) × {item.qty} — ₹{item.subtotal.toLocaleString("en-IN")}
                </li>
              ))}
            </ul>
            <p className="order-summary-total">
              Total: <strong>₹{trackResult.total.toLocaleString("en-IN")}</strong>
            </p>
            <p className="order-date-note">Placed on {formatOrderDate(trackResult.createdAt)}</p>
          </div>
        )}
      </section>

      <section id="delivery" className="section info-section">
        <div className="section-head reveal">
          <p className="eyebrow">Delivery &amp; Shipping</p>
          <h2>How We Deliver</h2>
        </div>
        <div className="info-grid">
          {deliveryInfo.map((item, i) => (
            <div className={`info-card reveal delay-${i + 1}`} key={item.title}>
              <span className="info-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="payment" className="section info-section payment-section">
        <div className="section-head reveal">
          <p className="eyebrow">Payment</p>
          <h2>How to Pay</h2>
        </div>
        <div className="info-grid">
          {paymentInfo.map((item, i) => (
            <div className={`info-card reveal delay-${i + 1}`} key={item.title}>
              <span className="info-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="why" className="section why-section">
        <div className="section-head reveal">
          <p className="eyebrow">Why Choose Us</p>
          <h2>The Vaha Ruchulu Promise</h2>
        </div>
        <div className="why-grid">
          {whyChooseUs.map((item, i) => (
            <div className={`why-card reveal delay-${i + 1}`} key={item.title}>
              <span className="why-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="section faq-section">
        <div className="section-head reveal">
          <p className="eyebrow">FAQ</p>
          <h2>Shelf Life &amp; Storage</h2>
          <p>Common questions about our homemade products</p>
        </div>
        <div className="faq-list">
          {faqItems.map((item, i) => (
            <div className={`faq-item reveal delay-${(i % 3) + 1}`} key={item.q}>
              <button
                type="button"
                className={`faq-question${openFaq === i ? " open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                {item.q}
                <span>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className="faq-answer">{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section id="testimonials" className="section testimonials-section">
        <div className="section-head reveal">
          <p className="eyebrow">Customer Love</p>
          <h2>What Our Customers Say</h2>
          <p>Ordered from us? Share your experience below.</p>
        </div>

        <form className="review-form reveal" onSubmit={submitReview}>
          <h3>Write a Review</h3>
          <div className="review-form-row">
            <input
              placeholder="Your Name"
              value={reviewForm.name}
              onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
            />
            <input
              placeholder="City / Location"
              value={reviewForm.location}
              onChange={(e) => setReviewForm({ ...reviewForm, location: e.target.value })}
            />
          </div>
          <label className="review-rating-label">
            Your Rating
            <StarPicker
              rating={reviewForm.rating}
              onChange={(rating) => setReviewForm({ ...reviewForm, rating })}
            />
          </label>
          <textarea
            placeholder="Tell us about your experience..."
            value={reviewForm.text}
            onChange={(e) => setReviewForm({ ...reviewForm, text: e.target.value })}
            rows={4}
          />
          {reviewError && <p className="review-error">{reviewError}</p>}
          {reviewSuccess && <p className="review-success">{reviewSuccess}</p>}
          <button type="submit" className="btn btn-primary">Submit Review</button>
        </form>

        {reviewsLoading ? (
          <p className="reviews-loading">Loading reviews...</p>
        ) : (
          <div className="testimonials-grid">
            {reviews.map((t, i) => (
              <blockquote className={`testimonial reveal delay-${(i % 4) + 1}`} key={t.id}>
                <div className="testimonial-top">
                  <Stars count={t.rating} />
                  {t.isNew && <span className="review-new-badge">New</span>}
                </div>
                <p>&ldquo;{t.text}&rdquo;</p>
                {t.ownerReply && (
                  <div className="owner-reply">
                    <strong>Response from Vaha Ruchulu</strong>
                    <p>{t.ownerReply}</p>
                  </div>
                )}
                <footer>
                  <strong>{t.name}</strong>
                  <span>
                    {t.location}
                    {t.date && ` · ${t.date}`}
                  </span>
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </section>

      <section id="contact" className="section contact-section">
        <div className="contact-inner reveal">
          <div className="contact-info">
            <p className="eyebrow light">Get in Touch</p>
            <h2>Contact Vaha Ruchulu</h2>
            <p className="contact-lead">Ready to order or have questions? We&apos;d love to hear from you.</p>
            <ul className="contact-list">
              <li><strong>Founder</strong> Haritha Koppula</li>
              <li>
                <strong>Phone</strong>{" "}
                <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">{WHATSAPP_DISPLAY}</a>
              </li>
              <li>
                <strong>Email</strong>{" "}
                <a href="mailto:vaharuchulu.pickles@gmail.com">vaharuchulu.pickles@gmail.com</a>
              </li>
              <li><strong>Location</strong> India</li>
              <li>
                <strong>Instagram</strong>{" "}
                <a href="https://instagram.com/vaha_ruchulu" target="_blank" rel="noreferrer">@vaha_ruchulu</a>
              </li>
            </ul>
            <div className="contact-actions">
              <a href="#catalog" className="btn btn-catalog">View Catalog</a>
              <button type="button" className="btn btn-whatsapp" onClick={openWhatsAppCatalog}>
                Send Catalog on WhatsApp
              </button>
              <button type="button" className="btn btn-outline-light" onClick={shareSite}>
                Share Website
              </button>
            </div>
          </div>
          <div className="contact-card">
            <img src="/logo.jpeg" alt="Vaha Ruchulu" />
            <p>మన ఇంటి రుచి ❤️</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Vaha Ruchulu. All rights reserved.</p>
        <p>Homemade with love from home</p>
        <a href="#catalog" className="footer-catalog">View our catalog →</a>
        <button type="button" className="footer-owner-link" onClick={() => setAdminOpen(true)}>
          Owner
        </button>
      </footer>

      <button
        type="button"
        className={`scroll-top${showScrollTop ? " visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
      >
        ↑
      </button>

      <OwnerAdmin
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        reviews={reviews}
        onReviewsChange={loadReviews}
        onInventoryChange={loadInventory}
      />

      <button type="button" className="catalog-fab" onClick={openWhatsAppCatalog} title="Send Catalog on WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.845L0 24l6.335-1.662A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.78 9.78 0 0 1-4.988-1.364l-.357-.213-3.76.987 1.004-3.67-.233-.375A9.78 9.78 0 0 1 2.18 12C2.18 6.57 6.57 2.18 12 2.18S21.82 6.57 21.82 12 17.43 21.82 12 21.82z" />
        </svg>
        <span>Catalog</span>
      </button>

      <div className={`cart-overlay${cartOpen ? " open" : ""}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-drawer${cartOpen ? " open" : ""}`}>
        <div className="cart-header">
          <h3>Your Cart {cartCount > 0 && `(${cartCount})`}</h3>
          <button type="button" className="cart-close" onClick={() => setCartOpen(false)}>×</button>
        </div>
        {cart.length === 0 ? (
          <p className="cart-empty">Your cart is empty. Add something delicious!</p>
        ) : (
          <div className="cart-body">
            {cart.map((item) => (
              <div className="cart-row" key={item.key}>
                <div className="cart-row-info">
                  <strong>{item.name}</strong>
                  <span>{item.weightLabel} · ₹{item.linePrice.toLocaleString("en-IN")} each</span>
                </div>
                <div className="qty-control qty-control-sm">
                  <button type="button" onClick={() => updateQty(item.key, item.qty - 1)}>−</button>
                  <span>{item.qty}</span>
                  <button type="button" onClick={() => updateQty(item.key, item.qty + 1)}>+</button>
                </div>
                <strong className="cart-row-total">₹{item.linePrice * item.qty}</strong>
              </div>
            ))}
            <div className="cart-total-row">
              <span>Total</span>
              <strong>₹{total.toLocaleString("en-IN")}</strong>
            </div>
            <input placeholder="Your Name *" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
            <input placeholder="Phone Number *" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            <input
              type="email"
              placeholder="Email (for order confirmation)"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
            <textarea placeholder="Delivery Address *" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
            <label className="cart-spice-label">
              Spice preference
              <select value={spiceLevel} onChange={(e) => setSpiceLevel(e.target.value)}>
                <option value="Mild">Mild</option>
                <option value="Medium">Medium</option>
                <option value="Hot">Hot</option>
                <option value="Extra Hot">Extra Hot</option>
              </select>
            </label>
            <p className="cart-note">You will get an order summary here and on WhatsApp. Add email to receive confirmation.</p>
            {orderError && <p className="order-error">{orderError}</p>}
            <button type="button" className="btn btn-primary btn-full" onClick={placeOrder} disabled={orderPlacing}>
              {orderPlacing ? "Placing order..." : "Place Order"}
            </button>
          </div>
        )}
      </aside>

      {orderSuccess && confirmedOrder && (
        <div className="modal-overlay" onClick={() => { setOrderSuccess(false); setConfirmedOrder(null); }}>
          <div className="modal-card modal-card-order" onClick={(e) => e.stopPropagation()}>
            <span className="modal-icon">✅</span>
            <h3>Order Placed Successfully!</h3>
            <p className="order-id-badge">Order ID: <strong>{confirmedOrder.id}</strong></p>
            <p className="order-status-line">
              Status: {ORDER_STATUS_LABELS[confirmedOrder.status]}
            </p>
            <div className="order-summary-box">
              <h4>Your order</h4>
              <ul className="order-summary-list">
                {confirmedOrder.items.map((item, i) => (
                  <li key={i}>
                    {item.name} ({item.weightLabel}) × {item.qty} — ₹{item.subtotal.toLocaleString("en-IN")}
                  </li>
                ))}
              </ul>
              <p className="order-summary-total">
                Total: <strong>₹{confirmedOrder.total.toLocaleString("en-IN")}</strong>
              </p>
              <p className="order-summary-customer">
                {confirmedOrder.customer.name} · {confirmedOrder.customer.phone}
                <br />
                {confirmedOrder.customer.address}
              </p>
            </div>
            <p>WhatsApp has opened with your order details. Please tap <strong>Send</strong> to notify Vaha Ruchulu.</p>
            <p className="modal-note">
              {confirmedOrder.notifications?.email?.sent && confirmedOrder.customer.email
                ? "Confirmation emails have been sent to you and the owner. Payment details will also be shared on WhatsApp."
                : confirmedOrder.customer.email
                  ? "Your order is saved. Payment details (UPI/GPay/PhonePe) will be shared on WhatsApp."
                  : "Payment details (UPI/GPay/PhonePe) will be shared on WhatsApp. Add your email next time for email confirmation."}
            </p>
            <p className="order-date-note">Placed on {formatOrderDate(confirmedOrder.createdAt)}</p>
            <button
              type="button"
              className="btn btn-primary btn-full"
              onClick={() => { setOrderSuccess(false); setConfirmedOrder(null); }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
