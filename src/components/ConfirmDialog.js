import React, { useEffect, useRef } from "react";
import Button3D from "./Button3D";
import usePopupAnimation from "../hooks/usePopupAnimation";

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
 * The card is split into three parts so every confirmation reads the
 * same way at a glance:
 *   - `.confirm-card-header` — solid red background, white text.
 *   - `.confirm-card-body`   — the message/description.
 *   - `.confirm-card-footer` — Cancel / Confirm buttons. The Confirm
 *     button is always Button3D's "danger" (red) variant — like the
 *     header, this doesn't depend on the `danger` prop, since any
 *     confirm dialog is asking the user to commit to an action and
 *     should read as "pay attention before you click" consistently,
 *     not just for the subset of callers that remember to pass
 *     `danger`.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={!!deleteTarget}
 *     title="Delete staff account"
 *     message={<>Delete the login account for <strong>{deleteTarget?.name}</strong>? This cannot be undone.</>}
 *     confirmLabel="Delete"
 *     onCancel={() => setDeleteTarget(null)}
 *     onConfirm={handleDelete}
 *   />
 *
 * Props:
 *   open          – whether to render the dialog at all
 *   title         – heading text (shown in the red header)
 *   message       – body text/node
 *   confirmLabel  – confirm button label (default "Confirm")
 *   cancelLabel   – cancel button label (default "Cancel")
 *   onConfirm     – called when the confirm button is clicked
 *   onCancel      – called when the Cancel button or Escape is used.
 *                   Clicking the backdrop (confirm-overlay) intentionally
 *                   does NOT close the dialog — a confirm/cancel choice
 *                   this consequential shouldn't be dismissable by an
 *                   accidental stray click outside the card.
 */
const ConfirmDialog = ({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  // Two call patterns exist across the app: (a) always mounted with a
  // reactive `open={!!something}` boolean, and (b) conditionally mounted
  // by the caller ({show && <ConfirmDialog open ... />}) where `open` is
  // just the literal `true` and never changes after mount. initialOpen
  // seeds the hook already-open for pattern (b) — otherwise nothing ever
  // transitions from false → true and the dialog never appears.
  const popup = usePopupAnimation({ initialOpen: !!open });
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) popup.open();
    else if (!open && wasOpenRef.current) popup.close();
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!popup.shouldRender) return null;

  // Route the Cancel button through the animated close, then call the
  // caller's onCancel once the exit animation finishes so `open` flips
  // to false right as the dialog disappears instead of yanking it away
  // mid-fade. The backdrop (confirm-overlay) deliberately has no click
  // handler — see the onCancel doc above.
  const handleCancel = () => popup.close(onCancel);
  const handleConfirm = () => popup.close(onConfirm);

  return (
    <div className={`confirm-overlay ${popup.animClass}`}>
      <div
        className={`confirm-card ${popup.animClass}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="confirm-card-header">
          <h4>{title}</h4>
        </div>
        {message && (
          <div className="confirm-card-body">
            <p>{message}</p>
          </div>
        )}
        <div className="confirm-card-footer confirm-actions">
          <Button3D variant="cancel" onClick={handleCancel}>
            {cancelLabel}
          </Button3D>
          <Button3D variant="danger" onClick={handleConfirm}>
            {confirmLabel}
          </Button3D>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
