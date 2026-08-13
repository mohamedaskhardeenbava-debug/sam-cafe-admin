/**
 * useToast — Lightweight Bootstrap-style toast system
 * Zero external dependencies. Drop-in replacement for alert().
 *
 * SETUP (do once in your root):
 *   1. Wrap app with <ToastProvider> in index.js or App.js
 *   2. In any component: const { toast } = useToast();
 *      then call:  toast.success("Saved!") / toast.error("Failed") /
 *                  toast.warning("Check input") / toast.info("FYI") /
 *                  toast.confirm("Sure?", onConfirm, onCancel)  ← modal confirm-card, no timer
 *
 * toast.confirm(...) renders as a centered .confirm-card modal (the
 * same shared component/style used by <ConfirmDialog>), NOT an inline
 * corner toast — a destructive confirmation shouldn't look like a
 * transient notification or be dismissible by auto-timeout. Only one
 * confirm can be open at a time; a second call replaces the first.
 *
 * DURATIONS (item 12):
 *   Every toast (success/error/warning/info/booking) accepts an optional
 *   duration as either milliseconds or one of the named presets below.
 *   Defaults to "short" (10s) unless the call site says otherwise.
 *
 *     toast.success("Saved!")                 → 10s  (default)
 *     toast.success("Saved!", "medium")        → 30s
 *     toast.success("Saved!", "long")          → 60s
 *     toast.success("Saved!", "permanent")     → stays until the close (×)
 *                                                 button is clicked
 *     toast.success("Saved!", 5000)            → still works — raw ms
 *
 * EXPORTS:
 *   ToastProvider   — context provider (wrap root)
 *   useToast        — hook that returns { toast }
 *   ToastContainer  — no-op kept for backward compat
 */

import React, {
  createContext, useContext, useState, useCallback, useRef
} from "react";
import "./Toast.css";
import Button3D from "./components/Button3D";

/* ── Duration presets (item 12) ─────────────────────────
   Named presets map to milliseconds; "permanent" disables
   auto-dismiss entirely (only the × button / confirm action
   closes it). Anything else passed in is used as-is if it's
   a finite number, otherwise falls back to DEFAULT_DURATION. */
export const TOAST_DURATIONS = {
  short: 10000,     // 10s
  medium: 30000,    // 30s
  long: 60000,      // 60s
  permanent: Infinity,
};
const DEFAULT_DURATION = TOAST_DURATIONS.short;

const resolveDuration = (duration) => {
  if (duration === undefined || duration === null) return DEFAULT_DURATION;
  if (typeof duration === "string") return TOAST_DURATIONS[duration] ?? DEFAULT_DURATION;
  if (typeof duration === "number" && Number.isFinite(duration)) return duration;
  return DEFAULT_DURATION;
};

/* ── Context ─────────────────────────────────────────── */
const ToastCtx = createContext(null);

/* ── Icons ─────────────────────────────────────────────── */
const ICONS = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd" />
    </svg>
  ),
  booking: (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
        clipRule="evenodd" />
    </svg>
  ),
};

/* ── Single Toast ────────────────────────────────────── */
const Toast = ({
  id,
  type,
  message,
  durationMs,
  onDismiss,
  onNavigate
}) => {
  const [exiting, setExiting] = React.useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(id), 300);
  }, [id, onDismiss]);

  const isBooking = type === "booking";

  const todayDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  return (
    <div
      className={`bs-toast bs-toast-${isBooking ? "booking" : type} ${exiting ? "bs-toast-exit" : "bs-toast-enter"}`}
      role="alert"
      aria-live="assertive"
      style={isBooking ? { cursor: "pointer" } : {}}
      onClick={isBooking ? () => { dismiss(); if (onNavigate) onNavigate(todayDate); } : undefined}
    >
      {/* Left accent bar */}
      <div className="bs-toast-accent" />

      {/* Icon */}
      <div className="bs-toast-icon">{ICONS[type] || ICONS.warning}</div>

      {/* Message */}
      <div className="bs-toast-body">
        <span>{message}</span>
        {isBooking && (
          <span className="bs-toast-booking-hint">Click to view today's orders →</span>
        )}
      </div>

      {/* Close button — always shown */}
      <button className="bs-toast-close" onClick={dismiss} aria-label="Close">
        ×
      </button>

      {/* Auto-dismiss progress bar — only for non-permanent toasts */}
      {Number.isFinite(durationMs) && (
        <div className={`bs-toast-progress bs-toast-progress-${type}`}
          style={{ animationDuration: `${durationMs / 1000}s` }}
        />
      )}
    </div>
  );
};

/* ── Confirm modal — replaces the old inline bs-toast-warning
   confirm toast with the shared centered .confirm-card look used
   everywhere else in the admin panel (ConfirmDialog). ── */
const ConfirmModal = ({ message, confirmLabel = "Yes, delete", cancelLabel = "Cancel", onConfirm, onCancel, onClose }) => {
  const handleConfirm = () => {
    onClose();
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    onClose();
    if (onCancel) onCancel();
  };

  return (
    <div className="confirm-overlay" onClick={handleCancel}>
      <div className="confirm-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <h4 className="confirm-danger">Are you sure?</h4>
        <p>{message}</p>
        <div className="confirm-actions">
          <Button3D variant="cancel" onClick={handleCancel}>{cancelLabel}</Button3D>
          <Button3D variant="danger" onClick={handleConfirm}>{confirmLabel}</Button3D>
        </div>
      </div>
    </div>
  );
};

/* ── Provider ────────────────────────────────────────── */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { message, onConfirm, onCancel }
  const counter = useRef(0);

  const push = useCallback((type, message, duration, extras = {}) => {
    const id = ++counter.current;
    const durationMs = resolveDuration(duration);
    setToasts(p => [...p, { id, type, message, durationMs, ...extras }]);

    if (Number.isFinite(durationMs)) {
      setTimeout(() => {
        setToasts(p => p.filter(t => t.id !== id));
      }, durationMs + 350);
    }
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const closeConfirm = useCallback(() => setConfirmState(null), []);

  const toast = {
    success: (msg, duration) => push("success", msg, duration),
    error: (msg, duration) => push("error", msg, duration),
    warning: (msg, duration) => push("warning", msg, duration),
    info: (msg, duration) => push("info", msg, duration),
    /**
     * toast.confirm(message, onConfirm, onCancel?)
     * Shows a centered confirm-card modal with Yes/Cancel buttons —
     * same component style as ConfirmDialog. No auto-dismiss — stays
     * until the user clicks, or is replaced by a later confirm() call.
     */
    confirm: (msg, onConfirm, onCancel) =>
      setConfirmState({ message: msg, onConfirm, onCancel }),
    /**
     * toast.booking(message, onNavigate, duration = "long" / 60s)
     * Shows a booking notification toast. Clicking anywhere on the
     * toast calls onNavigate(todayDate) where todayDate is
     * "YYYY-MM-DD" — use it to pre-filter the target page.
     */
    booking: (msg, onNavigate, duration = "long") =>
      push("booking", msg, duration, { onNavigate }),
  };

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="bs-toast-container" aria-label="Notifications">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
          onClose={closeConfirm}
        />
      )}
    </ToastCtx.Provider>
  );
};

/* ── Hook ────────────────────────────────────────────── */
export const useToast = () => {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
};

/* ── Backward-compat no-op ───────────────────────────── */
export const ToastContainer = () => null;

export default useToast;
