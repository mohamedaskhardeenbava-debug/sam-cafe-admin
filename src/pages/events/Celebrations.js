/**
 * Celebrations.js  —  Sam Cafe Admin Panel
 * Celebrations management page
 */

import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import { DateRangeGroup, MultiPillGroup } from "../../components/FilterBar";
import { todayStr, tomorrowStr } from "../../utils/dateRangeUtils";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../../components/InfiniteScrollLoader";
import Button3D from "../../components/Button3D";
import CollapseChevron from "../../components/CollapseChevron";

import "./Celebrations.css";
import "./EvtCommon.css";
import "../ModalCSS.css";
import "./PreviewModal.css";

const pad = (n) => String(n).padStart(2, "0");

/* Get Together removed */
const CELEBRATION_TYPES = [
  { label: "Birthday", value: "birthday" },
  { label: "Anniversary", value: "anniversary" },
  { label: "Meeting", value: "meeting" },
  { label: "Candle Light Dinner", value: "candlelightdinner" },
];

const CELEBRATION_TYPE_MAP = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  meeting: "Meeting",
  candlelightdinner: "Candle Light Dinner",
};

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

const DECORATION_TIERS = [
  { value: "normal", label: "Normal", price: 1500 },
  { value: "elegant", label: "Elegant", price: 3000 },
  { value: "luxury", label: "Luxury", price: 5000, onlyCandleLight: true },
];
const DECORATION_LABELS = { normal: "Normal", elegant: "Elegant", luxury: "Luxury" };
const DECORATION_PRICES = { normal: 1500, elegant: 3000, luxury: 5000 };

const EXTRA_PRICES = {
  cake: 500, specialMention: 0, standingBrochures: 200, placeHolders: 150, pens: 100,
  mic: 500, projector: 800, candleLight: 800, liveMusic: 2000, surpriseGift: 300,
};
const AV_PRICE = 500;

const EVENT_ADDONS = {
  birthday: [
    { k: "cake", l: "Cake +₹500" },
    { k: "specialMention", l: "Special Mention" },
    { k: "mic", l: "Mic +₹500" },
    { k: "projector", l: "Projector +₹800" },
  ],

  anniversary: [
    { k: "cake", l: "Cake +₹500" },
    { k: "specialMention", l: "Special Mention" },
    { k: "candleLight", l: "Candle Light +₹800" },
    { k: "liveMusic", l: "Live Music +₹2,000" },
    { k: "surpriseGift", l: "Surprise Gift +₹300" },
    { k: "mic", l: "Mic +₹500" },
    { k: "projector", l: "Projector +₹800" },
  ],

  meeting: [
    { k: "standingBrochures", l: "Brochures +₹200" },
    { k: "placeHolders", l: "Place Holders +₹150" },
    { k: "pens", l: "Pens +₹100" },
    { k: "mic", l: "Mic +₹500" },
    { k: "projector", l: "Projector +₹800" },
  ],

  candlelightdinner: [
    { k: "cake", l: "Cake +₹500" },
    { k: "specialMention", l: "Special Mention" },
    { k: "liveMusic", l: "Live Music +₹2,000" },
    { k: "mic", l: "Mic +₹500" },
    { k: "projector", l: "Projector +₹800" },
  ],
};

const calcTotal = (form) => {
  let total = 0;
  if (form.decoration) {
    const tier = DECORATION_TIERS.find(t => t.value === form.decoration);
    if (tier) total += tier.price;
  }
  Object.keys(EXTRA_PRICES).forEach(key => { if (form[key]) total += EXTRA_PRICES[key]; });
  if (form.type !== "meeting" && (form.mic || form.projector)) total += AV_PRICE;
  return total;
};

const SOURCE_OPTIONS = ["User App", "WhatsApp", "Phone", "In Person"];

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", start: "18:30", end: "22:00" },
];

const EMPTY_FORM = {
  type: "birthday",
  name: "", mobile: "", email: "",
  date: "", time: "", slotGroup: "",
  guests: 2,
  birthdayPersonName: "", birthdayPersonAge: "",
  cake: false, specialMention: false, specialMentionText: "",
  standingBrochures: false, placeHolders: false, pens: false,
  mic: false, projector: false,
  candleLight: false, liveMusic: false, surpriseGift: false,
  decoration: null,
  specialNote: "",
  source: "Phone",
  status: "pending",
};

/* ══════════════════════════════════════
   Main Component
══════════════════════════════════════ */
const Celebrations = ({ adminData, setAdminData, filters, patchFilters, onResetFilters }) => {
  // ── State & Setup

  const { fromDate: filterFromDate, toDate: filterToDate, preset: filterDatePreset, types: filterTypes, statuses: filterStatuses, search } = filters;

  // ── Helpers

  const setFilterFromDate = (v) => patchFilters({ fromDate: v });
  const setFilterToDate = (v) => patchFilters({ toDate: v });
  const setFilterDatePreset = (v) => patchFilters({ preset: v });
  const setFilterTypes = (v) => patchFilters({ types: typeof v === "function" ? v(filterTypes) : v });
  const setFilterStatuses = (v) => patchFilters({ statuses: typeof v === "function" ? v(filterStatuses) : v });
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const setSearch = (v) => patchFilters({ search: v });
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [createTab, setCreateTab] = useState(0);
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [callTooltipPos, setCallTooltipPos] = useState({ top: 0, left: 0 });
  const callWrapRefs = useRef({});

  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const CREATE_TABS = ["All Details", "Preview"];

  const validateCelebTab0 = () => {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) e.mobile = true;
    if (!form.date) e.date = true;
    if (!form.time) e.time = true;
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };


  const data = adminData?.celebrations || [];

  /* ─── Filter ─── */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterFromDate) d = d.filter(item => (item.date || "") >= filterFromDate);
    if (filterToDate) d = d.filter(item => (item.date || "") <= filterToDate);
    if (filterTypes.size > 0) d = d.filter(item => filterTypes.has(item.type));
    if (filterStatuses.size > 0) d = d.filter(item => filterStatuses.has(item.status || "pending"));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(item =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.mobile || "").includes(q) ||
        (item.id || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filterFromDate, filterToDate, filterTypes, filterStatuses, search]);

  const today = todayStr();
  const pendingCount = filteredData.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = filteredData.filter(r => r.status === "confirmed").length;
  const completedCount = filteredData.filter(r => r.status === "completed").length;
  const cancelledCount = filteredData.filter(r => r.status === "cancelled").length;

  const sortedData = useMemo(() => {
    const d = [...filteredData];
    d.sort((a, b) => {
      let va, vb;
      if (sortField === "createdAt") {
        va = new Date(a.createdAt || ""); vb = new Date(b.createdAt || "");
      } else if (sortField === "date") {
        va = new Date(a.date || ""); vb = new Date(b.date || "");
      } else if (sortField === "guests" || sortField === "totalAmount") {
        va = Number(a[sortField] || 0); vb = Number(b[sortField] || 0);
      } else {
        va = (a[sortField] || "").toString().toLowerCase();
        vb = (b[sortField] || "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return d;
  }, [filteredData, sortField, sortDir]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(sortedData.length, 30);

  /* ─── Inline status update ─── */
  const updateStatus = async (e, id, newStatus) => {
    e.stopPropagation();
    const prev = (adminData?.celebrations || []).find(c => c.id === id);
    if (!prev) return;
    setAdminData(p => ({
      ...p,
      celebrations: (p.celebrations || []).map(c => c.id === id ? { ...c, status: newStatus } : c),
    }));
    try {
      try { await api.patch(`/celebrations/${id}`, { status: newStatus }); }
      catch { await api.put(`/celebrations/${id}`, { ...prev, status: newStatus }); }
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      setAdminData(p => ({
        ...p,
        celebrations: (p.celebrations || []).map(c => c.id === id ? prev : c),
      }));
      toast.error("Failed to update status");
    }
  };

  /* ─── Call logging — persisted to JSON ─── */
  const handleCall = async (e, id) => {
    e.stopPropagation();
    const prev = (adminData?.celebrations || []).find(c => c.id === id);
    if (!prev) return;
    const newEntry = new Date().toISOString();
    const updatedHistory = [...(prev.callHistory || []), newEntry];
    /* optimistic update */
    if (typeof setAdminData === "function") {
      setAdminData(p => ({
        ...p,
        celebrations: (p.celebrations || []).map(c =>
          c.id === id ? { ...c, callHistory: updatedHistory } : c
        ),
      }));
    }
    try {
      try { await api.patch(`/celebrations/${id}`, { callHistory: updatedHistory }); }
      catch { await api.put(`/celebrations/${id}`, { ...prev, callHistory: updatedHistory }); }
      toast.success("Call logged!");
    } catch {
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          celebrations: (p.celebrations || []).map(c => c.id === id ? prev : c),
        }));
      }
      toast.error("Failed to log call");
    }
  };

  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  /* ─── Form helpers ─── */
  const setF = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormErrors(e => ({ ...e, [key]: "" })); };

  /* When type changes, strip luxury if not candlelightdinner */
  const setType = (val) => {
    setForm(p => ({
      ...p,
      type: val,

      // reset all event-specific add-ons
      cake: false,
      specialMention: false,
      specialMentionText: "",
      candleLight: false,
      liveMusic: false,
      surpriseGift: false,
      standingBrochures: false,
      placeHolders: false,
      pens: false,

      // reset birthday-specific fields
      birthdayPersonName: "",
      birthdayPersonAge: "",

      // reset time/slot
      time: "",
      slotGroup: "",

      // reset luxury if not candlelight dinner
      decoration:
        val !== "candlelightdinner" && p.decoration === "luxury"
          ? null
          : p.decoration,
    }));

    setFormErrors(e => ({
      ...e,
      type: "",
      birthdayPersonName: "",
    }));
  };

  const isCandleLight = form.type === "candlelightdinner";
  const estimatedTotal = calcTotal(form);

  const validateTab = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) e.mobile = "Valid 10-digit number";
    if (Number(form.guests) > 20) e.guests = "Maximum 20 guests for celebration";
    if (!form.date) e.date = "Date required";
    if (!form.time) e.time = "Time required";
    if (!form.type) e.type = "Select event type";
    if (form.type === "birthday" && !form.birthdayPersonName.trim()) e.birthdayPersonName = "Birthday person name required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreateNext = () => {
    if (!validateTab()) return;
    setCreateTab(1);
  };

  const validateForm = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) e.mobile = "Valid 10-digit number";
    if (!form.date) e.date = "Date required";
    if (!form.time) e.time = "Time required";
    if (!form.type) e.type = "Select event type";
    if (Number(form.guests) > 20) e.guests = "Maximum 20 guests for celebration";
    if (form.type === "birthday" && !form.birthdayPersonName.trim()) e.birthdayPersonName = "Birthday person name required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const id = `cele_${Date.now()}`;
      const payload = {
        id,
        ...form,
        totalAmount: estimatedTotal,
        status: form.status || "pending",
        createdAt: new Date().toISOString(),
      };
      await api.post("/celebrations", payload);
      toast.success("Celebration created successfully.");
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
    } catch {
      toast.error("Failed to create celebration.");
    } finally {
      setSaving(false);
    }
  };

  const isDefaultFilter = filterFromDate === todayStr() && filterToDate === todayStr() && filterDatePreset === "today" && filterTypes.size === 0 && filterStatuses.size === 0 && !search.trim();
  const activeFilters = !isDefaultFilter;

  const handleExport = () => {
    if (!sortedData.length) { toast.warning("No celebrations to export"); return; }
    const rows = sortedData.map(item => ({
      Name: item.name || "—",
      Mobile: item.mobile || "—",
      Email: item.email || "—",
      Type: CELEBRATION_TYPE_MAP[item.type] || item.type || "—",
      Date: item.date || "—",
      Time: item.time || "—",
      Guests: item.guests ?? "—",
      Decoration: item.decoration || "—",
      "Total Amount": item.totalAmount ? `₹${Number(item.totalAmount).toLocaleString("en-IN")}` : "—",
      Status: item.status || "—",
      Source: item.source || "—",
    }));
    const suffix = filterFromDate && filterToDate
      ? `${filterFromDate}_to_${filterToDate}`
      : filterFromDate || filterToDate || "all";
    exportToExcel({ rows, sheetName: "Celebrations", fileName: `celebrations_${suffix}.xlsx` });
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="evt-header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              title={headerCollapsed ? "Expand header" : "Collapse header"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="evt-title">Celebrations</h2>
              <span className="result-count">{sortedData.length} celebration{sortedData.length === 1 ? "" : "s"}</span>
            </div>
            <p className="evt-subtitle">Manage event & celebration bookings</p>
          </div>
        </div>

        {!headerCollapsed && (
          <>
            {/* KPI STRIP */}
            <div className="evt-kpi-row">
              {[
                { label: "Total", val: filteredData.length, color: "#111" },
                { label: "Pending", val: pendingCount, color: "#ca8a04" },
                { label: "Confirmed", val: confirmedCount, color: "#16a34a" },
                { label: "Completed", val: completedCount, color: "#2980b9" },
                { label: "Cancelled", val: cancelledCount, color: "#dc2626" },
              ].map((k, i) => (
                <div key={i} className="evt-kpi" style={{ borderTopColor: k.color }}>
                  <div className="evt-kpi-val" style={{ color: k.color }}>{k.val}</div>
                  <div className="evt-kpi-label">{k.label}</div>
                </div>
              ))}
            </div>

            <div className="header-btn-container">
              <Button3D onClick={handleExport}>Export</Button3D>
              <Button3D onClick={() => { setShowCreate(true); setForm({ ...EMPTY_FORM }); setCreateTab(0); }}>+ Add Celebration</Button3D>
            </div>
          </>
        )}
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder="Search name / mobile / ID..."
              value={search}
              onChange={e => setSearch(allowTextInput(search, e.target.value, 100, 5))}
            />

            <DateRangeGroup
              from={filterFromDate}
              to={filterToDate}
              onChangeFrom={setFilterFromDate}
              onChangeTo={setFilterToDate}
              preset={filterDatePreset}
              onChangePreset={setFilterDatePreset}
              presets={[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]]}
              noMax
            />
            {(filterFromDate || filterToDate) && (
              <button className="filter-pill" title="Clear dates" onClick={() => { setFilterFromDate(""); setFilterToDate(""); setFilterDatePreset(""); }}>✕</button>
            )}

          </div>
          <div className="filter-groups">
            <MultiPillGroup
              label="Type"
              options={CELEBRATION_TYPES.map(t => [t.value, t.label.slice(0, 3), "", t.label])}
              value={filterTypes}
              onToggle={(key) => toggleSet(setFilterTypes, key)}
            />
            <MultiPillGroup
              label="Status"
              options={[
                ["pending", "P", "clb-status-pending", "Pending"],
                ["confirmed", "C", "clb-status-confirmed", "Confirmed"],
                ["completed", "D", "clb-status-completed", "Done"],
                ["cancelled", "X", "clb-status-cancelled", "Cancelled"],
              ]}
              value={filterStatuses}
              onToggle={(key) => toggleSet(setFilterStatuses, key)}
            />
            {activeFilters && (
              <button className="evt-clb-clear-btn" onClick={onResetFilters}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="table-wrapper" style={{ maxHeight: headerCollapsed ? "calc(100vh - 120px)" : "calc(100vh - 300px)" }} ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className={sortField === "name" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Guest</span>
                  <span className="sort-arrow">{sortField === "name" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Contact</th>
              <th onClick={() => handleSort("type")} className={sortField === "type" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Type</span>
                  <span className="sort-arrow">{sortField === "type" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th onClick={() => handleSort("date")} className={sortField === "date" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Date</span>
                  <span className="sort-arrow">{sortField === "date" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Time</th>
              <th onClick={() => handleSort("guests")} className={sortField === "guests" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Guests</span>
                  <span className="sort-arrow">{sortField === "guests" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Decoration</th>
              <th>Extras</th>
              <th onClick={() => handleSort("totalAmount")} className={sortField === "totalAmount" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Est. Total</span>
                  <span className="sort-arrow">{sortField === "totalAmount" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th onClick={() => handleSort("status")} className={sortField === "status" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Status</span>
                  <span className="sort-arrow">{sortField === "status" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="11" className="evt-clb-empty">No celebrations found</td></tr>
            ) : (
              sortedData.slice(0, displayLimit).map(item => {
                const typeLabel = CELEBRATION_TYPE_MAP[item.type] || item.type || "—";
                const status = item.status || "pending";
                const displayTotal = item.totalAmount || calcTotal(item);

                const extras = [];
                if (item.cake) extras.push("Cake");
                if (item.specialMention) extras.push("Mention");
                if (item.candleLight) extras.push("Candle");
                if (item.liveMusic) extras.push("Music");
                if (item.surpriseGift) extras.push("Gift");
                if (item.mic) extras.push("Mic");
                if (item.projector) extras.push("Projector");
                if (item.standingBrochures) extras.push("Brochures");
                if (item.placeHolders) extras.push("Holders");
                if (item.pens) extras.push("Pens");

                return (
                  <tr key={item.id} >
                    <td>
                      <span>
                        <span
                          className="evt-clb-name"
                          key={item.id} className="clickable"
                          onClick={() => navigate(`/celebrations/${item.id}`, { state: { fromDetail: true } })}
                        >
                          {item.name || "—"}
                        </span>
                        <div className="evt-clb-id-small">#{(item.id || "").slice(-6)}</div>
                      </span>
                    </td>
                    <td>
                      <div className="evt-clb-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-clb-email">{item.email}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`evt-clb-type-badge evt-clb-type-${item.type || "birthday"}`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.date || "—"}</td>
                    <td>{fmtTime(item.time)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.guests || "—"}</td>
                    <td>
                      {item.decoration ? (
                        <span className={`evt-clb-deco-badge deco-${item.decoration}`}>
                          {DECORATION_LABELS[item.decoration]} <span style={{ fontSize: 10, opacity: 0.7 }}>₹{DECORATION_PRICES[item.decoration]?.toLocaleString()}</span>
                        </span>
                      ) : <span style={{ color: "#aaa", fontSize: 12 }}>None</span>}
                    </td>
                    <td>
                      <div className="evt-clb-extras-cell">
                        {extras.length > 0
                          ? extras.slice(0, 3).map((e, i) => <span key={i} className="evt-clb-extra-tag">{e}</span>)
                          : <span style={{ color: "#aaa", fontSize: 12 }}>None</span>}
                        {extras.length > 3 && <span className="evt-clb-extra-tag">+{extras.length - 3}</span>}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: "#111" }}>
                      {displayTotal > 0 ? `₹${displayTotal.toLocaleString()}` : <span style={{ color: "#aaa" }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-res-inline-status">
                        {["pending", "confirmed", "completed", "cancelled"].map(s => (
                          <button key={s} title={s}
                            className={`evt-res-istatus-btn evt-res-istatus-${s}${status === s ? " active" : ""}`}
                            onClick={e => updateStatus(e, item.id, s)}>
                            {s === "pending" ? "P" : s === "confirmed" ? "C" : s === "completed" ? "D" : "X"}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Actions — Call + Call History */}
                    <td onClick={e => e.stopPropagation()}>
                      {(() => {
                        const history = item.callHistory || [];
                        return (
                          <div className="evt-pre-call-wrap"
                            ref={el => { callWrapRefs.current[item.id] = el; }}
                            onMouseEnter={() => {
                              if (history.length > 0) {
                                const el = callWrapRefs.current[item.id];
                                if (el) {
                                  const r = el.getBoundingClientRect();
                                  setCallTooltipPos({ top: r.top, left: r.left, width: r.width });
                                }
                                setCallTooltipId(item.id);
                              }
                            }}
                            onMouseLeave={() => setCallTooltipId(null)}>
                            <Button3D variant="cancel" iconOnly onClick={e => handleCall(e, item.id)}>📞 Call{history.length > 0 ? ` (${history.length})` : ""}</Button3D>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={11}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>

      {/* ── Call History Portal Tooltip ── */}
      {callTooltipId && createPortal(
        (() => {
          const histItem = (adminData?.celebrations || []).find(x => x.id === callTooltipId);
          const hist = histItem?.callHistory || [];
          if (!hist.length) return null;
          return (
            <div
              className="evt-pre-call-tooltip"
              style={{
                position: "fixed",
                top: callTooltipPos.top,
                left: callTooltipPos.left - 20,
                transform: "translate(-50%, calc(-100% - 10px))",
                zIndex: 99999,
                pointerEvents: "none",
              }}
            >
              <div className="evt-pre-call-tooltip-title">📞 Call History</div>
              {hist.map((ts, i) => (
                <div key={i} className="evt-pre-call-tooltip-row">{fmtDateTime(ts)}</div>
              ))}
            </div>
          );
        })(),
        document.body
      )}

      {showCreate && (
        <div className="event-modal-overlay">
          <div className="event-modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3>Add Celebration</h3>
                <div className="ecard">
                  {CREATE_TABS.map((t, i) => (
                    <button key={i}
                      className={`ebutton${createTab === i ? " active" : ""}${createTab > i ? " done" : ""}`}
                      onClick={() => {
                        if (i > createTab && !validateCelebTab0()) return;
                        setCreateTab(i);
                      }}>
                      <span className="eevt-step-num">{createTab > i ? "✓" : i + 1}</span>
                      <span className="eevt-step-label">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => { setShowCreate(false); setFormErrors({}); }}><img src={closeIcon} /></Button3D>
            </div>

            <div className="event-modal-body" style={{ padding: "8px 0" }}>

              {/* ── TAB 0: Event Type & Add-ons ── */}
              {createTab === 0 && (
                <>
                  <div className="evt-res-form-section-label">Event Type <span className="evt-res-req">*</span></div>
                  <div className="admin-form-group">
                    <div className="evt-res-source-chips">
                      {CELEBRATION_TYPES.map(t => (
                        <button key={t.value} type="button"
                          className={`evt-res-source-chip${form.type === t.value ? " active" : ""}`}
                          onClick={() => { setType(t.value); setFormErrors(p => ({ ...p, type: false })); }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {formErrors.type && <span style={{ fontSize: 11, color: "var(--color-red, #ee5253)", marginTop: 4, display: "block" }}>Please select an event type</span>}
                  </div>

                  <div className="evt-res-form-section-label">Add-ons</div>
                  <div className="admin-form-group">
                    <div className="evt-res-source-chips">
                      {(EVENT_ADDONS[form.type] || []).map(ex => (
                        <button key={ex.k} type="button"
                          className={`evt-res-source-chip${form[ex.k] ? " active" : ""}`}
                          onClick={() => setF(ex.k, !form[ex.k])}>
                          {ex.l}
                        </button>
                      ))}
                    </div>
                    {form.specialMention && (
                      <div className="mat-area" style={{ marginTop: 8 }}>
                        <textarea className="mat-input mat-textarea" rows={2} placeholder=" "
                          value={form.specialMentionText}
                          onChange={e => setF("specialMentionText", allowTextInput(form.specialMentionText, e.target.value, 500, 100000))} />
                        <label className="mat-area-label">Describe what to announce / mention...</label>
                        <span className="mat-area-bar" />
                      </div>
                    )}
                  </div>

                  <div className="evt-res-form-section-label">Source & Status</div>
                  <div className="horizontal-form-group">
                    <div className="admin-form-group" style={{ flex: 1 }}>
                      <label>Source</label>
                      <div className="evt-res-source-chips">
                        {SOURCE_OPTIONS.map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip${form.source === s ? " active" : ""}`}
                            onClick={() => setF("source", s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                      <label>Status</label>
                      <div className="evt-res-source-chips">
                        {["pending", "confirmed"].map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip${form.status === s ? " active status-" + s : ""}`}
                            onClick={() => setF("status", s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="evt-res-form-section-label">Guest Information</div>
                  <div className="horizontal-form-group">
                    <div className="admin-form-group" style={{ flex: 1.4 }}>
                      <div className="mat">
                        <input className={`mat-input${formErrors.name ? " mat-error" : ""}`} placeholder=" "
                          value={form.name} onChange={e => { setF("name", allowTextInput(form.name, e.target.value, 100, 5)); setFormErrors(p => ({ ...p, name: false })); }} />
                        <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Name <span className="evt-res-req">*</span></label>
                        <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                      <label className={formErrors.guests ? "mat-label-error" : ""}>Guests <span style={{ fontSize: 10, color: "#aaa" }}>(max 20)</span></label>
                      <div className={`evt-stepper${formErrors.guests ? " error" : ""}`}>
                        <button type="button" onClick={() => { setF("guests", Math.max(1, form.guests - 1)); setFormErrors(p => ({ ...p, guests: false })); }}>−</button>
                        <span>{form.guests}</span>
                        <button type="button" onClick={() => { setF("guests", Math.min(20, form.guests + 1)); setFormErrors(p => ({ ...p, guests: false })); }}>+</button>
                      </div>
                      {formErrors.guests && <span style={{ fontSize: 11, color: "var(--color-red, #ee5253)", marginTop: 4, display: "block" }}>Maximum 20 guests allowed</span>}
                    </div>
                  </div>

                  <div className="horizontal-form-group">
                    <div className="admin-form-group" style={{ flex: 1 }}>
                      <div className="mat">
                        <input className={`mat-input${formErrors.mobile ? " mat-error" : ""}`} placeholder=" " type="tel"
                          value={form.mobile} onChange={e => { setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10)); setFormErrors(p => ({ ...p, mobile: false })); }} />
                        <label className={`mat-label${formErrors.mobile ? " mat-label-error" : ""}`}>Mobile <span className="evt-res-req">*</span></label>
                        <span className={`mat-bar${formErrors.mobile ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                      <div className="mat">
                        <input className="mat-input" placeholder=" "
                          value={form.email} onChange={e => setF("email", allowTextInput(form.email, e.target.value, 100, 5))} />
                        <label className="mat-label">Email</label>
                        <span className="mat-bar" />
                      </div>
                    </div>
                  </div>

                  {form.type === "birthday" && (
                    <>
                      <div className="evt-res-form-section-label">Birthday Details</div>
                      <div className="horizontal-form-group">
                        <div className="admin-form-group" style={{ flex: 1.5 }}>
                          <div className="mat">
                            <input className={`mat-input${formErrors.birthdayPersonName ? " mat-error" : ""}`} placeholder=" " value={form.birthdayPersonName}
                              onChange={e => { setF("birthdayPersonName", allowTextInput(form.birthdayPersonName, e.target.value, 100, 5)); setFormErrors(p => ({ ...p, birthdayPersonName: false })); }} />
                            <label className={`mat-label${formErrors.birthdayPersonName ? " mat-label-error" : ""}`}>Birthday Person's Name <span className="evt-res-req">*</span></label>
                            <span className={`mat-bar${formErrors.birthdayPersonName ? " mat-bar-error" : ""}`} />
                          </div>
                        </div>
                        <div className="admin-form-group" style={{ flex: 1 }}>
                          <div className="mat">
                            <input className="mat-input" type="number" min="1" max="120" placeholder=" "
                              value={form.birthdayPersonAge} onChange={e => setF("birthdayPersonAge", e.target.value)} />
                            <label className="mat-label">Age (optional)</label>
                            <span className="mat-bar" />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="admin-form-group" style={{ marginTop: 4 }}>
                    <div className="mat-area">
                      <textarea className="mat-input mat-textarea" rows={2} placeholder=" "
                        value={form.specialNote} onChange={e => setF("specialNote", allowTextInput(form.specialNote, e.target.value, 500, 100000))} />
                      <label className="mat-area-label">Special Notes</label>
                      <span className="mat-area-bar" />
                    </div>
                  </div>

                  <div className="evt-res-form-section-label">Date & Time</div>
                  <div className="admin-form-group">
                    <label className={formErrors.date ? "mat-label-error" : ""}>Event Date <span className="evt-res-req">*</span></label>
                    <CustomDatePicker value={form.date} min={tomorrowStr()} onChange={v => { setF("date", v); setF("time", ""); setF("slotGroup", ""); setFormErrors(p => ({ ...p, date: false })); }} placeholder="Select date" hasError={!!formErrors.date} />
                  </div>

                  <div className="admin-form-group">
                    <label>Dining Slot <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(select to restrict time picker)</span></label>
                    <div className="evt-res-pref-grid">
                      {SLOT_GROUPS.map(sg => (
                        <button key={sg.key} type="button"
                          className={`evt-res-pref-card${form.slotGroup === sg.key ? " active" : ""}`}
                          onClick={() => {
                            const next = form.slotGroup === sg.key ? "" : sg.key;
                            setF("slotGroup", next);
                            setF("time", "");
                          }}>
                          <span className="evt-res-slot-chip-label">{sg.label}</span>
                          <span className="evt-res-slot-chip-time">{sg.start}–{sg.end}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.slotGroup ? (
                    <div className="admin-form-group">
                      <label className={formErrors.time ? "mat-label-error" : ""}>
                        Time <span className="evt-res-req">*</span>
                        {(() => { const sg = SLOT_GROUPS.find(s => s.key === form.slotGroup); return sg ? <span style={{ fontSize: 11, color: "#2980b9", fontWeight: 500, marginLeft: 6 }}>({sg.start}–{sg.end})</span> : null; })()}
                      </label>
                      <CustomTimePicker
                        value={form.time}
                        onChange={v => { setF("time", v); setFormErrors(p => ({ ...p, time: false })); }}
                        slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                        slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                        isToday={false}
                        hasError={!!formErrors.time}
                      />
                    </div>
                  ) : (
                    <div className="admin-form-group">
                      <span style={{ fontSize: 11, color: "#aaa", marginTop: 4, display: "block" }}>Select a dining slot first to enable time picker</span>
                    </div>
                  )}

                  <div className="evt-res-form-section-label">Decoration</div>
                  <div className="admin-form-group">
                    <div className="evt-res-source-chips">
                      <button type="button"
                        className={`evt-res-source-chip${!form.decoration ? " active" : ""}`}
                        onClick={() => setF("decoration", null)}>None</button>
                      {DECORATION_TIERS.map(d => {
                        const disabled = d.onlyCandleLight && !isCandleLight;
                        return (
                          <button key={d.value} type="button"
                            className={`evt-res-source-chip${form.decoration === d.value ? " active" : ""}${disabled ? " chip-disabled" : ""}`}
                            title={disabled ? "Only for Candle Light Dinner" : ""}
                            onClick={() => !disabled && setF("decoration", d.value)}>
                            {d.label} ₹{d.price.toLocaleString()}
                            {disabled && " 🔒"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {estimatedTotal > 0 && (
                    <div style={{ margin: "8px 0", padding: "10px 14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#166534", fontWeight: 600 }}>Estimated Total</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>₹{estimatedTotal.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}

              {/* ── TAB 1: Preview ── */}
              {createTab === 1 && (() => {
                const extras = [];
                if (form.cake) extras.push("Cake +₹500");
                if (form.specialMention) extras.push("Special Mention");
                if (form.candleLight) extras.push("Candle Light +₹800");
                if (form.liveMusic) extras.push("Live Music +₹2,000");
                if (form.surpriseGift) extras.push("Surprise Gift +₹300");
                if (form.mic) extras.push("Mic +₹500");
                if (form.projector) extras.push("Projector +₹800");
                if (form.standingBrochures) extras.push("Brochures +₹200");
                if (form.placeHolders) extras.push("Holders +₹150");
                if (form.pens) extras.push("Pens +₹100");
                const typeLabel = CELEBRATION_TYPE_MAP[form.type] || form.type || "—";
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Summary header */}
                    <div style={{ background: "linear-gradient(135deg,#f8fafc,#f0fdf4)", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#ff9f43,#ee5253)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
                        {(form.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{form.name || "—"}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{form.mobile || "—"} {form.email ? `· ${form.email}` : ""}</div>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        <span className={`evt-clb-type-badge evt-clb-type-${form.type || "birthday"}`} style={{ fontSize: 12 }}>{typeLabel}</span>
                        <span className={`evt-clb-status evt-clb-status-${form.status}`}>{form.status}</span>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="prv-section">
                      <div className="prv-section-title">Event Details</div>
                      <div className="prv-grid">
                        {[
                          ["Date", form.date || "—"],
                          ["Time", fmtTime(form.time)],
                          ["Guests", form.guests ?? "—"],
                          ["Type", typeLabel],
                          ["Decoration", form.decoration ? `${DECORATION_LABELS[form.decoration]} (₹${DECORATION_PRICES[form.decoration]?.toLocaleString()})` : "None"],
                          ["Source", form.source || "—"],
                        ].map(([l, v]) => (
                          <div key={l} className="prv-cell">
                            <div className="prv-cell-label">{l}</div>
                            <div className="prv-cell-val">{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Birthday details if applicable */}
                    {form.type === "birthday" && form.birthdayPersonName && (
                      <div className="prv-section">
                        <div className="prv-section-title">Birthday Details</div>
                        <div className="prv-grid prv-grid-2">
                          {[["Birthday Person", form.birthdayPersonName], ["Age", form.birthdayPersonAge || "—"]].map(([l, v]) => (
                            <div key={l} className="prv-cell"><div className="prv-cell-label">{l}</div><div className="prv-cell-val">{v}</div></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add-ons */}
                    <div className="prv-section">
                      <div className="prv-section-title">Add-ons & Extras</div>
                      {extras.length === 0
                        ? <div className="prv-empty">No add-ons selected</div>
                        : <div className="prv-tags">{extras.map((e, i) => <span key={i} className="prv-tag green">{e}</span>)}</div>
                      }
                    </div>

                    {/* Special mention text */}
                    {form.specialMention && form.specialMentionText && (
                      <div className="prv-section">
                        <div className="prv-section-title">Special Mention Text</div>
                        <div className="prv-notes">{form.specialMentionText}</div>
                      </div>
                    )}

                    {/* Notes */}
                    {form.specialNote && (
                      <div className="prv-section">
                        <div className="prv-section-title">Special Notes</div>
                        <div className="prv-notes">{form.specialNote}</div>
                      </div>
                    )}

                    {/* Total */}
                    {estimatedTotal > 0 && (
                      <div className="prv-total-bar">
                        <span className="prv-total-label">Estimated Total</span>
                        <span className="prv-total-val">₹{estimatedTotal.toLocaleString()}</span>
                      </div>
                    )}

                    {/* Validation warnings */}
                    {(!form.name.trim() || !form.mobile || !form.date || !form.time) && (
                      <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e" }}>
                        Please fill all required fields before creating.{" "}
                        {!form.name.trim() && "Name, "}
                        {(!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) && "Mobile, "}
                        {!form.date && "Date, "}
                        {!form.time && "Time "}
                        {" "}missing.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="event-modal-footer">
              <Button3D variant="cancel" onClick={() => { setShowCreate(false); setFormErrors({}); }}>Cancel</Button3D>
              {createTab === 0 ? (
                <button type="button" className="modal-next-btn" onClick={() => {
                  if (validateCelebTab0()) handleCreateNext();
                }}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">Preview →</span>
                </button>
              ) : (
                <>
                  <button type="button" className="modal-prev-btn" onClick={() => setCreateTab(0)}>
                    <span className="shadow"></span><span className="edge"></span>
                    <span className="front">← Edit</span>
                  </button>
                  <Button3D onClick={handleCreate} disabled={saving}>{saving ? "Saving..." : "Create Celebration"}</Button3D>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Celebrations;