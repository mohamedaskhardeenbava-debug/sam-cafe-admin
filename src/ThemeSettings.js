import React, { useState, useEffect } from "react";
import "./ThemeSettings.css";
import api from "./api";
import socket from "./socket";

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
            { key: "--color-green", label: "Secondary Accent (auto-derived)", type: "color" },
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
    const [activeMode, setActiveMode] = useState("light");
    const [lightTokens, setLightTokens] = useState({ ...LIGHT_DEFAULTS });
    const [darkTokens, setDarkTokens] = useState({ ...DARK_DEFAULTS });
    const [activePreset, setActivePreset] = useState("default");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

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

        // Always derive --home-btn-filter from the preset's --color-red;
        // never rely on a hardcoded string stored inside the preset object.
        const ltFilter = hexToFilter(toHex(preset.light["--color-red"]));
        const dkFilter = hexToFilter(toHex(preset.dark["--color-red"]));

        setLightTokens((prev) => {
            const next = { ...prev, ...preset.light, "--home-btn-filter": ltFilter, ...deriveEdgeColors(toHex(preset.light["--color-red"])), ...deriveGreenEdgeColors(toHex(preset.light["--color-green"])) };
            return next;
        });
        setDarkTokens((prev) => {
            const next = { ...prev, ...preset.dark, "--home-btn-filter": dkFilter, ...deriveEdgeColors(toHex(preset.dark["--color-red"])), ...deriveGreenEdgeColors(toHex(preset.dark["--color-green"])) };
            return next;
        });
    };

    // ── Reset to factory defaults ─────────────────────────────────────────────
    const resetToDefaults = () => {
        const lt = { ...LIGHT_DEFAULTS, "--home-btn-filter": hexToFilter("#f33716"), ...deriveEdgeColors("#f33716"), ...deriveGreenEdgeColors("#0d9e3f") };
        const dk = { ...DARK_DEFAULTS, "--home-btn-filter": hexToFilter("#ff3a18"), ...deriveEdgeColors("#ff3a18"), ...deriveGreenEdgeColors("#00f050") };
        setLightTokens(lt);
        setDarkTokens(dk);
        setActivePreset("default");
    };

    // ── Save & broadcast ──────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        const payload = {
            id: "1",
            light: lightTokens,
            dark: darkTokens,
            activePreset,
            updatedAt: new Date().toISOString(),
        };
        try {
            const res = await api.get("/theme");
            if (Array.isArray(res.data) && res.data.length > 0) {
                await api.put("/theme/1", payload);
            } else {
                await api.post("/theme", payload);
            }
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
                <div className="ts-loading">
                    <div className="ts-spinner" />
                    <span>Loading theme settings…</span>
                </div>
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

            <div className="ts-notice">
                <span className="ts-notice-dot" />
                Changes broadcast live via WebSocket on <strong>Save & Apply</strong>.
                &nbsp;Changing the <strong>Primary Accent</strong> auto-derives the secondary color, tints &amp; shadows.
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
                                style={{
                                    background: `linear-gradient(135deg, ${preset.light["--color-red"]} 0%, ${preset.light["--color-green"]} 100%)`,
                                }}
                            />
                            <span className="ts-preset-emoji">{preset.emoji}</span>
                            <span className="ts-preset-name">{preset.name}</span>
                            {activePreset === preset.id && <span className="ts-preset-check">✓</span>}
                        </button>
                    ))}
                </div>
            </div>

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
                                {group.tokens.map(({ key, label }) => (
                                    <div key={key} className="ts-token-row">
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
                                                title={`Pick color for ${label}`}
                                            />
                                            <input
                                                type="text"
                                                value={tokens[key] || ""}
                                                onChange={(e) => handleTokenChange(key, e.target.value)}
                                                className="ts-text-input"
                                                placeholder="e.g. #ff0000 or rgba(0,0,0,0.1)"
                                                spellCheck={false}
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