import React from "react";
import "./ServiceMise.css";
import { getTodayFormatted, getTodayKey } from "../../App";
import api from "../../api";

const tasks = {
  mise: ["Table Setup", "Cutlery Setup", "Water Filling", "Cash Counter"],
  cleaning: [
    "Floor",
    "Table",
    "Sink",
    "Cutlery & Crockery",
    "Equipment",
    "Refrigerator",
    "Clothes & Laundry"
  ]
};

export default function ServiceMise({ adminData, setAdminData }) {
  const todayFormatted = getTodayFormatted();
  const today = getTodayKey();

  const toggle = async (task) => {
    const isChecked = adminData.serviceMise?.[today]?.[task]?.verified;

    const updated = {
      ...adminData.serviceMise,
      [today]: {
        ...adminData.serviceMise?.[today],
        [task]: {
          ...adminData.serviceMise?.[today]?.[task],
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
      {Object.entries(tasks).map(([section, items]) => (
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
                  const staffAssigned = adminData.serviceMise?.[today]?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>

                      <td>
                        {adminData.serviceMise?.[today]?.[task]?.staff || "-"}
                      </td>

                      <td>
                        <input
                          className="service-mise-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}  // ✅ works now
                          checked={adminData.serviceMise?.[today]?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>
                        {adminData.serviceMise?.[today]?.[task]?.time || "-"}
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