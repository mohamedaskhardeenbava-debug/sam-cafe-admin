/**
 * CustomDatePicker.js  —  Sam Cafe Admin Panel
 * Shared calendar date picker component
 */

import React, { useState, useEffect, useRef } from "react";

import { format } from "date-fns";

import "./CustomDatePicker.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");
export const todayStr = () => format(new Date(), "yyyy-MM-dd");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── CustomDatePicker ─────────────────────────────────────────────────────────
// Props:
//   value      – "YYYY-MM-DD" string or ""
//   onChange   – (value: string) => void
//   label      – optional prefix label shown on the trigger button
//   min        – optional "YYYY-MM-DD" – dates before this are disabled
//   max        – optional "YYYY-MM-DD" – dates after this are disabled
//   placeholder – text shown when no date is selected (default "Select date")
// ─────────────────────────────────────────────────────────────────────────────
export const CustomDatePicker = ({ value, onChange, label, min, max, placeholder = "Select date" }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("day");
  const ref = useRef(null);

  const parsed = value ? new Date(value) : new Date();
  const [calYear, setCalYear] = useState(parsed.getFullYear());
  const [calMonth, setCalMonth] = useState(parsed.getMonth());

  // Sync calendar head when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    }
  }, [value]);

  const minD = min ? new Date(min + "T00:00:00") : null;
  const maxD = max ? new Date(max + "T00:00:00") : null;

  const isDisabled = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  };

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectDay = (d) => {
    const s = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
    onChange(s);
    setOpen(false);
  };

  const prevNav = () => {
    if (view === "day") {
      if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
      else setCalMonth(m => m - 1);
    } else if (view === "year") setCalYear(y => y - 20);
  };
  const nextNav = () => {
    if (view === "day") {
      if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
      else setCalMonth(m => m + 1);
    } else if (view === "year") setCalYear(y => y + 20);
  };

  const yearRange = Array.from({ length: 20 }, (_, i) => calYear - 10 + i);
  const today = todayStr();

  const displayVal = value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : placeholder;

  return (
    <div className="cdp-wrap" ref={ref}>
      <button
        type="button"
        className="cdp-trigger"
        onClick={() => { setOpen(o => !o); setView("day"); }}
      >
        <span className="cdp-trigger-main">
          <svg className="cdp-cal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {label && <span className="cdp-label">{label}</span>}
          <span className={`cdp-value${!value ? " cdp-placeholder" : ""}`}>{displayVal}</span>
        </span>
        <span className="cdp-arrow">▾</span>
      </button>

      {open && (
        <div className="cdp-overlay">
          <div className="cdp-popup" onMouseDown={(e) => e.stopPropagation()}>
            {/* Navigation */}
            <div className="cdp-nav">
              <button type="button" className="cdp-nav-btn" onClick={prevNav}>‹</button>
              <div className="cdp-nav-center">
                {view === "day" && (
                  <>
                    <button type="button" className="cdp-nav-lbl" onClick={() => setView("month")}>{MONTHS[calMonth]}</button>
                    <button type="button" className="cdp-nav-lbl" onClick={() => setView("year")}>{calYear}</button>
                  </>
                )}
                {view === "month" && (
                  <button type="button" className="cdp-nav-lbl" onClick={() => setView("year")}>{calYear}</button>
                )}
                {view === "year" && (
                  <span className="cdp-nav-lbl">{calYear - 10} – {calYear + 9}</span>
                )}
              </div>
              <button type="button" className="cdp-nav-btn" onClick={nextNav}>›</button>
            </div>

            {/* Day view */}
            {view === "day" && (
              <>
                <div className="cdp-weekdays">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <span key={d}>{d}</span>)}
                </div>
                <div className="cdp-grid">
                  {cells.map((d, i) => {
                    if (!d) return <span key={i} />;
                    const ds = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`;
                    const sel = ds === value;
                    const dis = isDisabled(ds);
                    const tod = ds === today;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`cdp-day${sel ? " cdp-sel" : ""}${dis ? " cdp-dis" : ""}${tod && !sel ? " cdp-today" : ""}`}
                        disabled={dis}
                        onClick={() => selectDay(d)}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Month view */}
            {view === "month" && (
              <div className="cdp-month-grid">
                {MONTHS.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`cdp-month-btn${i === calMonth ? " cdp-sel" : ""}`}
                    onClick={() => { setCalMonth(i); setView("day"); }}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* Year view */}
            {view === "year" && (
              <div className="cdp-year-grid">
                {yearRange.map(y => (
                  <button
                    key={y}
                    type="button"
                    className={`cdp-year-btn${y === calYear ? " cdp-sel" : ""}`}
                    onClick={() => { setCalYear(y); setView("month"); }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;