import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./PreBookings.css";

const PreBookings = ({ adminData }) => {
  const [filterToday, setFilterToday] = useState(false);
  const navigate = useNavigate();

  const data = adminData?.preBookings || [];

  /* ================= FILTER ================= */
  const filteredData = useMemo(() => {
    if (!filterToday) return data;

    const today = new Date().toISOString().split("T")[0];
    return data.filter(item => item.date === today);
  }, [data, filterToday]);

  /* ================= SORT ================= */
  const sortedData = useMemo(() => {
    return [...filteredData].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [filteredData]);

  return (
    <div className="evt-pre-page">

      {/* HEADER */}
      <div className="evt-pre-header">
        <h2 className="evt-pre-title">PreBookings</h2>

        <div className="evt-pre-actions">
          <button
            className="evt-pre-btn"
            onClick={() => setFilterToday(prev => !prev)}
          >
            {filterToday ? "Show All" : "Today"}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-pre-table-wrapper">
        <table className="evt-pre-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Date</th>
              <th>Time</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan="8" className="evt-pre-empty">
                  No preBookings found
                </td>
              </tr>
            ) : (
              sortedData.map(item => (
                <tr
                  key={item.id}
                  className="evt-pre-row clickable"
                  onClick={() =>
                    navigate(`/events/prebookings/${item.id}`)
                  }
                >
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.mobile}</td>
                  <td>{item.date}</td>
                  <td>{item.time}</td>
                  <td>{item.items?.length || 0}</td>
                  <td>₹{item.totalAmount || 0}</td>
                  <td>
                    <span
                      className={`evt-pre-status evt-pre-status-${(item.status || "scheduled").toLowerCase()}`}
                    >
                      {item.status || "scheduled"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreBookings;