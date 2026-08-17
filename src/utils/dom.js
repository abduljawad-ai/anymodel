/**
 * DOM utilities and accessibility helpers.
 * Shared across all components — no internal dependencies.
 */

/** Shortcut for document.getElementById. */
export function $(id) {
  return document.getElementById(id);
}

/** Escape HTML special characters for safe text insertion. */
export function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** CSS selector for focusable elements. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus the first focusable element inside `root` without scrolling. */
export function focusFirst(root) {
  const el = root.querySelector(FOCUSABLE);
  if (el) el.focus({ preventScroll: true });
  return !!el;
}

/** Return a Tab-trap keydown handler for `root`. */
export function trapFocus(root) {
  return function (e) {
    if (e.key !== "Tab") return;
    const els = Array.prototype.filter.call(
      root.querySelectorAll(FOCUSABLE),
      el => el.offsetParent !== null || el === document.activeElement
    );
    if (!els.length) return;
    const first = els[0];
    const last  = els[els.length - 1];
    const inside = root.contains(document.activeElement);
    if (e.shiftKey && (!inside || document.activeElement === first)) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  };
}
