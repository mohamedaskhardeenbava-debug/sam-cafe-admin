import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Reservations.css";
import { useToast } from "../../useToast";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];

const SLOT_LABEL = (time) => {
  if (!time) return "—";
  const h = parseInt(time.split(":")[0], 10);
  if (h < 11) return "BF";
  if (h < 16) return "Lunch";
  return "Dinner";
};

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

const SOURCE_OPTIONS = [
  { label: "User App", icon: "App" },
  { label: "WhatsApp", icon: "WA" },
  { label: "Phone", icon: "Ph" },
  { label: "In Person", icon: "IP" },
];
const SOURCE_ICON = Object.fromEntries(SOURCE_OPTIONS.map(s => [s.label, s.icon]));

const EMPTY_FORM = {
  name: "", mobile: "", email: "",
  guests: 2, date: todayStr(), time: "",
  tableNo: "", tablePref: "Any",
  source: "Phone", inchargePerson: "",
  notes: "", status: "pending",
};

/* ─── Custom Date Picker ─────────────────────────── */
const MONTHS_CDP = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CustomDatePicker = ({ value, onChange, min }) => {
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
  const minD = min ? new Date(min) : null;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const select = (d) => {
    const s = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    onChange(s); setOpen(false);
  };
  const isDisabled = (d) => {
    if (!minD) return false;
    const ds = new Date(`${calYear}-${pad(calMonth + 1)}-${pad(d)}T00:00:00`);
    return ds < minD;
  };
  const displayVal = value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Select date";
  const yearRange = Array.from({ length: 20 }, (_, i) => calYear - 5 + i);
  return (
    <div className="res-wrap" ref={ref} style={{ position: "relative", display: "block" }}>
      <button type="button" className="res-trigger evt-res-res-trigger" onClick={() => { setOpen(o => !o); setView("day"); if (value) { const p = new Date(value); setCalYear(p.getFullYear()); setCalMonth(p.getMonth()); } }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
        <span className="res-val">{displayVal}</span>
        <span style={{ marginLeft: "auto", opacity: .4, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div className="res-popup" style={{ zIndex: 9999 }}>
          <div className="res-nav">
            <button type="button" className="res-nav-btn" onClick={() => { if (view === "day") { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); } else if (view === "year") setCalYear(y => y - 20); }}>‹</button>
            <div className="res-nav-center">
              {view === "day" && <><button type="button" className="res-nav-lbl" onClick={() => setView("month")}>{MONTHS_CDP[calMonth]}</button><button type="button" className="res-nav-lbl" onClick={() => setView("year")}>{calYear}</button></>}
              {view === "month" && <button type="button" className="res-nav-lbl" onClick={() => setView("year")}>{calYear}</button>}
              {view === "year" && <span className="res-nav-lbl">{calYear - 5} – {calYear + 14}</span>}
            </div>
            <button type="button" className="res-nav-btn" onClick={() => { if (view === "day") { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); } else if (view === "year") setCalYear(y => y + 20); }}>›</button>
          </div>
          {view === "day" && (<>
            <div className="res-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <span key={d}>{d}</span>)}</div>
            <div className="res-grid">
              {cells.map((d, i) => {
                if (!d) return <span key={i} />;
                const ds = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
                const sel = ds === value, dis = isDisabled(d), tod = ds === todayStr();
                return <button type="button" key={i} className={`res-day${sel ? " res-sel" : ""}${dis ? " res-dis" : ""}${tod && !sel ? " res-today" : ""}`} disabled={dis} onClick={() => select(d)}>{d}</button>;
              })}
            </div>
          </>)}
          {view === "month" && (
            <div className="res-month-grid">
              {MONTHS_CDP.map((m, i) => <button type="button" key={i} className={`res-month-btn${i === calMonth ? " res-sel" : ""}`} onClick={() => { setCalMonth(i); setView("day"); }}>{m.slice(0, 3)}</button>)}
            </div>
          )}
          {view === "year" && (
            <div className="res-year-grid">
              {yearRange.map(y => <button type="button" key={y} className={`res-year-btn${y === calYear ? " res-sel" : ""}`} onClick={() => { setCalYear(y); setView("month"); }}>{y}</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Clock Time Picker ─────────────────────────── */
const ClockTimePicker = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("hour");
  const ref = useRef(null);

  const parseTime = (v) => {
    if (!v) return { h: 12, m: 0, ampm: "PM" };
    const [hh, mm] = v.split(":").map(Number);
    return { h: hh % 12 || 12, m: mm, ampm: hh >= 12 ? "PM" : "AM" };
  };

  const [sel, setSel] = useState(parseTime(value));

  useEffect(() => { if (value) setSel(parseTime(value)); }, [value]);

  const to24 = (h, m, ampm) => {
    let hh = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    return `${pad(hh)}:${pad(m)}`;
  };

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setMode("hour"); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const CLOCK_R = 100; const CENTER = 110; const HOUR_R = 78; const MIN_R = 78;
  const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const hourAngle = (h) => ((h % 12) / 12) * 360 - 90;
  const minAngle = (m) => (m / 60) * 360 - 90;
  const polarToXY = (angle, r) => ({
    x: CENTER + r * Math.cos((angle * Math.PI) / 180),
    y: CENTER + r * Math.sin((angle * Math.PI) / 180),
  });

  const selectHour = (h) => {
    setSel(p => { const ns = { ...p, h }; onChange(to24(ns.h, ns.m, ns.ampm)); return ns; });
    setTimeout(() => setMode("minute"), 200);
  };
  const selectMinute = (m) => {
    setSel(p => { const ns = { ...p, m }; onChange(to24(ns.h, ns.m, ns.ampm)); return ns; });
    setTimeout(() => { setOpen(false); setMode("hour"); }, 200);
  };
  const toggleAmpm = (ap) => {
    setSel(p => { const ns = { ...p, ampm: ap }; onChange(to24(ns.h, ns.m, ns.ampm)); return ns; });
  };

  // Drag support
  const svgRef = useRef(null);
  const handleSvgDrag = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left - CENTER;
    const y = clientY - rect.top - CENTER;
    const angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    const norm = ((angle % 360) + 360) % 360;
    if (mode === "hour") {
      const h = Math.round(norm / 30) % 12 || 12;
      setSel(p => { const ns = { ...p, h }; onChange(to24(ns.h, ns.m, ns.ampm)); return ns; });
    } else {
      const m = Math.round(norm / 6) % 60;
      const snapped = Math.round(m / 5) * 5 % 60;
      setSel(p => { const ns = { ...p, m: snapped }; onChange(to24(ns.h, ns.m, ns.ampm)); return ns; });
    }
  };

  const displayVal = value ? (() => {
    const [hh, mm] = value.split(":").map(Number);
    const ap = hh >= 12 ? "PM" : "AM";
    return `${hh % 12 || 12}:${pad(mm)} ${ap}`;
  })() : "Select time";

  const handAngle = mode === "hour" ? hourAngle(sel.h) : minAngle(sel.m);
  const handR = mode === "hour" ? HOUR_R - 14 : MIN_R - 14;
  const handTip = polarToXY(handAngle, handR);

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
          <svg
            ref={svgRef}
            width={CENTER * 2} height={CENTER * 2}
            className="ctp-clock-svg"
            onMouseMove={(e) => e.buttons === 1 && handleSvgDrag(e)}
            onTouchMove={handleSvgDrag}
            style={{ touchAction: "none" }}
          >
            <circle cx={CENTER} cy={CENTER} r={CLOCK_R} fill="#f8f9fa" stroke="#e5e7eb" strokeWidth="1.5" />
            <line x1={CENTER} y1={CENTER} x2={handTip.x} y2={handTip.y} stroke="#1dd1a1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={CENTER} cy={CENTER} r="4" fill="#1dd1a1" />
            <circle cx={handTip.x} cy={handTip.y} r="16" fill="#1dd1a1" opacity="0.18" />
            <circle cx={handTip.x} cy={handTip.y} r="4" fill="#1dd1a1" />
            {mode === "hour" && hours12.map((h) => {
              const ang = hourAngle(h);
              const pos = polarToXY(ang, HOUR_R);
              const isSelected = sel.h === h;
              return (
                <g key={h} onClick={() => selectHour(h)} style={{ cursor: "pointer" }}>
                  <circle cx={pos.x} cy={pos.y} r="16" fill={isSelected ? "#1dd1a1" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                    fontSize="13" fontWeight={isSelected ? "700" : "400"}
                    fill={isSelected ? "#fff" : "#333"}>{h}</text>
                </g>
              );
            })}
            {mode === "minute" && minutes.map((m) => {
              const ang = minAngle(m);
              const pos = polarToXY(ang, MIN_R);
              const isSelected = sel.m === m;
              return (
                <g key={m} onClick={() => selectMinute(m)} style={{ cursor: "pointer" }}>
                  <circle cx={pos.x} cy={pos.y} r="16" fill={isSelected ? "#1dd1a1" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                    fontSize="12" fontWeight={isSelected ? "700" : "400"}
                    fill={isSelected ? "#fff" : "#333"}>{pad(m)}</text>
                </g>
              );
            })}
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

/* ─── Seating visual SVGs ─────────────────────────── */
const PREF_OPTIONS = [
  {
    label: "Any",
    desc: "No preference",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="14" width="40" height="22" rx="4" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
        <rect x="18" y="8" width="6" height="10" rx="2" fill="#9ca3af" />
        <rect x="36" y="8" width="6" height="10" rx="2" fill="#9ca3af" />
        <rect x="18" y="32" width="6" height="10" rx="2" fill="#9ca3af" />
        <rect x="36" y="32" width="6" height="10" rx="2" fill="#9ca3af" />
        <circle cx="30" cy="25" r="5" fill="#d1d5db" />
      </svg>
    ),
  },
  {
    label: "Window",
    desc: "Street view, natural light",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="56" height="40" rx="3" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="30" y1="2" x2="30" y2="42" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="2" y1="22" x2="58" y2="22" stroke="#60a5fa" strokeWidth="1.5" />
        <rect x="10" y="28" width="16" height="10" rx="2" fill="#93c5fd" opacity=".6" />
        <rect x="34" y="28" width="16" height="10" rx="2" fill="#93c5fd" opacity=".6" />
        <path d="M8 6 L14 14 M18 6 L24 14" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Booth",
    desc: "Cozy enclosed seating",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="52" height="36" rx="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="4" y="4" width="12" height="36" rx="4" fill="#fbbf24" />
        <rect x="44" y="4" width="12" height="36" rx="4" fill="#fbbf24" />
        <rect x="16" y="16" width="28" height="12" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.2" />
        <circle cx="30" cy="22" r="4" fill="#fcd34d" />
      </svg>
    ),
  },
  {
    label: "Hitter",
    desc: "High-top bar seating",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="6" width="28" height="6" rx="2" fill="#6b7280" stroke="#4b5563" strokeWidth="1.2" />
        <line x1="30" y1="12" x2="30" y2="38" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
        <circle cx="14" cy="18" r="5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2" />
        <line x1="14" y1="23" x2="14" y2="38" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        <circle cx="46" cy="18" r="5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2" />
        <line x1="46" y1="23" x2="46" y2="38" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

/* ─── Sort config ─────────────────────────── */
const SORT_FIELDS = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "guests", label: "Guests" },
  { key: "status", label: "Status" },
];

const Reservations = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [filterToday, setFilterToday] = useState(false);
  const [filterSlots, setFilterSlots] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set());
  const [filterSources, setFilterSources] = useState(new Set());
  const [search, setSearch] = useState("");
  const [reminderId, setReminderId] = useState(null);
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSet = (setter, val) =>
    setter(prev => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const data = adminData?.reservations || [];
  const tables = (adminData?.tables?.[0]?.list || []).map(Number).sort((a, b) => a - b);
  const staff = adminData?.staff || [];

  // Get tables already assigned for the selected date (not just today)
  const assignedTables = useMemo(() => {
    const targetDate = form.date || todayStr();
    return new Set(
      data.filter(r => r.date === targetDate && r.tableNo).map(r => String(r.tableNo))
    );
  }, [data, form.date]);

  // Re-calculate assignedTables for row table dropdowns (always today)
  const assignedTablesToday = useMemo(() => {
    const today = todayStr();
    return new Set(
      data.filter(r => r.date === today && r.tableNo).map(r => String(r.tableNo))
    );
  }, [data]);

  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterToday) { const today = todayStr(); d = d.filter(r => r.date === today); }
    if (filterSlots.size > 0) {
      d = d.filter(r => {
        const h = parseInt((r.time || "0").split(":")[0], 10);
        const slot = h < 11 ? "BF" : h < 16 ? "Lunch" : "Dinner";
        return filterSlots.has(slot);
      });
    }
    if (filterStatuses.size > 0) d = d.filter(r => filterStatuses.has(r.status || "pending"));
    if (filterSources.size > 0) d = d.filter(r => filterSources.has(r.source));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(r =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.mobile || "").includes(q) ||
        (r.id || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filterToday, filterSlots, filterStatuses, filterSources, search]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let va, vb;
      if (sortField === "date") {
        va = new Date(`${a.date}T${a.time || "00:00"}`);
        vb = new Date(`${b.date}T${b.time || "00:00"}`);
      } else if (sortField === "guests") {
        va = Number(a.guests || 0); vb = Number(b.guests || 0);
      } else {
        va = (a[sortField] || "").toString().toLowerCase();
        vb = (b[sortField] || "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDir]);

  const today = todayStr();
  const todayCount = data.filter(r => r.date === today).length;
  const pendingCount = data.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = data.filter(r => r.status === "confirmed").length;

  const updateStatus = async (e, id, status) => {
    e.stopPropagation();

    const prev = (adminData.reservations || []).find(r => r.id === id);
    if (!prev) return;

    // Optimistic UI
    setAdminData(p => ({
      ...p,
      reservations: p.reservations.map(r =>
        r.id === id ? { ...r, status } : r
      ),
    }));

    try {
      try {
        await api.patch(`/reservations/${id}`, { status });
      } catch {
        await api.put(`/reservations/${id}`, { ...prev, status });
      }

      toast.success(`Status updated to ${status}`);
    } catch (err) {
      // rollback
      setAdminData(p => ({
        ...p,
        reservations: p.reservations.map(r =>
          r.id === id ? prev : r
        ),
      }));

      toast.error("Failed to update status");
    }
  };

  const updateTable = async (e, id, tableNo) => {
    e.stopPropagation();
    if (typeof setAdminData !== "function") return;
    const prev = (adminData.reservations || []).find(r => r.id === id);
    if (!prev) return;
    setAdminData(p => ({
      ...p,
      reservations: (p.reservations || []).map(r => r.id === id ? { ...r, tableNo } : r),
    }));
    try {
      try { await api.patch(`/reservations/${id}`, { tableNo }); }
      catch { await api.put(`/reservations/${id}`, { ...prev, tableNo }); }
      toast.success(tableNo ? `Table T-${tableNo} assigned.` : "Table unassigned.");
    } catch {
      setAdminData(p => ({ ...p, reservations: (p.reservations || []).map(r => r.id === id ? prev : r) }));
      toast.error("Failed to assign table.");
    }
  };

  const markReminder = (e, id) => {
    e.stopPropagation();
    setReminderId(id);
    setTimeout(() => setReminderId(null), 3000);
  };

  const setF = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setFormErrors(e => ({ ...e, [key]: "" }));
  };

  const validateForm = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Enter a valid name";
    const cleanMobile = form.mobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length !== 10) e.mobile = "Enter a valid 10-digit number";
    if (!form.date) e.date = "Pick a date";
    if (!form.time) e.time = "Pick a time";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const id = `res_${Date.now()}`;
      const payload = { id, ...form, status: form.status || "pending", createdAt: new Date().toISOString() };
      await api.post("/reservations", payload);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, reservations: [...(p.reservations || []), payload] }));
      }
      toast.success("Reservation created successfully.");
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error("Failed to create reservation.");
    } finally {
      setSaving(false);
    }
  };

  const activeFilters = filterToday || filterSlots.size > 0 || filterStatuses.size > 0 || filterSources.size > 0 || search.trim();

  const SortTh = ({ field, children }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}
      <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
        {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );

  // Available tables for the form modal (exclude today-assigned ones, allow currently set one)
  const availableTablesForForm = tables.filter(t => {
    const tStr = String(t);
    if (form.tableNo && String(form.tableNo) === tStr) return true; // currently selected
    return !assignedTables.has(tStr);
  });

  const handleInlineStatusChange = async (id, newStatus) => {
  try {
    await api.put(`/reservations/${id}`, { status: newStatus });

    setAdminData(prev => ({
      ...prev,
      reservations: prev.reservations.map(r =>
        r.id === id ? { ...r, status: newStatus } : r
      )
    }));

    toast.success(`Updated to ${newStatus}`);
  } catch (err) {
    toast.error("Failed to update status");
  }
};

  return (
    <div className="evt-res-page">
      <div className="evt-res-header">
        <div>
          <h2 className="evt-res-title">Reservations</h2>
          <p className="evt-res-subtitle">Manage table bookings</p>
        </div>
        <button className="evt-res-create-btn" onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); }}>
          + Add Reservation
        </button>
      </div>

      {/* KPI strip */}
      <div className="evt-res-kpi-row">
        {[
          { label: "Total", val: data.length, color: "#111" },
          { label: "Today", val: todayCount, color: "#2980b9" },
          { label: "Pending", val: pendingCount, color: "#ca8a04" },
          { label: "Confirmed", val: confirmedCount, color: "#16a34a" },
        ].map((k, i) => (
          <div key={i} className="evt-res-kpi" style={{ borderTopColor: k.color }}>
            <div className="evt-res-kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="evt-res-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="evt-res-filter-bar">
        <input className="evt-res-search" placeholder="Search name / mobile / ID..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="evt-res-filter-groups">
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Date</span>
            <button className={`evt-res-filter-btn ${filterToday ? "active" : ""}`} onClick={() => setFilterToday(p => !p)}>Today</button>
          </div>
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Slot</span>
            {[["BF", "Breakfast"], ["Lunch", "Lunch"], ["Dinner", "Dinner"]].map(([key, label]) => (
              <button key={key} className={`evt-res-filter-btn ${filterSlots.has(key) ? "active" : ""}`} onClick={() => toggleSet(setFilterSlots, key)}>{label}</button>
            ))}
          </div>
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Status</span>
            {[["pending", "Pending", "status-pending"], ["confirmed", "Confirmed", "status-confirmed"], ["completed", "Done", "status-completed"], ["cancelled", "Cancelled", "status-cancelled"]].map(([key, label, cls]) => (
              <button key={key} className={`evt-res-filter-btn ${filterStatuses.has(key) ? "active " + cls : ""}`} onClick={() => toggleSet(setFilterStatuses, key)}>{label}</button>
            ))}
          </div>
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Source</span>
            {SOURCE_OPTIONS.map(s => (
              <button key={s.label} className={`evt-res-filter-btn ${filterSources.has(s.label) ? "active" : ""}`} onClick={() => toggleSet(setFilterSources, s.label)}>{s.label}</button>
            ))}
          </div>
          {activeFilters && (
            <button className="evt-res-clear-all" onClick={() => { setSearch(""); setFilterToday(false); setFilterSlots(new Set()); setFilterStatuses(new Set()); setFilterSources(new Set()); }}>Clear</button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-res-table-wrapper">
        <table className="evt-res-table">
          <thead>
            <tr>
              <SortTh field="name">Guest Name</SortTh>
              <th>Contact</th>
              <th>Source</th>
              <SortTh field="date">Date</SortTh>
              <th>Slot</th>
              <th>Time</th>
              <SortTh field="guests">Guests</SortTh>
              <th>Table</th>
              <th>Incharge</th>
              <SortTh field="status">Status</SortTh>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="11" className="evt-res-empty">No reservations found</td></tr>
            ) : (
              sortedData.map(item => {
                const status = item.status || "pending";
                // Get available tables for this row's dropdown (excluding ones taken by other reservations for same date)
                const rowDate = item.date || todayStr();
                const assignedForDate = new Set(
                  data.filter(r => r.date === rowDate && r.tableNo && r.id !== item.id).map(r => String(r.tableNo))
                );
                const rowAvailTables = tables.filter(t => {
                  const tStr = String(t);
                  if (item.tableNo && String(item.tableNo) === tStr) return true;
                  return !assignedForDate.has(tStr);
                });
                return (
                  <tr key={item.id} className="evt-res-row clickable" onClick={() => navigate(`/reservations/${item.id}`)}>
                    <td>
                      <div className="evt-res-name-cell">
                        <div className="evt-res-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="evt-res-name">{item.name || "—"}</div>
                          <div className="evt-res-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="evt-res-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-res-email">{item.email}</span>}
                      </div>
                    </td>
                    <td><span className="evt-res-source">{item.source || "—"}</span></td>
                    <td style={{ fontWeight: 600 }}>{item.date || "—"}</td>
                    <td>{SLOT_LABEL(item.time)}</td>
                    <td>{fmtTime(item.time)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.guests || 1}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <select className="evt-res-table-select" value={item.tableNo || ""}
                        onChange={e => updateTable(e, item.id, e.target.value)}>
                        <option value="">— Table —</option>
                        {rowAvailTables.map(t => <option key={t} value={t}>T-{t}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12, color: "#666" }}>{item.inchargePerson || "—"}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-res-inline-status">
                        {["pending", "confirmed", "completed", "cancelled"].map(s => (
                          <button
                            key={s}
                            className={`evt-res-istatus-btn evt-res-istatus-${s}${status === s ? " active" : ""}`}
                            title={s}
                            onClick={(e) => updateStatus(e, item.id, s)}  // ✅ FIXED
                          >
                            {s === "pending" ? "P" : s === "confirmed" ? "C" : s === "completed" ? "D" : "X"}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className={`evt-res-act-btn evt-res-act-remind ${reminderId === item.id ? "active" : ""}`}
                        onClick={e => markReminder(e, item.id)}
                        title="Reminder Call">
                        {reminderId === item.id ? "Called!" : "Call"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="category-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="category-modal" onClick={e => e.stopPropagation()}>
            <div className="category-modal-header">
              <h3 className="">Add Reservation</h3>
              <button className="dish-close-btn" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <div className="category-modal-body">
              <div className="evt-res-form-section-label">Guest Information</div>

              <div className="evt-res-form-row">
                <div className="evt-res-form-group" style={{ flex: 1.4 }}>
                  <label>Name <span className="evt-res-req">*</span></label>
                  <input className={`evt-res-form-input ${formErrors.name ? "error" : ""}`}
                    placeholder="Guest name" value={form.name}
                    onChange={e => setF("name", e.target.value)} />
                  {formErrors.name && <span className="evt-res-form-error">{formErrors.name}</span>}
                </div>
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Guests</label>
                  <div className="evt-res-stepper">
                    <button onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                    <span>{form.guests}</span>
                    <button onClick={() => setF("guests", Math.min(30, form.guests + 1))}>+</button>
                  </div>
                </div>
              </div>

              <div className="evt-res-form-row">
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Mobile <span className="evt-res-req">*</span></label>
                  <input className={`evt-res-form-input ${formErrors.mobile ? "error" : ""}`}
                    placeholder="10-digit number" type="tel"
                    value={form.mobile}
                    onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  {formErrors.mobile && <span className="evt-res-form-error">{formErrors.mobile}</span>}
                </div>
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Email</label>
                  <input className="evt-res-form-input" placeholder="email@example.com"
                    value={form.email} onChange={e => setF("email", e.target.value)} />
                </div>
              </div>

              <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Booking Details</div>

              <div className="evt-res-form-row">
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Date <span className="evt-res-req">*</span></label>
                  <CustomDatePicker value={form.date} min={todayStr()} onChange={v => setF("date", v)} />
                  {formErrors.date && <span className="evt-res-form-error">{formErrors.date}</span>}
                </div>
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Time <span className="evt-res-req">*</span></label>
                  <ClockTimePicker value={form.time} onChange={v => setF("time", v)} />
                  {formErrors.time && <span className="evt-res-form-error">{formErrors.time}</span>}
                </div>
              </div>

              <div className="evt-res-form-row">
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Table No. <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400 }}>(available)</span></label>
                  <select className="evt-res-form-input" value={form.tableNo}
                    onChange={e => setF("tableNo", e.target.value)}>
                    <option value="">— No table —</option>
                    {availableTablesForForm.map(t => <option key={t} value={t}>Table {t}</option>)}
                  </select>
                </div>
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Table Preference</label>
                  <div className="evt-res-pref-grid">
                    {PREF_OPTIONS.map(p => (
                      <button key={p.label} type="button"
                        className={`evt-res-pref-card ${form.tablePref === p.label ? "active" : ""}`}
                        onClick={() => setF("tablePref", p.label)}>
                        <div className="evt-res-pref-visual">{p.svg}</div>
                        <span className="evt-res-pref-label">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Staff & Source</div>

              <div className="evt-res-form-row">
                <div className="evt-res-form-group" style={{ flex: 1 }}>
                  <label>Source</label>
                  <div className="evt-res-source-chips">
                    {SOURCE_OPTIONS.map(s => (
                      <button key={s.label}
                        className={`evt-res-source-chip ${form.source === s.label ? "active" : ""}`}
                        onClick={() => setF("source", s.label)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="evt-res-form-group">
                <label>Staff Incharge</label>
                {staff.length > 0 ? (
                  <select className="evt-res-form-input" value={form.inchargePerson}
                    onChange={e => setF("inchargePerson", e.target.value)}>
                    <option value="">— Assign staff —</option>
                    {staff.map(s => <option key={s.id || s.name} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>)}
                  </select>
                ) : (
                  <input className="evt-res-form-input" placeholder="Staff name"
                    value={form.inchargePerson} onChange={e => setF("inchargePerson", e.target.value)} />
                )}
              </div>

              <div className="evt-res-form-group">
                <label>Status</label>
                <div className="evt-res-source-chips">
                  {["pending", "confirmed"].map(s => (
                    <button key={s}
                      className={`evt-res-source-chip ${form.status === s ? "active status-" + s : ""}`}
                      onClick={() => setF("status", s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="evt-res-form-group">
                <label>Notes</label>
                <textarea className="evt-res-form-textarea" rows={2}
                  placeholder="Special requests, dietary restrictions..."
                  value={form.notes} onChange={e => setF("notes", e.target.value)} />
              </div>
            </div>

            <div className="category-modal-footer form-actions">
              <button onClick={() => setShowCreate(false)}>Cancel</button>
              <button onClick={handleCreate} disabled={saving}>
                {saving ? "Saving..." : "Create Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;