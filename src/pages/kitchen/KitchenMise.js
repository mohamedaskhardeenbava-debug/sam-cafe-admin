import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./KitchenMise.css";
import { getTodayKey, getTodayFormatted, getTomorrowKey } from "../../App";
import api from "../../api";

export default function KitchenMise({ adminData, setAdminData }) {
  const todayFormatted = getTodayFormatted();
  const today = getTodayKey();
  const tomorrow = getTomorrowKey();

  const activeDate = adminData.mise?.[today] ? today : tomorrow;
  const tasks = adminData.tasks?.kitchen;

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
    const allRows = [];
    Object.entries(filteredTasks).forEach(([sec, items]) => {
      items.forEach(task => {
        const data = adminData.mise?.[activeDate]?.[task];
        allRows.push({
          Section: sec.toUpperCase(),
          Task: task,
          Staff: data?.staff || "—",
          Verified: data?.verified ? "✔ Yes" : "✖ No",
          Time: data?.time || "—",
        });
      });
    });
    if (!allRows.length) { alert("No mise data to export"); return; }
    const sheet = XLSX.utils.json_to_sheet(allRows);
    sheet["!cols"] = Object.keys(allRows[0]).map(k => ({ wch: Math.max(k.length, ...allRows.map(r => String(r[k] ?? "").length)) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Mise en Place");
    XLSX.writeFile(wb, `mise_${activeDate}.xlsx`);
  };

  const toggle = async (task) => {
    const isChecked = adminData.mise?.[activeDate]?.[task]?.verified;

    const updated = {
      ...adminData.mise,
      [activeDate]: {
        ...adminData.mise?.[activeDate],
        [task]: {
          ...adminData.mise?.[activeDate]?.[task],
          verified: !isChecked,
          time: !isChecked ? new Date().toLocaleTimeString() : ""
        }
      }
    };

    await api.put("/mise", updated);

    setAdminData(prev => ({
      ...prev,
      mise: updated
    }));
  };

  return (
    <div className="mise-page">
      <div className="mise-header">
        <h2 className="mise-title">Mise en Place & Cleaning</h2>
        <h2 className="mise-date">{todayFormatted}</h2>
        <button className="orders-export-btn" onClick={exportMise} style={{ marginLeft: "auto" }}>Export</button>
      </div>

      {/* FILTER BAR */}
      <div className="assign-filter-bar">
        <input
          className="assign-search"
          placeholder="🔍 Search tasks…"
          value={miseSearch}
          onChange={e => setMiseSearch(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="kgroom-filter-label">Section</span>
          {[["all", "All"], ...Object.keys(tasks || {}).map(s => [s, s.toUpperCase()])].map(([k, lbl]) => (
            <button key={k} className={`sched-pill-btn${miseSectionFilter === k ? " active" : ""}`}
              onClick={() => setMiseSectionFilter(k)}>{lbl}</button>
          ))}
        </div>
        {(miseSearch || miseSectionFilter !== "all") && (
          <button className="ae-clear-filter" onClick={() => { setMiseSearch(""); setMiseSectionFilter("all"); }}>Clear</button>
        )}
      </div>

      {Object.entries(filteredTasks).map(([section, items]) => (
        <div key={section}>
          <h3 className="service-mise-section-title">{section.toUpperCase()}</h3>

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
                {items.map(task => {
                  const staffAssigned = adminData.mise?.[activeDate]?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>
                      <td>{adminData.mise?.[activeDate]?.[task]?.staff || "-"}</td>

                      <td>
                        <input
                          className="mise-table-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}
                          checked={adminData.mise?.[activeDate]?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>{adminData.mise?.[activeDate]?.[task]?.time || "-"}</td>
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