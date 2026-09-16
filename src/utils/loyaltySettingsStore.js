/**
 * loyaltySettingsStore.js  —  Sam Cafe Admin Panel
 *
 * Tunable loyalty point weights, previously hardcoded in loyaltyUtils.js
 * (1/visit, 1/order, 1/dish, 1 per ₹100). Restaurants differ on how much
 * to reward frequency vs. spend, so this makes the weights (and the
 * average-spend-per-visit bonus) editable from a settings panel instead
 * of code.
 *
 * Persistence: tries the backend first (`/settings/loyalty`), falling
 * back to localStorage (namespaced per venue, matching the pattern
 * already used by VenueContext for venue selection). This means the
 * settings panel works immediately even before a dedicated backend
 * route exists, and upgrades transparently once one does.
 */

const STORAGE_PREFIX = "samCafe.loyaltySettings.";

export const DEFAULT_LOYALTY_SETTINGS = {
  pointsPerVisit: 1,
  pointsPerOrder: 1,
  pointsPerDish: 1,
  pointsPer100Spent: 1,
  // Weight applied to average-spend-per-visit (₹ per visit / 100 × this
  // weight, added on top of the base metrics above). Off (0) by default
  // so existing installs see no change in points until an admin opts in.
  avgSpendPerVisitWeight: 0,
  tiers: [
    { key: "vip", label: "VIP", minPoints: 300 },
    { key: "gold", label: "Gold", minPoints: 150 },
    { key: "silver", label: "Silver", minPoints: 60 },
    { key: "bronze", label: "Bronze", minPoints: 0 },
  ],
};

const storageKey = (venueId) => `${STORAGE_PREFIX}${venueId || "default"}`;

function readLocal(venueId) {
  try {
    const raw = localStorage.getItem(storageKey(venueId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LOYALTY_SETTINGS, ...parsed };
  } catch {
    return null;
  }
}

function writeLocal(venueId, settings) {
  try {
    localStorage.setItem(storageKey(venueId), JSON.stringify(settings));
  } catch {
    // best-effort only
  }
}

/** Load loyalty settings for the current venue. Falls back to defaults
 *  if nothing has been saved yet, or if the backend route 404s (not
 *  every deployment will have it wired up on day one). */
export async function loadLoyaltySettings(api, venueId) {
  try {
    const res = await api.get("/settings/loyalty", { params: venueId ? { venueId } : {} });
    if (res?.data && typeof res.data === "object") {
      const merged = { ...DEFAULT_LOYALTY_SETTINGS, ...res.data };
      writeLocal(venueId, merged); // keep local copy in sync as a fallback
      return merged;
    }
  } catch {
    // fall through to local
  }
  return readLocal(venueId) || { ...DEFAULT_LOYALTY_SETTINGS };
}

/** Save loyalty settings for the current venue. Always writes locally so
 *  the UI keeps working even if the backend route isn't available. */
export async function saveLoyaltySettings(api, venueId, settings) {
  writeLocal(venueId, settings);
  try {
    await api.put("/settings/loyalty", settings, { params: venueId ? { venueId } : {} });
    return { ok: true };
  } catch (error) {
    // Saved locally regardless — surface this as a soft failure so the
    // caller can still confirm the change "stuck" for this browser.
    return { ok: false, error, localOnly: true };
  }
}
