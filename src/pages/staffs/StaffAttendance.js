/**
 * StaffAttendance.js  —  Sam Cafe Admin Panel
 * Staff attendance tracking page
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import { toLocalISO, getWeekRange as sharedWeekRange, getMonthRange as sharedMonthRange, getLastMonthRange as sharedLastMonthRange } from "../../utils/dateRangeUtils";

import editIcon from "../../icon/edit-icon.png";
import closeIcon from "../../icon/close-icon.png";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../../components/InfiniteScrollLoader";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import { EmptyRow } from "../../App";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import CollapseChevron from "../../components/CollapseChevron";
import CollapseSection from "../../components/CollapseSection";
import { useVenue } from "../../context/VenueContext";

import "./StaffAttendance.css";

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

const normalizeDate = (d) => toLocalISO(new Date(d));

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffAttendance({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const { venueParam } = useVenue();
  const todayISO = normalizeDate(new Date());
  const firstOfMonth = normalizeDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // All dates this month up to today
  const monthDates = useMemo(() => {
    const start = new Date(firstOfMonth);
    const dates = [];
    for (let d = new Date(start); normalizeDate(d) <= todayISO; d.setDate(d.getDate() + 1)) {
      dates.push(normalizeDate(d));
    }
    return dates;
  }, [firstOfMonth, todayISO]);

  // State

  const [localAttendance, setLocalAttendance] = useState({});
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [editMode, setEditMode] = useState({});
  const [holidays, setHolidays] = useState({});
  const [loadingHolidays, setLoadingHolidays] = useState(true);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const holidayModal = useAnimatedModal("staffAttendance-holiday");
  const [holidayForm, setHolidayForm] = useState({ date: "", reason: "" });
  const [holidayErrors, setHolidayErrors] = useState({});
  const [savingCells, setSavingCells] = useState({});
  const [statsOpen, setStatsOpen] = useState(false);
  const [columnEdit, setColumnEdit] = useState({});
  const [attFromDate, setAttFromDate] = useState(firstOfMonth);
  const [attToDate, setAttToDate] = useState(todayISO);
  const [attPreset, setAttPreset] = useState("month");
  const [attSearch, setAttSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  const autoAbsentRan = useRef(false);
  const autoTodayRan = useRef(false);
  const maxDateStr = todayISO;

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Date range helpers ────────────────────────────────────────
  // Sourced from the shared dateRangeUtils module (single source of truth).
  const applyAttPreset = (preset) => {
    setAttPreset(preset);
    if (preset === "today") { setAttFromDate(todayISO); setAttToDate(todayISO); }
    else if (preset === "week") {
      const [f, t] = sharedWeekRange(); setAttFromDate(f); setAttToDate(t);
    }
    else if (preset === "month") {
      const [f, t] = sharedMonthRange(); setAttFromDate(f); setAttToDate(t);
    }
    else if (preset === "lastMonth") {
      const [f, t] = sharedLastMonthRange(); setAttFromDate(f); setAttToDate(t);
    }
  };

  const visibleDates = useMemo(() => {
    // Build dates directly from the selected range rather than
    // monthDates, since monthDates is scoped to "current month, up to
    // today" for the auto-absent effect and must not be widened —
    // this lets filters like "Last Month" show days outside that pool.
    const start = new Date(attFromDate);
    const end = new Date(attToDate);
    const out = [];
    for (let d = new Date(start); normalizeDate(d) <= normalizeDate(end); d.setDate(d.getDate() + 1)) {
      out.push(normalizeDate(d));
    }
    return out;
  }, [attFromDate, attToDate]);

  const visibleStaff = useMemo(() => {
    const q = attSearch.toLowerCase();
    return adminData.staff.filter(s =>
      !q || (s.name || "").toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q));
  }, [adminData.staff, attSearch]);

  // ── Load holidays ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/holidays", { params: venueParam() });
        const map = {};
        res.data.forEach(h => { if (h.date) map[normalizeDate(h.date)] = h.reason; });
        setHolidays(map);
      } catch (err) { toast.error("Holiday load failed", err); }
      finally { setLoadingHolidays(false); }
    })();
  }, []);

  // ── Auto-absent: past dates ────────────────────────────────────
  useEffect(() => {
    if (loadingHolidays || !adminData.staff?.length || autoAbsentRan.current) return;
    autoAbsentRan.current = true;

    (async () => {
      const pastDates = monthDates.filter(d => d < todayISO);
      for (const staff of adminData.staff) {
        const existingDates = new Set((staff.attendance || []).map(a => a.date));
        const missing = pastDates.filter(d => !existingDates.has(d) && !holidays[d]);
        if (!missing.length) continue;
        const newEntries = missing.map(d => ({ date: d, status: "absent", reason: "Auto-marked absent" }));
        const updatedAtt = [...(staff.attendance || []), ...newEntries];
        try {
          const res = await api.put(`/staff/${staff.id}`, { ...staff, attendance: updatedAtt });
          setAdminData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === staff.id ? res.data : s) }));
        } catch (err) { toast.warning(`Auto-absent failed for ${staff.name}: ${err.message}`); }
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
        const hasTodayEntry = (staff.attendance || []).some(a => a.date === todayISO);
        if (hasTodayEntry) continue;
        // Add unmarked entry for today so the UI renders a checkbox
        const updatedAtt = [...(staff.attendance || []), { date: todayISO, status: "unmarked", reason: "" }];
        try {
          const res = await api.put(`/staff/${staff.id}`, { ...staff, attendance: updatedAtt });
          setAdminData(prev => ({ ...prev, staff: prev.staff.map(s => s.id === staff.id ? res.data : s) }));
        } catch (err) { }
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
      toast.error("Failed to save attendance");
      console.error("Save attendance failed:", err.message);
    } finally {
      setSavingCells(prev => ({ ...prev, [cellKey]: false }));
    }
  };

  // ── Add holiday ───────────────────────────────────────────────
  const addHoliday = async () => {
    const e = {};
    if (!holidayForm.date) e.date = true;
    if (!holidayForm.reason.trim()) e.reason = true;
    if (Object.keys(e).length) { setHolidayErrors(e); return; }
    try {
      const res = await api.post("/holidays", { date: normalizeDate(holidayForm.date), reason: holidayForm.reason });
      setHolidays(prev => ({ ...prev, [normalizeDate(holidayForm.date)]: holidayForm.reason }));
      holidayModal.close(() => setShowHolidayModal(false)); setHolidayForm({ date: "", reason: "" });
      toast.success("Holiday added");
    } catch (err) {
      toast.error("Failed to add holiday");
      console.error("Add holiday failed:", err.message);
    }
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
    exportToExcel({ rows, sheetName: "Attendance", fileName: `attendance_${attFromDate}_to_${attToDate}.xlsx` });
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

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(visibleStaff.length, 20);

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
        <div className="att-header-left">
          <div className="header-title-row">
            <div className="header-collapse-col">
              <button
                type="button"
                className="header-collapse-btn"
                onClick={() => setHeaderCollapsed(prev => !prev)}
                data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand header" : "Collapse header"}
                aria-expanded={!headerCollapsed}
              >
                <CollapseChevron collapsed={headerCollapsed} />
              </button>
            </div>
            <div className="header-title-col">
              <div className="header-title-with-count">
                <h2 className="title">Staff Attendance</h2>
                <span className="result-count">{visibleStaff.length} staff · {visibleDates.length} day(s)</span>
              </div>
              <h5 className="subtitle">
                - {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </h5>
            </div>
          </div>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportAttendance}>Export</Button3D>
          <Button3D onClick={() => { setShowHolidayModal(true); holidayModal.open(); }}>+ Add Holiday</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <div className="filter-bar">
          {/* SEARCH WITH STATS DROPDOWN */}
          <div className="filter-groups">
            <div className="att-search-wrap" ref={searchRef}>
              <input className="search-input" placeholder=" Search staff…"
                value={attSearch}
                onChange={e => { setAttSearch(allowTextInput(attSearch, e.target.value, 100, 5)); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
              />
              {searchOpen && (
                <div className="att-search-dropdown">
                  {staffStats
                    .filter(s =>
                      !attSearch ||
                      s.name.toLowerCase().includes(attSearch.toLowerCase()) ||
                      (s.role || "").toLowerCase().includes(attSearch.toLowerCase())
                    )
                    .map((s, i) => (
                      <div key={s.id} className="att-search-suggestion"
                        onMouseDown={() => { setAttSearch(s.name); setSearchOpen(false); }}>
                        <div className="att-sug-avatar" style={{ background: `hsl(${i * 55 + 180},65%,55%)` }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="att-sug-info">
                          <span className="att-sug-name">{s.name}</span>
                          {s.role && <span className="att-sug-role">{s.role}</span>}
                        </div>
                        <div className="att-sug-bar-wrap">
                          <div className="att-sug-bar" style={{
                            width: `${s.pct}%`,
                            background: s.pct >= 80 ? "#16a34a" : s.pct >= 60 ? "#f59e0b" : "#dc2626"
                          }} />
                        </div>
                        <div className="att-sug-nums">
                          <span className="att-sug-p">✔{s.present}</span>
                          <span className="att-sug-a">✖{s.absent}</span>
                          {s.leave > 0 && <span className="att-sug-l">L{s.leave}</span>}
                        </div>
                        <span className="att-sug-pct" style={{ color: s.pct >= 80 ? "#16a34a" : s.pct >= 60 ? "#f59e0b" : "#dc2626" }}>{s.pct}%</span>
                      </div>
                    ))
                  }
                  {staffStats.filter(s =>
                    !attSearch ||
                    s.name.toLowerCase().includes(attSearch.toLowerCase()) ||
                    (s.role || "").toLowerCase().includes(attSearch.toLowerCase())
                  ).length === 0 && <div className="att-search-no-result">No staff found</div>}
                </div>
              )}
            </div>
            <div className="filter-group">
              <span className="filter-group-label">Range</span>
              {[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]].map(([k, lbl]) => (
                <button key={k} className={`filter-pill${attPreset === k ? " active" : ""}`}
                  onClick={() => applyAttPreset(k)}>{lbl}</button>
              ))}
            </div>
            <div className="filter-group">
              <span className="filter-group-label">From</span>
              <CustomDatePicker value={attFromDate} max={attToDate || maxDateStr}
                onChange={v => { setAttFromDate(v); setAttPreset("custom"); }} placeholder="Start" />

              <span className="filter-group-label">To</span>
              <CustomDatePicker value={attToDate} min={attFromDate} max={maxDateStr}
                onChange={v => { setAttToDate(v); setAttPreset("custom"); }} placeholder="End" />
            </div>
            {(attSearch || attPreset === "custom") && (
              <button className="ae-clear-filter" onClick={() => { setAttSearch(""); applyAttPreset("month"); }}>Clear</button>
            )}

            {/* Column-edit all toggle */}
            <Button3D variant="cancel" onClick={() => {
              const allOn = visibleDates.every(d => columnEdit[d]);
              const next = {};
              if (!allOn) visibleDates.forEach(d => { next[d] = true; });
              setColumnEdit(next);
            }}>
              {visibleDates.every(d => columnEdit[d]) ? "Lock All" : "Edit All"}
            </Button3D>
          </div>
        </div>
      </CollapseSection>

      {/* TABLE WRAPPER */}
      <div className={`att-scroll-wrap${headerCollapsed ? " header-is-collapsed" : ""}`}>
        <div className="att-table-wrap" ref={containerRef}>
          <table className="att-table">
            <thead>
              <tr>
                <th className="att-name-th">Staff</th>
                {visibleDates.map(d => {
                  const dObj = new Date(d);
                  const isToday = d === todayISO;
                  const isHol = !!holidays[d];
                  return (
                    <th key={d} className={`att-date-th${isToday ? " att-today-th" : ""}${isHol ? " att-holiday-th" : ""}`}>
                      <div className="att-date-head">
                        <span className="att-date-num">{dObj.getDate()}</span>
                        <span className="att-date-wd">{WEEKDAY_NAMES[dObj.getDay()]}</span>
                        {isToday && <span className="att-today-badge">Today</span>}
                        {isHol && <span className="att-hol-badge" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={holidays[d]}>🎉</span>}
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
              {visibleStaff.length === 0 ? (
                <EmptyRow colSpan={visibleDates.length + 2} message="No staff available" />
              ) : (
                <>
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
                      const isToday = date === todayISO;
                      const isHol = !!holidays[date];
                      const isColEditing = !!columnEdit[date];
                      const isRowEditing = !!editMode[staff.id]?.[date];
                      const saved = getRecord(staff.id, date);

                      // Holiday cell
                      if (isHol) {
                        return (
                          <td key={date} className="att-td att-holiday-td">
                            <span className="att-hol-text" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={holidays[date]}>🎉</span>
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
                                      [staff.id]: { ...prev[staff.id], [date]: { status: "leave", reason: allowTextInput(prev[staff.id]?.[date]?.reason || "", e.target.value, 100, 5) } }
                                    }))} />
                                  <button className="att-save-mini" onClick={() => {
                                    const data = localAttendance[staff.id]?.[date];
                                    if (!data?.reason) { toast.warning("Enter a reason before saving"); return; }
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
                              <button className="att-edit-btn" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Override"
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
                            <button className="att-edit-btn" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Override"
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
                </>
              )}
            </tbody>
          </table>
          <InfiniteScrollOverlay isLoading={isLoadingMore} />
        </div>
      </div>

      {/* HOLIDAY MODAL */}
      {holidayModal.shouldRender && (
        <div className={`modal-overlay ${holidayModal.overlayClass}`}>
          <div className={`admin-modal ${holidayModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Add Holiday</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { holidayModal.close(() => setShowHolidayModal(false)); setHolidayErrors({}); setHolidayForm({ date: "", reason: "" }); }}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className={holidayErrors.date ? "mat-label-error" : ""} style={{ fontSize: 13, marginBottom: 4, display: "block" }}>Date<span className="rf-req">*</span></label>
                <CustomDatePicker value={holidayForm.date} max={maxDateStr}
                  onChange={val => { setHolidayForm(prev => ({ ...prev, date: val })); setHolidayErrors(p => ({ ...p, date: false })); }}
                  placeholder="Select holiday date"
                  hasError={!!holidayErrors.date} />
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${holidayErrors.reason ? " mat-error" : ""}`}
                    placeholder=" "
                    value={holidayForm.reason}
                    onChange={e => { setHolidayForm(prev => ({ ...prev, reason: allowTextInput(prev.reason, e.target.value, 100, 5) })); setHolidayErrors(p => ({ ...p, reason: false })); }}
                  />
                  <label className={`mat-label${holidayErrors.reason ? " mat-label-error" : ""}`}>Reason<span className="rf-req">*</span></label>
                  <span className={`mat-bar${holidayErrors.reason ? " mat-bar-error" : ""}`} />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { holidayModal.close(() => setShowHolidayModal(false)); setHolidayErrors({}); setHolidayForm({ date: "", reason: "" }); }}>Cancel</Button3D>
              <Button3D onClick={addHoliday}>Save Holiday</Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}