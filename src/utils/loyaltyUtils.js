/**
 * loyaltyUtils.js — Sam Cafe Admin
 *
 * Pure calculation helpers for the Guest Management / Loyalty system on
 * the admin Users page. A "guest" here is any entry in the `users`
 * collection; there's no separate visit-log or loyalty-ledger collection
 * in the backend, so every metric is derived on the fly from each user's
 * embedded `orders` array (the same array Users.js already reads for
 * "Total Orders" / "Total Dishes Ordered").
 *
 * Five inputs drive loyalty points:
 *   1. Frequency        — number of distinct order dates (each = 1 visit).
 *   2. Orders           — total number of orders placed.
 *   3. Dishes           — total number of dishes ordered (quantity-weighted).
 *   4. Spend            — total amount spent across all orders.
 *   5. Avg spend/visit   — total spend ÷ visit count. Weighting this
 *      separately means a guest with a handful of high-value visits
 *      (e.g. private event bookings) isn't buried under someone who
 *      places many small orders but spends less per visit overall.
 *
 * Point weights are no longer hardcoded — they're read from
 * loyaltySettingsStore (editable from the Loyalty Settings panel) and
 * passed into these functions. DEFAULT_LOYALTY_SETTINGS in that file is
 * the fallback shape, re-exported here for convenience.
 *
 * Manual staff adjustments (comp / remove points) are stored per-user
 * and folded into the final points total — see loyaltyAdjustmentsStore.js.
 */

import { DEFAULT_LOYALTY_SETTINGS } from "./loyaltySettingsStore";
import { getManualAdjustmentTotal, getManualAdjustments } from "./loyaltyAdjustmentsStore";

export { DEFAULT_LOYALTY_SETTINGS };
// Back-compat named exports (previously hardcoded constants some callers
// may still import directly).
export const POINTS_PER_VISIT = DEFAULT_LOYALTY_SETTINGS.pointsPerVisit;
export const POINTS_PER_ORDER = DEFAULT_LOYALTY_SETTINGS.pointsPerOrder;
export const POINTS_PER_DISH = DEFAULT_LOYALTY_SETTINGS.pointsPerDish;
export const POINTS_PER_100_SPENT = DEFAULT_LOYALTY_SETTINGS.pointsPer100Spent;
export const LOYALTY_TIERS = DEFAULT_LOYALTY_SETTINGS.tiers;

/** Total dish count for a single order, respecting each item's quantity. */
function orderDishCount(order) {
  if (!Array.isArray(order?.items)) return 0;
  return order.items.reduce((sum, item) => sum + (Number(item.quantity ?? item.qty) || 1), 0);
}

/** Total amount for a single order — falls back through the field names
 *  seen across the codebase (`totalAmount` is the one actually set by
 *  the user panel today; the others are defensive fallbacks). */
function orderAmount(order) {
  const amt = order?.totalAmount ?? order?.total ?? order?.grandTotal ?? order?.amount ?? 0;
  return Number(amt) || 0;
}

/** A stable "visit date" key for an order, so multiple orders placed on
 *  the same calendar day count as one visit rather than several. */
function orderDateKey(order) {
  const raw = order?.createdAt || order?.date;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function orderDate(order) {
  const raw = order?.createdAt || order?.date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Non-cancelled orders for a user, optionally restricted to a date range. */
function ordersInRange(user, fromDate, toDate) {
  const all = Array.isArray(user?.orders)
    ? user.orders.filter((o) => o?.status !== "cancelled")
    : [];
  if (!fromDate && !toDate) return all;
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate) : null;
  if (to) to.setHours(23, 59, 59, 999);
  return all.filter((o) => {
    const d = orderDate(o);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function resolveTiers(settings) {
  return Array.isArray(settings?.tiers) && settings.tiers.length
    ? settings.tiers
    : DEFAULT_LOYALTY_SETTINGS.tiers;
}

function tierFor(points, settings) {
  const tiers = resolveTiers(settings);
  return tiers.find((t) => points >= t.minPoints) || tiers[tiers.length - 1];
}

/**
 * Core points formula, shared by the full-lifetime calculation and the
 * date-scoped ("this month") one below. Takes already-filtered orders so
 * callers control the time window.
 */
function computeMetrics(orders, settings) {
  const s = { ...DEFAULT_LOYALTY_SETTINGS, ...settings };

  const totalOrders = orders.length;
  const totalDishes = orders.reduce((sum, o) => sum + orderDishCount(o), 0);
  const totalSpent = orders.reduce((sum, o) => sum + orderAmount(o), 0);

  const visitDates = new Set();
  orders.forEach((o) => {
    const key = orderDateKey(o);
    if (key) visitDates.add(key);
  });
  // Orders with no parseable date still happened — count them as
  // individual visits rather than silently dropping them from frequency.
  const undated = orders.filter((o) => !orderDateKey(o)).length;
  const visitCount = visitDates.size + undated;

  const avgSpendPerVisit = visitCount > 0 ? totalSpent / visitCount : 0;

  const points = Math.round(
    visitCount * s.pointsPerVisit +
    totalOrders * s.pointsPerOrder +
    totalDishes * s.pointsPerDish +
    (totalSpent / 100) * s.pointsPer100Spent +
    (avgSpendPerVisit / 100) * (s.avgSpendPerVisitWeight || 0)
  );

  return { visitCount, totalOrders, totalDishes, totalSpent, avgSpendPerVisit, points };
}

/**
 * Computes the loyalty metrics + derived points/tier for one user,
 * across their full order history, plus any manual staff adjustments.
 *
 * @param {object} user
 * @param {object} [settings] — from loyaltySettingsStore; defaults used if omitted.
 */
export function getGuestLoyaltyStats(user, settings = DEFAULT_LOYALTY_SETTINGS) {
  const orders = ordersInRange(user);
  const base = computeMetrics(orders, settings);
  const adjustment = getManualAdjustmentTotal(user?.id);
  const points = Math.max(0, base.points + adjustment);
  const tier = tierFor(points, settings);

  return {
    ...base,
    manualAdjustment: adjustment,
    points,
    tier: tier.key,
    tierLabel: tier.label,
  };
}

/** Loyalty metrics + tier scoped to a date range (e.g. "this year"), so
 *  staff can surface currently-active regulars rather than one-time big
 *  spenders from years ago. When called with no range (both args falsy)
 *  this returns the same all-time figures as getGuestLoyaltyStats, so a
 *  single call site can serve as "period points, defaulting to all
 *  data" without a separate lifetime/period toggle.
 *
 *  Manual adjustments are lifetime, not tied to any one period — they're
 *  included here (same as getGuestLoyaltyStats) so the points shown and
 *  the tier badge stay consistent between the Users list and the guest
 *  detail page regardless of which date range is selected. */
export function getGuestLoyaltyStatsForRange(user, fromDate, toDate, settings = DEFAULT_LOYALTY_SETTINGS) {
  const orders = ordersInRange(user, fromDate, toDate);
  const base = computeMetrics(orders, settings);
  const adjustment = getManualAdjustmentTotal(user?.id);
  const points = Math.max(0, base.points + adjustment);
  const tier = tierFor(points, settings);

  return {
    ...base,
    manualAdjustment: adjustment,
    points,
    tier: tier.key,
    tierLabel: tier.label,
  };
}

/** Convenience: is this user a "best customer" — top-tier (VIP or Gold)
 *  by loyalty points. Used to drive the Users-page filter. */
export function isBestCustomer(user, settings = DEFAULT_LOYALTY_SETTINGS) {
  const { tier } = getGuestLoyaltyStats(user, settings);
  return tier === "vip" || tier === "gold";
}

/** True if this guest crossed UP into Gold/VIP within the given lookback
 *  window (based on order-derived cumulative points at each order in
 *  their history). Used to flag "just became Gold/VIP this week" on the
 *  Users list so staff can greet them specially next visit. */
export function crossedIntoTopTierRecently(user, settings = DEFAULT_LOYALTY_SETTINGS, lookbackDays = 7) {
  const orders = ordersInRange(user).sort((a, b) => new Date(orderDate(a) || 0) - new Date(orderDate(b) || 0));
  if (!orders.length) return false;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const tiers = resolveTiers(settings);
  const goldMin = (tiers.find((t) => t.key === "gold") || {}).minPoints ?? DEFAULT_LOYALTY_SETTINGS.tiers[1].minPoints;

  let cumulative = [];
  let crossedAt = null;
  for (const o of orders) {
    cumulative.push(o);
    const { points } = computeMetrics(cumulative, settings);
    if (crossedAt === null && points >= goldMin) {
      crossedAt = orderDate(o);
      break; // first order whose cumulative points clears Gold — the crossing point
    }
  }

  if (!crossedAt) return false;
  return crossedAt >= cutoff;
}

/* ────────────────────────────────────────────────────────────────
   Points still needed to reach the next tier up, or null if already
   at the top tier.
──────────────────────────────────────────────────────────────── */
export function pointsToNextTier(points, settings = DEFAULT_LOYALTY_SETTINGS) {
  const tiers = resolveTiers(settings);
  const ordered = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const next = ordered.find((t) => t.minPoints > points);
  return next ? next.minPoints - points : null;
}

/** Chronological order + loyalty history, merged into one table: one
 *  entry per order carrying both its order details (time, total) and
 *  the points earned on that order (dishes + ₹100-spend chunks; the
 *  1-visit-per-day and 1-per-order components are folded into the
 *  first order of each calendar day so the per-order entries sum to
 *  the same total order-derived points shown on the guest's overview),
 *  plus any manual adjustments as their own rows. */
export function getLoyaltyHistory(user, settings = DEFAULT_LOYALTY_SETTINGS) {
  const s = { ...DEFAULT_LOYALTY_SETTINGS, ...settings };
  const orders = ordersInRange(user);

  const seenDates = new Set();
  const entries = orders.map((o) => {
    const dishes = orderDishCount(o);
    const amount = orderAmount(o);
    const dateKey = orderDateKey(o);
    const isFirstVisitOfDay = dateKey ? !seenDates.has(dateKey) : true;
    if (dateKey) seenDates.add(dateKey);

    const earned = Math.round(
      dishes * s.pointsPerDish +
      (amount / 100) * s.pointsPer100Spent +
      s.pointsPerOrder +
      (isFirstVisitOfDay ? s.pointsPerVisit : 0)
    );

    return {
      type: "order",
      orderId: o.id,
      date: o.createdAt || o.date || null,
      time: o.time || null,
      dishes,
      amount,
      pointsEarned: earned,
    };
  });

  const adjustmentEntries = getManualAdjustments(user?.id).map((a) => ({
    type: "adjustment",
    orderId: null,
    date: a.date,
    time: null,
    dishes: null,
    amount: null,
    pointsEarned: a.points,
    reason: a.reason,
    staffName: a.staffName,
  }));

  // Most recent first.
  return [...entries, ...adjustmentEntries].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

/* ────────────────────────────────────────────────────────────────
   Tier-based perks — retained as pure data helpers for anywhere else
   in the codebase that still references them, though the Guest
   Management page itself no longer displays Benefits/Offers sections.
──────────────────────────────────────────────────────────────── */
export const TIER_BENEFITS = {
  vip: [
    "Priority seating, no wait during peak hours",
    "Dedicated host greeting on arrival",
    "Complimentary dessert with every visit",
    "Early access to new menu launches",
  ],
  gold: [
    "Priority seating when available",
    "Complimentary welcome drink",
    "Early access to festive/event bookings",
  ],
  silver: [
    "Birthday month treat",
    "Faster table turnaround during off-peak hours",
  ],
  bronze: [
    "Standard service — keep visiting to unlock more benefits",
  ],
};

export const TIER_OFFERS = {
  vip: [
    { title: "20% off your next bill", detail: "Valid on dine-in orders above ₹500" },
    { title: "Free dessert on your birthday", detail: "Redeemable any day within your birthday month" },
  ],
  gold: [
    { title: "15% off your next bill", detail: "Valid on dine-in orders above ₹500" },
    { title: "Buy 1 Get 1 on select combos", detail: "Weekday lunch slots only" },
  ],
  silver: [
    { title: "10% off your next bill", detail: "Valid on orders above ₹300" },
  ],
  bronze: [
    { title: "5% off your next order", detail: "One-time, to welcome you back" },
  ],
};
