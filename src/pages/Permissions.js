/**
 * Permissions.js  —  Sam Cafe Admin Panel
 * Configurable per-role/per-module permission matrix — Super Admin only.
 *
 * Rows are (roleTitle, module) pairs with canRead/canWrite toggles.
 * Edits are staged locally and sent as one bulk PATCH so a Super Admin
 * can adjust several cells before committing. Modules are grouped by
 * department (Kitchen / Service / Menu / Orders & Bookings / People /
 * Admin-only) purely for readability — the grouping is cosmetic and
 * mirrors the comments in the backend's MODULES registry, so a new
 * module added there should get a group entry added here too.
 */

import React, { useState, useEffect, useMemo } from "react";

import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import PageLoader from "../components/PageLoader";
import { EmptyRow } from "../App";

import "./Permissions.css";

// Cosmetic grouping only — matches the // comments in permissions.js's
// MODULES registry on the backend. A module not listed here still
// renders correctly; it just falls into "Other" instead of a named group.
const MODULE_GROUPS = [
  { label: "Kitchen (KMS)", keys: ["kitchenActivity", "kitchenSchedules", "kitchenAssign", "kitchenMise", "mise", "grooming", "recipes"] },
  { label: "Service (SMS)", keys: ["serviceActivity", "serviceSchedules", "serviceAssign", "serviceMise", "serviceGrooming", "tables", "tablePreferences"] },
  { label: "Menu & Catalog", keys: ["categories", "ingredients", "combo", "combo_offers", "comboSectionConfig", "favourites", "offers"] },
  { label: "Orders & Bookings", keys: ["orders", "reservations", "events", "eventBookings", "cateringOrders", "preBookings", "celebrations"] },
  { label: "People", keys: ["users", "staff", "careers", "holidays", "callHistory", "tasks"] },
  { label: "Admin Only", keys: ["venues", "permissions", "auditLogs", "theme", "categoryCards"] },
];

const Permissions = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();

  const [rows, setRows] = useState([]);
  const [modules, setModules] = useState({});
  const [roleTitles, setRoleTitles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dirty, setDirty] = useState({}); // `${roleTitle}::${module}` -> { canRead, canWrite }
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("all");

  const load = async () => {
    try {
      const res = await api.get("/permissions");
      setRows(res.data.rows || []);
      setModules(res.data.modules || {});
      setRoleTitles(res.data.roleTitles || []);
    } catch (err) {
      console.error("Failed to load permissions:", err);
      toast.error("Failed to load permission matrix");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowMap = useMemo(() => {
    const map = {};
    for (const r of rows) map[`${r.roleTitle}::${r.module}`] = r;
    return map;
  }, [rows]);

  const cellValue = (roleTitle, moduleKey, field) => {
    const key = `${roleTitle}::${moduleKey}`;
    if (dirty[key] && dirty[key][field] !== undefined) return dirty[key][field];
    return !!rowMap[key]?.[field];
  };

  const toggleCell = (roleTitle, moduleKey, field) => {
    const key = `${roleTitle}::${moduleKey}`;
    const current = {
      canRead: cellValue(roleTitle, moduleKey, "canRead"),
      canWrite: cellValue(roleTitle, moduleKey, "canWrite"),
    };
    const next = { ...current, [field]: !current[field] };
    // Write implies read — a role that can write but not read a module
    // doesn't make sense in this UI.
    if (field === "canWrite" && next.canWrite) next.canRead = true;
    if (field === "canRead" && !next.canRead) next.canWrite = false;
    setDirty((prev) => ({ ...prev, [key]: next }));
  };

  // Pending toggle awaiting confirmation via the overlay, rather than
  // flipping immediately on click.
  const [pendingToggle, setPendingToggle] = useState(null); // { roleTitle, moduleKey, moduleLabel, field, nextValue }

  const requestToggle = (roleTitle, moduleKey, moduleLabel, field) => {
    const current = cellValue(roleTitle, moduleKey, field);
    setPendingToggle({ roleTitle, moduleKey, moduleLabel, field, nextValue: !current });
  };

  const confirmToggle = () => {
    if (!pendingToggle) return;
    toggleCell(pendingToggle.roleTitle, pendingToggle.moduleKey, pendingToggle.field);
    setPendingToggle(null);
  };

  const dirtyCount = Object.keys(dirty).length;

  const handleSave = async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      const payload = Object.entries(dirty).map(([key, val]) => {
        const [roleTitle, moduleKey] = key.split("::");
        return { roleTitle, module: moduleKey, canRead: val.canRead, canWrite: val.canWrite };
      });
      const res = await api.patch("/permissions", { rows: payload });
      setRows(res.data.rows || []);
      setDirty({});
      toast.success(`Updated ${payload.length} permission(s).`);
    } catch (err) {
      console.error("Failed to save permissions:", err);
      toast.error(err.response?.data?.error || "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    try {
      const res = await api.post("/permissions/reset-defaults");
      setRows(res.data.rows || []);
      setDirty({});
      toast.success("Permission matrix reset to defaults.");
    } catch (err) {
      toast.error("Failed to reset permissions");
    }
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const confirmReset = () => {
    setShowResetConfirm(false);
    handleResetDefaults();
  };

  const visibleRoles = selectedRole === "all" ? roleTitles : [selectedRole];
  const moduleEntries = Object.entries(modules);

  // Group modules for display, preserving MODULE_GROUPS order; anything
  // not covered by a named group (e.g. a module added to the backend
  // registry but not yet added to MODULE_GROUPS here) falls into "Other"
  // at the end, so it's never silently hidden from the matrix.
  const groupedModules = useMemo(() => {
    const used = new Set();
    const groups = MODULE_GROUPS.map((g) => {
      const entries = g.keys
        .filter((k) => modules[k])
        .map((k) => {
          used.add(k);
          return [k, modules[k]];
        });
      return { label: g.label, entries };
    }).filter((g) => g.entries.length > 0);

    const leftover = moduleEntries.filter(([k]) => !used.has(k));
    if (leftover.length > 0) groups.push({ label: "Other", entries: leftover });
    return groups;
  }, [modules, moduleEntries]);

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can manage permissions.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading permission matrix…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Permissions</h2>
              <span className="result-count">
                {dirtyCount > 0 ? `${dirtyCount} unsaved change(s)` : `${moduleEntries.length} module(s)`}
              </span>
            </div>
          </div>
        </div>

        <div className="header-btn-container">
          <CustomDropdown
            value={selectedRole}
            onChange={setSelectedRole}
            options={[{ value: "all", label: "All roles" }, ...roleTitles.map((rt) => ({ value: rt, label: rt }))]}
            placeholder="All roles"
            className="perm-role-filter"
          />
          <Button3D variant="cancel" onClick={() => setShowResetConfirm(true)}>
            Reset Defaults
          </Button3D>
          <Button3D onClick={handleSave} disabled={saving || dirtyCount === 0}>
            {saving ? "Saving…" : `Save Changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </Button3D>
        </div>
      </div>

      <div className="table-wrapper perm-table-wrapper" style={{ maxHeight: "calc(100vh - 180px)" }}>
        <table className="perm-table">
          <thead>
            <tr>
              <th className="perm-module-col">Module</th>
              {visibleRoles.map((rt) => (
                <th key={rt} colSpan={2} className="perm-role-head">
                  {rt}
                </th>
              ))}
            </tr>
            <tr className="perm-subhead-row">
              <th className="perm-module-col"></th>
              {visibleRoles.map((rt) => (
                <React.Fragment key={rt}>
                  <th className="perm-subhead">Read</th>
                  <th className="perm-subhead">Write</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {moduleEntries.length === 0 ? (
              <EmptyRow colSpan={1 + visibleRoles.length * 2} message="No modules available" />
            ) : (
              groupedModules.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="perm-group-row">
                    <td colSpan={1 + visibleRoles.length * 2}>{group.label}</td>
                  </tr>
                  {group.entries.map(([moduleKey, moduleLabel]) => (
                    <tr key={moduleKey} className="perm-row">
                      <td className="perm-module-name">{moduleLabel}</td>
                      {visibleRoles.map((rt) => {
                        const key = `${rt}::${moduleKey}`;
                        const isDirty = !!dirty[key];
                        const canRead = cellValue(rt, moduleKey, "canRead");
                        const canWrite = cellValue(rt, moduleKey, "canWrite");
                        return (
                          <React.Fragment key={rt}>
                            <td className={`perm-cell${isDirty ? " perm-cell-dirty" : ""}`}>
                              <span className="perm-toggle-wrapper">
                                <input
                                  type="checkbox"
                                  className={`perm-toggle${canRead ? " on" : ""}`}
                                  checked={canRead}
                                  readOnly
                                  role="switch"
                                  aria-checked={canRead}
                                  aria-label={`${rt} — ${moduleLabel} — Read`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    requestToggle(rt, moduleKey, moduleLabel, "canRead");
                                  }}
                                />
                              </span>
                            </td>
                            <td className={`perm-cell${isDirty ? " perm-cell-dirty" : ""}`}>
                              <span className="perm-toggle-wrapper">
                                <input
                                  type="checkbox"
                                  className={`perm-toggle${canWrite ? " on" : ""}`}
                                  checked={canWrite}
                                  readOnly
                                  role="switch"
                                  aria-checked={canWrite}
                                  aria-label={`${rt} — ${moduleLabel} — Write`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    requestToggle(rt, moduleKey, moduleLabel, "canWrite");
                                  }}
                                />
                              </span>
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pendingToggle && (
        <div className="perm-confirm-overlay" onClick={() => setPendingToggle(null)}>
          <div className="perm-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm permission change</h4>
            <p>
              {pendingToggle.nextValue ? "Grant" : "Revoke"}{" "}
              <strong>{pendingToggle.field === "canRead" ? "Read" : "Write"}</strong> access to{" "}
              <strong>{pendingToggle.moduleLabel}</strong> for <strong>{pendingToggle.roleTitle}</strong>?
            </p>
            <div className="perm-confirm-actions">
              <Button3D variant="cancel" onClick={() => setPendingToggle(null)}>
                Cancel
              </Button3D>
              <Button3D onClick={confirmToggle}>Confirm</Button3D>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="perm-confirm-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="perm-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Reset permission matrix</h4>
            <p>
              Reset the entire permission matrix to defaults? This discards all customizations.
            </p>
            <div className="perm-confirm-actions">
              <Button3D variant="cancel" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </Button3D>
              <Button3D  onClick={confirmReset}>
                Reset Defaults
              </Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Permissions;
