/**
 * ReservationDetails.js
 * Class names unified to evt-details-* (matches CelebrationDetails)
 * Inline emoji icons removed throughout
 */
import { useParams, useNavigate } from "react-router-dom";
import "./ReservationDetails.css";
import { fmtTime, fmtDateTime } from "../../utils/dateUtils";
import useStatusUpdate from "../../hooks/useStatusUpdate";
import HeroCard from "../../components/HeroCard";
import InfoGrid from "../../components/InfoGrid";
import CallHistory from "../../components/CallHistory";
import StatusUpdateButtons from "../../components/StatusUpdateButtons";
import ReminderCallCard from "../../components/ReminderCallCard";

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

const ReservationDetails = ({ adminData, setAdminData }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const data = (adminData?.reservations || []).find((r) => r.id === id);

  const { localStatus, saving, handleStatusChange } = useStatusUpdate({
    id,
    data,
    apiPath: "/reservations",
    adminDataKey: "reservations",
    setAdminData,
    initialStatus: data?.status || "pending",
  });

  if (!data)
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <h2 className="evt-details-title">Reservation Detail</h2>
        </div>
        <p style={{ color: "#a3a3a3", fontSize: 14, padding: 16 }}>
          Reservation not found.
        </p>
      </div>
    );

  const slotInfo = data.slotGroup
    ? SLOT_MAP[data.slotGroup] || slotFromTime(data.time)
    : slotFromTime(data.time);

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
      {/* HEADER */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <div>
          <h2 className="evt-details-title">Reservation Detail</h2>
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
            slotInfo ? slotInfo.label : null,
            `Table ${data.tableNo || "—"}`,
            `${data.guests || 1} guests`,
            data.tablePref || null,
            data.source || null,
          ].filter(Boolean)}
        />

        {/* INFO GRID */}
        <InfoGrid
          rows={infoRows}
          title="Reservation Information"
          sectionClassName="evt-details-section"
        />

        {/* NOTES */}
        {data.notes && (
          <div className="evt-details-section">
            <div className="evt-details-section-title">Notes / Special Requests</div>
            <div className="evt-details-notes-box">{data.notes}</div>
          </div>
        )}

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

export default ReservationDetails;