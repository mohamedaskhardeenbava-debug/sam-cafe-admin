import React, { useState } from "react";
import "./ServiceGrooming.css";
import api from "../../api";

export default function ServiceGrooming({ adminData, setAdminData }) {

  // ✅ Last 7 days
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

  // ✅ Toggle checkbox
  const toggle = async (staffId, date, field) => {
    const updated = {
      ...adminData.serviceGrooming,
      [staffId]: {
        ...adminData.serviceGrooming?.[staffId],
        [date]: {
          ...adminData.serviceGrooming?.[staffId]?.[date],
          [field]: !adminData.serviceGrooming?.[staffId]?.[date]?.[field]
        }
      }
    };

    await api.put("/serviceGrooming/1", updated);

    setAdminData(prev => ({
      ...prev,
      serviceGrooming: updated
    }));
  };

  const saveMemo = async () => {
    if (!memo.staffId || !memo.text) return;

    const today = new Date().toISOString().split("T")[0];

    const updated = {
      ...adminData.serviceGrooming,
      memo: {
        ...adminData.serviceGrooming?.memo,
        [memo.staffId]: {
          ...adminData.serviceGrooming?.memo?.[memo.staffId],
          [today]: memo.text
        }
      }
    };

    await api.put("/serviceGrooming/1", updated);

    setAdminData(prev => ({
      ...prev,
      serviceGrooming: updated
    }));

    setShowMemo(false);
    setMemo({ staffId: "", text: "" });
  };

  return (
    <div className="service-groom-page">

      {/* HEADER */}
      <div className="service-groom-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="service-groom-title">Service Grooming</h2>

        <button
          className="service-groom-add-btn"
          onClick={() => setShowMemo(true)}
        >
          Add Memo
        </button>
      </div>

      <div className="service-groom-table-container">
        <table className="service-groom-table">

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
                <td className="service-groom-staff">{s.name}</td>

                {dates.map((d, index) => {
                  const entry = adminData.serviceGrooming?.[s.id]?.[d];

                  return (
                    <td
                      key={d}
                      onClick={() => {
                        if (index !== dates.length - 1) {
                          setSelected({
                            staff: s.name,
                            date: d,
                            entry
                          });
                        }
                      }}
                    >

                      {/* ✅ TODAY */}
                      {index === dates.length - 1 ? (
                        <div className="service-groom-checkbox-group">

                          <label className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={entry?.uniform || false}
                              onChange={() => toggle(s.id, d, "uniform")}
                            />
                            Uniform
                          </label>

                          <label className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={entry?.shoes || false}
                              onChange={() => toggle(s.id, d, "shoes")}
                            />
                            Shoes
                          </label>

                          <label className="checkbox-item">
                            <input
                              type="checkbox"
                              checked={entry?.groom || false}
                              onChange={() => toggle(s.id, d, "groom")}
                            />
                            Groom
                          </label>

                        </div>
                      ) : (

                        // ✅ HISTORY (✔ / ✖)
                        <span
                          className={
                            entry?.uniform && entry?.shoes && entry?.groom
                              ? "service-status-yes"
                              : "service-status-no"
                          }
                        >
                          {entry?.uniform && entry?.shoes && entry?.groom
                            ? "✔"
                            : "✖"}
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

      {/* ✅ MODAL */}
      {selected && (
        <div className="service-modal-overlay">
          <div className="service-modal">

            <div className="service-modal-header">
              <h3>Grooming Details</h3>
              <button
                className="dish-close-btn"
                onClick={() => setSelected(null)}
              />
            </div>

            <div className="service-modal-body">

              <table className="data-table">
                <tbody>
                  <tr>
                    <td><b>Staff</b></td>
                    <td>{selected.staff}</td>
                  </tr>

                  <tr>
                    <td><b>Date</b></td>
                    <td>{selected.date}</td>
                  </tr>

                  <tr>
                    <td>Uniform</td>
                    <td className={selected.entry?.uniform ? "service-status-yes" : "service-status-no"}>
                      {selected.entry?.uniform ? "✔" : "✖"}
                    </td>
                  </tr>

                  <tr>
                    <td>Shoes</td>
                    <td className={selected.entry?.shoes ? "service-status-yes" : "service-status-no"}>
                      {selected.entry?.shoes ? "✔" : "✖"}
                    </td>
                  </tr>

                  <tr>
                    <td>Grooming</td>
                    <td className={selected.entry?.groom ? "service-status-yes" : "service-status-no"}>
                      {selected.entry?.groom ? "✔" : "✖"}
                    </td>
                  </tr>

                </tbody>
              </table>

            </div>
          </div>
        </div>
      )}

      {showMemo && (
        <div className="category-modal-overlay">
          <div className="category-modal">

            <div className="category-modal-header">
              <h3>Add Memo</h3>
              <button
                className="dish-close-btn"
                onClick={() => setShowMemo(false)}
              />
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
                  <option value="">Select</option>
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
              <button onClick={saveMemo}>Save</button>
              <button onClick={() => setShowMemo(false)}>Cancel</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}