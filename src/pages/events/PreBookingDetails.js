import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api";
import "./PreBookingDetails.css";
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

/* ── Slot helpers ── */
const SLOT_GROUPS = {
  BF: { label: "Breakfast", key: "bf" },
  BR: { label: "Brunch", key: "br" },
  LU: { label: "Lunch", key: "lu" },
  HT: { label: "Hi-Tea", key: "ht" },
  DI: { label: "Dinner", key: "di" },
};

const slotFromTime = (time) => {
  if (!time) return { label: "—", key: "any" };
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 7 && h < 10) return { label: "Breakfast", key: "bf" };
  if (h >= 10 && h < 12) return { label: "Brunch", key: "br" };
  if (h >= 12 && h < 15) return { label: "Lunch", key: "lu" };
  if (h >= 15 && h < 18) return { label: "Hi-Tea", key: "ht" };
  return { label: "Dinner", key: "di" };
};

/* ── Component ── */
const PreBookingDetails = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.preBookings || []).find(b => b.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "scheduled");

  if (!data) return (
    <div className="details-container">
      <div className="evt-pbd-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-pbd-title">PreBooking Detail</h2>
          </div>
        </div>
        <div className="evt-pbd-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>PreBooking not found.</p>
        </div>
      </div>
    </div>
  );

  const subtotal = data.subtotal ?? data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ?? 0;
  const discount = data.discount ?? 0;
  const totalAmount = data.totalAmount ?? subtotal - discount;

  const slot = data.slotGroup
    ? (SLOT_GROUPS[data.slotGroup] || slotFromTime(data.time))
    : slotFromTime(data.time);

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
          preBookings: (p.preBookings || []).map(r =>
            r.id === id ? { ...r, status: newStatus } : r
          ),
        }));
      }
    } catch {
      toast.error("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { icon: "👤", label: "Guest Name", val: data.name || "—" },
    { icon: "📱", label: "Mobile", val: data.mobile || "—" },
    { icon: "📧", label: "Email", val: data.email || "—" },
    { icon: "👥", label: "No. of Guests", val: data.guests || "—" },
    { icon: "📅", label: "Date", val: data.date || "—" },
    { icon: "⏰", label: "Time", val: fmtTime(data.time) },
    { icon: "🍽️", label: "Dining Slot", val: slot.label },
    { icon: "✨", label: "Table Preference", val: data.tablePref || "—" },
    { icon: "📝", label: "Notes", val: data.notes || "—" },
    { icon: "🕐", label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">
      <div className="evt-pbd-container">

        {/* ── HEADER ── */}
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-pbd-title">PreBooking Detail</h2>
            <p className="evt-pbd-id">ID: <code>{data.id}</code></p>
          </div>
          <span className={`evt-pbd-status-badge evt-pbd-status-${localStatus}`}>{localStatus}</span>
        </div>

        {/* ── HERO CARD ── */}
        <div className="evt-pbd-hero">
          <div className="evt-pbd-hero-avatar">
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="evt-pbd-hero-info">
            <div className="evt-pbd-hero-name">{data.name || "—"}</div>
            <div className="evt-pbd-hero-sub">
              {data.mobile}{data.email ? ` · ${data.email}` : ""}
            </div>
            <div className="evt-pbd-hero-meta">
              <span>📅 {data.date || "—"}</span>
              <span>⏰ {fmtTime(data.time)}</span>
              <span className={`evt-pbd-slot-badge slot-${slot.key}`}>{slot.label}</span>
              <span>👥 {data.guests || 1} guests</span>
              {data.tablePref && <span>✨ {data.tablePref}</span>}
              {data.guests > 8 && (
                <span className="evt-pbd-group-chip">🎉 Group — 10% off</span>
              )}
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Booking Information</div>
          <div className="evt-pbd-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-pbd-info-cell">
                <span className="evt-pbd-info-icon">{row.icon}</span>
                <div>
                  <div className="evt-pbd-info-label">{row.label}</div>
                  <div className="evt-pbd-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRE-ORDERED ITEMS ── */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">
            Pre-Ordered Items ({data.items?.length || 0})
          </div>
          {data.items?.length > 0 ? (
            <table className="evt-pbd-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Size</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.selectedSize || "—"}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.unitPrice ?? (Number(item.totalPrice) / item.quantity).toFixed(0)}</td>
                    <td>₹{Number(item.totalPrice || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>No items pre-ordered.</p>
          )}
        </div>

        {/* ── BILL SUMMARY ── */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Bill Summary</div>
          <div className="evt-pbd-bill">
            <div className="evt-pbd-bill-row">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="evt-pbd-bill-row evt-pbd-bill-discount">
                <span>Group Discount (10%) — {data.guests} guests</span>
                <span>− ₹{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="evt-pbd-bill-row evt-pbd-bill-total">
              <span>Total (Advance Payment)</span>
              <strong className="evt-pbd-total-val">₹{totalAmount.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* ── CALL HISTORY ── */}
        {data.callHistory?.length > 0 && (
          <div className="evt-pbd-section">
            <div className="evt-pbd-section-title">Call History ({data.callHistory.length})</div>
            <div className="evt-pbd-call-history">
              {data.callHistory.map((ts, i) => (
                <div key={i} className="evt-pbd-call-history-item">
                  <span>📞</span>
                  <span>Call #{i + 1}</span>
                  <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>{fmtDateTime(ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATUS UPDATE ── */}
        <div className="evt-pbd-section">
          <div className="evt-pbd-section-title">Update Status</div>
          <div className="evt-pbd-status-row">
            {["scheduled", "preparing", "completed"].map(s => (
              <button
                key={s}
                className={`evt-pbd-status-btn evt-pbd-sb-${s}${localStatus === s ? " active" : ""}`}
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}
              >
                {saving && localStatus !== s ? "…" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── CALL CARD ── */}
        <div className="evt-pbd-reminder">
          <span className="evt-pbd-reminder-icon">📞</span>
          <div>
            <div className="evt-pbd-reminder-label">Reminder Call</div>
            <div className="evt-pbd-reminder-num">{data.mobile || "—"}</div>
          </div>
          <a
            className="evt-pbd-call-btn"
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

export default PreBookingDetails;