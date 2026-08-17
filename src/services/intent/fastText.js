/**
 * fastText adapter — thin wrapper around the vendor fastText.js ESM module.
 *
 * The vendor file uses ESM with top-level await, so it CANNOT be loaded as a
 * classic script. Instead, this adapter imports it as a module (the ESM
 * loader guarantees it's evaluated before the IntentRouter uses it).
 *
 * Exposes:
 *   - FastText      — the FastText class (instantiate to create a model runner)
 *   - addOnPostRun  — callback registration (post-run fires immediately in ESM)
 *
 * @see services/intent/router.js for the IntentRouter facade.
 */

// Re-export vendor symbols. If the vendor's API changes, only this file
// needs to adapt.
export { FastText, addOnPostRun } from "../../fasttext.js";
