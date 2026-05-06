import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./PreBookings.css";
import { useToast } from "../../useToast";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", short: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", short: "Br", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", short: "Lu", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", short: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", short: "Di", start: "18:30", end: "22:00" },
];

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

const resolveSlotKey = (r) => r.slotGroup || timeToSlotKey(r.time);

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

/* ══════════════════════════════════════════════
   Mini Date Picker (filter bar + modal)
══════════════════════════════════════════════ */
const MONTHS_CDP = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MiniDatePicker = ({ value, onChange, placeholder = "Select date", min, hasError }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const parsed = value ? new Date(value) : new Date();
  const [view, setView] = useState("day");
  const [calYear, setCalYear] = useState(parsed.getFullYear());
  const [calMonth, setCalMonth] = useState(parsed.getMonth());

  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  React.useEffect(() => {
    if (value) { const p = new Date(value); setCalYear(p.getFullYear()); setCalMonth(p.getMonth()); }
  }, [value]);

  const minD = min ? new Date(min + "T00:00:00") : null;
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isDisabled = (d) => { if (!minD) return false; return new Date(`${calYear}-${pad(calMonth + 1)}-${pad(d)}T00:00:00`) < minD; };
  const select = (d) => { onChange(`${calYear}-${pad(calMonth + 1)}-${pad(d)}`); setOpen(false); };
  const displayVal = value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder;
  const yearRange = Array.from({ length: 20 }, (_, i) => calYear - 5 + i);

  return (
    <div className="res-wrap" ref={ref} style={{ position: "relative", display: "block" }}>
      <button type="button"
        className={`res-trigger evt-res-res-trigger${hasError ? " error" : ""}`}
        onClick={() => { setOpen(o => !o); setView("day"); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
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
              {view === "day" && (<><button type="button" className="res-nav-lbl" onClick={() => setView("month")}>{MONTHS_CDP[calMonth]}</button><button type="button" className="res-nav-lbl" onClick={() => setView("year")}>{calYear}</button></>)}
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
                const sel = ds === value, tod = ds === todayStr(), dis = isDisabled(d);
                return <button type="button" key={i} className={`res-day${sel ? " res-sel" : ""}${tod && !sel ? " res-today" : ""}${dis ? " res-dis" : ""}`} disabled={dis} onClick={() => !dis && select(d)}>{d}</button>;
              })}
            </div>
          </>)}
          {view === "month" && <div className="res-month-grid">{MONTHS_CDP.map((m, i) => <button type="button" key={i} className={`res-month-btn${i === calMonth ? " res-sel" : ""}`} onClick={() => { setCalMonth(i); setView("day"); }}>{m.slice(0, 3)}</button>)}</div>}
          {view === "year" && <div className="res-year-grid">{yearRange.map(y => <button type="button" key={y} className={`res-year-btn${y === calYear ? " res-sel" : ""}`} onClick={() => { setCalYear(y); setView("month"); }}>{y}</button>)}</div>}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Clock Time Picker (admin modal)
══════════════════════════════════════════════ */
const ClockTimePicker = ({ value, onChange, slotStart, slotEnd, disabled }) => {
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
  const emit = (ns) => { const v = to24(ns.h, ns.m, ns.ampm); lastEmitted.current = v; onChange(v); };

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setMode("hour"); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const slotH24Start = slotStart ? parseInt(slotStart.split(":")[0]) : null;
  const slotH24End = slotEnd ? parseInt(slotEnd.split(":")[0]) : null;

  const isHourDis = (h, ampm) => {
    const h24 = ampm === "PM" ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
    if (slotH24Start !== null && slotH24End !== null && (h24 < slotH24Start || h24 >= slotH24End)) return true;
    return false;
  };

  const CLOCK_R = 100, CENTER = 110, HOUR_R = 78, MIN_R = 78;
  const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const hourAngle = (h) => ((h % 12) / 12) * 360 - 90;
  const minAngle = (m) => (m / 60) * 360 - 90;
  const toXY = (angle, r) => ({ x: CENTER + r * Math.cos(angle * Math.PI / 180), y: CENTER + r * Math.sin(angle * Math.PI / 180) });

  const isDragging = useRef(false);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const valueFromEvent = (e) => {
    const svg = svgRef.current; if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const src = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
    const x = src.clientX - rect.left - CENTER, y = src.clientY - rect.top - CENTER;
    const norm = ((Math.atan2(y, x) * 180 / Math.PI + 90) % 360 + 360) % 360;
    if (modeRef.current === "hour") { const h = Math.round(norm / 30) % 12 || 12; return isHourDis(h, selRef.current.ampm) ? null : { kind: "hour", h }; }
    else { const snapped = Math.round(Math.round(norm / 6) / 5) * 5 % 60; return { kind: "min", m: snapped }; }
  };
  const applyVal = (v) => { if (!v) return; const ns = v.kind === "hour" ? { ...selRef.current, h: v.h } : { ...selRef.current, m: v.m }; selRef.current = ns; setSel({ ...ns }); emit(ns); };
  const onPointerDown = (e) => { e.preventDefault(); isDragging.current = true; svgRef.current?.setPointerCapture?.(e.pointerId); applyVal(valueFromEvent(e)); };
  const onPointerMove = (e) => { if (!isDragging.current) return; applyVal(valueFromEvent(e)); };
  const onPointerUp = (e) => { if (!isDragging.current) return; isDragging.current = false; applyVal(valueFromEvent(e)); if (modeRef.current === "hour") { modeRef.current = "minute"; setMode("minute"); } else { setOpen(false); modeRef.current = "hour"; setMode("hour"); } };

  const tapHour = (h) => { if (isHourDis(h, selRef.current.ampm)) return; const ns = { ...selRef.current, h }; selRef.current = ns; setSel({ ...ns }); emit(ns); setMode("minute"); };
  const tapMinute = (m) => { const ns = { ...selRef.current, m }; selRef.current = ns; setSel({ ...ns }); emit(ns); setOpen(false); setMode("hour"); };
  const tapAmpm = (ap) => { const ns = { ...selRef.current, ampm: ap }; selRef.current = ns; setSel({ ...ns }); emit(ns); };

  const displayVal = value
    ? (() => { const [hh, mm] = value.split(":").map(Number); return `${hh % 12 || 12}:${pad(mm)} ${hh >= 12 ? "PM" : "AM"}`; })()
    : (disabled ? "Select a slot first" : slotStart && slotEnd ? `${slotStart}–${slotEnd}` : "Select time");

  const handAngle = mode === "hour" ? hourAngle(sel.h) : minAngle(sel.m);
  const handTip = toXY(handAngle, (mode === "hour" ? HOUR_R : MIN_R) - 14);
  const slotHint = slotStart && slotEnd ? `Slot: ${slotStart} – ${slotEnd}` : null;

  return (
    <div className="adm-ctp-wrap" ref={ref}>
      <button type="button"
        className={`adm-ctp-trigger${disabled ? " adm-ctp-disabled" : ""}`}
        onClick={() => { if (!disabled) setOpen(o => !o); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span className={`adm-ctp-val${!value ? " adm-ctp-ph" : ""}`}>{displayVal}</span>
        <span style={{ marginLeft: "auto", opacity: .4, fontSize: 11 }}>▾</span>
      </button>
      {open && !disabled && (
        <div className="adm-ctp-popup">
          {slotHint && <div className="adm-ctp-slot-hint">{slotHint}</div>}
          <div className="adm-ctp-header">
            <div className="adm-ctp-ampm-col">
              <button type="button" className={`adm-ctp-ampm-btn${sel.ampm === "AM" ? " active" : ""}`} onClick={() => tapAmpm("AM")}>AM</button>
              <button type="button" className={`adm-ctp-ampm-btn${sel.ampm === "PM" ? " active" : ""}`} onClick={() => tapAmpm("PM")}>PM</button>
            </div>
            <div className="adm-ctp-time-display">
              <span className={`adm-ctp-hm${mode === "hour" ? " active" : ""}`} onClick={() => setMode("hour")}>{pad(sel.h)}</span>
              <span className="adm-ctp-colon">:</span>
              <span className={`adm-ctp-hm${mode === "minute" ? " active" : ""}`} onClick={() => setMode("minute")}>{pad(sel.m)}</span>
            </div>
          </div>
          <svg ref={svgRef} width={CENTER * 2} height={CENTER * 2} className="adm-ctp-clock"
            style={{ touchAction: "none", display: "block" }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <circle cx={CENTER} cy={CENTER} r={CLOCK_R} fill="#f8f9fa" stroke="#e5e7eb" strokeWidth="1.5" />
            <line x1={CENTER} y1={CENTER} x2={handTip.x} y2={handTip.y} stroke="#1dd1a1" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={CENTER} cy={CENTER} r="4" fill="#1dd1a1" />
            <circle cx={handTip.x} cy={handTip.y} r="16" fill="#1dd1a1" opacity="0.18" />
            <circle cx={handTip.x} cy={handTip.y} r="4" fill="#1dd1a1" />
            {mode === "hour" && hours12.map(h => {
              const ang = hourAngle(h), pos = toXY(ang, HOUR_R), isSel = sel.h === h, isDis = isHourDis(h, sel.ampm);
              return (
                <g key={h} style={{ cursor: isDis ? "not-allowed" : "pointer" }} onPointerDown={e => { e.stopPropagation(); if (!isDis) tapHour(h); }}>
                  <circle cx={pos.x} cy={pos.y} r="16" fill={isSel ? "#1dd1a1" : isDis ? "#f3f4f6" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight={isSel ? "700" : "400"} fill={isSel ? "#fff" : isDis ? "#d1d5db" : "#333"}>{h}</text>
                </g>
              );
            })}
            {mode === "minute" && minutes.map(m => {
              const ang = minAngle(m), pos = toXY(ang, MIN_R), isSel = sel.m === m;
              return (
                <g key={m} style={{ cursor: "pointer" }} onPointerDown={e => { e.stopPropagation(); tapMinute(m); }}>
                  <circle cx={pos.x} cy={pos.y} r="16" fill={isSel ? "#1dd1a1" : "transparent"} />
                  <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight={isSel ? "700" : "400"} fill={isSel ? "#fff" : "#333"}>{pad(m)}</text>
                </g>
              );
            })}
          </svg>
          <div className="adm-ctp-footer">
            <button type="button" className="adm-ctp-cancel" onClick={() => { setOpen(false); setMode("hour"); }}>Cancel</button>
            <button type="button" className="adm-ctp-ok" onClick={() => { emit(selRef.current); setOpen(false); setMode("hour"); }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   Add PreBooking Modal (admin)
══════════════════════════════════════════════ */
const EMPTY_FORM = { name: "", mobile: "", email: "", guests: 1, date: todayStr(), time: "", slotGroup: "", notes: "", source: "Phone" };
const SOURCE_OPTIONS = ["Phone", "WhatsApp", "In Person", "User App"];

const AddPreBookingModal = ({ onClose, onSaved, toast }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setF = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };

  const validate = () => {
    const err = {};
    if (!form.name.trim() || form.name.trim().length < 2) err.name = true;
    const mob = form.mobile.replace(/\D/g, "");
    if (!mob || mob.length !== 10) err.mobile = true;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = true;
    if (!form.guests || parseInt(form.guests, 10) < 1) err.guests = true;
    if (!form.date) err.date = true;
    if (!form.time) err.time = true;
    return err;
  };

  const handleSave = async () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) { setErrors(ve); return; }
    setSaving(true);
    try {
      const newId = `pre_${Date.now()}`;
      const body = {
        id: newId,
        name: form.name,
        mobile: form.mobile,
        email: form.email || "",
        guests: parseInt(form.guests, 10) || 1,
        date: form.date,
        time: form.time,
        slotGroup: form.slotGroup || "",
        notes: form.notes || "",
        source: form.source || "Phone",
        items: [],
        subtotal: 0,
        discount: 0,
        totalAmount: 0,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      };
      await api.post("/preBookings", body);
      toast.success("PreBooking added!");
      onSaved(body);
      onClose();
    } catch {
      toast.error("Failed to add pre-booking.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ingredient-modal-overlay" onClick={onClose}>
      <div className="ingredient-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ingredient-modal-header">
          <h3>Add PreBooking</h3>
          <button className="ingredient-close-btn" onClick={onClose}></button>
        </div>

        <div className="ingredient-modal-body">

          {/* Name + Guests */}
          <div className="evt-pre-modal-row">
            <div className="evt-pre-modal-group">
              <label>Name <span className="evt-pre-req">*</span></label>
              <input
                className={`evt-pre-modal-input${errors.name ? " error" : ""}`}
                placeholder="Guest name"
                value={form.name}
                onChange={e => setF("name", e.target.value)}
              />
            </div>
            <div className="evt-pre-modal-group" style={{ flex: "0 0 130px" }}>
              <label>Guests <span className="evt-pre-req">*</span></label>
              <div className={`evt-pre-modal-stepper${errors.guests ? " error" : ""}`}>
                <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                <span>{form.guests}</span>
                <button type="button" onClick={() => setF("guests", Math.min(50, form.guests + 1))}>+</button>
              </div>
            </div>
          </div>

          {/* Mobile + Email */}
          <div className="evt-pre-modal-row">
            <div className="evt-pre-modal-group">
              <label>Mobile <span className="evt-pre-req">*</span></label>
              <input
                className={`evt-pre-modal-input${errors.mobile ? " error" : ""}`}
                placeholder="10-digit number"
                type="tel"
                value={form.mobile}
                onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
            <div className="evt-pre-modal-group">
              <label>Email <span className="evt-pre-opt">(optional)</span></label>
              <input
                className={`evt-pre-modal-input${errors.email ? " error" : ""}`}
                placeholder="email@example.com"
                type="email"
                value={form.email}
                onChange={e => setF("email", e.target.value)}
              />
            </div>
          </div>

          {/* Slot chips */}
          <div className="evt-pre-modal-group">
            <label>Dining Slot <span className="evt-pre-opt">(optional)</span></label>
            <div className="evt-pre-modal-slots">
              {SLOT_GROUPS.map(sg => (
                <button key={sg.key} type="button"
                  className={`evt-pre-modal-slot-chip${form.slotGroup === sg.key ? " active" : ""}`}
                  onClick={() => { const next = form.slotGroup === sg.key ? "" : sg.key; setF("slotGroup", next); setF("time", ""); }}>
                  {sg.label}
                  <span className="evt-pre-modal-slot-time">{sg.start}–{sg.end}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time */}
          <div className="evt-pre-modal-row">
            <div className="evt-pre-modal-group">
              <label>Date <span className="evt-pre-req">*</span></label>
              <MiniDatePicker
                value={form.date}
                min={todayStr()}
                onChange={v => setF("date", v)}
                hasError={!!errors.date}
              />
            </div>
            <div className="evt-pre-modal-group">
              <label>
                Time <span className="evt-pre-req">*</span>
                {!form.slotGroup && <span className="evt-pre-opt"> (select slot first)</span>}
              </label>
              <ClockTimePicker
                value={form.time}
                onChange={v => setF("time", v)}
                slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                disabled={!form.slotGroup}
              />
            </div>
          </div>

          {/* Source */}
          <div className="evt-pre-modal-group">
            <label>Source</label>
            <div className="evt-pre-modal-source-row">
              {SOURCE_OPTIONS.map(s => (
                <button key={s} type="button"
                  className={`evt-pre-modal-source-btn${form.source === s ? " active" : ""}`}
                  onClick={() => setF("source", s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="evt-pre-modal-group">
            <label>Notes <span className="evt-pre-opt">(optional)</span></label>
            <textarea
              className="evt-pre-modal-textarea"
              rows={2}
              placeholder="Special requests..."
              value={form.notes}
              onChange={e => setF("notes", e.target.value)}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="ingredient-modal-footer form-actions">
          <button type="button" onClick={handleSave} disabled={saving}>
            Add PreBooking
          </button>
          <button type="button" onClick={onClose}>Cancel</button>

        </div>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
const PreBookings = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterSlots, setFilterSlots] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [callHistory, setCallHistory] = useState({});
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const data = adminData?.preBookings || [];

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  /* filter */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterDate) d = d.filter(r => r.date === filterDate);
    if (filterSlots.size > 0) d = d.filter(r => { const k = resolveSlotKey(r); return k && filterSlots.has(k); });
    if (filterStatuses.size > 0) d = d.filter(r => filterStatuses.has(r.status || "scheduled"));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(r => (r.name || "").toLowerCase().includes(q) || (r.mobile || "").includes(q) || (r.id || "").toLowerCase().includes(q));
    }
    return d;
  }, [data, filterDate, filterSlots, filterStatuses, search]);

  /* sort */
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let va, vb;
      if (sortField === "date") { va = new Date(`${a.date}T${a.time || "00:00"}`); vb = new Date(`${b.date}T${b.time || "00:00"}`); }
      else if (sortField === "guests") { va = Number(a.guests || 0); vb = Number(b.guests || 0); }
      else if (sortField === "totalAmount") { va = Number(a.totalAmount || 0); vb = Number(b.totalAmount || 0); }
      else { va = (a[sortField] || "").toString().toLowerCase(); vb = (b[sortField] || "").toString().toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDir]);

  /* KPIs */
  const today = todayStr();
  const todayCount = data.filter(r => r.date === today).length;
  const scheduledCount = data.filter(r => (r.status || "scheduled") === "scheduled").length;
  const completedCount = data.filter(r => r.status === "completed").length;

  /* inline status update */
  const updateStatus = async (e, id, status) => {
    e.stopPropagation();
    const prev = data.find(r => r.id === id);
    if (!prev) return;
    if (typeof setAdminData === "function") {
      setAdminData(p => ({ ...p, preBookings: (p.preBookings || []).map(r => r.id === id ? { ...r, status } : r) }));
    }
    try {
      try { await api.patch(`/preBookings/${id}`, { status }); }
      catch { await api.put(`/preBookings/${id}`, { ...prev, status }); }
      toast.success(`Status updated to ${status}`);
    } catch {
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, preBookings: (p.preBookings || []).map(r => r.id === id ? prev : r) }));
      }
      toast.error("Failed to update status");
    }
  };

  /* call logging */
  const handleCall = (e, id) => {
    e.stopPropagation();
    setCallHistory(prev => ({ ...prev, [id]: [...(prev[id] || []), new Date().toISOString()] }));
    toast.success("Call logged!");
  };

  /* modal saved callback */
  const handleModalSaved = (newRecord) => {
    if (typeof setAdminData === "function") {
      setAdminData(p => ({ ...p, preBookings: [newRecord, ...(p.preBookings || [])] }));
    }
  };

  const activeFilters = filterDate || filterSlots.size > 0 || filterStatuses.size > 0 || search.trim();

  const SortTh = ({ field, children }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}
      <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
        {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );

  return (
    <div className="evt-pre-page">

      {/* HEADER */}
      <div className="evt-pre-header">
        <div>
          <h2 className="evt-pre-title">PreBookings</h2>
          <p className="evt-pre-subtitle">Manage pre-orders &amp; advance bookings</p>
        </div>
        <button className="evt-pre-add-btn" onClick={() => setShowAddModal(true)}>
          + Add PreBooking
        </button>
      </div>

      {/* KPI STRIP */}
      <div className="evt-pre-kpi-row">
        {[
          { label: "Total", val: data.length, color: "#111" },
          { label: "Today", val: todayCount, color: "#2980b9" },
          { label: "Scheduled", val: scheduledCount, color: "#ca8a04" },
          { label: "Completed", val: completedCount, color: "#16a34a" },
        ].map((k, i) => (
          <div key={i} className="evt-pre-kpi" style={{ borderTopColor: k.color }}>
            <div className="evt-pre-kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="evt-pre-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="evt-pre-filter-bar">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="evt-pre-search" placeholder="Search name / mobile / ID..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">Date</span>
            <div style={{ minWidth: 155 }}>
              <MiniDatePicker value={filterDate} onChange={setFilterDate} placeholder="All dates" />
            </div>
            {filterDate && (
              <button className="evt-pre-filter-btn" onClick={() => setFilterDate("")} title="Clear date">✕</button>
            )}
          </div>
        </div>

        <div className="evt-pre-filter-groups">
          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">Slot</span>
            {SLOT_GROUPS.map(sg => (
              <button key={sg.key} title={`${sg.label} (${sg.start}–${sg.end})`}
                className={`evt-pre-filter-btn${filterSlots.has(sg.key) ? " active" : ""}`}
                onClick={() => toggleSet(setFilterSlots, sg.key)}>
                {sg.short}
              </button>
            ))}
          </div>

          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">Status</span>
            {[
              ["scheduled", "S", "status-scheduled", "Scheduled"],
              ["preparing", "P", "status-preparing", "Preparing"],
              ["completed", "D", "status-completed", "Done"],
            ].map(([key, short, cls, title]) => (
              <button key={key} title={title}
                className={`evt-pre-filter-btn${filterStatuses.has(key) ? " active " + cls : ""}`}
                onClick={() => toggleSet(setFilterStatuses, key)}>{short}
              </button>
            ))}
          </div>

          {activeFilters && (
            <button className="evt-pre-clear-all" onClick={() => { setSearch(""); setFilterDate(todayStr()); setFilterSlots(new Set()); setFilterStatuses(new Set()); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-pre-table-wrapper">
        <table className="evt-pre-table">
          <thead>
            <tr>
              <SortTh field="name">Guest Name</SortTh>
              <th>Contact</th>
              <SortTh field="date">Date</SortTh>
              <th>Slot</th>
              <th>Time</th>
              <SortTh field="guests">Guests</SortTh>
              <th>Items</th>
              <SortTh field="totalAmount">Total</SortTh>
              <SortTh field="status">Status</SortTh>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="10" className="evt-pre-empty">No preBookings found</td></tr>
            ) : (
              sortedData.map(item => {
                const status = item.status || "scheduled";
                const slotKey = resolveSlotKey(item);
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";
                const history = callHistory[item.id] || [];

                return (
                  <tr key={item.id} className="evt-pre-row clickable"
                    onClick={() => navigate(`/prebookings/${item.id}`)}>

                    {/* Guest name */}
                    <td>
                      <div className="evt-pre-name-cell">
                        <div className="evt-pre-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="evt-pre-name">{item.name || "—"}</div>
                          <div className="evt-pre-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="evt-pre-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-pre-email">{item.email}</span>}
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ fontWeight: 600 }}>{item.date || "—"}</td>

                    {/* Slot */}
                    <td>
                      <span className={`evt-pre-slot-badge slot-${slotKey?.toLowerCase() || "any"}`}>
                        {slotLabel}
                      </span>
                    </td>

                    {/* Time */}
                    <td>{fmtTime(item.time)}</td>

                    {/* Guests */}
                    <td style={{ textAlign: "center", fontWeight: 700 }}>
                      {item.guests || 1}
                      {item.guests > 8 && <span className="evt-pre-discount-badge">-10%</span>}
                    </td>

                    {/* Items */}
                    <td style={{ textAlign: "center" }}>{item.items?.length || 0}</td>

                    {/* Total */}
                    <td>
                      <span style={{ fontWeight: 600 }}>₹{item.totalAmount || 0}</span>
                      {item.discount > 0 && <div style={{ fontSize: 10, color: "#065f46" }}>saved ₹{item.discount}</div>}
                    </td>

                    {/* Status inline */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-pre-inline-status">
                        {["scheduled", "preparing", "completed"].map(s => (
                          <button key={s}
                            className={`evt-pre-istatus-btn evt-pre-istatus-${s}${status === s ? " active" : ""}`}
                            title={s}
                            onClick={e => updateStatus(e, item.id, s)}>
                            {s === "scheduled" ? "S" : s === "preparing" ? "P" : "D"}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-pre-call-wrap"
                        onMouseEnter={() => history.length > 0 && setCallTooltipId(item.id)}
                        onMouseLeave={() => setCallTooltipId(null)}>
                        <button className="evt-pre-act-btn" onClick={e => handleCall(e, item.id)}>
                          📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                        </button>
                        {callTooltipId === item.id && history.length > 0 && (
                          <div className="evt-pre-call-tooltip">
                            <div className="evt-pre-call-tooltip-title">📞 Call History</div>
                            {history.map((ts, i) => (
                              <div key={i} className="evt-pre-call-tooltip-row">{fmtDateTime(ts)}</div>
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

      {/* ADD MODAL */}
      {showAddModal && (
        <AddPreBookingModal
          onClose={() => setShowAddModal(false)}
          onSaved={handleModalSaved}
          toast={toast}
        />
      )}

    </div>
  );
};

export default PreBookings;