import React, { useState, useMemo } from "react";
import "./ServiceGrooming.css";
import api from "../../api";

const GROOM_FIELDS = [
  { key: "uniform", label: "Uniform", icon: "👔" },
  { key: "shoes", label: "Shoes", icon: "👟" },
  { key: "groom", label: "Groom", icon: "✂️" },
];

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─── Helpers ─────────────────────────────────────────── */
const buildGroomKey = (date) => date; // dates are already ISO strings

export default function ServiceGrooming({ adminData, setAdminData }) {
  const dates = (() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().split("T")[0]);
    }
    return arr;
  })();

  const today = dates[dates.length - 1];

  const [selected, setSelected] = useState(null);
  const [showMemo, setShowMemo] = useState(false);
  const [memo, setMemo] = useState({ staffId: "", text: "" });
  const [saving, setSaving] = useState({}); // { staffId_date_field: true }

  /* ─── Toggle a single grooming check ─────────────────── */
  const toggle = async (staffId, date, field) => {
    const cellKey = `${staffId}_${date}_${field}`;
    setSaving(prev => ({ ...prev, [cellKey]: true }));

    const prevData = adminData.serviceGrooming || {};

    const currentEntry = prevData[staffId]?.[date] || {};
    const newVal = !currentEntry[field];

    const updatedEntry = { ...currentEntry, [field]: newVal };

    const updatedStaffDates = {
      ...(prevData[staffId] || {}),
      [date]: updatedEntry,
    };

    const updatedGrooming = {
      ...prevData,
      [staffId]: updatedStaffDates,
    };

    // Optimistic UI update
    setAdminData(prev => ({ ...prev, serviceGrooming: updatedGrooming }));

    try {
      // serviceGrooming in db.json is stored as a single document
      // Adjust the endpoint/method to match your actual API shape.
      // If your API is json-server with /serviceGrooming/:id, use id=1.
      // If it stores the whole object at /serviceGrooming, use PUT /serviceGrooming.
      await api.put("/serviceGrooming", updatedGrooming);
    } catch (err) {
      console.error("ServiceGrooming toggle failed:", err.message);
      // Rollback
      setAdminData(prev => ({ ...prev, serviceGrooming: prevData }));
    } finally {
      setSaving(prev => ({ ...prev, [cellKey]: false }));
    }
  };

  /* ─── Save memo ───────────────────────────────────────── */
  const saveMemo = async () => {
    if (!memo.staffId || !memo.text) return;

    const memoToday = new Date().toISOString().split("T")[0];
    const prevData = adminData.serviceGrooming || {};

    const updated = {
      ...prevData,
      memo: {
        ...(prevData.memo || {}),
        [memo.staffId]: {
          ...(prevData.memo?.[memo.staffId] || {}),
          [memoToday]: memo.text,
        },
      },
    };

    try {
      await api.put("/serviceGrooming", updated);
      setAdminData(prev => ({ ...prev, serviceGrooming: updated }));
    } catch (err) {
      console.error("Memo save failed:", err.message);
    }

    setShowMemo(false);
    setMemo({ staffId: "", text: "" });
  };

  /* ─── Derived: 7-day compliance per staff ─────────────── */
  const staffStats = useMemo(() => {
    return adminData.staff.map(s => {
      let perfect = 0;
      dates.forEach(d => {
        const e = adminData.serviceGrooming?.[s.id]?.[d];
        if (e?.uniform && e?.shoes && e?.groom) perfect++;
      });
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        perfect,
        pct: Math.round((perfect / dates.length) * 100),
      };
    });
  }, [adminData.staff, adminData.serviceGrooming, dates]);

  return (
    <div className="sgroom-page">

      {/* HEADER */}
      <div className="sgroom-header">
        <div>
          <h2 className="sgroom-title">Service Grooming</h2>
          <p className="sgroom-subtitle">Last 7 days — Uniform · Shoes · Grooming</p>
        </div>
        <button className="sgroom-add-btn" onClick={() => setShowMemo(true)}>+ Add Memo</button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="sgroom-summary-row">
        {staffStats.map((s, i) => (
          <div key={s.id} className="sgroom-summary-card">
            <div className="sgroom-sum-avatar" style={{ background: `hsl(${i * 55 + 200},70%,55%)` }}>
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="sgroom-sum-info">
              <span className="sgroom-sum-name">{s.name}</span>
              <div className="sgroom-sum-bar-wrap">
                <div className="sgroom-sum-bar" style={{ width: `${s.pct}%`, background: s.pct >= 80 ? "#16a34a" : s.pct >= 50 ? "#f59e0b" : "#dc2626" }} />
              </div>
              <span className="sgroom-sum-pct">{s.pct}% compliant</span>
            </div>
          </div>
        ))}
      </div>

      {/* TABLE */}
      <div className="sgroom-table-wrapper">
        <table className="sgroom-table">
          <thead>
            <tr>
              <th className="sgroom-staff-th">Staff</th>
              {dates.map(d => {
                const dObj = new Date(d);
                const isToday = d === today;
                return (
                  <th key={d} className={`sgroom-date-th ${isToday ? "sgroom-today-th" : ""}`}>
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
            {adminData.staff.map((s, si) => (
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

                {dates.map(d => {
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
                              <label key={f.key} className={`sgroom-check-item ${entry?.[f.key] ? "checked" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={entry?.[f.key] === true}
                                  disabled={saving[ck]}
                                  onChange={() => toggle(s.id, d, f.key)}
                                />
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
                    <td
                      key={d}
                      className={`sgroom-td sgroom-hist-td ${allGood ? "sgroom-good" : partial ? "sgroom-partial" : "sgroom-bad"}`}
                      onClick={() => setSelected({ staff: s.name, date: d, entry })}
                    >
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
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <div className="sgroom-overlay">
          <div className="sgroom-modal">
            <div className="sgroom-modal-header">
              <h3>Grooming Details</h3>
              <button className="sgroom-close-btn" onClick={() => setSelected(null)} />
            </div>
            <div className="sgroom-modal-body">
              <div className="sgroom-detail-info">
                <div className="sgroom-detail-name">{selected.staff}</div>
                <div className="sgroom-detail-date">
                  {new Date(selected.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="sgroom-detail-checks">
                {GROOM_FIELDS.map(f => (
                  <div key={f.key} className={`sgroom-detail-row ${selected.entry?.[f.key] ? "pass" : "fail"}`}>
                    <span className="sgroom-detail-icon">{f.icon}</span>
                    <span className="sgroom-detail-label">{f.label}</span>
                    <span className="sgroom-detail-status">
                      {selected.entry?.[f.key] ? "✔ OK" : "✖ Missing"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEMO MODAL */}
      {showMemo && (
        <div className="sgroom-overlay">
          <div className="sgroom-modal">
            <div className="sgroom-modal-header">
              <h3>Add Memo</h3>
              <button className="sgroom-close-btn" onClick={() => setShowMemo(false)} />
            </div>
            <div className="sgroom-modal-body">
              <div className="sgroom-form-group">
                <label>Staff Member</label>
                <select value={memo.staffId} onChange={(e) => setMemo({ ...memo, staffId: e.target.value })}>
                  <option value="">Select staff…</option>
                  {adminData.staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="sgroom-form-group">
                <label>Memo Note</label>
                <textarea
                  value={memo.text}
                  onChange={(e) => setMemo({ ...memo, text: e.target.value })}
                  placeholder="Write your memo here…"
                  rows={4}
                />
              </div>
            </div>
            <div className="sgroom-modal-footer">
              <button className="sgroom-btn-primary" onClick={saveMemo}>Save Memo</button>
              <button className="sgroom-btn-secondary" onClick={() => setShowMemo(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}