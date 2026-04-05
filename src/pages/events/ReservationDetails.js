import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../api";
import "./ReservationDetails.css";

const ReservationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/reservations/${id}`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch reservation details", err);
      }
    };

    fetchData();
  }, [id]);

  if (!data) return <div className="evt-resd-page">Loading...</div>;

  const normalizeStatus = (status = "") =>
    status.toLowerCase().trim();

  return (
    <div className="evt-resd-page">
      <div className="evt-resd-container">

        {/* HEADER */}
        <div className="evt-resd-header">
          <button
            className="evt-resd-back-btn"
            onClick={() => navigate(-1)}
          />
          <h2>Reservation {data.id}</h2>
        </div>

        {/* CUSTOMER INFO */}
        <div className="evt-resd-section">
          <div className="evt-resd-section-title">
            <span>Reservation Information</span>
          </div>

          <table className="evt-resd-info-table">
            <tbody>
              <tr>
                <td><strong>Name:</strong> {data.name}</td>
                <td><strong>Mobile:</strong> {data.mobile}</td>
              </tr>
              <tr>
                <td><strong>Date:</strong> {data.date}</td>
                <td><strong>Time:</strong> {data.time}</td>
              </tr>
              <tr>
                <td><strong>Guests:</strong> {data.guests}</td>
                <td><strong>Table No:</strong> {data.tableNo}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`evt-resd-status evt-resd-status-${normalizeStatus(data.status)}`}
                  >
                    {data.status || "pending"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default ReservationDetails;