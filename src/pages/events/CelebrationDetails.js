import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../api";
import "./CelebrationDetails.css";

const CelebrationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  /* ================= FETCH ================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/celebrations/${id}`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch celebration details", err);
      }
    };

    fetchData();
  }, [id]);

  if (!data) return <div className="evt-clbd-page">Loading...</div>;

  const normalizeStatus = (status = "") =>
    status.toLowerCase().trim();

  return (
    <div className="evt-clbd-page">
      <div className="evt-clbd-container">

        {/* HEADER */}
        <div className="evt-clbd-header">
          <button
            className="evt-clbd-back-btn"
            onClick={() => navigate(-1)}
          />
          <h2>Celebration {data.id}</h2>
        </div>

        {/* CUSTOMER INFO */}
        <div className="evt-clbd-section">
          <div className="evt-clbd-section-title">
            <span>Customer Information</span>
          </div>

          <table className="evt-clbd-info-table">
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
                <td><strong>Occasion:</strong> {data.type || "-"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`evt-clbd-status evt-clbd-status-${normalizeStatus(data.status)}`}
                  >
                    {data.status || "pending"}
                  </span>
                </td>
                <td><strong>Notes:</strong> {data.notes || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* EXTRA SERVICES */}
        <div className="evt-clbd-section">
          <div className="evt-clbd-section-title">
            <span>Extra Services</span>
          </div>

          <table className="evt-clbd-items-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Selected</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>Decoration</td>
                <td>{data.decoration ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <td>Cake</td>
                <td>{data.cake ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <td>Music</td>
                <td>{data.music ? "Yes" : "No"}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default CelebrationDetails;