import React from "react";
import "./ServiceMise.css";
import { getTodayFormatted, getTodayKey, getTomorrowKey } from "../../App";
import api from "../../api";

export default function ServiceMise({ adminData, setAdminData }) {
  const todayFormatted = getTodayFormatted();
  const today = getTodayKey();
  const tomorrow = getTomorrowKey();

  const activeDate =
    adminData.serviceMise?.[today]
      ? today
      : tomorrow;
  const tasks = adminData.tasks?.service; 

  const toggle = async (task) => {
    const isChecked = adminData.serviceMise?.[activeDate]?.[task]?.verified;

    const updated = {
      ...adminData.serviceMise,
      [activeDate]: {
        ...adminData.serviceMise?.[activeDate],
        [task]: {
          ...adminData.serviceMise?.[activeDate]?.[task],
          verified: !isChecked,
          time: !isChecked ? new Date().toLocaleTimeString() : ""
        }
      }
    };

    try {
      await api.put("/serviceMise/1", updated);

      setAdminData(prev => ({
        ...prev,
        serviceMise: updated
      }));

    } catch (err) {
      console.error("SAVE FAILED:", err);
    }

    setAdminData(prev => ({
      ...prev,
      serviceMise: updated
    }));
  };

  return (
    <div className="service-mise-main">

      {/* HEADER */}
      <div className="service-mise-header">
        <h2 className="service-mise-title">
          Service Mise en Place & Cleaning
        </h2>
        <h2 className="service-mise-date">{todayFormatted}</h2>
      </div>

      {/* SECTIONS */}
      {Object.entries(tasks || {}).map(([section, items]) => (
        <div key={section} className="service-mise-section">

          <h3 className="service-mise-section-title">
            {section.toUpperCase()}
          </h3>

          <div className="service-mise-table-wrapper">
            <table className="service-mise-table">

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
                  const staffAssigned = adminData.serviceMise?.[activeDate]?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>

                      <td>
                        {adminData.serviceMise?.[activeDate]?.[task]?.staff || "-"}
                      </td>

                      <td>
                        <input
                          className="service-mise-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}  // ✅ works now
                          checked={adminData.serviceMise?.[activeDate]?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>
                        {adminData.serviceMise?.[activeDate]?.[task]?.time || "-"}
                      </td>
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