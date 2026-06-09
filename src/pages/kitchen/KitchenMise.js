import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./KitchenMise.css";
import { getTodayKey, getTodayFormatted } from "../../App";
import api from "../../api";

/*
  DATA SHAPE (kitchenMise in db.json):
  {
    "2026-05-19": {
      "Arrangement": { "staff": "Thamu", "verified": false, "time": "" },
      "Floor":       { "staff": "Arun",  "verified": true,  "time": "9:15:00 AM" },
      ...
    }
  }
  Today's entries start with verified:false, time:"" by default.
  Checkbox toggles verified + records time.
*/

const SECTION_META = {
  mise: { label: "Mise en Place", color: "#3b82f6", icon: "" },
  cleaning: { label: "Cleaning", color: "#10b981", icon: "" },
};

export default function KitchenMise({ adminData, setAdminData }) {
  const today = getTodayKey();
  const todayFmt = getTodayFormatted();
  const tasks = adminData.tasks?.kitchen || {};

  const [miseSearch, setMiseSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");

  // Use today's mise data; fall back to empty
  const miseDay = adminData.kitchenMise?.[today] || {};

  const filteredTasks = useMemo(() => {
    const q = miseSearch.toLowerCase();
    const result = {};
    Object.entries(tasks).forEach(([sec, items]) => {
      if (sectionFilter !== "all" && sec !== sectionFilter) return;
      const filtered = (items || []).filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, miseSearch, sectionFilter]);

  // Stats
  const allTasks = Object.values(tasks).flat();
  const verifiedCnt = allTasks.filter(t => miseDay[t]?.verified).length;
  const assignedCnt = allTasks.filter(t => miseDay[t]?.staff).length;

  // ── Export ────────────────────────────────────────────────────
  const exportMise = () => {
    const rows = [];
    Object.entries(filteredTasks).forEach(([sec, items]) => {
      items.forEach(task => {
        const d = miseDay[task];
        rows.push({
          Section: SECTION_META[sec]?.label || sec,
          Task: task,
          Staff: d?.staff || "—",
          Verified: d?.verified ? "✔ Yes" : "✖ No",
          Time: d?.time || "—",
        });
      });
    });
    if (!rows.length) { alert("No mise data to export"); return; }
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Kitchen Mise");
    XLSX.writeFile(wb, `kitchen_mise_${today}.xlsx`);
  };

  // ── Toggle verified ───────────────────────────────────────────
  const toggle = async (task) => {
    const isChecked = miseDay[task]?.verified;
    const updated = {
      ...adminData.kitchenMise,
      [today]: {
        ...miseDay,
        [task]: {
          ...miseDay[task],
          verified: !isChecked,
          time: !isChecked ? new Date().toLocaleTimeString() : ""
        }
      }
    };
    try {
      await api.put("/kitchenMise", updated);
      setAdminData(prev => ({ ...prev, kitchenMise: updated }));
    } catch (err) {
      console.error("SAVE FAILED:", err);
      setAdminData(prev => ({ ...prev, kitchenMise: updated }));
    }
  };

  return (
    <div className="mise-page">

      {/* HEADER */}
      <div className="mise-header">
        <div className="mise-header-left">
          <h2 className="mise-title">Kitchen Mise en Place & Cleaning</h2>
          <span className="mise-date">{todayFmt}</span>
        </div>
        <div className="mise-header-right">
          <div className="mise-stat-badge mise-stat-assigned">
            <span className="mise-stat-num">{assignedCnt}/{allTasks.length}</span>
            <span className="mise-stat-lbl">Assigned</span>
          </div>
          <div className="mise-stat-badge mise-stat-verified">
            <span className="mise-stat-num">{verifiedCnt}/{allTasks.length}</span>
            <span className="mise-stat-lbl">Verified</span>
          </div>
          <button className="modal-save-btn" onClick={exportMise}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Export</span>
          </button>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="mise-progress-wrap">
        <div
          className="mise-progress-bar"
          style={{ width: allTasks.length ? `${Math.round((verifiedCnt / allTasks.length) * 100)}%` : "0%" }}
        />
      </div>

      {/* FILTER BAR */}
      <div className="mise-filter-bar">
        <input
          className="search-input"
          placeholder=" Search tasks…"
          value={miseSearch}
          onChange={e => setMiseSearch(e.target.value)}
        />
        <div className="mise-pills">
          <span className="mise-filter-lbl">Section</span>
          {[["all", "All"], ...Object.keys(tasks).map(s => [s, SECTION_META[s]?.label || s])].map(([k, lbl]) => (
            <button key={k}
              className={`filter-pill${sectionFilter === k ? " active" : ""}`}
              onClick={() => setSectionFilter(k)}>{lbl}</button>
          ))}
        </div>
        {(miseSearch || sectionFilter !== "all") && (
          <button className="ae-clear-filter"
            onClick={() => { setMiseSearch(""); setSectionFilter("all"); }}>Clear</button>
        )}
      </div>

      {/* UNIFIED TABLE */}
      <div className="mise-table-wrapper">
        <table className="mise-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Staff</th>
              <th>Verify</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(filteredTasks).map(([sec, items]) => (
              <React.Fragment key={sec}>
                <tr className="mise-section-row">
                  <td colSpan="4">
                    <span className="mise-section-icon">{SECTION_META[sec]?.icon}</span>
                    {SECTION_META[sec]?.label || sec.toUpperCase()}
                    <span className="mise-section-row-count">
                      {items.filter(t => miseDay[t]?.verified).length}/{items.length} verified
                    </span>
                  </td>
                </tr>
                {items.map(task => {
                  const entry = miseDay[task];
                  const staffAssigned = !!entry?.staff;
                  const isVerified = !!entry?.verified;
                  return (
                    <tr key={task} className={isVerified ? "mise-row-verified" : ""}>
                      <td>
                        <span className={`mise-task-dot ${isVerified ? "dot-verified" : staffAssigned ? "dot-assigned" : ""}`} />
                        {task}
                      </td>
                      <td className={staffAssigned ? "" : "mise-no-staff"}>
                        {entry?.staff || "Not assigned"}
                      </td>
                      <td>
                        <label className="mise-check-label">
                          <input
                            type="checkbox"
                            disabled={!staffAssigned}
                            checked={isVerified}
                            onChange={() => toggle(task)}
                          />
                          <span className={`mise-check-custom ${isVerified ? "checked" : ""} ${!staffAssigned ? "disabled" : ""}`} />
                        </label>
                      </td>
                      <td className="mise-time">{entry?.time || "—"}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}