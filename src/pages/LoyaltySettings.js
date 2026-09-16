/**
 * LoyaltySettings.js  —  Sam Cafe Admin Panel
 *
 * Lets admins tune loyalty point weights (visit / order / dish / ₹100
 * spent / avg-spend-per-visit) and tier thresholds from a UI instead of
 * editing loyaltyUtils.js. Restaurants differ on how much to reward
 * frequency vs. spend — a venue doing a lot of private event bookings
 * may want avg-spend-per-visit weighted heavily; a high-turnover café
 * may want visits/orders weighted instead.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { useToast } from "../useToast";
import { useVenue } from "../context/VenueContext";
import Button3D from "../components/Button3D";
import {
  DEFAULT_LOYALTY_SETTINGS,
  loadLoyaltySettings,
  saveLoyaltySettings,
} from "../utils/loyaltySettingsStore";

import "./LoyaltySettings.css";

const WEIGHT_FIELDS = [
  { key: "pointsPerVisit", label: "Points per visit", hint: "Each distinct day a guest orders counts as one visit." },
  { key: "pointsPerOrder", label: "Points per order", hint: "Every order placed, regardless of size." },
  { key: "pointsPerDish", label: "Points per dish", hint: "Quantity-weighted — 2 of the same dish count as 2." },
  { key: "pointsPer100Spent", label: "Points per ₹100 spent", hint: "Applied to lifetime total spend." },
  {
    key: "avgSpendPerVisitWeight",
    label: "Points per ₹100 average spend/visit",
    hint: "Weights high-value, low-frequency guests (e.g. private event bookings) so they aren't buried under frequent small-ticket orders. Set to 0 to ignore.",
  },
];

const LoyaltySettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { venueId } = useVenue();

  const [settings, setSettings] = useState(DEFAULT_LOYALTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const loaded = await loadLoyaltySettings(api, venueId);
      if (!cancelled) {
        setSettings(loaded);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const updateWeight = (key, value) => {
    const num = value === "" ? "" : Number(value);
    setSettings((prev) => ({ ...prev, [key]: num }));
  };

  const updateTierThreshold = (tierKey, value) => {
    const num = value === "" ? 0 : Number(value);
    setSettings((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.key === tierKey ? { ...t, minPoints: num } : t)),
    }));
  };

  const handleReset = () => {
    setSettings(DEFAULT_LOYALTY_SETTINGS);
  };

  const handleSave = async () => {
    // Guard against blank/negative weights before saving.
    const cleaned = { ...settings };
    WEIGHT_FIELDS.forEach(({ key }) => {
      const n = Number(cleaned[key]);
      cleaned[key] = isNaN(n) || n < 0 ? 0 : n;
    });

    setSaving(true);
    const res = await saveLoyaltySettings(api, venueId, cleaned);
    setSaving(false);
    setSettings(cleaned);

    if (res.ok) {
      toast.success("Loyalty settings saved");
    } else {
      toast.warning("Saved on this device — couldn't reach the server");
    }
  };

  if (loading) return null;

  return (
    <div className="details-container">

      {/* HEADER */}
      <div className="details-header">
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate(-1)}
        ></button>
        <h2>Loyalty Settings</h2>
        <Button3D variant="cancel" onClick={handleReset}>Reset to Defaults</Button3D>
        <Button3D onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button3D>
      </div>

      <div className="details-body">

        {/* POINT WEIGHTS */}
        <div className="section">
          <div className="section-title"><span>Point Weights</span></div>
          <p className="loyalty-settings-desc">
            Points are calculated per guest as the sum of each metric below, multiplied by its weight.
            Set a weight to 0 to remove that factor entirely.
          </p>
        </div>

        <div className="horizontal-form-group">
          {WEIGHT_FIELDS.slice(0, 3).map(({ key, label, hint }) => (
            <div className="section" key={key}>
              <div className="section-title"><span>{label}</span></div>
              <input
                type="number"
                min="0"
                step="0.5"
                value={settings[key]}
                onChange={(e) => updateWeight(key, e.target.value)}
              />
              <span className="loyalty-settings-hint">{hint}</span>
            </div>
          ))}
        </div>

        <div className="horizontal-form-group">
          {WEIGHT_FIELDS.slice(3).map(({ key, label, hint }) => (
            <div className="section" key={key}>
              <div className="section-title"><span>{label}</span></div>
              <input
                type="number"
                min="0"
                step="0.5"
                value={settings[key]}
                onChange={(e) => updateWeight(key, e.target.value)}
              />
              <span className="loyalty-settings-hint">{hint}</span>
            </div>
          ))}
        </div>

        {/* TIER THRESHOLDS */}
        <div className="section">
          <div className="section-title"><span>Tier Thresholds</span></div>
          <p className="loyalty-settings-desc">
            Minimum lifetime points required to reach each tier. Bronze is always the floor (0).
          </p>
        </div>

        <div className="horizontal-form-group">
          {settings.tiers
            .filter((t) => t.key !== "bronze")
            .map((t) => (
              <div className="section" key={t.key}>
                <div className="section-title"><span>{t.label} minimum points</span></div>
                <input
                  type="number"
                  min="0"
                  value={t.minPoints}
                  onChange={(e) => updateTierThreshold(t.key, e.target.value)}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default LoyaltySettings;