import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import "./KitchenAssign.css";
import { getTomorrowKey, getTomorrowFormatted } from "../../App";
import api from "../../api";
import deleteIcon from "../../icon/delete-icon.png";

/*
  DATA SHAPE (kitchenAssign in db.json):
  {
    "2026-05-20": {
      "Arrangement": { "staff": "Thamu", "assignedAt": "8:00:00 AM" },
      "Floor":       { "staff": "Arun",  "assignedAt": "8:05:00 AM" },
      ...
    }
  }

  TASKS (tasks[0].kitchen):
  { mise: [...], cleaning: [...] }
*/

const SECTION_META = {
  mise: { label: "Mise en Place", color: "#3b82f6", icon: "🍳" },
  cleaning: { label: "Cleaning", color: "#10b981", icon: "🧹" },
};

export default function KitchenAssign({ adminData, setAdminData }) {
  const tasks = adminData.tasks?.kitchen || {};   // { mise:[...], cleaning:[...] }
  const tomorrow = getTomorrowKey();
  const tomorrowFmt = getTomorrowFormatted();

  const [newTask, setNewTask] = useState("");
  const [section, setSection] = useState("mise");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  // Close section dropdown on outside click
  useEffect(() => {
    const closeDropdowns = () => setOpenDropdown(null);
    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  const [assignSearch, setAssignSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [listView, setListView] = useState(false); // toggle between table / list

  // ── Derived ──────────────────────────────────────────────────
  const assignedDay = adminData.kitchenAssign?.[tomorrow] || {};

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

  // ── Export ───────────────────────────────────────────────────
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
    XLSX.utils.book_append_sheet(wb, sheet, "Kitchen Assign");
    XLSX.writeFile(wb, `kitchen_assign_${tomorrow}.xlsx`);
  };

  // ── Add task ─────────────────────────────────────────────────
  const handleAddTask = async () => {
    const cleanTask = newTask.trim();
    if (!cleanTask) return;
    const existing = tasks[section] || [];
    if (existing.includes(cleanTask)) return;

    const updated = {
      ...adminData.tasks,
      kitchen: { ...tasks, [section]: [...existing, cleanTask] }
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
      kitchen: {
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

  // ── Assign staff ─────────────────────────────────────────────
  const handleChange = async (task, staffName) => {
    const updatedAssign = {
      ...adminData.kitchenAssign,
      [tomorrow]: {
        ...assignedDay,
        [task]: {
          staff: staffName,
          assignedAt: new Date().toLocaleTimeString()
        }
      }
    };
    // Mirror staff into kitchenMise so today's verifier sees the assignment
    const updatedMise = {
      ...adminData.kitchenMise,
      [tomorrow]: {
        ...adminData.kitchenMise?.[tomorrow],
        [task]: {
          ...adminData.kitchenMise?.[tomorrow]?.[task],
          staff: staffName
        }
      }
    };
    try {
      await api.put("/kitchenAssign", updatedAssign);
      await api.put("/kitchenMise", updatedMise);
      setAdminData(prev => ({
        ...prev,
        kitchenAssign: updatedAssign,
        kitchenMise: updatedMise
      }));
    } catch (err) {
      console.error("SAVE FAILED:", err.response?.data || err.message);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="assign-page">

      {/* HEADER */}
      <div className="assign-header">
        <div className="assign-header-left">
          <h2 className="assign-title">Kitchen Staff Assigning</h2>
          <span className="assign-date">{tomorrowFmt}</span>
        </div>
        <div className="assign-header-right">
          <div className="assign-progress-badge">
            <span className="assign-progress-num">{assignedCount}/{totalTasks}</span>
            <span className="assign-progress-lbl">Assigned</span>
          </div>
          <button className="assign-view-toggle" onClick={() => setListView(v => !v)}
            title={listView ? "Table view" : "List view"}>
            {listView ? "⊞ Table" : "≡ List"}
          </button>
          <button className="export-btn" onClick={exportAssign}>Export</button>
          <button className="category-add-btn" onClick={() => setShowTaskModal(true)}>+ Task</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="assign-filter-bar">
        <input
          className="search-input"
          placeholder="🔍 Search tasks…"
          value={assignSearch}
          onChange={e => setAssignSearch(e.target.value)}
        />
        <div className="assign-pills">
          <span className="assign-filter-lbl">Section</span>
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

      {/* CONTENT — Table or List */}
      {listView
        ? <ListLayout
          filteredTasks={filteredTasks}
          assignedDay={assignedDay}
          adminData={adminData}
          handleChange={handleChange}
          handleDelete={handleDelete}
        />
        : <TableLayout
          filteredTasks={filteredTasks}
          assignedDay={assignedDay}
          adminData={adminData}
          handleChange={handleChange}
          handleDelete={handleDelete}
        />
      }

      {/* ADD TASK MODAL */}
      {showTaskModal && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={e => {
            e.preventDefault(); handleAddTask(); setShowTaskModal(false);
          }}>
            <div className="modal-header">
              <h3>Add Task</h3>
              <button type="button" className="close-btn" onClick={() => setShowTaskModal(false)} />
            </div>
            <div className="modal-body">
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
                    <div className="dropdown-menu">
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
            <div className="modal-footer">
              <button type="button" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button type="submit">Add Task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── TABLE LAYOUT ──────────────────────────────────────────── */
function TableLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete }) {
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);

  useEffect(() => {
    const close = () => setOpenStaffDropdown(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  return (
    <div className="assign-table-wrapper">
      <table className="assign-table">
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
              <tr className="assign-section-row">
                <td colSpan="4">
                  <span className="assign-section-icon">{SECTION_META[sec]?.icon}</span>
                  {SECTION_META[sec]?.label || sec.toUpperCase()}
                </td>
              </tr>
              {items.map(task => {
                const entry = assignedDay[task];
                const isAssigned = !!entry?.staff;
                const dropKey = `table_${task}`;
                return (
                  <tr key={task} className={isAssigned ? "assign-row-assigned" : ""}>
                    <td>
                      <span className={`assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </td>
                    <td>
                      <div className="dishes-dropdown-wrapper">
                        <button
                          type="button"
                          className="dishes-status-dropdown"
                          onClick={e => { e.stopPropagation(); setOpenStaffDropdown(p => p === dropKey ? null : dropKey); }}
                        >
                          {entry?.staff || "— Select —"}
                        </button>
                        {openStaffDropdown === dropKey && (
                          <div className="dropdown-menu">
                            <div onClick={e => { e.stopPropagation(); handleChange(task, ""); setOpenStaffDropdown(null); }}>
                              — Select —
                            </div>
                            {adminData.staff.map(s => (
                              <div key={s.id} onClick={e => { e.stopPropagation(); handleChange(task, s.name); setOpenStaffDropdown(null); }}>
                                {s.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="assign-time">{entry?.assignedAt || "—"}</td>
                    <td>
                      <div role="button" className="assign-del-btn"
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

/* ─── LIST LAYOUT ───────────────────────────────────────────── */
function ListLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete }) {
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);

  useEffect(() => {
    const close = () => setOpenStaffDropdown(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  return (
    <div className="assign-list-container">
      {Object.entries(filteredTasks).map(([sec, items]) => (
        <div key={sec} className="assign-list-section">
          <div className="assign-list-section-hdr"
            style={{ borderLeftColor: SECTION_META[sec]?.color }}>
            <span>{SECTION_META[sec]?.icon}</span>
            <span>{SECTION_META[sec]?.label || sec.toUpperCase()}</span>
            <span className="assign-list-count">{items.filter(t => assignedDay[t]?.staff).length}/{items.length}</span>
          </div>
          <div className="assign-list-cards">
            {items.map(task => {
              const entry = assignedDay[task];
              const isAssigned = !!entry?.staff;
              const dropKey = `list_${task}`;
              return (
                <div key={task} className={`assign-list-card ${isAssigned ? "card-assigned" : ""}`}>
                  <div className="assign-list-card-top">
                    <div className="assign-list-task-name">
                      <span className={`assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </div>
                    <div role="button" className="assign-del-btn"
                      onClick={() => handleDelete(task, sec)}>
                      <img className="delete-icon" src={deleteIcon} alt="delete" />
                    </div>
                  </div>
                  <div className="assign-list-card-bot">
                    <div className="dishes-dropdown-wrapper">
                      <button
                        type="button"
                        className="dishes-status-dropdown"
                        onClick={e => { e.stopPropagation(); setOpenStaffDropdown(p => p === dropKey ? null : dropKey); }}
                      >
                        {entry?.staff || "— Select Staff —"}
                      </button>
                      {openStaffDropdown === dropKey && (
                        <div className="dropdown-menu">
                          <div onClick={e => { e.stopPropagation(); handleChange(task, ""); setOpenStaffDropdown(null); }}>
                            — Select Staff —
                          </div>
                          {adminData.staff.map(s => (
                            <div key={s.id} onClick={e => { e.stopPropagation(); handleChange(task, s.name); setOpenStaffDropdown(null); }}>
                              {s.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry?.assignedAt && (
                      <span className="assign-list-time">⏱ {entry.assignedAt}</span>
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