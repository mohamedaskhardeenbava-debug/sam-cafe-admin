/**
 * Permissions.js  —  Sam Cafe Admin Panel
 * Configurable per-role/per-module permission matrix — Super Admin only.
 *
 * Rows are (roleTitle, module) pairs with canRead/canWrite toggles.
 * Edits are staged locally and sent as one bulk PATCH so a Super Admin
 * can adjust several cells before committing. Modules are grouped into
 * tabs (KMS / SMS / Security / Purchase / Menu / Orders & Booking /
 * Admin Only / People) rendered in the filter bar, with a collapse
 * button and a search box — replacing the old single long table that
 * rendered every module/group at once.
 */

import React, { useState, useEffect, useMemo } from "react";

import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import ConfirmDialog from "../components/ConfirmDialog";
import CustomDropdown from "../components/CustomDropdown";
import PageLoader from "../components/PageLoader";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { EmptyRow, allowTextInput } from "../App";
import { useTabLiquid } from "../hooks/useTabLiquid";

import "./Common.css";
import "./Permissions.css";

// Tabs shown in the filter bar. A module not listed here still renders
// correctly; it just falls into "Other" instead of a named tab.
const MODULE_TABS = [
  { key: "kms", label: "KMS", keys: ["kitchenActivity", "kitchenSchedules", "kitchenAssign", "kitchenMise", "mise", "grooming", "recipes"] },
  { key: "sms", label: "SMS", keys: ["serviceActivity", "serviceSchedules", "serviceAssign", "serviceMise", "serviceGrooming", "tables", "tablePreferences"] },
  { key: "security", label: "Security", keys: ["permissions", "auditLogs"] },
  { key: "purchase", label: "Purchase", keys: ["ingredients"] },
  { key: "menu", label: "Menu", keys: ["categories", "combo", "combo_offers", "comboSectionConfig", "favourites", "offers"] },
  { key: "orders", label: "Orders and Booking", keys: ["orders", "reservations", "events", "eventBookings", "cateringOrders", "preBookings", "celebrations"] },
  { key: "admin", label: "Admin Only", keys: ["venues", "theme", "categoryCards"] },
  { key: "people", label: "People", keys: ["users", "staff", "careers", "holidays", "callHistory", "tasks"] },
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
  const [activeTab, setActiveTab] = useState("kms");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [search, setSearch] = useState("");

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

  // Tabs to render — named tabs first (only if they have at least one
  // registered module), then "Other" for anything not covered above so
  // a module added to the backend registry is never silently hidden.
  const tabs = useMemo(() => {
    const used = new Set();
    const named = MODULE_TABS.map((t) => {
      t.keys.forEach((k) => modules[k] && used.add(k));
      return t;
    }).filter((t) => t.keys.some((k) => modules[k]));
    const leftoverKeys = moduleEntries.map(([k]) => k).filter((k) => !used.has(k));
    return leftoverKeys.length > 0 ? [...named, { key: "other", label: "Other", keys: leftoverKeys }] : named;
  }, [modules, moduleEntries]);

  // Modules for the active tab, filtered by search (matches module label).
  const activeTabModules = useMemo(() => {
    const tab = tabs.find((t) => t.key === activeTab) || tabs[0];
    if (!tab) return [];
    const q = search.trim().toLowerCase();
    return tab.keys
      .filter((k) => modules[k])
      .filter((k) => !q || modules[k].toLowerCase().includes(q))
      .map((k) => [k, modules[k]]);
  }, [tabs, activeTab, modules, search]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

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
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed((prev) => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Roles and Responsibilities</h2>
              <span className="result-count">
                {dirtyCount > 0 ? `${dirtyCount} unsaved change(s)` : `${moduleEntries.length} module(s)`}
              </span>
            </div>
          </div>
        </div>

        <div className="header-btn-container">
          <Button3D variant="cancel" onClick={() => setShowResetConfirm(true)}>
            Reset Defaults
          </Button3D>
          <Button3D onClick={handleSave} disabled={saving || dirtyCount === 0}>
            {saving ? "Saving…" : `Save Changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </Button3D>
        </div>
      </div>

      {/* FILTER BAR — module tabs + search, collapsible */}
      <CollapseSection collapsed={headerCollapsed}>
        <div className="filter-bar perm-filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder="Search modules…"
              value={search}
              onChange={(e) => setSearch(allowTextInput(search, e.target.value, 100, 5))}
            />
            {search && (
              <button className="ae-clear-filter" onClick={() => setSearch("")}>
                Clear
              </button>
            )}
            <CustomDropdown
              value={selectedRole}
              onChange={setSelectedRole}
              options={[{ value: "all", label: "All roles" }, ...roleTitles.map((rt) => ({ value: rt, label: rt }))]}
              placeholder="All roles"
              className="perm-role-filter"
            />
          </div>
          <div className="filter-pills">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`filter-pill${activeTab === t.key ? " active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </CollapseSection>

      <div
        className="table-wrapper"
      >
        <table>
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
            {activeTabModules.length === 0 ? (
              <EmptyRow colSpan={1 + visibleRoles.length * 2} message={search ? "No modules match your search" : "No modules in this tab"} />
            ) : (
              activeTabModules.map(([moduleKey, moduleLabel]) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {pendingToggle && (
        <div className="confirm-overlay" onClick={() => setPendingToggle(null)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm permission change</h4>
            <p>
              {pendingToggle.nextValue ? "Grant" : "Revoke"}{" "}
              <strong>{pendingToggle.field === "canRead" ? "Read" : "Write"}</strong> access to{" "}
              <strong>{pendingToggle.moduleLabel}</strong> for <strong>{pendingToggle.roleTitle}</strong>?
            </p>
            <div className="confirm-actions">
              <Button3D variant="cancel" onClick={() => setPendingToggle(null)}>
                Cancel
              </Button3D>
              <Button3D onClick={confirmToggle}>Confirm</Button3D>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="confirm-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Reset permission matrix</h4>
            <p>
              Reset the entire permission matrix to defaults? This discards all customizations.
            </p>
            <div className="confirm-actions">
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

const RolesPanel = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const roleModal = useAnimatedModal("rolesPanel-addEdit");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", responsibilities: "" });
  const [formErrors, setFormErrors] = useState({});

  const load = async () => {
    try {
      const res = await api.get("/roles");
      setEntries(res.data || []);
    } catch (err) {
      console.error("Failed to load roles:", err);
      toast.error("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", responsibilities: "" });
    setFormErrors({});
    setShowModal(true);
    roleModal.open();
  };

  const openEdit = (entry) => {
    setEditingId(entry.id);
    setForm({ title: entry.title, responsibilities: entry.responsibilities || "" });
    setFormErrors({});
    setShowModal(true);
    roleModal.open();
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormErrors({ title: true });
      return;
    }
    try {
      if (editingId) {
        const res = await api.patch(`/roles/${editingId}`, form);
        setEntries((prev) => prev.map((r) => (r.id === editingId ? res.data : r)));
        toast.success("Role updated.");
      } else {
        const res = await api.post("/roles", form);
        setEntries((prev) => [...prev, res.data].sort((a, b) => a.title.localeCompare(b.title)));
        toast.success("Role added.");
      }
      roleModal.close(() => setShowModal(false));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save role");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDelete = (entry) => setDeleteTarget(entry);

  const confirmDelete = async () => {
    const entry = deleteTarget;
    if (!entry) return;
    setDeleteTarget(null);
    try {
      await api.delete(`/roles/${entry.id}`);
      setEntries((prev) => prev.filter((r) => r.id !== entry.id));
      toast.success("Role deleted.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete role");
    }
  };

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading roles…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Roles</h2>
              <span className="result-count">{entries.length} role(s)</span>
            </div>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="header-btn-container">
            <Button3D onClick={openCreate}>+ Add Role</Button3D>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Responsibilities</th>
              {isSuperAdmin && <th style={{ width: 160 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <EmptyRow colSpan={isSuperAdmin ? 3 : 2} message="No roles defined yet" />
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.title}</strong></td>
                  <td>{entry.responsibilities || "—"}</td>
                  {isSuperAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button3D onClick={() => openEdit(entry)}>Edit</Button3D>
                        <Button3D variant="cancel" onClick={() => handleDelete(entry)}>Delete</Button3D>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {roleModal.shouldRender && (
        <div className={`modal-overlay ${roleModal.overlayClass}`}>
          <form
            className={`admin-modal ${roleModal.modalClass}`}
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="admin-modal-header">
              <h3>{editingId ? "Edit Role" : "Add Role"}</h3>
              <Button3D variant="cancel" iconOnly onClick={() => roleModal.close(() => setShowModal(false))}>×</Button3D>
            </div>
            <div className="admin-modal-body">
              <div className={`admin-form-group${formErrors.title ? " mat-select-error" : ""}`}>
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.title ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: allowTextInput(form.title, e.target.value, 100, 5) });
                      setFormErrors((p) => ({ ...p, title: false }));
                    }}
                  />
                  <label className={`mat-label${formErrors.title ? " mat-label-error" : ""}`}>
                    Role Title<span className="rf-req">*</span>
                  </label>
                  <span className={`mat-bar${formErrors.title ? " mat-bar-error" : ""}`} />
                </div>
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
                    value={form.responsibilities}
                    onChange={(e) => setForm({ ...form, responsibilities: allowTextInput(form.responsibilities, e.target.value, 500, 100) })}
                  />
                  <label className="mat-label">Responsibilities (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => roleModal.close(() => setShowModal(false))}>Cancel</Button3D>
              <Button3D type="submit">{editingId ? "Save Changes" : "Add Role"}</Button3D>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete role"
        message={<>Delete role <strong>{deleteTarget?.title}</strong>?</>}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

const RolesAndResponsibilities = () => {
  const [view, setView] = useState("permissions"); // "permissions" | "roles"
  const { containerRef: viewTabPillsRef, thumbStyle: viewTabThumbStyle } = useTabLiquid(view);

  return (
    <div className="inner-page perm-view-page">
      <div className="app-tab-pills perm-view-switch" ref={viewTabPillsRef}>
        <span className="app-tab-pill-liquid" style={viewTabThumbStyle} />
        <button
          type="button"
          className={`app-tab-pill${view === "permissions" ? " active" : ""}`}
          onClick={() => setView("permissions")}
        >
          Permissions
        </button>
        <button
          type="button"
          className={`app-tab-pill${view === "roles" ? " active" : ""}`}
          onClick={() => setView("roles")}
        >
          Roles
        </button>
      </div>
      {/* Both panels stay mounted so their data loads together the moment
          this page is opened from the sidebar, instead of one panel's
          fetch waiting until its tab is actually clicked. Switching tabs
          is just a visibility toggle, not a re-fetch. */}
      <div className="perm-view-panel" style={{ display: view === "permissions" ? "flex" : "none" }}>
        <Permissions />
      </div>
      <div className="perm-view-panel" style={{ display: view === "roles" ? "flex" : "none" }}>
        <RolesPanel />
      </div>
    </div>
  );
};

export default RolesAndResponsibilities;
