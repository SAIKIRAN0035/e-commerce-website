export const WHATSAPP = "918501831638";
export const WHATSAPP_DISPLAY = "+91 8501831638";
export const SITE_URL = import.meta.env.VITE_SITE_URL || "https://vaharuchulu.com";

export const WEIGHT_OPTIONS = [
  { key: "250g", label: "250g", multiplier: 0.25 },
  { key: "500g", label: "500g", multiplier: 0.5 },
  { key: "1kg", label: "1 KG", multiplier: 1 },
];

export function calcPrice(pricePerKg, multiplier) {
  return Math.round(pricePerKg * multiplier);
}

export function cartKey(productId, weightKey) {
  return `${productId}-${weightKey}`;
}

export function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return SITE_URL;
}
