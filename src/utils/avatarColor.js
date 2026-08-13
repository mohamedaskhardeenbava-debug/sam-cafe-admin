/**
 * avatarColor.js — Sam Cafe Admin Panel
 * Deterministically picks a vibrant background color for an
 * initials-fallback avatar, based on the person's name — so the same
 * admin always gets the same color (not a random one per render),
 * while different admins get visually distinct colors.
 */

const VIBRANT_PALETTE = [
  "#e63946", // red
  "#f4a261", // orange
  "#e9c46a", // amber
  "#2a9d8f", // teal
  "#457b9d", // blue
  "#6a4c93", // purple
  "#d62828", // crimson
  "#06a77d", // green
  "#f77f00", // tangerine
  "#3a86ff", // sky blue
  "#8338ec", // violet
  "#ff006e", // pink
];

export function getAvatarColor(name) {
  const str = (name || "").trim() || "S";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // keep it a 32-bit int
  }
  const index = Math.abs(hash) % VIBRANT_PALETTE.length;
  return VIBRANT_PALETTE[index];
}
