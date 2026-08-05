import axios from "axios";
import { getVenueIdForRequest } from "./venueStore";

const api = axios.create({
  baseURL: process.env.REACT_APP_SERVER_URL || "http://localhost:4000",
  // Required for the httpOnly session cookie (Phase-4 role auth) to be
  // sent/received across the Vercel <-> Render origin split.
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

export default api;

//------------------------------------admin panel---------------------------------------------