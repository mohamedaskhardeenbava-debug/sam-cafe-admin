/**
 * CustomDropdown
 * A single, canonical floating-label dropdown used across the entire admin panel.
 *
 * USAGE
 * -----
 * import CustomDropdown from "../components/CustomDropdown";
 *
 * <CustomDropdown
 *   label="Status"          // floating label (optional)
 *   required                // adds red asterisk (optional)
 *   value={form.status}
 *   onChange={val => setForm(p => ({ ...p, status: val }))}
 *   options={[
 *     { value: "active",   label: "Active"   },
 *     { value: "inactive", label: "Inactive" },
 *   ]}
 *   placeholder="Select status"   // shown as first "clear" item (default: "Select…")
 * />
 *
 * OPTIONS FORMAT
 * --------------
 * Accepts either:
 *   - { value, label }  objects  (preferred)
 *   - plain strings              (value === label)
 *
 * CLEARING
 * --------
 * Clicking the placeholder row calls onChange(""), clearing the selection.
 * Pass placeholder={null} to suppress the clear row entirely.
 */

/**
 * CustomDropdown
 * A single, canonical floating-label dropdown used across the entire admin panel.
 *
 * USAGE
 * -----
 * import CustomDropdown from "../components/CustomDropdown";
 *
 * <CustomDropdown
 *   label="Status"          // floating label (optional)
 *   required                // adds red asterisk (optional)
 *   value={form.status}
 *   onChange={val => setForm(p => ({ ...p, status: val }))}
 *   options={[
 *     { value: "active",   label: "Active"   },
 *     { value: "inactive", label: "Inactive" },
 *   ]}
 *   placeholder="Select status"   // shown as first "clear" item (default: "Select…")
 * />
 *
 * OPTIONS FORMAT
 * --------------
 * Accepts either:
 *   - { value, label }  objects  (preferred)
 *   - plain strings              (value === label)
 *
 * CLEARING
 * --------
 * Clicking the placeholder row calls onChange(""), clearing the selection.
 * Pass placeholder={null} to suppress the clear row entirely.
 *
 * OVERLAY BEHAVIOR
 * -----------------
 * Mirrors CustomDatePicker: the option list opens as a centered overlay
 * (dimmed backdrop + popup card) rather than an inline absolute-positioned
 * menu. Selecting an option — or clicking the clear/placeholder row —
 * closes it, same as picking a date closes the date picker. Clicking the
 * backdrop itself also dismisses it (no selection made), matching the
 * date picker's outside-click-to-cancel behavior.
 */

import React, { useRef, useState } from "react";

const CustomDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  label,
  required,
  disabled = false,
  hasError = false,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  /* Resolve display label from current value */
  const resolveOption = (v) =>
    options.find((o) => (o.value !== undefined ? o.value : o) === v);

  const selected = resolveOption(value);
  const displayLabel = selected
    ? selected.label !== undefined
      ? selected.label
      : selected
    : "";

  const wrapperCls = [
    "mat-select",
    value !== "" && value !== null && value !== undefined ? "has-value" : "",
    open ? "is-open" : "",
    hasError ? "mat-select-error" : "",
    disabled ? "mat-select-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!disabled) setOpen((p) => !p);
  };

  return (
    <div className={wrapperCls} ref={ref}>
      {label && (
        <label className={`mat-label${hasError ? " mat-label-error" : ""}`}>
          {label}
          {required && <span className="rf-req">*</span>}
        </label>
      )}

      <div className="dishes-dropdown-wrapper">
        <button
          type="button"
          className="dishes-status-dropdown"
          onClick={handleToggle}
          disabled={disabled}
        >
          {displayLabel || ""}
        </button>

        {open && (
          <div className="dishes-dropdown-overlay">
            <div className="dishes-dropdown-menu" onMouseDown={(e) => e.stopPropagation()}>
              {label && <div className="dishes-dropdown-menu-title">{label}</div>}

              <div className="dishes-dropdown-menu-options">
                {/* Clear / placeholder row */}
                {placeholder !== null && (
                  <div
                    className={`dishes-dropdown-menu-option dishes-dropdown-menu-option-placeholder${!selected ? " dishes-dropdown-menu-option-sel" : ""}`}
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    {placeholder}
                  </div>
                )}

                {options.map((o, i) => {
                  const val = o.value !== undefined ? o.value : o;
                  const lbl = o.label !== undefined ? o.label : o;
                  return (
                    <div
                      key={i}
                      className={`dishes-dropdown-menu-option${val === value ? " dishes-dropdown-menu-option-sel" : ""}`}
                      onClick={() => {
                        onChange(val);
                        setOpen(false);
                      }}
                    >
                      {lbl}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <span className={`mat-bar${hasError ? " mat-bar-error" : ""}`} />
    </div>
  );
};

export default CustomDropdown;