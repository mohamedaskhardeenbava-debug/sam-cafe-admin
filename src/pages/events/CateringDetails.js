<<<<<<< HEAD
/**
 * CateringDetails.js
 * Class names unified to evt-details-* (matches CelebrationDetails)
 * Inline emoji icons removed throughout
 */
=======
/* admin panel */
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
import { useParams, useNavigate } from "react-router-dom";
import "./CateringDetails.css";
<<<<<<< HEAD
import { fmtDateTime } from "../../utils/dateUtils";
import useStatusUpdate from "../../hooks/useStatusUpdate";
import HeroCard from "../../components/HeroCard";
import InfoGrid from "../../components/InfoGrid";
import CallHistory from "../../components/CallHistory";
import StatusUpdateButtons from "../../components/StatusUpdateButtons";
import ReminderCallCard from "../../components/ReminderCallCard";

=======
import { useToast } from "../../useToast";
import { fmtDateTime } from "../../utils/dateUtils";

/* ── Component ── */
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
const CateringDetails = ({ adminData, setAdminData }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.cateringOrders || []).find((i) => i.id === id);
<<<<<<< HEAD

  const { localStatus, saving, handleStatusChange } = useStatusUpdate({
    id,
    data,
    apiPath: "/cateringOrders",
    adminDataKey: "cateringOrders",
    setAdminData,
    initialStatus: data?.status || "pending",
  });

  if (!data)
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <h2 className="evt-details-title">Catering Detail</h2>
=======
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState(data?.status || "pending");

  if (!data) return (
    <div className="details-container">
      <div className="evt-details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <div>
            <h2 className="evt-details-title">Catering Detail</h2>
          </div>
        </div>
        <div className="evt-details-section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Catering order not found.</p>
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
        </div>
        <p style={{ color: "#a3a3a3", fontSize: 14, padding: 16 }}>
          Catering order not found.
        </p>
      </div>
    );

  const subtotal =
    data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ?? 0;
  const totalAmount = data.totalAmount ?? subtotal;

<<<<<<< HEAD
=======
  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.patch(`/cateringOrders/${id}`, { status: newStatus });
      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          cateringOrders: (p.cateringOrders || []).map(c =>
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

>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
  const infoRows = [
    { label: "Customer Name", val: data.name || "—" },
    { label: "Mobile", val: data.mobile || "—" },
    { label: "Email", val: data.email || "—" },
    { label: "Event Date", val: data.eventDate || data.date || "—" },
    { label: "Guests", val: data.guests || "—" },
    { label: "Location", val: data.location || data.address || "—" },
    { label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">
<<<<<<< HEAD
      {/* HEADER */}
=======

      {/* ── HEADER ── */}
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">Catering Detail</h2>
<<<<<<< HEAD
          <p className="evt-details-id">
            ID: <code>{data.id}</code>
          </p>
        </div>
        <span className={`evt-details-status-badge evt-details-status-${localStatus}`}>
          {localStatus}
        </span>
      </div>

      <div className="details-body">
        {/* HERO */}
        <HeroCard
          className="evt-details-hero"
          name={data.name}
          mobile={data.mobile}
          email={data.email}
          chips={[
            data.eventDate || data.date || "—",
            `${data.guests || "—"} guests`,
            data.location || data.address || null,
            `${data.items?.length || 0} items`,
          ].filter(Boolean)}
        />

        {/* INFO GRID */}
        <InfoGrid
          rows={infoRows}
          title="Customer Information"
          sectionClassName="evt-details-section"
        />
=======
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
              <span>{data.eventDate || data.date || "—"}</span>
              <span>{data.guests || "—"} guests</span>
              {(data.location || data.address) && <span>{data.location || data.address}</span>}
              <span>{data.items?.length || 0} items</span>
            </div>
          </div>
        </div>

        {/* ── INFO GRID ── */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Customer Information</div>
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
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7

        {/* NOTES */}
        {data.notes && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Notes</div>
            <div className="evt-details-notes-box">{data.notes}</div>
          </div>
        )}

<<<<<<< HEAD
        {/* ORDERED ITEMS */}
=======
        {/* ── ORDERED ITEMS ── */}
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
        <div className="evt-details-section">
          <div className="evt-details-section-title">
            Ordered Items ({data.items?.length || 0})
          </div>
          {data.items?.length > 0 ? (
            <table className="evt-details-items-table">
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
                  const unit =
                    item.unitPrice ??
                    (item.quantity ? (total / item.quantity).toFixed(0) : total);
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
            <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>
              No items added.
            </p>
          )}
        </div>

<<<<<<< HEAD
        {/* BILL SUMMARY */}
=======
        {/* ── BILL SUMMARY ── */}
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
        <div className="evt-details-section">
          <div className="evt-details-section-title">Bill Summary</div>
          <div className="evt-details-pricing-card">
            {subtotal !== totalAmount && (
              <div className="evt-details-pricing-row">
<<<<<<< HEAD
                <span className="evt-details-pricing-label">Subtotal</span>
                <span className="evt-details-pricing-val">₹{subtotal.toLocaleString()}</span>
=======
                <div className="evt-details-pricing-label">Subtotal</div>
                <div className="evt-details-pricing-val">₹{subtotal.toLocaleString()}</div>
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
              </div>
            )}
            <div className="evt-details-pricing-row evt-details-pricing-total">
              <div className="evt-details-pricing-label">Total Amount</div>
              <div className="evt-details-pricing-val">₹{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>

<<<<<<< HEAD
        {/* CALL HISTORY */}
        <CallHistory
          history={data.callHistory}
          sectionClassName="evt-details-section"
        />

        {/* STATUS UPDATE */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Update Status</div>
          <StatusUpdateButtons
            currentStatus={localStatus}
            onUpdate={handleStatusChange}
            saving={saving}
          />
=======
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
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
        </div>

        {/* REMINDER CALL */}
        <ReminderCallCard mobile={data.mobile} className="evt-details-reminder" />
      </div>
    </div>
  );
};

export default CateringDetails;