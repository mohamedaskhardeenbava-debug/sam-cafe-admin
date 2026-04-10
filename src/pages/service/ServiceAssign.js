import React from "react";
import "./ServiceAssign.css";
import { getTodayKey, getTodayFormatted } from "../../App";

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

export default function ServiceAssign({ adminData, setAdminData }) {
  const today = getTodayKey();
  const todayFormatted = getTodayFormatted();

  const handleChange = async (task, staffName) => {

    const updatedAssign = {
      ...adminData.serviceAssign,

      [today]: {
        ...adminData.serviceAssign?.[today],
        [task]: {
          staff: staffName,
          time: new Date().toLocaleTimeString()
        }
      }
    };

    const updatedMise = {
      ...adminData.serviceMise,
      [today]: {
        ...adminData.serviceMise?.[today],
        [task]: {
          ...adminData.serviceMise?.[today]?.[task],
          staff: staffName
        }
      }
    };

    // ✅ API CALLS
    await fetch("http://localhost:5000/serviceAssign/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedAssign)
    });

    await fetch("http://localhost:5000/serviceMise/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMise)
    });

    // ✅ UPDATE UI
    setAdminData(prev => ({
      ...prev,
      serviceAssign: updatedAssign,
      serviceMise: updatedMise
    }));
  };

  return (
    <div className="service-assign-main">

      {/* HEADER */}
      <div className="service-assign-header">
        <h2 className="service-assign-title">
          Service Staff Assigning
        </h2>
        <h2 className="service-assign-date">{todayFormatted}</h2>
      </div>

      {/* TABLE */}
      <div className="service-assign-table-wrapper">
        <table className="service-assign-table">

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

                {/* SECTION HEADER */}
                <tr className="service-assign-section">
                  <td colSpan="3">{section.toUpperCase()}</td>
                </tr>

                {/* TASK ROWS */}
                {items.map(task => (
                  <tr key={task}>
                    <td>{task}</td>

                    <td>
                      <select
                        className="service-assign-select"
                        value={adminData.serviceAssign?.[today]?.[task]?.staff || ""}
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
                      {adminData.serviceAssign?.[today]?.[task]?.time || "-"}
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