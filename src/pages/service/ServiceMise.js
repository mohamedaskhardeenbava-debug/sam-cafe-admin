import React from "react";
import "./ServiceMise.css";
import { getTodayFormatted } from "../../App";

const tasks = {
  mise: ["Table Setup", "Cutlery Setup", "Water Setup"],
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
  const toggle = async (task) => {
    const isChecked = adminData.serviceMise?.[task]?.verified;

    const updated = {
      ...adminData.serviceMise,
      [task]: {
        ...adminData.serviceMise?.[task],
        verified: !isChecked,
        time: !isChecked ? new Date().toLocaleTimeString() : ""   // ✅ CLEAR TIME
      }
    };

    await fetch("http://localhost:5000/serviceMise/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

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
                  const staffAssigned = adminData.serviceMise?.[task]?.staff;

                  return (
                    <tr key={task}>
                      <td>{task}</td>

                      <td>
                        {adminData.serviceMise?.[task]?.staff || "-"}
                      </td>

                      <td>
                        <input
                          className="service-mise-checkbox"
                          type="checkbox"
                          disabled={!staffAssigned}  // ✅ works now
                          checked={adminData.serviceMise?.[task]?.verified || false}
                          onChange={() => toggle(task)}
                        />
                      </td>

                      <td>
                        {adminData.serviceMise?.[task]?.time || "-"}
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