/**
 * CollapseChevron.js — Sam Cafe Admin Panel
 * Shared collapse/expand chevron icon used in page header collapse buttons.
 * Rotates 180° when `collapsed` is true (see .header-collapse-icon.collapsed in CSS).
 */
import React from "react";

const CollapseChevron = ({ collapsed }) => (
  <svg
    className={`header-collapse-icon${collapsed ? " collapsed" : ""}`}
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default CollapseChevron;
