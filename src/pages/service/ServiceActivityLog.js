import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import "./ServiceActivityLog.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ─── CustomDatePicker — identical to Dashboard.js ────────────── */
const CustomDatePicker = ({ value, onChange, label, min, max }) => {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    const parsed = value ? new Date(value) : new Date();
    const [view, setView] = React.useState("day");
    const [calYear, setCalYear] = React.useState(parsed.getFullYear());
    const [calMonth, setCalMonth] = React.useState(parsed.getMonth());

    React.useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const minD = min ? new Date(min) : null;
    const maxD = max ? new Date(max) : null;
    const isDisabled = (d) => (minD && d < minD) || (maxD && d > maxD);

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const select = (d) => {
        const s = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        onChange(s); setOpen(false);
    };
    const yearRange = Array.from({ length: 20 }, (_, i) => calYear - 10 + i);
    const todayFmt = format(new Date(), "yyyy-MM-dd");

    return (
        <div className="cdp-wrap" ref={ref}>
            <button className="cdp-trigger" onClick={() => { setOpen(o => !o); setView("day"); setCalYear(parsed.getFullYear()); setCalMonth(parsed.getMonth()); }}>
                <span className="cdp-icon">📅</span>
                <span className="cdp-label">{label}</span>
                <span className="cdp-value">{value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
            </button>
            {open && (
                <div className="cdp-popup">
                    <div className="cdp-nav">
                        <button className="cdp-nav-btn" onClick={() => {
                            if (view === "day") { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else { setCalMonth(m => m - 1); } }
                            else if (view === "year") setCalYear(y => y - 20);
                        }}>‹</button>
                        <div className="cdp-nav-center">
                            {view === "day" && <><button className="cdp-nav-lbl" onClick={() => setView("month")}>{MONTHS[calMonth]}</button><button className="cdp-nav-lbl" onClick={() => setView("year")}>{calYear}</button></>}
                            {view === "month" && <button className="cdp-nav-lbl" onClick={() => setView("year")}>{calYear}</button>}
                            {view === "year" && <span className="cdp-nav-lbl">{calYear - 10} – {calYear + 9}</span>}
                        </div>
                        <button className="cdp-nav-btn" onClick={() => {
                            if (view === "day") { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else { setCalMonth(m => m + 1); } }
                            else if (view === "year") setCalYear(y => y + 20);
                        }}>›</button>
                    </div>
                    {view === "day" && (<>
                        <div className="cdp-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <span key={d}>{d}</span>)}</div>
                        <div className="cdp-grid">
                            {cells.map((d, i) => {
                                if (!d) return <span key={i} />;
                                const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                const sel = ds === value;
                                const dis = isDisabled(new Date(ds));
                                const tod = ds === todayFmt;
                                return <button key={i} className={`cdp-day${sel ? " cdp-sel" : ""}${dis ? " cdp-dis" : ""}${tod && !sel ? " cdp-today" : ""}`} disabled={dis} onClick={() => select(d)}>{d}</button>;
                            })}
                        </div>
                    </>)}
                    {view === "month" && (
                        <div className="cdp-month-grid">
                            {MONTHS.map((m, i) => <button key={i} className={`cdp-month-btn${i === calMonth ? " cdp-sel" : ""}`} onClick={() => { setCalMonth(i); setView("day"); }}>{m.slice(0, 3)}</button>)}
                        </div>
                    )}
                    {view === "year" && (
                        <div className="cdp-year-grid">
                            {yearRange.map(y => <button key={y} className={`cdp-year-btn${y === calYear ? " cdp-sel" : ""}`} onClick={() => { setCalYear(y); setView("month"); }}>{y}</button>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const PRESETS = [
    { label: "Today", getRange: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; } },
    { label: "This Month", getRange: () => { const d = new Date(); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")]; } },
    { label: "All", getRange: () => ["2000-01-01", "2099-12-31"] },
];

export default function ServiceActivityLog({ adminData }) {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    /* Default: show All so existing data is always visible */
    const [fromDate, setFromDate] = useState("2000-01-01");
    const [toDate, setToDate] = useState("2099-12-31");
    const [activePreset, setActivePreset] = useState("All");
    const [searchText, setSearchText] = useState("");

    const list = adminData?.serviceActivity || [];

    const filtered = useMemo(() => list.filter(item => {
        const d = item.date || "";
        const matchDate = d >= fromDate && d <= toDate;
        const q = searchText.toLowerCase();
        const matchSearch = !q || (item.work || "").toLowerCase().includes(q) || (item.staff || "").toLowerCase().includes(q);
        return matchDate && matchSearch;
    }), [list, fromDate, toDate, searchText]);

    const applyPreset = (preset) => {
        const [f, t] = preset.getRange();
        setFromDate(f); setToDate(t);
        setActivePreset(preset.label);
    };

    return (
        <div className="activity-page">
            <div className="activity-header">
                <h2 className="activity-title">Service Activity Log</h2>
            </div>

            <div className="activity-filter-bar">
                <input className="cdp-search-input" placeholder="🔍 Search work / staff…"
                    value={searchText} onChange={e => setSearchText(e.target.value)} />
                <CustomDatePicker label="From" value={fromDate} max={toDate}
                    onChange={(s) => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate} max={todayStr}
                    onChange={(s) => { setToDate(s); setActivePreset("custom"); }} />
                {PRESETS.map(p => (
                    <button key={p.label}
                        className={`cdp-preset-btn${activePreset === p.label ? " active" : ""}`}
                        onClick={() => applyPreset(p)}>
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="activity-table-wrapper">
                <table className="activity-table">
                    <thead>
                        <tr>
                            <th>Work</th>
                            <th>Staff</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan="3" style={{ textAlign: "center", color: "#aaa" }}>No activity found</td></tr>
                        ) : (
                            filtered.map((item, i) => (
                                <tr key={item.id ?? i}>
                                    <td>{item.work || "—"}</td>
                                    <td>{item.staff || "—"}</td>
                                    <td>{item.date || "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}