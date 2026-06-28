/**
 * CelebrationDetails.js  —  Sam Cafe Admin Panel
 * Single celebration detail page
 */

import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";

import api from "../../api";
import { fmtTime, fmtDateTime } from "../../utils/dateUtils";

import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";

import "./CelebrationDetails.css";

/* ── Constants ── */
const CELEBRATION_TYPES = {
  birthday: { label: "Birthday", emoji: "Birthday" },
  anniversary: { label: "Anniversary", emoji: "Anniversary" },
  meeting: { label: "Meeting", emoji: "Meeting" },
  gettogether: { label: "Get Together", emoji: "Get Together" },
};

const DECORATION_TIERS = {
  normal: { label: "Normal", price: 1500, color: "#6b7280", bg: "#f3f4f6" },
  elegant: { label: "Elegant", price: 3000, color: "#3730a3", bg: "#eef2ff" },
  luxury: { label: "Luxury", price: 5000, color: "#92400e", bg: "#fef3c7" },
};

const EXTRAS_MAP = [
  { key: "cake", label: "Cake" },
  { key: "specialMention", label: "Special Mention" },
  { key: "candleLight", label: "Candle Light Dinner" },
  { key: "liveMusic", label: "Live Music" },
  { key: "surpriseGift", label: "Surprise Gift Reveal" },
  { key: "mic", label: "Microphone" },
  { key: "projector", label: "Projector" },
  { key: "standingBrochures", label: "Standing Brochures" },
  { key: "placeHolders", label: "Place Holders" },
  { key: "pens", label: "Pens" },
  { key: "audioVideo", label: "Audio & Video" },
];

/* ── Component ── */
const CelebrationDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  // ── Helpers

  const data = (adminData?.celebrations || []).find(c => c.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "pending");

  if (!data) return (
    <div className="details-container">
      <div className="evt-details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-details-title">Celebration Detail</h2>
          </div>
        </div>
        <div className="evt-details-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Celebration not found.</p>
        </div>
      </div>
    </div>
  );

  const typeInfo = CELEBRATION_TYPES[data.type] || { label: data.type || "Event", emoji: "Event" };
  const decoInfo = data.decoration ? DECORATION_TIERS[data.decoration] : null;
  const decoPrice = decoInfo ? decoInfo.price : 0;
  const avPrice = (data.mic || data.projector || data.audioVideo) ? 1500 : 0;
  const totalAddons = decoPrice + avPrice;
  const totalAmount = data.totalAmount ?? totalAddons;

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.patch(`/celebrations/${id}`, { status: newStatus });
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          celebrations: (p.celebrations || []).map(c =>
            c.id === id ? { ...c, status: newStatus } : c
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
    { label: "Event Type", val: typeInfo.label },
    { label: "No. of Guests", val: data.guests || "—" },
    { label: "Date", val: data.date || "—" },
    { label: "Time", val: fmtTime(data.time) },
    ...(data.type === "birthday" ? [
      { label: "Birthday Person", val: data.birthdayPersonName || "—" },
      { label: "Age", val: data.birthdayPersonAge ? `${data.birthdayPersonAge} yrs` : "—" },
    ] : []),
    { label: "Decoration", val: decoInfo ? `${decoInfo.label} — ₹${decoInfo.price.toLocaleString()}` : "None" },
    { label: "Event Menu", val: data.eventMenu || "—" },
    { label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">

      {/* ── HEADER ── */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">Celebration Detail</h2>
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
              <span>{typeInfo.label}</span>
              <span>{data.date || "—"}</span>
              <span>{fmtTime(data.time)}</span>
              <span>{data.guests} guests</span>
              {data.source && <span>{data.source}</span>}
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Celebration Information</div>
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

        {/* ── ADD-ONS ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Add-on Services</div>
          <div className="evt-details-extras-grid">
            {EXTRAS_MAP.map(ex => (
              <div
                key={ex.key}
                className={`evt-details-extra-item${data[ex.key] ? " selected" : " not-selected"}`}
              >
                <span className="evt-details-extra-label">{ex.label}</span>
                <span className="evt-details-extra-check">{data[ex.key] ? "✓" : "—"}</span>
              </div>
            ))}
          </div>

          {/* Special mention text */}
          {data.specialMention && data.specialMentionText && (
            <div className="evt-details-mention-box">
              <div className="evt-details-info-label" style={{ marginBottom: 4 }}>Special Mention Details</div>
              <p className="evt-details-mention-text">{data.specialMentionText}</p>
            </div>
          )}
        </div>

        {/* ── PRICING ── */}
        {(decoInfo || avPrice > 0 || data.eventMenu || totalAmount > 0) && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Decoration & Pricing</div>
            <div className="evt-details-pricing-card">
              {decoInfo && (
                <div className="evt-details-pricing-row">
                  <div className="evt-details-pricing-label">Decoration</div>
                  <div className="evt-details-pricing-val">
                    <span
                      className="evt-details-deco-badge"
                      style={{ background: decoInfo.bg, color: decoInfo.color }}
                    >
                      {decoInfo.label} — ₹{decoInfo.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {avPrice > 0 && (
                <div className="evt-details-pricing-row">
                  <div className="evt-details-pricing-label">Audio & Video</div>
                  <div className="evt-details-pricing-val">₹{avPrice.toLocaleString()}</div>
                </div>
              )}
              {data.eventMenu && (
                <div className="evt-details-pricing-row">
                  <div className="evt-details-pricing-label">Event Menu</div>
                  <div className="evt-details-pricing-val">
                    <span className="evt-details-menu-badge">{data.eventMenu}</span>
                  </div>
                </div>
              )}
              {totalAmount > 0 && (
                <div className="evt-details-pricing-row evt-details-pricing-total">
                  <div className="evt-details-pricing-label">
                    {data.totalAmount ? "Total Amount" : "Estimated Add-ons Total"}
                  </div>
                  <div className="evt-details-pricing-val">₹{totalAmount.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SPECIAL NOTES ── */}
        {data.specialNote && data.specialNote.replace(/-/g, "").trim() && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Special Notes</div>
            <div className="evt-details-notes-box">{data.specialNote}</div>
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

export default CelebrationDetails;
