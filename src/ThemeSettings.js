/**
 * ThemeSettings.js  —  Sam Cafe Admin Panel
 * Theme colour settings page
 */

import React, { useState, useEffect } from "react";

import api from "./api";
import socket from "./socket";
import { useToast } from "./useToast";

import "./ThemeSettings.css";
import PageLoader from "./components/PageLoader";
import CustomColorPicker, { hslaToHex, hexToHsla, hslaToRgbaString } from "./components/CustomColorPicker";
import Button3D from "./components/Button3D";
import useAnimatedModal from "./hooks/useAnimatedModal";
import closeIcon from "./icon/close-icon.png";


// ─── Color helpers ────────────────────────────────────────────────────────────

const hexToHsl = (hex) => {
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
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h, s, l) => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Split-complementary (+150°), max saturation, strong lightness contrast
const deriveGreenFromRed = (accentHex, isDark) => {
  try {
    const { h } = hexToHsl(accentHex);
    const compHue = (h + 150) % 360;
    return hslToHex(compHue, 95, isDark ? 58 : 38);
  } catch {
    return isDark ? "#00f050" : "#0d9e3f";
  }
};

// Very light tint in light mode, very dark tint in dark mode
const derivePaleTint = (accentHex, isDark) => {
  try {
    const { h, s } = hexToHsl(accentHex);
    return hslToHex(h, Math.min(s, 70), isDark ? 14 : 94);
  } catch {
    return isDark ? "#200808" : "#fff0ed";
  }
};

// Hover: strong analogous shift, highly saturated
const deriveHoverColor = (accentHex, isDark) => {
  try {
    const { h } = hexToHsl(accentHex);
    return hslToHex((h + 35) % 360, 100, isDark ? 45 : 62);
  } catch {
    return "#ffc800";
  }
};

const buildShadowFromAccent = (hex) =>
  `0 12px 30px ${hexToRgba(hex, 0.36)}, 0 6px 16px ${hexToRgba(hex, 0.24)}`;

const buildShadowHoverFromAccent = (hex) =>
  `0 20px 50px ${hexToRgba(hex, 0.50)}, 0 10px 24px ${hexToRgba(hex, 0.36)}`;

// Derive the two edge-gradient stops from the accent colour.
// The "dark" stop is the accent hue at low lightness (deep shadow edge),
// the "light" stop is the same hue at mid lightness (raised face edge).
const deriveEdgeColors = (accentHex) => {
  try {
    const { h } = hexToHsl(accentHex);
    return {
      "--edge-color-dark": `hsl(${Math.round(h)}deg 100% 16%)`,
      "--edge-color-light": `hsl(${Math.round(h)}deg 100% 32%)`,
    };
  } catch {
    return {
      "--edge-color-dark": "hsl(6deg 100% 16%)",
      "--edge-color-light": "hsl(6deg 100% 32%)",
    };
  }
};

// Same logic as deriveEdgeColors but produces the --edge-color-green-* vars.
const deriveGreenEdgeColors = (greenHex) => {
  try {
    const { "--edge-color-dark": gDark, "--edge-color-light": gLight } = deriveEdgeColors(greenHex);
    return {
      "--edge-color-green-dark": gDark,
      "--edge-color-green-light": gLight,
    };
  } catch {
    return {
      "--edge-color-green-dark": "hsl(134deg 100% 16%)",
      "--edge-color-green-light": "hsl(134deg 100% 32%)",
    };
  }
};
// Converts any hex color to a CSS filter chain that recolors a black SVG/PNG icon.
//
// Pipeline:
//   brightness(0)        → crush icon to pure black  (removes original color)
//   saturate(100%)       → full saturation baseline
//   invert(1)            → flip black → white
//   sepia(1)             → land on warm golden-brown (HSL ≈ 28°, 70%, 26%)
//   hue-rotate(Ydeg)     → rotate from sepia base hue (28°) to target hue
//   saturate(X%)         → scale saturation from sepia base (70%) to target
//   brightness(Z%)       → scale lightness from sepia base (26%) to target
//   contrast(100%)       → restore crispness (prevents washed-out / transparent look)
//
const hexToFilter = (hex) => {
  try {
    const clean = hex.startsWith("#") ? hex : `#${hex}`;
    const r = parseInt(clean.slice(1, 3), 16);
    const g = parseInt(clean.slice(3, 5), 16);
    const b = parseInt(clean.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) throw new Error("bad hex");

    // Use a real CSS filter solver approach:
    // brightness(0) makes it black, then we use the multi-step
    // invert+sepia+hue-rotate+saturate chain but with correct math.
    const { h, s, l } = rgbToHsl(r, g, b);

    // Clamp brightness so icon never goes invisible
    const brightnessVal = Math.max(20, Math.round(l * 2 * 100));
    const saturateVal = Math.round(Math.min(s * 5 * 100, 2000));
    const hueVal = Math.round(h);

    return `brightness(0) invert(1) sepia(1) hue-rotate(${hueVal}deg) saturate(${saturateVal}%) brightness(${brightnessVal}%)`;
  } catch {
    return "brightness(0) invert(1) sepia(1) hue-rotate(314deg) saturate(500%) brightness(120%)";
  }
};

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
};

// ─── Default theme tokens ─────────────────────────────────────────────────────
const LIGHT_DEFAULTS = {
  "--bg-main": "#ffffff",
  "--bg-surface": "#f2f2f2",
  "--text-primary": "#000000",
  "--text-secondary": "#3a3a3a",
  "--color-red": "#f33716",
  "--color-green": "#0d9e3f",
  "--color-pale-red": "#ffe8e3",
  "--color-pale-green": "#b8ffc0",
  "--border-light": "rgba(0, 0, 0, 0.18)",
  "--btn-color": "rgb(210, 210, 210)",
  "--bg-hover": "#ffc800",
  "--shadow-card-red": "0 12px 30px rgba(243, 55, 22, 0.36), 0 6px 16px rgba(243, 55, 22, 0.24)",
  "--shadow-card-red-hover": "0 20px 50px rgba(243, 55, 22, 0.50), 0 10px 24px rgba(243, 55, 22, 0.36)",
  // Always computed — never hardcoded, so it stays in sync with --color-red
  "--home-btn-filter": hexToFilter("#f33716"),
  "--edge-color-dark": "hsl(6deg 100% 16%)",
  "--edge-color-light": "hsl(6deg 100% 32%)",
  "--edge-color-green-dark": "hsl(134deg 100% 16%)",
  "--edge-color-green-light": "hsl(134deg 100% 32%)",
};

const DARK_DEFAULTS = {
  "--bg-main": "#080808",
  "--bg-surface": "#111111",
  "--text-primary": "#ffffff",
  "--text-secondary": "#c0c0c0",
  "--color-red": "#ff3a18",
  "--color-green": "#00f050",
  "--color-pale-red": "#2e0e08",
  "--color-pale-green": "#082014",
  "--border-light": "rgba(255, 255, 255, 0.18)",
  "--btn-color": "rgb(45, 45, 45)",
  "--bg-hover": "#ffc800",
  "--shadow-card-red": "0 14px 36px rgba(255, 58, 24, 0.45), 0 8px 20px rgba(255, 58, 24, 0.32)",
  "--shadow-card-red-hover": "0 22px 56px rgba(255, 58, 24, 0.60), 0 12px 28px rgba(255, 58, 24, 0.42)",
  // Always computed — never hardcoded
  "--home-btn-filter": hexToFilter("#ff3a18"),
  "--edge-color-dark": "hsl(6deg 100% 16%)",
  "--edge-color-light": "hsl(6deg 100% 32%)",
  "--edge-color-green-dark": "hsl(134deg 100% 16%)",
  "--edge-color-green-light": "hsl(134deg 100% 32%)",
};

// ─── Preset themes ────────────────────────────────────────────────────────────
// NOTE: "--home-btn-filter" is intentionally NOT stored in presets.
// It is always derived at runtime via hexToFilter(--color-red) in applyPreset().
const PRESETS = [
  {
    id: "default",
    name: "Chili Red",
    emoji: "🌶️",
    light: {
      "--color-red": "#f33716",
      "--color-green": "#0d9e3f",
      "--bg-hover": "#ffc800",
      "--color-pale-red": "#ffe8e3",
      "--color-pale-green": "#b8ffc0",
      "--shadow-card-red": "0 12px 30px rgba(243, 55, 22, 0.36), 0 6px 16px rgba(243, 55, 22, 0.24)",
      "--shadow-card-red-hover": "0 20px 50px rgba(243, 55, 22, 0.50), 0 10px 24px rgba(243, 55, 22, 0.36)",
    },
    dark: {
      "--color-red": "#ff3a18",
      "--color-green": "#00f050",
      "--bg-hover": "#ffc800",
      "--color-pale-red": "#2e0e08",
      "--color-pale-green": "#082014",
      "--shadow-card-red": "0 14px 36px rgba(255, 58, 24, 0.45), 0 8px 20px rgba(255, 58, 24, 0.32)",
      "--shadow-card-red-hover": "0 22px 56px rgba(255, 58, 24, 0.60), 0 12px 28px rgba(255, 58, 24, 0.42)",
    },
  },
  {
    id: "ocean",
    name: "Electric Blue",
    emoji: "⚡",
    light: {
      "--color-red": "#1a56f5",
      "--color-green": "#f57e1a",
      "--bg-hover": "#c7d9ff",
      "--color-pale-red": "#e8eeff",
      "--color-pale-green": "#fff3e0",
      "--shadow-card-red": "0 12px 30px rgba(26, 86, 245, 0.36), 0 6px 16px rgba(26, 86, 245, 0.24)",
      "--shadow-card-red-hover": "0 20px 50px rgba(26, 86, 245, 0.50), 0 10px 24px rgba(26, 86, 245, 0.36)",
    },
    dark: {
      "--color-red": "#3d7aff",
      "--color-green": "#ff9130",
      "--bg-hover": "#1840c8",
      "--color-pale-red": "#0a1c5a",
      "--color-pale-green": "#3a1800",
      "--shadow-card-red": "0 14px 36px rgba(61, 122, 255, 0.45), 0 8px 20px rgba(61, 122, 255, 0.32)",
      "--shadow-card-red-hover": "0 22px 56px rgba(61, 122, 255, 0.60), 0 12px 28px rgba(61, 122, 255, 0.42)",
    },
  },
  {
    id: "forest",
    name: "Deep Forest",
    emoji: "🌿",
    light: {
      "--color-red": "#12952e",
      "--color-green": "#9512a8",
      "--bg-hover": "#8effa0",
      "--color-pale-red": "#e0ffe5",
      "--color-pale-green": "#f8e0ff",
      "--shadow-card-red": "0 12px 30px rgba(18, 149, 46, 0.36), 0 6px 16px rgba(18, 149, 46, 0.24)",
      "--shadow-card-red-hover": "0 20px 50px rgba(18, 149, 46, 0.50), 0 10px 24px rgba(18, 149, 46, 0.36)",
    },
    dark: {
      "--color-red": "#1fdd52",
      "--color-green": "#c41fdd",
      "--bg-hover": "#0d5e20",
      "--color-pale-red": "#021808",
      "--color-pale-green": "#260330",
      "--shadow-card-red": "0 14px 36px rgba(31, 221, 82, 0.45), 0 8px 20px rgba(31, 221, 82, 0.32)",
      "--shadow-card-red-hover": "0 22px 56px rgba(31, 221, 82, 0.60), 0 12px 28px rgba(31, 221, 82, 0.42)",
    },
  },
  {
    id: "violet",
    name: "Royal Violet",
    emoji: "💜",
    light: {
      "--color-red": "#6c20e8",
      "--color-green": "#c8b800",
      "--bg-hover": "#ddd0ff",
      "--color-pale-red": "#f0eaff",
      "--color-pale-green": "#fffbd6",
      "--shadow-card-red": "0 12px 30px rgba(108, 32, 232, 0.36), 0 6px 16px rgba(108, 32, 232, 0.24)",
      "--shadow-card-red-hover": "0 20px 50px rgba(108, 32, 232, 0.50), 0 10px 24px rgba(108, 32, 232, 0.36)",
    },
    dark: {
      "--color-red": "#a070ff",
      "--color-green": "#ffd000",
      "--bg-hover": "#3c1280",
      "--color-pale-red": "#1e0840",
      "--color-pale-green": "#1e1600",
      "--shadow-card-red": "0 14px 36px rgba(160, 112, 255, 0.45), 0 8px 20px rgba(160, 112, 255, 0.32)",
      "--shadow-card-red-hover": "0 22px 56px rgba(160, 112, 255, 0.60), 0 12px 28px rgba(160, 112, 255, 0.42)",
    },
  },
  {
    id: "rose",
    name: "Hot Pink",
    emoji: "🌸",
    light: {
      "--color-red": "#d80040",
      "--color-green": "#0098d8",
      "--bg-hover": "#ffccd8",
      "--color-pale-red": "#ffe0e8",
      "--color-pale-green": "#dcf5ff",
      "--shadow-card-red": "0 12px 30px rgba(216, 0, 64, 0.36), 0 6px 16px rgba(216, 0, 64, 0.24)",
      "--shadow-card-red-hover": "0 20px 50px rgba(216, 0, 64, 0.50), 0 10px 24px rgba(216, 0, 64, 0.36)",
      // Removed hardcoded --home-btn-filter — now derived via hexToFilter in applyPreset()
    },
    dark: {
      "--color-red": "#ff2060",
      "--color-green": "#20d0ff",
      "--bg-hover": "#700020",
      "--color-pale-red": "#380010",
      "--color-pale-green": "#002a38",
      "--shadow-card-red": "0 14px 36px rgba(255, 32, 96, 0.45), 0 8px 20px rgba(255, 32, 96, 0.32)",
      "--shadow-card-red-hover": "0 22px 56px rgba(255, 32, 96, 0.60), 0 12px 28px rgba(255, 32, 96, 0.42)",
      // Removed hardcoded --home-btn-filter — now derived via hexToFilter in applyPreset()
    },
  },
  {
    id: "amber",
    name: "Blazing Amber",
    emoji: "🔥",
    light: {
      "--color-red": "#cc6a00",
      "--color-green": "#0070cc",
      "--bg-hover": "#ffe680",
      "--color-pale-red": "#fff4d6",
      "--color-pale-green": "#d6eeff",
      "--shadow-card-red": "0 12px 30px rgba(204, 106, 0, 0.36), 0 6px 16px rgba(204, 106, 0, 0.24)",
      "--shadow-card-red-hover": "0 20px 50px rgba(204, 106, 0, 0.50), 0 10px 24px rgba(204, 106, 0, 0.36)",
    },
    dark: {
      "--color-red": "#ffaa00",
      "--color-green": "#00aaff",
      "--bg-hover": "#7a3c00",
      "--color-pale-red": "#2e1800",
      "--color-pale-green": "#002038",
      "--shadow-card-red": "0 14px 36px rgba(255, 170, 0, 0.45), 0 8px 20px rgba(255, 170, 0, 0.32)",
      "--shadow-card-red-hover": "0 22px 56px rgba(255, 170, 0, 0.60), 0 12px 28px rgba(255, 170, 0, 0.42)",
    },
  },
];

// ─── Editable token definitions ───────────────────────────────────────────────
const TOKEN_GROUPS = [
  {
    group: "Background",
    tokens: [
      { key: "--bg-main", label: "Page Background", type: "color" },
      { key: "--bg-surface", label: "Surface / Card Background", type: "color" },
      { key: "--bg-hover", label: "Hover Highlight", type: "color" },
    ],
  },
  {
    group: "Text",
    tokens: [
      { key: "--text-primary", label: "Primary Text", type: "color" },
      { key: "--text-secondary", label: "Secondary Text", type: "color" },
    ],
  },
  {
    group: "Accent Colors",
    tokens: [
      { key: "--color-red", label: "Primary Accent (CTA / Add to Bag)", type: "color" },
      { key: "--color-green", label: "Secondary Accent (auto-derived)", type: "color", readOnly: true },
      { key: "--color-pale-red", label: "Primary Accent Tint", type: "color" },
      { key: "--color-pale-green", label: "Secondary Accent Tint", type: "color" },
    ],
  },
  {
    group: "UI Elements",
    tokens: [
      { key: "--border-light", label: "Border Color", type: "color" },
      { key: "--btn-color", label: "Default Button Background", type: "color" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toHex = (val = "") => {
  val = val.trim();
  if (val.startsWith("#")) return val.slice(0, 7);
  const rgb = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return "#" + [rgb[1], rgb[2], rgb[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("");
  }
  return "#000000";
};

// ─── Apply all tokens to :root and always sync --home-btn-filter ──────────────
// Centralised helper so every code path (load, preset, manual change, reset)
// goes through one place and never leaves the filter out of sync.
const applyTokensToDOM = (lightTk, darkTk) => {
  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === "dark";
  const active = isDark ? darkTk : lightTk;

  // Apply all tokens for the current theme to :root
  Object.entries(active).forEach(([key, val]) => root.style.setProperty(key, val));

  // Always explicitly re-set --home-btn-filter so it's never stale,
  // regardless of whether it appeared in the loop above.
  const filter = isDark
    ? (darkTk["--home-btn-filter"] || hexToFilter(toHex(darkTk["--color-red"])))
    : (lightTk["--home-btn-filter"] || hexToFilter(toHex(lightTk["--color-red"])));
  root.style.setProperty("--home-btn-filter", filter);
};

// ─── Component ────────────────────────────────────────────────────────────────
const ThemeSettings = () => {
  // ── Hooks

  const { toast } = useToast();
  const [activeMode, setActiveMode] = useState("light");
  const [lightTokens, setLightTokens] = useState({ ...LIGHT_DEFAULTS });
  const [darkTokens, setDarkTokens] = useState({ ...DARK_DEFAULTS });
  const [activePreset, setActivePreset] = useState("default");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Custom (user-created) presets — stored alongside light/dark tokens
  // in the same /theme singleton doc, as a plain array. Built-in PRESETS
  // above stay hardcoded and immutable; only these can be added/edited/deleted.
  const [customPresets, setCustomPresets] = useState([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const presetModal = useAnimatedModal("theme-presetAddEdit");
  const [editingPresetId, setEditingPresetId] = useState(null); // null = creating
  const [presetForm, setPresetForm] = useState({ name: "", color: { h: 0, s: 80, l: 50, a: 1 } });
  const [presetFormError, setPresetFormError] = useState("");
  const [deletePresetTarget, setDeletePresetTarget] = useState(null);
  const deletePresetModal = useAnimatedModal("theme-presetDelete");

  const tokens = activeMode === "light" ? lightTokens : darkTokens;
  const setTokens = activeMode === "light" ? setLightTokens : setDarkTokens;

  // ── Load saved theme from API on mount ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/theme");
        const data = Array.isArray(res.data) ? res.data[0] : res.data;

        let lt = { ...LIGHT_DEFAULTS };
        let dk = { ...DARK_DEFAULTS };

        if (data?.light) {
          lt = { ...lt, ...data.light };
          // Always recompute filter from the saved accent color
          // so a stale saved string never causes a transparent icon.
          lt["--home-btn-filter"] = hexToFilter(toHex(lt["--color-red"]));
          Object.assign(lt, deriveEdgeColors(toHex(lt["--color-red"])));
          Object.assign(lt, deriveGreenEdgeColors(toHex(lt["--color-green"])));
        }
        if (data?.dark) {
          dk = { ...dk, ...data.dark };
          dk["--home-btn-filter"] = hexToFilter(toHex(dk["--color-red"]));
          Object.assign(dk, deriveEdgeColors(toHex(dk["--color-red"])));
          Object.assign(dk, deriveGreenEdgeColors(toHex(dk["--color-green"])));
        }
        if (data?.activePreset) setActivePreset(data.activePreset);
        if (Array.isArray(data?.customPresets)) setCustomPresets(data.customPresets);

        setLightTokens(lt);
        setDarkTokens(dk);
        // Push to DOM immediately after loading
        applyTokensToDOM(lt, dk);
      } catch { /* use defaults already in state */ }
      finally { setLoading(false); }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply tokens to DOM whenever either token set changes ─────────────────
  // Uses applyTokensToDOM so --home-btn-filter is always set for the
  // correct data-theme, regardless of which editor tab is active.
  useEffect(() => {
    applyTokensToDOM(lightTokens, darkTokens);
  }, [lightTokens, darkTokens]);

  // ── Re-sync --home-btn-filter when the page theme toggle fires ────────────
  // The theme toggle (data-theme attribute) can change outside this component.
  // A MutationObserver picks that up and re-applies the right filter.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      applyTokensToDOM(lightTokens, darkTokens);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [lightTokens, darkTokens]);

  // ── Handle individual token changes in the editor ─────────────────────────
  const handleTokenChange = (key, val) => {
    const isDark = activeMode === "dark";
    setTokens((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "--color-red") {
        try {
          const hex = val.startsWith("#") ? val : toHex(val);
          next["--color-green"] = deriveGreenFromRed(hex, isDark);
          next["--color-pale-red"] = derivePaleTint(hex, isDark);
          next["--bg-hover"] = deriveHoverColor(hex, isDark);
          next["--shadow-card-red"] = buildShadowFromAccent(hex);
          next["--shadow-card-red-hover"] = buildShadowHoverFromAccent(hex);
          next["--color-pale-green"] = derivePaleTint(next["--color-green"], isDark);
          // ✅ Key fix: always recompute filter when accent changes
          next["--home-btn-filter"] = hexToFilter(hex);
          // ✅ Recompute edge gradient colours from the new accent hue
          Object.assign(next, deriveEdgeColors(hex));
          // ✅ Also recompute green edge from the auto-derived --color-green
          Object.assign(next, deriveGreenEdgeColors(next["--color-green"]));
        } catch { /* keep previous value */ }
      }
      if (key === "--color-green") {
        try {
          const hex = val.startsWith("#") ? val : toHex(val);
          next["--color-pale-green"] = derivePaleTint(hex, isDark);
          Object.assign(next, deriveGreenEdgeColors(hex));
        } catch { }
      }
      return next;
    });
    setActivePreset("custom");
  };

  // ── Apply a quick preset ──────────────────────────────────────────────────
  const applyPreset = (preset) => {
    setActivePreset(preset.id);

    // Always derive --home-btn-filter AND --color-green from the preset's
    // own --color-red — never trust a hardcoded --color-green string
    // stored on the preset object (built-in PRESETS each hand-author
    // one), so every preset's secondary accent is generated the same
    // way a manual --color-red edit already generates it.
    const ltRed = toHex(preset.light["--color-red"]);
    const dkRed = toHex(preset.dark["--color-red"]);
    const ltFilter = hexToFilter(ltRed);
    const dkFilter = hexToFilter(dkRed);
    const ltGreen = deriveGreenFromRed(ltRed, false);
    const dkGreen = deriveGreenFromRed(dkRed, true);

    setLightTokens((prev) => {
      const next = {
        ...prev,
        ...preset.light,
        "--color-green": ltGreen,
        "--color-pale-green": derivePaleTint(ltGreen, false),
        "--home-btn-filter": ltFilter,
        ...deriveEdgeColors(ltRed),
        ...deriveGreenEdgeColors(ltGreen),
      };
      return next;
    });
    setDarkTokens((prev) => {
      const next = {
        ...prev,
        ...preset.dark,
        "--color-green": dkGreen,
        "--color-pale-green": derivePaleTint(dkGreen, true),
        "--home-btn-filter": dkFilter,
        ...deriveEdgeColors(dkRed),
        ...deriveGreenEdgeColors(dkGreen),
      };
      return next;
    });
  };

  // ── Build a full light or dark token set from one accent color ────────────
  // Used when creating/editing a custom preset: the user picks a single
  // color (with opacity), and both light and dark variants are derived
  // from it the same way manual --color-red edits already work.
  const buildTokensFromAccent = (hex, isDark) => {
    const green = deriveGreenFromRed(hex, isDark);
    return {
      "--color-red": hex,
      "--color-green": green,
      "--bg-hover": deriveHoverColor(hex, isDark),
      "--color-pale-red": derivePaleTint(hex, isDark),
      "--color-pale-green": derivePaleTint(green, isDark),
      "--shadow-card-red": buildShadowFromAccent(hex),
      "--shadow-card-red-hover": buildShadowHoverFromAccent(hex),
    };
  };

  // ── Custom preset CRUD ──────────────────────────────────────────────────
  const openAddPresetModal = () => {
    setEditingPresetId(null);
    setPresetForm({ name: "", color: { h: 0, s: 80, l: 50, a: 1 } });
    setPresetFormError("");
    setShowPresetModal(true);
    presetModal.open();
  };

  const openEditPresetModal = (preset) => {
    setEditingPresetId(preset.id);
    setPresetForm({ name: preset.name, color: hexToHsla(preset.baseColor, 1) });
    setPresetFormError("");
    setShowPresetModal(true);
    presetModal.open();
  };

  const savePresetForm = async () => {
    const trimmedName = presetForm.name.trim();
    if (!trimmedName) { setPresetFormError("Enter a name for this theme."); return; }

    const baseColorHex = hslaToHex(presetForm.color);
    const preset = {
      id: editingPresetId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      baseColor: baseColorHex,
      baseColorAlpha: presetForm.color.a,
      light: buildTokensFromAccent(baseColorHex, false),
      dark: buildTokensFromAccent(baseColorHex, true),
      isCustom: true,
    };

    const nextCustomPresets = editingPresetId
      ? customPresets.map((p) => (p.id === editingPresetId ? preset : p))
      : [...customPresets, preset];

    setCustomPresets(nextCustomPresets);
    // Apply it immediately, same as clicking any other preset card.
    applyPreset(preset);
    presetModal.close(() => setShowPresetModal(false));

    // Persist right away — adding/editing a theme shouldn't depend on the
    // user remembering to also hit the page-level "Save & Apply" button.
    // Reuses the same PATCH-upsert the top-level save button calls, with
    // the just-applied tokens (preset.light/dark) so what's saved matches
    // what's now showing.
    try {
      await api.patch("/theme", {
        light: preset.light,
        dark: preset.dark,
        activePreset: preset.id,
        customPresets: nextCustomPresets,
        updatedAt: new Date().toISOString(),
      });
      socket.emit("theme-update", { light: preset.light, dark: preset.dark });
    } catch (err) {
      console.error("Failed to save custom theme:", err);
      toast.error("Theme applied, but saving it failed — try Save & Apply.");
    }
  };

  const confirmDeletePreset = async () => {
    if (!deletePresetTarget) return;
    const nextCustomPresets = customPresets.filter((p) => p.id !== deletePresetTarget.id);
    setCustomPresets(nextCustomPresets);
    const wasActive = activePreset === deletePresetTarget.id;
    if (wasActive) resetToDefaults();
    deletePresetModal.close(() => setDeletePresetTarget(null));

    try {
      const payload = { customPresets: nextCustomPresets, updatedAt: new Date().toISOString() };
      if (wasActive) {
        const ltGreen = deriveGreenFromRed("#f33716", false);
        const dkGreen = deriveGreenFromRed("#ff3a18", true);
        payload.light = {
          ...LIGHT_DEFAULTS,
          "--color-green": ltGreen,
          "--color-pale-green": derivePaleTint(ltGreen, false),
          "--home-btn-filter": hexToFilter("#f33716"),
          ...deriveEdgeColors("#f33716"),
          ...deriveGreenEdgeColors(ltGreen),
        };
        payload.dark = {
          ...DARK_DEFAULTS,
          "--color-green": dkGreen,
          "--color-pale-green": derivePaleTint(dkGreen, true),
          "--home-btn-filter": hexToFilter("#ff3a18"),
          ...deriveEdgeColors("#ff3a18"),
          ...deriveGreenEdgeColors(dkGreen),
        };
        payload.activePreset = "default";
      }
      await api.patch("/theme", payload);
    } catch (err) {
      console.error("Failed to delete custom theme:", err);
      toast.error("Failed to delete theme from the server — try again.");
    }
  };

  // ── Reset to factory defaults ─────────────────────────────────────────────
  const resetToDefaults = () => {
    const ltGreen = deriveGreenFromRed("#f33716", false);
    const dkGreen = deriveGreenFromRed("#ff3a18", true);
    const lt = {
      ...LIGHT_DEFAULTS,
      "--color-green": ltGreen,
      "--color-pale-green": derivePaleTint(ltGreen, false),
      "--home-btn-filter": hexToFilter("#f33716"),
      ...deriveEdgeColors("#f33716"),
      ...deriveGreenEdgeColors(ltGreen),
    };
    const dk = {
      ...DARK_DEFAULTS,
      "--color-green": dkGreen,
      "--color-pale-green": derivePaleTint(dkGreen, true),
      "--home-btn-filter": hexToFilter("#ff3a18"),
      ...deriveEdgeColors("#ff3a18"),
      ...deriveGreenEdgeColors(dkGreen),
    };
    setLightTokens(lt);
    setDarkTokens(dk);
    setActivePreset("default");
  };

  // ── Save & broadcast ──────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    const payload = {
      light: lightTokens,
      dark: darkTokens,
      activePreset,
      customPresets,
      updatedAt: new Date().toISOString(),
    };
    try {
      // The backend stores theme as a single global doc (id: "singleton") —
      // there is no array, no per-id resource, and no POST for creation.
      // PATCH upserts it in one call regardless of whether it already exists.
      await api.patch("/theme", payload);
      // Broadcast full token sets so the user panel can apply
      // --home-btn-filter along with every other token.
      socket.emit("theme-update", { light: lightTokens, dark: darkTokens });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save theme:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ts-page">
        <PageLoader fill label="Loading theme settings…" />
      </div>
    );
  }

  return (
    <div className="ts-page">
      <div className="ts-header">
        <div>
          <h2 className="ts-title">Theme Settings</h2>
          <p className="ts-subtitle">
            Customize the user panel appearance. Changes are broadcast live to all connected devices.
          </p>
        </div>
        <div className="ts-header-actions">
          <button className="modal-confirm-btn" onClick={resetToDefaults}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Reset to Default</span>
          </button>
          <button className={`modal-save-btn${saved ? " modal-saved" : ""}`} onClick={handleSave} disabled={saving}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">{saving ? "Saving…" : saved ? "✓ Saved!" : "Save & Apply"}</span>
          </button>
        </div>
      </div>

      <div className="ts-section">
        <div className="ts-section-title">Quick Presets</div>
        <div className="ts-presets-grid">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`ts-preset-card${activePreset === preset.id ? " active" : ""}`}
              onClick={() => applyPreset(preset)}
            >
              <div
                className="ts-preset-swatch"
                style={{ backgroundColor: preset.light["--color-red"] }}
              />
              <span className="ts-preset-name">{preset.name}</span>
              {activePreset === preset.id && <span className="ts-preset-check">✓</span>}
            </button>
          ))}

          {customPresets.map((preset) => (
            <div
              key={preset.id}
              className={`ts-preset-card ts-preset-card-custom${activePreset === preset.id ? " active" : ""}`}
            >
              <button className="ts-preset-card-main" onClick={() => applyPreset(preset)}>
                {/* Custom presets are built from a single chosen colour, so
                    the swatch shows that colour directly (with its own
                    opacity) instead of the built-in red/green gradient. */}
                <div
                  className="ts-preset-swatch"
                  style={{ backgroundColor: `rgba(${parseInt(preset.baseColor.slice(1, 3), 16)}, ${parseInt(preset.baseColor.slice(3, 5), 16)}, ${parseInt(preset.baseColor.slice(5, 7), 16)}, ${preset.baseColorAlpha ?? 1})` }}
                />
                <span className="ts-preset-name">{preset.name}</span>
                {activePreset === preset.id && <span className="ts-preset-check">✓</span>}
              </button>
              <div className="ts-preset-card-actions">
                <button
                  className="ts-preset-action-btn"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-bs-title="Edit theme"
                  onClick={(e) => { e.stopPropagation(); openEditPresetModal(preset); }}
                >
                  ✎
                </button>
                <button
                  className="ts-preset-action-btn ts-preset-action-danger"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-bs-title="Delete theme"
                  onClick={(e) => { e.stopPropagation(); setDeletePresetTarget(preset); deletePresetModal.open(); }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}

          <button className="ts-preset-card ts-preset-card-add" onClick={openAddPresetModal}>
            <div className="ts-preset-add-icon">+</div>
            <span className="ts-preset-name">Add Theme</span>
          </button>
        </div>
      </div>

      {presetModal.shouldRender && (
        <div className={`modal-overlay ${presetModal.overlayClass}`} >
          <form className={`admin-modal ${presetModal.modalClass}`} onSubmit={(e) => e.preventDefault()}>
            <div className="admin-modal-header">
              <h3>{editingPresetId ? "Edit Theme" : "Add Theme"}</h3>
              <Button3D iconOnly aria-label="Close" variant="cancel" onClick={() => presetModal.close(() => setShowPresetModal(false))}><img src={closeIcon}/></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="ts-preset-modal-preview">
                <div
                  className="ts-preset-swatch ts-preset-modal-preview-swatch"
                  style={{ backgroundColor: hslaToRgbaString(presetForm.color) }}
                />
                <span className="ts-preset-modal-preview-label">
                  {presetForm.name.trim() || "Theme preview"}
                </span>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${presetFormError ? " mat-error" : ""}`}
                    placeholder=" "
                    autoFocus
                    value={presetForm.name}
                    onChange={(e) => { setPresetForm((p) => ({ ...p, name: e.target.value })); setPresetFormError(""); }}
                  />
                  <label className={`mat-label${presetFormError ? " mat-label-error" : ""}`}>Theme Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${presetFormError ? " mat-bar-error" : ""}`} />
                </div>
                {presetFormError && <span className="rf-error-text">{presetFormError}</span>}
              </div>

              <CustomColorPicker
                label="Theme Colour"
                value={presetForm.color}
                onChange={(color) => setPresetForm((p) => ({ ...p, color }))}
              />
            </div>
            <div className="admin-modal-footer">
              <button className="modal-cancel-btn" onClick={() => presetModal.close(() => setShowPresetModal(false))}>
                <span className="shadow"></span><span className="edge"></span><span className="front">Cancel</span>
              </button>
              <button className="modal-save-btn" onClick={savePresetForm}>
                <span className="shadow"></span><span className="edge"></span>
                <span className="front">{editingPresetId ? "Save Changes" : "Create Theme"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {deletePresetModal.shouldRender && (
        <div className={`modal-overlay ${deletePresetModal.overlayClass}`} onClick={() => deletePresetModal.close(() => setDeletePresetTarget(null))}>
          <div className={`admin-modal ts-preset-delete-modal ${deletePresetModal.modalClass}`} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Delete Theme</h3>
            </div>
            <div className="admin-modal-body">
              <p>Delete "{deletePresetTarget?.name}"? This can't be undone.</p>
            </div>
            <div className="admin-modal-footer">
              <button className="modal-cancel-btn" onClick={() => deletePresetModal.close(() => setDeletePresetTarget(null))}>
                <span className="shadow"></span><span className="edge"></span><span className="front">Cancel</span>
              </button>
              <button className="modal-danger-btn" onClick={confirmDeletePreset}>
                <span className="shadow"></span><span className="edge"></span><span className="front">Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ts-section">
        <div className="ts-mode-tabs">
          <button className={`ts-mode-tab${activeMode === "light" ? " active" : ""}`} onClick={() => setActiveMode("light")}>
            ☀️ Light Mode
          </button>
          <button className={`ts-mode-tab${activeMode === "dark" ? " active" : ""}`} onClick={() => setActiveMode("dark")}>
            🌙 Dark Mode
          </button>
        </div>

        <div className="ts-token-groups">
          {TOKEN_GROUPS.map((group) => (
            <div key={group.group} className="ts-token-group">
              <div className="ts-group-title">{group.group}</div>
              <div className="ts-token-rows">
                {group.tokens.map(({ key, label, readOnly }) => (
                  <div key={key} className={`ts-token-row${readOnly ? " ts-token-row-readonly" : ""}`}>
                    <div className="ts-token-info">
                      <div className="ts-token-preview" style={{ background: tokens[key] || "#ccc" }} />
                      <div>
                        <div className="ts-token-label">{label}</div>
                        <div className="ts-token-key">{key}</div>
                      </div>
                    </div>
                    <div className="ts-token-controls">
                      <input
                        type="color"
                        value={toHex(tokens[key] || "#000000")}
                        onChange={(e) => handleTokenChange(key, e.target.value)}
                        className="ts-color-input"
                        title={readOnly ? `${label} is generated automatically from Primary Accent` : `Pick color for ${label}`}
                        disabled={readOnly}
                      />
                      <input
                        type="text"
                        value={tokens[key] || ""}
                        onChange={(e) => handleTokenChange(key, e.target.value)}
                        className="ts-text-input"
                        placeholder="e.g. #ff0000 or rgba(0,0,0,0.1)"
                        spellCheck={false}
                        disabled={readOnly}
                        title={readOnly ? `${label} is generated automatically from Primary Accent` : undefined}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ts-section">
        <div className="ts-section-title">Live Preview</div>
        <div
          className="ts-preview-card"
          style={{
            background: tokens["--bg-main"],
            border: `1.5px solid ${tokens["--border-light"]}`,
            color: tokens["--text-primary"],
          }}
        >
          <div className="ts-preview-header" style={{ background: tokens["--bg-surface"] }}>
            <span style={{ color: tokens["--text-primary"], fontWeight: 700, fontSize: 18 }}>Sam Cafe</span>
            <span style={{ color: tokens["--text-secondary"], fontSize: 13 }}>User Panel Preview</span>
          </div>
          <div className="ts-preview-body">
            <p style={{ color: tokens["--text-secondary"], fontSize: 13, marginBottom: 16 }}>
              This is how your user panel will look with the current theme.
            </p>
            <div className="ts-preview-btns">
              <button
                className="ts-preview-cta"
                style={{ background: tokens["--color-red"], color: "#fff", boxShadow: tokens["--shadow-card-red"] }}
              >
                Add to Bag
              </button>
              <button
                className="ts-preview-cta"
                style={{ background: tokens["--color-green"], color: "#fff" }}
              >
                Customize
              </button>
              <button
                className="ts-preview-secondary"
                style={{ background: tokens["--btn-color"], color: tokens["--text-primary"] }}
              >
                Show More
              </button>
            </div>
            <div
              className="ts-preview-tag"
              style={{ background: tokens["--color-pale-red"], color: tokens["--color-red"] }}
            >
              Bestseller
            </div>
            <div
              className="ts-preview-hover-sample"
              style={{ background: tokens["--bg-hover"] }}
            >
              Hover highlight color
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
