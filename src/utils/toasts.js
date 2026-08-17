/**
 * Toast notification utility — transient, non-blocking messages at the bottom of the screen.
 */

let toastTimer = null;

/** Show a toast message. Auto-dismisses after 5 seconds; click to dismiss immediately. */
export function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 5000);
  t.onclick = () => t.classList.remove("show");
}
