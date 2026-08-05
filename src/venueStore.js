/**
 * venueStore.js
 *
 * A tiny non-React store holding "the venueId that should be attached to
 * the next request." VenueContext (a React component) keeps this in sync
 * on every render; api.js's request interceptor (which runs completely
 * outside the component tree, so it can't call useVenue()) reads it
 * synchronously on every outgoing request.
 *
 * This exists because dozens of pages call api.post/put/patch directly
 * (or through the createRecord/updateRecord helpers in crudUtils.js)
 * without ever building a venueId param themselves — before this store
 * existed, every one of those calls silently omitted venueId, which the
 * backend requires from Super Admin on every write. Centralizing the
 * injection point here means every current and future write call is
 * covered automatically, instead of relying on each page remembering to
 * pass venueParam() by hand.
 */

let currentVenueId = null;
let currentIsSuperAdmin = false;

/** Called by VenueContext/AuthContext whenever venue selection or role changes. */
export function setVenueStoreState({ venueId, isSuperAdmin }) {
  currentVenueId = venueId ?? null;
  currentIsSuperAdmin = !!isSuperAdmin;
}

/**
 * The venueId a write request should carry, or null if none is needed:
 *   - Super Admin → their selected branch's id (always a real venue
 *     once venues have loaded — there's no "all venues" choice anymore)
 *   - Everyone else → null (the backend always uses their own pinned
 *     venueId server-side regardless of what the client sends, so
 *     there's nothing useful to add here)
 */
export function getVenueIdForRequest() {
  return currentIsSuperAdmin ? currentVenueId : null;
}
