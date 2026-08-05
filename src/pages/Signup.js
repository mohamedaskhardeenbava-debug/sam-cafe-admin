import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, ROLE_TREE } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import AuthPasswordField from "./AuthPasswordField";
import AuthShell from "./AuthShell";
import api from "../api";
import { allowTextInput } from "../App";
import "./Login.css";

const Signup = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleGroup, setRoleGroup] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [venueId, setVenueId] = useState("");
  const [venues, setVenues] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const roleTitleOptions = roleGroup ? ROLE_TREE[roleGroup] : [];
  // Every role except Super Admin belongs to exactly one venue (branch).
  const needsVenue = roleGroup && roleGroup !== "Super Admin";
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    api
      .get("/venues/public")
      .then((res) => setVenues(res.data || []))
      .catch(() => setVenues([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!roleGroup || !roleTitle) {
      setError("Please select your role");
      return;
    }
    if (needsVenue && !venueId) {
      setError("Please select your branch");
      return;
    }
    if (!agreed) {
      setError("Please agree to the terms to continue");
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({
        name,
        email,
        password,
        roleGroup,
        roleTitle,
        ...(needsVenue ? { venueId } : {}),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Could not create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome to Dishky!">
      <div className="auth-tabs">
        <button type="button" className="auth-tab active">
          SIGN UP
        </button>
        <button type="button" className="auth-tab" onClick={() => navigate("/login")}>
          LOG IN
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="mat">
          <input
            className="mat-input"
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <label className="mat-label">Email (Login)</label>
          <span className="mat-bar" />
          {email.length > 0 && <span className="auth-field-status ok">✓</span>}
        </div>

        <AuthPasswordField
          label="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          hasError={!!error && password.length < 6}
          statusOk={password.length >= 6}
        />

        <div className="auth-field-row">
          <div className="mat">
            <input
              className="mat-input"
              type="text"
              placeholder=" "
              value={name}
              onChange={(e) => setName(allowTextInput(name, e.target.value, 100, 5))}
              required
            />
            <label className="mat-label">First Name</label>
            <span className="mat-bar" />
          </div>

          <AuthPasswordField
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            hasError={passwordsMismatch}
            statusOk={passwordsMatch}
          />
        </div>

        <div className="auth-field-row">
          <CustomDropdown
            label="Role Group"
            required
            value={roleGroup}
            onChange={(val) => { setRoleGroup(val); setRoleTitle(""); }}
            options={Object.keys(ROLE_TREE).map((g) => ({ value: g, label: g }))}
            placeholder="Select role group"
            hasError={!!error && !roleGroup}
          />

          <CustomDropdown
            label={roleGroup ? "Role" : "Choose group first"}
            required
            value={roleTitle}
            onChange={setRoleTitle}
            options={roleTitleOptions.map((t) => ({ value: t, label: t }))}
            placeholder={roleGroup ? "Select role" : "Choose group first"}
            disabled={!roleGroup}
            hasError={!!error && roleGroup && !roleTitle}
          />
        </div>

        {needsVenue && (
          <div className="auth-field-row">
            <CustomDropdown
              label="Branch"
              required
              value={venueId}
              onChange={setVenueId}
              options={venues.map((v) => ({ value: v.id, label: v.name }))}
              placeholder={venues.length ? "Select your branch" : "No branches available yet"}
              disabled={venues.length === 0}
              hasError={!!error && needsVenue && !venueId}
            />
          </div>
        )}

        <label className="auth-checkbox-row">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I have read and agree to the Terms and Risk statements
        </label>

        {error && <p className="auth-error">{error}</p>}

        <div className="auth-submit-row">
          <Button3D type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </Button3D>
        </div>
      </form>

      <p className="auth-switch-hint">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthShell>
  );
};

export default Signup;