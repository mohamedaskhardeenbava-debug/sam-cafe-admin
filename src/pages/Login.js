import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    // ✅ set auth in App.js
    onLogin();

    // ✅ redirect to dashboard
    navigate("/", { replace: true });
  };

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleSubmit}>
        <h2>Admin Login</h2>

        <div className="username-section">
          <label>Username</label>
          <input
            type="email"
            placeholder="Enter username"
            required
          />
        </div>

        <div className="password-section">
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter password"
            required
          />
        </div>

        <p className="forgot-password">Forgot password?</p>

        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;
