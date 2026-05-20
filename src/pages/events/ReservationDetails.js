import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api";
import "./ReservationDetails.css";
import { useToast } from "../../useToast";

/* ── Helpers ── */
const pad = (n) => String(n).padStart(2, "0");

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const SLOT_MAP = {
  BF: { label: "Breakfast", color: "#92400e", bg: "#fef3c7" },
  BR: { label: "Brunch", color: "#3f6212", bg: "#ecfccb" },
  LU: { label: "Lunch", color: "#1e40af", bg: "#dbeafe" },
  HT: { label: "Hi-Tea", color: "#9d174d", bg: "#fce7f3" },
  DI: { label: "Dinner", color: "#5b21b6", bg: "#ede9fe" },
};

const slotFromTime = (time) => {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  if (h < 10) return SLOT_MAP.BF;
  if (h < 12) return SLOT_MAP.BR;
  if (h < 16) return SLOT_MAP.LU;
  if (h < 18) return SLOT_MAP.HT;
  return SLOT_MAP.DI;
};

/* ── Component ── */
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
        <div className="evt-resd-header">
          <button className="evt-resd-back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-resd-title">Reservation Detail</h2>
          </div>
        </div>
        <div className="evt-resd-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Reservation not found.</p>
        </div>
      </div>
    </div>
  );

  const slotInfo = data.slotGroup
    ? (SLOT_MAP[data.slotGroup] || slotFromTime(data.time))
    : slotFromTime(data.time);

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.put(`/reservations/${id}`, { ...data, status: newStatus });
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          reservations: (p.reservations || []).map(r =>
            r.id === id ? { ...r, status: newStatus } : r
          ),
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
    { icon: "👤", label: "Guest Name", val: data.name || "—" },
    { icon: "📱", label: "Mobile", val: data.mobile || "—" },
    { icon: "📧", label: "Email", val: data.email || "—" },
    { icon: "🌐", label: "Source", val: data.source || "—" },
    { icon: "👥", label: "No. of Guests", val: data.guests || "—" },
    { icon: "📅", label: "Date", val: data.date || "—" },
    { icon: "⏰", label: "Time", val: fmtTime(data.time) },
    { icon: "🍽️", label: "Dining Slot", val: slotInfo?.label || "—" },
    { icon: "🪑", label: "Table No.", val: data.tableNo ? `Table ${data.tableNo}` : "—" },
    { icon: "✨", label: "Table Preference", val: data.tablePref || "—" },
    { icon: "🧑‍💼", label: "Booking Incharge", val: data.inchargePerson || "—" },
    { icon: "🕐", label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="evt-resd-page">
      <div className="evt-resd-container">

        {/* ── HEADER ── */}
        <div className="evt-resd-header">
          <button className="evt-resd-back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-resd-title">Reservation Detail</h2>
            <p className="evt-resd-id">ID: <code>{data.id}</code></p>
          </div>
          <span className={`evt-resd-status evt-resd-status-${localStatus}`}>{localStatus}</span>
        </div>

        {/* ── HERO CARD ── */}
        <div className="evt-resd-hero">
          <div className="evt-resd-hero-avatar">
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="evt-resd-hero-info">
            <div className="evt-resd-hero-name">{data.name || "—"}</div>
            <div className="evt-resd-hero-sub">
              {data.mobile}{data.email ? ` · ${data.email}` : ""}
            </div>
            <div className="evt-resd-hero-meta">
              <span>📅 {data.date || "—"}</span>
              <span>⏰ {fmtTime(data.time)}</span>
              {slotInfo && (
                <span style={{ background: slotInfo.bg, color: slotInfo.color, borderColor: slotInfo.bg }}>
                  {slotInfo.label}
                </span>
              )}
              <span>🪑 Table {data.tableNo || "—"}</span>
              <span>👥 {data.guests || 1} guests</span>
              {data.tablePref && <span>✨ {data.tablePref}</span>}
              {data.source && <span>🌐 {data.source}</span>}
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-resd-section">
          <div className="evt-resd-section-title">Reservation Information</div>
          <div className="evt-resd-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-resd-info-cell">
                <span className="evt-resd-info-icon">{row.icon}</span>
                <div>
                  <div className="evt-resd-info-label">{row.label}</div>
                  <div className="evt-resd-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── NOTES ── */}
        {data.notes && (
          <div className="evt-resd-section">
            <div className="evt-resd-section-title">Notes / Special Requests</div>
            <div className="evt-resd-notes-box">{data.notes}</div>
          </div>
        )}

        {/* ── CALL HISTORY ── */}
        {data.callHistory?.length > 0 && (
          <div className="evt-resd-section">
            <div className="evt-resd-section-title">Call History ({data.callHistory.length})</div>
            <div className="evt-resd-call-history">
              {data.callHistory.map((ts, i) => (
                <div key={i} className="evt-resd-call-history-item">
                  <span>📞</span>
                  <span>Call #{i + 1}</span>
                  <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>{fmtDateTime(ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATUS UPDATE ── */}
        <div className="evt-resd-section">
          <div className="evt-resd-section-title">Update Status</div>
          <div className="evt-resd-status-row">
            {["pending", "confirmed", "completed", "cancelled"].map(s => (
              <button
                key={s}
                className={`evt-resd-status-btn evt-resd-sb-${s}${localStatus === s ? " active" : ""}`}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}
              >
                {saving && localStatus !== s ? "…" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── CALL CARD ── */}
        <div className="evt-resd-reminder">
          <span className="evt-resd-reminder-icon">📞</span>
          <div>
            <div className="evt-resd-reminder-label">Reminder Call</div>
            <div className="evt-resd-reminder-num">{data.mobile || "—"}</div>
          </div>
          <a
            className="evt-resd-call-btn"
            href={data.mobile ? `tel:${data.mobile}` : undefined}
            onClick={e => !data.mobile && e.preventDefault()}
          >
            Call Now
          </a>
        </div>

      </div>
    </div>
  );
};

export default ReservationDetails;