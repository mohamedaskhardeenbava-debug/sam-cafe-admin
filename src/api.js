import axios from "axios";
import { getVenueIdForRequest } from "./venueStore";

// In production, calls go through the /api/* rewrite defined in
// vercel.json, which proxies to the Render backend server-side. This
// makes every request same-origin from the browser's point of view
// (still sam-cafe-admin-testing.vercel.app), so the session cookie is
// never treated as third-party — avoiding Chrome's third-party cookie
// blocking (and Safari's ITP) entirely, regardless of the visitor's
// browser settings. Locally, Vercel's rewrite doesn't exist, so dev
// still talks directly to localhost:4000 as before.
const baseURL =
  process.env.NODE_ENV === "production"
    ? "/api"
    : process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

const api = axios.create({
  baseURL,
  // withCredentials is still required: even same-origin-from-the-browser's-
  // view requests need this for the httpOnly cookie to be included, and it's
  // a harmless no-op difference locally where the cookie is same-site anyway.
  withCredentials: true,
});

// Dozens of pages call api.post/put/patch (directly, or via the
// createRecord/updateRecord helpers in crudUtils.js) without building a
// venueId param themselves. The backend requires Super Admin to specify
// which branch a write belongs to — without this, every one of those
// calls 400s the moment Super Admin has a specific branch selected (or
// succeeds "by accident" against the wrong branch if the backend ever
// defaulted instead of rejecting). Injecting it here, once, covers every
// write call in the app automatically instead of requiring each page to
// remember venueParam() by hand.
//
// Only applied to write methods — GET requests already build their own
// venueId param explicitly per-page via venueParam() where relevant, and
// leaving GET alone avoids surprising a page that intentionally omits it.
// Only applied when the caller hasn't already set venueId themselves
// (either in params or in the request body) — an explicit value always
// wins over this automatic one.
const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

api.interceptors.request.use((config) => {
  const method = (config.method || "").toLowerCase();
  if (!WRITE_METHODS.has(method)) return config;

  const venueId = getVenueIdForRequest();
  if (!venueId) return config;

  const alreadyInParams = config.params && config.params.venueId;
  const alreadyInBody =
    config.data && typeof config.data === "object" && !Array.isArray(config.data) && config.data.venueId;
  if (alreadyInParams || alreadyInBody) return config;

  config.params = { ...(config.params || {}), venueId };
  return config;
});

// ---- Session-expiry handling -------------------------------------------
// AuthContext only confirms the session once, on mount (GET /staff-auth/me).
// If the httpOnly session cookie expires or is invalidated later — mid-
// session, after an idle period, or after a backend restart — nothing
// previously reacted to that: `admin` stayed set in React state, so every
// page kept rendering as if logged in while every single API call quietly
// 401'd in the background (flooding the console, leaving pages blank/broken
// with zero explanation to the person using it).
//
// This lets AuthContext register a callback (once, when it mounts) that
// runs whenever ANY request — from any page, any component — comes back
// 401. A plain subscriber list avoids api.js importing from AuthContext
// (which would create a circular import, since AuthContext imports api).
const sessionExpiredListeners = new Set();
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// The login/logout/me/my-permissions endpoints are all part of the
// auth flow's own request sequence (my-permissions fires immediately
// after a successful login, as part of loadPermissionsFor) and already
// handle their own errors locally — treating a 401 from any of them as
// a "session expired, log out" event was actually undoing a login that
// had just succeeded, if that follow-up permissions call landed before
// the browser had fully committed the new session cookie. None of
// these should trigger the global session-expiry handling.
const AUTH_ENDPOINTS = [
  "/staff-auth/login",
  "/staff-auth/logout",
  "/staff-auth/me",
  "/staff-auth/my-permissions",
];

// Extra safety net on top of the endpoint exclusion above: for a brief
// window right after any successful login or session confirmation,
// ignore 401s entirely. A cookie set by the login response isn't
// guaranteed to be attached to a request that fires immediately after
// in every browser/timing scenario — without this grace period, that
// kind of transient race could still look identical to a genuinely
// expired session and boot the person right back to the login screen
// seconds after they successfully logged in.
let authConfirmedAt = 0;
export function markAuthConfirmed() {
  authConfirmedAt = Date.now();
  recentFailureTimestamps.length = 0;
}
const AUTH_GRACE_PERIOD_MS = 8000;

// A single 401 among a large parallel batch (fetchAllData hits ~29
// endpoints via Promise.allSettled) isn't a trustworthy signal on its
// own — a role-specific quirk, a backend hiccup on one particular
// route, or any other one-off issue on a single endpoint would
// otherwise look identical to "the whole session just died" and log
// someone out over a problem confined to one page's data. Only treat
// this as a real expired-session event once several 401s land within
// a short window — a pattern across the app, not one unlucky request.
const recentFailureTimestamps = [];
const FAILURE_WINDOW_MS = 5000;
const FAILURE_THRESHOLD = 3;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => url.includes(path));
      const withinGracePeriod = Date.now() - authConfirmedAt < AUTH_GRACE_PERIOD_MS;
      if (!isAuthEndpoint && !withinGracePeriod) {
        const now = Date.now();
        recentFailureTimestamps.push(now);
        while (recentFailureTimestamps.length && now - recentFailureTimestamps[0] > FAILURE_WINDOW_MS) {
          recentFailureTimestamps.shift();
        }
        if (recentFailureTimestamps.length >= FAILURE_THRESHOLD) {
          recentFailureTimestamps.length = 0;
          sessionExpiredListeners.forEach((listener) => listener());
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

//------------------------------------admin panel---------------------------------------------