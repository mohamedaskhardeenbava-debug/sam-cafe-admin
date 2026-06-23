/**
 * CallHistory
 * ─────────────────────────────────────────────────────────────
 * Renders the "Call History" section shared by CateringDetails,
 * ReservationDetails, CelebrationDetails, and PreBookingDetails.
 *
 * USAGE
 * -----
 * import CallHistory from "../components/CallHistory";
 *
 * <CallHistory history={data.callHistory} />
 *
 * Returns null when history is empty (no render, no wrapper).
 */

import React from "react";
import { fmtDateTime } from "../utils/dateUtils";

const CallHistory = ({ history = [], sectionClassName = "evt-section" }) => {
  if (!history || history.length === 0) return null;

  return (
    <div className={sectionClassName}>
      <div className="evt-section-title">
        Call History ({history.length})
      </div>
      <div className="evt-call-history">
        {history.map((ts, i) => (
          <div key={i} className="evt-call-history-item">
            <span>📞</span>
            <span>Call #{i + 1}</span>
            <span style={{ marginLeft: "auto", color: "#a3a3a3" }}>
              {fmtDateTime(ts)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CallHistory;
