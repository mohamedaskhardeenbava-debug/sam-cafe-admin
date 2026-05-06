/* admin panel */
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Celebrations.css";
import { useToast } from "../../useToast";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; };

const CELEBRATION_TYPES = [
  { label: "Birthday", value: "birthday" },
  { label: "Anniversary", value: "anniversary" },
  { label: "Meeting", value: "meeting" },
  { label: "Get Together", value: "gettogether" },
];

const CELEBRATION_TYPE_MAP = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  meeting: "Meeting",
  gettogether: "Get Together",
};

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

const DECORATION_LABELS = { normal: "Normal", elegant: "Elegant", luxury: "Luxury" };
const DECORATION_PRICES = { normal: 1500, elegant: 3000, luxury: 5000 };

const SOURCE_OPTIONS = ["User App", "WhatsApp", "Phone", "In Person"];


/* ══════════════════════════════════════
   Clock Time Picker (reused from Reservations)
══════════════════════════════════════ */
const ClockTimePicker = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour");
  const ref = useRef(null);
  const svgRef = useRef(null);

  const parseTime = (v) => {
    if (!v) return { h: 12, m: 0, ampm: "PM" };
    const [hh, mm] = v.split(":").map(Number);
    return { h: hh % 12 || 12, m: mm, ampm: hh >= 12 ? "PM" : "AM" };
  };
  const selRef = useRef(parseTime(value));
  const [sel, setSel] = useState(parseTime(value));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value && value !== lastEmitted.current) { const p = parseTime(value); selRef.current = p; setSel(p); }
  }, [value]);
  const to24 = (h, m, ampm) => { let hh = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h); return `${pad(hh)}:${pad(m)}`; };
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setMode("hour"); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const CLOCK_R = 100, CENTER = 110, HOUR_R = 78, MIN_R = 78;
  const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const hourAngle = (h) => ((h % 12) / 12) * 360 - 90;
  const minAngle = (m) => (m / 60) * 360 - 90;
  const polarToXY = (angle, r) => ({ x: CENTER + r * Math.cos((angle * Math.PI) / 180), y: CENTER + r * Math.sin((angle * Math.PI) / 180) });
  const emit = (ns) => { const v = to24(ns.h, ns.m, ns.ampm); lastEmitted.current = v; onChange(v); };
  const selectHour = (h) => { const ns = { ...selRef.current, h }; selRef.current = ns; setSel(ns); emit(ns); setTimeout(() => setMode("minute"), 200); };
  const selectMinute = (m) => { const ns = { ...selRef.current, m }; selRef.current = ns; setSel(ns); emit(ns); setTimeout(() => { setOpen(false); setMode("hour"); }, 200); };
  const toggleAmpm = (ap) => { const ns = { ...selRef.current, ampm: ap }; selRef.current = ns; setSel(ns); emit(ns); };
  const isDragging = useRef(false);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const getAngleFromEvent = (e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const angle = Math.atan2(clientY - rect.top - CENTER, clientX - rect.left - CENTER) * (180 / Math.PI) + 90;
    return ((angle % 360) + 360) % 360;
  };

  const applyAngle = (norm) => {
    if (modeRef.current === "hour") {
      const h = Math.round(norm / 30) % 12 || 12;
      const ns = { ...selRef.current, h }; selRef.current = ns; setSel(ns); emit(ns);
    } else {
      const snapped = Math.round(Math.round(norm / 6) % 60 / 5) * 5 % 60;
      const ns = { ...selRef.current, m: snapped }; selRef.current = ns; setSel(ns); emit(ns);
    }
  };

  const handleSvgMouseDown = (e) => { e.preventDefault(); isDragging.current = true; const n = getAngleFromEvent(e); if (n !== null) applyAngle(n); };
  const handleSvgTouchStart = (e) => { isDragging.current = true; const n = getAngleFromEvent(e); if (n !== null) applyAngle(n); };

  useEffect(() => {
    const onMM = (e) => { if (!isDragging.current) return; const n = getAngleFromEvent(e); if (n !== null) applyAngle(n); };
    const onMU = () => { if (!isDragging.current) return; isDragging.current = false; if (modeRef.current === "hour") setTimeout(() => setMode("minute"), 150); else setTimeout(() => { setOpen(false); setMode("hour"); }, 150); };
    const onTM = (e) => { if (!isDragging.current) return; e.preventDefault(); const n = getAngleFromEvent(e); if (n !== null) applyAngle(n); };
    const onTE = () => { if (!isDragging.current) return; isDragging.current = false; if (modeRef.current === "hour") setTimeout(() => setMode("minute"), 150); else setTimeout(() => { setOpen(false); setMode("hour"); }, 150); };
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    window.addEventListener("touchmove", onTM, { passive: false });
    window.addEventListener("touchend", onTE);
    return () => { window.removeEventListener("mousemove", onMM); window.removeEventListener("mouseup", onMU); window.removeEventListener("touchmove", onTM); window.removeEventListener("touchend", onTE); };
  }, []);
  const displayVal = value ? (() => { const [hh, mm] = value.split(":").map(Number); return `${hh % 12 || 12}:${pad(mm)} ${hh >= 12 ? "PM" : "AM"}`; })() : "Select time";
  const handAngle = mode === "hour" ? hourAngle(sel.h) : minAngle(sel.m);
  const handTip = polarToXY(handAngle, mode === "hour" ? HOUR_R - 14 : MIN_R - 14);

  return (
    <div className="ctp-wrap" ref={ref}>
      <button type="button" className={`ctp-trigger${disabled ? " ctp-disabled" : ""}`} onClick={() => !disabled && setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        <span className={`ctp-val${!value ? " ctp-placeholder" : ""}`}>{displayVal}</span>
        <span style={{ marginLeft: "auto", opacity: .4, fontSize: 11 }}>▾</span>
      </button>
      {open && !disabled && (
        <div className="ctp-popup">
          <div className="ctp-header">
            <div className="ctp-ampm-col">
              <button type="button" className={`ctp-ampm-btn${sel.ampm === "AM" ? " active" : ""}`} onClick={() => toggleAmpm("AM")}>AM</button>
              <button type="button" className={`ctp-ampm-btn${sel.ampm === "PM" ? " active" : ""}`} onClick={() => toggleAmpm("PM")}>PM</button>
            </div>
            <div className="ctp-time-display">
              <span className={`ctp-hm-btn${mode === "hour" ? " active" : ""}`} onClick={() => setMode("hour")}>{pad(sel.h)}</span>
              <span className="ctp-colon">:</span>
              <span className={`ctp-hm-btn${mode === "minute" ? " active" : ""}`} onClick={() => setMode("minute")}>{pad(sel.m)}</span>
            </div>
          </div>
          <svg ref={svgRef} width={CENTER * 2} height={CENTER * 2} className="ctp-clock-svg"
            onMouseDown={handleSvgMouseDown} onTouchStart={handleSvgTouchStart} style={{ touchAction: "none", cursor: "crosshair" }}>
            <circle cx={CENTER} cy={CENTER} r={CLOCK_R} fill="#f8f9fa" stroke="#e5e7eb" strokeWidth="1.5" />
            <line x1={CENTER} y1={CENTER} x2={handTip.x} y2={handTip.y} stroke="#1dd1a1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={CENTER} cy={CENTER} r="4" fill="#1dd1a1" />
            <circle cx={handTip.x} cy={handTip.y} r="16" fill="#1dd1a1" opacity="0.18" />
            <circle cx={handTip.x} cy={handTip.y} r="4" fill="#1dd1a1" />
            {mode === "hour" && hours12.map(h => { const ang = hourAngle(h); const pos = polarToXY(ang, HOUR_R); const isSel = sel.h === h; return (<g key={h} onClick={() => selectHour(h)} style={{ cursor: "pointer" }}><circle cx={pos.x} cy={pos.y} r="16" fill={isSel ? "#1dd1a1" : "transparent"} /><text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight={isSel ? "700" : "400"} fill={isSel ? "#fff" : "#333"}>{h}</text></g>); })}
            {mode === "minute" && minutes.map(m => { const ang = minAngle(m); const pos = polarToXY(ang, MIN_R); const isSel = sel.m === m; return (<g key={m} onClick={() => selectMinute(m)} style={{ cursor: "pointer" }}><circle cx={pos.x} cy={pos.y} r="16" fill={isSel ? "#1dd1a1" : "transparent"} /><text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight={isSel ? "700" : "400"} fill={isSel ? "#fff" : "#333"}>{pad(m)}</text></g>); })}
          </svg>
          <div className="ctp-footer">
            <button type="button" className="ctp-cancel-btn" onClick={() => { setOpen(false); setMode("hour"); }}>Cancel</button>
            <button type="button" className="ctp-ok-btn" onClick={() => { onChange(to24(sel.h, sel.m, sel.ampm)); setOpen(false); setMode("hour"); }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

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
  eventMenu: "",
  specialNote: "",
  source: "Phone",
  status: "pending",
};

/* ══════════════════════════════════════
   Custom Date Picker
══════════════════════════════════════ */
const MONTHS_CDP = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CustomDatePicker = ({ value, onChange, min, placeholder = "Select date" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const parsed = value ? new Date(value) : new Date();
  const [view, setView] = useState("day");
  const [calYear, setCalYear] = useState(parsed.getFullYear());
  const [calMonth, setCalMonth] = useState(parsed.getMonth());

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (value) { const p = new Date(value); setCalYear(p.getFullYear()); setCalMonth(p.getMonth()); }
  }, [value]);

  const minD = min ? new Date(min + "T00:00:00") : null;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const select = (d) => { onChange(`${calYear}-${pad(calMonth + 1)}-${pad(d)}`); setOpen(false); };
  const isDisabled = (d) => {
    if (!minD) return false;
    return new Date(`${calYear}-${pad(calMonth + 1)}-${pad(d)}T00:00:00`) < minD;
  };
  const displayVal = value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder;
  const yearRange = Array.from({ length: 20 }, (_, i) => calYear - 5 + i);

  return (
    <div className="res-wrap" ref={ref} style={{ position: "relative", display: "block" }}>
      <button type="button" className="res-trigger evt-res-res-trigger"
        onClick={() => { setOpen(o => !o); setView("day"); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="res-val">{displayVal}</span>
        <span style={{ marginLeft: "auto", opacity: .4, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div className="res-popup" style={{ zIndex: 9999 }}>
          <div className="res-nav">
            <button type="button" className="res-nav-btn" onClick={() => {
              if (view === "day") { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }
              else if (view === "year") setCalYear(y => y - 20);
            }}>‹</button>
            <div className="res-nav-center">
              {view === "day" && (<>
                <button type="button" className="res-nav-lbl" onClick={() => setView("month")}>{MONTHS_CDP[calMonth]}</button>
                <button type="button" className="res-nav-lbl" onClick={() => setView("year")}>{calYear}</button>
              </>)}
              {view === "month" && <button type="button" className="res-nav-lbl" onClick={() => setView("year")}>{calYear}</button>}
              {view === "year" && <span className="res-nav-lbl">{calYear - 5} – {calYear + 14}</span>}
            </div>
            <button type="button" className="res-nav-btn" onClick={() => {
              if (view === "day") { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }
              else if (view === "year") setCalYear(y => y + 20);
            }}>›</button>
          </div>
          {view === "day" && (<>
            <div className="res-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <span key={d}>{d}</span>)}</div>
            <div className="res-grid">
              {cells.map((d, i) => {
                if (!d) return <span key={i} />;
                const ds = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
                const sel = ds === value, dis = isDisabled(d), tod = ds === todayStr();
                return (
                  <button type="button" key={i}
                    className={`res-day${sel ? " res-sel" : ""}${dis ? " res-dis" : ""}${tod && !sel ? " res-today" : ""}`}
                    disabled={dis} onClick={() => select(d)}>{d}
                  </button>
                );
              })}
            </div>
          </>)}
          {view === "month" && (
            <div className="res-month-grid">
              {MONTHS_CDP.map((m, i) => (
                <button type="button" key={i}
                  className={`res-month-btn${i === calMonth ? " res-sel" : ""}`}
                  onClick={() => { setCalMonth(i); setView("day"); }}>{m.slice(0, 3)}</button>
              ))}
            </div>
          )}
          {view === "year" && (
            <div className="res-year-grid">
              {yearRange.map(y => (
                <button type="button" key={y}
                  className={`res-year-btn${y === calYear ? " res-sel" : ""}`}
                  onClick={() => { setCalYear(y); setView("month"); }}>{y}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════
   Main Component
══════════════════════════════════════ */
const Celebrations = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [filterDate, setFilterDate] = useState(todayStr()); // default today
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
    // optimistic update
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

  /* ─── Create celebration ─── */
  const setF = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormErrors(e => ({ ...e, [key]: "" })); };

  const validateForm = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) e.mobile = "Valid 10-digit number";
    if (!form.date) e.date = "Date required";
    if (!form.time) e.time = "Time required";
    if (!form.type) e.type = "Select event type";
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

  return (
    <div className="evt-clb-page">

      {/* HEADER */}
      <div className="evt-clb-header">
        <div>
          <h2 className="evt-clb-title">Celebrations</h2>
          <p className="evt-clb-subtitle">Manage event & celebration bookings</p>
        </div>
        <button className="evt-res-create-btn" onClick={() => { setShowCreate(true); setForm({ ...EMPTY_FORM }); }}>
          + Add Celebration
        </button>
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

          {/* Date picker filter — default today */}
          <div className="evt-res-filter-group" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="evt-res-filter-group-label">Date</span>
            <div style={{ minWidth: 160 }}>
              <CustomDatePicker value={filterDate} onChange={setFilterDate} placeholder="All dates" />
            </div>
            {filterDate && (
              <button className="evt-clb-filter-btn" title="Clear date" onClick={() => setFilterDate("")}>✕</button>
            )}
          </div>

          {/* Type filter */}
          <div className="evt-clb-filter-group">
            <span className="evt-clb-filter-group-label">Type</span>
            {CELEBRATION_TYPES.map(t => (
              <button key={t.value}
                title={t.label}
                className={`evt-clb-filter-btn${filterType === t.value ? " active" : ""}`}
                onClick={() => setFilterType(p => p === t.value ? "" : t.value)}>
                {t.label.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Status filter */}
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
              <th>Menu</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="10" className="evt-clb-empty">No celebrations found</td></tr>
            ) : (
              sortedData.map(item => {
                const typeLabel = CELEBRATION_TYPE_MAP[item.type] || item.type || "—";
                const status = item.status || "pending";

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

                    {/* Guest */}
                    <td>
                      <div className="evt-clb-name-cell">
                        <div className="evt-clb-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="evt-clb-name">{item.name || "—"}</div>
                          <div className="evt-clb-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="evt-clb-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-clb-email">{item.email}</span>}
                      </div>
                    </td>

                    {/* Type */}
                    <td>
                      <span className={`evt-clb-type-badge evt-clb-type-${item.type || "birthday"}`}>
                        {typeLabel}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ fontWeight: 600 }}>{item.date || "—"}</td>

                    {/* Time */}
                    <td>{fmtTime(item.time)}</td>

                    {/* Guests */}
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.guests || "—"}</td>

                    {/* Decoration */}
                    <td>
                      {item.decoration ? (
                        <span className={`evt-clb-deco-badge deco-${item.decoration}`}>
                          {DECORATION_LABELS[item.decoration]} <span style={{ fontSize: 10, opacity: 0.7 }}>₹{DECORATION_PRICES[item.decoration]?.toLocaleString()}</span>
                        </span>
                      ) : <span style={{ color: "#aaa", fontSize: 12 }}>None</span>}
                    </td>

                    {/* Extras */}
                    <td>
                      <div className="evt-clb-extras-cell">
                        {extras.length > 0
                          ? extras.slice(0, 3).map((e, i) => <span key={i} className="evt-clb-extra-tag">{e}</span>)
                          : <span style={{ color: "#aaa", fontSize: 12 }}>None</span>}
                        {extras.length > 3 && <span className="evt-clb-extra-tag">+{extras.length - 3}</span>}
                      </div>
                    </td>

                    {/* Menu */}
                    <td>
                      {item.eventMenu ? (
                        <span className="evt-clb-menu-badge">{item.eventMenu}</span>
                      ) : <span style={{ color: "#aaa", fontSize: 12 }}>—</span>}
                    </td>

                    {/* Status — inline change buttons */}
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ══ Create Celebration Modal ══ */}
      {showCreate && (
        <div className="ingredient-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="ingredient-modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
            <div className="ingredient-modal-header">
              <h3>Add Celebration</h3>
              <button className="ingredient-close-btn" onClick={() => setShowCreate(false)} />
            </div>

            <div className="ingredient-modal-body" style={{ padding: "8px 0" }}>

              {/* Event Type */}
              <div className="evt-res-form-section-label">Event Type</div>
              <div className="form-group">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CELEBRATION_TYPES.map(t => (
                    <button key={t.value} type="button"
                      className={`evt-res-source-chip${form.type === t.value ? " active" : ""}`}
                      onClick={() => setF("type", t.value)}>
                      {t.label}
                    </button>
                  ))}
                </div>
                {formErrors.type && <span className="evt-res-form-error">{formErrors.type}</span>}
              </div>

              {/* Guest Info */}
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
                  <label>Guests</label>
                  <div className="evt-res-stepper">
                    <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                    <span>{form.guests}</span>
                    <button type="button" onClick={() => setF("guests", Math.min(500, form.guests + 1))}>+</button>
                  </div>
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

              {/* Date & Time */}
              <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Date & Time</div>

              <div className="horizontal-form-group">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Event Date <span className="evt-res-req">*</span></label>
                  <CustomDatePicker value={form.date} min={tomorrowStr()} onChange={v => setF("date", v)} placeholder="Select date" />
                  {formErrors.date && <span className="evt-res-form-error">{formErrors.date}</span>}
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Time <span className="evt-res-req">*</span></label>
                  <ClockTimePicker value={form.time} onChange={v => setF("time", v)} />
                  {formErrors.time && <span className="evt-res-form-error">{formErrors.time}</span>}
                </div>
              </div>

              {/* Birthday specific */}
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

              {/* Decoration */}
              <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Decoration</div>
              <div className="form-group">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button"
                    className={`evt-res-source-chip${!form.decoration ? " active" : ""}`}
                    onClick={() => setF("decoration", null)}>None</button>
                  {[{ v: "normal", l: "Normal", p: "₹1,500" }, { v: "elegant", l: "Elegant", p: "₹3,000" }, { v: "luxury", l: "Luxury", p: "₹5,000" }].map(d => (
                    <button key={d.v} type="button"
                      className={`evt-res-source-chip${form.decoration === d.v ? " active" : ""}`}
                      onClick={() => setF("decoration", d.v)}>
                      {d.l} {d.p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add-ons */}
              <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Add-ons</div>
              <div className="form-group">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { k: "cake", l: "Cake" }, { k: "specialMention", l: "Special Mention" },
                    { k: "candleLight", l: "Candle Light" }, { k: "liveMusic", l: "Live Music" },
                    { k: "surpriseGift", l: "Surprise Gift" }, { k: "mic", l: "Microphone" },
                    { k: "projector", l: "Projector" }, { k: "standingBrochures", l: "Brochures" },
                    { k: "placeHolders", l: "Place Holders" }, { k: "pens", l: "Pens" },
                  ].map(ex => (
                    <button key={ex.k} type="button"
                      className={`evt-res-source-chip${form[ex.k] ? " active" : ""}`}
                      onClick={() => setF(ex.k, !form[ex.k])}>
                      {ex.l}
                    </button>
                  ))}
                </div>
                {/* Special mention text */}
                {form.specialMention && (
                  <textarea rows={2} style={{ marginTop: 8, width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                    placeholder="Describe what to announce / mention..."
                    value={form.specialMentionText}
                    onChange={e => setF("specialMentionText", e.target.value)} />
                )}
              </div>

              {/* Event Menu */}
              <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Event Menu</div>
              <div className="form-group">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[{ v: "veg", l: "Veg" }, { v: "nonveg", l: "Non-Veg" }, { v: "vegan", l: "Vegan" }, { v: "custom", l: "Custom" }].map(m => (
                    <button key={m.v} type="button"
                      className={`evt-res-source-chip${form.eventMenu === m.v ? " active" : ""}`}
                      onClick={() => setF("eventMenu", form.eventMenu === m.v ? "" : m.v)}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source & Status */}
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

              {/* Special Note */}
              <div className="form-group" style={{ marginTop: 4 }}>
                <label>Special Notes</label>
                <textarea rows={2} placeholder="Any special requests..."
                  value={form.specialNote} onChange={e => setF("specialNote", e.target.value)} />
              </div>
            </div>

            <div className="ingredient-modal-footer">
              <div className="form-actions">
                <button onClick={handleCreate} disabled={saving}>
                  {saving ? "Saving..." : "Create Celebration"}
                </button>
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