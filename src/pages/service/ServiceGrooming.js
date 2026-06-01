import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "./ServiceGrooming.css";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";

/*
  DATA SHAPE (serviceGrooming in db.json):
  {
    "staff_vijay": {
      "2026-05-19": { "uniform": false, "shoes": false, "groom": false },
      "2026-05-18": { "uniform": true,  "shoes": true,  "groom": true  },
      ...
    }
  }
  Today's entries start all false by default (seeded by db.json).
*/

const GROOM_FIELDS = [
  { key: "uniform", label: "Uniform", icon: "👔" },
  { key: "shoes", label: "Shoes", icon: "👟" },
  { key: "groom", label: "Groom", icon: "✂️" },
];

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function ServiceGrooming({ adminData, setAdminData }) {
  const today = toLocalISO(new Date());

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
  const [openMemoDropdown, setOpenMemoDropdown] = useState(false);
  const [saving, setSaving] = useState({});
  const [sgroomSearch, setSgroomSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const [sgroomFrom, setSgroomFrom] = useState(getWeekStart);
  const [sgroomTo, setSgroomTo] = useState(today);
  const [sgroomPreset, setSgroomPreset] = useState("week");

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      setOpenMemoDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyPreset = (preset) => {
    setSgroomPreset(preset);
    if (preset === "today") { setSgroomFrom(today); setSgroomTo(today); }
    if (preset === "week") { setSgroomFrom(getWeekStart()); setSgroomTo(today); }
    if (preset === "month") { setSgroomFrom(getMonthStart()); setSgroomTo(today); }
  };

  const visibleDates = useMemo(() =>
    dates.filter(d => d >= sgroomFrom && d <= sgroomTo),
    [dates, sgroomFrom, sgroomTo]);

  const visibleStaff = useMemo(() => {
    const q = sgroomSearch.toLowerCase();
    return adminData.staff.filter(s =>
      !q || (s.name || "").toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q));
  }, [adminData.staff, sgroomSearch]);

  const staffStats = useMemo(() => visibleStaff.map((s, i) => {
    let perfect = 0;
    visibleDates.forEach(d => {
      const e = adminData.serviceGrooming?.[s.id]?.[d];
      if (e?.uniform && e?.shoes && e?.groom) perfect++;
    });
    return {
      id: s.id, name: s.name, role: s.role, perfect,
      pct: visibleDates.length > 0 ? Math.round((perfect / visibleDates.length) * 100) : 0,
    };
  }), [visibleStaff, adminData.serviceGrooming, visibleDates]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(visibleStaff.length, 20);

  const exportGrooming = () => {
    if (!visibleStaff.length) { alert("No data to export"); return; }
    const rows = visibleStaff.map(s => {
      const row = { Name: s.name || "—", Role: s.role || "—" };
      let perfect = 0;
      visibleDates.forEach(d => {
        const e = adminData.serviceGrooming?.[s.id]?.[d];
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
    XLSX.utils.book_append_sheet(wb, sheet, "Service Grooming");
    XLSX.writeFile(wb, `service_grooming_${sgroomFrom}_to_${sgroomTo}.xlsx`);
  };

  const toggle = async (staffId, date, field) => {
    const ck = `${staffId}_${date}_${field}`;
    setSaving(prev => ({ ...prev, [ck]: true }));
    const prevData = adminData.serviceGrooming || {};
    const current = prevData[staffId]?.[date] || {};
    const updated = {
      ...prevData,
      [staffId]: { ...(prevData[staffId] || {}), [date]: { ...current, [field]: !current[field] } }
    };
    setAdminData(prev => ({ ...prev, serviceGrooming: updated }));
    try {
      await api.put("/serviceGrooming", updated);
    } catch (err) {
      console.error("ServiceGrooming toggle failed:", err.message);
      setAdminData(prev => ({ ...prev, serviceGrooming: prevData }));
    } finally {
      setSaving(prev => ({ ...prev, [ck]: false }));
    }
  };

  const saveMemo = async () => {
    if (!memo.staffId || !memo.text) return;
    const memoDate = toLocalISO(new Date());
    const prevData = adminData.serviceGrooming || {};
    const updated = {
      ...prevData,
      memo: {
        ...(prevData.memo || {}),
        [memo.staffId]: { ...(prevData.memo?.[memo.staffId] || {}), [memoDate]: memo.text }
      }
    };
    try {
      await api.put("/serviceGrooming", updated);
      setAdminData(prev => ({ ...prev, serviceGrooming: updated }));
    } catch (err) { console.error("Memo save failed:", err.message); }
    setShowMemo(false); setMemo({ staffId: "", text: "" });
  };

  return (
    <div className="sgroom-page">

      {/* HEADER */}
      <div className="sgroom-header">
        <div>
          <h2 className="sgroom-title">Service Grooming</h2>
          <p className="sgroom-subtitle">Uniform · Shoes · Grooming</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="export-btn" onClick={exportGrooming}>Export</button>
          <button className="category-add-btn" onClick={() => setShowMemo(true)}>+ Add Memo</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="sgroom-filter-bar">
        {/* SEARCH WITH DROPDOWN */}
        <div className="sgroom-search-wrap" ref={searchRef}>
          <input
            className="search-input"
            placeholder=" Search staff…"
            value={sgroomSearch}
            onChange={e => { setSgroomSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
          />
          {searchOpen && staffStats.length > 0 && (
            <div className="sgroom-search-dropdown">
              {staffStats
                .filter(s =>
                  s.name.toLowerCase().includes(sgroomSearch.toLowerCase()) ||
                  (s.role || "").toLowerCase().includes(sgroomSearch.toLowerCase())
                )
                .map((s, i) => (
                  <div
                    key={s.id}
                    className="sgroom-search-suggestion"
                    onMouseDown={() => {
                      setSgroomSearch(s.name);
                      setSearchOpen(false);
                    }}
                  >
                    <div className="sgroom-sug-avatar" style={{ background: `hsl(${i * 55 + 200},70%,55%)` }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="sgroom-sug-info">
                      <span className="sgroom-sug-name">{s.name}</span>
                      {s.role && <span className="sgroom-sug-role">{s.role}</span>}
                    </div>
                    <div className="sgroom-sug-bar-wrap">
                      <div
                        className="sgroom-sug-bar"
                        style={{
                          width: `${s.pct}%`,
                          background: s.pct >= 80 ? "#16a34a" : s.pct >= 50 ? "#f59e0b" : "#dc2626"
                        }}
                      />
                    </div>
                    <span
                      className="sgroom-sug-pct"
                      style={{ color: s.pct >= 80 ? "#16a34a" : s.pct >= 50 ? "#f59e0b" : "#dc2626" }}
                    >{s.pct}%</span>
                  </div>
                ))}
              {staffStats.filter(s =>
                s.name.toLowerCase().includes(sgroomSearch.toLowerCase()) ||
                (s.role || "").toLowerCase().includes(sgroomSearch.toLowerCase())
              ).length === 0 && (
                  <div className="sgroom-search-no-result">No staff found</div>
                )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([k, lbl]) => (
            <button key={k} className={`sched-pill-btn${sgroomPreset === k ? " active" : ""}`}
              onClick={() => applyPreset(k)}>{lbl}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="sgroom-filter-label">From</span>
          <CustomDatePicker value={sgroomFrom} max={sgroomTo || today}
            onChange={v => { setSgroomFrom(v); setSgroomPreset("custom"); }} placeholder="Start date" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="sgroom-filter-label">To</span>
          <CustomDatePicker value={sgroomTo} min={sgroomFrom} max={today}
            onChange={v => { setSgroomTo(v); setSgroomPreset("custom"); }} placeholder="End date" />
        </div>
        {(sgroomSearch || sgroomPreset === "custom") && (
          <button className="ae-clear-filter" onClick={() => { setSgroomSearch(""); applyPreset("week"); }}>Clear</button>
        )}
        <span className="ae-result-count">{visibleDates.length} day(s) · {visibleStaff.length} staff</span>
      </div>

      {/* SUMMARY CARDS REMOVED — now shown in search dropdown */}

      {/* TABLE */}
      <div className="sgroom-table-wrapper" ref={containerRef}>
        <table className="sgroom-table">
          <thead>
            <tr>
              <th className="sgroom-staff-th">Staff</th>
              {visibleDates.map(d => {
                const dObj = new Date(d); const isToday = d === today;
                return (
                  <th key={d} className={`sgroom-date-th${isToday ? " sgroom-today-th" : ""}`}>
                    <div className="sgroom-date-head">
                      <span className="sgroom-date-num">{dObj.getDate()}</span>
                      <span className="sgroom-date-wd">{WEEKDAY[dObj.getDay()]}</span>
                      {isToday && <span className="sgroom-today-badge">Today</span>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleStaff.slice(0, displayLimit).map((s, si) => (
              <tr key={s.id} className="sgroom-row">
                <td className="sgroom-name-td">
                  <div className="sgroom-name-wrap">
                    <div className="sgroom-avatar" style={{ background: `hsl(${si * 55 + 200},70%,55%)` }}>
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <span className="sgroom-name">{s.name}</span>
                      {s.role && <span className="sgroom-role">{s.role}</span>}
                    </div>
                  </div>
                </td>
                {visibleDates.map(d => {
                  const entry = adminData.serviceGrooming?.[s.id]?.[d];
                  const isToday = d === today;
                  const allGood = entry?.uniform && entry?.shoes && entry?.groom;
                  const partial = !allGood && (entry?.uniform || entry?.shoes || entry?.groom);

                  if (isToday) {
                    return (
                      <td key={d} className="sgroom-td sgroom-today-td">
                        <div className="sgroom-check-group">
                          {GROOM_FIELDS.map(f => {
                            const ck = `${s.id}_${d}_${f.key}`;
                            return (
                              <label key={f.key} className={`sgroom-check-item${entry?.[f.key] ? " checked" : ""}`}>
                                <input type="checkbox" checked={entry?.[f.key] === true}
                                  disabled={saving[ck]} onChange={() => toggle(s.id, d, f.key)} />
                                <span className="sgroom-check-icon">{f.icon}</span>
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
                      className={`sgroom-td sgroom-hist-td${allGood ? " sgroom-good" : partial ? " sgroom-partial" : " sgroom-bad"}`}
                      onClick={() => setSelected({ staff: s.name, date: d, entry })}>
                      <div className="sgroom-hist-cell">
                        {allGood ? <span className="sgroom-tick good">✔</span>
                          : partial ? <span className="sgroom-tick partial">{Object.values(entry || {}).filter(Boolean).length}/3</span>
                            : <span className="sgroom-tick bad">✖</span>}
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
          <div className="modal">
            <div className="modal-header">
              <h3>Grooming Details</h3>
              <button className="close-btn" onClick={() => setSelected(null)} />
            </div>
            <div className="modal-body">
              <div className="sgroom-detail-info">
                <div className="sgroom-detail-name">{selected.staff}</div>
                <div className="sgroom-detail-date">
                  {new Date(selected.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="sgroom-detail-checks">
                {GROOM_FIELDS.map(f => (
                  <div key={f.key} className={`sgroom-detail-row${selected.entry?.[f.key] ? " pass" : " fail"}`}>
                    <span className="sgroom-detail-icon">{f.icon}</span>
                    <span className="sgroom-detail-label">{f.label}</span>
                    <span className="sgroom-detail-status">{selected.entry?.[f.key] ? "✔ OK" : "✖ Missing"}</span>
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
          <div className="modal">
            <div className="modal-header">
              <h3>Add Memo</h3>
              <button className="close-btn" onClick={() => setShowMemo(false)} />
            </div>
            <div className="modal-body">
              <div className="sgroom-form-group">
                <label>Staff Member</label>
                <div className="dishes-dropdown-wrapper">
                  <button
                    type="button"
                    className="dishes-status-dropdown"
                    onMouseDown={e => { e.stopPropagation(); setOpenMemoDropdown(p => !p); }}
                  >
                    {memo.staffId
                      ? (adminData.staff.find(s => s.id === memo.staffId)?.name || memo.staffId)
                      : "Select staff…"}
                  </button>
                  {openMemoDropdown && (
                    <div className="dropdown-menu">
                      {adminData.staff.map(s => (
                        <div key={s.id} onMouseDown={e => { e.stopPropagation(); setMemo({ ...memo, staffId: s.id }); setOpenMemoDropdown(false); }}>
                          {s.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="sgroom-form-group">
                <label>Memo Note</label>
                <textarea value={memo.text} onChange={e => setMemo({ ...memo, text: e.target.value })}
                  placeholder="Write your memo here…" rows={4} />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowMemo(false)}>Cancel</button>
              <button onClick={saveMemo}>Save Memo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}