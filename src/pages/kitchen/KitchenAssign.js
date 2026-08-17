/**
 * KitchenAssign.js  —  Sam Cafe Admin Panel
 * Kitchen duty assignment page
 */

import React, { useState, useMemo } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import { getTomorrowKey, getTomorrowFormatted } from "../../App";
import { EmptyRow } from "../../App";
import deleteIcon from "../../icon/delete-icon.png";
import closeIcon from "../../icon/close-icon.png";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import CollapseChevron from "../../components/CollapseChevron";
import CollapseSection from "../../components/CollapseSection";
import CustomDropdown from "../../components/CustomDropdown";
import { MultiPillGroup } from "../../components/FilterBar";
import { fmtTime as sharedFmtTime } from "../../utils/dateUtils";

import "./KitchenAssign.css";

// Current wall-clock time, formatted like every other time display in
// the app (Indian 12-hour "h:mm AM/PM").
const nowFmt = () => sharedFmtTime(`${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`);

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
  mise: { label: "Mise en Place", color: "#3b82f6", icon: "" },
  cleaning: { label: "Cleaning", color: "#10b981", icon: "" },
};

export default function KitchenAssign({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const tasks = adminData.tasks?.kitchen || {};   // { mise:[...], cleaning:[...] }
  const tomorrow = getTomorrowKey();
  const tomorrowFmt = getTomorrowFormatted();


  const [newTask, setNewTask] = useState("");
  const [section, setSection] = useState("mise");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const taskModal = useAnimatedModal("kitchenAssign-addTask");
  const [taskErrors, setTaskErrors] = useState({});
  const [assignSearch, setAssignSearch] = useState("");
  const [sectionFilters, setSectionFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const [listView, setListView] = useState(false); // toggle between table / list
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // ── Derived ──────────────────────────────────────────────────
  const assignedDay = adminData.kitchenAssign?.[tomorrow] || {};

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
    if (!rows.length) { toast.warning("No assignment data to export"); return; }
    exportToExcel({ rows, sheetName: "Kitchen Assign", fileName: `kitchen_assign_${tomorrow}.xlsx` });
  };

  // ── Add task ─────────────────────────────────────────────────
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
      kitchen: { ...tasks, [section]: [...existing, cleanTask] }
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
      kitchen: {
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

  // ── Assign staff ─────────────────────────────────────────────
  const handleChange = async (task, staffName) => {
    const updatedAssign = {
      ...adminData.kitchenAssign,
      [tomorrow]: {
        ...assignedDay,
        [task]: {
          staff: staffName,
          assignedAt: nowFmt()
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
      toast.error("Failed to save assignment. Please try again.");
    }
  };

  // ── Render ───────────────────────────────────────────────────
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
              <h2 className="title">Kitchen Staff Assigning</h2>
              <span className="result-count">{assignedCount}/{totalTasks} assigned</span>
            </div>
            <span className="subtitle">{tomorrowFmt}</span>
          </div>
        </div>
        <div className="header-btn-container">
          <div className="assign-progress-badge">
            <span className="assign-progress-num">{assignedCount}/{totalTasks}</span>
            <span className="assign-progress-lbl">Assigned</span>
          </div>
          <button
            className="modal-confirm-btn"
            onClick={() => setListView(v => !v)}
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            data-bs-title={listView ? "Table view" : "List view"}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">
              {listView ? "⊞ Table" : "≡ List"}
            </span>
          </button>
          <Button3D onClick={exportAssign}>Export</Button3D>
          <Button3D onClick={() => { setShowTaskModal(true); taskModal.open(); }}>+ Task</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
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
      </CollapseSection>

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
          headerCollapsed={headerCollapsed}
        />
      }

      {/* ADD TASK MODAL */}
      {taskModal.shouldRender && (
        <div className={`modal-overlay ${taskModal.overlayClass}`}>
          <form className={`admin-modal ${taskModal.modalClass}`} onSubmit={e => {
            e.preventDefault(); handleAddTask().then(() => { if (!taskErrors.newTask && !taskErrors.section) taskModal.close(() => setShowTaskModal(false)); });
          }}>
            <div className="admin-modal-header">
              <h3>Add Task</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { taskModal.close(() => setShowTaskModal(false)); setNewTask(""); setTaskErrors({}); }}><img src={closeIcon} /></Button3D>
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
                  onChange={(val) => { if (val) { setSection(val); setTaskErrors(p => ({ ...p, section: false })); } }}
                  options={Object.entries(SECTION_META).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))}
                  placeholder="Select Section"
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { taskModal.close(() => setShowTaskModal(false)); setNewTask(""); setTaskErrors({}); }}>Cancel</Button3D>
              <Button3D type="submit">Add Task</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ─── TABLE LAYOUT ──────────────────────────────────────────── */
function TableLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete, headerCollapsed }) {
  return (
    <div className="table-wrapper" >
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
          {Object.keys(filteredTasks).length === 0 ? (
            <EmptyRow colSpan={4} message="No tasks available" />
          ) : (
            Object.entries(filteredTasks).map(([sec, items]) => (
            <React.Fragment key={sec}>
              <tr className="assign-section-row">
                <td colSpan="4" style={{ fontSize: "12px" }}>
                  <span className="assign-section-icon">{SECTION_META[sec]?.icon}</span>
                  {SECTION_META[sec]?.label || sec.toUpperCase()}
                </td>
              </tr>
              {items.map(task => {
                const entry = assignedDay[task];
                const isAssigned = !!entry?.staff;
                return (
                  <tr key={task} className={isAssigned ? "assign-row-assigned" : ""}>
                    <td>
                      <span className={`assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </td>
                    <td>
                      <CustomDropdown
                        value={entry?.staff || ""}
                        onChange={(val) => handleChange(task, val)}
                        options={adminData.staff.map((s) => ({ value: s.name, label: s.name }))}
                        placeholder="— Select Staff —"
                      />
                    </td>
                    <td className="assign-time">{entry?.assignedAt || "—"}</td>
                    <td className="icon-width">
                      <Button3D variant="cancel" iconOnly role="button"
                        onClick={() => handleDelete(task, sec)}><img src={deleteIcon} alt="" /></Button3D>
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── LIST LAYOUT ───────────────────────────────────────────── */
function ListLayout({ filteredTasks, assignedDay, adminData, handleChange, handleDelete }) {
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
              return (
                <div key={task} className={`assign-list-card ${isAssigned ? "card-assigned" : ""}`}>
                  <div className="assign-list-card-top">
                    <div className="assign-list-task-name">
                      <span className={`assign-task-dot ${isAssigned ? "dot-filled" : ""}`} />
                      {task}
                    </div>
                    <Button3D variant="cancel" iconOnly role="button"
                      onClick={() => handleDelete(task, sec)}><img src={deleteIcon} alt="" /></Button3D>
                  </div>
                  <div className="assign-list-card-bot">
                    <CustomDropdown
                      value={entry?.staff || ""}
                      onChange={(val) => handleChange(task, val)}
                      options={adminData.staff.map((s) => ({ value: s.name, label: s.name }))}
                      placeholder="— Select Staff —"
                    />
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