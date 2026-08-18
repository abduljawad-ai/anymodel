/**
 * Keylock modal — passphrase prompt for encrypted API key storage.
 *
 * Presented as a focused, accessible dialog. The passphrase is never persisted;
 * it lives only in memory for the session.
 *
 * In "unlock" mode, a verify callback is provided: if it returns false,
 * the modal stays open and shows an error. In "create" mode, the modal
 * validates input locally.
 */

import { focusFirst, trapFocus } from "../../utils/dom.js";

export class Keylock {
  constructor({ $ }) {
    /** @type {function(string): HTMLElement|null} */
    this.$ = $;
    this.mode = "unlock"; // "unlock" | "create"
    this.verifyCallback = null;
    this.resolver = null;
    this.wired = false;
  }

  /**
   * Show the passphrase dialog.
   * @param {"unlock"|"create"} mode
   * @param {function(string): Promise<boolean>} [onVerify] — for unlock mode,
   *        called with the passphrase; the modal stays open if it resolves false.
   * @returns {Promise<string|null>} resolves with the passphrase on success, or null on cancel.
   */
  show(mode, onVerify) {
    this.mode = mode;
    this.verifyCallback = onVerify || null;

    const ov = this.$("keylockOverlay");
    const pass = this.$("keylockPass");
    const ok = this.$("keylockOk");

    if (!ov || !pass || !ok) return Promise.resolve(null);

    this.wireEvents();

    const confirm = this.$("keylockConfirm");
    const err = this.$("keylockError");
    const okText = this.$("keylockOk");
    const title = this.$("keylockTitle");
    const hint = this.$("keylockHint");

    ov.hidden = false;
    err.hidden = true;
    pass.value = "";
    if (confirm) confirm.value = "";
    if (confirm) confirm.hidden = mode !== "create";
    okText.textContent = mode === "create" ? "Save" : "Unlock";
    title.textContent =
      mode === "create" ? "Protect your API keys" : "Unlock your API keys";
    hint.textContent =
      mode === "create"
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

  showError(msg) {
    const err = this.$("keylockError");
    if (err) { err.textContent = msg; err.hidden = false; }
  }

  async _submit() {
    const pass = this.$("keylockPass").value;

    if (this.mode === "create") {
      const confirm = this.$("keylockConfirm") ? this.$("keylockConfirm").value : "";
      if (pass.length < 8) { this.showError("Use at least 8 characters."); return; }
      if (pass !== confirm) { this.showError("Passphrases don't match."); return; }
      this.resolve(pass);
      return;
    }

    // unlock mode — verify via callback
    if (this.verifyCallback) {
      const ok = await this.verifyCallback(pass);
      if (ok) {
        this.resolve(pass);
      } else {
        this.showError("Wrong passphrase. Try again.");
        if (this.$("keylockPass")) {
          this.$("keylockPass").value = "";
          this.$("keylockPass").focus();
        }
      }
    } else {
      this.resolve(pass);
    }
  }

  wireEvents() {
    if (this.wired) return;
    this.wired = true;

    const self = this;

    this.$("keylockOk").addEventListener("click", () => self._submit());
    this.$("keylockCancel").addEventListener("click", () => self.resolve(null));

    const ov = this.$("keylockOverlay");
    if (ov) {
      ov.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) self.resolve(null);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (!self.$("keylockOverlay") || self.$("keylockOverlay").hidden) return;
      if (e.key === "Escape") { self.resolve(null); return; }
      const card = document.querySelector(".keylock-card");
      if (card) trapFocus(card)(e);
    });

    ["keylockPass", "keylockConfirm"].forEach(id => {
      const el = self.$(id);
      if (el) {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); self._submit(); }
        });
      }
    });
  }
}
