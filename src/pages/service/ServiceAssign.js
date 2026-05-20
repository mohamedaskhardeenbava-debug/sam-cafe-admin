import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./ServiceAssign.css";
import { getTomorrowKey, getTomorrowFormatted } from "../../App";
import api from "../../api";
import deleteIcon from "../../icon/delete-icon.png";

/*
  DATA SHAPE (serviceAssign in db.json):
  {
    "2026-05-20": {
      "Table Setup":  { "staff": "Vijay", "assignedAt": "8:00:00 AM" },
      "Floor":        { "staff": "Siva",  "assignedAt": "8:05:00 AM" },
      ...
    }
  }

  TASKS (tasks[0].service):
  { mise: [...], cleaning: [...] }
*/

const SECTION_META = {
  mise: { label: "Mise en Place", color: "#8b5cf6", icon: "🍽️" },
  cleaning: { label: "Cleaning", color: "#f59e0b", icon: "✨" },
};

export default function ServiceAssign({ adminData, setAdminData }) {
  const tasks = adminData.tasks?.service || {};
  const tomorrow = getTomorrowKey();
  const tomorrowFmt = getTomorrowFormatted();

  const [newTask, setNewTask] = useState("");
  const [section, setSection] = useState("mise");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [listView, setListView] = useState(false);

  const assignedDay = adminData.serviceAssign?.[tomorrow] || {};

  const filteredTasks = useMemo(() => {
    const q = assignSearch.toLowerCase();
    const result = {};
    Object.entries(tasks).forEach(([sec, items]) => {
      if (sectionFilter !== "all" && sec !== sectionFilter) return;
      const filtered = (items || []).filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, assignSearch, sectionFilter]);

  const assignedCount = Object.values(assignedDay).filter(v => v?.staff).length;
  const totalTasks = Object.values(tasks).flat().length;

  // ── Export ────────────────────────────────────────────────────
  const exportAssign = () => {
    const rows = [];
    Object.entries(filteredTasks).forEach(([sec, items]) => {
      items.forEach(task => {
        rows.push({
          Section: SECTION_META[sec]?.label || sec,
          Task: task,
          Staff: assignedDay[task]?.staff || "—",
          AssignedAt: assignedDay[task]?.assignedAt || "—",
        });
      });
    });
    if (!rows.length) { alert("No assignment data to export"); return; }
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Service Assign");
    XLSX.writeFile(wb, `service_assign_${tomorrow}.xlsx`);
  };

  // ── Add task ──────────────────────────────────────────────────
  const handleAddTask = async () => {
    const cleanTask = newTask.trim();
    if (!cleanTask) return;
    const existing = tasks[section] || [];
    if (existing.includes(cleanTask)) return;

    const updated = {
      ...adminData.tasks,
      service: { ...tasks, [section]: [...existing, cleanTask] }
    };
    try {
      await api.put("/tasks/1", updated);
      setAdminData(prev => ({ ...prev, tasks: updated }));
      setNewTask("");
    } catch (err) {
      console.error("ADD TASK FAILED:", err.response?.data || err.message);
    }
  };

  // ── Delete task ───────────────────────────────────────────────
  const handleDelete = async (task, sec) => {
    const updated = {
      ...adminData.tasks,
      service: {
        ...tasks,
        [sec]: (tasks[sec] || []).filter(t => t && t.trim() !== "" && t !== task)
      }
    };
    try {
      await api.put("/tasks/1", updated);
      setAdminData(prev => ({ ...prev, tasks: updated }));
    } catch (err) {
      console.error("DELETE TASK FAILED:", err.response?.data || err.message);
    }
  };

  // ── Assign staff ──────────────────────────────────────────────
  const handleChange = async (task, staffName) => {
    const updatedAssign = {
      ...adminData.serviceAssign,
      [tomorrow]: {
        ...assignedDay,
        [task]: {
          staff: staffName,
          assignedAt: new Date().toLocaleTimeString()
        }
      }
    };
    // Mirror into serviceMise
    const updatedMise = {
      ...adminData.serviceMise,
      [tomorrow]: {
        ...adminData.serviceMise?.[tomorrow],
        [task]: {
          ...adminData.serviceMise?.[tomorrow]?.[task],
          staff: staffName
        }
      }
    };
    try {
      await api.put("/serviceAssign", updatedAssign);
      await api.put("/serviceMise", updatedMise);
      setAdminData(prev => ({
        ...prev,
        serviceAssign: updatedAssign,
        serviceMise: updatedMise
      }));
    } catch (err) {
      console.error("SAVE FAILED:", err.response?.data || err.message);
    }
  };

  return (
    <div className="service-assign-page">

      {/* HEADER */}
      <div className="service-assign-header">
        <div className="service-assign-header-left">
          <h2 className="service-assign-title">Service Staff Assigning</h2>
          <span className="service-assign-date">{tomorrowFmt}</span>
        </div>
        <div className="service-assign-header-right">
          <div className="service-assign-progress-badge">
            <span className="service-assign-progress-num">{assignedCount}/{totalTasks}</span>
            <span className="service-assign-progress-lbl">Assigned</span>
          </div>
          <button className="service-assign-view-toggle" onClick={() => setListView(v => !v)}
            title={listView ? "Table view" : "List view"}>
            {listView ? "⊞ Table" : "≡ List"}
          </button>
          <button className="orders-export-btn" onClick={exportAssign}>Export</button>
          <button className="task-add-btn" onClick={() => setShowTaskModal(true)}>+ Task</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="service-assign-filter-bar">
        <input
          className="service-assign-search"
          placeholder="🔍 Search tasks…"
          value={assignSearch}
          onChange={e => setAssignSearch(e.target.value)}
        />
        <div className="service-assign-pills">
          <span className="service-assign-filter-lbl">Section</span>
          {[["all", "All"], ...Object.keys(tasks).map(s => [s, SECTION_META[s]?.label || s])].map(([k, lbl]) => (
            <button key={k}
              className={`sched-pill-btn${sectionFilter === k ? " active" : ""}`}
              onClick={() => setSectionFilter(k)}>{lbl}</button>
          ))}
        </div>
        {(assignSearch || sectionFilter !== "all") && (
          <button className="ae-clear-filter"
            onClick={() => { setAssignSearch(""); setSectionFilter("all"); }}>Clear</button>
        )}
      </div>

      {/* CONTENT */}
      {listView
        ? <SListLayout
          filteredTasks={filteredTasks}
          assignedDay={assignedDay}
          adminData={adminData}
          handleChange={handleChange}
          handleDelete={handleDelete}
        />
        : <STableLayout
          filteredTasks={filteredTasks}
          assignedDay={assignedDay}
          adminData={adminData}
          handleChange={handleChange}
          handleDelete={handleDelete}
        />
      }

      {/* ADD TASK MODAL */}
      {showTaskModal && (
        <div className="category-modal-overlay">
          <form className="category-modal" onSubmit={e => {
            e.preventDefault(); handleAddTask(); setShowTaskModal(false);
          }}>
            <div className="category-modal-header">
              <h3>Add Task</h3>
              <button type="button" className="dish-close-btn" onClick={() => setShowTaskModal(false)} />
            </div>
            <div className="category-modal-body">
              <div className="form-group">
                <label>Task Name</label>
                <input required value={newTask} onChange={e => setNewTask(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Section</label>
                <div className="dishes-dropdown-wrapper">
                  <button type="button" className="dishes-status-dropdown"
                    onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "sec" ? null : "sec"); }}>
                    {SECTION_META[section]?.label || section}
                  </button>
                  {openDropdown === "sec" && (
                    <div className="dishes-dropdown-menu">
                      {Object.entries(SECTION_META).map(([k, v]) => (
                        <div key={k} onClick={e => { e.stopPropagation(); setSection(k); setOpenDropdown(null); }}>
                          {v.icon} {v.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="category-modal-footer">
              <div className="form-actions">
                <button type="submit">Add Task</button>
                <button type="button" onClick={() => setShowTaskModal(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── TABLE ─────────────────────────────────────────────────── */
function STableLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete }) {
  return (
    <div className="service-assign-table-wrapper">
      <table className="service-assign-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Staff</th>
            <th>Assigned At</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(filteredTasks).map(([sec, items]) => (
            <React.Fragment key={sec}>
              <tr className="service-assign-section-row">
                <td colSpan="4">
                  <span className="service-assign-section-icon">{SECTION_META[sec]?.icon}</span>
                  {SECTION_META[sec]?.label || sec.toUpperCase()}
                </td>
              </tr>
              {items.map(task => {
                const entry = assignedDay[task];
                const isAssigned = !!entry?.staff;
                return (
                  <tr key={task} className={isAssigned ? "service-assign-row-assigned" : ""}>
                    <td>
                      <span className={`service-assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </td>
                    <td>
                      <select
                        className="service-assign-select"
                        value={entry?.staff ?? ""}
                        onChange={e => handleChange(task, e.target.value)}
                      >
                        <option value="">— Select —</option>
                        {adminData.staff.map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="service-assign-time">{entry?.assignedAt || "—"}</td>
                    <td>
                      <div role="button" className="service-assign-del-btn"
                        onClick={() => handleDelete(task, sec)}>
                        <img className="delete-icon" src={deleteIcon} alt="delete" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── LIST ──────────────────────────────────────────────────── */
function SListLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete }) {
  return (
    <div className="service-assign-list-container">
      {Object.entries(filteredTasks).map(([sec, items]) => (
        <div key={sec} className="service-assign-list-section">
          <div className="service-assign-list-section-hdr"
            style={{ borderLeftColor: SECTION_META[sec]?.color }}>
            <span>{SECTION_META[sec]?.icon}</span>
            <span>{SECTION_META[sec]?.label || sec.toUpperCase()}</span>
            <span className="service-assign-list-count">
              {items.filter(t => assignedDay[t]?.staff).length}/{items.length}
            </span>
          </div>
          <div className="service-assign-list-cards">
            {items.map(task => {
              const entry = assignedDay[task];
              const isAssigned = !!entry?.staff;
              return (
                <div key={task} className={`service-assign-list-card ${isAssigned ? "card-assigned" : ""}`}>
                  <div className="service-assign-list-card-top">
                    <div className="service-assign-list-task-name">
                      <span className={`service-assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </div>
                    <div role="button" className="service-assign-del-btn"
                      onClick={() => handleDelete(task, sec)}>
                      <img className="delete-icon" src={deleteIcon} alt="delete" />
                    </div>
                  </div>
                  <div className="service-assign-list-card-bot">
                    <select
                      className="service-assign-select service-assign-list-select"
                      value={entry?.staff ?? ""}
                      onChange={e => handleChange(task, e.target.value)}
                    >
                      <option value="">— Select Staff —</option>
                      {adminData.staff.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                    {entry?.assignedAt && (
                      <span className="service-assign-list-time">⏱ {entry.assignedAt}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}