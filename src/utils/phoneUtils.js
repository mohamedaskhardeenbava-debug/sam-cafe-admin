/**
 * phoneUtils.js — Sam Cafe Admin
 *
 * Every contact-number field in the admin panel (staff contact/alt
 * contact, guest mobile on Reservations/Catering/Celebrations/
 * PreBookings, subscription customerPhone, admin's own profile phone)
 * follows the same rule: digits only, exactly 10 of them. Each form
 * had already arrived at the same `.replace(/\D/g, "").slice(0, 10)`
 * pattern independently — this centralizes it so new forms don't have
 * to reinvent it, and so the exact-10-digit rule is defined in one
 * place rather than copied per file.
 */

/** Strip everything but digits and cap at 10 — use as the onChange
 *  transform for any contact-number <input>. */
export const sanitizePhoneInput = (raw) => String(raw ?? "").replace(/\D/g, "").slice(0, 10);

/** True only when the value is exactly 10 digits — use in submit-time
 *  validation. An empty/undefined value is NOT valid here; callers with
 *  an optional phone field should short-circuit their own emptiness
 *  check before calling this (see Profile.js's admin-contact field). */
export const isValidPhone = (value) => sanitizePhoneInput(value).length === 10;
