import React from "react";
import "./KitchenAssign.css";

// ✅ Both sections
const tasks = {
  mise: ["Arrangement", "Organize", "Veg Cutting", "Meat Cutting"],
  cleaning: ["Floor", "Working Table", "Sink", "Vessel", "Range", "Refrigerator"]
};

export default function KitchenAssign({ adminData, setAdminData }) {
  const handleChange = async (task, staffName) => {
    const updated = {
      ...adminData.mise,
      [task]: {
        staff: staffName,
        time: new Date().toLocaleTimeString()
      }
    };

    // ✅ Update backend
    await fetch("http://localhost:5000/mise", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

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
                        value={adminData.mise?.[task]?.staff || ""}
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
                      {adminData.mise?.[task]?.time || "-"}
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