/**
 * ReminderCallCard
 * ─────────────────────────────────────────────────────────────
 * The "Reminder Call" strip rendered at the bottom of every
 * event/booking detail page.
 *
 * USAGE
 * -----
 * import ReminderCallCard from "../components/ReminderCallCard";
 *
 * <ReminderCallCard mobile={data.mobile} />
 */

import React from "react";

const ReminderCallCard = ({ mobile, className = "" }) => (
  <div className={`evt-reminder-card ${className}`.trim()}>
    <span className="evt-reminder-icon">📞</span>
    <div>
      <div className="evt-reminder-label">Reminder Call</div>
      <div className="evt-reminder-num">{mobile || "—"}</div>
    </div>
    <a
      className="modal-save-btn"
      href={mobile ? `tel:${mobile}` : undefined}
      onClick={(e) => !mobile && e.preventDefault()}
    >
      <span className="shadow" />
      <span className="edge" />
      <span className="front">Call Now</span>
    </a>
  </div>
);

export default ReminderCallCard;
