/**
 * PageLoader.jsx  —  Sam Cafe Admin Panel
 *
 * Single reusable full-page loader. Replaces every ad-hoc spinner
 * (.co-spinner, .ts-spinner, plain "Loading…" divs) across the project.
 *
 * ─────────────────────────────────────────────────────────────────
 * USAGE
 *
 *   import PageLoader from "../components/PageLoader";
 *   // or "../../components/PageLoader" for deeper folders
 *
 *   // 1. Simple — show while data isn't ready yet
 *   if (!adminData.staff?.length) return <PageLoader />;
 *
 *   // 2. With a custom label
 *   if (loading) return <PageLoader label="Loading theme settings…" />;
 *
 *   // 3. Inline (inside a section, not full-page) — shows simple spinner
 *   if (loading) return <PageLoader inline />;
 *
 *   // 4. Wrap the whole page so the shell (header) still shows
 *   return (
 *     <div className="dishes-page">
 *       {loading ? <PageLoader label="Loading dishes…" /> : <YourContent />}
 *     </div>
 *   );
 *
 * ─────────────────────────────────────────────────────────────────
 * Props
 *
 * @prop {string}  [label]   — Custom loading text.
 *                             Default: "Loading…"
 * @prop {boolean} [inline]  — When true, renders a compact centred row
 *                             with a simple spinner ring instead of the
 *                             cooking animation. Use inside cards/panels.
 *                             Default: false
 */

import React from "react";
import "./PageLoader.css";

export default function PageLoader({ label = "Loading…", inline = false }) {
  if (inline) {
    return (
      <div className="pl-inline" role="status" aria-label={label}>
        <span className="pl-ring" aria-hidden="true" />
        <span className="pl-label">{label}</span>
      </div>
    );
  }

  return (
    <div className="pl-page" role="status" aria-label={label}>

      {/* Cooking animation */}
      <div className="pl-cooking" aria-hidden="true">
        <div className="pl-bubble" />
        <div className="pl-bubble" />
        <div className="pl-bubble" />
        <div className="pl-bubble" />
        <div className="pl-bubble" />
        <div className="pl-area">
          <div className="pl-sides">
            <div className="pl-pan" />
            <div className="pl-handle" />
          </div>
          <div className="pl-pancake">
            <div className="pl-pastry" />
          </div>
        </div>
      </div>

    </div>
  );
}