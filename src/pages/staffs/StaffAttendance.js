import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import "./StaffAttendance.css";
import api from "../../api";
import editIcon from "../../icon/edit-icon.png";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";

/* ─── Helpers ─────────────────────────────────────────────────── */
const normalizeDate = (d) => {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─── Component ─────────────────────────────────────────────────── */
export default function StaffAttendance({ adminData, setAdminData }) {
    const location = useLocation();

    const getDates = () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const dates = [];
        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
            dates.push(normalizeDate(d));
        }
        return dates;
    };

    const dates = getDates();
    const todayStr = normalizeDate(new Date());

    const [localAttendance, setLocalAttendance] = useState({});   // optimistic UI overrides
    const [editMode, setEditMode] = useState({});
    const [holidays, setHolidays] = useState({});
    const [loadingHolidays, setLoadingHolidays] = useState(true);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [columnEdit, setColumnEdit] = useState({});
    const [holidayForm, setHolidayForm] = useState({ date: "", reason: "" });
    const [savingCells, setSavingCells] = useState({});   // { staffId_date: true } while saving
    const autoAbsentRan = useRef(false);  // guard: run auto-absent only once

    /* ── Load holidays ── */
    const fetchHolidays = async () => {
        try {
            const res = await api.get("/holidays");
            const map = {};
            res.data.forEach(h => { if (h.date) map[normalizeDate(h.date)] = h.reason; });
            setHolidays(map);
        } catch (err) {
            console.error("Holiday load failed", err);
        } finally {
            setLoadingHolidays(false);
        }
    };

    useEffect(() => { fetchHolidays(); }, []);

    /* ═══════════════════════════════════════════════════════════════
       AUTO-ABSENT: on page load, for every past date in this month
       where a staff member has NO attendance record at all, write
       status="absent" to the database (fire-and-forget per staff).
       Runs once per session (uses a ref-based guard).
    ═══════════════════════════════════════════════════════════════ */
    useEffect(() => {
        if (loadingHolidays) return;           // wait for holidays
        if (!adminData.staff?.length) return;
        if (autoAbsentRan.current) return;     // run ONCE per mount only
        autoAbsentRan.current = true;

        const autoAbsent = async () => {
            // Only current-month past dates (not today) — full history comes from db
            const pastDates = dates.filter(d => d < todayStr);

            for (const staff of adminData.staff) {
                const existingDates = new Set((staff.attendance || []).map(a => a.date));
                const missingDates = pastDates.filter(d => !existingDates.has(d) && !holidays[d]);

                if (missingDates.length === 0) continue;

                const newEntries = missingDates.map(d => ({ date: d, status: "absent", reason: "Auto-marked absent" }));
                const updatedAtt = [...(staff.attendance || []), ...newEntries];
                const updatedStaff = { ...staff, attendance: updatedAtt };

                try {
                    const res = await api.put(`/staff/${staff.id}`, updatedStaff);
                    setAdminData(prev => ({
                        ...prev,
                        staff: prev.staff.map(s => s.id === staff.id ? res.data : s)
                    }));
                } catch (err) {
                    console.warn(`Auto-absent failed for ${staff.name}:`, err.message);
                }
            }
        };

        autoAbsent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingHolidays]);

    /* ── Toggle checkbox ── */
    const handleToggle = (staffId, date, checked) => {
        if (checked) {
            // Mark present immediately
            saveAttendance(staffId, date, { status: "present", reason: "" });
        } else {
            // Open leave reason input
            setEditMode(prev => ({ ...prev, [staffId]: { ...prev[staffId], [date]: true } }));
        }
    };

    /* ── Save attendance to DB ── */
    const saveAttendance = useCallback(async (staffId, date, data) => {
        const cellKey = `${staffId}_${date}`;
        setSavingCells(prev => ({ ...prev, [cellKey]: true }));

        // Optimistic UI update
        setLocalAttendance(prev => ({ ...prev, [staffId]: { ...prev[staffId], [date]: data } }));
        setEditMode(prev => ({ ...prev, [staffId]: { ...prev[staffId], [date]: false } }));

        const staffMember = adminData.staff.find(s => s.id === staffId);
        if (!staffMember) { setSavingCells(prev => ({ ...prev, [cellKey]: false })); return; }

        const existing = (staffMember.attendance || []).filter(a => a.date !== date);
        const updated = { ...staffMember, attendance: [...existing, { date, ...data }] };

        try {
            const res = await api.put(`/staff/${staffId}`, updated);
            setAdminData(prev => ({
                ...prev,
                staff: prev.staff.map(s => s.id === staffId ? res.data : s)
            }));
        } catch (err) {
            console.error("Attendance save failed:", err);
            // rollback optimistic
            setLocalAttendance(prev => {
                const copy = { ...prev };
                if (copy[staffId]) delete copy[staffId][date];
                return copy;
            });
        } finally {
            setSavingCells(prev => ({ ...prev, [cellKey]: false }));
        }
    }, [adminData.staff, setAdminData]);

    /* ── Add / Remove holiday ── */
    const addHoliday = async () => {
        if (!holidayForm.date || !holidayForm.reason) { alert("Fill in date and reason"); return; }
        await api.post("/holidays", { id: Date.now(), ...holidayForm });
        setHolidays(prev => ({ ...prev, [holidayForm.date]: holidayForm.reason }));
        setShowHolidayModal(false);
        setHolidayForm({ date: "", reason: "" });
    };

    const removeHoliday = async (date) => {
        try {
            const normalized = normalizeDate(date);
            const res = await api.get("/holidays");
            const holiday = res.data.find(h => normalizeDate(h.date) === normalized);
            if (holiday) await api.delete(`/holidays/${holiday.id}`);
            setHolidays(prev => { const u = { ...prev }; delete u[normalized]; return u; });
            setColumnEdit(prev => ({ ...prev, [normalized]: true }));
        } catch (err) {
            console.error("Remove holiday failed:", err);
        }
    };

    /* ── Get resolved status for a cell ── */
    const getRecord = (staffId, date) => {
        // Optimistic local override takes priority
        if (localAttendance[staffId]?.[date]) return localAttendance[staffId][date];
        const staffMember = adminData.staff.find(s => s.id === staffId);
        return staffMember?.attendance?.find(a => a.date === date) || null;
    };

    /* ── Stats row ── */
    const staffStats = useMemo(() => {
        return adminData.staff.map(s => {
            const att = s.attendance || [];
            const presentDays = att.filter(a => a.status === "present").length;
            const leaveDays = att.filter(a => a.status === "leave").length;
            const absentDays = att.filter(a => a.status === "absent").length;
            const pct = dates.length > 0 ? Math.round((presentDays / dates.length) * 100) : 0;
            return { id: s.id, name: s.name, presentDays, leaveDays, absentDays, pct };
        });
    }, [adminData.staff, dates]);

    if (loadingHolidays) return <div className="att-page"><div className="att-loading"><div className="att-spinner" />Loading attendance…</div></div>;

    const monthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });

    /* ── today's date string for max constraint on holiday picker ── */
    const maxDateStr = todayStr;

    return (
        <div className="att-page">
            {/* HEADER */}
            <div className="att-header">
                <div>
                    <h2 className="att-title">Attendance Sheet</h2>
                    <p className="att-subtitle">{monthName} · {adminData.staff.length} staff members</p>
                </div>
                <div className="att-header-actions">
                    <div className="att-summary-chips">
                        <div className="att-chip att-chip-present"><span className="att-chip-dot" />Present</div>
                        <div className="att-chip att-chip-leave"><span className="att-chip-dot" />Leave</div>
                        <div className="att-chip att-chip-absent"><span className="att-chip-dot" />Absent</div>
                        <div className="att-chip att-chip-holiday"><span className="att-chip-dot" />Holiday</div>
                    </div>
                    <button className="att-add-btn" onClick={() => setShowHolidayModal(true)}>+ Add Holiday</button>
                </div>
            </div>

            {/* STATS ROW */}
            <div className="att-stats-row">
                {staffStats.map((s, i) => (
                    <div key={s.id} className="att-stat-card">
                        <div className="att-stat-avatar">{s.name.charAt(0).toUpperCase()}</div>
                        <div className="att-stat-info">
                            <span className="att-stat-name">{s.name}</span>
                            <div className="att-stat-bar-wrap">
                                <div className="att-stat-bar" style={{ width: `${s.pct}%`, background: s.pct >= 75 ? "#16a34a" : s.pct >= 50 ? "#f59e0b" : "#dc2626" }} />
                            </div>
                            <div className="att-stat-nums">
                                <span className="att-present-num">✓ {s.presentDays}</span>
                                <span className="att-leave-num">L {s.leaveDays}</span>
                                <span className="att-absent-num">✕ {s.absentDays}</span>
                                <span className="att-pct-num">{s.pct}%</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* TABLE */}
            <div className="att-table-wrapper">
                <div className="att-table-scroll">
                    <table className="att-table">
                        <thead>
                            <tr>
                                <th className="att-sticky-col att-name-col">{monthName}</th>
                                {dates.map(date => {
                                    const d = new Date(date);
                                    const isSunday = d.getDay() === 0;
                                    const isHoliday = !!holidays[date];
                                    const isToday = date === todayStr;
                                    return (
                                        <th key={date} className={`att-date-th ${isSunday ? "att-sunday" : ""} ${isHoliday ? "att-holiday-col" : ""} ${isToday ? "att-today-col" : ""}`}>
                                            <div className="att-date-head">
                                                <span className="att-date-day">{d.getDate()}</span>
                                                <span className="att-date-weekday">{WEEKDAY_NAMES[d.getDay()]}</span>
                                            </div>
                                            {isHoliday && (
                                                <div className="att-holiday-tag">
                                                    <span>{holidays[date]}</span>
                                                    <input type="checkbox" className="att-remove-holiday" onChange={() => removeHoliday(date)} title="Remove holiday" />
                                                </div>
                                            )}
                                            {isToday && <div className="att-today-dot" />}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {adminData.staff.map((staff) => (
                                <tr key={staff.id} className="att-row">
                                    <td className="att-sticky-col att-name-cell">
                                        <div className="att-name-wrap">
                                            <div className="att-avatar">{staff.name.charAt(0).toUpperCase()}</div>
                                            <span>{staff.name}</span>
                                        </div>
                                    </td>

                                    {dates.map(date => {
                                        const isColumnEditing = columnEdit[date];
                                        const saved = getRecord(staff.id, date);
                                        const d = new Date(date);
                                        const isSunday = d.getDay() === 0;
                                        const isHoliday = holidays[date] && !isColumnEditing;
                                        const isToday = date === todayStr;
                                        const cellKey = `${staff.id}_${date}`;
                                        const isSaving = savingCells[cellKey];

                                        if (isHoliday) {
                                            return <td key={date} className="att-td att-holiday-cell"><span className="att-holiday-label">{holidays[date]}</span></td>;
                                        }

                                        if (isSunday && !isColumnEditing) {
                                            return <td key={date} className="att-td att-sunday-cell"><span>Off</span></td>;
                                        }

                                        const editing = editMode[staff.id]?.[date];

                                        if (isColumnEditing || editing) {
                                            return (
                                                <td key={date} className={`att-td att-editing-td ${isToday ? "att-today-td" : ""}`}>
                                                    <div className="att-edit-block">
                                                        <label className="att-checkbox-label">
                                                            <input type="checkbox" checked={saved?.status === "present"} onChange={(e) => handleToggle(staff.id, date, e.target.checked)} className="att-checkbox" />
                                                            <span className={`att-check-custom ${saved?.status === "present" ? "checked" : ""}`} />
                                                        </label>
                                                        {editing && (
                                                            <>
                                                                <input
                                                                    className="att-reason-input"
                                                                    placeholder="Reason…"
                                                                    onChange={(e) => setLocalAttendance(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: { status: "leave", reason: e.target.value } } }))}
                                                                />
                                                                <button className="att-save-mini" onClick={() => {
                                                                    const data = localAttendance[staff.id]?.[date];
                                                                    if (!data?.reason) { alert("Enter reason"); return; }
                                                                    saveAttendance(staff.id, date, data);
                                                                }}>Save</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        }

                                        if (saved?.status === "leave") {
                                            return (
                                                <td key={date} className="att-td att-leave-td">
                                                    <div className="att-leave-cell">
                                                        <span className="att-leave-icon">L</span>
                                                        <span className="att-leave-reason">{saved.reason}</span>
                                                        <button className="att-edit-btn" onClick={() => setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: true } }))}>
                                                            <img src={editIcon} alt="edit" />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        if (saved?.status === "absent") {
                                            return (
                                                <td key={date} className={`att-td att-absent-td ${isToday ? "att-today-td" : ""}`}>
                                                    <div className="att-absent-cell">
                                                        <span className="att-absent-icon">✕</span>
                                                        <button className="att-edit-btn" title="Override" onClick={() => setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: true } }))}>
                                                            <img src={editIcon} alt="edit" />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        if (saved?.status === "present") {
                                            return (
                                                <td key={date} className={`att-td att-present-td ${isToday ? "att-today-td" : ""}`}>
                                                    <label className="att-checkbox-label">
                                                        <input type="checkbox" checked onChange={(e) => handleToggle(staff.id, date, e.target.checked)} className="att-checkbox" disabled={isSaving} />
                                                        <span className="att-check-custom checked" />
                                                    </label>
                                                </td>
                                            );
                                        }

                                        /* No record yet — render checkbox for today, absent icon for past */
                                        if (!isToday) {
                                            return (
                                                <td key={date} className="att-td att-absent-td">
                                                    <div className="att-absent-cell">
                                                        <span className="att-absent-icon">✕</span>
                                                        <button className="att-edit-btn" title="Override" onClick={() => setEditMode(prev => ({ ...prev, [staff.id]: { ...prev[staff.id], [date]: true } }))}>
                                                            <img src={editIcon} alt="edit" />
                                                        </button>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={date} className={`att-td att-empty-td att-today-td`}>
                                                <label className="att-checkbox-label">
                                                    <input type="checkbox" checked={false} onChange={(e) => handleToggle(staff.id, date, e.target.checked)} className="att-checkbox" />
                                                    <span className="att-check-custom" />
                                                </label>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── HOLIDAY MODAL ── */}
            {showHolidayModal && (
                <div className="att-modal-overlay">
                    <div className="att-modal">
                        <div className="att-modal-header">
                            <h3>Add Holiday</h3>
                            <button className="att-modal-close" onClick={() => setShowHolidayModal(false)} />
                        </div>

                        <div className="att-modal-body">
                            {/* Date — CustomDatePicker matching Dashboard style */}
                            <div className="att-form-group">
                                <label>Date</label>
                                <CustomDatePicker
                                    value={holidayForm.date}
                                    onChange={(val) => setHolidayForm(prev => ({ ...prev, date: val }))}
                                    placeholder="Select holiday date"
                                    max={maxDateStr}
                                />
                            </div>

                            {/* Reason */}
                            <div className="att-form-group">
                                <label>Reason / Name</label>
                                <input
                                    placeholder="e.g. Diwali, Republic Day…"
                                    value={holidayForm.reason}
                                    onChange={(e) => setHolidayForm(prev => ({ ...prev, reason: e.target.value }))}
                                />
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