/** Reliable WhatsApp open on phones vs desktop (wa.me deep links). */

export function isMobileDevice() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Open a wa.me link. Call synchronously from a click handler — not after await.
 * On phones, uses direct navigation so the WhatsApp app opens reliably.
 */
export function openWhatsAppChat(url) {
  if (isMobileDevice()) {
    window.location.assign(url);
    return;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
  }
}
