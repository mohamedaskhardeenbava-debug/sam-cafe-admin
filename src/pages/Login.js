import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back!">
      <div className="auth-tabs">
        <button type="button" className="auth-tab" onClick={() => navigate("/signup")}>
          SIGN UP
        </button>
        <button type="button" className="auth-tab active">
          LOG IN
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="mat">
          <input
            className={`mat-input${error ? " auth-input-error" : ""}`}
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            required
            autoComplete="username"
          />
          <label className="mat-label">Email</label>
          <span className="mat-bar" />
        </div>

        <AuthPasswordField
          label="Password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
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
        Don't have an account? <Link to="/signup">Create one</Link>
      </p>
    </AuthShell>
  );
};

export default Login;