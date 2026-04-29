import React, { useState } from "react";
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
  const tomorrow = getTomorrowKey();
  const tomorrowFormatted = getTomorrowFormatted();

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
        <button
          onClick={() => setShowTaskModal(true)}
          className="task-add-btn"
        >
          + Add Task
        </button>
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
            {Object.entries(tasks || {}).map(([section, items]) => (
              <React.Fragment key={section}>

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