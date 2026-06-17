/**
 * HeroCard
 * ─────────────────────────────────────────────────────────────
 * The avatar + name + meta-chips hero card at the top of every
 * event/booking detail page.
 *
 * USAGE
 * -----
 * import HeroCard from "../components/HeroCard";
 *
 * <HeroCard
 *   name={data.name}
 *   mobile={data.mobile}
 *   email={data.email}
 *   chips={[
 *     "2026-07-01",
 *     "07:30 PM",
 *     "12 guests",
 *   ]}
 *   className="evt-catd-hero"   // optional BEM override
 * />
 */

import React from "react";

const HeroCard = ({
  name,
  mobile,
  email,
  chips = [],
  className = "evt-hero",
}) => (
  <div className={className}>
    <div className="evt-hero-avatar">
      {(name || "?").charAt(0).toUpperCase()}
    </div>
    <div className="evt-hero-info">
      <div className="evt-hero-name">{name || "—"}</div>
      <div className="evt-hero-sub">
        {mobile}
        {email ? ` · ${email}` : ""}
      </div>
      {chips.length > 0 && (
        <div className="evt-hero-meta">
          {chips.map((chip, i) => (
            <span key={i}>{chip}</span>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default HeroCard;
