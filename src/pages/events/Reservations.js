import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Reservations.css";
import { useToast } from "../../useToast";
/* admin panel */

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];

/* ─── All 5 slot groups (matches ReservationForm.js) ─── */
const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", short: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", short: "Br", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", short: "Lu", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", short: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", short: "Di", start: "18:30", end: "22:00" },
];

/* Map a 24-h time string → slot key */
const timeToSlotKey = (time) => {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 7 && h < 10) return "BF";
  if (h >= 10 && h < 12) return "BR";
  if (h >= 12 && h < 15) return "LU";
  if (h >= 15 && h < 18) return "HT";
  if (h >= 18) return "DI";
  return null;
};

/* Also accept legacy slotGroup field */
const resolveSlotKey = (r) => r.slotGroup || timeToSlotKey(r.time);

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const SOURCE_OPTIONS = [
  { label: "User App", icon: "App" },
  { label: "WhatsApp", icon: "WA" },
  { label: "Phone", icon: "Ph" },
  { label: "In Person", icon: "IP" },
];

/* ─── Default table preferences ─── */
const DEFAULT_PREF_OPTIONS = [
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

const EMPTY_FORM = {
  name: "", mobile: "", email: "",
  guests: 2,
  date: todayStr(),
  time: "",
  slotGroup: "",
  tableNo: "", tablePref: "Any",
  source: "Phone", inchargePerson: "",
  notes: "", status: "pending",
  bookedDate: todayStr(),
  reservedDate: todayStr(),
};

/* ══════════════════════════════════════════════
   Custom Date Picker
══════════════════════════════════════════════ */
const MONTHS_CDP = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CustomDatePicker = ({ value, onChange, min, max, placeholder = "Select date" }) => {
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
  const maxD = max ? new Date(max + "T00:00:00") : null;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const select = (d) => { onChange(`${calYear}-${pad(calMonth + 1)}-${pad(d)}`); setOpen(false); };
  const isDisabled = (d) => {
    const ds = new Date(`${calYear}-${pad(calMonth + 1)}-${pad(d)}T00:00:00`);
    if (minD && ds < minD) return true;
    if (maxD && ds > maxD) return true;
    return false;
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

/* ══════════════════════════════════════════════
   Clock Time Picker
══════════════════════════════════════════════ */
/* ── Slot-aware Clock Time Picker ──
   slotStart/slotEnd: "HH:MM" strings — only hours within range are enabled.
   isToday: passed times are also disabled.
*/
const ClockTimePicker = ({ value, onChange, disabled, slotStart, slotEnd, isToday }) => {
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
    if (value && value !== lastEmitted.current) {
      const p = parseTime(value); selRef.current = p; setSel(p);
    }
  }, [value]);

  const to24 = (h, m, ampm) => {
    let hh = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    return `${pad(hh)}:${pad(m)}`;
  };

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setMode("hour"); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── Slot constraints ── */
  const slotH24Start = slotStart ? parseInt(slotStart.split(":")[0]) : null;
  const slotH24End = slotEnd ? parseInt(slotEnd.split(":")[0]) : null;
  const nowH = new Date().getHours();
  const nowM = new Date().getMinutes();

  const isHourDisabled = (h, ampm) => {
    if (disabled) return true;
    const h24 = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    if (slotH24Start !== null && slotH24End !== null) {
      if (h24 < slotH24Start || h24 >= slotH24End) return true;
    }
    if (isToday && h24 < nowH) return true;
    return false;
  };

  const isMinDisabled = (m) => {
    if (disabled) return true;
    const cur = selRef.current;
    const h24 = cur.ampm === "PM" ? (cur.h === 12 ? 12 : cur.h + 12) : (cur.h === 12 ? 0 : cur.h);
    if (isToday && h24 === nowH && m <= nowM) return true;
    return false;
  };

  const CLOCK_R = 100; const CENTER = 110; const HOUR_R = 78; const MIN_R = 78;
  const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const hourAngle = (h) => ((h % 12) / 12) * 360 - 90;
  const minAngle = (m) => (m / 60) * 360 - 90;
  const polarToXY = (angle, r) => ({
    x: CENTER + r * Math.cos((angle * Math.PI) / 180),
    y: CENTER + r * Math.sin((angle * Math.PI) / 180),
  });

  const emit = (ns) => {
    const v = to24(ns.h, ns.m, ns.ampm); lastEmitted.current = v; onChange(v);
  };
  const selectHour = (h) => { if (isHourDisabled(h, selRef.current.ampm)) return; const ns = { ...selRef.current, h }; selRef.current = ns; setSel(ns); emit(ns); setTimeout(() => setMode("minute"), 200); };
  const selectMinute = (m) => { if (isMinDisabled(m)) return; const ns = { ...selRef.current, m }; selRef.current = ns; setSel(ns); emit(ns); setTimeout(() => { setOpen(false); setMode("hour"); }, 200); };
  const toggleAmpm = (ap) => { const ns = { ...selRef.current, ampm: ap }; selRef.current = ns; setSel(ns); emit(ns); };

  // Full sweep drag support
  const isDragging = useRef(false);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const getAngleFromEvent = (e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left - CENTER;
    const y = clientY - rect.top - CENTER;
    const angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    return ((angle % 360) + 360) % 360;
  };

  const applyAngle = (norm) => {
    if (modeRef.current === "hour") {
      const h = Math.round(norm / 30) % 12 || 12;
      if (!isHourDisabled(h, selRef.current.ampm)) {
        const ns = { ...selRef.current, h }; selRef.current = ns; setSel(ns); emit(ns);
      }
    } else {
      const snapped = Math.round(Math.round(norm / 6) % 60 / 5) * 5 % 60;
      if (!isMinDisabled(snapped)) {
        const ns = { ...selRef.current, m: snapped }; selRef.current = ns; setSel(ns); emit(ns);
      }
    }
  };

  const handleSvgMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    const norm = getAngleFromEvent(e);
    if (norm !== null) applyAngle(norm);
  };

  const handleSvgTouchStart = (e) => {
    isDragging.current = true;
    const norm = getAngleFromEvent(e);
    if (norm !== null) applyAngle(norm);
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const norm = getAngleFromEvent(e);
      if (norm !== null) applyAngle(norm);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (modeRef.current === "hour") setTimeout(() => setMode("minute"), 150);
      else setTimeout(() => { setOpen(false); setMode("hour"); }, 150);
    };
    const onTouchMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const norm = getAngleFromEvent(e);
      if (norm !== null) applyAngle(norm);
    };
    const onTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (modeRef.current === "hour") setTimeout(() => setMode("minute"), 150);
      else setTimeout(() => { setOpen(false); setMode("hour"); }, 150);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const displayVal = value
    ? (() => { const [hh, mm] = value.split(":").map(Number); return `${hh % 12 || 12}:${pad(mm)} ${hh >= 12 ? "PM" : "AM"}`; })()
    : (slotStart && slotEnd ? `${slotStart}–${slotEnd}` : "Select time");

  const handAngle = mode === "hour" ? hourAngle(sel.h) : minAngle(sel.m);
  const handTip = polarToXY(handAngle, mode === "hour" ? HOUR_R - 14 : MIN_R - 14);

  /* Show slot hint banner inside picker */
  const slotHint = slotStart && slotEnd
    ? `Slot: ${slotStart} – ${slotEnd}`
    : null;

  return (
    <div className="ctp-wrap" ref={ref}>
      <button type="button" className={`ctp-trigger${disabled ? " ctp-disabled" : ""}`}
        onClick={() => !disabled && setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span className={`ctp-val${!value ? " ctp-placeholder" : ""}`}>{displayVal}</span>
        <span style={{ marginLeft: "auto", opacity: .4, fontSize: 11 }}>▾</span>
      </button>
      {open && !disabled && (
        <div className="ctp-popup">
          {slotHint && (
            <div style={{ fontSize: 11, fontWeight: 600, color: "#2980b9", background: "#eff6ff", borderRadius: 6, padding: "4px 10px", marginBottom: 8, textAlign: "center" }}>
              {slotHint} — hours outside this range are disabled
            </div>
          )}
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
            onMouseDown={handleSvgMouseDown}
            onTouchStart={handleSvgTouchStart}
            style={{ touchAction: "none", cursor: "crosshair" }}>
            <circle cx={CENTER} cy={CENTER} r={CLOCK_R} fill="#f8f9fa" stroke="#e5e7eb" strokeWidth="1.5" />
            <line x1={CENTER} y1={CENTER} x2={handTip.x} y2={handTip.y} stroke="#1dd1a1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={CENTER} cy={CENTER} r="4" fill="#1dd1a1" />
            <circle cx={handTip.x} cy={handTip.y} r="16" fill="#1dd1a1" opacity="0.18" />
            <circle cx={handTip.x} cy={handTip.y} r="4" fill="#1dd1a1" />
            {mode === "hour" && hours12.map(h => {
              const ang = hourAngle(h); const pos = polarToXY(ang, HOUR_R);
              const isSel = sel.h === h;
              const isDis = isHourDisabled(h, sel.ampm);
              return (
                <g key={h} onClick={() => !isDis && selectHour(h)} style={{ cursor: isDis ? "not-allowed" : "pointer" }}>
                  <circle cx={pos.x} cy={pos.y} r="16" fill={isSel ? "#1dd1a1" : isDis ? "#f3f4f6" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="13"
                    fontWeight={isSel ? "700" : "400"} fill={isSel ? "#fff" : isDis ? "#d1d5db" : "#333"}>{h}</text>
                </g>
              );
            })}
            {mode === "minute" && minutes.map(m => {
              const ang = minAngle(m); const pos = polarToXY(ang, MIN_R);
              const isSel = sel.m === m;
              const isDis = isMinDisabled(m);
              return (
                <g key={m} onClick={() => !isDis && selectMinute(m)} style={{ cursor: isDis ? "not-allowed" : "pointer" }}>
                  <circle cx={pos.x} cy={pos.y} r="16" fill={isSel ? "#1dd1a1" : isDis ? "#f3f4f6" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="12"
                    fontWeight={isSel ? "700" : "400"} fill={isSel ? "#fff" : isDis ? "#d1d5db" : "#333"}>{pad(m)}</text>
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

/* ══════════════════════════════════════════════
   Sort config
══════════════════════════════════════════════ */
const SORT_FIELDS = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "guests", label: "Guests" },
  { key: "status", label: "Status" },
];

/* ══════════════════════════════════════════════
   Image Upload helper (returns base64 data-URL)
══════════════════════════════════════════════ */
const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("File read failed"));
    r.readAsDataURL(file);
  });

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
const Reservations = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Filter state ──
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterSlots, setFilterSlots] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set());
  const [filterSources, setFilterSources] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");

  // ── Call history ──
  const [callHistory, setCallHistory] = useState({});
  const [callTooltipId, setCallTooltipId] = useState(null);

  // ── Table preference management ──
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefList, setPrefList] = useState(DEFAULT_PREF_OPTIONS.map(p => p.label));
  const [prefImages, setPrefImages] = useState({}); // { label: base64DataURL }
  const [prefDescs, setPrefDescs] = useState({}); // { label: description string }
  const [prefDbRecords, setPrefDbRecords] = useState([]); // raw records from /tablePreferences
  const [newPrefInput, setNewPrefInput] = useState("");
  const [newPrefDesc, setNewPrefDesc] = useState("");
  const [newPrefImage, setNewPrefImage] = useState(null); // base64 for the new pref
  const [prefSaving, setPrefSaving] = useState(false);
  const newPrefImgRef = useRef(null);
  const editImgRefs = useRef({});       // refs for existing pref image inputs

  /* ── Fetch tablePreferences from db.json on mount ── */
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const res = await api.get("/tablePreferences");
        const records = res.data || [];
        if (records.length > 0) {
          const sorted = [...records].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          setPrefDbRecords(sorted);
          setPrefList(sorted.map(r => r.label));
          const imgs = {};
          const descs = {};
          sorted.forEach(r => {
            if (r.image) imgs[r.label] = r.image;
            if (r.desc) descs[r.label] = r.desc;
          });
          setPrefImages(imgs);
          setPrefDescs(descs);
        }
      } catch {
        // Fallback to defaults if endpoint not available
      }
    };
    loadPrefs();
  }, []);

  // ── Create modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ── Table pref image upload inside create form ──
  const [tablePrefImageFile, setTablePrefImageFile] = useState(null); // { label, dataURL }
  const createImgRef = useRef(null);

  const data = adminData?.reservations || [];
  const tables = (adminData?.tables?.[0]?.list || []).map(Number).sort((a, b) => a - b);
  const staff = adminData?.staff || [];

  /* Build full PREF_OPTIONS with custom images and descriptions */
  const PREF_OPTIONS = prefList.map(label => {
    const found = DEFAULT_PREF_OPTIONS.find(p => p.label === label);
    const img = prefImages[label];
    const desc = prefDescs[label] || found?.desc || "";
    if (img) {
      return {
        label,
        desc,
        svg: <img src={img} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />,
      };
    }
    return found ? { ...found, desc } : { label, desc, svg: <span style={{ fontSize: 22 }}>🪑</span> };
  });

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const assignedTables = useMemo(() => {
    const targetDate = form.date || todayStr();
    return new Set(data.filter(r => r.date === targetDate && r.tableNo).map(r => String(r.tableNo)));
  }, [data, form.date]);

  /* ── Filter data (all 5 slots) ── */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterDate) d = d.filter(r => r.date === filterDate);
    if (filterSlots.size > 0) {
      d = d.filter(r => {
        const key = resolveSlotKey(r);
        return key && filterSlots.has(key);
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
  }, [data, filterDate, filterSlots, filterStatuses, filterSources, search]);

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

  /* ── Status / table update ── */
  const updateStatus = async (e, id, status) => {
    e.stopPropagation();
    const prev = (adminData.reservations || []).find(r => r.id === id);
    if (!prev) return;
    setAdminData(p => ({ ...p, reservations: p.reservations.map(r => r.id === id ? { ...r, status } : r) }));
    try {
      try { await api.patch(`/reservations/${id}`, { status }); }
      catch { await api.put(`/reservations/${id}`, { ...prev, status }); }
      toast.success(`Status updated to ${status}`);
    } catch {
      setAdminData(p => ({ ...p, reservations: p.reservations.map(r => r.id === id ? prev : r) }));
      toast.error("Failed to update status");
    }
  };

  const updateTable = async (e, id, tableNo) => {
    e.stopPropagation();
    const prev = (adminData.reservations || []).find(r => r.id === id);
    if (!prev) return;
    setAdminData(p => ({ ...p, reservations: (p.reservations || []).map(r => r.id === id ? { ...r, tableNo } : r) }));
    try {
      try { await api.patch(`/reservations/${id}`, { tableNo }); }
      catch { await api.put(`/reservations/${id}`, { ...prev, tableNo }); }
      toast.success(tableNo ? `Table T-${tableNo} assigned.` : "Table unassigned.");
    } catch {
      setAdminData(p => ({ ...p, reservations: (p.reservations || []).map(r => r.id === id ? prev : r) }));
      toast.error("Failed to assign table.");
    }
  };

  const handleCall = (e, id) => {
    e.stopPropagation();
    setCallHistory(prev => ({ ...prev, [id]: [...(prev[id] || []), new Date().toISOString()] }));
    toast.success("Call logged!");
  };

  const setF = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormErrors(e => ({ ...e, [key]: "" })); };

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

  /* ── Create reservation (includes tablePrefImage in payload) ── */
  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const id = `res_${Date.now()}`;
      const payload = {
        id,
        ...form,
        status: form.status || "pending",
        createdAt: new Date().toISOString(),
        // store uploaded image (base64) so it persists in db.json
        tablePrefImage: tablePrefImageFile || null,
      };
      await api.post("/reservations", payload);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, reservations: [...(p.reservations || []), payload] }));
      }
      toast.success("Reservation created successfully.");
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      setTablePrefImageFile(null);
    } catch {
      toast.error("Failed to create reservation.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Table preference image handlers ── */
  const handlePrefImageUpload = async (label, file) => {
    if (!file) return;
    try {
      const dataURL = await readFileAsDataURL(file);
      setPrefImages(p => ({ ...p, [label]: dataURL }));
      // Also update in-memory db record so Save will persist it
      setPrefDbRecords(prev => prev.map(r => r.label === label ? { ...r, image: dataURL } : r));
      toast.success(`Image updated for "${label}" — click Save to persist`);
    } catch {
      toast.error("Failed to read image");
    }
  };

  const handleAddPref = async () => {
    const v = newPrefInput.trim();
    if (!v || prefList.includes(v)) return;
    const newRecord = {
      id: `pref_${Date.now()}`,
      label: v,
      desc: newPrefDesc.trim(),
      order: prefList.length,
      image: newPrefImage || null,
      isDefault: false,
    };
    if (newPrefImage) setPrefImages(p => ({ ...p, [v]: newPrefImage }));
    if (newPrefDesc.trim()) setPrefDescs(p => ({ ...p, [v]: newPrefDesc.trim() }));
    setPrefList(p => [...p, v]);
    setPrefDbRecords(p => [...p, newRecord]);
    setNewPrefInput("");
    setNewPrefDesc("");
    setNewPrefImage(null);
  };

  const handleRemovePref = (label) => {
    if (label === "Any") return;
    setPrefList(p => p.filter(l => l !== label));
    setPrefImages(p => { const n = { ...p }; delete n[label]; return n; });
    setPrefDescs(p => { const n = { ...p }; delete n[label]; return n; });
    setPrefDbRecords(p => p.filter(r => r.label !== label));
  };

  /* ── Save all preferences to /tablePreferences in db.json ── */
  const handleSavePrefs = async () => {
    setPrefSaving(true);
    try {
      // Build the final records list (merge UI state into records)
      const finalRecords = prefList.map((label, idx) => {
        const existing = prefDbRecords.find(r => r.label === label);
        return {
          id: existing?.id || `pref_${Date.now()}_${idx}`,
          label,
          desc: prefDescs[label] || existing?.desc || DEFAULT_PREF_OPTIONS.find(p => p.label === label)?.desc || "",
          order: idx,
          image: prefImages[label] || existing?.image || null,
          isDefault: existing?.isDefault ?? false,
        };
      });

      // Fetch current records to know which exist vs which are new
      let existingIds = new Set();
      try {
        const cur = await api.get("/tablePreferences");
        (cur.data || []).forEach(r => existingIds.add(r.id));
      } catch { }

      for (const rec of finalRecords) {
        if (existingIds.has(rec.id)) {
          try { await api.put(`/tablePreferences/${rec.id}`, rec); } catch { }
        } else {
          try { await api.post("/tablePreferences", rec); } catch { }
        }
      }

      // Delete removed records
      for (const id of existingIds) {
        if (!finalRecords.find(r => r.id === id)) {
          try { await api.delete(`/tablePreferences/${id}`); } catch { }
        }
      }

      setPrefDbRecords(finalRecords);
      toast.success("Table preferences saved!");
      setShowPrefModal(false);
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setPrefSaving(false);
    }
  };

  /* ── Create form table pref image ── */
  const handleCreateTablePrefImage = async (file) => {
    if (!file) return;
    try {
      const dataURL = await readFileAsDataURL(file);
      setTablePrefImageFile(dataURL);
      toast.success("Image ready to upload with reservation");
    } catch {
      toast.error("Failed to read image");
    }
  };

  const activeFilters = filterDate || filterSlots.size > 0 || filterStatuses.size > 0 || filterSources.size > 0 || search.trim();

  const SortTh = ({ field, children }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}
      <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
        {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );

  const availableTablesForForm = tables.filter(t => {
    const tStr = String(t);
    if (form.tableNo && String(form.tableNo) === tStr) return true;
    return !assignedTables.has(tStr);
  });

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="evt-res-page">

      {/* HEADER */}
      <div className="evt-res-header">
        <div>
          <h2 className="evt-res-title">Reservations</h2>
          <p className="evt-res-subtitle">Manage table bookings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="evt-res-pref-manage-btn" onClick={() => setShowPrefModal(true)}>
            🪑 Table Preferences
          </button>
          <button className="evt-res-create-btn"
            onClick={() => { setShowCreate(true); setForm({ ...EMPTY_FORM }); setTablePrefImageFile(null); }}>
            + Add Reservation
          </button>
        </div>
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

      {/* ── Filter bar ── */}
      <div className="evt-res-filter-bar">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="evt-res-search" placeholder="Search name / mobile / ID..."
            value={search} onChange={e => setSearch(e.target.value)} />

          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Date</span>
            <div style={{ minWidth: 160 }}>
              <CustomDatePicker value={filterDate} onChange={setFilterDate} placeholder="All dates" />
            </div>
            {filterDate && (
              <button className="evt-res-filter-btn" onClick={() => setFilterDate("")} title="Clear date">✕</button>
            )}
          </div>
        </div>

        <div className="evt-res-filter-groups">

          {/* ── All 5 Slots ── */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Slot</span>
            {SLOT_GROUPS.map(sg => (
              <button key={sg.key} title={`${sg.label} (${sg.start}–${sg.end})`}
                className={`evt-res-filter-btn ${filterSlots.has(sg.key) ? "active" : ""}`}
                onClick={() => toggleSet(setFilterSlots, sg.key)}>
                {sg.short}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Status</span>
            {[
              ["pending", "P", "status-pending", "Pending"],
              ["confirmed", "C", "status-confirmed", "Confirmed"],
              ["completed", "D", "status-completed", "Done"],
              ["cancelled", "X", "status-cancelled", "Cancelled"],
            ].map(([key, short, cls, title]) => (
              <button key={key} title={title}
                className={`evt-res-filter-btn ${filterStatuses.has(key) ? "active " + cls : ""}`}
                onClick={() => toggleSet(setFilterStatuses, key)}>{short}</button>
            ))}
          </div>

          {/* Source */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Source</span>
            {SOURCE_OPTIONS.map(s => (
              <button key={s.label} title={s.label}
                className={`evt-res-filter-btn ${filterSources.has(s.label) ? "active" : ""}`}
                onClick={() => toggleSet(setFilterSources, s.label)}>{s.icon}</button>
            ))}
          </div>

          {activeFilters && (
            <button className="evt-res-clear-all" onClick={() => {
              setSearch(""); setFilterDate(todayStr());
              setFilterSlots(new Set()); setFilterStatuses(new Set()); setFilterSources(new Set());
            }}>Clear</button>
          )}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="evt-res-table-wrapper">
        <table className="evt-res-table">
          <thead>
            <tr>
              <SortTh field="name">Guest Name</SortTh>
              <th>Contact</th>
              <th>Source</th>
              <SortTh field="date">Reserved Date</SortTh>
              <th>Booked On</th>
              <th>Slot</th>
              <th>Time</th>
              <SortTh field="guests">Guests</SortTh>
              <th>Table Pref</th>
              <th>Table</th>
              <th>Incharge</th>
              <SortTh field="status">Status</SortTh>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="13" className="evt-res-empty">No reservations found</td></tr>
            ) : (
              sortedData.map(item => {
                const status = item.status || "pending";
                const rowDate = item.date || todayStr();
                const slotKey = resolveSlotKey(item);
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";

                const assignedForDate = new Set(
                  data.filter(r => r.date === rowDate && r.tableNo && r.id !== item.id).map(r => String(r.tableNo))
                );
                const rowAvailTables = tables.filter(t => {
                  const tStr = String(t);
                  if (item.tableNo && String(item.tableNo) === tStr) return true;
                  return !assignedForDate.has(tStr);
                });
                const history = callHistory[item.id] || [];

                return (
                  <tr key={item.id} className="evt-res-row clickable"
                    onClick={() => navigate(`/reservations/${item.id}`)}>

                    {/* Guest name */}
                    <td>
                      <div className="evt-res-name-cell">
                        {item.tablePrefImage
                          ? <img src={item.tablePrefImage} alt="pref" className="evt-res-avatar-img" />
                          : <div className="evt-res-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        }
                        <div>
                          <div className="evt-res-name">{item.name || "—"}</div>
                          <div className="evt-res-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="evt-res-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-res-email">{item.email}</span>}
                      </div>
                    </td>

                    {/* Source */}
                    <td><span className="evt-res-source">{item.source || "—"}</span></td>

                    {/* Reserved date */}
                    <td style={{ fontWeight: 600 }}>{item.reservedDate || item.date || "—"}</td>

                    {/* Booked on */}
                    <td style={{ fontSize: 12, color: "#666" }}>{item.bookedDate || "—"}</td>

                    {/* Slot */}
                    <td>
                      <span className={`evt-res-slot-badge slot-${slotKey?.toLowerCase() || "any"}`}>
                        {slotLabel}
                      </span>
                    </td>

                    {/* Time */}
                    <td>{fmtTime(item.time)}</td>

                    {/* Guests */}
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.guests || 1}</td>

                    {/* Table Preference (with image thumbnail if set) */}
                    <td>
                      <div className="evt-res-tpref-cell">
                        {item.tablePrefImage
                          ? <img src={item.tablePrefImage} alt={item.tablePref} className="evt-res-tpref-thumb" />
                          : null}
                        <span>{item.tablePref || "—"}</span>
                      </div>
                    </td>

                    {/* Table assign */}
                    <td onClick={e => e.stopPropagation()}>
                      <select className="evt-res-table-select" value={item.tableNo || ""}
                        onChange={e => updateTable(e, item.id, e.target.value)}>
                        <option value="">— Table —</option>
                        {rowAvailTables.map(t => <option key={t} value={t}>T-{t}</option>)}
                      </select>
                    </td>

                    {/* Incharge */}
                    <td style={{ fontSize: 12, color: "#666" }}>{item.inchargePerson || "—"}</td>

                    {/* Status */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-res-inline-status">
                        {["pending", "confirmed", "completed", "cancelled"].map(s => (
                          <button key={s}
                            className={`evt-res-istatus-btn evt-res-istatus-${s}${status === s ? " active" : ""}`}
                            title={s}
                            onClick={e => updateStatus(e, item.id, s)}>
                            {s === "pending" ? "P" : s === "confirmed" ? "C" : s === "completed" ? "D" : "X"}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-res-call-wrap"
                        onMouseEnter={() => history.length > 0 && setCallTooltipId(item.id)}
                        onMouseLeave={() => setCallTooltipId(null)}>
                        <button className="evt-res-act-btn evt-res-act-remind"
                          onClick={e => handleCall(e, item.id)} title="Log a call">
                          📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                        </button>
                        {callTooltipId === item.id && history.length > 0 && (
                          <div className="evt-res-call-tooltip">
                            <div className="evt-res-call-tooltip-title">📞 Call History</div>
                            {history.map((ts, i) => (
                              <div key={i} className="evt-res-call-tooltip-row">{fmtDateTime(ts)}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ══ Table Preference Manager Modal ══ */}
      {showPrefModal && (
        <div className="ingredient-modal-overlay" onClick={() => setShowPrefModal(false)}>
          <div className="ingredient-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="ingredient-modal-header">
              <h3>Table Preferences</h3>
              <button className="ingredient-close-btn" onClick={() => setShowPrefModal(false)} />
            </div>
            <div className="ingredient-modal-body" style={{ padding: "16px 0" }}>
              <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
                Manage seating preference options shown in the reservation form. Changes are saved to the database when you click <strong>Save &amp; Close</strong>.
              </p>

              {/* Existing preferences */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {prefList.map(label => (
                  <div key={label} className="evt-res-pref-manage-row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {/* Preview thumbnail */}
                    <div className="evt-res-pref-manage-preview">
                      {prefImages[label]
                        ? <img src={prefImages[label]} alt={label} className="evt-res-pref-thumb-sm" />
                        : <div className="evt-res-pref-thumb-sm evt-res-pref-thumb-empty">
                          {DEFAULT_PREF_OPTIONS.find(p => p.label === label)?.svg || "🪑"}
                        </div>
                      }
                    </div>

                    {/* Label + editable description */}
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🪑 {label}</div>
                      <input
                        className="evt-res-form-input"
                        style={{ marginTop: 4, fontSize: 12, padding: "3px 8px" }}
                        placeholder="Short description (shown to users)"
                        value={prefDescs[label] || ""}
                        onChange={e => {
                          const v = e.target.value;
                          setPrefDescs(p => ({ ...p, [label]: v }));
                          setPrefDbRecords(prev => prev.map(r => r.label === label ? { ...r, desc: v } : r));
                        }}
                      />
                    </div>

                    {/* Upload image button */}
                    <input
                      type="file" accept="image/*"
                      ref={el => editImgRefs.current[label] = el}
                      style={{ display: "none" }}
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (f) await handlePrefImageUpload(label, f);
                      }}
                    />
                    <button className="evt-res-upload-img-btn"
                      onClick={() => editImgRefs.current[label]?.click()}>
                      📷 {prefImages[label] ? "Change" : "Add Image"}
                    </button>
                    {prefImages[label] && (
                      <button className="evt-res-pref-remove-btn" title="Remove image"
                        onClick={() => {
                          setPrefImages(p => { const n = { ...p }; delete n[label]; return n; });
                          setPrefDbRecords(prev => prev.map(r => r.label === label ? { ...r, image: null } : r));
                        }}>🗑</button>
                    )}
                    {label !== "Any" && (
                      <button className="evt-res-pref-remove-btn" title="Remove preference" onClick={() => handleRemovePref(label)}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new preference */}
              <div style={{ marginTop: 18, borderTop: "1px dashed #e5e7eb", paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Add New Preference</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    className="evt-res-form-input" style={{ flex: 1, minWidth: 120 }}
                    placeholder="Label e.g. Outdoor, Rooftop"
                    value={newPrefInput}
                    onChange={e => setNewPrefInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddPref()}
                  />
                  <input
                    className="evt-res-form-input" style={{ flex: 1.5, minWidth: 140 }}
                    placeholder="Description (optional)"
                    value={newPrefDesc}
                    onChange={e => setNewPrefDesc(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddPref()}
                  />
                  {/* New pref image */}
                  <input type="file" accept="image/*" ref={newPrefImgRef} style={{ display: "none" }}
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) { const d = await readFileAsDataURL(f); setNewPrefImage(d); }
                    }} />
                  <button className="evt-res-upload-img-btn" onClick={() => newPrefImgRef.current?.click()}>
                    📷 {newPrefImage ? "✓ Image" : "Image"}
                  </button>
                  <button className="evt-res-create-btn" style={{ whiteSpace: "nowrap" }} onClick={handleAddPref}>
                    + Add
                  </button>
                </div>
                {newPrefImage && (
                  <img src={newPrefImage} alt="preview" style={{ marginTop: 8, height: 48, borderRadius: 6, objectFit: "cover" }} />
                )}
              </div>
            </div>
            <div className="ingredient-modal-footer">
              <div className="form-actions">
                <button onClick={handleSavePrefs} disabled={prefSaving} style={{ background: "#1dd1a1", color: "#fff", fontWeight: 700 }}>
                  {prefSaving ? "Saving..." : "💾 Save & Close"}
                </button>
                <button onClick={() => setShowPrefModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Create Reservation Modal ══ */}
      {showCreate && (
        <div className="ingredient-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="ingredient-modal" style={{ width: 620 }} onClick={e => e.stopPropagation()}>
            <div className="ingredient-modal-header">
              <h3>Add Reservation</h3>
              <button className="ingredient-close-btn" onClick={() => setShowCreate(false)} />
            </div>

            <div className="ingredient-modal-body" style={{ padding: "8px 0" }}>

              {/* ── Guest Information ── */}
              <div className="evt-res-form-section-label">Guest Information</div>

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
                    <button type="button" onClick={() => setF("guests", Math.min(30, form.guests + 1))}>+</button>
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

              {/* ── Booking Dates ── */}
              <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Booking Dates</div>

              <div className="horizontal-form-group">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>
                    Booked On
                    <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginLeft: 4 }}>
                      (date reservation was made)
                    </span>
                  </label>
                  <CustomDatePicker
                    value={form.bookedDate}
                    onChange={v => setF("bookedDate", v)}
                    placeholder="Booking date"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>
                    Reserved For <span className="evt-res-req">*</span>
                    <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginLeft: 4 }}>
                      (table reservation date)
                    </span>
                  </label>
                  <CustomDatePicker
                    value={form.reservedDate}
                    min={todayStr()}
                    onChange={v => { setF("reservedDate", v); setF("date", v); }}
                    placeholder="Reserved date"
                  />
                  {formErrors.date && <span className="evt-res-form-error">{formErrors.date}</span>}
                </div>
              </div>

              {/* ── Booking Details ── */}
              <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Booking Details</div>

              {/* Slot FIRST — constrains the time picker */}
              <div className="form-group">
                <label>Dining Slot <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(select to restrict time picker)</span></label>
                <div className="evt-res-slot-grid">
                  {SLOT_GROUPS.map(sg => (
                    <button key={sg.key} type="button"
                      className={`evt-res-slot-chip ${form.slotGroup === sg.key ? "active" : ""}`}
                      onClick={() => { setF("slotGroup", sg.key); setF("time", ""); }}>
                      <span className="evt-res-slot-chip-label">{sg.label}</span>
                      <span className="evt-res-slot-chip-time">{sg.start}–{sg.end}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="horizontal-form-group">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>
                    Time <span className="evt-res-req">*</span>
                    {form.slotGroup && (() => { const sg = SLOT_GROUPS.find(s => s.key === form.slotGroup); return sg ? <span style={{ fontSize: 11, color: "#2980b9", fontWeight: 500, marginLeft: 6 }}>({sg.start}–{sg.end})</span> : null; })()}
                  </label>
                  <ClockTimePicker
                    value={form.time}
                    onChange={v => setF("time", v)}
                    slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                    slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                    isToday={form.reservedDate === todayStr()}
                  />
                  {formErrors.time && <span className="evt-res-form-error">{formErrors.time}</span>}
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>
                    Table No.
                    <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginLeft: 4 }}>(available)</span>
                  </label>
                  <select value={form.tableNo} onChange={e => setF("tableNo", e.target.value)}>
                    <option value="">— No table —</option>
                    {availableTablesForForm.map(t => <option key={t} value={t}>Table {t}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Table Preference with Image Upload ── */}
              <div className="form-group">
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

                {/* Upload a custom image for this reservation's table pref */}
                <div className="evt-res-pref-img-upload-row">
                  <span style={{ fontSize: 12, color: "#555" }}>Attach table preference photo:</span>
                  <input type="file" accept="image/*" ref={createImgRef} style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCreateTablePrefImage(f); }} />
                  <button type="button" className="evt-res-upload-img-btn"
                    onClick={() => createImgRef.current?.click()}>
                    📷 {tablePrefImageFile ? "✓ Image attached" : "Upload Image"}
                  </button>
                  {tablePrefImageFile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <img src={tablePrefImageFile} alt="preview"
                        style={{ height: 40, borderRadius: 6, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                      <button type="button" className="evt-res-pref-remove-btn"
                        onClick={() => setTablePrefImageFile(null)}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Staff & Source ── */}
              <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Staff &amp; Source</div>

              <div className="horizontal-form-group">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Source</label>
                  <div className="evt-res-source-chips">
                    {SOURCE_OPTIONS.map(s => (
                      <button key={s.label} type="button"
                        className={`evt-res-source-chip ${form.source === s.label ? "active" : ""}`}
                        onClick={() => setF("source", s.label)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Status</label>
                  <div className="evt-res-source-chips">
                    {["pending", "confirmed"].map(s => (
                      <button key={s} type="button"
                        className={`evt-res-source-chip ${form.status === s ? "active status-" + s : ""}`}
                        onClick={() => setF("status", s)}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Staff Incharge</label>
                {staff.length > 0 ? (
                  <select value={form.inchargePerson} onChange={e => setF("inchargePerson", e.target.value)}>
                    <option value="">— Assign staff —</option>
                    {staff.map(s => <option key={s.id || s.name} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>)}
                  </select>
                ) : (
                  <input placeholder="Staff name" value={form.inchargePerson}
                    onChange={e => setF("inchargePerson", e.target.value)} />
                )}
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea rows={2} placeholder="Special requests, dietary restrictions..."
                  value={form.notes} onChange={e => setF("notes", e.target.value)} />
              </div>
            </div>

            <div className="ingredient-modal-footer">
              <div className="form-actions">
                <button onClick={handleCreate} disabled={saving}>
                  {saving ? "Saving..." : "Create Reservation"}
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

export default Reservations;