/**
 * KitchenMise.js  —  Sam Cafe Admin Panel
 * Kitchen mise-en-place tracking page
 */

import React, { useState, useMemo } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import { getTodayKey, getTodayFormatted } from "../../App";
import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";
import { MultiPillGroup } from "../../components/FilterBar";

import "./KitchenMise.css";

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
  // ── Hooks

  const { toast } = useToast();
  const today = getTodayKey();
  const todayFmt = getTodayFormatted();
  const tasks = adminData.tasks?.kitchen || {};

  const [miseSearch, setMiseSearch] = useState("");
  const [sectionFilters, setSectionFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  // Use today's mise data; fall back to empty
  const miseDay = adminData.kitchenMise?.[today] || {};

  // ── Derived Values

  const filteredTasks = useMemo(() => {
    const q = miseSearch.toLowerCase();
    const result = {};
    Object.entries(tasks).forEach(([sec, items]) => {
      if (sectionFilters.size > 0 && !sectionFilters.has(sec)) return;

      // ── Helpers

      const filtered = (items || []).filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, miseSearch, sectionFilters]);

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
    if (!rows.length) { toast.warning("No mise data to export"); return; }
    exportToExcel({ rows, sheetName: "Kitchen Mise", fileName: `kitchen_mise_${today}.xlsx` });
  };

  // ── Toggle verified ───────────────────────────────────────────
  const toggle = async (task) => {
    const isChecked = miseDay[task]?.verified;
    const prevData = adminData.kitchenMise;
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
    setAdminData(prev => ({ ...prev, kitchenMise: updated }));
    try {
      await api.put("/kitchenMise", updated);
    } catch (err) {
      toast.error("Failed to save. Please try again.");
      setAdminData(prev => ({ ...prev, kitchenMise: prevData }));
    }
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
        <div >
          <h2 className="title">Kitchen Mise en Place & Cleaning</h2>
          <span className="subtitle">{todayFmt}</span>
        </div>
        <div className="header-btn-container">
          <div className="mise-stat-badge mise-stat-assigned">
            <span className="mise-stat-num">{assignedCnt}/{allTasks.length}</span>
            <span className="mise-stat-lbl">Assigned</span>
          </div>
          <div className="mise-stat-badge mise-stat-verified">
            <span className="mise-stat-num">{verifiedCnt}/{allTasks.length}</span>
            <span className="mise-stat-lbl">Verified</span>
          </div>
          <Button3D onClick={exportMise}>Export</Button3D>
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
      <div className="filter-bar">
        <div className="filter-groups">
          <input
            className="search-input"
            placeholder=" Search tasks…"
            value={miseSearch}
            onChange={e => setMiseSearch(e.target.value)}
          />
          <MultiPillGroup
            options={Object.keys(tasks).map(s => [s, SECTION_META[s]?.label || s])}
            value={sectionFilters}
            onToggle={(key) => toggleSet(setSectionFilters, key)}
            label="Section"
          />
          {(miseSearch || sectionFilters.size > 0) && (
            <button className="ae-clear-filter"
              onClick={() => { setMiseSearch(""); setSectionFilters(new Set()); }}>Clear</button>
          )}
        </div>
      </div>

      {/* UNIFIED TABLE */}
      <div className="table-wrapper" style={{ maxHeight: "calc(100vh - 265px)" }} >
        <table >
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
