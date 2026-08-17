/**
 * CollapseSection.js — Sam Cafe Admin Panel
 * ---------------------------------------------------------------------
 * Shared animated wrapper for content toggled by a `header-collapse-btn`
 * (report cards, filter bars, tables, forms, info text — the pattern
 * repeats across ~38 pages). Previously every page gated this content
 * with a plain `{!xCollapsed && (...)}`, which mounts/unmounts it
 * instantly — no transition, just an abrupt cut. This renders the
 * content the whole time and animates its visible height (and a fade)
 * via CSS grid-template-rows, so collapsing/expanding is smooth
 * regardless of what's inside or how tall it is.
 *
 * Usage — replaces `{!xCollapsed && (<div className="todo-report">...)}`:
 *   <CollapseSection collapsed={xCollapsed}>
 *     <div className="todo-report">...</div>
 *   </CollapseSection>
 *
 * Content stays mounted while collapsed (just visually hidden), which
 * matches how the rest of the app already treats these sections — none
 * of them reset internal state on collapse today, so this changes
 * nothing behavior-wise, only the transition.
 */
import "./CollapseSection.css";

const CollapseSection = ({ collapsed, children, className = "" }) => (
  <div className={`collapse-section${collapsed ? " collapse-section-closed" : ""} ${className}`.trim()}>
    <div className="collapse-section-inner">{children}</div>
  </div>
);

export default CollapseSection;
