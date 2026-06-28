/**
 * ReservationDetails.js  —  Sam Cafe Admin Panel
 * Single reservation detail page
 */

import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";

import api from "../../api";
import { fmtTime, fmtDateTime } from "../../utils/dateUtils";

import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";

import "./ReservationDetails.css";

/* ── Constants ── */
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
  // ── Hooks

  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Helpers

  const data = (adminData?.reservations || []).find((r) => r.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "pending");

  if (!data) return (
    <div className="details-container">
      <div className="evt-details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-details-title">Reservation Detail</h2>
          </div>
        </div>
        <div className="evt-details-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Reservation not found.</p>
        </div>
      </div>
    </div>
  );

  const slotInfo = data.slotGroup
    ? SLOT_MAP[data.slotGroup] || slotFromTime(data.time)
    : slotFromTime(data.time);

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.patch(`/reservations/${id}`, { status: newStatus });
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
    { label: "Guest Name", val: data.name || "—" },
    { label: "Mobile", val: data.mobile || "—" },
    { label: "Email", val: data.email || "—" },
    { label: "Source", val: data.source || "—" },
    { label: "No. of Guests", val: data.guests || "—" },
    { label: "Date", val: data.date || "—" },
    { label: "Time", val: fmtTime(data.time) },
    { label: "Dining Slot", val: slotInfo?.label || "—" },
    { label: "Table No.", val: data.tableNo ? `Table ${data.tableNo}` : "—" },
    { label: "Table Preference", val: data.tablePref || "—" },
    { label: "Booking Incharge", val: data.inchargePerson || "—" },
    { label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">

      {/* ── HEADER ── */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">Reservation Detail</h2>
          <p className="evt-details-id">ID: <code>{data.id}</code></p>
        </div>
        <span className={`evt-details-status-badge evt-details-status-${localStatus}`}>{localStatus}</span>
      </div>

      <div className="details-body">

        {/* ── HERO CARD ── */}
        <div className="evt-details-hero">
          <div className="evt-details-hero-avatar">
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="evt-details-hero-info">
            <div className="evt-details-hero-name">{data.name || "—"}</div>
            <div className="evt-details-hero-sub">
              {data.mobile}{data.email ? ` · ${data.email}` : ""}
            </div>
            <div className="evt-details-hero-meta">
              <span>{data.date || "—"}</span>
              <span>{fmtTime(data.time)}</span>
              {slotInfo && <span>{slotInfo.label}</span>}
              <span>Table {data.tableNo || "—"}</span>
              <span>{data.guests || 1} guests</span>
              {data.tablePref && <span>{data.tablePref}</span>}
              {data.source && <span>{data.source}</span>}
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Reservation Information</div>
          <div className="evt-details-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-details-info-cell">
                <div>
                  <div className="evt-details-info-label">{row.label}</div>
                  <div className="evt-details-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── NOTES ── */}
        {data.notes && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Notes / Special Requests</div>
            <div className="evt-details-notes-box">{data.notes}</div>
          </div>
        )}

        {/* ── CALL HISTORY ── */}
        {data.callHistory?.length > 0 && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Call History ({data.callHistory.length})</div>
            <div className="evt-details-call-history">
              {data.callHistory.map((ts, i) => (
                <div key={i} className="evt-details-call-history-item">
                  <span>Call #{i + 1}</span>
                  <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>{fmtDateTime(ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATUS UPDATE ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Update Status</div>
          <div className="evt-details-status-row">
            {["pending", "confirmed", "completed", "cancelled"].map(s => (
              <Button3D variant="cancel" key={s}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}>
                {saving && localStatus !== s ? "…" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button3D>
            ))}
          </div>
        </div>

        {/* ── CALL CARD ── */}
        <div className="evt-details-reminder">
          <div>
            <div className="evt-details-reminder-label">Reminder Call</div>
            <div className="evt-details-reminder-num">{data.mobile || "—"}</div>
          </div>
          <a
            className="modal-save-btn"
            href={data.mobile ? `tel:${data.mobile}` : undefined}
            onClick={e => !data.mobile && e.preventDefault()}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Call Now</span>
          </a>
        </div>

      </div>
    </div>
  );
};

export default ReservationDetails;
