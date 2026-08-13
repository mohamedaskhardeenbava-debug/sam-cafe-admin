import React from "react";
import Button3D from "./Button3D";

/**
 * ConfirmDialog
 * --------------
 * Shared confirmation modal for destructive/confirm actions across
 * the admin panel (delete, remove, disable, etc). Replaces the old,
 * completely unstyled `.perm-confirm-overlay` / `.perm-confirm-card`
 * / `.perm-confirm-actions` classes that several pages copy-pasted —
 * this renders the same shape but with real styling from
 * `pages/Common.css` (`.confirm-overlay` / `.confirm-card` /
 * `.confirm-actions`).
 *
 * Usage:
 *   <ConfirmDialog
 *     open={!!deleteTarget}
 *     title="Delete staff account"
 *     message={<>Delete the login account for <strong>{deleteTarget?.name}</strong>? This cannot be undone.</>}
 *     confirmLabel="Delete"
 *     danger
 *     onCancel={() => setDeleteTarget(null)}
 *     onConfirm={handleDelete}
 *   />
 *
 * Props:
 *   open          – whether to render the dialog at all
 *   title         – heading text
 *   message       – body text/node
 *   confirmLabel  – confirm button label (default "Confirm")
 *   cancelLabel   – cancel button label (default "Cancel")
 *   danger        – true for destructive actions (red dot + Button3D "cancel"/default styling still applies via variant)
 *   onConfirm     – called when the confirm button is clicked
 *   onCancel      – called when the cancel button, overlay, or Escape is used
 */
const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <h4 className={danger ? "confirm-danger" : ""}>{title}</h4>
        {message && <p>{message}</p>}
        <div className="confirm-actions">
          <Button3D variant="cancel" onClick={onCancel}>
            {cancelLabel}
          </Button3D>
          <Button3D variant={danger ? "danger" : undefined} onClick={onConfirm}>
            {confirmLabel}
          </Button3D>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
