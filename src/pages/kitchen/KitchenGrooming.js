/**
 * KitchenGrooming.js  —  Sam Cafe Admin Panel
 * Kitchen grooming checklist page
 */

import React, { useState, useMemo, useRef, useEffect } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";

import { useToast } from "../../useToast";
import closeIcon from "../../icon/close-icon.png";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";

import "./KitchenGrooming.css";

/*
  DATA SHAPE (grooming in db.json):
  {
    "staff_thamu": {
      "2026-05-19": { "uniform": false, "shoes": false, "groom": false },
      "2026-05-18": { "uniform": true,  "shoes": true,  "groom": true  },
      ...
    }
  }
  Today's entries start all false by default (seeded by db.json).
  Checkbox toggles a specific field.
*/

const GROOM_FIELDS = [
  { key: "uniform", label: "Uniform", icon: "" },
  { key: "shoes", label: "Shoes", icon: "" },
  { key: "groom", label: "Groom", icon: "" },
];

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3"];

function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekStart() {
  const d = new Date(); const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return toLocalISO(mon);
}
function getMonthStart() {
  const d = new Date();
  return toLocalISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function KitchenGrooming({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const today = toLocalISO(new Date());

  // Rolling 92-day pool (3 months)
  const dates = useMemo(() => {
    const arr = [];
    for (let i = 91; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      arr.push(toLocalISO(d));
    }
    return arr;
  }, []);

  const [selected, setSelected] = useState(null);
  const [showMemo, setShowMemo] = useState(false);
  const [memo, setMemo] = useState({ staffId: "", text: "" });
  const [memoErrors, setMemoErrors] = useState({});
  const [saving, setSaving] = useState({});
  const [groomSearch, setGroomSearch] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const [groomFrom, setGroomFrom] = useState(getWeekStart);
  const [groomTo, setGroomTo] = useState(today);
  const [groomPreset, setGroomPreset] = useState("week");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyPreset = (preset) => {
    setGroomPreset(preset);
    if (preset === "today") { setGroomFrom(today); setGroomTo(today); }
    if (preset === "week") { setGroomFrom(getWeekStart()); setGroomTo(today); }
    if (preset === "month") { setGroomFrom(getMonthStart()); setGroomTo(today); }
  };

  const visibleDates = useMemo(() =>
    dates.filter(d => d >= groomFrom && d <= groomTo),
    [dates, groomFrom, groomTo]);

  const visibleStaff = useMemo(() => {
    const q = groomSearch.toLowerCase();
    return adminData.staff.filter(s =>
      !q || (s.name || "").toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q));
  }, [adminData.staff, groomSearch]);

  // ── Stats ─────────────────────────────────────────────────────
  const staffStats = useMemo(() => visibleStaff.map((s, i) => {
    let perfect = 0;
    visibleDates.forEach(d => {
      const e = adminData.grooming?.[s.id]?.[d];
      if (e?.uniform && e?.shoes && e?.groom) perfect++;
    });
    return {
      id: s.id, name: s.name, role: s.role, perfect,
      pct: visibleDates.length > 0 ? Math.round((perfect / visibleDates.length) * 100) : 0,
      colorIdx: i,
    };
  }), [visibleStaff, adminData.grooming, visibleDates]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(visibleStaff.length, 20);

  // ── Export ────────────────────────────────────────────────────
  const exportGrooming = () => {
    if (!visibleStaff.length) { toast.warning("No data to export"); return; }
    const rows = visibleStaff.map(s => {
      const row = { Name: s.name || "—", Role: s.role || "—" };
      let perfect = 0;
      visibleDates.forEach(d => {
        const e = adminData.grooming?.[s.id]?.[d];
        row[d] = e?.uniform && e?.shoes && e?.groom ? "✔ All"
          : (e?.uniform || e?.shoes || e?.groom)
            ? [e?.uniform && "Uniform", e?.shoes && "Shoes", e?.groom && "Groom"].filter(Boolean).join(", ")
            : "✖ None";
        if (e?.uniform && e?.shoes && e?.groom) perfect++;
      });
      row["Perfect Days"] = perfect;
      row["Score %"] = visibleDates.length > 0
        ? `${Math.round((perfect / visibleDates.length) * 100)}%` : "0%";
      return row;
    });
    exportToExcel({ rows, sheetName: "Kitchen Grooming", fileName: `kitchen_grooming_${groomFrom}_to_${groomTo}.xlsx` });
  };

  // ── Toggle a grooming field ───────────────────────────────────
  const toggle = async (staffId, date, field) => {
    const ck = `${staffId}_${date}_${field}`;
    setSaving(prev => ({ ...prev, [ck]: true }));
    const prevData = adminData.grooming || {};
    const current = prevData[staffId]?.[date] || {};
    const updated = {
      ...prevData,
      [staffId]: { ...(prevData[staffId] || {}), [date]: { ...current, [field]: !current[field] } }
    };
    setAdminData(prev => ({ ...prev, grooming: updated }));
    try {
      await api.put("/grooming", updated);
    } catch (err) {
      toast.error("Failed to save grooming check. Please try again.");
      setAdminData(prev => ({ ...prev, grooming: prevData }));
    } finally {
      setSaving(prev => ({ ...prev, [ck]: false }));
    }
  };

  // ── Save memo ─────────────────────────────────────────────────
  const saveMemo = async () => {
    const errs = {};
    if (!memo.staffId) errs.staffId = true;
    if (!memo.text.trim()) errs.text = true;
    if (Object.keys(errs).length) { setMemoErrors(errs); return; }
    const memoDate = toLocalISO(new Date());
    const prevData = adminData.grooming || {};
    const updated = {
      ...prevData,
      memo: {
        ...(prevData.memo || {}),
        [memo.staffId]: { ...(prevData.memo?.[memo.staffId] || {}), [memoDate]: memo.text }
      }
    };
    try {
      await api.put("/grooming", updated);
      setAdminData(prev => ({ ...prev, grooming: updated }));
    } catch (err) { toast.error("Failed to save memo. Please try again."); }
    setShowMemo(false); setMemo({ staffId: "", text: "" }); setMemoErrors({});
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
        <div>
          <h2 className="title">Kitchen Grooming</h2>
          <p className="subtitle">Uniform · Shoes · Grooming</p>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportGrooming}>Export</Button3D>
          <Button3D onClick={() => setShowMemo(true)}>+ Add Memo</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="filter-groups">
          {/* SEARCH WITH DROPDOWN */}
          <div className="kgroom-search-wrap" ref={searchRef}>
            <input
              className="search-input"
              placeholder=" Search staff…"
              value={groomSearch}
              onChange={e => { setGroomSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && staffStats.length > 0 && (
              <div className="kgroom-search-dropdown">
                {staffStats
                  .filter(s =>
                    s.name.toLowerCase().includes(groomSearch.toLowerCase()) ||
                    (s.role || "").toLowerCase().includes(groomSearch.toLowerCase())
                  )
                  .map((s, i) => (
                    <div
                      key={s.id}
                      className="kgroom-search-suggestion"
                      onMouseDown={() => {
                        setGroomSearch(s.name);
                        setSearchOpen(false);
                      }}
                    >
                      <div className="kgroom-sug-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="kgroom-sug-info">
                        <span className="kgroom-sug-name">{s.name}</span>
                        {s.role && <span className="kgroom-sug-role">{s.role}</span>}
                      </div>
                      <div className="kgroom-sug-bar-wrap">
                        <div
                          className="kgroom-sug-bar"
                          style={{
                            width: `${s.pct}%`,
                            background: s.pct >= 80 ? "#06d6a0" : s.pct >= 50 ? "#ffd166" : "#ef476f"
                          }}
                        />
                      </div>
                      <span
                        className="kgroom-sug-pct"
                        style={{ color: s.pct >= 80 ? "#06d6a0" : s.pct >= 50 ? "#f59e0b" : "#ef476f" }}
                      >{s.pct}%</span>
                    </div>
                  ))}
                {staffStats.filter(s =>
                  s.name.toLowerCase().includes(groomSearch.toLowerCase()) ||
                  (s.role || "").toLowerCase().includes(groomSearch.toLowerCase())
                ).length === 0 && (
                    <div className="kgroom-search-no-result">No staff found</div>
                  )}
              </div>
            )}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">period</span>
            {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([k, lbl]) => (
              <button key={k} className={`filter-pill${groomPreset === k ? " active" : ""}`}
                onClick={() => applyPreset(k)}>{lbl}</button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <CustomDatePicker value={groomFrom} max={groomTo || today}
              onChange={v => { setGroomFrom(v); setGroomPreset("custom"); }} placeholder="Start date" />

            <span className="filter-group-label">To</span>
            <CustomDatePicker value={groomTo} min={groomFrom} max={today}
              onChange={v => { setGroomTo(v); setGroomPreset("custom"); }} placeholder="End date" />
          </div>
          {(groomSearch || groomPreset === "custom") && (
            <button className="ae-clear-filter" onClick={() => { setGroomSearch(""); applyPreset("week"); }}>Clear</button>
          )}
          <span className="result-count">{visibleDates.length} day(s) · {visibleStaff.length} staff</span>
        </div>
      </div>

      {/* SUMMARY CARDS REMOVED — now shown in search dropdown */}

      {/* TABLE */}
      <div className="kgroom-table-wrapper" ref={containerRef}>
        <table className="kgroom-table">
          <thead>
            <tr>
              <th className="kgroom-staff-th">Staff</th>
              {visibleDates.map(d => {
                const dObj = new Date(d); const isToday = d === today;
                return (
                  <th key={d} className={`kgroom-date-th${isToday ? " kgroom-today-th" : ""}`}>
                    <div className="kgroom-date-head">
                      <span className="kgroom-date-num">{dObj.getDate()}</span>
                      <span className="kgroom-date-wd">{WEEKDAY[dObj.getDay()]}</span>
                      {isToday && <span className="kgroom-today-badge">Today</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleStaff.slice(0, displayLimit).map((s, si) => (
              <tr key={s.id} className="kgroom-row">
                <td className="kgroom-name-td">
                  <div className="kgroom-name-wrap">
                    <div className="kgroom-avatar" style={{ background: PALETTE[si % PALETTE.length] }}>
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <span className="kgroom-name">{s.name}</span>
                      {s.role && <span className="kgroom-role">{s.role}</span>}
                    </div>
                  </div>
                </td>
                {visibleDates.map(d => {
                  const entry = adminData.grooming?.[s.id]?.[d];
                  const isToday = d === today;
                  const allGood = entry?.uniform && entry?.shoes && entry?.groom;
                  const partial = !allGood && (entry?.uniform || entry?.shoes || entry?.groom);

                  if (isToday) {
                    return (
                      <td key={d} className="kgroom-td kgroom-today-td">
                        <div className="kgroom-check-group">
                          {GROOM_FIELDS.map(f => {
                            const ck = `${s.id}_${d}_${f.key}`;
                            return (
                              <label key={f.key} className={`kgroom-check-item${entry?.[f.key] ? " checked" : ""}`}>
                                <input type="checkbox" checked={entry?.[f.key] === true}
                                  disabled={saving[ck]} onChange={() => toggle(s.id, d, f.key)} />
                                <span className="kgroom-check-icon">{f.icon}</span>
                                <span>{f.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={d}
                      className={`kgroom-td kgroom-hist-td${allGood ? " kgroom-good" : partial ? " kgroom-partial" : " kgroom-bad"}`}
                      onClick={() => setSelected({ staff: s.name, date: d, entry })}>
                      <div className="kgroom-hist-cell">
                        {allGood ? <span className="kgroom-tick good">✔</span>
                          : partial ? <span className="kgroom-tick partial">{Object.values(entry || {}).filter(Boolean).length}/3</span>
                            : <span className="kgroom-tick bad">✖</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={visibleDates.length + 1}
            />
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Grooming Details</h3>
              <Button3D variant="cancel" iconOnly onClick={() => setSelected(null)}><img src={closeIcon} /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="kgroom-detail-info">
                <div className="kgroom-detail-name">{selected.staff}</div>
                <div className="kgroom-detail-date">
                  {new Date(selected.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="kgroom-detail-checks">
                {GROOM_FIELDS.map(f => (
                  <div key={f.key} className={`kgroom-detail-row${selected.entry?.[f.key] ? " pass" : " fail"}`}>
                    <span className="kgroom-detail-icon">{f.icon}</span>
                    <span className="kgroom-detail-label">{f.label}</span>
                    <span className="kgroom-detail-status">{selected.entry?.[f.key] ? "✔ OK" : "✖ Missing"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEMO MODAL */}
      {showMemo && (
        <div className="modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Add Memo</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { setShowMemo(false); setMemoErrors({}); }}><img src={closeIcon} /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className={`admin-form-group${memoErrors.staffId ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Staff Member"
                  value={memo.staffId}
                  onChange={(val) => { setMemo({ ...memo, staffId: val }); setMemoErrors(p => ({ ...p, staffId: false })); }}
                  options={adminData.staff.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="Select staff…"
                />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${memoErrors.text ? " mat-error" : ""}`}
                    placeholder=" "
                    value={memo.text}
                    onChange={e => { setMemo({ ...memo, text: e.target.value }); setMemoErrors(p => ({ ...p, text: false })); }}
                    rows={4}
                  />
                  <label className={`mat-label${memoErrors.text ? " mat-label-error" : ""}`}>Memo Note<span className="rf-req">*</span></label>
                  <span className={`mat-bar${memoErrors.text ? " mat-bar-error" : ""}`} />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { setShowMemo(false); setMemoErrors({}); }}>Cancel</Button3D>
              <Button3D onClick={saveMemo}>Save Memo</Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
