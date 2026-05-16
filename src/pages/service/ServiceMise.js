import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./ServiceMise.css";
import { getTodayFormatted, getTodayKey, getTomorrowKey } from "../../App";
import api from "../../api";

export default function ServiceMise({ adminData, setAdminData }) {
  const todayFormatted = getTodayFormatted();
  const today = getTodayKey();
  const tomorrow = getTomorrowKey();

  const activeDate = adminData.serviceMise?.[today] ? today : tomorrow;
  const tasks = adminData.tasks?.service;

  const [miseSearch, setMiseSearch] = useState("");
  const [miseSectionFilter, setMiseSectionFilter] = useState("all");

  const filteredTasks = useMemo(() => {
    const q = miseSearch.toLowerCase();
    const result = {};
    Object.entries(tasks || {}).forEach(([sec, items]) => {
      if (miseSectionFilter !== "all" && sec !== miseSectionFilter) return;
      const filtered = items.filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, miseSearch, miseSectionFilter]);

  const exportMise = () => {
    const rows = [];
    Object.entries(filteredTasks).forEach(([sec, items]) => {
      items.forEach(task => {
        const data = adminData.serviceMise?.[activeDate]?.[task];
        rows.push({
          Section: sec.toUpperCase(),
          Task: task,
          Staff: data?.staff || "—",
          Verified: data?.verified ? "✔ Yes" : "✖ No",
          Time: data?.time || "—",
        });
      });
    });
    if (!rows.length) { alert("No mise data to export"); return; }
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Service Mise");
    XLSX.writeFile(wb, `service_mise_${activeDate}.xlsx`);
  };

  const toggle = async (task) => {
    const isChecked = adminData.serviceMise?.[activeDate]?.[task]?.verified;

    const updated = {
      ...adminData.serviceMise,
      [activeDate]: {
        ...adminData.serviceMise?.[activeDate],
        [task]: {
          ...adminData.serviceMise?.[activeDate]?.[task],
          verified: !isChecked,
          time: !isChecked ? new Date().toLocaleTimeString() : ""
        }
      }
    };

    try {
      await api.put("/serviceMise", updated);

      setAdminData(prev => ({
        ...prev,
        serviceMise: updated
      }));

    } catch (err) {
      console.error("SAVE FAILED:", err);
      // optimistic UI: still update locally even on error
      setAdminData(prev => ({
        ...prev,
        serviceMise: updated
      }));
    }
  };

  return (
    <div className="service-mise-main">

      {/* HEADER */}
      <div className="service-mise-header">
        <h2 className="service-mise-title">Service Mise en Place & Cleaning</h2>
        <h2 className="service-mise-date">{todayFormatted}</h2>
        <button className="orders-export-btn" onClick={exportMise} style={{ marginLeft: "auto" }}>Export</button>
      </div>

      {/* FILTER BAR */}
      <div className="service-filter-bar">
        <input
          className="service-filter-search"
          placeholder="🔍 Search tasks…"
          value={miseSearch}
          onChange={e => setMiseSearch(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="service-filter-label">Section</span>
          {[["all", "All"], ...Object.keys(tasks || {}).map(s => [s, s.toUpperCase()])].map(([k, lbl]) => (
            <button key={k} className={`sched-pill-btn${miseSectionFilter === k ? " active" : ""}`}
              onClick={() => setMiseSectionFilter(k)}>{lbl}</button>
          ))}
        </div>
        {(miseSearch || miseSectionFilter !== "all") && (
          <button className="ae-clear-filter" onClick={() => { setMiseSearch(""); setMiseSectionFilter("all"); }}>Clear</button>
        )}
      </div>

      {/* SECTIONS */}
      {Object.entries(filteredTasks).map(([section, items]) => (
        <div key={section} className="service-mise-section">

          <h3 className="service-mise-section-title">
            {section.toUpperCase()}
          </h3>

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
                {items.map(task => {
                  const staffAssigned = adminData.serviceMise?.[activeDate]?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>

                      <td>
                        {adminData.serviceMise?.[activeDate]?.[task]?.staff || "-"}
                      </td>

                      <td>
                        <input
                          className="service-mise-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}  // ✅ works now
                          checked={adminData.serviceMise?.[activeDate]?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>
                        {adminData.serviceMise?.[activeDate]?.[task]?.time || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        </div>
      ))}

    </div>
  );
}