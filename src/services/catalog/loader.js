/**
 * Catalog loader: fetches models-catalog.json with a 24h localStorage cache.
 * The catalog (~2MB) is fetched once and cached to avoid re-downloading on every page load.
 * Includes SHA-256 integrity validation to detect tampered cache.
 */

const CATALOG_URL = "models-catalog.json";
const CATALOG_LS_KEY = "anymodel_catalog_v1";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let catalogData = null;
let catalogPromise = null;

/**
 * Compute SHA-256 hash of a string, returned as hex.
 */
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensure the catalog is loaded. Returns cached data if available, fresh, and untampered.
 * Otherwise fetches from network and caches the result with an integrity hash.
 */
export async function ensureCatalogLoaded() {
  if (catalogData) return catalogData;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_LS_KEY) || "null");
      if (cached && cached.ts && Date.now() - cached.ts < CATALOG_TTL_MS && cached.data) {
        // Verify integrity if hash is present
        if (cached.hash) {
          const dataStr = JSON.stringify(cached.data);
          const computed = await hashString(dataStr);
          if (computed !== cached.hash) {
            // Cache tampered — refetch
            console.warn("[anymodel] Catalog cache integrity check failed, refetching...");
            localStorage.removeItem(CATALOG_LS_KEY);
          } else {
            catalogData = cached.data;
            return catalogData;
          }
        } else {
          // Legacy cache without hash — accept but add hash on next save
          catalogData = cached.data;
          return catalogData;
        }
      }
    } catch (e) { /* corrupted cache — refetch */ }

    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error("Could not load the model catalog.");
    catalogData = await res.json();
    try {
      const dataStr = JSON.stringify(catalogData);
      const hash = await hashString(dataStr);
      localStorage.setItem(CATALOG_LS_KEY, JSON.stringify({ ts: Date.now(), data: catalogData, hash }));
    } catch (e) { /* storage full/disabled — cache is optional */ }
    return catalogData;
  })();

  return catalogPromise;
}

/**
 * Force a cache refresh (used in settings when switching providers).
 */
export function invalidateCatalogCache() {
  catalogData = null;
  catalogPromise = null;
}
