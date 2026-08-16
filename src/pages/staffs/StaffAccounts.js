/**
 * StaffAccounts.js  —  Sam Cafe Admin Panel
 * Login-account list, shown under the "Login Accounts" page-tab on the
 * Staffs page. Every account is required to link to a real HR staff
 * record (staffId) — enforced server-side in create-staff-account — so
 * there are two ways to create one:
 *
 *   1. From the Add Staff form's "Login Account" step, when adding a
 *      brand-new staff member (Staffs.js) — the new record's own id is
 *      used as staffId automatically.
 *   2. From here, via "+ Link Account", for a staff member who already
 *      exists but doesn't have a login yet — picked from
 *      GET /staff-auth/unlinked-staff, which excludes anyone already
 *      linked to an account, so you can never double-link one staff
 *      member to two accounts.
 *
 * Only Super Admin and roleTitles listed in CREATABLE_TITLES (Chef,
 * Service Manager, Captain) can create/delete an account, and only one
 * at or below their permitted tier — enforced again server-side
 * regardless of what's shown here.
 */
import React, { useEffect, useMemo, useState } from "react";

import api from "../../api";
import { useAuth, ROLE_TREE } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import ConfirmDialog from "../../components/ConfirmDialog";
import CustomDropdown from "../../components/CustomDropdown";
import PageLoader from "../../components/PageLoader";
import closeIcon from "../../icon/close-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import { EmptyRow } from "../../App";

import "./StaffAccounts.css";

/** Generates a random temporary password for a new staff login account. */
export const genTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

/** Resolves which ROLE_TREE group ("Supervisor"/"Manager"/"Super Admin") a roleTitle belongs to. */
export const roleGroupOf = (roleTree, roleTitle) =>
  Object.entries(roleTree).find(([, titles]) => titles.includes(roleTitle))?.[0] || "";

const EMPTY_LINK_FORM = { staffId: "", email: "", roleTitle: "", venueId: "" };

// Mirrors the server's email check in auth.js — keeps the "Link Account"
// form from submitting an obviously malformed address.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StaffAccounts({
  initialAccounts,
  initialUnlinkedStaff,
  initialRoles,
} = {}) {
  const { toast } = useToast();
  const { isSuperAdmin, creatableRoleTitles, canManageStaffAccounts, isLoading: isAuthLoading } = useAuth();
  const { venues } = useVenue();

  // Seeded from the app-start preload (same fetchAllData pass that loads
  // staff records/dishes/etc.) so the page has data the instant it mounts
  // instead of showing a spinner while it re-fetches what App.js already
  // has. Falls back to [] when rendered standalone (no props passed).
  const hasPreloadedData = Boolean(initialAccounts?.length || initialUnlinkedStaff?.length || initialRoles?.length);
  const [accounts, setAccounts] = useState(initialAccounts || []);
  const [isLoading, setIsLoading] = useState(!hasPreloadedData);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [unlinkedStaff, setUnlinkedStaff] = useState(initialUnlinkedStaff || []);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const linkModal = useAnimatedModal("staffAccounts-link");
  const [linkForm, setLinkForm] = useState(EMPTY_LINK_FORM);
  const [linkErrors, setLinkErrors] = useState({});
  const [linking, setLinking] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null); // { email, tempPassword } shown once after linking

  const [allRoles, setAllRoles] = useState(initialRoles || []); // Roles and Responsibilities registry — see roleTitleOptions below

  const load = async () => {
    try {
      const [accRes, unlinkedRes, rolesRes] = await Promise.all([
        api.get("/staff-auth/admins"),
        api.get("/staff-auth/unlinked-staff"),
        api.get("/roles"),
      ]);
      setAccounts(accRes.data || []);
      setUnlinkedStaff(unlinkedRes.data || []);
      setAllRoles(rolesRes.data || []);
    } catch (err) {
      console.error("Failed to load staff accounts:", err);
      toast.error("Failed to load staff accounts");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for the auth check itself to finish resolving before deciding
    // whether this admin can manage staff accounts — otherwise this can
    // fire once while `admin` is still null (canManageStaffAccounts
    // false by default), skip the fetch and flash a "no permission"
    // state, then have to wait for a second effect run once auth
    // actually resolves.
    if (isAuthLoading) return;
    if (hasPreloadedData) return; // App.js's fetchAllData already supplied this data
    if (canManageStaffAccounts) load();
    else setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageStaffAccounts, isAuthLoading]);

  // Role titles for the Link Account dropdown, sourced from the Roles
  // and Responsibilities registry, intersected with creatableRoleTitles
  // (only these have a valid ROLE_TREE mapping and can actually be used
  // to create a login) — mirrors the same logic in Staffs.js.
  const roleTitleOptions = useMemo(() => {
    const creatableSet = new Set(creatableRoleTitles);
    const fromRegistry = allRoles.filter((r) => creatableSet.has(r.title)).map((r) => r.title);
    const titles = fromRegistry.length > 0 ? fromRegistry : creatableRoleTitles;
    return titles.map((t) => ({ value: t, label: t }));
  }, [creatableRoleTitles, allRoles]);

  const openLinkModal = () => {
    setLinkForm(EMPTY_LINK_FORM);
    setLinkErrors({});
    setCreatedInfo(null);
    setShowLinkModal(true);
    linkModal.open();
  };

  const selectedStaff = unlinkedStaff.find((s) => s.id === linkForm.staffId) || null;

  const validateLinkForm = () => {
    const e = {};
    if (!linkForm.staffId) e.staffId = true;
    if (!linkForm.email.trim() || !EMAIL_RE.test(linkForm.email.trim())) e.email = true;
    if (!linkForm.roleTitle) e.roleTitle = true;
    if (isSuperAdmin && roleGroupOf(ROLE_TREE, linkForm.roleTitle) !== "Super Admin" && !linkForm.venueId) e.venueId = true;
    setLinkErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLink = async () => {
    if (!validateLinkForm()) return;
    setLinking(true);
    const tempPassword = genTempPassword();
    try {
      const roleGroup = roleGroupOf(ROLE_TREE, linkForm.roleTitle);
      const body = {
        name: selectedStaff?.name,
        email: linkForm.email.trim(),
        roleGroup,
        roleTitle: linkForm.roleTitle,
        tempPassword,
        staffId: linkForm.staffId,
        ...(isSuperAdmin ? { venueId: linkForm.venueId || undefined } : {}),
      };
      const res = await api.post("/staff-auth/create-staff-account", body);
      setAccounts((prev) => [...prev, res.data.admin]);
      setUnlinkedStaff((prev) => prev.filter((s) => s.id !== linkForm.staffId));
      setCreatedInfo({ email: linkForm.email.trim(), tempPassword });
      toast.success("Login account linked.");
    } catch (err) {
      console.error("Failed to link staff account:", err);
      toast.error(err.response?.data?.error || "Failed to create login account");
    } finally {
      setLinking(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/staff-auth/admins/${deleteTarget.id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      // The account's staff member is unlinked again, so they can be
      // re-linked (or picked up by the Add Staff flow) going forward.
      if (deleteTarget.staffId) {
        setUnlinkedStaff((prev) => [
          ...prev,
          { id: deleteTarget.staffId, name: deleteTarget.staffName || deleteTarget.name, role: deleteTarget.staffJobRole || "" },
        ]);
      }
      toast.success("Staff account deleted.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete staff account");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!canManageStaffAccounts) {
    return (
      <div className="stacc-panel">
        <p className="stacc-hint">You don't have permission to manage staff login accounts.</p>
      </div>
    );
  }

  return (
    <div className="stacc-panel stacc-panel--standalone">
      <div className="stacc-panel-header">
        <div className="stacc-panel-title">
          <h3>Staff Login Accounts</h3>
          <span className="result-count">{accounts.length} account(s)</span>
        </div>
        <Button3D
          onClick={openLinkModal}
          disabled={unlinkedStaff.length === 0}
          title={unlinkedStaff.length === 0 ? "Every staff member already has a login account — add a new staff member first to link one." : undefined}
        >
          + Link Account
        </Button3D>
      </div>

      <p className="stacc-hint stacc-hint--top">
        Every login account belongs to a staff member. Create one while adding a new staff member, or link one here for an existing staff member who doesn't have login access yet
        {unlinkedStaff.length > 0 ? ` (${unlinkedStaff.length} without an account).` : "."}
      </p>

      {isLoading ? (
        <PageLoader label="Loading accounts…" />
      ) : (
        <div className="table-wrapper stacc-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Email</th>
                <th>Login Role</th>
                <th>Status</th>
                <th className="icon-width">Delete</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <EmptyRow colSpan={5} message="No staff login accounts yet" />
              ) : (
                accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.staffName || a.name}
                    </td>
                    <td>{a.email}</td>
                    <td><span className="st-role-badge">{a.roleTitle}</span></td>
                    <td>
                      <span className={`offer-status-badge ${a.status === "active" ? "offer-active" : "offer-inactive"}`}>
                        {a.status === "active" ? "Active" : "Suspended"}
                      </span>
                      {a.mustResetPassword && <span className="stacc-pending-badge">Pending first login</span>}
                    </td>
                    <td className="icon-width">
                      <Button3D variant="cancel" iconOnly title="Delete" onClick={() => setDeleteTarget(a)}>
                        <img src={deleteIcon} alt="" />
                      </Button3D>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* LINK ACCOUNT MODAL */}
      {linkModal.shouldRender && (
        <div className={`modal-overlay ${linkModal.overlayClass}`}>
          <div className={`admin-modal ${linkModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>{createdInfo ? "Account Linked" : "Link Login Account"}</h3>
              <Button3D variant="cancel" iconOnly onClick={() => linkModal.close(() => setShowLinkModal(false))}>
                <img src={closeIcon} alt="Close" />
              </Button3D>
            </div>

            <div className="admin-modal-body">
              {createdInfo ? (
                <div className="stacc-created-panel">
                  <p>Share these credentials with <strong>{selectedStaff?.name}</strong> securely. They'll be asked to set their own password on first login.</p>
                  <div className="stacc-cred-row">
                    <span className="stacc-cred-label">Email</span>
                    <span className="stacc-cred-value">{createdInfo.email}</span>
                  </div>
                  <div className="stacc-cred-row">
                    <span className="stacc-cred-label">Temporary Password</span>
                    <span className="stacc-cred-value stacc-cred-pw">{createdInfo.tempPassword}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`admin-form-group${linkErrors.staffId ? " mat-select-error" : ""}`}>
                    <CustomDropdown
                      label="Staff Member"
                      required
                      value={linkForm.staffId}
                      onChange={(v) => {
                        const staff = unlinkedStaff.find((s) => s.id === v);
                        // Selecting a staff member auto-fills the rest of
                        // the form from their HR record: the login role
                        // must match their job role exactly (enforced
                        // again server-side), and their branch carries
                        // over too, so linking is a single click for the
                        // common case.
                        setLinkForm({
                          ...linkForm,
                          staffId: v,
                          roleTitle: staff?.role || "",
                          venueId: staff?.venueId || "",
                        });
                        setLinkErrors((p) => ({ ...p, staffId: false, roleTitle: false, venueId: false }));
                      }}
                      options={unlinkedStaff.map((s) => ({ value: s.id, label: s.role ? `${s.name} (${s.role})` : s.name }))}
                      placeholder="Select a staff member without an account"
                      hasError={!!linkErrors.staffId}
                    />
                  </div>

                  <div className={`admin-form-group${linkErrors.email ? " mat-select-error" : ""}`}>
                    <div className="mat">
                      <input
                        className={`mat-input${linkErrors.email ? " mat-error" : ""}`}
                        type="email"
                        placeholder=" "
                        value={linkForm.email}
                        onChange={(e) => { setLinkForm({ ...linkForm, email: e.target.value }); setLinkErrors((p) => ({ ...p, email: false })); }}
                      />
                      <label className={`mat-label${linkErrors.email ? " mat-label-error" : ""}`}>Email (Login)<span className="rf-req">*</span></label>
                      <span className={`mat-bar${linkErrors.email ? " mat-bar-error" : ""}`} />
                    </div>
                    {linkForm.email && !EMAIL_RE.test(linkForm.email.trim()) && (
                      <span className="rf-error-text">Enter a valid email address</span>
                    )}
                  </div>

                  <div className={`admin-form-group${linkErrors.roleTitle ? " mat-select-error" : ""}`}>
                    <CustomDropdown
                      label="Login Role"
                      required
                      value={linkForm.roleTitle}
                      onChange={() => {}}
                      options={roleTitleOptions}
                      placeholder="Select a staff member first"
                      hasError={!!linkErrors.roleTitle}
                      disabled
                    />
                    <p className="stacc-hint" style={{ marginTop: 4 }}>
                      Set from the staff member's job role — matches automatically.
                    </p>
                  </div>

                  {isSuperAdmin && roleGroupOf(ROLE_TREE, linkForm.roleTitle) !== "Super Admin" && (
                    <div className={`admin-form-group${linkErrors.venueId ? " mat-select-error" : ""}`}>
                      <CustomDropdown
                        label="Branch"
                        required
                        value={linkForm.venueId}
                        onChange={() => {}}
                        options={(venues || []).map((v) => ({ value: v.id, label: v.name }))}
                        placeholder="Select a staff member first"
                        hasError={!!linkErrors.venueId}
                        disabled
                      />
                    </div>
                  )}

                  <p className="stacc-hint">A temporary password will be generated automatically. The staff member can change it later via Forgot Password.</p>
                </>
              )}
            </div>

            <div className="admin-modal-footer">
              {createdInfo ? (
                <Button3D onClick={() => linkModal.close(() => setShowLinkModal(false))}>Done</Button3D>
              ) : (
                <>
                  <Button3D variant="cancel" onClick={() => linkModal.close(() => setShowLinkModal(false))}>Cancel</Button3D>
                  <Button3D onClick={handleLink} disabled={linking}>{linking ? "Linking…" : "Link Account"}</Button3D>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete staff account"
        message={
          <>
            Delete the login account for <strong>{deleteTarget?.staffName || deleteTarget?.name}</strong> ({deleteTarget?.email})? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
