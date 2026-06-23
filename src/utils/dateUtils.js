/**
 * dateUtils.js
 * ─────────────────────────────────────────────────────────────
 * All date / time helpers used across the admin panel.
 * Import only what you need — all are pure functions with no
 * side effects so tree-shaking eliminates unused exports.
 *
 * USAGE
 * -----
 * import { todayStr, fmtTime, fmtDateTime, getWeekRange } from "../utils/dateUtils";
 */

/* ── Zero-pad a number to 2 digits ── */
export const pad = (n) => String(n).padStart(2, "0");

/* ── ISO date string for today  (e.g. "2026-06-13") ── */
export const todayStr = () => new Date().toISOString().split("T")[0];

/* ── ISO date string for tomorrow ── */
export const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

/* ── [monday, sunday] of the current week ── */
export const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().split("T")[0], sun.toISOString().split("T")[0]];
};

/* ── [first-of-month, last-of-month] for the current month ── */
export const getMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [first.toISOString().split("T")[0], last.toISOString().split("T")[0]];
};

/**
 * Format a "HH:MM" 24-h string → "12:30 PM"
 * Returns "—" for falsy input.
 */
export const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
};

/**
 * Format an ISO datetime string → "13 Jun 2026, 02:30 PM"
 * Returns "—" for falsy input.
 */
export const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Format an ISO date string → "13 Jun 2026"
 * Returns "—" for falsy input.
 */
export const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Convert a Date object to a local "YYYY-MM-DD" string
 * (avoids UTC-shift bugs that toISOString() can cause).
 */
export const toLocalISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Derive a named dining slot from a "HH:MM" time string.
 * Returns { key, label } or null.
 */
export const slotFromTime = (time) => {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  if (h < 10) return { key: "BF", label: "Breakfast" };
  if (h < 12) return { key: "BR", label: "Brunch" };
  if (h < 16) return { key: "LU", label: "Lunch" };
  if (h < 18) return { key: "HT", label: "Hi-Tea" };
  return { key: "DI", label: "Dinner" };
};
