/**
 * AuthPasswordField.js — shared password input for every auth form
 * (Login, Signup, ForgotPassword, ForcePasswordReset).
 *
 * Bundles two behaviors that used to be copy-pasted / missing per-page:
 *   - an eye icon that toggles the input between type="password" and
 *     type="text" so the user can see what they typed
 *   - hasError, which switches the input's box-shadow to red (see
 *     .auth-page .mat-input.auth-input-error in Login.css) instead of
 *     relying on a separate <p className="auth-error"> block
 *
 * Keeps the existing .mat / .mat-label / .mat-bar floating-label markup
 * so it drops in wherever those password inputs used to be.
 */
import { useState } from "react";

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const AuthPasswordField = ({
  label,
  value,
  onChange,
  autoComplete = "new-password",
  minLength,
  required = true,
  hasError = false,
  statusOk = false,
  statusMismatch = false,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mat auth-password-mat">
      <input
        className={`mat-input${hasError ? " auth-input-error" : ""}`}
        type={visible ? "text" : "password"}
        placeholder=" "
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
      />
      <label className="mat-label">{label}{required && <span className="rf-req">*</span>}</label>
      <span className="mat-bar" />

      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        <EyeIcon off={visible} />
      </button>

      {statusOk && <span className="auth-field-status ok auth-field-status-pw">✓</span>}
      {statusMismatch && <span className="auth-field-status err auth-field-status-pw">✕</span>}
    </div>
  );
};

export default AuthPasswordField;