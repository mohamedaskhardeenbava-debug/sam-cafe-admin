import React, { useState, useEffect } from "react";
import "./ThemeSettings.css";
import api from "./api";
import socket from "./socket";

// ─── Default theme tokens ─────────────────────────────────────────────────────
const LIGHT_DEFAULTS = {
    "--bg-main": "#ffffff",
    "--bg-surface": "#fafafa",
    "--text-primary": "#0f172a",
    "--text-secondary": "#475569",
    "--color-red": "#f33716",
    "--color-green": "rgb(0, 174, 29)",
    "--color-pale-red": "#fff2f1",
    "--color-pale-green": "rgb(208, 255, 205)",
    "--border-light": "rgba(0, 0, 0, 0.08)",
    "--btn-color": "rgb(225, 225, 225)",
    "--bg-hover": "#ffd563",
};

const DARK_DEFAULTS = {
    "--bg-main": "#121212",
    "--bg-surface": "#020617",
    "--text-primary": "#f8fafc",
    "--text-secondary": "#cbd5f5",
    "--color-red": "#f33716",
    "--color-green": "rgb(22, 243, 59)",
    "--color-pale-red": "#2e2e2e",
    "--color-pale-green": "#16202B",
    "--border-light": "rgba(255, 255, 255, 0.12)",
    "--btn-color": "rgb(74, 74, 74)",
    "--bg-hover": "#ffd563",
};

// ─── Preset themes ────────────────────────────────────────────────────────────
const PRESETS = [
    {
        id: "default",
        name: "Classic Red",
        emoji: "🔴",
        light: { "--color-red": "#f33716", "--bg-hover": "#ffd563", "--color-pale-red": "#fff2f1" },
        dark: { "--color-red": "#f33716", "--bg-hover": "#ffd563", "--color-pale-red": "#2e2e2e" },
    },
    {
        id: "ocean",
        name: "Ocean Blue",
        emoji: "🌊",
        light: { "--color-red": "#2563eb", "--bg-hover": "#bfdbfe", "--color-pale-red": "#eff6ff" },
        dark: { "--color-red": "#3b82f6", "--bg-hover": "#1d4ed8", "--color-pale-red": "#1e3a5f" },
    },
    {
        id: "forest",
        name: "Forest Green",
        emoji: "🌿",
        light: { "--color-red": "#16a34a", "--bg-hover": "#bbf7d0", "--color-pale-red": "#f0fdf4" },
        dark: { "--color-red": "#22c55e", "--bg-hover": "#166534", "--color-pale-red": "#14532d" },
    },
    {
        id: "violet",
        name: "Royal Violet",
        emoji: "💜",
        light: { "--color-red": "#7c3aed", "--bg-hover": "#ede9fe", "--color-pale-red": "#f5f3ff" },
        dark: { "--color-red": "#a78bfa", "--bg-hover": "#4c1d95", "--color-pale-red": "#2e1065" },
    },
    {
        id: "rose",
        name: "Rose Pink",
        emoji: "🌸",
        light: { "--color-red": "#e11d48", "--bg-hover": "#fce7f3", "--color-pale-red": "#fff1f2" },
        dark: { "--color-red": "#fb7185", "--bg-hover": "#881337", "--color-pale-red": "#4c0519" },
    },
    {
        id: "amber",
        name: "Amber Gold",
        emoji: "🟡",
        light: { "--color-red": "#d97706", "--bg-hover": "#fef3c7", "--color-pale-red": "#fffbeb" },
        dark: { "--color-red": "#fbbf24", "--bg-hover": "#92400e", "--color-pale-red": "#451a03" },
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
            { key: "--color-red", label: "Primary Accent (Buttons, CTA)", type: "color" },
            { key: "--color-green", label: "Success / Active Color", type: "color" },
            { key: "--color-pale-red", label: "Accent Background Tint", type: "color" },
            { key: "--color-pale-green", label: "Success Background Tint", type: "color" },
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
// CSS color values like rgb(...) / rgba(...) can't be used as <input type="color">
// value. We convert them best-effort to hex.
const toHex = (val = "") => {
    val = val.trim();
    if (val.startsWith("#")) return val.slice(0, 7);
    // rgb(r,g,b)
    const rgb = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) {
        return (
            "#" +
            [rgb[1], rgb[2], rgb[3]]
                .map((n) => Number(n).toString(16).padStart(2, "0"))
                .join("")
        );
    }
    return "#000000";
};

// ─── Component ────────────────────────────────────────────────────────────────
const ThemeSettings = () => {
    const [activeMode, setActiveMode] = useState("light"); // "light" | "dark"
    const [lightTokens, setLightTokens] = useState({ ...LIGHT_DEFAULTS });
    const [darkTokens, setDarkTokens] = useState({ ...DARK_DEFAULTS });
    const [activePreset, setActivePreset] = useState("default");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    const tokens = activeMode === "light" ? lightTokens : darkTokens;
    const setTokens = activeMode === "light" ? setLightTokens : setDarkTokens;

    // ── Load saved theme from server on mount ─────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get("/theme");
                const saved = Array.isArray(res.data) ? res.data[0] : res.data;
                if (saved?.light) setLightTokens({ ...LIGHT_DEFAULTS, ...saved.light });
                if (saved?.dark) setDarkTokens({ ...DARK_DEFAULTS, ...saved.dark });
                if (saved?.activePreset) setActivePreset(saved.activePreset);
            } catch {
                // No theme saved yet — use defaults
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Live preview: apply to admin panel itself while editing ───────────────
    useEffect(() => {
        const root = document.documentElement;
        Object.entries(tokens).forEach(([key, val]) => {
            root.style.setProperty(key, val);
        });
    }, [tokens]);

    // ── Token change handler ─────────────────────────────────────────────────
    const handleTokenChange = (key, val) => {
        setTokens((prev) => ({ ...prev, [key]: val }));
        setActivePreset("custom");
    };

    // ── Apply preset ─────────────────────────────────────────────────────────
    const applyPreset = (preset) => {
        setActivePreset(preset.id);
        setLightTokens((prev) => ({ ...prev, ...preset.light }));
        setDarkTokens((prev) => ({ ...prev, ...preset.dark }));
    };

    // ── Reset to defaults ────────────────────────────────────────────────────
    const resetToDefaults = () => {
        setLightTokens({ ...LIGHT_DEFAULTS });
        setDarkTokens({ ...DARK_DEFAULTS });
        setActivePreset("default");
    };

    const handleSave = async () => {
        setSaving(true);

        const payload = {
            id: 1,
            light: lightTokens,
            dark: darkTokens,
            activePreset,
            updatedAt: new Date().toISOString(),
        };

        try {
            // 🔁 Check if theme already exists
            const res = await api.get("/theme");

            if (Array.isArray(res.data) && res.data.length > 0) {
                // ✅ Update existing
                await api.put("/theme/1", payload);
            } else {
                // ✅ Create new
                await api.post("/theme", payload);
            }

            // 📡 Broadcast to all clients
            socket.emit("theme-update", {
                light: lightTokens,
                dark: darkTokens,
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 2500);

        } catch (err) {
            console.error("Failed to save theme:", err);
        } finally {
            setSaving(false);
        }
    };

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
            {/* ── Header ── */}
            <div className="ts-header">
                <div>
                    <h2 className="ts-title">Theme Settings</h2>
                    <p className="ts-subtitle">
                        Customize the user panel appearance. Changes are broadcast live to all connected devices.
                    </p>
                </div>
                <div className="ts-header-actions">
                    <button className="ts-reset-btn" onClick={resetToDefaults}>
                        Reset to Default
                    </button>
                    <button
                        className={`ts-save-btn${saved ? " ts-saved" : ""}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving…" : saved ? "✓ Saved!" : "Save & Apply"}
                    </button>
                </div>
            </div>

            {/* ── Live broadcast notice ── */}
            <div className="ts-notice">
                <span className="ts-notice-dot" />
                Changes are instantly broadcast to all user panel devices via WebSocket when you click <strong>Save & Apply</strong>.
            </div>

            {/* ── Preset themes ── */}
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
                                    background: `linear-gradient(135deg, ${preset.light["--color-red"]} 0%, ${preset.light["--bg-hover"]} 100%)`,
                                }}
                            />
                            <span className="ts-preset-emoji">{preset.emoji}</span>
                            <span className="ts-preset-name">{preset.name}</span>
                            {activePreset === preset.id && (
                                <span className="ts-preset-check">✓</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Mode switcher ── */}
            <div className="ts-section">
                <div className="ts-mode-tabs">
                    <button
                        className={`ts-mode-tab${activeMode === "light" ? " active" : ""}`}
                        onClick={() => setActiveMode("light")}
                    >
                        ☀️ Light Mode
                    </button>
                    <button
                        className={`ts-mode-tab${activeMode === "dark" ? " active" : ""}`}
                        onClick={() => setActiveMode("dark")}
                    >
                        🌙 Dark Mode
                    </button>
                </div>

                {/* ── Token editor ── */}
                <div className="ts-token-groups">
                    {TOKEN_GROUPS.map((group) => (
                        <div key={group.group} className="ts-token-group">
                            <div className="ts-group-title">{group.group}</div>
                            <div className="ts-token-rows">
                                {group.tokens.map(({ key, label }) => (
                                    <div key={key} className="ts-token-row">
                                        <div className="ts-token-info">
                                            <div
                                                className="ts-token-preview"
                                                style={{ background: tokens[key] || "#ccc" }}
                                            />
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

            {/* ── Live preview card ── */}
            <div className="ts-section">
                <div className="ts-section-title">Live Preview</div>
                <div
                    className="ts-preview-card"
                    style={{
                        background: tokens["--bg-main"],
                        border: `1px solid ${tokens["--border-light"]}`,
                        color: tokens["--text-primary"],
                    }}
                >
                    <div className="ts-preview-header" style={{ background: tokens["--bg-surface"] }}>
                        <span style={{ color: tokens["--text-primary"], fontWeight: 700, fontSize: 18 }}>
                            Sam Cafe
                        </span>
                        <span style={{ color: tokens["--text-secondary"], fontSize: 13 }}>
                            User Panel Preview
                        </span>
                    </div>
                    <div className="ts-preview-body">
                        <p style={{ color: tokens["--text-secondary"], fontSize: 13, marginBottom: 16 }}>
                            This is how your user panel will look with the current theme.
                        </p>
                        <div className="ts-preview-btns">
                            <button
                                className="ts-preview-cta"
                                style={{
                                    background: tokens["--color-red"],
                                    color: "#fff",
                                }}
                            >
                                Add to Bag
                            </button>
                            <button
                                className="ts-preview-secondary"
                                style={{
                                    background: tokens["--btn-color"],
                                    color: tokens["--text-primary"],
                                }}
                            >
                                Show More
                            </button>
                        </div>
                        <div
                            className="ts-preview-tag"
                            style={{
                                background: tokens["--color-pale-red"],
                                color: tokens["--color-red"],
                            }}
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