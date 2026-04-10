import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Reservations.css";

const Reservations = ({ adminData }) => {
  const [filterToday, setFilterToday] = useState(false);
  const navigate = useNavigate();

  const data = adminData?.reservations || [];

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
    <div className="evt-res-page">

      {/* HEADER */}
      <div className="evt-res-header">
        <h2 className="evt-res-title">Reservations</h2>

        <div className="evt-res-actions">
          <button
            className="evt-res-btn"
            onClick={() => setFilterToday(prev => !prev)}
          >
            {filterToday ? "Show All" : "Today"}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-res-table-wrapper">
        <table className="evt-res-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Date</th>
              <th>Time</th>
              <th>Guests</th>
              <th>Table</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan="8" className="evt-res-empty">
                  No reservations found
                </td>
              </tr>
            ) : (
              sortedData.map(item => (
                <tr
                  key={item.id}
                  className="evt-res-row clickable"
                  onClick={() =>
                    navigate(`/events/reservations/${item.id}`)
                  }
                >
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.mobile}</td>
                  <td>{item.date}</td>
                  <td>{item.time}</td>
                  <td>{item.guests}</td>
                  <td>{item.tableNo}</td>
                  <td>
                    <span
                      className={`evt-res-status evt-res-status-${(item.status || "pending").toLowerCase()}`}
                    >
                      {item.status || "pending"}
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

export default Reservations;