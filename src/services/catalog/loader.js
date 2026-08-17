/**
 * Catalog loader: fetches models-catalog.json with a 24h localStorage cache.
 * The catalog (~2MB) is fetched once and cached to avoid re-downloading on every page load.
 */

const CATALOG_URL = "models-catalog.json";
const CATALOG_LS_KEY = "anymodel_catalog_v1";
const CATALOG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let catalogData = null;
let catalogPromise = null;

/**
 * Ensure the catalog is loaded. Returns cached data if available and fresh,
 * otherwise fetches from network and caches the result.
 */
export async function ensureCatalogLoaded() {
  if (catalogData) return catalogData;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_LS_KEY) || "null");
      if (cached && cached.ts && Date.now() - cached.ts < CATALOG_TTL_MS && cached.data) {
        catalogData = cached.data;
        return catalogData;
      }
    } catch (e) { /* corrupted cache — refetch */ }

    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error("Could not load the model catalog.");
    catalogData = await res.json();
    try {
      localStorage.setItem(CATALOG_LS_KEY, JSON.stringify({ ts: Date.now(), data: catalogData }));
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
