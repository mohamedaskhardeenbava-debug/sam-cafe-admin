/**
 * ServiceMise.js  —  Sam Cafe Admin Panel
 * Service mise-en-place tracking page
 */

import React, { useState, useMemo } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import { getTodayKey, getTodayFormatted } from "../../App";
import { EmptyRow } from "../../App";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import Button3D from "../../components/Button3D";
import CollapseChevron from "../../components/CollapseChevron";
import CollapseSection from "../../components/CollapseSection";
import { MultiPillGroup } from "../../components/FilterBar";
import { fmtTime as sharedFmtTime } from "../../utils/dateUtils";

import "./ServiceMise.css";

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
  mise: { label: "Mise en Place", color: "#8b5cf6", icon: "" },
  cleaning: { label: "Cleaning", color: "#f59e0b", icon: "" },
};

export default function ServiceMise({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const today = getTodayKey();
  const todayFmt = getTodayFormatted();
  const tasks = adminData.tasks?.service || {};

  const [miseSearch, setMiseSearch] = useState("");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [sectionFilters, setSectionFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const miseDay = adminData.serviceMise?.[today] || {};

  const filteredTasks = useMemo(() => {
    const q = miseSearch.toLowerCase();
    const result = {};
    Object.entries(tasks).forEach(([sec, items]) => {
      if (sectionFilters.size > 0 && !sectionFilters.has(sec)) return;
      const filtered = (items || []).filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, miseSearch, sectionFilters]);

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
    exportToExcel({ rows, sheetName: "Service Mise", fileName: `service_mise_${today}.xlsx` });
  };

  // ── Toggle verified ───────────────────────────────────────────
  const toggle = async (task) => {
    const isChecked = miseDay[task]?.verified;
    const prevData = adminData.serviceMise;
    const updated = {
      ...adminData.serviceMise,
      [today]: {
        ...miseDay,
        [task]: {
          ...miseDay[task],
          verified: !isChecked,
          time: !isChecked ? sharedFmtTime(`${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`) : ""
        }
      }
    };
    setAdminData(prev => ({ ...prev, serviceMise: updated }));
    try {
      await api.put("/serviceMise", updated);
    } catch (err) {
      toast.error("Failed to save. Please try again.");
      setAdminData(prev => ({ ...prev, serviceMise: prevData }));
    }
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
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
              <h2 className="title">Service Mise en Place & Cleaning</h2>
              <span className="result-count">{allTasks.length} task(s)</span>
            </div>
            <span className="subtitle">{todayFmt}</span>
          </div>
        </div>
        <div className="header-btn-container">
          <div className="service-mise-stat-badge service-mise-stat-assigned">
            <span className="service-mise-stat-num">{assignedCnt}/{allTasks.length}</span>
            <span className="service-mise-stat-lbl">Assigned</span>
          </div>
          <div className="service-mise-stat-badge service-mise-stat-verified">
            <span className="service-mise-stat-num">{verifiedCnt}/{allTasks.length}</span>
            <span className="service-mise-stat-lbl">Verified</span>
          </div>
          <Button3D onClick={exportMise}>Export</Button3D>
        </div>
      </div>

      <CollapseSection collapsed={headerCollapsed}>
        <>
          {/* PROGRESS BAR */}
          <div className="service-mise-progress-wrap">
            <div
              className="service-mise-progress-bar"
              style={{ width: allTasks.length ? `${Math.round((verifiedCnt / allTasks.length) * 100)}%` : "0%" }}
            />
          </div>

          {/* FILTER BAR */}
          <div className="filter-bar">
            <div className="filter-group">
              <input
                className="search-input"
                placeholder=" Search tasks…"
                value={miseSearch}
                onChange={e => setMiseSearch(allowTextInput(miseSearch, e.target.value, 100, 5))}
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
        </>
      </CollapseSection>

      {/* UNIFIED TABLE */}
      <div className="table-wrapper" >
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
            {Object.keys(filteredTasks).length === 0 ? (
              <EmptyRow colSpan={4} message="No tasks available" />
            ) : (
              Object.entries(filteredTasks).map(([sec, items]) => (
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
            ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}