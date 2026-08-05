/**
 * ForcePasswordReset.js — shown instead of the dashboard when
 * admin.mustResetPassword is true (i.e. accounts created by the
 * staff -> admins migration with a temp password). Blocks access
 * until the staff member sets their own password.
 */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import "./Login.css";

const ForcePasswordReset = () => {
  const { admin, refreshSession, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.patch("/staff-auth/change-password", { currentPassword, newPassword });
      await refreshSession(); // pulls the updated admin (mustResetPassword now false)
    } catch (err) {
      setError(err.response?.data?.error || "Could not update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Set a New Password">
      <p className="auth-hint">
        Welcome, {admin?.name}. Your account was created with a temporary
        password — set your own before continuing.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthPasswordField
          label="Temporary Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          hasError={!!error}
        />

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

        <div className="auth-submit-row">
          <Button3D type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Password"}
          </Button3D>
        </div>
      </form>

      <p className="auth-switch-hint">
        <span className="auth-link" onClick={logout}>Log out instead</span>
      </p>
    </AuthShell>
  );
};

export default ForcePasswordReset;
