/**
 * UserDetails.js  —  Sam Cafe Admin Panel
 * Single user detail page
 *
 * Loyalty upgrades
 * ─────────────────
 * • Special Benefits / Personalized Offers sections removed per request
 * • Orders + Loyalty History merged into a single table (Order ID, Date,
 *   Time, Dishes, Amount, Points Earned) so staff aren't cross-referencing
 *   two tables for the same order. Manual point adjustments show as their
 *   own rows in the merged table. Laid out the same way as the Users list
 *   table (numbered rows, table-wrapper/icon-width classes) with the same
 *   infinite-scroll behavior for long histories.
 * • Staff "Notes" field (allergies, preferences, special occasions) —
 *   persisted via PATCH /users/:id when the backend supports a `notes`
 *   field, falling back to a local cache otherwise (guestNotesStore)
 * • Date range filter (This Year / Previous Year / All Data + custom
 *   range) — every figure on the page (Total Orders, Total Dishes
 *   Ordered, Visits, Loyalty Points, Tier) and the merged table below
 *   all react to it together. No time-of-day picker here — a guest's
 *   history spans months/years, not a single day's service.
 * • "Adjust Points" action wired to the same LoyaltyAdjustModal used on
 *   the Users list
 */

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { formatDisplayDate, formatIndianTime, EmptyRow } from "../App";
import api from "../api";
import { useToast } from "../useToast";
import { useModal } from "../context/ModalContext";
import { useVenue } from "../context/VenueContext";
import Button3D from "../components/Button3D";
import { FilterBar } from "../components/FilterBar";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import LoyaltyAdjustModal, { LOYALTY_ADJUST_MODAL_ID } from "../components/LoyaltyAdjustModal";
import { updateRecord } from "../utils/crudUtils";
import { USER_PERIOD_PRESETS } from "../utils/dateRangeUtils";
import {
  getGuestLoyaltyStatsForRange,
  getLoyaltyHistory,
  pointsToNextTier,
} from "../utils/loyaltyUtils";
import { loadLoyaltySettings } from "../utils/loyaltySettingsStore";
import { getLocalGuestNotes, setLocalGuestNotes } from "../utils/guestNotesStore";

import "./UserDetails.css";

const UserDetails = ({ users, setAdminData }) => {
  // ── Hooks

  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openModal } = useModal();
  const { venueId } = useVenue();

  const user = users.find(u => u.id === userId);

  const [loyaltySettings, setLoyaltySettings] = useState(null);
  // Bumped after a manual point adjustment; used as a key below so the
  // loyalty-derived sections re-render immediately (adjustments live in
  // localStorage, outside the `users` prop, so React has no other signal
  // that they changed).
  const [refreshTick, setRefreshTick] = useState(0);

  // Date range filter, same pattern as the Users list page (no
  // time-of-day picker here — see the file header note above).
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Notes — seeded from the user record if the backend already has a
  // `notes` field, otherwise from the local fallback cache.
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadLoyaltySettings(api, venueId);
      if (!cancelled) setLoyaltySettings(s);
    })();
    return () => { cancelled = true; };
  }, [venueId]);

  useEffect(() => {
    if (!user) return;
    setNotes(user.notes ?? getLocalGuestNotes(user.id));
    setNotesDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filterActive = datePreset && datePreset !== "all";

  // Single source of truth for "the user, scoped to the selected date
  // range" — every stat on the page and the merged table below are all
  // derived from this, so applying a filter updates everything at once.
  const userForRange = useMemo(() => {
    if (!user) return user;
    if (!fromDate && !toDate) return user;
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (to) to.setHours(23, 59, 59, 999);
    return {
      ...user,
      orders: (user.orders || []).filter((o) => {
        const raw = o?.createdAt || o?.date;
        const d = raw ? new Date(raw) : null;
        if (!d || isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fromDate, toDate]);

  // Loyalty stats — scoped to the selected range, defaulting to all-time
  // when no filter is set. This single call drives every number shown:
  // visits, orders, dishes, spend, points, and tier. Memoized (rather
  // than computed after an early return) so every hook below always
  // runs in the same order regardless of whether `user` has loaded yet.
  const loyalty = useMemo(() => {
    if (!userForRange || !loyaltySettings) return null;
    return getGuestLoyaltyStatsForRange(userForRange, fromDate, toDate, loyaltySettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userForRange, fromDate, toDate, loyaltySettings]);

  // Merged Orders + Loyalty History table — reacts to the same
  // userForRange the stats above use.
  const history = useMemo(() => {
    if (!userForRange || !loyaltySettings) return [];
    return getLoyaltyHistory(userForRange, loyaltySettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userForRange, loyaltySettings]);

  const toNext = loyalty ? pointsToNextTier(loyalty.points, loyaltySettings) : null;

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(history.length, 30);

  if (!user || !loyaltySettings) return null;

  const handleNotesSave = async () => {
    setSavingNotes(true);
    // Keep the local cache as the safety net regardless of backend support.
    setLocalGuestNotes(user.id, notes);

    const res = await updateRecord({
      api,
      toast: { success: () => { }, error: () => { } }, // silence crudUtils' own toast; we show our own below
      endpoint: `/users/${user.id}`,
      payload: { ...user, notes },
      stateKey: "users",
      setAdminData,
      method: "patch",
    });

    setSavingNotes(false);
    setNotesDirty(false);
    if (res.ok) {
      toast.success("Notes saved");
    } else {
      toast.warning("Saved on this device — couldn't reach the server");
    }
  };

  return (
    <div className="details-container " key={refreshTick}>

      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <h2>{user.name}</h2>
        <span className={`loyalty-tier-badge loyalty-tier-badge--${loyalty.tier} guest-header-tier`}>
          {loyalty.tierLabel} Guest
        </span>
        <Button3D
          className="adjust-points-header-btn"
          variant="cancel"
          onClick={() => openModal(LOYALTY_ADJUST_MODAL_ID)}
        >
          Adjust Points
        </Button3D>
      </div>

      <div className="details-body">

        <div className="section-title">
          <span>User Details</span>
        </div>
        {/* USER INFO TABLE */}
        <table className="data-table">
          <tbody>
            <tr>
              <td>User ID</td>
              <td>{user.id}</td>
            </tr>
            <tr>
              <td>Name</td>
              <td>{user.name}</td>
            </tr>
            <tr>
              <td>Mobile</td>
              <td>{user.mobile}</td>
            </tr>
            <tr>
              <td>Total Orders</td>
              <td>{loyalty.totalOrders}</td>
            </tr>
            <tr>
              <td>Total Dishes Ordered</td>
              <td>{loyalty.totalDishes}</td>
            </tr>
          </tbody>
        </table>

        {/* ═══════════ VIP GUEST MANAGEMENT / LOYALTY PROGRAM ═══════════ */}
        {/* DATE FILTER */}
        <FilterBar
          dateRange={{
            from: fromDate,
            to: toDate,
            onChangeFrom: setFromDate,
            onChangeTo: setToDate,
            preset: datePreset,
            onChangePreset: setDatePreset,
            presets: USER_PERIOD_PRESETS,
            noMax: true,
          }}
          onClear={() => {
            setDatePreset("all");
            setFromDate("");
            setToDate("");
          }}
          active={filterActive}
        />

        <div className="section">
          <div className="section-title">
            <span>Loyalty Program</span>
          </div>

          <div className="loyalty-overview-grid">
            <div className="loyalty-stat-card">
              <span className="loyalty-stat-label">How Often They Visit</span>
              <span className="loyalty-stat-value">{loyalty.visitCount}</span>
              <span className="loyalty-stat-sub">distinct visit{loyalty.visitCount === 1 ? "" : "s"}</span>
            </div>
            <div className="loyalty-stat-card">
              <span className="loyalty-stat-label">Number of Orders</span>
              <span className="loyalty-stat-value">{loyalty.totalOrders}</span>
              <span className="loyalty-stat-sub">orders placed</span>
            </div>
            <div className="loyalty-stat-card">
              <span className="loyalty-stat-label">Dishes Ordered</span>
              <span className="loyalty-stat-value">{loyalty.totalDishes}</span>
              <span className="loyalty-stat-sub">dishes total</span>
            </div>
            <div className="loyalty-stat-card">
              <span className="loyalty-stat-label">Total Amount Spent</span>
              <span className="loyalty-stat-value">₹{loyalty.totalSpent.toLocaleString()}</span>
              <span className="loyalty-stat-sub">
                avg ₹{Math.round(loyalty.avgSpendPerVisit).toLocaleString()}/visit
              </span>
            </div>
          </div>

          {/* Loyalty Points */}
          <div className="loyalty-points-panel">
            <div className="loyalty-points-main">
              <span className="loyalty-points-value">{loyalty.points}</span>
              <span className="loyalty-points-label">Loyalty Points</span>
            </div>
            <div className={`loyalty-tier-pill loyalty-tier-badge--${loyalty.tier}`}>
              {loyalty.tierLabel} Tier
            </div>
            {toNext != null ? (
              <span className="loyalty-points-next">
                {toNext} more point{toNext === 1 ? "" : "s"} to reach the next tier
              </span>
            ) : (
              <span className="loyalty-points-next">Highest tier reached 🎉</span>
            )}
          </div>
        </div>

        {/* Staff Notes */}
        <div className="section">
          <div className="section-title">
            <span>Notes</span>
          </div>
          <textarea
            className="guest-notes-textarea"
            placeholder="Allergies, preferences, special occasions…"
            value={notes}
            maxLength={1000}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
          />
          <div className="guest-notes-actions">
            <Button3D onClick={handleNotesSave} disabled={!notesDirty || savingNotes}>
              {savingNotes ? "Saving…" : "Save Notes"}
            </Button3D>
          </div>
        </div>

        {/* MERGED ORDERS + LOYALTY HISTORY — same layout as the Users list table */}
        <div className="section">
          <div className="section-title">
            <span>Orders &amp; Loyalty History</span>
          </div>
          <div className="table-wrapper" ref={containerRef}>
            <table>
              <thead>
                <tr>
                  <th className="icon-width">#</th>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Dishes</th>
                  <th>Amount</th>
                  <th>Points Earned</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <EmptyRow colSpan={7} message="No orders or loyalty history for this period" />
                ) : (
                  history.slice(0, displayLimit).map((h, index) => (
                    <tr key={h.type === "order" ? h.orderId : `adj_${h.date}_${h.pointsEarned}`}>
                      <td className="icon-width">{index + 1}</td>
                      <td
                        className={h.orderId ? "clickable" : ""}
                        onClick={() => h.orderId && navigate(`/orders/${h.orderId}`)}
                      >
                        {h.orderId || (
                          <span title={h.reason}>Manual adjustment{h.staffName ? ` — ${h.staffName}` : ""}</span>
                        )}
                      </td>
                      <td>{formatDisplayDate(h.date)}</td>
                      <td>{h.type === "order" ? formatIndianTime(h.date, h.time) : "—"}</td>
                      <td>{h.dishes ?? "—"}</td>
                      <td>{h.amount != null ? `₹${h.amount}` : "—"}</td>
                      <td className={h.pointsEarned < 0 ? "loyalty-points-negative" : ""}>
                        {h.pointsEarned >= 0 ? "+" : ""}{h.pointsEarned}
                      </td>
                    </tr>
                  ))
                )}
                <InfiniteScrollLoader
                  sentinelRef={sentinelRef}
                  hasMore={hasMore}
                  colSpan={7}
                />
              </tbody>
            </table>
            <InfiniteScrollOverlay isLoading={isLoadingMore} />
          </div>
        </div>
      </div>

      <LoyaltyAdjustModal user={user} onAdjusted={() => setRefreshTick((t) => t + 1)} />
    </div>
  );
};

export default UserDetails;
