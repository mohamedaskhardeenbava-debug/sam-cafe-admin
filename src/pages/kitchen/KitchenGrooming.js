import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./KitchenGrooming.css";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";

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
  { key: "uniform", label: "Uniform", icon: "👔" },
  { key: "shoes", label: "Shoes", icon: "👟" },
  { key: "groom", label: "Groom", icon: "✂️" },
];

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3"];

function getWeekStart() {
  const d = new Date(); const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return mon.toISOString().split("T")[0];
}
function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export default function KitchenGrooming({ adminData, setAdminData }) {
  const today = new Date().toISOString().split("T")[0];

  // Rolling 92-day pool (3 months)
  const dates = useMemo(() => {
    const arr = [];
    for (let i = 91; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split("T")[0]);
    }
    return arr;
  }, []);

  const [selected, setSelected] = useState(null);
  const [showMemo, setShowMemo] = useState(false);
  const [memo, setMemo] = useState({ staffId: "", text: "" });
  const [saving, setSaving] = useState({});
  const [groomSearch, setGroomSearch] = useState("");
  const [groomFrom, setGroomFrom] = useState(getWeekStart);
  const [groomTo, setGroomTo] = useState(today);
  const [showSummary, setShowSummary] = useState(false);
  const [groomPreset, setGroomPreset] = useState("week");

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
    if (!visibleStaff.length) { alert("No data to export"); return; }
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
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Kitchen Grooming");
    XLSX.writeFile(wb, `kitchen_grooming_${groomFrom}_to_${groomTo}.xlsx`);
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
      console.error("KitchenGrooming toggle failed:", err.message);
      setAdminData(prev => ({ ...prev, grooming: prevData }));
    } finally {
      setSaving(prev => ({ ...prev, [ck]: false }));
    }
  };

  // ── Save memo ─────────────────────────────────────────────────
  const saveMemo = async () => {
    if (!memo.staffId || !memo.text) return;
    const memoDate = new Date().toISOString().split("T")[0];
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
    } catch (err) { console.error("Memo save failed:", err.message); }
    setShowMemo(false); setMemo({ staffId: "", text: "" });
  };

  return (
    <div className="kgroom-page">

      {/* HEADER */}
      <div className="kgroom-header">
        <div>
          <h2 className="kgroom-title">Kitchen Grooming</h2>
          <p className="kgroom-subtitle">Uniform · Shoes · Grooming</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="orders-export-btn" onClick={exportGrooming}>Export</button>
          <button className="kgroom-add-btn" onClick={() => setShowMemo(true)}>+ Add Memo</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="kgroom-filter-bar">
        <input className="kgroom-search" placeholder="🔍 Search staff…"
          value={groomSearch} onChange={e => setGroomSearch(e.target.value)} />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="kgroom-filter-label">Range</span>
          {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([k, lbl]) => (
            <button key={k} className={`sched-pill-btn${groomPreset === k ? " active" : ""}`}
              onClick={() => applyPreset(k)}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="kgroom-filter-label">From</span>
          <CustomDatePicker value={groomFrom} max={groomTo || today}
            onChange={v => { setGroomFrom(v); setGroomPreset("custom"); }} placeholder="Start date" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="kgroom-filter-label">To</span>
          <CustomDatePicker value={groomTo} min={groomFrom} max={today}
            onChange={v => { setGroomTo(v); setGroomPreset("custom"); }} placeholder="End date" />
        </div>
        {(groomSearch || groomPreset === "custom") && (
          <button className="ae-clear-filter" onClick={() => { setGroomSearch(""); applyPreset("week"); }}>Clear</button>
        )}
        <span className="ae-result-count">{visibleDates.length} day(s) · {visibleStaff.length} staff</span>
        <button className={`sched-pill-btn kgroom-summary-toggle${showSummary ? " active" : ""}`}
          onClick={() => setShowSummary(v => !v)}>📊 Staff Overview</button>
      </div>

      {/* SUMMARY CARDS */}
      <div className={`kgroom-summary-collapsible${showSummary ? " kgroom-summary-open" : ""}`}>
        <div className="kgroom-summary-row">
          {staffStats.map((s, i) => (
            <div key={s.id} className="kgroom-summary-card">
              <div className="kgroom-sum-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="kgroom-sum-info">
                <span className="kgroom-sum-name">{s.name}</span>
                <div className="kgroom-sum-bar-wrap">
                  <div className="kgroom-sum-bar"
                    style={{ width: `${s.pct}%`, background: s.pct >= 80 ? "#06d6a0" : s.pct >= 50 ? "#ffd166" : "#ef476f" }} />
                </div>
                <div className="kgroom-sum-row">
                  <span className="kgroom-sum-days">{s.perfect}/{visibleDates.length} days</span>
                  <span className="kgroom-sum-pct"
                    style={{ color: s.pct >= 80 ? "#06d6a0" : s.pct >= 50 ? "#f59e0b" : "#ef476f" }}>{s.pct}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
        <div className="kgroom-overlay">
          <div className="kgroom-modal">
            <div className="kgroom-modal-header">
              <h3>Grooming Details</h3>
              <button className="kgroom-close-btn" onClick={() => setSelected(null)} />
            </div>
            <div className="kgroom-modal-body">
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
        <div className="kgroom-overlay">
          <div className="kgroom-modal">
            <div className="kgroom-modal-header">
              <h3>Add Memo</h3>
              <button className="kgroom-close-btn" onClick={() => setShowMemo(false)} />
            </div>
            <div className="kgroom-modal-body">
              <div className="kgroom-form-group">
                <label>Staff Member</label>
                <select value={memo.staffId} onChange={e => setMemo({ ...memo, staffId: e.target.value })}>
                  <option value="">Select staff…</option>
                  {adminData.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="kgroom-form-group">
                <label>Memo Note</label>
                <textarea value={memo.text} onChange={e => setMemo({ ...memo, text: e.target.value })}
                  placeholder="Write your memo here…" rows={4} />
              </div>
            </div>
            <div className="kgroom-modal-footer">
              <button className="kgroom-btn-primary" onClick={saveMemo}>Save Memo</button>
              <button className="kgroom-btn-secondary" onClick={() => setShowMemo(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}