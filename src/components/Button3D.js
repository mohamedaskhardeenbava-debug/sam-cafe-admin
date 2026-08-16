/**
 * Button3D.jsx  —  Sam Cafe Admin Panel
 *
 * Reusable 3-D push-button that renders the canonical
 *   <button>
 *     <span className="shadow" />
 *     <span className="edge" />
 *     <span className="front [close-padding]">…</span>
 *   </button>
 * pattern used everywhere in the admin panel.
 *
 * All CSS lives in App.css under .modal-save-btn / .modal-cancel-btn /
 * .modal-danger-btn — this component just wires the props to those classes.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * USAGE
 *
 *   import Button3D from "../../components/Button3D";
 *
 *   // Primary / green (save, add, export)
 *   <Button3D onClick={handleSave}>Save</Button3D>
 *   <Button3D onClick={handleAdd}>+ Add Ingredient</Button3D>
 *
 *   // Secondary / neutral (cancel, close, navigate)
 *   <Button3D variant="cancel" onClick={closeModal}>Cancel</Button3D>
 *
 *   // Danger / red (delete, remove)
 *   <Button3D variant="danger" onClick={() => handleDelete(id)}>Delete</Button3D>
 *
 *   // Icon-only  (edit / delete / close icons in table rows)
 *   <Button3D variant="cancel" icon iconOnly title="Edit" onClick={…}>
 *     <img src={editIcon} alt="" />
 *   </Button3D>
 *
 *   // Disabled / loading
 *   <Button3D disabled={saving}>
 *     {saving ? "Saving…" : "Save"}
 *   </Button3D>
 *
 *   // Custom style override
 *   <Button3D style={{ padding: "8px 10px" }} onClick={handlePickup}>
 *     Order Pickup
 *   </Button3D>
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Props
 * ─────
 * @prop {"save"|"cancel"|"danger"}  [variant="save"]
 *   Controls the CSS class:
 *     "save"   → modal-save-btn    (primary green)
 *     "cancel" → modal-cancel-btn  (neutral / secondary)
 *     "danger" → modal-danger-btn  (red / destructive)
 *
 * @prop {boolean}  [iconOnly=false]
 *   When true the .front span gets the close-padding class so the icon
 *   is centred correctly (matches the pattern in table action columns).
 *
 * @prop {string}   [type="button"]
 *   Prevents accidental form submission. Pass "submit" if you need it.
 *
 * @prop {boolean}  [disabled=false]
 *
 * @prop {string}   [className=""]
 *   Extra class(es) appended to the button element.
 *
 * @prop {object}   [style]
 *   Inline styles applied to the button element.
 *
 * @prop {string}   [title]
 *   Tooltip / aria-label. Rendered as a Bootstrap tooltip via
 *   data-bs-toggle="tooltip" (see the `tooltipPlacement` prop below),
 *   not a plain browser title attribute.
 *
 * @prop {"top"|"right"|"bottom"|"left"} [tooltipPlacement="top"]
 *   Bootstrap tooltip placement, only used when `title` is set.
 *
 * @prop {function} [onClick]
 *
 * @prop {ReactNode} children
 *   Button label, text, icon element, or dynamic JSX.
 */

import React from "react";

const VARIANT_CLASS = {
  save: "modal-save-btn",
  cancel: "modal-cancel-btn",
  danger: "modal-danger-btn",
};

export default function Button3D({
  variant = "save",
  iconOnly = false,
  type = "button",
  disabled = false,
  className = "",
  style,
  title,
  tooltipPlacement = "top",
  onClick,
  children,
}) {
  const baseClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.save;
  const frontClass = iconOnly ? "front close-padding" : "front";
  const fullClass = [baseClass, className].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={fullClass}
      style={style}
      disabled={disabled}
      onClick={onClick}
      {...(title
        ? { "data-bs-toggle": "tooltip", "data-bs-placement": tooltipPlacement, "data-bs-title": title }
        : {})}
    >
      <span className="shadow" />
      <span className="edge" />
      <span className={frontClass}>{children}</span>
    </button>
  );
}
