/**
 * RolesAndResponsibilities.js — Sam Cafe Admin Panel
 * Requirement 4: renamed from "Permissions" to "Roles and Responsibilities",
 * now hosting two tabs:
 *   - Permissions: the same per-role/per-module read/write matrix that
 *     used to be the whole page, but with the module list moved into
 *     category tabs (KMS, SMS, security, purchase, menu, orders and
 *     booking, admin only, people) inside a collapsible filter bar that
 *     also has a search box — Requirement 2.
 *   - Roles: lets Super Admin (and anyone else permitted to create staff
 *     accounts) define named roles that show up in the "create staff
 *     account" role picker on the Staffs page — Requirement 4.
 */

import React, { useState, useEffect, useMemo } from "react";

import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import CollapseChevron from "../components/CollapseChevron";
import PageLoader from "../components/PageLoader";
import { EmptyRow, allowTextInput } from "../App";

import "./Permissions.css";

// Category tabs requested for the filter bar. Each maps to one or more
// of the backend's MODULES registry keys. A module not covered by any
// tab still renders under "Other" so it's never silently hidden.
const CATEGORY_TABS = [
  { key: "kms", label: "KMS", keys: ["kitchenActivity", "kitchenSchedules", "kitchenAssign", "kitchenMise", "mise", "grooming", "recipes"] },
  { key: "sms", label: "SMS", keys: ["serviceActivity", "serviceSchedules", "serviceAssign", "serviceMise", "serviceGrooming", "tables", "tablePreferences"] },
  { key: "security", label: "Security", keys: ["roles", "sessions", "permissions", "auditLogs"] },
  { key: "purchase", label: "Purchase", keys: ["purchaseOrders", "suppliers", "ingredients"] },
  { key: "menu", label: "Menu", keys: ["categories", "combo", "combo_offers", "comboSectionConfig", "favourites", "offers"] },
  { key: "orders", label: "Orders & Booking", keys: ["orders", "reservations", "events", "eventBookings", "cateringOrders", "preBookings", "celebrations"] },
  { key: "admin", label: "Admin Only", keys: ["venues", "theme", "categoryCards"] },
  { key: "people", label: "People", keys: ["users", "staff", "careers", "holidays", "callHistory", "tasks"] },
];

/* ═══════════════════════════════════════════════════════════════
   PERMISSIONS TAB — same matrix/toggle logic as before, now scoped
   to whichever category tab + search term is active.
═══════════════════════════════════════════════════════════════ */
const PermissionsTab = () => {
  const { toast } = useToast();

  const [rows, setRows] = useState([]);
  const [modules, setModules] = useState({});
  const [roleTitles, setRoleTitles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState("all");
  const [activeCategory, setActiveCategory] = useState("kms");
  const [search, setSearch] = useState("");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

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
    if (field === "canWrite" && next.canWrite) next.canRead = true;
    if (field === "canRead" && !next.canRead) next.canWrite = false;
    setDirty((prev) => ({ ...prev, [key]: next }));
  };

  const [pendingToggle, setPendingToggle] = useState(null);

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

  const [showResetConfirm, setShowResetConfirm] = useState(false);
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
  const confirmReset = () => {
    setShowResetConfirm(false);
    handleResetDefaults();
  };

  const visibleRoles = selectedRole === "all" ? roleTitles : [selectedRole];
  const moduleEntries = Object.entries(modules);

  // Modules for the active category tab, filtered further by the search
  // box (matches on module label). "Other" tab is synthesized only if
  // something isn't covered by any CATEGORY_TABS entry.
  const usedKeys = useMemo(() => new Set(CATEGORY_TABS.flatMap((t) => t.keys)), []);
  const leftoverEntries = moduleEntries.filter(([k]) => !usedKeys.has(k));

  const tabsWithCounts = useMemo(() => {
    const tabs = CATEGORY_TABS.map((t) => ({
      ...t,
      entries: t.keys.filter((k) => modules[k]).map((k) => [k, modules[k]]),
    }));
    if (leftoverEntries.length > 0) tabs.push({ key: "other", label: "Other", entries: leftoverEntries });
    return tabs.filter((t) => t.entries.length > 0);
  }, [modules, leftoverEntries]);

  const activeEntries = useMemo(() => {
    const tab = tabsWithCounts.find((t) => t.key === activeCategory) || tabsWithCounts[0];
    const entries = tab ? tab.entries : [];
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(([, label]) => label.toLowerCase().includes(q));
  }, [tabsWithCounts, activeCategory, search]);

  // If the active tab becomes empty (e.g. data just loaded), fall back
  // to the first tab that actually has modules.
  useEffect(() => {
    if (tabsWithCounts.length && !tabsWithCounts.some((t) => t.key === activeCategory)) {
      setActiveCategory(tabsWithCounts[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsWithCounts]);

  if (isLoading) {
    return <PageLoader fill label="Loading permission matrix…" />;
  }

  return (
    <>
      <div className="header-btn-container perm-tab-header-btns">
        <span className="result-count">
          {dirtyCount > 0 ? `${dirtyCount} unsaved change(s)` : `${moduleEntries.length} module(s)`}
        </span>
        <CustomDropdown
          value={selectedRole}
          onChange={setSelectedRole}
          options={[{ value: "all", label: "All roles" }, ...roleTitles.map((rt) => ({ value: rt, label: rt }))]}
          placeholder="All roles"
          className="perm-role-filter"
        />
        <Button3D variant="cancel" onClick={() => setShowResetConfirm(true)}>Reset Defaults</Button3D>
        <Button3D onClick={handleSave} disabled={saving || dirtyCount === 0}>
          {saving ? "Saving…" : `Save Changes${dirtyCount ? ` (${dirtyCount})` : ""}`}
        </Button3D>
      </div>

      {/* COLLAPSIBLE FILTER BAR — category tabs + search (Requirement 2) */}
      <div className="filter-bar perm-filter-bar">
        <button
          type="button"
          className="header-collapse-btn perm-filter-collapse-btn"
          onClick={() => setFiltersCollapsed((p) => !p)}
          title={filtersCollapsed ? "Expand filters" : "Collapse filters"}
          aria-expanded={!filtersCollapsed}
        >
          <CollapseChevron collapsed={filtersCollapsed} />
        </button>

        {!filtersCollapsed && (
          <div className="filter-groups perm-filter-groups">
            <input
              className="search-input"
              placeholder=" Search modules…"
              value={search}
              onChange={(e) => setSearch(allowTextInput(search, e.target.value, 60, 0))}
            />
            <div className="filter-group perm-category-pills">
              {tabsWithCounts.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`filter-pill${activeCategory === t.key ? " active" : ""}`}
                  onClick={() => setActiveCategory(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="perm-module-col">Module</th>
              {visibleRoles.map((rt) => (
                <th key={rt} colSpan={2} className="perm-role-head">{rt}</th>
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
            {activeEntries.length === 0 ? (
              <EmptyRow colSpan={1 + visibleRoles.length * 2} message="No modules match this filter" />
            ) : (
              activeEntries.map(([moduleKey, moduleLabel]) => (
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
                              onClick={(e) => { e.preventDefault(); requestToggle(rt, moduleKey, moduleLabel, "canRead"); }}
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
                              onClick={(e) => { e.preventDefault(); requestToggle(rt, moduleKey, moduleLabel, "canWrite"); }}
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
        <div className="perm-confirm-overlay" onClick={() => setPendingToggle(null)}>
          <div className="perm-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm permission change</h4>
            <p>
              {pendingToggle.nextValue ? "Grant" : "Revoke"}{" "}
              <strong>{pendingToggle.field === "canRead" ? "Read" : "Write"}</strong> access to{" "}
              <strong>{pendingToggle.moduleLabel}</strong> for <strong>{pendingToggle.roleTitle}</strong>?
            </p>
            <div className="perm-confirm-actions">
              <Button3D variant="cancel" onClick={() => setPendingToggle(null)}>Cancel</Button3D>
              <Button3D onClick={confirmToggle}>Confirm</Button3D>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="perm-confirm-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="perm-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Reset permission matrix</h4>
            <p>Reset the entire permission matrix to defaults? This discards all customizations.</p>
            <div className="perm-confirm-actions">
              <Button3D variant="cancel" onClick={() => setShowResetConfirm(false)}>Cancel</Button3D>
              <Button3D onClick={confirmReset}>Reset Defaults</Button3D>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════
   ROLES TAB — named roles that show up in the Staffs "create
   account" role picker (Requirement 4).
═══════════════════════════════════════════════════════════════ */
const RolesTab = () => {
  const { toast } = useToast();
  const { isSuperAdmin, canCreateStaff, creatableRoleTitles } = useAuth();

  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", roleTitle: "" });
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/roles");
      setRoles(res.data || []);
    } catch (err) {
      toast.error("Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.trim().toLowerCase();
    return roles.filter((r) => r.name.toLowerCase().includes(q) || (r.roleTitle || "").toLowerCase().includes(q));
  }, [roles, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", roleTitle: "" });
    setShowModal(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({ name: role.name, description: role.description || "", roleTitle: role.roleTitle || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Role name is required"); return; }
    try {
      if (editing) {
        await api.patch(`/roles/${editing.id}`, form);
        toast.success("Role updated");
      } else {
        await api.post("/roles", form);
        toast.success("Role created");
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save role");
    }
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success("Role deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete role");
    }
  };

  if (isLoading) return <PageLoader fill label="Loading roles…" />;

  return (
    <>
      <div className="header-btn-container perm-tab-header-btns">
        <span className="result-count">{roles.length} role(s)</span>
        {canCreateStaff && <Button3D onClick={openCreate}>+ Add Role</Button3D>}
      </div>

      <div className="filter-bar perm-filter-bar">
        <div className="filter-groups perm-filter-groups">
          <input
            className="search-input"
            placeholder=" Search roles…"
            value={search}
            onChange={(e) => setSearch(allowTextInput(search, e.target.value, 60, 0))}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Tied To Role Title</th>
              <th>Description</th>
              {isSuperAdmin && <th className="icon-width">Edit</th>}
              {isSuperAdmin && <th className="icon-width">Delete</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRoles.length === 0 ? (
              <EmptyRow colSpan={isSuperAdmin ? 5 : 3} message="No roles defined yet" />
            ) : (
              filteredRoles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.roleTitle || "—"}</td>
                  <td>{role.description || "—"}</td>
                  {isSuperAdmin && (
                    <td className="icon-width">
                      <Button3D variant="cancel" iconOnly onClick={() => openEdit(role)} title="Edit">✎</Button3D>
                    </td>
                  )}
                  {isSuperAdmin && (
                    <td className="icon-width">
                      <Button3D variant="cancel" iconOnly onClick={() => handleDelete(role)} title="Delete">✕</Button3D>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>{editing ? "Edit Role" : "Add Role"}</h3>
              <Button3D variant="cancel" iconOnly onClick={() => setShowModal(false)}>✕</Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: allowTextInput(p.name, e.target.value, 60, 3) }))}
                  />
                  <label className="mat-label">Role Name<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>
              <div className="admin-form-group">
                <CustomDropdown
                  label="Tied to Role Title (optional)"
                  value={form.roleTitle}
                  onChange={(v) => setForm((p) => ({ ...p, roleTitle: v }))}
                  options={creatableRoleTitles}
                  placeholder="Any role title"
                />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: allowTextInput(p.description, e.target.value, 200, 0) }))}
                  />
                  <label className="mat-label">Description</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => setShowModal(false)}>Cancel</Button3D>
              <Button3D onClick={handleSave}>Save</Button3D>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════
   PAGE SHELL — header + Permissions/Roles tabs
═══════════════════════════════════════════════════════════════ */
const RolesAndResponsibilities = () => {
  const { isSuperAdmin, canCreateStaff } = useAuth();
  const [activeTab, setActiveTab] = useState("permissions");

  if (!isSuperAdmin && !canCreateStaff) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          You don't have access to Roles and Responsibilities.
        </div>
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Roles and Responsibilities</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="rr-tabs">
        {isSuperAdmin && (
          <button
            type="button"
            className={`rr-tab${activeTab === "permissions" ? " active" : ""}`}
            onClick={() => setActiveTab("permissions")}
          >
            Permissions
          </button>
        )}
        <button
          type="button"
          className={`rr-tab${activeTab === "roles" ? " active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          Roles
        </button>
      </div>

      {activeTab === "permissions" && isSuperAdmin ? <PermissionsTab /> : <RolesTab />}
    </div>
  );
};

export default RolesAndResponsibilities;
