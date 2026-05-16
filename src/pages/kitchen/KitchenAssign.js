import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./KitchenAssign.css";
import { getTodayKey, getTodayFormatted, getTomorrowKey, getTomorrowFormatted } from "../../App";
import api from "../../api";
import deleteIcon from "../../icon/delete-icon.png";

export default function KitchenAssign({ adminData, setAdminData }) {
  const tasks = adminData.tasks?.kitchen;
  const [newTask, setNewTask] = useState("");
  const [section, setSection] = useState("mise");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const tomorrow = getTomorrowKey();
  const tomorrowFormatted = getTomorrowFormatted();

  const filteredTasks = useMemo(() => {
    const q = assignSearch.toLowerCase();
    const result = {};
    Object.entries(tasks || {}).forEach(([sec, items]) => {
      if (sectionFilter !== "all" && sec !== sectionFilter) return;
      const filtered = items.filter(t => !q || t.toLowerCase().includes(q));
      if (filtered.length) result[sec] = filtered;
    });
    return result;
  }, [tasks, assignSearch, sectionFilter]);

  const exportAssign = () => {
    const allRows = [];
    Object.entries(filteredTasks).forEach(([sec, items]) => {
      items.forEach(task => {
        allRows.push({
          Section: sec.toUpperCase(),
          Task: task,
          Staff: adminData.mise?.[tomorrow]?.[task]?.staff || "—",
          Time: adminData.mise?.[tomorrow]?.[task]?.time || "—",
        });
      });
    });
    if (!allRows.length) { alert("No assignment data to export"); return; }
    const sheet = XLSX.utils.json_to_sheet(allRows);
    sheet["!cols"] = Object.keys(allRows[0]).map(k => ({ wch: Math.max(k.length, ...allRows.map(r => String(r[k] ?? "").length)) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Staff Assign");
    XLSX.writeFile(wb, `staff_assign_${tomorrowFormatted.replace(/\s/g, "_")}.xlsx`);
  };

  const handleAddTask = async () => {
    const cleanTask = newTask.trim();

    if (!cleanTask) return;

    const existing = adminData.tasks?.kitchen?.[section] || [];

    if (existing.includes(cleanTask)) return;

    const updated = {
      ...adminData.tasks,
      kitchen: {
        ...adminData.tasks.kitchen,
        [section]: [...existing, cleanTask]
      }
    };

    try {
      await api.put("/tasks/1", updated);

      setAdminData(prev => ({
        ...prev,
        tasks: updated
      }));

      setNewTask("");
    } catch (err) {
      console.error("ADD TASK FAILED:", err.response?.data || err.message);
    }
  };

  const handleDelete = async (task, section) => {
    const existing = adminData.tasks?.kitchen?.[section] || [];

    const updated = {
      ...adminData.tasks,
      kitchen: {
        ...adminData.tasks.kitchen,
        [section]: existing.filter(
          t => t && t.trim() !== "" && t !== task
        )
      }
    };

    try {
      await api.put("/tasks/1", updated);

      setAdminData(prev => ({
        ...prev,
        tasks: updated
      }));
    } catch (err) {
      console.error("DELETE TASK FAILED:", err.response?.data || err.message);
    }
  };

  const handleChange = async (task, staffName) => {
    const updated = {
      ...adminData.mise,
      [tomorrow]: {
        ...adminData.mise?.[tomorrow],
        [task]: {
          staff: staffName,
          time: new Date().toLocaleTimeString()
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
    <div className="assign-page">
      <div className="assign-header">
        <h2 className="assign-title">Staff Assigning</h2>
        <h2 className="assign-date">{tomorrowFormatted}</h2>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button className="orders-export-btn" onClick={exportAssign}>Export</button>
          <button onClick={() => setShowTaskModal(true)} className="task-add-btn">+ Add Task</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="assign-filter-bar">
        <input
          className="assign-search"
          placeholder="🔍 Search tasks…"
          value={assignSearch}
          onChange={e => setAssignSearch(e.target.value)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="kgroom-filter-label">Section</span>
          {[["all", "All"], ...Object.keys(tasks || {}).map(s => [s, s.toUpperCase()])].map(([k, lbl]) => (
            <button key={k} className={`sched-pill-btn${sectionFilter === k ? " active" : ""}`}
              onClick={() => setSectionFilter(k)}>{lbl}</button>
          ))}
        </div>
        {(assignSearch || sectionFilter !== "all") && (
          <button className="ae-clear-filter" onClick={() => { setAssignSearch(""); setSectionFilter("all"); }}>Clear</button>
        )}
      </div>

      <div className="assign-table-wrapper">
        <table className="assign-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Staff</th>
              <th>Time</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(filteredTasks).map(([sec, items]) => (
              <React.Fragment key={sec}>

                {/* ✅ Section Header */}
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      fontWeight: "bold",
                      background: "#f5f5f5"
                    }}
                  >
                    {section.toUpperCase()}
                  </td>
                </tr>

                {/* ✅ Task Rows */}
                {items.map(task => (
                  <tr key={task}>
                    <td>{task}</td>

                    <td>
                      <select
                        value={adminData.mise?.[tomorrow]?.[task]?.staff ?? ""}
                        onChange={(e) =>
                          handleChange(task, e.target.value)
                        }
                      >
                        <option value="">Select</option>
                        {adminData.staff.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      {adminData.mise?.[tomorrow]?.[task]?.time || "-"}
                    </td>

                    <td><div onClick={() => handleDelete(task, section)}><img className="delete-icon" src={deleteIcon} /></div></td>
                  </tr>
                ))}

              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {showTaskModal && (
        <div className="category-modal-overlay">
          <form
            className="category-modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTask();
              setShowTaskModal(false);
            }}
          >

            {/* HEADER */}
            <div className="category-modal-header">
              <h3>Add Task</h3>
              <button
                type="button"
                className="dish-close-btn"
                onClick={() => setShowTaskModal(false)}
              ></button>
            </div>

            {/* BODY */}
            <div className="category-modal-body">

              {/* TASK */}
              <div className="form-group">
                <label>Task Name</label>
                <input
                  required
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                />
              </div>

              {/* SECTION */}
              <div className="form-group">
                <label>Section</label>

                <div className="dishes-dropdown-wrapper">
                  <button
                    type="button"
                    className="dishes-status-dropdown"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(prev => prev === "section" ? null : "section");
                    }}
                  >
                    {section === "mise" ? "Mise" : "Cleaning"}
                  </button>

                  {openDropdown === "section" && (
                    <div className="dishes-dropdown-menu">
                      {["mise", "cleaning"].map(sec => (
                        <div
                          key={sec}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSection(sec);
                            setOpenDropdown(null);
                          }}
                        >
                          {sec.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* FOOTER */}
            <div className="category-modal-footer">
              <div className="form-actions">
                <button type="submit">Add Task</button>
                <button type="button" onClick={() => setShowTaskModal(false)}>
                  Cancel
                </button>
              </div>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}