import { head, put } from "@vercel/blob";
import { adminNotConfigured, isAdminRequest } from "../server/lib/auth.js";

const BLOB_NAME = "vaha-ruchulu-reviews.json";

const DEFAULT_REVIEWS = [
  {
    id: "default-1",
    name: "Priya Sharma",
    location: "Hyderabad",
    text: "The mango pickle tastes exactly like my grandmother used to make. Authentic, spicy, and absolutely delicious!",
    rating: 5,
    date: "Jan 2026",
  },
  {
    id: "default-2",
    name: "Rajesh Kumar",
    location: "Bangalore",
    text: "Ordered chicken pickle for the first time — rich flavour, perfect texture. Will definitely order again.",
    rating: 5,
    date: "Feb 2026",
  },
  {
    id: "default-3",
    name: "Anitha Reddy",
    location: "USA",
    text: "International delivery was smooth. The podis arrived fresh and packed beautifully. Highly recommend Vaha Ruchulu!",
    rating: 5,
    date: "Mar 2026",
  },
];

function formatDate() {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function loadReviews() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return DEFAULT_REVIEWS;
  }

  try {
    const meta = await head(BLOB_NAME);
    const res = await fetch(meta.url);
    if (!res.ok) return DEFAULT_REVIEWS;
    const data = await res.json();
    return Array.isArray(data) && data.length ? data : DEFAULT_REVIEWS;
  } catch {
    return DEFAULT_REVIEWS;
  }
}

async function saveReviews(reviews) {
  await put(BLOB_NAME, JSON.stringify(reviews), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

function validateReview(body) {
  const name = String(body?.name || "").trim();
  const location = String(body?.location || "").trim();
  const text = String(body?.text || "").trim();
  const rating = Number(body?.rating);

  if (!name || !location || !text) {
    return { error: "Name, location, and review are required." };
  }
  if (text.length < 10) {
    return { error: "Review must be at least 10 characters." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  return {
    review: {
      id: `rev-${Date.now()}`,
      name,
      location,
      text,
      rating,
      date: formatDate(),
      created_at: new Date().toISOString(),
    },
  };
}

function validateAdminUpdate(body) {
  const id = String(body?.id || "").trim();
  if (!id) return { error: "Review id is required." };

  const updates = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return { error: "Name cannot be empty." };
    updates.name = name;
  }

  if (body.location !== undefined) {
    const location = String(body.location).trim();
    if (!location) return { error: "Location cannot be empty." };
    updates.location = location;
  }

  if (body.text !== undefined) {
    const text = String(body.text).trim();
    if (text.length < 10) return { error: "Review must be at least 10 characters." };
    updates.text = text;
  }

  if (body.rating !== undefined) {
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: "Rating must be between 1 and 5." };
    }
    updates.rating = rating;
  }

  if (body.ownerReply !== undefined) {
    updates.ownerReply = String(body.ownerReply).trim();
    updates.ownerReplyAt = updates.ownerReply
      ? new Date().toISOString()
      : null;
  }

  if (!Object.keys(updates).length) {
    return { error: "No valid fields to update." };
  }

  return { id, updates };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const reviews = await loadReviews();
    return res.status(200).json(reviews);
  }

  if (req.method === "POST") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({
        error: "Review storage is not configured. Add Vercel Blob storage to this project.",
      });
    }

    const result = validateReview(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const reviews = await loadReviews();
    reviews.unshift(result.review);
    await saveReviews(reviews);
    return res.status(201).json(result.review);
  }

  if (req.method === "PATCH" || req.method === "DELETE") {
    if (!process.env.REVIEWS_ADMIN_PASSWORD) {
      return adminNotConfigured(res);
    }
    if (!(await isAdminRequest(req))) {
      return res.status(401).json({ error: "Owner access required." });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({
        error: "Review storage is not configured. Add Vercel Blob storage to this project.",
      });
    }

    const reviews = await loadReviews();

    if (req.method === "DELETE") {
      const id = String(req.body?.id || "").trim();
      if (!id) return res.status(400).json({ error: "Review id is required." });

      const next = reviews.filter((r) => r.id !== id);
      if (next.length === reviews.length) {
        return res.status(404).json({ error: "Review not found." });
      }

      await saveReviews(next);
      return res.status(200).json({ ok: true, id });
    }

    const result = validateAdminUpdate(req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const index = reviews.findIndex((r) => r.id === result.id);
    if (index === -1) {
      return res.status(404).json({ error: "Review not found." });
    }

    const updated = { ...reviews[index], ...result.updates };
    if (result.updates.text || result.updates.rating) {
      updated.updated_at = new Date().toISOString();
    }

    reviews[index] = updated;
    await saveReviews(reviews);
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
