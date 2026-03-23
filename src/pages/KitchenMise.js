import React from "react";
import "./KitchenMise.css";

const tasks = {
  mise: ["Arrangement", "Organize", "Veg Cutting", "Meat Cutting"],
  cleaning: ["Floor", "Working Table", "Sink", "Vessel", "Range", "Refrigerator"]
};

export default function miseMise({ adminData, setAdminData }) {

  const toggle = async (task) => {
    const updated = {
      ...adminData.mise,
      [task]: {
        ...adminData.mise?.[task],
        verified: !adminData.mise?.[task]?.verified,
        time: new Date().toLocaleTimeString()
      }
    };

    await fetch("http://localhost:5000/mise", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

    // 🔥 instant UI update
    setAdminData(prev => ({
      ...prev,
      mise: updated
    }));
  };

  return (
    <div className="mise-page">
      <div className="mise-header">
        <h2 className="mise-title">Mise en Place & Cleaning</h2>
      </div>

      {Object.entries(tasks).map(([section, items]) => (
        <div key={section}>
          <h3>{section.toUpperCase()}</h3>

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
                {items.map(task => (
                  <tr key={task}>
                    <td>{task}</td>
                    <td>{adminData.mise?.[task]?.staff || "-"}</td>
                    <td>
                      <input
                      className="mise-table-checkbox"
                        type="checkbox"
                        checked={adminData.mise?.[task]?.verified || false}
                        onChange={() => toggle(task)}
                      />
                    </td>
                    <td>{adminData.mise?.[task]?.time || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}