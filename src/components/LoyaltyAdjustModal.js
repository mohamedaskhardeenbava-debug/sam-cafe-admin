/**
 * LoyaltyAdjustModal.js  —  Sam Cafe Admin Panel
 *
 * "Manually adjust points" — lets staff comp points (bad experience) or
 * remove points (cancelled/fraudulent order) for a guest, independent of
 * the automatic order-derived formula. A reason is required so the
 * adjustment is self-documenting in the guest's loyalty history.
 */

import React, { useState } from "react";

import Button3D from "./Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../useToast";
import api from "../api";
import { addManualAdjustment, syncManualAdjustment } from "../utils/loyaltyAdjustmentsStore";

const MODAL_ID = "loyaltyAdjust";

/** Call modal.open() from the parent (via the returned `open` helper) to
 *  show this for a given user. Parent supplies `user` and `onAdjusted`
 *  (called after a successful save so it can re-render loyalty stats). */
export default function LoyaltyAdjustModal({ user, onAdjusted }) {
  const modal = useAnimatedModal(MODAL_ID);
  const { admin } = useAuth();
  const { toast } = useToast();

  const [direction, setDirection] = useState("comp"); // "comp" | "remove"
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!modal.shouldRender || !user) return null;

  const resetForm = () => {
    setDirection("comp");
    setAmount("");
    setReason("");
  };

  const handleClose = () => {
    modal.close(resetForm);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.warning("Enter a point amount greater than 0");
      return;
    }
    if (!reason.trim()) {
      toast.warning("A reason is required so this shows up in the guest's history");
      return;
    }

    setSaving(true);
    const signedPoints = direction === "comp" ? n : -n;
    const entry = addManualAdjustment(user.id, signedPoints, reason.trim(), admin?.name);
    await syncManualAdjustment(api, user.id, entry); // best-effort; local store already updated
    setSaving(false);

    toast.success(direction === "comp" ? `Comped ${n} points` : `Removed ${n} points`);
    onAdjusted?.();
    modal.close(resetForm);
  };

  return (
    <div className={`modal-overlay ${modal.overlayClass}`} onClick={handleClose}>
      <form
        className={`admin-modal ${modal.modalClass}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
      >
        <div className="admin-modal-header">
          <h3>Adjust Points — {user.name}</h3>
        </div>

        <div className="admin-modal-body">
          <div className="filter-group" style={{ marginBottom: 14 }}>
            <button
              type="button"
              className={`filter-pill${direction === "comp" ? " active" : ""}`}
              onClick={() => setDirection("comp")}
            >
              + Comp Points
            </button>
            <button
              type="button"
              className={`filter-pill${direction === "remove" ? " active" : ""}`}
              onClick={() => setDirection("remove")}
            >
              − Remove Points
            </button>
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className="mat-input"
                type="number"
                min="1"
                placeholder=" "
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <label className="mat-label">Points<span className="rf-req">*</span></label>
              <span className="mat-bar" />
            </div>
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className="mat-input"
                placeholder=" "
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={150}
              />
              <label className="mat-label">
                Reason (e.g. "Comped for delayed order")<span className="rf-req">*</span>
              </label>
              <span className="mat-bar" />
            </div>
          </div>
        </div>

        <div className="admin-modal-footer">
          <Button3D variant="cancel" type="button" onClick={handleClose}>Cancel</Button3D>
          <Button3D type="submit" disabled={saving}>
            {saving ? "Saving…" : direction === "comp" ? "Comp Points" : "Remove Points"}
          </Button3D>
        </div>
      </form>
    </div>
  );
}

export { MODAL_ID as LOYALTY_ADJUST_MODAL_ID };
