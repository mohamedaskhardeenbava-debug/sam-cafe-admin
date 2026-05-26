/* admin panel */
import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api";
import "./CelebrationDetails.css";
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

/* ── Constants ── */
const CELEBRATION_TYPES = {
  birthday: { label: "🎂 Birthday", emoji: "🎂" },
  anniversary: { label: "💍 Anniversary", emoji: "💍" },
  meeting: { label: "🤝 Meeting", emoji: "🤝" },
  gettogether: { label: "🎉 Get Together", emoji: "🎉" },
};

const DECORATION_TIERS = {
  normal: { label: "Normal", price: 1500, color: "#6b7280", bg: "#f3f4f6" },
  elegant: { label: "Elegant", price: 3000, color: "#3730a3", bg: "#eef2ff" },
  luxury: { label: "Luxury", price: 5000, color: "#92400e", bg: "#fef3c7" },
};

const EXTRAS_MAP = [
  { key: "cake", label: "Cake", icon: "🎂" },
  { key: "specialMention", label: "Special Mention", icon: "📢" },
  { key: "candleLight", label: "Candle Light Dinner", icon: "🕯️" },
  { key: "liveMusic", label: "Live Music", icon: "🎵" },
  { key: "surpriseGift", label: "Surprise Gift Reveal", icon: "🎁" },
  { key: "mic", label: "Microphone", icon: "🎤" },
  { key: "projector", label: "Projector", icon: "📽️" },
  { key: "standingBrochures", label: "Standing Brochures", icon: "🗂️" },
  { key: "placeHolders", label: "Place Holders", icon: "🪧" },
  { key: "pens", label: "Pens", icon: "🖊️" },
  { key: "audioVideo", label: "Audio & Video", icon: "🔊" },
];

/* ── Component ── */
const CelebrationDetails = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.celebrations || []).find(c => c.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "pending");

  if (!data) return (
    <div className="details-container">
      <div className="evt-clbd-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-clbd-title">Celebration Detail</h2>
          </div>
        </div>
        <div className="evt-clbd-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Celebration not found.</p>
        </div>
      </div>
    </div>
  );

  const typeInfo = CELEBRATION_TYPES[data.type] || { label: data.type || "Event", emoji: "🎉" };
  const decoInfo = data.decoration ? DECORATION_TIERS[data.decoration] : null;
  const decoPrice = decoInfo ? decoInfo.price : 0;
  const avPrice = (data.mic || data.projector || data.audioVideo) ? 1500 : 0;
  const totalAddons = decoPrice + avPrice;
  const totalAmount = data.totalAmount ?? totalAddons;

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      try { await api.patch(`/celebrations/${id}`, { status: newStatus }); }
      catch { await api.put(`/celebrations/${id}`, { ...data, status: newStatus }); }
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
    { icon: "👤", label: "Guest Name", val: data.name || "—" },
    { icon: "📱", label: "Mobile", val: data.mobile || "—" },
    { icon: "📧", label: "Email", val: data.email || "—" },
    { icon: "🌐", label: "Source", val: data.source || "—" },
    { icon: "🎉", label: "Event Type", val: typeInfo.label },
    { icon: "👥", label: "No. of Guests", val: data.guests || "—" },
    { icon: "📅", label: "Date", val: data.date || "—" },
    { icon: "⏰", label: "Time", val: fmtTime(data.time) },
    ...(data.type === "birthday" ? [
      { icon: "🎂", label: "Birthday Person", val: data.birthdayPersonName || "—" },
      { icon: "🎈", label: "Age", val: data.birthdayPersonAge ? `${data.birthdayPersonAge} yrs` : "—" },
    ] : []),
    { icon: "🎨", label: "Decoration", val: decoInfo ? `${decoInfo.label} — ₹${decoInfo.price.toLocaleString()}` : "None" },
    { icon: "🍽️", label: "Event Menu", val: data.eventMenu || "—" },
    { icon: "🕐", label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">
      <div className="evt-clbd-container">

        {/* ── HEADER ── */}
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-clbd-title">Celebration Detail</h2>
            <p className="evt-clbd-id">ID: <code>{data.id}</code></p>
          </div>
          <span className={`evt-clbd-status-badge evt-clbd-status-${localStatus}`}>{localStatus}</span>
        </div>

        {/* ── HERO CARD ── */}
        <div className="evt-clbd-hero">
          <div className="evt-clbd-hero-avatar">
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="evt-clbd-hero-info">
            <div className="evt-clbd-hero-name">{data.name || "—"}</div>
            <div className="evt-clbd-hero-sub">
              {data.mobile}{data.email ? ` · ${data.email}` : ""}
            </div>
            <div className="evt-clbd-hero-meta">
              <span>{typeInfo.label}</span>
              <span>📅 {data.date || "—"}</span>
              <span>⏰ {fmtTime(data.time)}</span>
              <span>👥 {data.guests} guests</span>
              {data.source && <span>🌐 {data.source}</span>}
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-clbd-section">
          <div className="evt-clbd-section-title">Celebration Information</div>
          <div className="evt-clbd-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-clbd-info-cell">
                <span className="evt-clbd-info-icon">{row.icon}</span>
                <div>
                  <div className="evt-clbd-info-label">{row.label}</div>
                  <div className="evt-clbd-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ADD-ONS ── */}
        <div className="evt-clbd-section">
          <div className="evt-clbd-section-title">Add-on Services</div>
          <div className="evt-clbd-extras-grid">
            {EXTRAS_MAP.map(ex => (
              <div
                key={ex.key}
                className={`evt-clbd-extra-item${data[ex.key] ? " selected" : " not-selected"}`}
              >
                <span style={{ fontSize: 14, marginRight: 4 }}>{ex.icon}</span>
                <span className="evt-clbd-extra-label">{ex.label}</span>
                <span className="evt-clbd-extra-check">{data[ex.key] ? "✓" : "—"}</span>
              </div>
            ))}
          </div>

          {/* Special mention text */}
          {data.specialMention && data.specialMentionText && (
            <div className="evt-clbd-mention-box">
              <div className="evt-clbd-info-label" style={{ marginBottom: 4 }}>Special Mention Details</div>
              <p className="evt-clbd-mention-text">{data.specialMentionText}</p>
            </div>
          )}
        </div>

        {/* ── PRICING ── */}
        {(decoInfo || avPrice > 0 || data.eventMenu || totalAmount > 0) && (
          <div className="evt-clbd-section">
            <div className="evt-clbd-section-title">Decoration & Pricing</div>
            <div className="evt-clbd-pricing-card">
              {decoInfo && (
                <div className="evt-clbd-pricing-row">
                  <div className="evt-clbd-pricing-label">Decoration</div>
                  <div className="evt-clbd-pricing-val">
                    <span
                      className="evt-clbd-deco-badge"
                      style={{ background: decoInfo.bg, color: decoInfo.color }}
                    >
                      {decoInfo.label} — ₹{decoInfo.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {avPrice > 0 && (
                <div className="evt-clbd-pricing-row">
                  <div className="evt-clbd-pricing-label">Audio & Video</div>
                  <div className="evt-clbd-pricing-val">₹{avPrice.toLocaleString()}</div>
                </div>
              )}
              {data.eventMenu && (
                <div className="evt-clbd-pricing-row">
                  <div className="evt-clbd-pricing-label">Event Menu</div>
                  <div className="evt-clbd-pricing-val">
                    <span className="evt-clbd-menu-badge">{data.eventMenu}</span>
                  </div>
                </div>
              )}
              {totalAmount > 0 && (
                <div className="evt-clbd-pricing-row evt-clbd-pricing-total">
                  <div className="evt-clbd-pricing-label">
                    {data.totalAmount ? "Total Amount" : "Estimated Add-ons Total"}
                  </div>
                  <div className="evt-clbd-pricing-val">₹{totalAmount.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SPECIAL NOTES ── */}
        {data.specialNote && data.specialNote.replace(/-/g, "").trim() && (
          <div className="evt-clbd-section">
            <div className="evt-clbd-section-title">Special Notes</div>
            <div className="evt-clbd-notes-box">{data.specialNote}</div>
          </div>
        )}

        {/* ── CALL HISTORY ── */}
        {data.callHistory?.length > 0 && (
          <div className="evt-clbd-section">
            <div className="evt-clbd-section-title">Call History ({data.callHistory.length})</div>
            <div className="evt-clbd-call-history">
              {data.callHistory.map((ts, i) => (
                <div key={i} className="evt-clbd-call-history-item">
                  <span>📞</span>
                  <span>Call #{i + 1}</span>
                  <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>{fmtDateTime(ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATUS UPDATE ── */}
        <div className="evt-clbd-section">
          <div className="evt-clbd-section-title">Update Status</div>
          <div className="evt-clbd-status-row">
            {["pending", "confirmed", "completed", "cancelled"].map(s => (
              <button
                key={s}
                className={`evt-clbd-status-btn evt-clbd-sb-${s}${localStatus === s ? " active" : ""}`}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}
              >
                {saving && localStatus !== s ? "…" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── CALL CARD ── */}
        <div className="evt-clbd-reminder">
          <span className="evt-clbd-reminder-icon">📞</span>
          <div>
            <div className="evt-clbd-reminder-label">Reminder Call</div>
            <div className="evt-clbd-reminder-num">{data.mobile || "—"}</div>
          </div>
          <a
            className="evt-clbd-call-btn"
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

export default CelebrationDetails;