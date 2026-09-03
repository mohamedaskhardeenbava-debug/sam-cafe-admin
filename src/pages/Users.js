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
 */
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { exportToExcel } from "../utils/excelUtils";
import { todayStr } from "../utils/dateUtils";

import { sortArray, EmptyRow } from "../App";
import { useToast } from "../useToast";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { FilterBar } from "../components/FilterBar";

import "./Users.css";

/* ── helpers ── */
const getTotalItemsOrdered = (user) => {
  if (!Array.isArray(user.orders)) return 0;
  return user.orders.reduce((orderAcc, order) => {
    if (!Array.isArray(order.items)) return orderAcc;
    return (
      orderAcc +
      order.items.reduce((itemAcc, item) => itemAcc + Number(item.quantity || 0), 0)
    );
  }, 0);
};

const Users = ({ handleSort, sortConfig, users, subscriptions }) => {
  // ── Hooks

  const navigate = useNavigate();
  const { toast } = useToast();
  const [userSearch, setUserSearch] = useState("");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

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

  const sortedUsers = useMemo(() => sortArray(users, sortConfig), [users, sortConfig]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return q
      ? sortedUsers.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.mobile || "").includes(q)
      )
      : sortedUsers;
  }, [sortedUsers, userSearch]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredUsers.length, 30);

  /* ── Export ── */
  const handleExport = () => {
    if (!filteredUsers.length) {
      toast.warning("No users to export");
      return;
    }
    const rows = filteredUsers.map((u, i) => ({
      "#": i + 1,
      Name: u.name || "—",
      Mobile: u.mobile || "—",
      "Total Orders": u.orders?.length || 0,
      "Total Dishes Ordered": getTotalItemsOrdered(u),
      Member: memberPhones.has(u.mobile) ? "Yes" : "No",
    }));
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
      await api.post("/campaign", { users });
      toast.success("Campaign sent successfully");
    } catch {
      toast.error("Failed to send campaign");
    }
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
          onClear={() => setUserSearch("")}
          active={!!userSearch}
        />
      </CollapseSection>

      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th className="icon-width">#</th>
              <th
                onClick={() => handleSort("name")}
                className={sortConfig.key === "name" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>User Name</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "name"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th
                onClick={() => handleSort("mobile")}
                className={sortConfig.key === "mobile" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Mobile Number</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "mobile"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th>Total Orders</th>
              <th>Total Dishes Ordered</th>
              <th>Member</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <EmptyRow colSpan={6} message="No users found" />
            ) : (
              filteredUsers.slice(0, displayLimit).map((user, index) => (
                <tr key={user.id}>
                  <td className="icon-width">{index + 1}</td>
                  <td>
                    <span
                      className="clickable"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      {user.name}
                    </span>
                  </td>
                  <td>{user.mobile}</td>
                  <td>{user.orders?.length || 0}</td>
                  <td>{getTotalItemsOrdered(user)}</td>
                  <td>
                    {memberPhones.has(user.mobile) ? (
                      <span className="user-member-badge">Member</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={6}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
    </div>
  );
};

export default Users;