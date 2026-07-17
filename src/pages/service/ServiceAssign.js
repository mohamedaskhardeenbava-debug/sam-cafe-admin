/**
 * ServiceAssign.js  —  Sam Cafe Admin Panel
 * Service duty assignment page
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import { getTomorrowKey, getTomorrowFormatted } from "../../App";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import deleteIcon from "../../icon/delete-icon.png";
import closeIcon from "../../icon/close-icon.png";
import Button3D from "../../components/Button3D";
import CustomDropdown from "../../components/CustomDropdown";
import { MultiPillGroup } from "../../components/FilterBar";

import "./ServiceAssign.css";
import PageLoader from "../../components/PageLoader";

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
  mise: { label: "Mise en Place", color: "#8b5cf6", icon: "" },
  cleaning: { label: "Cleaning", color: "#f59e0b", icon: "" },
};

/* ─── PORTAL STAFF DROPDOWN ─────────────────────────────────────
   Renders the dropdown-menu via document.body so it escapes
   .table-wrapper's overflow:auto and .table td's overflow:hidden
   clipping. Position is computed with getBoundingClientRect.
──────────────────────────────────────────────────────────────── */
function StaffDropdown({ task, entry, adminData, handleChange, dropKey, openStaffDropdown, setOpenStaffDropdown, placeholder = "— Select —" }) {
  const btnRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const isOpen = openStaffDropdown === dropKey;

  const updatePosition = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  };

  // Close on any scroll (so the menu never floats over headers/filter bar).
  // Reposition on resize so it stays aligned if the layout shifts.
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setOpenStaffDropdown(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  const handleOpen = (e) => {
    e.stopPropagation();
    updatePosition();
    setOpenStaffDropdown(p => p === dropKey ? null : dropKey);
  };

  return (
    <div className="dishes-dropdown-wrapper" style={{ height: "32px" }}>
      <button
        ref={btnRef}
        type="button"
        className="dishes-status-dropdown"
        style={{ height: "32px", paddingTop: "0px", paddingLeft: "10px" }}
        onClick={handleOpen}
      >
        {entry?.staff || placeholder}
      </button>

      {openStaffDropdown === dropKey && createPortal(
        <div className="dishes-dropdown-menu" style={menuStyle}>
          <div onClick={e => { e.stopPropagation(); handleChange(task, ""); setOpenStaffDropdown(null); }}>
            {placeholder}
          </div>
          {adminData.staff.map(s => (
            <div
              key={s.id}
              className={entry?.staff === s.name ? "dropdown-item-active" : ""}
              onClick={e => { e.stopPropagation(); handleChange(task, s.name); setOpenStaffDropdown(null); }}
            >
              {s.name}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function ServiceAssign({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
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
  const [sectionFilters, setSectionFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const [listView, setListView] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const assignedDay = adminData.serviceAssign?.[tomorrow] || {};

  const filteredTasks = useMemo(() => {
    const q = assignSearch.toLowerCase();
    const result = {};
    Object.entries(tasks).forEach(([sec, items]) => {
      if (sectionFilters.size > 0 && !sectionFilters.has(sec)) return;
      const filtered = (items || []).filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, assignSearch, sectionFilters]);
  if (!adminData?.staff?.length) return <PageLoader label="Loading assignments…" />;

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
    if (!rows.length) { toast.warning("No assignment data to export"); return; }
    exportToExcel({ rows, sheetName: "Service Assign", fileName: `service_assign_${tomorrow}.xlsx` });
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
      toast.success("Task added");
    } catch (err) {
      toast.error("Failed to add task. Please try again.");
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
      toast.error("Failed to delete task. Please try again.");
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
      toast.error("Failed to save assignment. Please try again.");
    }
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
        <div>
          <div className="header-title-row">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              title={headerCollapsed ? "Expand header" : "Collapse header"}
              aria-expanded={!headerCollapsed}
            >
              <span className={`header-collapse-arrow${headerCollapsed ? " rotated" : ""}`}>▾</span>
            </button>
            <h2 className="title">Service Staff Assigning</h2>
          </div>
          <span className="subtitle">{tomorrowFmt}</span>
        </div>
        <div className="header-btn-container">
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
          <Button3D onClick={exportAssign}>Export</Button3D>
          <Button3D onClick={() => setShowTaskModal(true)}>+ Task</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search tasks…"
              value={assignSearch}
              onChange={e => setAssignSearch(allowTextInput(assignSearch, e.target.value, 100, 5))}
            />
            <MultiPillGroup
              options={Object.keys(tasks).map(s => [s, SECTION_META[s]?.label || s])}
              value={sectionFilters}
              onToggle={(key) => toggleSet(setSectionFilters, key)}
              label="Section"
            />
            {(assignSearch || sectionFilters.size > 0) && (
              <button className="ae-clear-filter"
                onClick={() => { setAssignSearch(""); setSectionFilters(new Set()); }}>Clear</button>
            )}
          </div>
        </div>
      )}

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
          headerCollapsed={headerCollapsed}
        />
      }

      {/* ADD TASK MODAL */}
      {showTaskModal && (
        <div className="modal-overlay">
          <form className="admin-modal" onSubmit={e => {
            e.preventDefault(); handleAddTask();
          }}>
            <div className="admin-modal-header">
              <h3>Add Task</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { setShowTaskModal(false); setNewTask(""); setTaskErrors({}); }}><img src={closeIcon} /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${taskErrors.newTask ? " mat-error" : ""}`}
                    placeholder=" "
                    value={newTask}
                    onChange={e => { setNewTask(allowTextInput(newTask, e.target.value, 100, 5)); setTaskErrors(p => ({ ...p, newTask: false })); }}
                  />
                  <label className={`mat-label${taskErrors.newTask ? " mat-label-error" : ""}`}>Task Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${taskErrors.newTask ? " mat-bar-error" : ""}`} />
                </div>
              </div>
              <div className={`admin-form-group${taskErrors.section ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  value={section}
                  onChange={val => { if (val) { setSection(val); setTaskErrors(p => ({ ...p, section: false })); } }}
                  options={Object.entries(SECTION_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
                  placeholder="Select Section"
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { setShowTaskModal(false); setNewTask(""); setTaskErrors({}); }}>Cancel</Button3D>
              <Button3D type="submit">Add Task</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── TABLE ─────────────────────────────────────────────────── */
function STableLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete, headerCollapsed }) {
  const [openStaffDropdown, setOpenStaffDropdown] = useState(null);

  useEffect(() => {
    const close = () => setOpenStaffDropdown(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  return (
    <div className="table-wrapper" style={{ maxHeight: headerCollapsed ? "calc(100vh - 160px)" : "calc(100vh - 260px)" }} >
      <table >
        <thead>
          <tr>
            <th>Task</th>
            <th>Staff</th>
            <th>Assigned At</th>
            <th className="icon-width">Delete</th>
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
                  <tr key={task} className={isAssigned ? "assign-row-assigned" : ""}>
                    <td>
                      <span className={`assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </td>
                    <td>
                      <StaffDropdown
                        task={task}
                        entry={entry}
                        adminData={adminData}
                        handleChange={handleChange}
                        dropKey={dropKey}
                        openStaffDropdown={openStaffDropdown}
                        setOpenStaffDropdown={setOpenStaffDropdown}
                        placeholder="— Select —"
                      />
                    </td>
                    <td className="service-assign-time">{entry?.assignedAt || "—"}</td>
                    <td className="icon-width">
                      <Button3D variant="cancel" iconOnly role="button"
                        onClick={() => handleDelete(task, sec)}><img src={deleteIcon} alt="" /></Button3D>
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
                    <Button3D variant="cancel" iconOnly role="button"
                      onClick={() => handleDelete(task, sec)}><img src={deleteIcon} alt="" /></Button3D>
                  </div>
                  <div className="assign-list-card-bot">
                    <StaffDropdown
                      task={task}
                      entry={entry}
                      adminData={adminData}
                      handleChange={handleChange}
                      dropKey={dropKey}
                      openStaffDropdown={openStaffDropdown}
                      setOpenStaffDropdown={setOpenStaffDropdown}
                      placeholder="— Select Staff —"
                    />
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