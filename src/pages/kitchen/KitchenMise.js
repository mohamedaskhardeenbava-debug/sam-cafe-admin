import React from "react";
import "./KitchenMise.css";
import { getTodayKey, getTodayFormatted } from "../../App";

const tasks = {
  mise: ["Arrangement", "Organize", "Veg Cutting", "Meat Cutting"],
  cleaning: ["Floor", "Working Table", "Sink", "Vessel", "Range", "Refrigerator"]
};

export default function KitchenMise({ adminData, setAdminData }) {
  const todayFormatted = getTodayFormatted();
  const today = getTodayKey();
  
  const toggle = async (task) => {
    const isChecked = adminData.mise?.[today]?.[task]?.verified;

    const updated = {
      ...adminData.mise,
      [today]: {
        ...adminData.mise?.[today],
        [task]: {
          ...adminData.mise?.[today]?.[task],
          verified: !isChecked,
          time: !isChecked ? new Date().toLocaleTimeString() : ""
        }
      }
    };

    await fetch("http://localhost:5000/mise", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

    setAdminData(prev => ({
      ...prev,
      mise: updated
    }));
  };

  return (
    <div className="mise-page">
      <div className="mise-header">
        <h2 className="mise-title">Mise en Place & Cleaning</h2>
        <h2 className="mise-date">{todayFormatted}</h2>
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
                {items.map(task => {
                  const staffAssigned = adminData.mise?.[today]?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>
                      <td>{adminData.mise?.[today]?.[task]?.staff || "-"}</td>

                      <td>
                        <input
                          className="mise-table-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}
                          checked={adminData.mise?.[today]?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>{adminData.mise?.[today]?.[task]?.time || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}