import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api";
import "./CateringDetails.css";
import { useToast } from "../../useToast";

/* ── Helpers ── */
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

/* ── Component ── */
const CateringDetails = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.cateringOrders || []).find(i => i.id === id);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "pending");

  if (!data) return (
    <div className="details-container">
      <div className="evt-catd-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-catd-title">Catering Detail</h2>
          </div>
        </div>
        <div className="evt-catd-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Catering order not found.</p>
        </div>
      </div>
    </div>
  );

  const subtotal = data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ?? 0;
  const totalAmount = data.totalAmount ?? subtotal;

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      try { await api.patch(`/cateringOrders/${id}`, { status: newStatus }); }
      catch { await api.put(`/cateringOrders/${id}`, { ...data, status: newStatus }); }
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          cateringOrders: (p.cateringOrders || []).map(o =>
            o.id === id ? { ...o, status: newStatus } : o
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
    { icon: "👤", label: "Customer Name", val: data.name || "—" },
    { icon: "📱", label: "Mobile", val: data.mobile || "—" },
    { icon: "📧", label: "Email", val: data.email || "—" },
    { icon: "📅", label: "Event Date", val: data.eventDate || data.date || "—" },
    { icon: "👥", label: "Guests", val: data.guests || "—" },
    { icon: "📍", label: "Location", val: data.location || data.address || "—" },
    { icon: "🕐", label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">


      {/* ── HEADER ── */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-catd-title">Catering Detail</h2>
          <p className="evt-catd-id">ID: <code>{data.id}</code></p>
        </div>
        <span className={`evt-catd-status-badge evt-catd-status-${localStatus}`}>{localStatus}</span>
      </div>

      <div className="details-body">
        {/* ── HERO CARD ── */}
        <div className="evt-catd-hero">
          <div className="evt-catd-hero-avatar">
            {(data.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="evt-catd-hero-info">
            <div className="evt-catd-hero-name">{data.name || "—"}</div>
            <div className="evt-catd-hero-sub">
              {data.mobile}{data.email ? ` · ${data.email}` : ""}
            </div>
            <div className="evt-catd-hero-meta">
              <span>📅 {data.eventDate || data.date || "—"}</span>
              <span>👥 {data.guests || "—"} guests</span>
              {(data.location || data.address) && (
                <span>📍 {data.location || data.address}</span>
              )}
              <span>🍽️ {data.items?.length || 0} items</span>
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">Customer Information</div>
          <div className="evt-catd-info-grid">
            {infoRows.map((row, i) => (
              <div key={i} className="evt-catd-info-cell">
                <span className="evt-catd-info-icon">{row.icon}</span>
                <div>
                  <div className="evt-catd-info-label">{row.label}</div>
                  <div className="evt-catd-info-val">{row.val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── NOTES ── */}
        {data.notes && (
          <div className="evt-catd-section">
            <div className="evt-catd-section-title">Notes</div>
            <div className="evt-catd-notes-box">{data.notes}</div>
          </div>
        )}

        {/* ── ORDERED ITEMS ── */}
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">
            Ordered Items ({data.items?.length || 0})
          </div>
          {data.items?.length > 0 ? (
            <table className="evt-catd-items-table">
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
                {data.items.map((item, index) => {
                  const total = Number(item.totalPrice || 0);
                  const unit = item.unitPrice ?? (item.quantity ? (total / item.quantity).toFixed(0) : total);
                  return (
                    <tr key={index}>
                      <td>{item.name}</td>
                      <td>{item.selectedSize || "—"}</td>
                      <td>{item.quantity}</td>
                      <td>₹{unit}</td>
                      <td>₹{total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>No items added.</p>
          )}
        </div>

        {/* ── BILL SUMMARY ── */}
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">Bill Summary</div>
          <div className="evt-catd-bill">
            {subtotal !== totalAmount && (
              <div className="evt-catd-bill-row">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
            )}
            <div className="evt-catd-bill-row evt-catd-bill-total">
              <span>Total Amount</span>
              <strong className="evt-catd-total-val">₹{totalAmount.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* ── CALL HISTORY ── */}
        {data.callHistory?.length > 0 && (
          <div className="evt-catd-section">
            <div className="evt-catd-section-title">Call History ({data.callHistory.length})</div>
            <div className="evt-catd-call-history">
              {data.callHistory.map((ts, i) => (
                <div key={i} className="evt-catd-call-history-item">
                  <span>📞</span>
                  <span>Call #{i + 1}</span>
                  <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>{fmtDateTime(ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATUS UPDATE ── */}
        <div className="evt-catd-section">
          <div className="evt-catd-section-title">Update Status</div>
          <div className="evt-catd-status-row">
            {["pending", "confirmed", "completed", "cancelled"].map(s => (
              <button
                key={s}
                className="modal-cancel-btn"
                onClick={() => handleStatusChange(s)}
                disabled={saving || localStatus === s}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">
                  {saving && localStatus !== s ? "…" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── CALL CARD ── */}
        <div className="evt-catd-reminder">
          <span className="evt-catd-reminder-icon">📞</span>
          <div>
            <div className="evt-catd-reminder-label">Reminder Call</div>
            <div className="evt-catd-reminder-num">{data.mobile || "—"}</div>
          </div>
          <a
            className="modal-save-btn"
            href={data.mobile ? `tel:${data.mobile}` : undefined}
            onClick={e => !data.mobile && e.preventDefault()}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">
              Call Now
            </span>
          </a>
        </div>

      </div>
    </div>
  );
};

export default CateringDetails;