/**
 * StatusUpdateButtons
 * ─────────────────────────────────────────────────────────────
 * Renders the standard 4-button status-update row used in every
 * event/booking Detail page (CateringDetails, ReservationDetails,
 * CelebrationDetails, PreBookingDetails).
 *
 * USAGE
 * -----
 * import StatusUpdateButtons from "../components/StatusUpdateButtons";
 *
 * <StatusUpdateButtons
 *   currentStatus={localStatus}
 *   onUpdate={handleStatusChange}
 *   saving={saving}
 *   statuses={["pending", "confirmed", "completed", "cancelled"]}  // optional override
 * />
 */

import React from "react";

const DEFAULT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

const StatusUpdateButtons = ({
  currentStatus,
  onUpdate,
  saving = false,
  statuses = DEFAULT_STATUSES,
}) => (
  <div className="evt-status-row">
    {statuses.map((s) => (
      <button
        key={s}
        className="modal-cancel-btn"
        onClick={() => onUpdate(s)}
        disabled={saving || currentStatus === s}
      >
        <span className="shadow" />
        <span className="edge" />
        <span className="front">
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
      </button>
    ))}
  </div>
);

export default StatusUpdateButtons;
