/**
 * AuthShell.js — shared split-screen layout for every auth page
 * (Login, Signup, ForgotPassword, ForcePasswordReset).
 *
 * Renders the dark image-left / form-right frame from the reference
 * design. The project has no lifestyle/photo asset for the left panel,
 * so it uses a themed dark gradient instead of a background photo. The
 * existing logo files (logo.png, sclogo.png) are dark wordmarks meant
 * for light backgrounds, so the brand mark here is a plain white
 * text+dot treatment instead — visible on the dark panel without
 * depending on a logo asset that isn't built for dark backgrounds.
 */

import dishkyIcon from '../icon/logo-shrink.png'

const AuthShell = ({ title, children }) => {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-visual">
          <img className='login-logo' src={dishkyIcon} />
          <div className="auth-visual-glow" />
        </div>

        <div className="auth-form-panel">
          <h1 className="auth-title">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
