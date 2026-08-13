import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import "./Login.css";

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get("token") || "";

  const [step, setStep] = useState(urlToken ? "reset" : "request"); // "request" | "reset" | "done"
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(urlToken ? "" : "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If the reset link's token arrives after mount (e.g. slower query
  // param resolution on some routers), still land on the reset step.
  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      setStep("reset");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await api.post("/staff-auth/forgot-password", { email });
      // In production the token is emailed rather than returned to the
      // client — the dev-mode response includes it so this flow is
      // testable before an email provider (Phase-4 item 9) is wired up.
      if (res.data.token) {
        setToken(res.data.token);
        setMessage("Dev mode: reset token pre-filled below (would normally be emailed).");
      } else {
        setMessage("If that email is registered, a reset link has been sent.");
      }
      setStep("reset");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/staff-auth/reset-password", { token, newPassword });
      setStep("done");
    } catch (err) {
      setError(err.response?.data?.error || "Reset failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Forgot Password">
      {step === "request" && (
        <form className="auth-form" onSubmit={handleRequest}>
          <div className="mat">
            <input
              className="mat-input"
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="mat-label">Email<span className="rf-req">*</span></label>
            <span className="mat-bar" />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <div className="auth-submit-row">
            <Button3D type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button3D>
          </div>
        </form>
      )}

      {step === "reset" && (
        <form className="auth-form" onSubmit={handleReset}>
          {message && <p className="auth-hint">{message}</p>}

          {!urlToken && (
            <div className="mat">
              <input
                className="mat-input"
                type="text"
                placeholder=" "
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <label className="mat-label">Reset Token<span className="rf-req">*</span></label>
              <span className="mat-bar" />
            </div>
          )}

          <AuthPasswordField
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
          />

          <AuthPasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            hasError={!!error && newPassword !== confirmPassword && confirmPassword.length > 0}
          />

          {error && <p className="auth-error">{error}</p>}

          <div className="auth-submit-row">
            <Button3D type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button3D>
          </div>
        </form>
      )}

      {step === "done" && (
        <p className="auth-hint">Password updated. You can now log in with your new password.</p>
      )}

      <p className="auth-switch-hint">
        <Link to="/login">Back to login</Link>
      </p>
    </AuthShell>
  );
};

export default ForgotPassword;
