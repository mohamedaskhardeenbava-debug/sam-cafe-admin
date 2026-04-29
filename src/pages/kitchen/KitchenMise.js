import React from "react";
import "./KitchenMise.css";
import { getTodayKey, getTodayFormatted, getTomorrowKey } from "../../App";
import api from "../../api";

export default function KitchenMise({ adminData, setAdminData }) {
  const todayFormatted = getTodayFormatted();
  const today = getTodayKey();
  const tomorrow = getTomorrowKey();

  const activeDate =
    adminData.mise?.[today]
      ? today
      : tomorrow;
  const tasks = adminData.tasks?.kitchen;

  const toggle = async (task) => {
    const isChecked = adminData.mise?.[activeDate]?.[task]?.verified;

    const updated = {
      ...adminData.mise,
      [activeDate]: {
        ...adminData.mise?.[activeDate],
        [task]: {
          ...adminData.mise?.[activeDate]?.[task],
          verified: !isChecked,
          time: !isChecked ? new Date().toLocaleTimeString() : ""
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
    <div className="mise-page">
      <div className="mise-header">
        <h2 className="mise-title">Mise en Place & Cleaning</h2>
        <h2 className="mise-date">{todayFormatted}</h2>
      </div>

      {Object.entries(tasks || {}).map(([section, items]) => (
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
                  const staffAssigned = adminData.mise?.[activeDate]?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>
                      <td>{adminData.mise?.[activeDate]?.[task]?.staff || "-"}</td>

                      <td>
                        <input
                          className="mise-table-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}
                          checked={adminData.mise?.[activeDate]?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>{adminData.mise?.[activeDate]?.[task]?.time || "-"}</td>
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