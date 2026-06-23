import React, { useState, useMemo, useRef, useEffect } from "react";
import { exportToExcel } from "../../utils/excelUtils";
import "./ServiceGrooming.css";
import api from "../../api";
import { useToast } from "../../useToast";
import closeIcon from "../../icon/close-icon.png";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";
import CustomDropdown from "../../components/CustomDropdown";

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
  { key: "uniform", label: "Uniform", icon: "" },
  { key: "shoes", label: "Shoes", icon: "" },
  { key: "groom", label: "Groom", icon: "" },
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
  const { toast } = useToast();
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
  const [memoErrors, setMemoErrors] = useState({});
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
    if (!visibleStaff.length) { toast.warning("No data to export"); return; }
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
    exportToExcel({ rows, sheetName: "Service Grooming", fileName: `service_grooming_${sgroomFrom}_to_${sgroomTo}.xlsx` });
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
      toast.error("Failed to save grooming check. Please try again.");
      setAdminData(prev => ({ ...prev, serviceGrooming: prevData }));
    } finally {
      setSaving(prev => ({ ...prev, [ck]: false }));
    }
  };

  const saveMemo = async () => {
    const errs = {};
    if (!memo.staffId) errs.staffId = true;
    if (!memo.text.trim()) errs.text = true;
    if (Object.keys(errs).length) { setMemoErrors(errs); return; }
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
    } catch (err) { toast.error("Failed to save memo. Please try again."); }
    setShowMemo(false); setMemo({ staffId: "", text: "" }); setMemoErrors({});
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
          <button
            className="modal-save-btn"
            onClick={exportGrooming}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Export</span>
          </button>
          <button
            className="modal-save-btn"
            onClick={() => setShowMemo(true)}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">+ Add Memo</span>
          </button>
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
            <button key={k} className={`filter-pill${sgroomPreset === k ? " active" : ""}`}
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
              <button className="modal-cancel-btn" onClick={() => setSelected(null)} >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
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
              <button className="modal-cancel-btn" onClick={() => { setShowMemo(false); setMemoErrors({}); }} >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>
            <div className="modal-body">
              <div className={`form-group${memoErrors.staffId ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Staff Member"
                  value={memo.staffId}
                  onChange={val => { setMemo({ ...memo, staffId: val }); setMemoErrors(p => ({ ...p, staffId: false })); }}
                  options={adminData.staff.map(s => ({ value: s.id, label: s.name }))}
                  placeholder="Select staff…"
                />
              </div>
              <div className="form-group">
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
            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                onClick={() => { setShowMemo(false); setMemoErrors({}); }}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Cancel</span>
              </button>
              <button
                className="modal-save-btn"
                onClick={saveMemo}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Save Memo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}