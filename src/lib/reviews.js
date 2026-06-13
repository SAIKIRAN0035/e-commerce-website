import { getAdminToken } from "./adminAuth";
import { supabase, isSupabaseConfigured } from "./supabase";

const LOCAL_REVIEWS_KEY = "vaha-ruchulu-reviews";

function mapRow(row) {
  const createdAt = row.created_at || row.createdAt || "";
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    text: row.text,
    rating: row.rating,
    ownerReply: row.ownerReply || "",
    ownerReplyAt: row.ownerReplyAt || "",
    createdAt,
    date: createdAt
      ? new Date(createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : row.date || "",
    isNew: row.isNew ?? false,
  };
}

export const REVIEW_SORT_OPTIONS = [
  { key: "relevance", label: "Relevance" },
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
];

export const REVIEW_RATING_FILTERS = [
  { key: "all", label: "All ratings" },
  { key: "5", label: "5 stars" },
  { key: "4", label: "4 stars & up" },
  { key: "3", label: "3 stars & up" },
];

export function reviewTimestamp(review) {
  if (review?.createdAt) {
    const parsed = Date.parse(review.createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (review?.id?.startsWith("rev-")) {
    const parsed = Number(review.id.slice(4));
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (review?.date) {
    const parsed = Date.parse(review.date);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return 0;
}

export function filterReviewsByRating(reviews, ratingFilter) {
  if (!ratingFilter || ratingFilter === "all") return reviews;

  const minRating = Number(ratingFilter);
  if (!Number.isFinite(minRating)) return reviews;

  return reviews.filter((review) => Number(review.rating) >= minRating);
}

export function sortReviews(reviews, sortKey) {
  const list = [...reviews];

  switch (sortKey) {
    case "newest":
      return list.sort((a, b) => reviewTimestamp(b) - reviewTimestamp(a));
    case "highest":
      return list.sort(
        (a, b) => b.rating - a.rating || reviewTimestamp(b) - reviewTimestamp(a)
      );
    case "lowest":
      return list.sort(
        (a, b) => a.rating - b.rating || reviewTimestamp(b) - reviewTimestamp(a)
      );
    case "relevance":
    default:
      return list.sort((a, b) => {
        if (Boolean(a.isNew) !== Boolean(b.isNew)) {
          return a.isNew ? -1 : 1;
        }
        const textDiff = (b.text?.length || 0) - (a.text?.length || 0);
        if (textDiff !== 0) return textDiff;
        return reviewTimestamp(b) - reviewTimestamp(a);
      });
  }
}

function adminHeaders() {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function readLocalReviews() {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(mapRow) : [];
  } catch {
    return [];
  }
}

function writeLocalReview(review) {
  const existing = readLocalReviews();
  const entry = mapRow({ ...review, isNew: true });
  localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify([entry, ...existing]));
  return entry;
}

function mergeReviews(...lists) {
  const seen = new Set();
  const merged = [];

  for (const list of lists) {
    for (const item of list) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(mapRow(item));
    }
  }

  return merged;
}

async function fetchFromApi() {
  const res = await fetch("/api/reviews");
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json) ? json.map(mapRow) : null;
}

async function fetchFromSupabase() {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return null;
  return (data || []).map(mapRow);
}

async function fetchStaticReviews() {
  try {
    const res = await fetch("/reviews.json");
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json.map(mapRow) : [];
  } catch {
    return [];
  }
}

export async function fetchAllReviews() {
  const apiReviews = await fetchFromApi();
  if (apiReviews) {
    return mergeReviews(apiReviews, readLocalReviews());
  }

  const supabaseReviews = await fetchFromSupabase();
  if (supabaseReviews) {
    return mergeReviews(supabaseReviews, readLocalReviews());
  }

  const staticReviews = await fetchStaticReviews();
  return mergeReviews(staticReviews, readLocalReviews());
}

export async function postReview(review) {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    });

    if (res.ok) {
      const data = await res.json();
      return mapRow({ ...data, isNew: true });
    }

    if (res.status !== 404 && res.status !== 503) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Could not save review.");
    }
  } catch (error) {
    if (error.message && !error.message.includes("Failed to fetch")) {
      throw error;
    }
  }

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        name: review.name,
        location: review.location,
        text: review.text,
        rating: review.rating,
      })
      .select()
      .single();
    if (error) throw error;
    return mapRow({ ...data, isNew: true });
  }

  return writeLocalReview({
    id: `local-${Date.now()}`,
    ...review,
    date: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  });
}

export async function adminUpdateReview(id, updates) {
  const res = await fetch("/api/reviews", {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({ id, ...updates }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not update review.");
  }

  return mapRow(data);
}

export async function adminDeleteReview(id) {
  const res = await fetch("/api/reviews", {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ id }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not delete review.");
  }

  return true;
}