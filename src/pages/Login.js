// import { useNavigate } from "react-router-dom";
// import "./Login.css";

// const Login = ({ onLogin }) => {
//   const navigate = useNavigate();

//   const handleSubmit = (e) => {
//     e.preventDefault();

//     // ✅ set auth in App.js
//     onLogin();

//     // ✅ redirect to dashboard
//     navigate("/", { replace: true });
//   };

//   return (
//     <div className="login-container">
//       <form className="login-card" onSubmit={handleSubmit}>
//         <h2>Admin Login</h2>

//         <div className="username-section">
//           <label>Username</label>
//           <input
//             type="email"
//             placeholder="Enter username"
//             required
//           />
//         </div>

//         <div className="password-section">
//           <label>Password</label>
//           <input
//             type="password"
//             placeholder="Enter password"
//             required
//           />
//         </div>

//         <p className="forgot-password">Forgot password?</p>

//         <button type="submit">Login</button>
//       </form>
//     </div>
//   );
// };

// export default Login;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const ADMIN_EMAIL = "admin@samcafe.com";
const ADMIN_PASSWORD = "admin123";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      onLogin();
      navigate("/", { replace: true });
    } else {
      setError(true);
    }
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
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(false);
            }}
            required
          />
        </div>

        <div className="password-section">
          <label>Password</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            required
          />
        </div>

        <p className="forgot">Forgot Password?</p>

        {error && <p className="error-text">Invalid username or password</p>}

        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;

