/**
 * Keylock modal — passphrase prompt for encrypted API key storage.
 *
 * Presented as a focused, accessible dialog. The passphrase is never persisted;
 * it lives only in memory for the session.
 *
 * The Keylock class encapsulates the UI logic that was previously embedded
 * in state.js. It depends only on a DOM getter function and a render callback
 * for when the unlock state changes.
 */

import { focusFirst, trapFocus } from "../../utils/dom.js";

export class Keylock {
  constructor({ $, onUnlocked }) {
    this.$ = $;
    this.onUnlocked = onUnlocked || (() => {});
    this.mode = "unlock"; // "unlock" | "create"
    this.resolver = null;
    this.wired = false;
  }

  /** Show the passphrase dialog. Resolves with the passphrase on success, or null on cancel. */
  show(mode) {
    this.mode = mode;
    const ov = this.$("keylockOverlay");
    const pass = this.$("keylockPass");
    const confirm = this.$("keylockConfirm");
    const err = this.$("keylockError");
    const ok = this.$("keylockOk");
    const title = this.$("keylockTitle");
    const hint = this.$("keylockHint");

    if (!ov || !pass || !ok) return Promise.resolve(null);

    this.wireEvents();

    ov.hidden = false;
    err.hidden = true;
    pass.value = "";
    confirm.value = "";
    confirm.hidden = mode !== "create";
    ok.textContent = mode === "create" ? "Save" : "Unlock";
    title.textContent = mode === "create" ? "Protect your API keys" : "Unlock your API keys";
    hint.textContent = mode === "create"
      ? "Create a passphrase to encrypt your keys on this device. You'll need it every session — there is no recovery if you forget it."
      : "Enter your passphrase to decrypt the API keys saved on this device.";
    pass.focus();

    return new Promise(resolve => { this.resolver = resolve; });
  }

  hide() {
    const ov = this.$("keylockOverlay");
    if (ov) ov.hidden = true;
  }

  resolve(value) {
    this.hide();
    if (this.resolver) {
      const r = this.resolver;
      this.resolver = null;
      r(value);
    }
  }

  wireEvents() {
    if (this.wired) return;
    this.wired = true;

    const self = this;

    this.$("keylockOk").addEventListener("click", submit);
    this.$("keylockCancel").addEventListener("click", () => self.resolve(null));

    const ov = this.$("keylockOverlay");
    ov.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) self.resolve(null);
    });

    document.addEventListener("keydown", (e) => {
      if (this.$("keylockOverlay").hidden) return;
      if (e.key === "Escape") { self.resolve(null); return; }
      const card = document.querySelector(".keylock-card");
      if (card) trapFocus(card)(e);
    });

    ["keylockPass", "keylockConfirm"].forEach(id => {
      this.$(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      });
    });

    function submit() {
      const pass = self.$("keylockPass").value;
      const err = self.$("keylockError");

      if (self.mode === "create") {
        const confirm = self.$("keylockConfirm").value;
        if (pass.length < 8) {
          err.textContent = "Use at least 8 characters.";
          err.hidden = false;
          return;
        }
        if (pass !== confirm) {
          err.textContent = "Passphrases don't match.";
          err.hidden = false;
          return;
        }
        self.resolve(pass);
        return;
      }

      // unlock mode — caller handles verification
      self.resolve(pass);
    }
  }
}
