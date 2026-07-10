/**
 * dateRangeUtils.js  —  Sam Cafe Admin Panel
 * Single source of truth for "YYYY-MM-DD" date-range preset math.
 *
 * Every page that offers Today / This Week / This Month / Last Month
 * (or similar) filters should import these instead of re-implementing
 * them locally. Previously this logic was copy-pasted into 9+ files
 * with small, silent drifts (e.g. Catering.js's month range started on
 * the 2nd instead of the 1st). This file is the fix for that drift.
 */

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a given Date, in local time (no UTC shift). */
export const toLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today as "YYYY-MM-DD", local time. */
export const todayStr = () => toLocalISO(new Date());

/** Tomorrow as "YYYY-MM-DD", local time. */
export const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalISO(d);
};

/** Monday of the current week → today. Returns ["YYYY-MM-DD", "YYYY-MM-DD"].
 *  Capped at today (not Sunday) since none of these pages deal in future
 *  data — e.g. today Thu Jul 10 → ["2026-07-06", "2026-07-10"], not out
 *  to Sunday Jul 13. */
export const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return [toLocalISO(mon), toLocalISO(now)];
};

/** 1st of current month → today. Returns ["YYYY-MM-DD", "YYYY-MM-DD"]. */
export const getMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return [toLocalISO(first), toLocalISO(now)];
};

/** 1st → last day of the previous calendar month. Returns ["YYYY-MM-DD", "YYYY-MM-DD"]. */
export const getLastMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return [toLocalISO(first), toLocalISO(last)];
};

/**
 * Resolve a preset key to a [from, to] range.
 * Supported keys: "today" | "week" | "month" | "lastMonth" | "all"
 * "all" and any unrecognized key return ["", ""] (no filter applied).
 */
export const resolveDateRange = (preset) => {
  const t = todayStr();
  switch (preset) {
    case "today": return [t, t];
    case "week": return getWeekRange();
    case "month": return getMonthRange();
    case "lastMonth": return getLastMonthRange();
    default: return ["", ""];
  }
};

/** Standard set of period preset options: [key, label] pairs. */
export const DEFAULT_PERIOD_PRESETS = [
  ["all", "All"],
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["lastMonth", "Last Month"],
];