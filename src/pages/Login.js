import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import { allowTextInput } from "../App";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const { login, sessionExpired } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Mirrors AuthContext's sessionExpired, but can be locally dismissed —
  // otherwise, once a session genuinely expires, this message would keep
  // showing (masking the real error) on every subsequent login attempt,
  // including a wrong-password retry, until a login actually succeeds.
  const [showSessionExpired, setShowSessionExpired] = useState(sessionExpired);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowSessionExpired(false);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.error || "Invalid email or password");
      } else if (err.request) {
        // Request went out but no response came back — server unreachable,
        // CORS rejection, or a network drop. This is a fundamentally
        // different failure than wrong credentials, and showing "Invalid
        // email or password" for it would send someone down the wrong
        // path entirely (re-checking a password that was never the issue).
        setError("Can't reach the server. Check your connection and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back!">
      <form className="auth-form" onSubmit={handleSubmit}>
        {(error || showSessionExpired) && (
          <p className="auth-error">
            {error || "Your session has expired. Please log in again."}
          </p>
        )}
        <div className="mat">
          <input
            className={`mat-input${error ? " auth-input-error" : ""}`}
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => { setEmail(allowTextInput(email, e.target.value, 100, 5)); setError(""); }}
            required
            autoComplete="username"
          />
          <label className="mat-label">Email<span className="rf-req">*</span></label>
          <span className="mat-bar" />
        </div>

        <AuthPasswordField
          label="Password"
          value={password}
          onChange={(e) => { setPassword(allowTextInput(password, e.target.value, 100, 5)); setError(""); }}
          autoComplete="current-password"
          hasError={!!error}
        />

        <Link className="auth-forgot" to="/forgot-password">Forgot Password?</Link>

        <div className="auth-submit-row">
          <Button3D type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log In"}
          </Button3D>
        </div>
      </form>

      <p className="auth-switch-hint">
        Staff accounts are created by your manager or Super Admin. Contact them if you need access.
      </p>
    </AuthShell>
  );
};

export default Login;