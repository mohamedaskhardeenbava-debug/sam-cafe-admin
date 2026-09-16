/**
 * Users.js  (refactored)
 *
 * Changes vs original
 * ───────────────────
 * • exportToExcel      → shared excelUtils (removes inline XLSX boilerplate)
 * • alert()            → toast (industry standard)
 * • sendCampaignToAllUsers — fixed: the function was defined inside itself
 *   (a nested declaration that never actually called the API). Now corrected.
 * • CustomDropdown     → imported from shared component (was inline copy)
 *
 * Loyalty upgrades
 * ─────────────────
 * • Configurable point weights (loyaltySettingsStore) instead of hardcoded
 * • "Churn risk" filter — was Gold/VIP, hasn't ordered in 60+ days
 * • Points are always period-scoped ("Points This Period" — defaults to
 *   all-time when no date filter is applied); changing the date filter
 *   updates every value in the table — Total Orders, Total Dishes
 *   Ordered, Visits, Loyalty Points, Tier — in the same pass.
 * • Sortable "Loyalty Points" column header, alongside the existing
 *   Name/Mobile sort — click to sort ascending/descending by points.
 * • Tier-change flag — "New Gold/VIP this week" badge
 * • Date range filter (This Year / Previous Year / All Data + custom
 *   range) applied to every column above. No time-of-day picker here —
 *   that only makes sense for a single day's service, not a guest's
 *   history spanning months/years (see the Orders page for that).
 * • Row-select checkboxes removed — bulk actions weren't earning their
 *   keep on this page; Export always exports the current filtered list.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { exportToExcel } from "../utils/excelUtils";
import { todayStr } from "../utils/dateUtils";
import { USER_PERIOD_PRESETS } from "../utils/dateRangeUtils";

import { EmptyRow } from "../App";
import { useToast } from "../useToast";
import { useModal } from "../context/ModalContext";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { FilterBar } from "../components/FilterBar";
import LoyaltyAdjustModal, { LOYALTY_ADJUST_MODAL_ID } from "../components/LoyaltyAdjustModal";
import {
  getGuestLoyaltyStatsForRange,
  crossedIntoTopTierRecently,
  LOYALTY_TIERS,
} from "../utils/loyaltyUtils";
import { loadLoyaltySettings } from "../utils/loyaltySettingsStore";
import { useVenue } from "../context/VenueContext";

import "./Users.css";

/* ── helpers ── */

/** Days since a user's most recent (non-cancelled) order, or null if
 *  they've never ordered. Used to drive the "Churn risk" filter. */
const daysSinceLastOrder = (user) => {
  const orders = Array.isArray(user.orders)
    ? user.orders.filter((o) => o?.status !== "cancelled")
    : [];
  if (!orders.length) return null;
  const dates = orders
    .map((o) => new Date(o.createdAt || o.date))
    .filter((d) => !isNaN(d.getTime()));
  if (!dates.length) return null;
  const mostRecent = new Date(Math.max(...dates.map((d) => d.getTime())));
  return Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
};

const CHURN_RISK_DAYS = 60;

/** Was this guest ever Gold/VIP (by lifetime points), regardless of
 *  where they sit today — the pool the churn-risk filter draws from. */
const wasEverTopTier = (loyalty) => loyalty.tier === "vip" || loyalty.tier === "gold";

/* Tier filter pills — "Best Customers" groups VIP+Gold together (the
   two top tiers), plus each individual tier, plus Churn Risk. */
const TIER_FILTER_OPTIONS = [
  ["best", "⭐ Best Customers"],
  ...LOYALTY_TIERS.map((t) => [t.key, t.label]),
  ["churn", `⚠ Churn Risk (${CHURN_RISK_DAYS}+ days)`],
];

const Users = ({ handleSort, sortConfig, users, subscriptions, setAdminData }) => {
  // ── Hooks

  const navigate = useNavigate();
  const { toast } = useToast();
  const { openModal } = useModal();
  const { venueId } = useVenue();
  const [userSearch, setUserSearch] = useState("");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [tierFilter, setTierFilter] = useState("");
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0); // bumped after a manual adjustment to re-derive loyalty

  // Local sort state for the "Loyalty Points" column, kept separate from
  // the Name/Mobile sortConfig (which lives in the parent, App.js) since
  // points are a derived value the parent's generic sortArray() can't
  // reach into `orders` to compute.
  const [pointsSort, setPointsSort] = useState(null); // null | "asc" | "desc"

  // Date range filter — every value in the table (orders, dishes,
  // visits, points, tier) is scoped to this range, defaulting to
  // all-time when no filter is applied. No time-of-day picker on this
  // page — a guest's loyalty history spans months/years, not a single
  // day's service.
  const [datePreset, setDatePreset] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loyaltySettings, setLoyaltySettings] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadLoyaltySettings(api, venueId);
      if (!cancelled) setLoyaltySettings(s);
    })();
    return () => { cancelled = true; };
  }, [venueId]);

  // ── Derived Values

  // Any user whose phone number matches an existing (any-status)
  // subscription record is tagged as a "Member" in the table below.
  const memberPhones = useMemo(() => {
    const set = new Set();
    (subscriptions || []).forEach(s => {
      if (s.customerPhone) set.add(s.customerPhone);
    });
    return set;
  }, [subscriptions]);

  // Full loyalty stats, scoped to the selected date range (all-time when
  // no range is set). This is the single source every column in the
  // table — orders, dishes, visits, points, tier — and the points sort
  // all read from, so applying a date filter updates everything in one
  // pass.
  const loyaltyById = useMemo(() => {
    if (!loyaltySettings) return new Map();
    const map = new Map();
    (users || []).forEach((u) =>
      map.set(u.id, getGuestLoyaltyStatsForRange(u, fromDate, toDate, loyaltySettings))
    );
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, loyaltySettings, fromDate, toDate, refreshTick]);

  const recentlyPromotedIds = useMemo(() => {
    if (!loyaltySettings) return new Set();
    const set = new Set();
    (users || []).forEach((u) => {
      if (crossedIntoTopTierRecently(u, loyaltySettings, 7)) set.add(u.id);
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, loyaltySettings, refreshTick]);

  const handlePointsSort = () => {
    setPointsSort((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const sortedUsers = useMemo(() => {
    if (pointsSort) {
      const dir = pointsSort === "asc" ? 1 : -1;
      return [...(users || [])].sort(
        (a, b) => dir * ((loyaltyById.get(a.id)?.points || 0) - (loyaltyById.get(b.id)?.points || 0))
      );
    }
    // Falls back to the parent-managed Name/Mobile sort when no points
    // sort is active.
    const list = [...(users || [])];
    if (sortConfig?.key) {
      list.sort((a, b) => {
        const av = (a[sortConfig.key] || "").toString().toLowerCase();
        const bv = (b[sortConfig.key] || "").toString().toLowerCase();
        if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
        if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [users, sortConfig, pointsSort, loyaltyById]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    let list = q
      ? sortedUsers.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.mobile || "").includes(q)
      )
      : sortedUsers;

    if (tierFilter) {
      list = list.filter((u) => {
        const loyalty = loyaltyById.get(u.id);
        if (!loyalty) return false;
        if (tierFilter === "best") return loyalty.tier === "vip" || loyalty.tier === "gold";
        if (tierFilter === "churn") {
          const idle = daysSinceLastOrder(u);
          return wasEverTopTier(loyalty) && idle !== null && idle >= CHURN_RISK_DAYS;
        }
        return loyalty.tier === tierFilter;
      });
    }
    return list;
  }, [sortedUsers, userSearch, tierFilter, loyaltyById]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredUsers.length, 30);

  /* ── Export (always the current filtered list — no row selection) ── */
  const handleExport = () => {
    if (!filteredUsers.length) {
      toast.warning("No users to export");
      return;
    }
    const rows = filteredUsers.map((u, i) => {
      const loyalty = loyaltyById.get(u.id);
      return {
        "#": i + 1,
        Name: u.name || "—",
        Mobile: u.mobile || "—",
        "Total Orders": loyalty?.totalOrders || 0,
        "Total Dishes Ordered": loyalty?.totalDishes || 0,
        "Visits": loyalty?.visitCount || 0,
        "Total Spent": loyalty?.totalSpent || 0,
        "Avg Spend / Visit": Math.round(loyalty?.avgSpendPerVisit || 0),
        "Loyalty Points": loyalty?.points || 0,
        "Loyalty Tier": loyalty?.tierLabel || "—",
        Member: memberPhones.has(u.mobile) ? "Yes" : "No",
      };
    });
    const ok = exportToExcel({
      rows,
      sheetName: "Users",
      fileName: `users_${todayStr()}.xlsx`,
    });
    if (!ok) toast.warning("No users to export");
  };

  /* ── Campaign ── */
  const sendCampaignToAllUsers = async () => {
    try {
      await api.post("/whatsapp/campaign", { users });
      toast.success("Campaign sent successfully");
    } catch {
      toast.error("Failed to send campaign");
    }
  };

  const openAdjustModal = (user) => {
    setAdjustTarget(user);
    openModal(LOYALTY_ADJUST_MODAL_ID);
  };

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Users</h2>
              <span className="ae-result-count">{filteredUsers.length} user(s)</span>
            </div>
          </div>
        </div>

        <div className="header-btn-container">
          <Button3D onClick={handleExport}>Export</Button3D>
          <Button3D onClick={sendCampaignToAllUsers}>Campaign</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={userSearch}
          onSearchChange={setUserSearch}
          searchPlaceholder=" Search name or mobile…"
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
          groups={[
            {
              label: "Loyalty",
              options: TIER_FILTER_OPTIONS,
              value: tierFilter,
              onChange: setTierFilter,
            },
          ]}
          secondRow
          onClear={() => {
            setUserSearch("");
            setTierFilter("");
            setDatePreset("all");
            setFromDate("");
            setToDate("");
          }}
          active={!!userSearch || !!tierFilter || (datePreset && datePreset !== "all")}
        />
      </CollapseSection>

      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th className="icon-width">#</th>
              <th
                onClick={() => { setPointsSort(null); handleSort("name"); }}
                className={!pointsSort && sortConfig.key === "name" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>User Name</span>
                  <span className="sort-arrow">
                    {!pointsSort && sortConfig.key === "name"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th
                onClick={() => { setPointsSort(null); handleSort("mobile"); }}
                className={!pointsSort && sortConfig.key === "mobile" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Mobile Number</span>
                  <span className="sort-arrow">
                    {!pointsSort && sortConfig.key === "mobile"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th>Total Orders</th>
              <th>Total Dishes Ordered</th>
              <th>Visits</th>
              <th onClick={handlePointsSort} className={pointsSort ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Loyalty Points</span>
                  <span className="sort-arrow">
                    {pointsSort ? (pointsSort === "asc" ? "▲" : "▼") : ""}
                  </span>
                </span>
              </th>
              <th>Tier</th>
              <th>Member</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <EmptyRow colSpan={10} message="No users found" />
            ) : (
              filteredUsers.slice(0, displayLimit).map((user, index) => {
                const loyalty = loyaltyById.get(user.id);
                const idle = daysSinceLastOrder(user);
                const isChurnRisk = loyalty && wasEverTopTier(loyalty) && idle !== null && idle >= CHURN_RISK_DAYS;
                const justPromoted = recentlyPromotedIds.has(user.id);
                return (
                  <tr key={user.id}>
                    <td className="icon-width">{index + 1}</td>
                    <td>
                      <span
                        className="clickable"
                        onClick={() => navigate(`/users/${user.id}`)}
                      >
                        {user.name}
                      </span>
                      {justPromoted && (
                        <span className="user-new-tier-flag" title="Crossed into Gold/VIP this week">
                          ✨ New
                        </span>
                      )}
                      {isChurnRisk && (
                        <span className="user-churn-flag" title={`No orders in ${idle}+ days`}>
                          ⚠
                        </span>
                      )}
                    </td>
                    <td>{user.mobile}</td>
                    <td>{loyalty?.totalOrders || 0}</td>
                    <td>{loyalty?.totalDishes || 0}</td>
                    <td>{loyalty?.visitCount || 0}</td>
                    <td>{loyalty?.points || 0}</td>
                    <td>
                      <span className={`loyalty-tier-badge loyalty-tier-badge--${loyalty?.tier}`}>
                        {loyalty?.tierLabel}
                      </span>
                    </td>
                    <td>
                      {memberPhones.has(user.mobile) ? (
                        <span className="user-member-badge">Member</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Button3D
                        variant="cancel"
                        onClick={() => openAdjustModal(user)}
                        title="Comp or remove loyalty points"
                      >
                        Adjust Points
                      </Button3D>
                    </td>
                  </tr>
                );
              })
            )}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={10}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>

      <LoyaltyAdjustModal
        user={adjustTarget}
        onAdjusted={() => setRefreshTick((t) => t + 1)}
      />
    </div>
  );
};

export default Users;
