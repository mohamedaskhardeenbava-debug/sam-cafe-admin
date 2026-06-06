/**
 * useToast — Lightweight Bootstrap-style toast system
 * Zero external dependencies. Drop-in replacement for alert().
 *
 * SETUP (do once in your root):
 *   1. Wrap app with <ToastProvider> in index.js or App.js
 *   2. In any component: const { toast } = useToast();
 *      then call:  toast.success("Saved!") / toast.error("Failed") /
 *                  toast.warning("Check input") / toast.info("FYI") /
 *                  toast.confirm("Sure?", onConfirm, onCancel)  ← no timer, has buttons
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
    confirm: (
        <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd" />
        </svg>
    ),
};

/* ── Single Toast ────────────────────────────────────── */
const Toast = ({ id, type, message, onDismiss, onConfirm, onCancel }) => {
    const [exiting, setExiting] = React.useState(false);

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => onDismiss(id), 300);
    }, [id, onDismiss]);

    const handleConfirm = () => {
        dismiss();
        if (onConfirm) onConfirm();
    };

    const handleCancel = () => {
        dismiss();
        if (onCancel) onCancel();
    };

    const isConfirm = type === "confirm";

    return (
        <div
            className={`bs-toast bs-toast-${isConfirm ? "warning" : type} ${exiting ? "bs-toast-exit" : "bs-toast-enter"}`}
            role="alert"
            aria-live="assertive"
        >
            {/* Left accent bar */}
            <div className="bs-toast-accent" />

            {/* Icon */}
            <div className="bs-toast-icon">{ICONS[type] || ICONS.warning}</div>

            {/* Message + confirm buttons */}
            <div className="bs-toast-body">
                <span>{message}</span>
                {isConfirm && (
                    <div className="bs-toast-confirm-actions">
                        <button className="bs-toast-confirm-yes" onClick={handleConfirm}>
                            Yes, delete
                        </button>
                        <button className="bs-toast-confirm-no" onClick={handleCancel}>
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Close button — hidden for confirm toasts (use the action buttons) */}
            {!isConfirm && (
                <button className="bs-toast-close" onClick={dismiss} aria-label="Close">
                    ×
                </button>
            )}

            {/* Auto-dismiss progress bar — only for non-confirm toasts */}
            {!isConfirm && (
                <div className={`bs-toast-progress bs-toast-progress-${type}`} />
            )}
        </div>
    );
};

/* ── Provider ────────────────────────────────────────── */
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);

    const push = useCallback((type, message, duration = 3500, extras = {}) => {
        const id = ++counter.current;
        setToasts(p => [...p, { id, type, message, ...extras }]);

        // Confirm toasts have no auto-dismiss
        if (type !== "confirm") {
            setTimeout(() => {
                setToasts(p => p.filter(t => t.id !== id));
            }, duration + 350);
        }
    }, []);

    const dismiss = useCallback((id) => {
        setToasts(p => p.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (msg, dur) => push("success", msg, dur),
        error: (msg, dur) => push("error", msg, dur),
        warning: (msg, dur) => push("warning", msg, dur),
        info: (msg, dur) => push("info", msg, dur),
        /**
         * toast.confirm(message, onConfirm, onCancel?)
         * Shows a persistent toast with "Yes, delete" / "Cancel" buttons.
         * No auto-dismiss — stays until the user clicks.
         */
        confirm: (msg, onConfirm, onCancel) =>
            push("confirm", msg, 0, { onConfirm, onCancel }),
    };

    return (
        <ToastCtx.Provider value={{ toast }}>
            {children}
            <div className="bs-toast-container" aria-label="Notifications">
                {toasts.map(t => (
                    <Toast key={t.id} {...t} onDismiss={dismiss} />
                ))}
            </div>
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