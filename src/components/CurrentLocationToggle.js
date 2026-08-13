import React from "react";

/**
 * CurrentLocationToggle
 * -----------------------
 * "Use current location" Yes/No control, replacing the old single
 * "Use restaurant location" button. Reuses the dish-switch-btn /
 * dish-switch-group visual pattern already used for Veg/Non-Veg and
 * Event/Combo toggles elsewhere in the admin panel, so it needs no
 * new CSS.
 *
 * Behavior (per requirement):
 *   - Defaults to "Yes" (handled by the caller's initial state)
 *   - Yes  → address fields are hidden; venue is set to the resolved
 *            venue address (super admin's selected venue, or the
 *            logged-in staff's own venue)
 *   - No   → address fields appear for manual entry
 *
 * Props:
 *   value      – boolean, true = "Yes" (use current location)
 *   onChange   – (nextValue: boolean) => void
 */
const CurrentLocationToggle = ({ value, onChange, label = "Use current location" }) => (
  <div className="admin-form-group">
    <label>{label}</label>
    <div className="dish-switch-group">
      <button
        type="button"
        className={`dish-switch-btn${value ? " is-active" : ""}`}
        onClick={() => onChange(true)}
      >
        Yes
      </button>
      <button
        type="button"
        className={`dish-switch-btn${!value ? " is-active" : ""}`}
        onClick={() => onChange(false)}
      >
        No
      </button>
    </div>
  </div>
);

export default CurrentLocationToggle;
