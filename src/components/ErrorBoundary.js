/**
 * ErrorBoundary.js — Sam Cafe Admin Panel
 * ---------------------------------------------------------------------
 * The app had no React error boundary anywhere. If anything throws
 * during render — including right after a successful login, while
 * rendering the authenticated app shell for the first time — React
 * unmounts the whole tree and the person sees a blank page with no
 * explanation. That's indistinguishable from "nothing happened" or a
 * stuck loading state, which made a real bug impossible to diagnose
 * from the outside.
 *
 * This catches any such crash and shows the actual error message and
 * component stack on screen, plus a reload button, instead of a silent
 * blank page.
 */
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 32,
            maxWidth: 720,
            margin: "60px auto",
            fontFamily: "monospace",
            background: "#fff5f5",
            border: "1px solid #f3b4b4",
            borderRadius: 12,
            color: "#7a1f1f",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error?.message || this.state.error)}</p>
          {this.state.info?.componentStack && (
            <pre style={{ fontSize: 12, overflow: "auto", background: "#fff", padding: 12, borderRadius: 8 }}>
              {this.state.info.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
