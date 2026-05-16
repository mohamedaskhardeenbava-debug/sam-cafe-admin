/* admin panel */
import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Celebrations.css";
import "./PreviewModal.css";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; };

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

const EMPTY_FORM = {
  type: "birthday",
  name: "", mobile: "", email: "",
  date: "", time: "",
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
const Celebrations = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [createTab, setCreateTab] = useState(0);
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [callTooltipPos, setCallTooltipPos] = useState({ top: 0, left: 0 });
  const callWrapRefs = useRef({});

  const CREATE_TABS = ["All Details", "Preview"];

  const data = adminData?.celebrations || [];

  const today = todayStr();
  const todayCount = data.filter(r => r.date === today).length;
  const pendingCount = data.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = data.filter(r => r.status === "confirmed").length;

  /* ─── Filter ─── */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterDate) d = d.filter(item => item.date === filterDate);
    if (filterType) d = d.filter(item => item.type === filterType);
    if (filterStatus) d = d.filter(item => (item.status || "pending") === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(item =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.mobile || "").includes(q) ||
        (item.id || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filterDate, filterType, filterStatus, search]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filteredData]);

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
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, celebrations: [...(p.celebrations || []), payload] }));
      }
      toast.success("Celebration created successfully.");
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
    } catch {
      toast.error("Failed to create celebration.");
    } finally {
      setSaving(false);
    }
  };

  const activeFilters = filterDate || filterType || filterStatus || search.trim();

  const exportToExcel = () => {
    if (!sortedData.length) { alert("No celebrations to export"); return; }
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
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Celebrations");
    XLSX.writeFile(wb, `celebrations_${filterDate || "all"}.xlsx`);
  };

  return (
    <div className="evt-clb-page">

      {/* HEADER */}
      <div className="evt-clb-header">
        <div>
          <h2 className="evt-clb-title">Celebrations</h2>
          <p className="evt-clb-subtitle">Manage event & celebration bookings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="orders-export-btn" onClick={exportToExcel}>Export</button>
          <button className="evt-res-create-btn" onClick={() => { setShowCreate(true); setForm({ ...EMPTY_FORM }); setCreateTab(0); }}>
            + Add Celebration
          </button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="evt-clb-kpi-row">
        {[
          { label: "Total", val: data.length, color: "#111" },
          { label: "Today", val: todayCount, color: "#2980b9" },
          { label: "Pending", val: pendingCount, color: "#ca8a04" },
          { label: "Confirmed", val: confirmedCount, color: "#16a34a" },
        ].map((k, i) => (
          <div key={i} className="evt-clb-kpi" style={{ borderTopColor: k.color }}>
            <div className="evt-clb-kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="evt-clb-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="evt-clb-filter-bar">
        <input
          className="evt-clb-search"
          placeholder="Search name / mobile / ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="evt-clb-filter-groups">
          <div className="evt-res-filter-group" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="evt-res-filter-group-label">Date</span>
            <div style={{ minWidth: 160 }}>
              <CustomDatePicker value={filterDate} onChange={setFilterDate} placeholder="All dates" />
            </div>
            {filterDate && (
              <button className="evt-clb-filter-btn" title="Clear date" onClick={() => setFilterDate("")}>✕</button>
            )}
          </div>
          <div className="evt-clb-filter-group">
            <span className="evt-clb-filter-group-label">Type</span>
            {CELEBRATION_TYPES.map(t => (
              <button key={t.value} title={t.label}
                className={`evt-clb-filter-btn${filterType === t.value ? " active" : ""}`}
                onClick={() => setFilterType(p => p === t.value ? "" : t.value)}>
                {t.label.slice(0, 3)}
              </button>
            ))}
          </div>
          <div className="evt-clb-filter-group">
            <span className="evt-clb-filter-group-label">Status</span>
            {["pending", "confirmed", "completed"].map(s => (
              <button key={s} title={s}
                className={`evt-clb-filter-btn${filterStatus === s ? " active clb-status-" + s : ""}`}
                onClick={() => setFilterStatus(p => p === s ? "" : s)}>
                {s === "pending" ? "P" : s === "confirmed" ? "C" : "D"}
              </button>
            ))}
          </div>
          {activeFilters && (
            <button className="evt-clb-clear-btn" onClick={() => {
              setFilterDate(todayStr()); setFilterType(""); setFilterStatus(""); setSearch("");
            }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-clb-table-wrapper">
        <table className="evt-clb-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Date</th>
              <th>Time</th>
              <th>Guests</th>
              <th>Decoration</th>
              <th>Extras</th>
              <th>Est. Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="11" className="evt-clb-empty">No celebrations found</td></tr>
            ) : (
              sortedData.map(item => {
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
                  <tr key={item.id} className="evt-clb-row clickable"
                    onClick={() => navigate(`/celebrations/${item.id}`)}>
                    <td>
                      <div className="evt-clb-name-cell">
                        <div className="evt-clb-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="evt-clb-name">{item.name || "—"}</div>
                          <div className="evt-clb-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
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
                            <button className="evt-pre-act-btn" onClick={e => handleCall(e, item.id)}>
                              📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
        <div className="event-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="event-modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
            <div className="event-modal-header">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <h3>Add Celebration</h3>
                <div className="ae-spec-steps">
                  {CREATE_TABS.map((t, i) => (
                    <button key={i}
                      className={`ae-spec-step${createTab === i ? " active" : ""}${createTab > i ? " done" : ""}`}
                      onClick={() => setCreateTab(i)}>
                      <span className="ae-step-num">{createTab > i ? "✓" : i + 1}</span>
                      <span className="ae-step-label">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="ingredient-close-btn" onClick={() => setShowCreate(false)} />
            </div>

            <div className="event-modal-body" style={{ padding: "8px 0" }}>

              {/* ── TAB 0: Event Type & Add-ons ── */}
              {createTab === 0 && (
                <>
                  <div className="evt-res-form-section-label">Event Type</div>
                  <div className="form-group">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {CELEBRATION_TYPES.map(t => (
                        <button key={t.value} type="button"
                          className={`evt-res-source-chip${form.type === t.value ? " active" : ""}`}
                          onClick={() => setType(t.value)}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {formErrors.type && <span className="evt-res-form-error">{formErrors.type}</span>}
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Add-ons</div>
                  <div className="form-group">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(EVENT_ADDONS[form.type] || []).map(ex => (
                        <button key={ex.k} type="button"
                          className={`evt-res-source-chip${form[ex.k] ? " active" : ""}`}
                          onClick={() => setF(ex.k, !form[ex.k])}>
                          {ex.l}
                        </button>
                      ))}
                    </div>
                    {form.specialMention && (
                      <textarea rows={2} style={{ marginTop: 8, width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                        placeholder="Describe what to announce / mention..."
                        value={form.specialMentionText}
                        onChange={e => setF("specialMentionText", e.target.value)} />
                    )}
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Source & Status</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Source</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {SOURCE_OPTIONS.map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip${form.source === s ? " active" : ""}`}
                            onClick={() => setF("source", s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Status</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Guest Information</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1.4 }}>
                      <label>Name <span className="evt-res-req">*</span></label>
                      <input className={formErrors.name ? "error" : ""}
                        placeholder="Guest name" value={form.name}
                        onChange={e => setF("name", e.target.value)} />
                      {formErrors.name && <span className="evt-res-form-error">{formErrors.name}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Guests <span style={{ fontSize: 10, color: "#aaa" }}>(max 20)</span></label>
                      <div className="evt-res-stepper">
                        <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                        <span>{form.guests}</span>
                        <button type="button" onClick={() => setF("guests", Math.min(20, form.guests + 1))}>+</button>
                      </div>
                      {formErrors.guests && <span className="evt-res-form-error">{formErrors.guests}</span>}
                    </div>
                  </div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Mobile <span className="evt-res-req">*</span></label>
                      <input className={formErrors.mobile ? "error" : ""}
                        placeholder="10-digit number" type="tel"
                        value={form.mobile}
                        onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                      {formErrors.mobile && <span className="evt-res-form-error">{formErrors.mobile}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Email</label>
                      <input placeholder="email@example.com"
                        value={form.email} onChange={e => setF("email", e.target.value)} />
                    </div>
                  </div>

                  {form.type === "birthday" && (
                    <>
                      <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Birthday Details</div>
                      <div className="horizontal-form-group">
                        <div className="form-group" style={{ flex: 1.5 }}>
                          <label>Birthday Person's Name <span className="evt-res-req">*</span></label>
                          <input placeholder="Name" value={form.birthdayPersonName}
                            onChange={e => setF("birthdayPersonName", e.target.value)} />
                          {formErrors.birthdayPersonName && <span className="evt-res-form-error">{formErrors.birthdayPersonName}</span>}
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label>Age (optional)</label>
                          <input type="number" min="1" max="120" placeholder="Age"
                            value={form.birthdayPersonAge} onChange={e => setF("birthdayPersonAge", e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="form-group" style={{ marginTop: 4 }}>
                    <label>Special Notes</label>
                    <textarea rows={2} placeholder="Any special requests..."
                      value={form.specialNote} onChange={e => setF("specialNote", e.target.value)} />
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Date & Time</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Event Date <span className="evt-res-req">*</span></label>
                      <CustomDatePicker value={form.date} min={tomorrowStr()} onChange={v => setF("date", v)} placeholder="Select date" />
                      {formErrors.date && <span className="evt-res-form-error">{formErrors.date}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Time <span className="evt-res-req">*</span></label>
                      <CustomTimePicker value={form.time} onChange={v => setF("time", v)} />
                      {formErrors.time && <span className="evt-res-form-error">{formErrors.time}</span>}
                    </div>
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Decoration</div>
                  <div className="form-group">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                        ⚠️ Please fill all required fields before creating.{" "}
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
              <div className="form-actions ae-spec-footer">
                {createTab === 0 ? (
                  <button type="button" className="btn-primary" onClick={handleCreateNext}>Preview →</button>
                ) : (
                  <>
                    <button type="button" className="ae-step-prev-btn" onClick={() => setCreateTab(0)}>← Edit</button>
                    <button onClick={handleCreate} disabled={saving}>
                      {saving ? "Saving..." : "Create Celebration"}
                    </button>
                  </>
                )}
                <button onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Celebrations;