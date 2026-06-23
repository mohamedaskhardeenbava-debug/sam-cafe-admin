/**
 * InfoGrid
 * ─────────────────────────────────────────────────────────────
 * Renders the "icon + label + value" info-grid used in every
 * event/booking detail page.
 *
 * USAGE
 * -----
 * import InfoGrid from "../components/InfoGrid";
 *
 * const rows = [
 *   { icon: "👤", label: "Guest Name", val: data.name || "—" },
 *   { icon: "📱", label: "Mobile",     val: data.mobile || "—" },
 * ];
 *
 * <InfoGrid rows={rows} title="Customer Information" />
 */

import React from "react";

const InfoGrid = ({ rows = [], title, sectionClassName = "evt-section" }) => (
  <div className={sectionClassName}>
    {title && <div className="evt-section-title">{title}</div>}
    <div className="evt-info-grid">
      {rows.map((row, i) => (
        <div key={i} className="evt-info-cell">
          <span className="evt-info-icon">{row.icon}</span>
          <div>
            <div className="evt-info-label">{row.label}</div>
            <div className="evt-info-val">{row.val}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default InfoGrid;
