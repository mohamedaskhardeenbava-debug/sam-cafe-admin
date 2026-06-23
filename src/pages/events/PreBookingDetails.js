/**
 * PreBookingDetails.js
 * Class names unified to evt-details-* (matches CelebrationDetails)
 * Inline emoji icons removed throughout
 */
import { useParams, useNavigate } from "react-router-dom";
import "./PreBookingDetails.css";
import { fmtTime, fmtDateTime } from "../../utils/dateUtils";
import useStatusUpdate from "../../hooks/useStatusUpdate";
import HeroCard from "../../components/HeroCard";
import InfoGrid from "../../components/InfoGrid";
import CallHistory from "../../components/CallHistory";
import StatusUpdateButtons from "../../components/StatusUpdateButtons";
import ReminderCallCard from "../../components/ReminderCallCard";

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

const PreBookingDetails = ({ adminData, setAdminData }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.preBookings || []).find((b) => b.id === id);

  const { localStatus, saving, handleStatusChange } = useStatusUpdate({
    id,
    data,
    apiPath: "/preBookings",
    adminDataKey: "preBookings",
    setAdminData,
    initialStatus: data?.status || "scheduled",
  });

  if (!data)
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <h2 className="evt-details-title">PreBooking Detail</h2>
        </div>
        <p style={{ color: "#a3a3a3", fontSize: 14, padding: 16 }}>
          PreBooking not found.
        </p>
      </div>
    );

  const subtotal =
    data.subtotal ??
    data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ??
    0;
  const discount = data.discount ?? 0;
  const totalAmount = data.totalAmount ?? subtotal - discount;

  const slot = data.slotGroup
    ? SLOT_GROUPS[data.slotGroup] || slotFromTime(data.time)
    : slotFromTime(data.time);

  const infoRows = [
    { label: "Guest Name", val: data.name || "—" },
    { label: "Mobile", val: data.mobile || "—" },
    { label: "Email", val: data.email || "—" },
    { label: "No. of Guests", val: data.guests || "—" },
    { label: "Date", val: data.date || "—" },
    { label: "Time", val: fmtTime(data.time) },
    { label: "Dining Slot", val: slot.label },
    { label: "Table Preference", val: data.tablePref || "—" },
    { label: "Notes", val: data.notes || "—" },
    { label: "Created At", val: fmtDateTime(data.createdAt) },
  ];

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">PreBooking Detail</h2>
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
            data.date || "—",
            fmtTime(data.time),
            slot.label,
            `${data.guests || 1} guests`,
            data.tablePref || null,
            data.guests > 8 ? "Group — 10% off" : null,
          ].filter(Boolean)}
        />

        {/* INFO GRID */}
        <InfoGrid
          rows={infoRows}
          title="Booking Information"
          sectionClassName="evt-details-section"
        />

        {/* PRE-ORDERED ITEMS */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">
            Pre-Ordered Items ({data.items?.length || 0})
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
                {data.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.selectedSize || "—"}</td>
                    <td>{item.quantity}</td>
                    <td>
                      ₹
                      {item.unitPrice ??
                        (Number(item.totalPrice) / item.quantity).toFixed(0)}
                    </td>
                    <td>₹{Number(item.totalPrice || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>
              No items pre-ordered.
            </p>
          )}
        </div>

        {/* BILL SUMMARY */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Bill Summary</div>
          <div className="evt-details-pricing-card">
            <div className="evt-details-pricing-row">
              <span className="evt-details-pricing-label">Subtotal</span>
              <span className="evt-details-pricing-val">₹{subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="evt-details-pricing-row">
                <span className="evt-details-pricing-label">
                  Group Discount (10%) — {data.guests} guests
                </span>
                <span className="evt-details-pricing-val">− ₹{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="evt-details-pricing-row evt-details-pricing-total">
              <div className="evt-details-pricing-label">Total (Advance Payment)</div>
              <div className="evt-details-pricing-val">₹{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>

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
        </div>

        {/* REMINDER CALL */}
        <ReminderCallCard mobile={data.mobile} className="evt-details-reminder" />
      </div>
    </div>
  );
};

export default PreBookingDetails;