import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api";
import "./ReservationDetails.css";
import { useToast } from "../../useToast";
/* admin panel */

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

const SLOT_LABEL = (time) => {
  if (!time) return "—";
  const h = parseInt(time.split(":")[0], 10);
  if (h < 11) return "Breakfast";
  if (h < 16) return "Lunch";
  return "Dinner";
};

const ReservationDetails = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.reservations || []).find(r => r.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "pending");

  if (!data) return (
    <div className="evt-resd-page">
      <div className="evt-resd-container">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <p style={{ color: "#888", marginTop: 20 }}>Reservation not found.</p>
      </div>
    </div>
  );

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.put(`/reservations/${id}`, { ...data, status: newStatus });
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          reservations: (p.reservations || []).map(r => r.id === id ? { ...r, status: newStatus } : r),
        }));
      }
    } catch (err) {
      console.error("Update failed", err);
      toast.error("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { label: "Guest Name", val: data.name || "—" },
    { label: "Mobile", val: data.mobile || "—" },
    { label: "Email", val: data.email || "—" },
    { label: "Source", val: data.source || "—" },
    { label: "No. of Guests", val: data.guests || "—" },
    { label: "Date", val: data.date || "—" },
    { label: "Dining Slot", val: SLOT_LABEL(data.time) },
    { label: "Time", val: fmtTime(data.time) },
    { label: "Table No.", val: data.tableNo ? `Table ${data.tableNo}` : "—" },
    { label: "Table Preference", val: data.tablePref || "—" },
    { label: "Booking Incharge", val: data.inchargePerson || "—" },
  ];

  return (
    <div className="evt-resd-page">
      <div className="evt-resd-container">

        {/* HEADER */}
        <div className="evt-resd-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-resd-title">Reservation Detail</h2>
            <p className="evt-resd-id">ID: <code>{data.id}</code></p>
          </div>
          <span className={`evt-resd-status evt-resd-status-${localStatus}`}>{localStatus}</span>
        </div>

        {/* HERO CARD */}
        <div className="evt-resd-hero">
          <div className="evt-resd-hero-avatar">{(data.name || "?").charAt(0).toUpperCase()}</div>
          <div className="evt-resd-hero-info">
            <div className="evt-resd-hero-name">{data.name || "—"}</div>
            <div className="evt-resd-hero-sub">{data.mobile}{data.email ? ` · ${data.email}` : ""}</div>
            <div className="evt-resd-hero-meta">
              <span>{data.date}</span>
              <span>{fmtTime(data.time)}</span>
              <span>Table {data.tableNo || "—"}</span>
              <span>{data.guests} guests</span>
            </div>
          </div>
        </div>

        {/* INFO TABLE */}
        <div className="evt-resd-section">
          <div className="evt-resd-section-title">Reservation Information</div>
          <div className="evt-resd-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-resd-info-cell">
                <div>
                  <div className="evt-resd-info-label">{row.label}</div>
                  <div className="evt-resd-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NOTES */}
        {data.notes && (
          <div className="evt-resd-section">
            <div className="evt-resd-section-title">Notes / Special Requests</div>
            <div className="evt-resd-notes-box">{data.notes}</div>
          </div>
        )}

        {/* STATUS UPDATE */}
        <div className="evt-resd-section">
          <div className="evt-resd-section-title">Update Status</div>
          <div className="evt-resd-status-row">
            {["pending", "confirmed", "completed", "cancelled"].map(s => (
              <button key={s}
                className={`evt-resd-status-btn evt-resd-sb-${s} ${localStatus === s ? "active" : ""}`}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}>
                {saving && localStatus !== s ? "..." : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* REMINDER CALL */}
        <div className="evt-resd-reminder">
          <div>
            <div className="evt-resd-reminder-label">Reminder Call</div>
            <div className="evt-resd-reminder-num">{data.mobile || "—"}</div>
          </div>
          <div className="evt-resd-call-btn">Call Now</div>
        </div>

      </div>
    </div>
  );
};

export default ReservationDetails;