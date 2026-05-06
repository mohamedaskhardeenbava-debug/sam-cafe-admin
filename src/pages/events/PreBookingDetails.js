import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api";
import "./PreBookingDetails.css";
import { useToast } from "../../useToast";

const pad = (n) => String(n).padStart(2, "0");

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad(m)} ${ap}`;
};

const SLOT_LABEL = (time) => {
  if (!time) return "—";
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 7 && h < 10) return "Breakfast";
  if (h >= 10 && h < 12) return "Brunch";
  if (h >= 12 && h < 15) return "Lunch";
  if (h >= 15 && h < 18) return "Hi-Tea";
  return "Dinner";
};

const SLOT_KEY = (time) => {
  if (!time) return "any";
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 7 && h < 10) return "bf";
  if (h >= 10 && h < 12) return "br";
  if (h >= 12 && h < 15) return "lu";
  if (h >= 15 && h < 18) return "ht";
  return "di";
};

/* ══════════════════════════════════════════════
   Component
══════════════════════════════════════════════ */
const PreBookingDetails = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.preBookings || []).find(b => b.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "scheduled");

  if (!data) return (
    <div className="evt-pbd-page">
      <div className="evt-pbd-container">
        <button className="evt-pbd-back-btn" onClick={() => navigate(-1)} />
        <p style={{ color: "#888", marginTop: 20 }}>PreBooking not found.</p>
      </div>
    </div>
  );

  const subtotal = data.subtotal ?? data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ?? 0;
  const discount = data.discount ?? 0;
  const totalAmount = data.totalAmount ?? subtotal - discount;

  /* ── Status update ── */
  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      try { await api.patch(`/preBookings/${id}`, { status: newStatus }); }
      catch { await api.put(`/preBookings/${id}`, { ...data, status: newStatus }); }
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          preBookings: (p.preBookings || []).map(r => r.id === id ? { ...r, status: newStatus } : r),
        }));
      }
    } catch {
      toast.error("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const slotLabel = data.slotGroup
    ? ({ BF: "Breakfast", BR: "Brunch", LU: "Lunch", HT: "Hi-Tea", DI: "Dinner" }[data.slotGroup] || SLOT_LABEL(data.time))
    : SLOT_LABEL(data.time);

  const slotKey = data.slotGroup?.toLowerCase() || SLOT_KEY(data.time);

  const infoRows = [
    { icon: "👤", label: "Guest Name", val: data.name || "—" },
    { icon: "📱", label: "Mobile", val: data.mobile || "—" },
    { icon: "📧", label: "Email", val: data.email || "—" },
    { icon: "👥", label: "Guests", val: data.guests || "—" },
    { icon: "📅", label: "Date", val: data.date || "—" },
    { icon: "⏰", label: "Time", val: fmtTime(data.time) },
    { icon: "🍽️", label: "Dining Slot", val: slotLabel },
    { icon: "📝", label: "Notes", val: data.notes || "—" },
  ];

  return (
    <div className="evt-pbd-page">
      <div className="evt-pbd-container">

        {/* HEADER */}
        <div className="evt-pbd-header">
          <button className="evt-pbd-back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-pbd-title">PreBooking Detail</h2>
            <p className="evt-pbd-id">ID: <code>{data.id}</code></p>
          </div>
          <span className={`evt-pbd-status-badge evt-pbd-status-${localStatus}`}>{localStatus}</span>
        </div>

        {/* HERO CARD */}
        <div className="evt-pbd-hero">
          <div className="evt-pbd-hero-avatar">{(data.name || "?").charAt(0).toUpperCase()}</div>
          <div className="evt-pbd-hero-info">
            <div className="evt-pbd-hero-name">{data.name || "—"}</div>
            <div className="evt-pbd-hero-sub">{data.mobile}{data.email ? ` · ${data.email}` : ""}</div>
            <div className="evt-pbd-hero-meta">
              <span>{data.date}</span>
              <span>{fmtTime(data.time)}</span>
              <span className={`evt-pbd-slot-badge slot-${slotKey}`}>{slotLabel}</span>
              <span>{data.guests || 1} guests</span>
              {data.tablePref && <span>🪑 {data.tablePref}</span>}
              {data.guests > 8 && <span className="evt-pbd-group-chip">🎉 Group — 10% off</span>}
            </div>
          </div>
        </div>

        {/* INFO GRID */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Booking Information</div>
          <div className="evt-pbd-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-pbd-info-cell">
                <div className="evt-pbd-info-icon">{row.icon}</div>
                <div>
                  <div className="evt-pbd-info-label">{row.label}</div>
                  <div className="evt-pbd-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PRE-ORDERED ITEMS */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Pre-Ordered Items</div>
          {data.items?.length > 0 ? (
            <table className="evt-pbd-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Size</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => {
                  const price = Number(item.totalPrice || 0);
                  return (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.selectedSize || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>₹{price}</td>
                      <td>₹{price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "#888", fontSize: 14 }}>No items pre-ordered.</p>
          )}
        </div>

        {/* BILL SUMMARY */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Bill Summary</div>
          <div className="evt-pbd-bill">
            <div className="evt-pbd-bill-row">
              <span>Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="evt-pbd-bill-row evt-pbd-bill-discount">
                <span>Group Discount (10%) — {data.guests} guests</span>
                <span>− ₹{discount}</span>
              </div>
            )}
            <div className="evt-pbd-bill-row evt-pbd-bill-total">
              <span>Total (Advance Payment)</span>
              <strong className="evt-pbd-total-val">₹{totalAmount}</strong>
            </div>
          </div>
        </div>

        {/* STATUS UPDATE */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Update Status</div>
          <div className="evt-pbd-status-row">
            {["scheduled", "preparing", "completed"].map(s => (
              <button key={s}
                className={`evt-pbd-status-btn evt-pbd-sb-${s}${localStatus === s ? " active" : ""}`}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}>
                {saving && localStatus !== s ? "..." : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* REMINDER CALL */}
        <div className="evt-pbd-reminder">
          <div className="evt-pbd-reminder-icon">📞</div>
          <div>
            <div className="evt-pbd-reminder-label">Reminder Call</div>
            <div className="evt-pbd-reminder-num">{data.mobile || "—"}</div>
          </div>
          <div className="evt-pbd-call-btn" onClick={e => e.stopPropagation()}>
            Call Now
          </div>
        </div>

      </div>
    </div>
  );
};

export default PreBookingDetails;