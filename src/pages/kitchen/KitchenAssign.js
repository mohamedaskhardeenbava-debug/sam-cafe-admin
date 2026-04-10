import React from "react";
import "./KitchenAssign.css";
import { getTodayKey, getTodayFormatted } from "../../App";
import api from "../../api";

// ✅ Both sections
const tasks = {
  mise: ["Arrangement", "Organize", "Veg Cutting", "Meat Cutting"],
  cleaning: ["Floor", "Working Table", "Sink", "Vessel", "Range", "Refrigerator"]
};

export default function KitchenAssign({ adminData, setAdminData }) {
  const today = getTodayKey();
const todayFormatted = getTodayFormatted();

  const handleChange = async (task, staffName) => {
    const updated = {
      ...adminData.mise,
      [today]: {
        ...adminData.mise?.[today],
        [task]: {
          staff: staffName,
          time: new Date().toLocaleTimeString()
        }
      }
    };

    await api.put("/mise", updated);

    // ✅ Update UI instantly (no refresh)
    setAdminData(prev => ({
      ...prev,
      mise: updated
    }));
  };

  return (
    <div className="assign-page">
      <div className="assign-header">
        <h2 className="assign-title">Staff Assigning</h2>
        <h2 className="assign-date">{todayFormatted}</h2>
      </div>

      <div className="assign-table-wrapper">
        <table className="assign-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Staff</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(tasks).map(([section, items]) => (
              <React.Fragment key={section}>

                {/* ✅ Section Header */}
                <tr>
                  <td
                    colSpan="3"
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
                        value={adminData.mise?.[today]?.[task]?.staff || ""}
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
                      {adminData.mise?.[today]?.[task]?.time || "-"}
                    </td>
                  </tr>
                ))}

              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}