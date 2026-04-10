import React, { useState } from "react";
import "./KitchenGrooming.css";
import api from "../../api";

export default function KitchenGrooming({ adminData, setAdminData }) {

  const dates = (() => {
    const arr = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      arr.push(d.toISOString().split("T")[0]);
    }

    return arr;
  })();

  const [selected, setSelected] = useState(null);
  const [showMemo, setShowMemo] = useState(false);
  const [memo, setMemo] = useState({ staffId: "", text: "" });

  const toggle = async (staffId, date, field) => {
    const updated = {
      ...adminData.grooming,
      [staffId]: {
        ...adminData.grooming?.[staffId],
        [date]: {
          ...adminData.grooming?.[staffId]?.[date],
          [field]: !adminData.grooming?.[staffId]?.[date]?.[field]
        }
      }
    };

    await api.put("/grooming", updated);

    // 🔥 instant UI update
    setAdminData(prev => ({
      ...prev,
      grooming: updated
    }));
  };

  return (
    <div className="groom-page">

      {/* HEADER */}
      <div className="groom-header">
        <h2 className="groom-title">Grooming</h2>

        <button
          className="groom-add-btn"
          onClick={() => setShowMemo(true)}
        >
          + Add Memo
        </button>
      </div>

      <div className="groom-table-wrapper">
        <table className="groom-table">
          <thead>
            <tr>
              <th>Staff</th>
              {dates.map(d => (
                <th key={d}>{new Date(d).getDate()}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {adminData.staff.map(s => (
              <tr key={s.id}>
                <td>{s.name}</td>

                {dates.map(d => {
                  const prevDate = new Date(d);
                  prevDate.setDate(prevDate.getDate() - 1);

                  const entry = adminData.grooming?.[s.id]?.[d];

                  return (
                    <td
                      key={d}
                      onClick={() => {
                        if (d !== dates[dates.length - 1]) {
                          setSelected({ staff: s.name, date: d, entry });
                        }
                      }}
                    >
                      {d === dates[dates.length - 1] ? (
                        <div className="kitchen-groom-checkbox-group">
                          <label htmlFor="" className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={adminData.grooming?.[s.id]?.[d]?.uniform || false}
                              onChange={() => toggle(s.id, d, "uniform")}
                            />
                            Uniform
                          </label>

                          <label htmlFor="" className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={adminData.grooming?.[s.id]?.[d]?.shoes || false}
                              onChange={() => toggle(s.id, d, "shoes")}
                            />
                            Shoes
                          </label>

                          <label htmlFor="" className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={adminData.grooming?.[s.id]?.[d]?.groom || false}
                              onChange={() => toggle(s.id, d, "groom")}
                            />
                            Groom
                          </label>

                        </div>
                      ) : (
                        <span
                          className={
                            entry?.uniform && entry?.shoes && entry?.groom
                              ? "status-yes"
                              : "status-no"
                          }
                        >
                          {entry?.uniform && entry?.shoes && entry?.groom ? "✔" : "✖"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <div className="category-modal-overlay">
          <div className="category-modal">
            <div className="category-modal-header">
              <h3>Details</h3>
              <button className="dish-close-btn" onClick={() => setSelected(null)} />
            </div>

            <div className="category-modal-body">
              <table className="data-table">
                <tr><td><b>Staff</b></td><td>{selected.staff}</td></tr>

                <tr><td><b>Date</b></td><td>{selected.date}</td></tr>
                <tr>
                  <td>
                    Uniform
                  </td>
                  <td>
                    <span className={selected.entry?.uniform ? "status-yes" : "status-no"}>
                      {selected.entry?.uniform ? " ✔" : " ✖"}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td>
                    Shoes
                  </td>
                  <td>
                    <span className={selected.entry?.shoes ? "status-yes" : "status-no"}>
                      {selected.entry?.shoes ? " ✔" : " ✖"}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td>
                    Groom
                  </td>
                  <td>
                    <span className={selected.entry?.groom ? "status-yes" : "status-no"}>
                      {selected.entry?.groom ? " ✔" : " ✖"}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MEMO MODAL */}
      {showMemo && (
        <div className="category-modal-overlay">
          <div className="category-modal">

            <div className="category-modal-header">
              <h3>Add Memo</h3>
              <button className="dish-close-btn" onClick={() => setShowMemo(false)} />
            </div>

            <div className="category-modal-body">

              <div className="form-group">
                <label>Staff</label>
                <select
                  value={memo.staffId}
                  onChange={(e) =>
                    setMemo({ ...memo, staffId: e.target.value })
                  }
                >
                  <option>Select</option>
                  {adminData.staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ height: "70%", boxSizing: "border-box" }}>
                <label>Memo</label>
                <textarea
                  value={memo.text}
                  onChange={(e) =>
                    setMemo({ ...memo, text: e.target.value })
                  }
                />
              </div>

            </div>

            <div className="category-modal-footer form-actions">
              <button onClick={() => setShowMemo(false)}>Save</button>
              <button onClick={() => setShowMemo(false)}>Cancel</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}