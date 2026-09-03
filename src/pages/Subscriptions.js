/**
 * Subscriptions.js  —  Sam Cafe Admin Panel
 * Food subscription management page
 *
 * A subscription is a 4-week (1 month) meal plan. For each of the 5 meal
 * slots (breakfast, brunch, lunch, hi-tea, dinner) the admin picks which
 * dish (if any) is served on which day of week 1..4. A day can be left
 * empty (no dish that day/slot). "Weekly repeat" mode fills week 2-4
 * automatically from week 1 (same dishes every week); "Custom per week"
 * lets each of the 4 weeks be configured independently. The total price
 * is the sum of the base price of every dish placed anywhere in the plan.
 *
 * Two tabs:
 *   - Subscriptions — every subscription record. Click a row to open its
 *                      detail page (SubscriptionDetails.js) with an Edit
 *                      button; the "+ New Subscription" button here opens
 *                      the create modal (uses the same builder fields).
 *   - Members       — subscribed customers grouped by phone number, one
 *                      row per customer. Click a row to open the member's
 *                      detail page (MemberDetails.js) with an Edit button
 *                      for their name/phone.
 *
 * The actual "pick dish → tap days" schedule builder (state + JSX) lives
 * in ./subscriptions/useSubscriptionBuilder.js + SubBuilderFields.js so
 * this page's create-modal and SubscriptionDetails.js's edit mode share
 * one implementation instead of two copies drifting apart.
 */

import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";

import closeIcon from "../icon/close-icon.png";
import deleteIcon from "../icon/delete-icon.png";
import { allowTextInput, sortArray } from "../App";
import { EmptyRow } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import { useToast } from "../useToast";
import { CustomDatePicker } from "../components/CustomDatePicker";
import CustomDropdown from "../components/CustomDropdown";
import { todayStr } from "../utils/dateRangeUtils";
import { fmtDate } from "../utils/dateUtils";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { FilterBar } from "../components/FilterBar";
import useAnimatedModal from "../hooks/useAnimatedModal";
import { useTabLiquid } from "../hooks/useTabLiquid";

import { useSubscriptionBuilder, EMPTY_SUBSCRIPTION, SLOT_OPTIONS, WEEKS, DAYS } from "./subscriptions/useSubscriptionBuilder";
import SubBuilderFields from "./subscriptions/SubBuilderFields";

import "./Common.css";
import "./Subscriptions.css";
import "./ModalCSS.css";

const Subscriptions = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("subscriptions"); // "subscriptions" | "members"
  const { containerRef: pageTabPillsRef, thumbStyle: pageTabThumbStyle } = useTabLiquid(activeTab);
  const [showModal, setShowModal] = useState(false);
  const subscriptionModal = useAnimatedModal("subscriptions-add");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  // Status/plan-type filters, per tab. Subscriptions owns its own local
  // sortConfig per table (not App.js's shared one) so switching tabs, or
  // visiting from another sorted page, never leaves a stale sort key that
  // silently no-ops here — same reasoning Orders.js documents for its own
  // page-local sort state.
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [subPlanFilter, setSubPlanFilter] = useState("all");
  const [subSortConfig, setSubSortConfig] = useState({ key: "startDate", direction: "desc" });
  const handleSubSort = useCallback((key) => {
    setSubSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "asc" };
    });
  }, []);

  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [memberSortConfig, setMemberSortConfig] = useState({ key: "latestStartDate", direction: "desc" });
  const handleMemberSort = useCallback((key) => {
    setMemberSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "asc" };
    });
  }, []);

  // Builder state for the "+ New Subscription" modal only — resetTo()
  // reseeds it back to EMPTY_SUBSCRIPTION each time the modal is
  // reopened/cancelled, since this hook instance lives for the whole
  // page's lifetime rather than just while the modal is open.
  const builder = useSubscriptionBuilder(adminData, EMPTY_SUBSCRIPTION);
  const { subscription: newSubscription, totalPrice, filledCellCount, resetTo } = builder;

  const resetForm = () => {
    subscriptionModal.close(() => setShowModal(false));
    setFormErrors({});
    resetTo(EMPTY_SUBSCRIPTION);
  };

  const handleSave = async () => {
    const errs = {};
    if (!newSubscription.customerName.trim()) errs.customerName = true;
    if (!newSubscription.customerPhone.trim()) errs.customerPhone = true;
    if (!newSubscription.startDate) errs.startDate = true;
    if (filledCellCount === 0) errs.slots = true; // at least one dish must be scheduled somewhere
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      if (errs.slots) toast.warning("Select at least one dish for at least one slot/day.");
      return;
    }

    const payload = {
      id: `subscription_${Date.now()}`,
      ...newSubscription,
      totalPrice,
    };

    try {
      const res = await api.post("/subscriptions", payload);
      const saved = res.data || payload;

      setAdminData(prev => {
        const alreadyExists = (prev.subscriptions || []).some(s => s.id === saved.id);
        if (alreadyExists) return prev;
        return { ...prev, subscriptions: [...(prev.subscriptions || []), saved] };
      });

      toast.success("Subscription created successfully.");
      resetForm();
    } catch (err) {
      console.error("Failed to save subscription:", err);
      toast.error("Failed to save subscription");
    }
  };

  const handleDelete = (subscriptionId, customerName) => {
    toast.confirm(`Delete subscription for "${customerName}"?`, async () => {
      try {
        await api.delete(`/subscriptions/${subscriptionId}`);
        setAdminData(prev => ({
          ...prev,
          subscriptions: (prev.subscriptions || []).filter(s => s.id !== subscriptionId),
        }));
        toast.success("Subscription deleted");
      } catch (err) {
        console.error("Failed to delete subscription:", err);
        toast.error("Failed to delete subscription");
      }
    });
  };

  const filteredSubscriptions = useMemo(() => {
    const q = subscriptionSearch.trim().toLowerCase();
    const filtered = (adminData.subscriptions || []).filter(s => {
      if (subStatusFilter !== "all" && (s.status || "active") !== subStatusFilter) return false;
      if (subPlanFilter !== "all" && (s.planType || "weekly") !== subPlanFilter) return false;
      if (!q) return true;
      return (
        (s.customerName || "").toLowerCase().includes(q) ||
        (s.customerPhone || "").toLowerCase().includes(q)
      );
    });
    return sortArray(filtered, subSortConfig);
  }, [adminData.subscriptions, subscriptionSearch, subStatusFilter, subPlanFilter, subSortConfig]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredSubscriptions.length, 30);

  // ── MEMBERS — one row per unique customer (grouped by phone number),
  // with their subscription(s) rolled up. A "member" is simply anyone
  // with at least one subscription record, active or not.
  const members = useMemo(() => {
    const byPhone = new Map();
    (adminData.subscriptions || []).forEach(sub => {
      const key = sub.customerPhone || sub.customerName;
      if (!key) return;
      if (!byPhone.has(key)) {
        byPhone.set(key, {
          phone: sub.customerPhone,
          name: sub.customerName,
          subscriptions: [],
        });
      }
      byPhone.get(key).subscriptions.push(sub);
    });
    return Array.from(byPhone.values()).map(m => {
      const activeCount = m.subscriptions.filter(s => (s.status || "active") === "active").length;
      const totalSpend = m.subscriptions.reduce((acc, s) => acc + (Number(s.totalPrice) || 0), 0);
      const latest = [...m.subscriptions].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))[0];
      return {
        ...m,
        subscriptionCount: m.subscriptions.length,
        activeCount,
        totalSpend: Math.round(totalSpend),
        latestStartDate: latest?.startDate || "—",
        latestStatus: latest?.status || "active",
        latestPlanType: latest?.planType || "weekly",
      };
    });
  }, [adminData.subscriptions]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const filtered = members.filter(m => {
      if (memberStatusFilter !== "all" && m.latestStatus !== memberStatusFilter) return false;
      if (!q) return true;
      return (m.name || "").toLowerCase().includes(q) || (m.phone || "").toLowerCase().includes(q);
    });
    return sortArray(filtered, memberSortConfig);
  }, [members, memberSearch, memberStatusFilter, memberSortConfig]);

  const {
    displayLimit: memberDisplayLimit,
    sentinelRef: memberSentinelRef,
    containerRef: memberContainerRef,
    hasMore: memberHasMore,
    isLoadingMore: memberIsLoadingMore,
  } = useInfiniteScroll(filteredMembers.length, 30);

  return (
    <div className="inner-page">
      {/* HEADER */}
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
              <h2 className="title">Subscriptions</h2>
              <span className="result-count">
                {activeTab === "subscriptions"
                  ? `${filteredSubscriptions.length} subscription(s)`
                  : `${filteredMembers.length} member(s)`}
              </span>
            </div>
          </div>
        </div>

        <div className="header-btn-container">
          {activeTab === "subscriptions" && (
            <Button3D onClick={() => { setShowModal(true); subscriptionModal.open(); }}>+ New Subscription</Button3D>
          )}
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="app-tab-pills perm-view-switch" ref={pageTabPillsRef}>
        <span className="app-tab-pill-liquid" style={pageTabThumbStyle} />
        <button
          type="button"
          className={`app-tab-pill${activeTab === "subscriptions" ? " active" : ""}`}
          onClick={() => setActiveTab("subscriptions")}
        >
          Subscriptions
        </button>
        <button
          type="button"
          className={`app-tab-pill${activeTab === "members" ? " active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Members
        </button>
      </div>

      {activeTab === "subscriptions" ? (
        <>
          {/* FILTER BAR */}
          <CollapseSection collapsed={headerCollapsed}>
            <FilterBar
              search={subscriptionSearch}
              onSearchChange={setSubscriptionSearch}
              searchPlaceholder=" Search customer name or phone…"
              groups={[
                {
                  label: "Status",
                  options: [
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "cancelled", label: "Cancelled" },
                  ],
                  value: subStatusFilter,
                  onChange: setSubStatusFilter,
                  toggle: false,
                },
                {
                  label: "Plan Type",
                  options: [
                    { value: "all", label: "All" },
                    { value: "weekly", label: "Weekly Repeat" },
                    { value: "monthly", label: "Custom / Monthly" },
                  ],
                  value: subPlanFilter,
                  onChange: setSubPlanFilter,
                  toggle: false,
                },
              ]}
              onClear={() => { setSubscriptionSearch(""); setSubStatusFilter("all"); setSubPlanFilter("all"); }}
              active={!!subscriptionSearch || subStatusFilter !== "all" || subPlanFilter !== "all"}
            />
          </CollapseSection>

          <div className="table-wrapper" ref={containerRef}>
            <table>
              <thead>
                <tr>
                  <th
                    onClick={() => handleSubSort("customerName")}
                    className={subSortConfig.key === "customerName" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Customer</span>
                      <span className="sort-arrow">
                        {subSortConfig.key === "customerName"
                          ? subSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th>Phone</th>
                  <th
                    onClick={() => handleSubSort("planType")}
                    className={subSortConfig.key === "planType" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Plan Type</span>
                      <span className="sort-arrow">
                        {subSortConfig.key === "planType"
                          ? subSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th
                    onClick={() => handleSubSort("startDate")}
                    className={subSortConfig.key === "startDate" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Start Date</span>
                      <span className="sort-arrow">
                        {subSortConfig.key === "startDate"
                          ? subSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th>Slots Used</th>
                  <th
                    onClick={() => handleSubSort("totalPrice")}
                    className={subSortConfig.key === "totalPrice" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Total Price</span>
                      <span className="sort-arrow">
                        {subSortConfig.key === "totalPrice"
                          ? subSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th
                    onClick={() => handleSubSort("status")}
                    className={subSortConfig.key === "status" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Status</span>
                      <span className="sort-arrow">
                        {subSortConfig.key === "status"
                          ? subSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th className="icon-width">Delete</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    message={(adminData.subscriptions || []).length === 0 ? "No subscriptions yet" : "No subscriptions match your search"}
                  />
                ) : filteredSubscriptions.slice(0, displayLimit).map(sub => {
                  const usedSlots = SLOT_OPTIONS.filter(({ value }) =>
                    WEEKS.some(w => DAYS.some(({ key }) => {
                      const cell = sub.slots?.[value]?.[w]?.[key];
                      return Array.isArray(cell) ? cell.length > 0 : !!cell;
                    }))
                  ).map(s => s.label);

                  return (
                    <tr key={sub.id}>
                      <td>
                        <span className="clickable" onClick={() => navigate(`/subscriptions/${sub.id}`)}>
                          {sub.customerName}
                        </span>
                      </td>
                      <td>{sub.customerPhone}</td>
                      <td>
                        <span className={`sub-plan-badge ${sub.planType === "monthly" ? "monthly" : "weekly"}`}>
                          {sub.planType === "monthly" ? "Custom / Monthly" : "Weekly Repeat"}
                        </span>
                      </td>
                      <td>{sub.startDate ? fmtDate(sub.startDate) : "—"}</td>
                      <td>{usedSlots.length ? usedSlots.join(", ") : "—"}</td>
                      <td>₹{sub.totalPrice ?? 0}</td>
                      <td>
                        <span className={`sub-status-badge ${sub.status || "active"}`}>
                          {(sub.status || "active").charAt(0).toUpperCase() + (sub.status || "active").slice(1)}
                        </span>
                      </td>
                      <td className="icon-width">
                        <Button3D
                          variant="danger"
                          iconOnly
                          onClick={() => handleDelete(sub.id, sub.customerName)}
                        ><img src={deleteIcon} alt="" /></Button3D>
                      </td>
                    </tr>
                  );
                })}
                <InfiniteScrollLoader
                  sentinelRef={sentinelRef}
                  hasMore={hasMore}
                  colSpan={8}
                />
              </tbody>
            </table>
            <InfiniteScrollOverlay isLoading={isLoadingMore} />
          </div>
        </>
      ) : (
        <>
          {/* MEMBERS TAB */}
          <CollapseSection collapsed={headerCollapsed}>
            <FilterBar
              search={memberSearch}
              onSearchChange={setMemberSearch}
              searchPlaceholder=" Search member name or phone…"
              groups={[
                {
                  label: "Latest Status",
                  options: [
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "cancelled", label: "Cancelled" },
                  ],
                  value: memberStatusFilter,
                  onChange: setMemberStatusFilter,
                  toggle: false,
                },
              ]}
              onClear={() => { setMemberSearch(""); setMemberStatusFilter("all"); }}
              active={!!memberSearch || memberStatusFilter !== "all"}
            />
          </CollapseSection>

          <div className="table-wrapper" ref={memberContainerRef}>
            <table>
              <thead>
                <tr>
                  <th
                    onClick={() => handleMemberSort("name")}
                    className={memberSortConfig.key === "name" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Member</span>
                      <span className="sort-arrow">
                        {memberSortConfig.key === "name"
                          ? memberSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th>Phone</th>
                  <th
                    onClick={() => handleMemberSort("subscriptionCount")}
                    className={memberSortConfig.key === "subscriptionCount" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Total Subscriptions</span>
                      <span className="sort-arrow">
                        {memberSortConfig.key === "subscriptionCount"
                          ? memberSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th
                    onClick={() => handleMemberSort("activeCount")}
                    className={memberSortConfig.key === "activeCount" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Active Subscriptions</span>
                      <span className="sort-arrow">
                        {memberSortConfig.key === "activeCount"
                          ? memberSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th>Latest Plan Type</th>
                  <th
                    onClick={() => handleMemberSort("latestStartDate")}
                    className={memberSortConfig.key === "latestStartDate" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Latest Start Date</span>
                      <span className="sort-arrow">
                        {memberSortConfig.key === "latestStartDate"
                          ? memberSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                  <th>Latest Status</th>
                  <th
                    onClick={() => handleMemberSort("totalSpend")}
                    className={memberSortConfig.key === "totalSpend" ? "sorted" : ""}
                  >
                    <span className="th-content sort-th">
                      <span>Total Spend</span>
                      <span className="sort-arrow">
                        {memberSortConfig.key === "totalSpend"
                          ? memberSortConfig.direction === "asc" ? "▲" : "▼"
                          : ""}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <EmptyRow
                    colSpan={8}
                    message={members.length === 0 ? "No members yet — create a subscription to add one" : "No members match your search"}
                  />
                ) : filteredMembers.slice(0, memberDisplayLimit).map(m => (
                  <tr key={m.phone || m.name}>
                    <td>
                      <span
                        className="clickable"
                        onClick={() => navigate(`/subscriptions/members/${encodeURIComponent(m.phone || m.name)}`)}
                      >
                        {m.name || "—"}
                      </span>
                    </td>
                    <td>{m.phone || "—"}</td>
                    <td>{m.subscriptions.length}</td>
                    <td>{m.activeCount}</td>
                    <td>
                      <span className={`sub-plan-badge ${m.latestPlanType === "monthly" ? "monthly" : "weekly"}`}>
                        {m.latestPlanType === "monthly" ? "Custom / Monthly" : "Weekly Repeat"}
                      </span>
                    </td>
                    <td>{m.latestStartDate !== "—" ? fmtDate(m.latestStartDate) : "—"}</td>
                    <td>
                      <span className={`sub-status-badge ${m.latestStatus}`}>
                        {m.latestStatus.charAt(0).toUpperCase() + m.latestStatus.slice(1)}
                      </span>
                    </td>
                    <td>₹{m.totalSpend}</td>
                  </tr>
                ))}
                <InfiniteScrollLoader
                  sentinelRef={memberSentinelRef}
                  hasMore={memberHasMore}
                  colSpan={8}
                />
              </tbody>
            </table>
            <InfiniteScrollOverlay isLoading={memberIsLoadingMore} />
          </div>
        </>
      )}

      {/* MODAL — SUBSCRIPTION BUILDER (create only; editing an existing
          subscription happens on its own detail page, SubscriptionDetails.js) */}
      {subscriptionModal.shouldRender && (
        <div className={`modal-overlay ${subscriptionModal.overlayClass}`}>
          <form
            className={`event-modal ${subscriptionModal.modalClass} sub-builder-modal`}
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            {/* HEADER */}
            <div className="admin-modal-header">
              <h3>New Subscription</h3>
              <Button3D variant="cancel" iconOnly onClick={resetForm}><img src={closeIcon} alt="" /></Button3D>
            </div>

            {/* BODY — contact fields, then the shared two-column builder
                (left: builder controls, right: Summary + totals). */}
            <div className="admin-modal-body">
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.customerName ? " mat-error" : ""}`}
                      placeholder=" "
                      value={newSubscription.customerName}
                      onChange={(e) => {
                        builder.patchField("customerName", allowTextInput(newSubscription.customerName, e.target.value, 100, 8));
                        setFormErrors(p => ({ ...p, customerName: false }));
                      }}
                    />
                    <label className={`mat-label${formErrors.customerName ? " mat-label-error" : ""}`}>Customer Name<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.customerName ? " mat-bar-error" : ""}`} />
                  </div>
                </div>

                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.customerPhone ? " mat-error" : ""}`}
                      placeholder=" "
                      value={newSubscription.customerPhone}
                      onChange={(e) => {
                        builder.patchField("customerPhone", allowTextInput(newSubscription.customerPhone, e.target.value, 20, 3));
                        setFormErrors(p => ({ ...p, customerPhone: false }));
                      }}
                    />
                    <label className={`mat-label${formErrors.customerPhone ? " mat-label-error" : ""}`}>Phone Number<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.customerPhone ? " mat-bar-error" : ""}`} />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className={`mat-label${formErrors.startDate ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Start Date<span className="rf-req">*</span></label>
                  <CustomDatePicker
                    value={newSubscription.startDate}
                    onChange={(v) => { builder.patchField("startDate", v); setFormErrors(p => ({ ...p, startDate: false })); }}
                    min={todayStr()}
                    placeholder="Select start date"
                    hasError={!!formErrors.startDate}
                  />
                </div>

                <div className="admin-form-group">
                  <CustomDropdown
                    label="Status"
                    value={newSubscription.status}
                    onChange={val => builder.patchField("status", val)}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "paused", label: "Paused" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                    placeholder="Select Status"
                  />
                </div>
              </div>

              <SubBuilderFields builder={builder} formErrors={formErrors} />
            </div>

            {/* FOOTER */}
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
              <Button3D type="submit">Save Subscription</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;