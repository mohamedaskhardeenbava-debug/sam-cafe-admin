/**
 * loyaltyAdjustmentsStore.js  —  Sam Cafe Admin Panel
 *
 * "Manually adjust points" — a human override staff can use to comp
 * points (bad experience) or remove points (cancelled/fraudulent order)
 * without touching the underlying order data the automatic formula
 * reads from.
 *
 * There's no ledger collection in the backend for this yet, so
 * adjustments are persisted to the backend when available
 * (`/users/:id/loyalty-adjustments`) and mirrored to localStorage as a
 * fallback/cache, same approach as loyaltySettingsStore.js. Reads are
 * synchronous from the local cache (loyaltyUtils.getGuestLoyaltyStats
 * calls these on every render for every row in the Users table, so they
 * can't be async) — callers should call refreshLoyaltyAdjustments() once
 * on load to pull the backend copy in before rendering, if a backend
 * route exists.
 */

const STORAGE_KEY = "samCafe.loyaltyAdjustments";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort only
  }
}

/** All adjustment entries for a user, most recent first. */
export function getManualAdjustments(userId) {
  if (!userId) return [];
  const all = readAll();
  const list = all[userId] || [];
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/** Net point delta from all adjustments for a user (can be negative). */
export function getManualAdjustmentTotal(userId) {
  return getManualAdjustments(userId).reduce((sum, a) => sum + (Number(a.points) || 0), 0);
}

/**
 * Record a manual adjustment for a user.
 * @param {string} userId
 * @param {number} points   — signed; positive to comp, negative to remove
 * @param {string} reason   — required, shown in loyalty history
 * @param {string} [staffName]
 */
export function addManualAdjustment(userId, points, reason, staffName) {
  const all = readAll();
  const list = all[userId] || [];
  const entry = {
    id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    points: Number(points) || 0,
    reason: reason || "",
    staffName: staffName || "Staff",
    date: new Date().toISOString(),
  };
  all[userId] = [...list, entry];
  writeAll(all);
  return entry;
}

/** Best-effort sync of a new adjustment to the backend, if a route
 *  exists. Local storage has already been updated by addManualAdjustment
 *  regardless of whether this succeeds. */
export async function syncManualAdjustment(api, userId, entry) {
  try {
    await api.post(`/users/${userId}/loyalty-adjustments`, entry);
    return { ok: true };
  } catch (error) {
    return { ok: false, error, localOnly: true };
  }
}

/** Pull the backend's copy of adjustments for a user into the local
 *  cache, if a route exists. Call this on page load per-user, or skip
 *  it entirely — the local cache still works standalone. */
export async function refreshLoyaltyAdjustments(api, userId) {
  try {
    const res = await api.get(`/users/${userId}/loyalty-adjustments`);
    if (Array.isArray(res?.data)) {
      const all = readAll();
      all[userId] = res.data;
      writeAll(all);
    }
  } catch {
    // no backend route yet — local cache is the source of truth
  }
}
