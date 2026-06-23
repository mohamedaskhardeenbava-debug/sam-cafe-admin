/**
 * CateringDetails.js
 * Class names unified to evt-details-* (matches CelebrationDetails)
 * Inline emoji icons removed throughout
 */
import { useParams, useNavigate } from "react-router-dom";
import "./CateringDetails.css";
import { fmtDateTime } from "../../utils/dateUtils";
import useStatusUpdate from "../../hooks/useStatusUpdate";
import HeroCard from "../../components/HeroCard";
import InfoGrid from "../../components/InfoGrid";
import CallHistory from "../../components/CallHistory";
import StatusUpdateButtons from "../../components/StatusUpdateButtons";
import ReminderCallCard from "../../components/ReminderCallCard";

const CateringDetails = ({ adminData, setAdminData }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.cateringOrders || []).find((i) => i.id === id);

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
        </div>
        <p style={{ color: "#a3a3a3", fontSize: 14, padding: 16 }}>
          Catering order not found.
        </p>
      </div>
    );

  const subtotal =
    data.items?.reduce((s, i) => s + Number(i.totalPrice || 0), 0) ?? 0;
  const totalAmount = data.totalAmount ?? subtotal;

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
      {/* HEADER */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">Catering Detail</h2>
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

        {/* NOTES */}
        {data.notes && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Notes</div>
            <div className="evt-details-notes-box">{data.notes}</div>
          </div>
        )}

        {/* ORDERED ITEMS */}
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

        {/* BILL SUMMARY */}
        <div className="evt-details-section">
          <div className="evt-details-section-title">Bill Summary</div>
          <div className="evt-details-pricing-card">
            {subtotal !== totalAmount && (
              <div className="evt-details-pricing-row">
                <span className="evt-details-pricing-label">Subtotal</span>
                <span className="evt-details-pricing-val">₹{subtotal.toLocaleString()}</span>
              </div>
            )}
            <div className="evt-details-pricing-row evt-details-pricing-total">
              <div className="evt-details-pricing-label">Total Amount</div>
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

export default CateringDetails;