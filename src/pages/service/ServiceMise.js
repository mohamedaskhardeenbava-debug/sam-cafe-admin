import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./ServiceMise.css";
import { getTodayKey, getTodayFormatted } from "../../App";
import api from "../../api";

/*
  DATA SHAPE (serviceMise in db.json):
  {
    "2026-05-19": {
      "Table Setup":  { "staff": "Vijay", "verified": false, "time": "" },
      "Floor":        { "staff": "Siva",  "verified": true,  "time": "9:10:00 AM" },
      ...
    }
  }
*/

const SECTION_META = {
  mise: { label: "Mise en Place", color: "#8b5cf6", icon: "🍽️" },
  cleaning: { label: "Cleaning", color: "#f59e0b", icon: "✨" },
};

export default function ServiceMise({ adminData, setAdminData }) {
  const today = getTodayKey();
  const todayFmt = getTodayFormatted();
  const tasks = adminData.tasks?.service || {};

  const [miseSearch, setMiseSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");

  const miseDay = adminData.serviceMise?.[today] || {};

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
    XLSX.utils.book_append_sheet(wb, sheet, "Service Mise");
    XLSX.writeFile(wb, `service_mise_${today}.xlsx`);
  };

  // ── Toggle verified ───────────────────────────────────────────
  const toggle = async (task) => {
    const isChecked = miseDay[task]?.verified;
    const updated = {
      ...adminData.serviceMise,
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
      await api.put("/serviceMise", updated);
      setAdminData(prev => ({ ...prev, serviceMise: updated }));
    } catch (err) {
      console.error("SAVE FAILED:", err);
      setAdminData(prev => ({ ...prev, serviceMise: updated }));
    }
  };

  return (
    <div className="service-mise-page">

      {/* HEADER */}
      <div className="service-mise-header">
        <div className="service-mise-header-left">
          <h2 className="service-mise-title">Service Mise en Place & Cleaning</h2>
          <span className="service-mise-date">{todayFmt}</span>
        </div>
        <div className="service-mise-header-right">
          <div className="service-mise-stat-badge service-mise-stat-assigned">
            <span className="service-mise-stat-num">{assignedCnt}/{allTasks.length}</span>
            <span className="service-mise-stat-lbl">Assigned</span>
          </div>
          <div className="service-mise-stat-badge service-mise-stat-verified">
            <span className="service-mise-stat-num">{verifiedCnt}/{allTasks.length}</span>
            <span className="service-mise-stat-lbl">Verified</span>
          </div>
          <button className="export-btn" onClick={exportMise}>Export</button>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="service-mise-progress-wrap">
        <div
          className="service-mise-progress-bar"
          style={{ width: allTasks.length ? `${Math.round((verifiedCnt / allTasks.length) * 100)}%` : "0%" }}
        />
      </div>

      {/* FILTER BAR */}
      <div className="service-mise-filter-bar">
        <input
          className="search-input"
          placeholder=" Search tasks…"
          value={miseSearch}
          onChange={e => setMiseSearch(e.target.value)}
        />
        <div className="service-mise-pills">
          <span className="service-mise-filter-lbl">Section</span>
          {[["all", "All"], ...Object.keys(tasks).map(s => [s, SECTION_META[s]?.label || s])].map(([k, lbl]) => (
            <button key={k}
              className={`sched-pill-btn${sectionFilter === k ? " active" : ""}`}
              onClick={() => setSectionFilter(k)}>{lbl}</button>
          ))}
        </div>
        {(miseSearch || sectionFilter !== "all") && (
          <button className="ae-clear-filter"
            onClick={() => { setMiseSearch(""); setSectionFilter("all"); }}>Clear</button>
        )}
      </div>

      {/* UNIFIED TABLE */}
      <div className="service-mise-table-wrapper">
        <table className="service-mise-table">
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
                <tr className="service-mise-section-row">
                  <td colSpan="4">
                    <span className="service-mise-section-icon">{SECTION_META[sec]?.icon}</span>
                    {SECTION_META[sec]?.label || sec.toUpperCase()}
                    <span className="service-mise-section-row-count">
                      {items.filter(t => miseDay[t]?.verified).length}/{items.length} verified
                    </span>
                  </td>
                </tr>
                {items.map(task => {
                  const entry = miseDay[task];
                  const staffAssigned = !!entry?.staff;
                  const isVerified = !!entry?.verified;
                  return (
                    <tr key={task} className={isVerified ? "service-mise-row-verified" : ""}>
                      <td>
                        <span className={`service-mise-task-dot ${isVerified ? "dot-verified" : staffAssigned ? "dot-assigned" : ""}`} />
                        {task}
                      </td>
                      <td className={staffAssigned ? "" : "service-mise-no-staff"}>
                        {entry?.staff || "Not assigned"}
                      </td>
                      <td>
                        <label className="service-mise-check-label">
                          <input
                            type="checkbox"
                            disabled={!staffAssigned}
                            checked={isVerified}
                            onChange={() => toggle(task)}
                          />
                          <span className={`service-mise-check-custom ${isVerified ? "checked" : ""} ${!staffAssigned ? "disabled" : ""}`} />
                        </label>
                      </td>
                      <td className="service-mise-time">{entry?.time || "—"}</td>
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