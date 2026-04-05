import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Celebrations.css";

const Celebrations = () => {
  const [data, setData] = useState([]);
  const [filterToday, setFilterToday] = useState(false);
  const navigate = useNavigate();

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/celebrations");
        setData(res.data || []);
      } catch (err) {
        console.error("Failed to fetch celebrations", err);
      }
    };

    fetchData();
  }, []);

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
    <div className="evt-clb-page">

      {/* HEADER */}
      <div className="evt-clb-header">
        <h2 className="evt-clb-title">Celebrations</h2>

        <div className="evt-clb-actions">
          <button
            className="evt-clb-btn"
            onClick={() => setFilterToday(prev => !prev)}
          >
            {filterToday ? "Show All" : "Today"}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-clb-table-wrapper">
        <table className="evt-clb-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Date</th>
              <th>Time</th>
              <th>Guests</th>
              <th>Occasion</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan="8" className="evt-clb-empty">
                  No celebrations found
                </td>
              </tr>
            ) : (
              sortedData.map(item => (
                <tr
                  key={item.id}
                  className="evt-clb-row clickable"
                  onClick={() =>
                    navigate(`/events/celebrations/${item.id}`)
                  }
                >
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.mobile}</td>
                  <td>{item.date}</td>
                  <td>{item.time}</td>
                  <td>{item.guests}</td>
                  <td>{item.type || "-"}</td>
                  <td>
                    <span
                      className={`evt-clb-status evt-clb-status-${(item.status || "pending").toLowerCase()}`}
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

export default Celebrations;