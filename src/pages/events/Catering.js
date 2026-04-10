import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Catering.css";

const Catering = ({ adminData }) => {
  const [filterToday, setFilterToday] = useState(false);
  const navigate = useNavigate();
  const data = adminData?.cateringOrders || [];

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
    <div className="evt-cat-page">

      {/* HEADER */}
      <div className="evt-cat-header">
        <h2 className="evt-cat-title">Catering Orders</h2>

        <div className="evt-cat-actions">
          <button
            className="evt-cat-btn"
            onClick={() => setFilterToday(prev => !prev)}
          >
            {filterToday ? "Show All" : "Today"}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-cat-table-wrapper">
        <table className="evt-cat-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Date</th>
              <th>Guests</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan="8" className="evt-cat-empty">
                  No catering orders found
                </td>
              </tr>
            ) : (
              sortedData.map(item => (
                <tr
                  key={item.id}
                  className="evt-cat-row clickable"
                  onClick={() =>
                    navigate(`/events/catering/${item.id}`)
                  }
                >
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.mobile}</td>
                  <td>{item.date}</td>
                  <td>{item.guests || "-"}</td>
                  <td>{item.items?.length || 0}</td>
                  <td>₹{item.totalAmount || 0}</td>
                  <td>
                    <span
                      className={`evt-cat-status evt-cat-status-${(item.status || "pending").toLowerCase()}`}
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

export default Catering;