import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import "./KitchenSchedules.css";
import api from "../../api";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ─── CustomDatePicker — identical to Dashboard.js ─── */
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
    const select = (d) => { const s = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; onChange(s); setOpen(false); };
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
                        <button className="cdp-nav-btn" onClick={() => { if (view === "day") { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else { setCalMonth(m => m - 1); } } else if (view === "year") setCalYear(y => y - 20); }}>‹</button>
                        <div className="cdp-nav-center">
                            {view === "day" && <><button className="cdp-nav-lbl" onClick={() => setView("month")}>{MONTHS[calMonth]}</button><button className="cdp-nav-lbl" onClick={() => setView("year")}>{calYear}</button></>}
                            {view === "month" && <button className="cdp-nav-lbl" onClick={() => setView("year")}>{calYear}</button>}
                            {view === "year" && <span className="cdp-nav-lbl">{calYear - 10} – {calYear + 9}</span>}
                        </div>
                        <button className="cdp-nav-btn" onClick={() => { if (view === "day") { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else { setCalMonth(m => m + 1); } } else if (view === "year") setCalYear(y => y + 20); }}>›</button>
                    </div>
                    {view === "day" && (<>
                        <div className="cdp-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <span key={d}>{d}</span>)}</div>
                        <div className="cdp-grid">
                            {cells.map((d, i) => {
                                if (!d) return <span key={i} />;
                                const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                const sel = ds === value, dis = isDisabled(new Date(ds)), tod = ds === todayFmt;
                                return <button key={i} className={`cdp-day${sel ? " cdp-sel" : ""}${dis ? " cdp-dis" : ""}${tod && !sel ? " cdp-today" : ""}`} disabled={dis} onClick={() => select(d)}>{d}</button>;
                            })}
                        </div>
                    </>)}
                    {view === "month" && <div className="cdp-month-grid">{MONTHS.map((m, i) => <button key={i} className={`cdp-month-btn${i === calMonth ? " cdp-sel" : ""}`} onClick={() => { setCalMonth(i); setView("day"); }}>{m.slice(0, 3)}</button>)}</div>}
                    {view === "year" && <div className="cdp-year-grid">{yearRange.map(y => <button key={y} className={`cdp-year-btn${y === calYear ? " cdp-sel" : ""}`} onClick={() => { setCalYear(y); setView("month"); }}>{y}</button>)}</div>}
                </div>
            )}
        </div>
    );
};

const PRESETS = [
    { label: "Today", fn: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; } },
    { label: "This Month", fn: () => { const d = new Date(); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(d, "yyyy-MM-dd")]; } },
    { label: "All", fn: () => ["2000-01-01", "2099-12-31"] },
];

const EMPTY_FORM = { work: "", staff: "", date: "", department: "", status: "", lastRate: "" };

export default function KitchenSchedules({ adminData, setAdminData }) {
    const location = useLocation();
    const [openDropdown, setOpenDropdown] = useState(null);
    const [statusFilter, setStatusFilter] = useState(location.state?.status || "");
    const [searchText, setSearchText] = useState("");
    const [fromDate, setFromDate] = useState("2000-01-01");
    const [toDate, setToDate] = useState("2099-12-31");
    const [activePreset, setActivePreset] = useState("All");
    const [show, setShow] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const today = format(new Date(), "yyyy-MM-dd");

    const list = adminData.kitchenSchedules || [];

    const filteredList = useMemo(() => list.filter(item => {
        const matchStatus = !statusFilter || (item.status || "").toLowerCase() === statusFilter.toLowerCase();
        const q = searchText.toLowerCase();
        const matchSearch = !q || (item.work || "").toLowerCase().includes(q) || (item.staff || "").toLowerCase().includes(q);
        const d = item.date || "";
        const matchDate = d >= fromDate && d <= toDate;
        return matchStatus && matchSearch && matchDate;
    }), [list, statusFilter, searchText, fromDate, toDate]);

    const applyPreset = (p) => { const [f, t] = p.fn(); setFromDate(f); setToDate(t); setActivePreset(p.label); };

    const add = async () => {
        if (!form.work || !form.staff || !form.date) return;
        const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
        const newItem = { id: newId, ...form };
        try {
            await api.post("/kitchenSchedules", newItem);
            setAdminData(prev => ({ ...prev, kitchenSchedules: [...(prev.kitchenSchedules || []), newItem] }));
            setForm(EMPTY_FORM);
            setShow(false);
        } catch (err) { console.error("Failed to add schedule", err); }
    };

    const cancel = () => { setForm(EMPTY_FORM); setShow(false); };

    const moveExpiredSchedules = async () => {
        const expired = list.filter(item => item.date < today);
        const upcoming = list.filter(item => item.date >= today);
        if (!expired.length) return;
        const activity = adminData?.kitchenActivity || [];
        for (const item of list) await api.delete(`/kitchenSchedules/${item.id}`);
        for (const item of upcoming) await api.post("/kitchenSchedules", item);
        for (const item of expired) await api.post("/kitchenActivity", item);
        setAdminData(prev => ({ ...prev, kitchenSchedules: upcoming, kitchenActivity: [...activity, ...expired] }));
    };

    useEffect(() => { moveExpiredSchedules(); }, []);
    useEffect(() => { const close = () => setOpenDropdown(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, []);

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h2>Kitchen Schedules</h2>
                <button onClick={() => setShow(true)}>+ Add Schedule</button>
            </div>

            <div className="sched-filter-bar">
                <input className="cdp-search-input" placeholder="🔍 Search work / staff…" value={searchText} onChange={e => setSearchText(e.target.value)} />
                <div className="sched-status-pills">
                    {["", "Scheduled", "Completed", "Pending"].map(s => (
                        <button key={s} className={`cdp-preset-btn${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
                            {s || "All"}
                        </button>
                    ))}
                </div>
                <CustomDatePicker label="From" value={fromDate} max={toDate}
                    onChange={s => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate}
                    onChange={s => { setToDate(s); setActivePreset("custom"); }} />
                {PRESETS.map(p => (
                    <button key={p.label} className={`cdp-preset-btn${activePreset === p.label ? " active" : ""}`} onClick={() => applyPreset(p)}>
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="schedule-table-wrapper">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th>Work</th><th>Staff</th><th>Date</th>
                            <th>Department</th><th>Status</th><th>Response</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: "center", color: "#aaa" }}>No schedules found</td></tr>
                        ) : (
                            filteredList.map(i => (
                                <tr key={i.id}>
                                    <td>{i.work}</td>
                                    <td>{i.staff}</td>
                                    <td>{i.date}</td>
                                    <td>{i.department || "—"}</td>
                                    <td>{i.status ? <span className={`status status-${i.status.toLowerCase().replace(/\s+/g, "-")}`}>{i.status}</span> : "—"}</td>
                                    <td>{i.lastRate ? `${i.lastRate} days` : "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {show && (
                <div className="category-modal-overlay">
                    <form className="category-modal" onSubmit={e => { e.preventDefault(); add(); }}>
                        <div className="category-modal-header">
                            <h3>Add Schedule</h3>
                            <button type="button" className="dish-close-btn" onClick={cancel}></button>
                        </div>
                        <div className="category-modal-body">
                            <div className="form-group">
                                <label>Department</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "dept" ? null : "dept"); }}>
                                        {form.department || "Select Department"}
                                    </button>
                                    {openDropdown === "dept" && (
                                        <div className="dishes-dropdown-menu">
                                            {["Pest Control", "Maintenance", "Laundry"].map(dep => (
                                                <div key={dep} onClick={e => { e.stopPropagation(); setForm({ ...form, department: dep }); setOpenDropdown(null); }}>{dep}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Work</label>
                                <input required value={form.work} onChange={e => setForm({ ...form, work: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Staff</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "staff" ? null : "staff"); }}>
                                        {form.staff || "Select Staff"}
                                    </button>
                                    {openDropdown === "staff" && (
                                        <div className="dishes-dropdown-menu">
                                            {adminData.staff?.map(s => (
                                                <div key={s.id} onClick={e => { e.stopPropagation(); setForm({ ...form, staff: s.name }); setOpenDropdown(null); }}>{s.name}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "status" ? null : "status"); }}>
                                        {form.status || "Select Status"}
                                    </button>
                                    {openDropdown === "status" && (
                                        <div className="dishes-dropdown-menu">
                                            {["Scheduled", "Completed", "Pending"].map(st => (
                                                <div key={st} onClick={e => { e.stopPropagation(); setForm({ ...form, status: st }); setOpenDropdown(null); }}>{st}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Response (Days)</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "rate" ? null : "rate"); }}>
                                        {form.lastRate !== "" ? `${form.lastRate} Days` : "Select Days"}
                                    </button>
                                    {openDropdown === "rate" && (
                                        <div className="dishes-dropdown-menu">
                                            {[0, 1, 2, 3].map(day => (
                                                <div key={day} onClick={e => { e.stopPropagation(); setForm({ ...form, lastRate: String(day) }); setOpenDropdown(null); }}>{day} Days</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="category-modal-footer">
                            <div className="form-actions">
                                <button type="submit">Save Schedule</button>
                                <button type="button" onClick={cancel}>Cancel</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}