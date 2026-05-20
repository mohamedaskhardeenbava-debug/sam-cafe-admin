import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import "./StaffAttendance.css";
import api from "../../api";
import editIcon from "../../icon/edit-icon.png";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";

/*
  DATA SHAPE: attendance lives on staff[].attendance
  [
    { date: "2026-05-19", status: "present" | "absent" | "leave", reason: "" },
    ...
  ]

  On load:
  - Past dates with no record → auto-marked absent (fire-and-forget)
  - Today → added as { date: today, status: "unmarked" } if missing,
    so the checkbox renders immediately without waiting for toggle
  - Marking present sets status="present"
  - Unchecking sets status="absent"

  holidays collection: [{ id, date, reason }]
*/

const normalizeDate = (d) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffAttendance({ adminData, setAdminData }) {
    const todayStr = normalizeDate(new Date());
    const firstOfMonth = normalizeDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

    // All dates this month up to today
    const monthDates = useMemo(() => {
        const start = new Date(firstOfMonth);
        const dates = [];
        for (let d = new Date(start); normalizeDate(d) <= todayStr; d.setDate(d.getDate() + 1)) {
            dates.push(normalizeDate(d));
        }
        return dates;
    }, [firstOfMonth, todayStr]);

    // State
    const [localAttendance, setLocalAttendance] = useState({});
    const [editMode, setEditMode] = useState({});
    const [holidays, setHolidays] = useState({});
    const [loadingHolidays, setLoadingHolidays] = useState(true);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidayForm, setHolidayForm] = useState({ date: "", reason: "" });
    const [savingCells, setSavingCells] = useState({});
    const [statsOpen, setStatsOpen] = useState(false);
    const [columnEdit, setColumnEdit] = useState({});
    const [attFromDate, setAttFromDate] = useState(firstOfMonth);
    const [attToDate, setAttToDate] = useState(todayStr);
    const [attPreset, setAttPreset] = useState("month");
    const [attSearch, setAttSearch] = useState("");

    const autoAbsentRan = useRef(false);
    const autoTodayRan = useRef(false);
    const maxDateStr = todayStr;

    // ── Date range helpers ────────────────────────────────────────
    const getWeekRange = () => {
        const today = new Date(); const day = today.getDay();
        const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        return { from: normalizeDate(mon), to: todayStr };
    };

    const applyAttPreset = (preset) => {
        setAttPreset(preset);
        if (preset === "today") { setAttFromDate(todayStr); setAttToDate(todayStr); }
        else if (preset === "week") {
            const r = getWeekRange(); setAttFromDate(r.from); setAttToDate(r.to);
        }
        else if (preset === "month") {
            setAttFromDate(firstOfMonth); setAttToDate(todayStr);
        }
    };

    const visibleDates = useMemo(() =>
        monthDates.filter(d => d >= attFromDate && d <= attToDate),
        [monthDates, attFromDate, attToDate]);

    const visibleStaff = useMemo(() => {
        const q = attSearch.toLowerCase();
        return adminData.staff.filter(s =>
            !q || (s.name || "").toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q));
    }, [adminData.staff, attSearch]);

    // ── Load holidays ─────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/holidays");
                const map = {};
                res.data.forEach(h => { if (h.date) map[normalizeDate(h.date)] = h.reason; });
                setHolidays(map);
            } catch (err) { console.error("Holiday load failed", err); }
            finally { setLoadingHolidays(false); }
        })();
    }, []);

    // ── Auto-absent: past dates ────────────────────────────────────
    useEffect(() => {
        if (loadingHolidays || !adminData.staff?.length || autoAbsentRan.current) return;
        autoAbsentRan.current = true;

        (async () => {
            const pastDates = monthDates.filter(d => d < todayStr);
            for (const staff of adminData.staff) {
                const existingDates = new Set((staff.attendance || []).map(a => a.date));
                const missing = pastDates.filter(d => !existingDates.has(d) && !holidays[d]);
                if (!missing.length) continue;
                const newEntries = missing.map(d => ({ date: d, status: "absent", reason: "Auto-marked absent" }));
                const updatedAtt = [...(staff.attendance || []), ...newEntries];
                try {
                    const res = await api.put(`/staff/${staff.id}`, { ...staff, attendance: updatedAtt });
                    setAdminData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === staff.id ? res.data : s) }));
                } catch (err) { console.warn(`Auto-absent failed for ${staff.name}:`, err.message); }
            }
        })();
    }, [loadingHolidays]);

    // ── Seed today's entry as "unmarked" if missing ───────────────
    // This means the checkbox renders for today immediately on load
    useEffect(() => {
        if (loadingHolidays || !adminData.staff?.length || autoTodayRan.current) return;
        autoTodayRan.current = true;

        (async () => {
            for (const staff of adminData.staff) {
                const hasTodayEntry = (staff.attendance || []).some(a => a.date === todayStr);
                if (hasTodayEntry) continue;
                // Add unmarked entry for today so the UI renders a checkbox
                const updatedAtt = [...(staff.attendance || []), { date: todayStr, status: "unmarked", reason: "" }];
                try {
                    const res = await api.put(`/staff/${staff.id}`, { ...staff, attendance: updatedAtt });
                    setAdminData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === staff.id ? res.data : s) }));
                } catch (err) { /* non-critical */ }
            }
        })();
    }, [loadingHolidays]);

    // ── Get attendance record (local override first) ───────────────
    const getRecord = useCallback((staffId, date) => {
        if (localAttendance[staffId]?.[date]) return localAttendance[staffId][date];
        const staff = adminData.staff.find(s => s.id === staffId);
        return staff?.attendance?.find(a => a.date === date) || null;
    }, [localAttendance, adminData.staff]);

    // ── Toggle present/unmarked ────────────────────────────────────
    const handleToggle = (staffId, date, checked) => {
        if (checked) {
            setLocalAttendance(prev => ({
                ...prev,
                [staffId]: { ...prev[staffId], [date]: { status: "present", reason: "" } }
            }));
            saveAttendance(staffId, date, { status: "present", reason: "" });
        } else {
            setLocalAttendance(prev => ({
                ...prev,
                [staffId]: { ...prev[staffId], [date]: { status: "absent", reason: "" } }
            }));
            saveAttendance(staffId, date, { status: "absent", reason: "" });
        }
    };

    // ── Save a single attendance record ───────────────────────────
    const saveAttendance = async (staffId, date, data) => {
        const cellKey = `${staffId}_${date}`;
        setSavingCells(prev => ({ ...prev, [cellKey]: true }));
        const staff = adminData.staff.find(s => s.id === staffId);
        if (!staff) return;
        const existing = staff.attendance || [];
        const idx = existing.findIndex(a => a.date === date);
        const updated = idx >= 0
            ? existing.map((a, i) => i === idx ? { ...a, ...data, date } : a)
            : [...existing, { date, ...data }];
        try {
            const res = await api.put(`/staff/${staffId}`, { ...staff, attendance: updated });
            setAdminData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === staffId ? res.data : s) }));
            setLocalAttendance(prev => {
                const next = { ...prev };
                if (next[staffId]) { const copy = { ...next[staffId] }; delete copy[date]; next[staffId] = copy; }
                return next;
            });
        } catch (err) {
            console.error("Save attendance failed:", err.message);
        } finally {
            setSavingCells(prev => ({ ...prev, [cellKey]: false }));
        }
    };

    // ── Add holiday ───────────────────────────────────────────────
    const addHoliday = async () => {
        if (!holidayForm.date || !holidayForm.reason) { alert("Fill in both date and reason"); return; }
        try {
            const res = await api.post("/holidays", { date: normalizeDate(holidayForm.date), reason: holidayForm.reason });
            setHolidays(prev => ({ ...prev, [normalizeDate(holidayForm.date)]: holidayForm.reason }));
            setShowHolidayModal(false); setHolidayForm({ date: "", reason: "" });
        } catch (err) { console.error("Add holiday failed:", err.message); }
    };

    // ── Export ────────────────────────────────────────────────────
    const exportAttendance = () => {
        const rows = visibleStaff.map(s => {
            const row = { Name: s.name || "—", Role: s.role || "—" };
            let present = 0, absent = 0, leave = 0;
            visibleDates.forEach(d => {
                if (holidays[d]) { row[d] = "Holiday"; return; }
                const rec = getRecord(s.id, d);
                const st = rec?.status || "absent";
                row[d] = st === "present" ? "✔" : st === "leave" ? `L: ${rec.reason}` : "✖";
                if (st === "present") present++;
                else if (st === "leave") leave++;
                else absent++;
            });
            row["Present"] = present; row["Absent"] = absent; row["Leave"] = leave;
            return row;
        });
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0] || {}).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Attendance");
        XLSX.writeFile(wb, `attendance_${attFromDate}_to_${attToDate}.xlsx`);
    };

    // ── Per-staff stats (visible range) ───────────────────────────
    const staffStats = useMemo(() => visibleStaff.map(s => {
        let present = 0, absent = 0, leave = 0;
        const nonHoliday = visibleDates.filter(d => !holidays[d]);
        nonHoliday.forEach(d => {
            const rec = getRecord(s.id, d);
            const st = rec?.status;
            if (st === "present") present++;
            else if (st === "leave") leave++;
            else absent++;
        });
        const pct = nonHoliday.length > 0 ? Math.round((present / nonHoliday.length) * 100) : 0;
        return { id: s.id, name: s.name, role: s.role, present, absent, leave, pct, total: nonHoliday.length };
    }), [visibleStaff, visibleDates, holidays, getRecord]);

    const { displayLimit, sentinelRef, containerRef, hasMore } =
        useInfiniteScroll(visibleStaff.length, 20);

    return (
        <div className="att-page">

            {/* HEADER */}
            <div className="att-header">
                <div className="att-header-left">
                    <h2 className="att-title">Staff Attendance</h2>
                    <span className="att-subtitle">
                        {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                </div>
                <div className="att-header-right">
                    <button className="orders-export-btn" onClick={exportAttendance}>Export</button>
                    <button className="att-holiday-btn" onClick={() => setShowHolidayModal(true)}>+ Holiday</button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="att-filter-bar">
                <input className="att-search" placeholder="🔍 Search staff…"
                    value={attSearch} onChange={e => setAttSearch(e.target.value)} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span className="att-filter-lbl">Range</span>
                    {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([k, lbl]) => (
                        <button key={k} className={`sched-pill-btn${attPreset === k ? " active" : ""}`}
                            onClick={() => applyAttPreset(k)}>{lbl}</button>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="att-filter-lbl">From</span>
                    <CustomDatePicker value={attFromDate} max={attToDate || maxDateStr}
                        onChange={v => { setAttFromDate(v); setAttPreset("custom"); }} placeholder="Start" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="att-filter-lbl">To</span>
                    <CustomDatePicker value={attToDate} min={attFromDate} max={maxDateStr}
                        onChange={v => { setAttToDate(v); setAttPreset("custom"); }} placeholder="End" />
                </div>
                {(attSearch || attPreset === "custom") && (
                    <button className="ae-clear-filter" onClick={() => { setAttSearch(""); applyAttPreset("month"); }}>Clear</button>
                )}
                <button className={`sched-pill-btn att-stats-toggle${statsOpen ? " active" : ""}`}
                    onClick={() => setStatsOpen(v => !v)}>📊 Stats</button>
                {/* Column-edit all toggle */}
                <button className="att-col-edit-btn"
                    onClick={() => {
                        const allOn = visibleDates.every(d => columnEdit[d]);
                        const next = {};
                        if (!allOn) visibleDates.forEach(d => { next[d] = true; });
                        setColumnEdit(next);
                    }}>
                    ✏️ {visibleDates.every(d => columnEdit[d]) ? "Lock All" : "Edit All"}
                </button>
            </div>

            {/* STATS PANEL */}
            <div className={`att-stats-panel${statsOpen ? " att-stats-open" : ""}`}>
                <div className="att-stats-row">
                    {staffStats.map((s, i) => (
                        <div key={s.id} className="att-stats-card">
                            <div className="att-stats-avatar" style={{ background: `hsl(${i * 55 + 180},65%,55%)` }}>
                                {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="att-stats-info">
                                <span className="att-stats-name">{s.name}</span>
                                <div className="att-stats-bar-wrap">
                                    <div className="att-stats-bar"
                                        style={{ width: `${s.pct}%`, background: s.pct >= 80 ? "#16a34a" : s.pct >= 60 ? "#f59e0b" : "#dc2626" }} />
                                </div>
                                <div className="att-stats-nums">
                                    <span className="att-stats-p">✔ {s.present}</span>
                                    <span className="att-stats-a">✖ {s.absent}</span>
                                    <span className="att-stats-l">L {s.leave}</span>
                                    <span className="att-stats-pct">{s.pct}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* TABLE WRAPPER */}
            <div className="att-scroll-wrap">
                <div className="att-table-wrap" ref={containerRef}>
                    <table className="att-table">
                        <thead>
                            <tr>
                                <th className="att-name-th">Staff</th>
                                {visibleDates.map(d => {
                                    const dObj = new Date(d);
                                    const isToday = d === todayStr;
                                    const isHol = !!holidays[d];
                                    return (
                                        <th key={d} className={`att-date-th${isToday ? " att-today-th" : ""}${isHol ? " att-holiday-th" : ""}`}>
                                            <div className="att-date-head">
                                                <span className="att-date-num">{dObj.getDate()}</span>
                                                <span className="att-date-wd">{WEEKDAY_NAMES[dObj.getDay()]}</span>
                                                {isToday && <span className="att-today-badge">Today</span>}
                                                {isHol && <span className="att-hol-badge" title={holidays[d]}>🎉</span>}
                                            </div>
                                            {/* Column-level edit toggle */}
                                            {!isHol && (
                                                <button className="att-col-toggle"
                                                    onClick={() => setColumnEdit(prev => ({ ...prev, [d]: !prev[d] }))}>
                                                    {columnEdit[d] ? "🔒" : "✏️"}
                                                </button>
                                            )}
                                        </th>
                                    );
                                })}
                                <th className="att-summary-th">Summary</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleStaff.slice(0, displayLimit).map(staff => {
                                const stats = staffStats.find(s => s.id === staff.id);
                                return (
                                    <tr key={staff.id} className="att-row">
                                        <td className="att-name-td">
                                            <div className="att-name-wrap">
                                                <div className="att-avatar">
                                                    {(staff.name || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="att-name">{staff.name}</span>
                                                    {staff.role && <span className="att-role">{staff.role}</span>}
                                                </div>
                                            </div>
                                        </td>

                                        {visibleDates.map(date => {
                                            const isSaving = savingCells[`${staff.id}_${date}`];
                                            const isToday = date === todayStr;
                                            const isHol = !!holidays[date];
                                            const isColEditing = !!columnEdit[date];
                                            const isRowEditing = !!editMode[staff.id]?.[date];
                                            const saved = getRecord(staff.id, date);

                                            // Holiday cell
                                            if (isHol) {
                                                return (
                                                    <td key={date} className="att-td att-holiday-td">
                                                        <span className="att-hol-text" title={holidays[date]}>🎉</span>
                                                    </td>
                                                );
                                            }

                                            // Edit mode (column or row)
                                            if (isColEditing || isRowEditing) {
                                                return (
                                                    <td key={date} className={`att-td att-editing-td${isToday ? " att-today-td" : ""}`}>
                                                        <div className="att-edit-block">
                                                            <label className="att-checkbox-label">
                                                                <input type="checkbox" className="att-checkbox"
                                                                    checked={saved?.status === "present"}
                                                                    onChange={e => handleToggle(staff.id, date, e.target.checked)} />
                                                                <span className={`att-check-custom${saved?.status === "present" ? " checked" : ""}`} />
                                                            </label>
                                                            {isRowEditing && (
                                                                <>
                                                                    <input className="att-reason-input" placeholder="Reason…"
                                                                        onChange={e => setLocalAttendance(prev => ({
                                                                            ...prev,
                                                                            [staff.id]: { ...prev[staff.id], [date]: { status: "leave", reason: e.target.value } }
                                                                        }))} />
                                                                    <button className="att-save-mini" onClick={() => {
                                                                        const data = localAttendance[staff.id]?.[date];
                                                                        if (!data?.reason) { alert("Enter reason"); return; }
                                                                        saveAttendance(staff.id, date, data);
                                                                        setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: false } }));
                                                                    }}>Save</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // Leave
                                            if (saved?.status === "leave") {
                                                return (
                                                    <td key={date} className="att-td att-leave-td">
                                                        <div className="att-leave-cell">
                                                            <span className="att-leave-icon">L</span>
                                                            <span className="att-leave-reason">{saved.reason}</span>
                                                            <button className="att-edit-btn"
                                                                onClick={() => setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: true } }))}>
                                                                <img src={editIcon} alt="edit" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // Absent
                                            if (saved?.status === "absent") {
                                                return (
                                                    <td key={date} className={`att-td att-absent-td${isToday ? " att-today-td" : ""}`}>
                                                        <div className="att-absent-cell">
                                                            <span className="att-absent-icon">✕</span>
                                                            <button className="att-edit-btn" title="Override"
                                                                onClick={() => setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: true } }))}>
                                                                <img src={editIcon} alt="edit" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // Present
                                            if (saved?.status === "present") {
                                                return (
                                                    <td key={date} className={`att-td att-present-td${isToday ? " att-today-td" : ""}`}>
                                                        <label className="att-checkbox-label">
                                                            <input type="checkbox" checked className="att-checkbox" disabled={isSaving}
                                                                onChange={e => handleToggle(staff.id, date, e.target.checked)} />
                                                            <span className="att-check-custom checked" />
                                                        </label>
                                                    </td>
                                                );
                                            }

                                            // Unmarked / no record — show checkbox (today) or absent icon (past)
                                            if (isToday || saved?.status === "unmarked") {
                                                return (
                                                    <td key={date} className="att-td att-empty-td att-today-td">
                                                        <label className="att-checkbox-label">
                                                            <input type="checkbox" checked={false} className="att-checkbox"
                                                                onChange={e => handleToggle(staff.id, date, e.target.checked)} />
                                                            <span className="att-check-custom" />
                                                        </label>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={date} className="att-td att-absent-td">
                                                    <div className="att-absent-cell">
                                                        <span className="att-absent-icon">✕</span>
                                                        <button className="att-edit-btn" title="Override"
                                                            onClick={() => setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: true } }))}>
                                                            <img src={editIcon} alt="edit" />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        {/* Summary cell */}
                                        <td className="att-td att-summary-cell">
                                            <span className="att-sum-p">✔{stats?.present || 0}</span>
                                            <span className="att-sum-a">✖{stats?.absent || 0}</span>
                                            {stats?.leave > 0 && <span className="att-sum-l">L{stats.leave}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                            <InfiniteScrollLoader
                                sentinelRef={sentinelRef}
                                hasMore={hasMore}
                                colSpan={visibleDates.length + 2}
                            />
                        </tbody>
                    </table>
                </div>
            </div>

            {/* HOLIDAY MODAL */}
            {showHolidayModal && (
                <div className="att-modal-overlay">
                    <div className="att-modal">
                        <div className="att-modal-header">
                            <h3>Add Holiday</h3>
                            <button className="att-modal-close" onClick={() => setShowHolidayModal(false)} />
                        </div>
                        <div className="att-modal-body">
                            <div className="att-form-group">
                                <label>Date</label>
                                <CustomDatePicker value={holidayForm.date} max={maxDateStr}
                                    onChange={val => setHolidayForm(prev => ({ ...prev, date: val }))}
                                    placeholder="Select holiday date" />
                            </div>
                            <div className="att-form-group">
                                <label>Reason / Name</label>
                                <input placeholder="e.g. Diwali, Republic Day…"
                                    value={holidayForm.reason}
                                    onChange={e => setHolidayForm(prev => ({ ...prev, reason: e.target.value }))} />
                            </div>
                        </div>
                        <div className="att-modal-footer">
                            <button className="att-btn-primary" onClick={addHoliday}>Save Holiday</button>
                            <button className="att-btn-secondary" onClick={() => setShowHolidayModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}