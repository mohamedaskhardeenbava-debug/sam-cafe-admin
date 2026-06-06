import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import "./ServiceAssign.css";
import { getTomorrowKey, getTomorrowFormatted } from "../../App";
import api from "../../api";
import deleteIcon from "../../icon/delete-icon.png";
import closeIcon from "../../icon/close-icon.png";

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

// ── Floating-label CustomDropdown ────────────────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…", label, required }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
  const displayLabel = selected ? (selected.label !== undefined ? selected.label : selected) : "";
  const wrapperClass = ["mat-select", value ? "has-value" : "", open ? "is-open" : ""].filter(Boolean).join(" ");
  return (
    <div className={wrapperClass} ref={ref}>
      {label && <label className="mat-label">{label}{required && <span className="rf-req">*</span>}</label>}
      <div className="dishes-dropdown-wrapper">
        <button type="button" className="dishes-status-dropdown"
          onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
          {displayLabel || ""}
        </button>
        {open && (
          <div className="dropdown-menu">
            {options.map((o, i) => {
              const val = o.value !== undefined ? o.value : o;
              const lbl = o.label !== undefined ? o.label : o;
              return (
                <div key={i} onClick={() => { onChange(val); setOpen(false); }}>
                  {lbl}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <span className="mat-bar" />
    </div>
  );
}

const SECTION_META = {
  mise: { label: "Mise en Place", color: "#8b5cf6", icon: "" },
  cleaning: { label: "Cleaning", color: "#f59e0b", icon: "" },
};

export default function ServiceAssign({ adminData, setAdminData }) {
  const tasks = adminData.tasks?.service || {};
  const tomorrow = getTomorrowKey();
  const tomorrowFmt = getTomorrowFormatted();

  const [newTask, setNewTask] = useState("");
  const [section, setSection] = useState("mise");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskErrors, setTaskErrors] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);

  // Close section dropdown on outside click
  useEffect(() => {
    const closeDropdowns = () => setOpenDropdown(null);
    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

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
    const errs = {};
    const cleanTask = newTask.trim();
    if (!cleanTask) errs.newTask = true;
    if (!section) errs.section = true;
    if (Object.keys(errs).length) { setTaskErrors(errs); return; }
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
      setTaskErrors({});
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
          <button
            className="modal-confirm-btn"
            onClick={() => setListView(v => !v)}
            title={listView ? "Table view" : "List view"}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">
              {listView ? "⊞ Table" : "≡ List"}
            </span>
          </button>
          <button
            className="modal-save-btn"
            onClick={exportAssign}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Export</span>
          </button>
          <button
            className="modal-save-btn"
            onClick={() => setShowTaskModal(true)}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">+ Task</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="service-assign-filter-bar">
        <input
          className="search-input"
          placeholder=" Search tasks…"
          value={assignSearch}
          onChange={e => setAssignSearch(e.target.value)}
        />
        <div className="service-assign-pills">
          <span className="service-assign-filter-lbl">Section</span>
          {[["all", "All"], ...Object.keys(tasks).map(s => [s, SECTION_META[s]?.label || s])].map(([k, lbl]) => (
            <button key={k}
              className={`filter-pill${sectionFilter === k ? " active" : ""}`}
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
        <div className="modal-overlay">
          <form className="modal" onSubmit={e => {
            e.preventDefault(); handleAddTask();
          }}>
            <div className="modal-header">
              <h3>Add Task</h3>
              <button type="button" className="modal-cancel-btn" onClick={() => { setShowTaskModal(false); setNewTask(""); setTaskErrors({}); }} >
                <span class="shadow"></span>
                <span class="edge"></span>
                <span class="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <div className="mat">
                  <input
                    className={`mat-input${taskErrors.newTask ? " mat-error" : ""}`}
                    placeholder=" "
                    value={newTask}
                    onChange={e => { setNewTask(e.target.value); setTaskErrors(p => ({ ...p, newTask: false })); }}
                  />
                  <label className={`mat-label${taskErrors.newTask ? " mat-label-error" : ""}`}>Task Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${taskErrors.newTask ? " mat-bar-error" : ""}`} />
                </div>
              </div>
              <div className={`form-group${taskErrors.section ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Section"
                  value={section}
                  onChange={val => { if (val) { setSection(val); setTaskErrors(p => ({ ...p, section: false })); } }}
                  options={Object.entries(SECTION_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
                  placeholder="Select Section"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => { setShowTaskModal(false); setNewTask(""); setTaskErrors({}); }}>
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Cancel</span>
              </button>
              <button
                type="submit"
                className="modal-save-btn">
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Add Task</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── TABLE ─────────────────────────────────────────────────── */
function STableLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete }) {
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);

  useEffect(() => {
    const close = () => setOpenStaffDropdown(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
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
                const dropKey = `table_${task}`;
                return (
                  <tr key={task} className={isAssigned ? "service-assign-row-assigned" : ""}>
                    <td>
                      <span className={`service-assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
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
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);

  useEffect(() => {
    const close = () => setOpenStaffDropdown(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
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
              const dropKey = `list_${task}`;
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
                    <span className="service-assign-list-time">⏱ {entry.assignedAt}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}