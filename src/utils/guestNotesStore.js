/**
 * guestNotesStore.js  —  Sam Cafe Admin Panel
 *
 * Free-text staff notes per guest (allergies, preferences, special
 * occasions) — the kind of thing real guest-management systems always
 * have and UserDetails.js already has the right shape for.
 *
 * No dedicated backend field for this yet, so it's persisted the same
 * way as loyalty settings/adjustments: try the backend first
 * (`PATCH /users/:id` with a `notes` field, via the existing
 * updateRecord() helper — see UserDetails.js), mirrored to localStorage
 * so the field still works before that column exists server-side.
 */

const STORAGE_KEY = "samCafe.guestNotes";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort only
  }
}

/** Local fallback read — used when the user object itself has no
 *  `.notes` field yet (i.e. no backend column exists). */
export function getLocalGuestNotes(userId) {
  if (!userId) return "";
  return readAll()[userId] || "";
}

export function setLocalGuestNotes(userId, notes) {
  if (!userId) return;
  const all = readAll();
  all[userId] = notes;
  writeAll(all);
}
