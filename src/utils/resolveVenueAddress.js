/**
 * resolveVenueAddress.js
 * -----------------------
 * Shared helper for Events / Catering / PreBookings "Use current
 * location" toggle. Bridges the gap between:
 *   - the Venue model (flat `address` string + `area`), and
 *   - the structured multi-field address shape those booking forms
 *     use (addrDoorNo, addrStreet, addrArea, addrLandmark, addrCity,
 *     addrDistrict, addrState, addrPincode) for editable/custom
 *     addresses.
 *
 * `currentVenue` should come from `useVenue()` — it already resolves
 * to the right venue for the logged-in admin:
 *   - Super Admin  → whichever venue is selected in the topbar switcher
 *   - Everyone else → their own pinned venue
 * so callers never need their own branching for "whose venue is this".
 */

/** Builds a single-line address string from a venue record. */
export function venueAddressLine(venue) {
  if (!venue) return "";
  return [venue.address, venue.area].filter(Boolean).join(", ");
}

/**
 * Returns the structured address-field patch to merge into a booking
 * form's state when "use current location" is set to Yes. The venue
 * model only has a flat address, so every structured field maps to
 * that one line except `venue`, which becomes the resolved address.
 */
export function venueToAddressFields(venue) {
  const line = venueAddressLine(venue);
  return {
    addrDoorNo: "",
    addrStreet: venue?.address || "",
    addrArea: venue?.area || "",
    addrLandmark: "",
    addrCity: "",
    addrDistrict: "",
    addrState: "",
    addrPincode: "",
    venue: line,
  };
}

/** Clears every structured address field (used when switching to "No"). */
export function emptyAddressFields() {
  return {
    addrDoorNo: "", addrStreet: "", addrArea: "",
    addrLandmark: "", addrCity: "", addrDistrict: "",
    addrState: "", addrPincode: "", venue: "",
  };
}
