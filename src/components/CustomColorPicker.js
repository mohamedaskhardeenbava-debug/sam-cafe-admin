/**
 * CustomColorPicker.js
 * A from-scratch color selector: saturation/lightness square + hue slider
 * + opacity slider + hex/rgba text field. Used by the Theme Settings
 * "Add/Edit Theme" modal (item #9) instead of the native <input type=color>,
 * which has no opacity control.
 *
 * Controlled component: value is an { h, s, l, a } object (h: 0-360,
 * s/l: 0-100, a: 0-1). onChange fires with the same shape on every drag.
 */

import React, { useRef, useCallback, useEffect } from "react";
import "./CustomColorPicker.css";

export const hslaToHex = ({ h, s, l }) => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const hslaToRgbaString = ({ h, s, l, a }) => {
  const hex = hslaToHex({ h, s, l });
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const hexToHsla = (hex, alpha = 1) => {
  hex = (hex || "#000000").trim();
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100, a: alpha };
};

// Parses "#rrggbb", "#rrggbbaa", or "rgba(r,g,b,a)" into { h, s, l, a }
export const parseColorString = (str) => {
  str = (str || "").trim();
  const rgbaMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/i);
  if (rgbaMatch) {
    const hex = "#" + [rgbaMatch[1], rgbaMatch[2], rgbaMatch[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    return hexToHsla(hex, rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1);
  }
  if (/^#[0-9a-f]{8}$/i.test(str)) {
    const alpha = parseInt(str.slice(7, 9), 16) / 255;
    return hexToHsla(str.slice(0, 7), alpha);
  }
  if (/^#[0-9a-f]{6}$/i.test(str)) {
    return hexToHsla(str, 1);
  }
  return null;
};

export default function CustomColorPicker({ value, onChange, label }) {
  const { h, s, l, a } = value;
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const opacityRef = useRef(null);
  const draggingRef = useRef(null); // "sv" | "hue" | "opacity" | null

  const hueHex = hslaToHex({ h, s: 100, l: 50 });
  const currentHex = hslaToHex({ h, s, l });
  const currentRgba = hslaToRgbaString({ h, s, l, a });

  const updateFromSV = useCallback((clientX, clientY) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const newS = (x / rect.width) * 100;
    // Standard SV-square → HSL mapping: vertical = lightness (100 at top,
    // 0 at bottom), horizontal = saturation. This keeps pure hues
    // reachable at s=100, l=50, matching the hue-slider's own color.
    const lightness = 100 - (y / rect.height) * 100;
    onChange({ h, s: newS, l: lightness, a });
  }, [h, a, onChange]);

  const updateFromHue = useCallback((clientX) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const newHue = (x / rect.width) * 360;
    onChange({ h: newHue, s, l, a });
  }, [s, l, a, onChange]);

  const updateFromOpacity = useCallback((clientX) => {
    const el = opacityRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const newA = Math.round((x / rect.width) * 100) / 100;
    onChange({ h, s, l, a: newA });
  }, [h, s, l, onChange]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!draggingRef.current) return;
      const point = e.touches ? e.touches[0] : e;
      if (draggingRef.current === "sv") updateFromSV(point.clientX, point.clientY);
      else if (draggingRef.current === "hue") updateFromHue(point.clientX);
      else if (draggingRef.current === "opacity") updateFromOpacity(point.clientX);
    };
    const handleUp = () => { draggingRef.current = null; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [updateFromSV, updateFromHue, updateFromOpacity]);

  const handleHexInput = (text) => {
    const parsed = parseColorString(text.startsWith("#") || text.startsWith("rgb") ? text : `#${text}`);
    if (parsed) onChange(parsed);
  };

  return (
    <div className="ccp-wrap">
      {label && <div className="ccp-label">{label}</div>}

      <div
        ref={svRef}
        className="ccp-sv-square"
        style={{ backgroundColor: hueHex }}
        onMouseDown={(e) => { draggingRef.current = "sv"; updateFromSV(e.clientX, e.clientY); }}
        onTouchStart={(e) => { draggingRef.current = "sv"; const t = e.touches[0]; updateFromSV(t.clientX, t.clientY); }}
      >
        <div className="ccp-sv-white-overlay" />
        <div className="ccp-sv-black-overlay" />
        <div
          className="ccp-sv-thumb"
          style={{
            left: `${s}%`,
            top: `${100 - l}%`,
            backgroundColor: currentHex,
          }}
        />
      </div>

      <div
        ref={hueRef}
        className="ccp-hue-slider"
        onMouseDown={(e) => { draggingRef.current = "hue"; updateFromHue(e.clientX); }}
        onTouchStart={(e) => { draggingRef.current = "hue"; updateFromHue(e.touches[0].clientX); }}
      >
        <div className="ccp-hue-thumb" style={{ left: `${(h / 360) * 100}%`, backgroundColor: hueHex }} />
      </div>

      <div
        ref={opacityRef}
        className="ccp-opacity-slider"
        style={{
          background: `linear-gradient(to right, transparent, ${currentHex}), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px`,
        }}
        onMouseDown={(e) => { draggingRef.current = "opacity"; updateFromOpacity(e.clientX); }}
        onTouchStart={(e) => { draggingRef.current = "opacity"; updateFromOpacity(e.touches[0].clientX); }}
      >
        <div className="ccp-opacity-thumb" style={{ left: `${a * 100}%`, backgroundColor: currentRgba }} />
      </div>

      <div className="ccp-inputs">
        <div className="ccp-swatch-preview" style={{ backgroundColor: currentRgba }} />
        <input
          type="text"
          className="ccp-hex-input"
          defaultValue={currentHex}
          key={currentHex /* resync the field when color changes via dragging */}
          onBlur={(e) => handleHexInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleHexInput(e.target.value); }}
          spellCheck={false}
          placeholder="#rrggbb"
        />
        <input
          type="number"
          className="ccp-opacity-input"
          min={0}
          max={100}
          value={Math.round(a * 100)}
          onChange={(e) => {
            const pct = Math.min(100, Math.max(0, Number(e.target.value) || 0));
            onChange({ h, s, l, a: pct / 100 });
          }}
        />
        <span className="ccp-opacity-pct">%</span>
      </div>
    </div>
  );
}
