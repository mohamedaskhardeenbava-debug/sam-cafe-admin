/**
 * Staffs.js  —  Sam Cafe Admin Panel
 * Staff list and management page
 */

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { exportToExcel } from "../../utils/excelUtils";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import api from "../../api";
import { createRecord, updateRecord, deleteRecord } from "../../utils/crudUtils";
import { useTabLiquid } from "../../hooks/useTabLiquid";

import { sortArray } from "../../App";
import { EmptyRow } from "../../App";
import editIcon from "../../icon/edit-icon.png";
import closeIcon from "../../icon/close-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../../components/InfiniteScrollLoader";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import CollapseChevron from "../../components/CollapseChevron";
import CustomDropdown from "../../components/CustomDropdown";
import { MultiPillGroup } from "../../components/FilterBar";
import StaffAccountsList, { genTempPassword, roleGroupOf } from "./StaffAccounts";
import { useAuth, ROLE_TREE } from "../../context/AuthContext";
import { useVenue } from "../../context/VenueContext";
import useRoleTitles from "./useRoleTitles";

import "../Common.css";
import "./Staffs.css";
import "./StaffAccounts.css"; // .st-page-tabcard, .st-account-step, credential-panel styling
import "../ModalCSS.css";
import "../events/Events.css"; // reuses .ecard / .ebutton step-tab styling



const EMPTY_FORM = {
  id: "",
  name: "",
  dob: "",
  role: "",
  venueId: "",
  experience: "",
  salary: "",
  education: "",
  joiningDate: "",
  previousExperience: [],
  idProof: "",
  idImage: "",
  bonafide: "",
  contact: "",
  altContact: "",
  permanentAddress: "",
  residentialAddress: "",
  bank: {
    name: "",
    account: "",
    ifsc: ""
  },
  workType: "full-time",
  employmentType: "permanent",
  reference: ""
};

// Mirrors the server's email check in auth.js — keeps the inline Login
// Account step from submitting an obviously malformed address.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateStaffId = (name) => {
  const base = name.toLowerCase().replace(/\s+/g, "_");
  return "staff_" + (base || "member") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
};

export default function Staffs({
  adminData,
  setAdminData,
  onAdd,
  onUpdate,
  onDelete,
  sortConfig,
  handleSort
}) {
  // ── Hooks

  const { toast } = useToast();
  const { isSuperAdmin, creatableRoleTitles, canManageStaffAccounts } = useAuth();
  const { venues, venueId: activeVenueId } = useVenue();
  const { roleTitles: jobRoles } = useRoleTitles(); // HR "Role" field options — from Roles and Responsibilities
  const [pageTab, setPageTab] = useState("records"); // "records" | "accounts"
  const { containerRef: pageTabPillsRef, thumbStyle: pageTabThumbStyle } = useTabLiquid(pageTab);
  const [showModal, setShowModal] = useState(false);
  const staffModal = useAnimatedModal("staffs-addEdit");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [createStep, setCreateStep] = useState(0); // 0 = Staff Details, 1 = Login Account, 2 = Preview

  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [tempExp, setTempExp] = useState({ org: "", place: "" });
  const [sameAddress, setSameAddress] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ── Login Account step (optional, folded into the Add Staff form) ──
  const EMPTY_ACCOUNT_FORM = { enabled: false, email: "", roleTitle: "", venueId: "" };
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountErrors, setAccountErrors] = useState({});
  const [accountSaving, setAccountSaving] = useState(false);
  const [createdAccountInfo, setCreatedAccountInfo] = useState(null); // { email, tempPassword } shown once after save
  const [accountsRefreshKey, setAccountsRefreshKey] = useState(0);

  // Role titles for the Login Account dropdown, sourced from the Roles
  // and Responsibilities registry (so adding/renaming/deleting a role
  // there reflects here immediately) intersected with creatableRoleTitles
  // (the fixed auth hierarchy — only these titles have a valid
  // ROLE_TREE mapping and can actually be used to create a login).
  // Seeded from the app-start preload (adminData.roles) so it's already
  // populated the moment this page mounts, same as staff records/dishes;
  // still re-fetched after a mutation (accountsRefreshKey bump) so a
  // newly-added role shows up without a full page reload.
  const [allRoles, setAllRoles] = useState(adminData.roles || []);
  useEffect(() => {
    if (!canManageStaffAccounts) return;
    if (accountsRefreshKey === 0) return; // already seeded from adminData.roles
    api.get("/roles").then((res) => setAllRoles(res.data || [])).catch(() => {});
  }, [canManageStaffAccounts, accountsRefreshKey]);
  useEffect(() => {
    if (adminData.roles?.length) setAllRoles(adminData.roles);
  }, [adminData.roles]);

  const roleTitleOptions = useMemo(() => {
    const creatableSet = new Set(creatableRoleTitles);
    const fromRegistry = allRoles.filter((r) => creatableSet.has(r.title)).map((r) => r.title);
    // Fall back to the raw creatable list if the registry hasn't loaded
    // yet or doesn't (yet) contain a matching entry, so the dropdown is
    // never empty just because the Roles tab is out of sync.
    const titles = fromRegistry.length > 0 ? fromRegistry : creatableRoleTitles;
    return titles.map((t) => ({ value: t, label: t }));
  }, [creatableRoleTitles, allRoles]);

  const validateAccountStep = () => {
    if (!accountForm.enabled) return true; // account creation is optional
    const e = {};
    if (!accountForm.email.trim() || !EMAIL_RE.test(accountForm.email.trim())) e.email = true;
    if (!accountForm.roleTitle) e.roleTitle = true;
    if (isSuperAdmin && roleGroupOf(ROLE_TREE, accountForm.roleTitle) !== "Super Admin" && !accountForm.venueId) e.venueId = true;
    setAccountErrors(e);
    return Object.keys(e).length === 0;
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [workTypeFilters, setWorkTypeFilters] = useState(() =>
    location.state?.workType ? new Set([location.state.workType]) : new Set()
  );
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const [staffSearch, setStaffSearch] = useState("");
  const [roleFilters, setRoleFilters] = useState(new Set());
  const [branchFilters, setBranchFilters] = useState(() =>
    location.state?.venueId ? new Set([location.state.venueId]) : new Set()
  );

  const staffs = useMemo(() => {
    let sorted = sortArray(adminData.staff || [], sortConfig);
    if (workTypeFilters.size > 0) sorted = sorted.filter(s => workTypeFilters.has(s.workType || "full-time"));
    if (roleFilters.size > 0) sorted = sorted.filter(s => roleFilters.has(s.role));
    if (branchFilters.size > 0) sorted = sorted.filter(s => branchFilters.has(s.venueId));
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase();
      sorted = sorted.filter(s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.role || "").toLowerCase().includes(q) ||
        (s.contact || "").includes(q)
      );
    }
    return sorted;
  }, [adminData.staff, sortConfig, workTypeFilters, roleFilters, branchFilters, staffSearch]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(staffs.length, 30);

  const exportStaffs = () => {
    if (!staffs.length) { toast.warning("No staff to export"); return; }
    const rows = staffs.map(s => ({
      Name: s.name || "—",
      Role: s.role || "—",
      "Work Type": s.workType || "full-time",
      "Employment Type": s.employmentType || "—",
      Salary: s.salary ? `₹${Number(s.salary).toLocaleString("en-IN")}` : "—",
      Experience: s.experience ? `${s.experience} yr` : "—",
      Contact: s.contact || "—",
      "Alt Contact": s.altContact || "—",
      "Joining Date": s.joiningDate || "—",
      Education: s.education || "—",
      "Bank Name": s.bank?.name || "—",
      "Account No": s.bank?.account || "—",
      IFSC: s.bank?.ifsc || "—",
      Reference: s.reference || "—",
    }));
    exportToExcel({ rows, sheetName: "Staff", fileName: `staff_${new Date().toISOString().slice(0, 10)}.xlsx` });
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setPreviewMode(false);
    setIsEditMode(false);
    staffModal.close(() => setShowModal(false));
    setFormErrors({});
    setCreateStep(0);
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setAccountErrors({});
    setCreatedAccountInfo(null);
  };

  const handleFile = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        [field]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const validateStaff = () => {
    const e = {};
    if (!formData.name.trim()) e.name = true;
    if (!formData.role) e.role = true;
    if (isSuperAdmin && !formData.venueId) e.venueId = true;
    if (!formData.joiningDate) e.joiningDate = true;
    if (!formData.dob) e.dob = true;
    if (!formData.experience) e.experience = true;
    if (!formData.salary) e.salary = true;
    if (!formData.education.trim()) e.education = true;
    if (!formData.contact) e.contact = true;
    if (!formData.altContact) e.altContact = true;
    if (!formData.residentialAddress.trim()) e.residentialAddress = true;
    if (!formData.permanentAddress.trim()) e.permanentAddress = true;
    if (!formData.idProof) e.idProof = true;
    if (!formData.idImage) e.idImage = true;
    if (!formData.bonafide) e.bonafide = true;
    if (!formData.bank.name.trim()) e.bankName = true;
    if (!formData.bank.account) e.bankAccount = true;
    if (!formData.bank.ifsc.trim()) e.bankIfsc = true;
    if (!formData.reference.trim()) e.reference = true;
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    const payload = {
      ...formData,
      id: isEditMode ? formData.id : generateStaffId(formData.name)
    };

    isEditMode ? onUpdate(payload.id, payload) : onAdd(payload);
    toast.success(isEditMode ? "Staff updated" : "Staff added");

    // Optional login account, created only for new staff (not edits) when
    // the "Login Account" step was filled in and enabled. If it succeeds,
    // show the one-time credentials panel instead of closing immediately
    // so the temp password can be copied; the user then closes manually.
    if (!isEditMode && accountForm.enabled) {
      setAccountSaving(true);
      const tempPassword = genTempPassword();
      try {
        const roleGroup = roleGroupOf(ROLE_TREE, accountForm.roleTitle);
        const body = {
          name: formData.name.trim(),
          email: accountForm.email.trim(),
          roleGroup,
          roleTitle: accountForm.roleTitle,
          tempPassword,
          staffId: payload.id,
          ...(isSuperAdmin ? { venueId: accountForm.venueId || undefined } : {}),
        };
        await api.post("/staff-auth/create-staff-account", body);
        setAccountsRefreshKey((k) => k + 1);
        toast.success("Login account created.");
        setAccountSaving(false);
        setPreviewMode(false);
        setCreatedAccountInfo({ email: accountForm.email.trim(), tempPassword });
        return; // keep the modal open showing credentials
      } catch (err) {
        console.error("Failed to create login account:", err);
        toast.error(err.response?.data?.error || "Staff saved, but the login account could not be created");
        setAccountSaving(false);
      }
    }

    resetForm();
  };

  return (
    <div className="inner-page">
      {/* PAGE-LEVEL TABS — Staff Records vs Login Accounts */}
      {canManageStaffAccounts && (
        <div className="app-tab-pills st-page-tabcard" ref={pageTabPillsRef}>
          <span className="app-tab-pill-liquid" style={pageTabThumbStyle} />
          <button
            type="button"
            className={`app-tab-pill${pageTab === "records" ? " active" : ""}`}
            onClick={() => setPageTab("records")}
          >
            Staff Records
          </button>
          <button
            type="button"
            className={`app-tab-pill${pageTab === "accounts" ? " active" : ""}`}
            onClick={() => setPageTab("accounts")}
          >
            Login Accounts
          </button>
        </div>
      )}

      {pageTab === "accounts" ? (
        <StaffAccountsList
          key={accountsRefreshKey}
          initialAccounts={adminData.staffAccounts}
          initialUnlinkedStaff={adminData.unlinkedStaff}
          initialRoles={adminData.roles}
        />
      ) : (
      <>
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand header" : "Collapse header"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Staff</h2>
              <span className="result-count">{staffs.length} staff</span>
            </div>
          </div>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportStaffs}>Export</Button3D>
          <Button3D onClick={() => { setFormData({ ...EMPTY_FORM, venueId: activeVenueId || "" }); setShowModal(true); staffModal.open(); }}>+ Add Staff</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search name, role, contact…"
              value={staffSearch}
              onChange={e => setStaffSearch(allowTextInput(staffSearch, e.target.value, 100, 5))}
            />

            <MultiPillGroup
              label="Work Type"
              options={[["full-time", "Full-Time"], ["part-time", "Part-Time"], ["double-shift", "Double Shift"]]}
              value={workTypeFilters}
              onToggle={(key) => toggleSet(setWorkTypeFilters, key)}
            />
            <MultiPillGroup
              label="Role"
              options={jobRoles.map(r => [r, r])}
              value={roleFilters}
              onToggle={(key) => toggleSet(setRoleFilters, key)}
            />
            {isSuperAdmin && (
              <MultiPillGroup
                label="Branch"
                options={(venues || []).map(v => [v.id, v.name])}
                value={branchFilters}
                onToggle={(key) => toggleSet(setBranchFilters, key)}
              />
            )}
            {(staffSearch || workTypeFilters.size > 0 || roleFilters.size > 0 || branchFilters.size > 0) && (
              <button className="ae-clear-filter" onClick={() => { setStaffSearch(""); setWorkTypeFilters(new Set()); setRoleFilters(new Set()); setBranchFilters(new Set()); }}>Clear</button>
            )}
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className={`${sortConfig.key === "name" ? "sorted" : ""}`}>
                <span className="th-content sort-th">
                  <span>Name</span>
                  <span className="sort-arrow">{sortConfig.key === "name" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th onClick={() => handleSort("role")} className={sortConfig.key === "role" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Role</span>
                  <span className="sort-arrow">{sortConfig.key === "role" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th onClick={() => handleSort("salary")} className={sortConfig.key === "salary" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Salary</span>
                  <span className="sort-arrow">{sortConfig.key === "salary" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th onClick={() => handleSort("experience")} className={sortConfig.key === "experience" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Exp</span>
                  <span className="sort-arrow">{sortConfig.key === "experience" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Contact</th>
              {isSuperAdmin && <th>Branch</th>}
              <th onClick={() => handleSort("workType")} className={sortConfig.key === "workType" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Work Type</span>
                  <span className="sort-arrow">{sortConfig.key === "workType" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th className="icon-width">Edit</th>
              <th className="icon-width">Delete</th>
            </tr>
          </thead>
          <tbody>
            {staffs.length === 0 ? (
              <EmptyRow colSpan={isSuperAdmin ? 9 : 8} message="No staff available" />
            ) : (
              staffs.slice(0, displayLimit).map((staff, i) => {
              const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3", "#fb8500", "#023e8a"];
              const avatarBg = PALETTE[i % PALETTE.length];
              return (
                <tr key={staff.id}>
                  <td>
                    <div className="st-name-cell">
                      {staff.idImage ? (
                        <img src={staff.idImage} alt={staff.name || "Staff"} className="st-avatar st-avatar-photo" />
                      ) : (
                        <div className="st-avatar" style={{ background: avatarBg }}>
                          {(staff.name || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>
                        <span
                          className="st-name clickable"
                          onClick={() => navigate(`/staff/${staff.id}`)}
                        >
                          {staff.name}
                        </span>
                        <div className="st-join">Joined {staff.joiningDate || "—"}</div>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="st-role-badge">{staff.role || "—"}</span>
                  </td>
                  <td>
                    <span className="st-salary">₹{Number(staff.salary || 0).toLocaleString("en-IN")}</span>
                  </td>
                  <td>
                    <span className="st-exp">{staff.experience ? `${staff.experience} yr` : "—"}</span>
                  </td>
                  <td>
                    <span className="st-contact">{staff.contact || "—"}</span>
                  </td>
                  {isSuperAdmin && (
                    <td>
                      <span className="st-branch">{(venues || []).find((v) => v.id === staff.venueId)?.name || "—"}</span>
                    </td>
                  )}
                  <td>
                    <span className={`st-worktype-badge st-wt-${(staff.workType || "full-time").replace("-", "")}`}>
                      {staff.workType || "full-time"}
                    </span>
                  </td>
                  <td className="icon-width" onClick={e => e.stopPropagation()}>
                    <Button3D variant="cancel" iconOnly onClick={() => { setFormData(staff); setIsEditMode(true); setShowModal(true); staffModal.open(); }}
                      title="Edit"><img src={editIcon} alt="" /></Button3D>
                  </td>

                  <td className="icon-width" onClick={e => e.stopPropagation()}>
                    <Button3D variant="cancel" iconOnly title="Delete" onClick={() => deleteRecord({
                      api, toast,
                      endpoint: `/staff/${staff.id}`,
                      item: staff,
                      stateKey: "staff",
                      adminData,
                      setAdminData,
                      confirmMsg: `Delete "${staff.name}"?`,
                      successMsg: "Staff deleted",
                      errorMsg: "Failed to delete staff",
                    })}>
                      <img src={deleteIcon} alt="" />
                    </Button3D>
                  </td>
                </tr>
              );
            })
            )}
            {staffs.length > 0 && (
              <InfiniteScrollLoader
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                colSpan={isSuperAdmin ? 9 : 8}
              />
            )}
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
      </>
      )}

      {/* MODAL */}
      {staffModal.shouldRender && (
        <div className={`modal-overlay ${staffModal.overlayClass}`}>
          <div className={`admin-modal ${staffModal.modalClass}`}>
            {/* HEADER */}
            <div className="admin-modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3>
                  {createdAccountInfo
                    ? "Login Account Created"
                    : previewMode
                      ? "Preview Staff Details"
                      : isEditMode
                        ? "Edit Staff"
                        : "Add Staff"}
                </h3>
                {!isEditMode && !createdAccountInfo && canManageStaffAccounts && (
                  <div className="ecard">
                    {["Staff Details", "Login Account", "Preview"].map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`ebutton${createStep === i ? " active" : ""}${createStep > i ? " done" : ""}`}
                        onClick={() => {
                          if (i === 0) { setCreateStep(0); setPreviewMode(false); return; }
                          if (i === 1) {
                            if (createStep === 0 && !validateStaff()) return;
                            setCreateStep(1); setPreviewMode(false); return;
                          }
                          if (i === 2) {
                            if (createStep <= 0 && !validateStaff()) return;
                            if (createStep <= 1 && !validateAccountStep()) return;
                            setCreateStep(2); setPreviewMode(true);
                          }
                        }}
                      >
                        <span className="eevt-step-num">{createStep > i ? "✓" : i + 1}</span>
                        <span className="eevt-step-label">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button3D variant="cancel" iconOnly onClick={resetForm}><img src={closeIcon} /></Button3D>
            </div>

            {/* BODY */}
            <div className="admin-modal-body">
              {createdAccountInfo ? (
                <div className="stacc-created-panel">
                  <p>Share these credentials with <strong>{formData.name}</strong> securely. They'll be asked to set their own password on first login.</p>
                  <div className="stacc-cred-row">
                    <span className="stacc-cred-label">Email</span>
                    <span className="stacc-cred-value">{createdAccountInfo.email}</span>
                  </div>
                  <div className="stacc-cred-row">
                    <span className="stacc-cred-label">Temporary Password</span>
                    <span className="stacc-cred-value stacc-cred-pw">{createdAccountInfo.tempPassword}</span>
                  </div>
                </div>
              ) : !isEditMode && canManageStaffAccounts && createStep === 1 ? (
                <div className="st-account-step">
                  {!roleTitleOptions.some((o) => o.value === formData.role) ? (
                    <p className="stacc-hint">
                      A login account can only be created for a job role that also exists as a login role
                      ({roleTitleOptions.map((o) => o.value).join(", ") || "none available"}).
                      "{formData.role || "—"}" isn't one of those, so no login account can be linked here.
                    </p>
                  ) : (
                    <>
                      <label className="st-account-toggle">
                        <input
                          type="checkbox"
                          checked={accountForm.enabled}
                          onChange={(e) => {
                            // Login role always matches this staff member's HR
                            // job role and branch — no separate choice, so the
                            // two can never drift out of sync.
                            setAccountForm({
                              ...accountForm,
                              enabled: e.target.checked,
                              roleTitle: e.target.checked ? formData.role : "",
                              venueId: e.target.checked ? formData.venueId : "",
                            });
                          }}
                        />
                        <span>Create a login account for this staff member</span>
                      </label>
                    </>
                  )}

                  {accountForm.enabled && (
                    <>
                      <div className={`admin-form-group${accountErrors.email ? " mat-select-error" : ""}`}>
                        <div className="mat">
                          <input
                            className={`mat-input${accountErrors.email ? " mat-error" : ""}`}
                            type="email"
                            placeholder=" "
                            value={accountForm.email}
                            onChange={(e) => { setAccountForm({ ...accountForm, email: e.target.value }); setAccountErrors((p) => ({ ...p, email: false })); }}
                          />
                          <label className={`mat-label${accountErrors.email ? " mat-label-error" : ""}`}>Email (Login)<span className="rf-req">*</span></label>
                          <span className={`mat-bar${accountErrors.email ? " mat-bar-error" : ""}`} />
                        </div>
                        {accountForm.email && !EMAIL_RE.test(accountForm.email.trim()) && (
                          <span className="rf-error-text">Enter a valid email address</span>
                        )}
                      </div>

                      <div className={`admin-form-group${accountErrors.roleTitle ? " mat-select-error" : ""}`}>
                        <CustomDropdown
                          label="Login Role"
                          required
                          value={accountForm.roleTitle}
                          onChange={() => {}}
                          options={roleTitleOptions}
                          placeholder="Set from Staff Details"
                          hasError={!!accountErrors.roleTitle}
                          disabled
                        />
                        <p className="stacc-hint" style={{ marginTop: 4 }}>
                          Matches the job role entered in Staff Details ({formData.role || "—"}).
                        </p>
                      </div>

                      {isSuperAdmin && roleGroupOf(ROLE_TREE, accountForm.roleTitle) !== "Super Admin" && (
                        <div className={`admin-form-group${accountErrors.venueId ? " mat-select-error" : ""}`}>
                          <CustomDropdown
                            label="Branch"
                            required
                            value={accountForm.venueId}
                            onChange={() => {}}
                            options={(venues || []).map((v) => ({ value: v.id, label: v.name }))}
                            placeholder="Set from Staff Details"
                            hasError={!!accountErrors.venueId}
                            disabled
                          />
                        </div>
                      )}

                      <p className="stacc-hint">A temporary password will be generated automatically. The staff member can change it later via Forgot Password.</p>
                    </>
                  )}
                </div>
              ) : !previewMode ? (
                <>
                  <div className="admin-form-group">
                    <div className="mat">
                      <input
                        className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                        placeholder=" "
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => { setFormData({ ...formData, name: allowTextInput(formData.name, e.target.value, 100, 5) }); setFormErrors(p => ({ ...p, name: false })); }}
                      />
                      <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Full Name<span className="rf-req">*</span></label>
                      <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className="horizantal-form-group">
                    <div className="horizontal-form-group" style={{ alignItems: "flex-end" }}>
                      <div className={`admin-form-group${formErrors.role ? " mat-select-error" : ""}`}>
                        <CustomDropdown
                          label="Role"
                          required
                          value={formData.role}
                          onChange={v => { setFormData({ ...formData, role: v }); setFormErrors(p => ({ ...p, role: false })); }}
                          options={jobRoles}
                          placeholder="Select Role"
                          hasError={!!formErrors.role}
                        />
                      </div>

                      <div className={`admin-form-group${formErrors.venueId ? " mat-select-error" : ""}`}>
                        {isSuperAdmin ? (
                          <CustomDropdown
                            label="Branch"
                            required
                            value={formData.venueId}
                            onChange={(v) => { setFormData({ ...formData, venueId: v }); setFormErrors(p => ({ ...p, venueId: false })); }}
                            options={(venues || []).map((v) => ({ value: v.id, label: v.name }))}
                            placeholder="Select branch"
                            hasError={!!formErrors.venueId}
                          />
                        ) : (
                          <div className="mat">
                            <input
                              className="mat-input"
                              placeholder=" "
                              value={(venues || []).find((v) => v.id === formData.venueId)?.name || ""}
                              disabled
                            />
                            <label className="mat-label">Branch</label>
                            <span className="mat-bar" />
                          </div>
                        )}
                      </div>

                      <div className="admin-form-group">
                        <label className={`mat-label${formErrors.joiningDate ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Joining Date<span className="rf-req">*</span></label>
                        <CustomDatePicker
                          value={formData.joiningDate}
                          onChange={(v) => { setFormData({ ...formData, joiningDate: v }); setFormErrors(p => ({ ...p, joiningDate: false })); }}
                          placeholder="Select joining date"
                          hasError={!!formErrors.joiningDate}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ------------------------------- WORK TYPE ------------------------------- */}
                  <div className="admin-form-group">
                    <label>Work Type</label>
                    <div className="radio-group">
                      {["part-time", "full-time", "double-shift"].map(type => (
                        <label
                          key={type}
                          className="radio-btn"
                        >
                          <input required
                            type="radio"
                            className="radio"
                            checked={formData.workType === type}
                            onChange={() =>
                              setFormData({ ...formData, workType: type })
                            }
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Employment Type</label>
                    <div className="radio-group">
                      {["permanent", "trainee", "intern"].map(etype => (
                        <label
                          key={etype}
                          className="radio-btn"
                        >
                          <input required
                            type="radio"
                            className="radio"
                            checked={formData.employmentType === etype}
                            onChange={() =>
                              setFormData({ ...formData, employmentType: etype })
                            }
                          />
                          {etype}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="">Personal Details</label>
                    <div className="admin-form-group border">
                      <div className="horizontal-form-group" style={{ alignItems: "flex-end" }}>
                        <div className="admin-form-group">
                          <label className={`mat-label${formErrors.dob ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Date of Birth<span className="rf-req">*</span></label>
                          <CustomDatePicker
                            value={formData.dob}
                            onChange={(v) => { setFormData({ ...formData, dob: v }); setFormErrors(p => ({ ...p, dob: false })); }}
                            placeholder="Select date of birth"
                            max={new Date().toISOString().split("T")[0]}
                            hasError={!!formErrors.dob}
                          />
                        </div>

                        <div className="admin-form-group">
                          <div className="mat">
                            <input
                              className={`mat-input${formErrors.experience ? " mat-error" : ""}`}
                              placeholder=" "
                              required
                              type="number"
                              value={formData.experience}
                              onChange={(e) => { setFormData({ ...formData, experience: e.target.value }); setFormErrors(p => ({ ...p, experience: false })); }}
                            />
                            <label className={`mat-label${formErrors.experience ? " mat-label-error" : ""}`}>Experience<span className="rf-req">*</span></label>
                            <span className={`mat-bar${formErrors.experience ? " mat-bar-error" : ""}`} />
                          </div>
                        </div>
                      </div>

                      <div className="horizontal-form-group">
                        <div className="admin-form-group">
                          <div className="mat">
                            <input
                              className={`mat-input${formErrors.salary ? " mat-error" : ""}`}
                              placeholder=" "
                              required
                              type="number"
                              value={formData.salary}
                              onChange={(e) => { setFormData({ ...formData, salary: e.target.value }); setFormErrors(p => ({ ...p, salary: false })); }}
                            />
                            <label className={`mat-label${formErrors.salary ? " mat-label-error" : ""}`}>Salary<span className="rf-req">*</span></label>
                            <span className={`mat-bar${formErrors.salary ? " mat-bar-error" : ""}`} />
                          </div>
                        </div>

                        <div className="admin-form-group">
                          <div className="mat">
                            <input
                              className={`mat-input${formErrors.education ? " mat-error" : ""}`}
                              placeholder=" "
                              required
                              type="text"
                              value={formData.education}
                              onChange={(e) => { setFormData({ ...formData, education: allowTextInput(formData.education, e.target.value, 100, 5) }); setFormErrors(p => ({ ...p, education: false })); }}
                            />
                            <label className={`mat-label${formErrors.education ? " mat-label-error" : ""}`}>Education<span className="rf-req">*</span></label>
                            <span className={`mat-bar${formErrors.education ? " mat-bar-error" : ""}`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="">Documents</label>
                    <div className="horizontal-form-group border" style={{ flexBasis: "33%" }}>
                      {/* ------------------------------- FILES ------------------------------- */}

                      <div className="file-wrap">
                        <label className={formErrors.idProof ? "mat-label-error" : ""}>ID Proof<span className="rf-req">*</span></label>
                        <input className={`file-input${formErrors.idProof ? " mat-error" : ""}`} required type="file" onChange={(e) => { handleFile(e, "idProof"); setFormErrors(p => ({ ...p, idProof: false })); }} />
                        <div className={`file-label${formErrors.idProof ? " file-label-error" : ""}`}>
                          {formData.idProof ? "✔ File selected" : "Choose file…"}
                        </div>
                        {formData.idProof && (
                          <img
                            src={formData.idProof}
                            alt="Preview"
                            className="staff-image-preview"
                          />
                        )}
                      </div>

                      <div className="file-wrap">
                        <label className={formErrors.idImage ? "mat-label-error" : ""}>ID Image<span className="rf-req">*</span></label>
                        <input className={`file-input${formErrors.idImage ? " mat-error" : ""}`} required type="file" onChange={(e) => { handleFile(e, "idImage"); setFormErrors(p => ({ ...p, idImage: false })); }} />
                        <div className={`file-label${formErrors.idImage ? " file-label-error" : ""}`}>
                          {formData.idImage ? "✔ File selected" : "Choose file…"}
                        </div>
                        {formData.idImage && (
                          <img
                            src={formData.idImage}
                            alt="Preview"
                            className="staff-image-preview"
                          />
                        )}
                      </div>

                      <div className="file-wrap">
                        <label className={formErrors.bonafide ? "mat-label-error" : ""}>Bonafide<span className="rf-req">*</span></label>
                        <input className={`file-input${formErrors.bonafide ? " mat-error" : ""}`} required type="file" onChange={(e) => { handleFile(e, "bonafide"); setFormErrors(p => ({ ...p, bonafide: false })); }} />
                        <div className={`file-label${formErrors.bonafide ? " file-label-error" : ""}`}>
                          {formData.bonafide ? "✔ File selected" : "Choose file…"}
                        </div>
                        {formData.bonafide && (
                          <img
                            src={formData.bonafide}
                            alt="Preview"
                            className="staff-image-preview"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ------------------------------- PREVIOUS EXPERIENCE ------------------------------- */}
                  <div className="admin-form-group">
                    <label>Previous Experience</label>

                    <div className="admin-form-group border">
                      {/* INPUT ROW */}
                      <div className="experience-input-row">

                        <div className="admin-form-group">
                          <div className="mat">
                            <input
                              className="mat-input"
                              placeholder=" "
                              required
                              value={tempExp.org}
                              onChange={(e) => setTempExp({ ...tempExp, org: allowTextInput(tempExp.org, e.target.value, 100, 5) })}
                            />
                            <label className="mat-label">Organization<span className="rf-req">*</span></label>
                            <span className="mat-bar" />
                          </div>
                        </div>

                        <div className="admin-form-group">
                          <div className="mat">
                            <input
                              className="mat-input"
                              placeholder=" "
                              required
                              value={tempExp.place}
                              onChange={(e) => setTempExp({ ...tempExp, place: allowTextInput(tempExp.place, e.target.value, 100, 5) })}
                            />
                            <label className="mat-label">Place<span className="rf-req">*</span></label>
                            <span className="mat-bar" />
                          </div>
                        </div>

                        <Button3D onClick={() => {
                          if (!tempExp.org || !tempExp.place) return;

                          setFormData({
                            ...formData,
                            previousExperience: [
                              ...formData.previousExperience.filter(e => e.org || e.place),
                              tempExp
                            ]
                          });

                          setTempExp({ org: "", place: "" });
                        }}>Add</Button3D>
                      </div>

                      {/* TABLE */}
                      {formData.previousExperience.filter(e => e.org || e.place).length > 0 && (
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th>Organization</th>
                              <th>Place</th>
                              <th>Remove</th>
                            </tr>
                          </thead>

                          <tbody>
                            {formData.previousExperience.map((exp, i) => (
                              <tr key={i}>
                                <td>{exp.org}</td>
                                <td>{exp.place}</td>
                                <td>
                                  <button
                                    className="exp-delete-btn"
                                    onClick={() => {
                                      const updated = formData.previousExperience.filter((_, idx) => idx !== i);
                                      setFormData({ ...formData, previousExperience: updated });
                                    }}
                                  >
                                    <img src={deleteIcon} alt="" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="staff-form admin-form-group">
                    <label htmlFor="">Contact Details</label>

                    <div className="horizontal-form-group border">
                      {/* ------------------------------- CONTACT ------------------------------- */}

                      <div className="admin-form-group">
                        <div className="mat">
                          <input
                            className={`mat-input${formErrors.contact ? " mat-error" : ""}`}
                            placeholder=" "
                            required
                            type="number"
                            value={formData.contact}
                            onChange={(e) => { setFormData({ ...formData, contact: e.target.value }); setFormErrors(p => ({ ...p, contact: false })); }}
                          />
                          <label className={`mat-label${formErrors.contact ? " mat-label-error" : ""}`}>Contact Number<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.contact ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>

                      <div className="admin-form-group">
                        <div className="mat">
                          <input
                            className={`mat-input${formErrors.altContact ? " mat-error" : ""}`}
                            placeholder=" "
                            required
                            type="number"
                            value={formData.altContact}
                            onChange={(e) => { setFormData({ ...formData, altContact: e.target.value }); setFormErrors(p => ({ ...p, altContact: false })); }}
                          />
                          <label className={`mat-label${formErrors.altContact ? " mat-label-error" : ""}`}>Alternate Contact<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.altContact ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="staff-form admin-form-group">
                    <label htmlFor="">Address Details</label>

                    <div className="admin-form-group border">
                      {/* ------------------------------- ADDRESS ------------------------------- */}
                      <div className="admin-form-group">
                        <div className="mat">
                          <textarea
                            className={`mat-input mat-textarea${formErrors.residentialAddress ? " mat-error" : ""}`}
                            placeholder=" "
                            value={formData.residentialAddress}
                            onChange={(e) => {
                              const value = allowTextInput(formData.residentialAddress, e.target.value, 500, 100000);
                              setFormData(prev => ({
                                ...prev,
                                residentialAddress: value,
                                permanentAddress: sameAddress ? value : prev.permanentAddress
                              }));
                              setFormErrors(p => ({ ...p, residentialAddress: false }));
                            }}
                          />
                          <label className={`mat-label${formErrors.residentialAddress ? " mat-label-error" : ""}`}>Residential Address<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.residentialAddress ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>

                      <div className="admin-form-group">
                        <label className={`mat-label${formErrors.permanentAddress ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, color: "#6b7280", marginBottom: 4, display: "block" }}>Permanent Address<span className="rf-req">*</span></label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 6 }}>
                          <input required
                            type="checkbox"
                            className="checkbox"
                            checked={sameAddress}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSameAddress(checked);
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  permanentAddress: formData.residentialAddress
                                });
                                setFormErrors(p => ({ ...p, permanentAddress: false }));
                              }
                            }}
                          />
                          Same as Residential Address
                        </label>
                        <div className="mat">
                          <textarea
                            className={`mat-input mat-textarea${formErrors.permanentAddress ? " mat-error" : ""}`}
                            placeholder=" "
                            value={formData.permanentAddress}
                            onChange={(e) => { setFormData({ ...formData, permanentAddress: allowTextInput(formData.permanentAddress, e.target.value, 500, 100000) }); setFormErrors(p => ({ ...p, permanentAddress: false })); }}
                          />
                          <label className={`mat-label${formErrors.permanentAddress ? " mat-label-error" : ""}`}>Permanent Address<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.permanentAddress ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ------------------------------- BANK ------------------------------- */}
                  <div className="admin-form-group">
                    <label htmlFor="">Bank Details</label>
                    <div className="horizontal-form-group border">

                      <div className="admin-form-group">
                        <div className="mat">
                          <input
                            className={`mat-input${formErrors.bankName ? " mat-error" : ""}`}
                            placeholder=" "
                            required
                            value={formData.bank.name}
                            onChange={(e) => { setFormData({ ...formData, bank: { ...formData.bank, name: allowTextInput(formData.bank.name, e.target.value, 100, 5) } }); setFormErrors(p => ({ ...p, bankName: false })); }}
                          />
                          <label className={`mat-label${formErrors.bankName ? " mat-label-error" : ""}`}>Bank Name<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.bankName ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>

                      <div className="admin-form-group">
                        <div className="mat">
                          <input
                            className={`mat-input${formErrors.bankAccount ? " mat-error" : ""}`}
                            placeholder=" "
                            required
                            type="number"
                            value={formData.bank.account}
                            onChange={(e) => { setFormData({ ...formData, bank: { ...formData.bank, account: e.target.value } }); setFormErrors(p => ({ ...p, bankAccount: false })); }}
                          />
                          <label className={`mat-label${formErrors.bankAccount ? " mat-label-error" : ""}`}>Account Number<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.bankAccount ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>

                      <div className="admin-form-group">
                        <div className="mat">
                          <input
                            className={`mat-input${formErrors.bankIfsc ? " mat-error" : ""}`}
                            placeholder=" "
                            required
                            value={formData.bank.ifsc}
                            onChange={(e) => { setFormData({ ...formData, bank: { ...formData.bank, ifsc: e.target.value } }); setFormErrors(p => ({ ...p, bankIfsc: false })); }}
                          />
                          <label className={`mat-label${formErrors.bankIfsc ? " mat-label-error" : ""}`}>IFSC Code<span className="rf-req">*</span></label>
                          <span className={`mat-bar${formErrors.bankIfsc ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ------------------------------- REFERENCE ------------------------------- */}

                  <div className="admin-form-group">
                    <div className="mat">
                      <input
                        className={`mat-input${formErrors.reference ? " mat-error" : ""}`}
                        placeholder=" "
                        required
                        value={formData.reference}
                        onChange={(e) => { setFormData({ ...formData, reference: allowTextInput(formData.reference, e.target.value, 100, 5) }); setFormErrors(p => ({ ...p, reference: false })); }}
                      />
                      <label className={`mat-label${formErrors.reference ? " mat-label-error" : ""}`}>Reference<span className="rf-req">*</span></label>
                      <span className={`mat-bar${formErrors.reference ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="staff-preview-card">

                  <div className="preview-header">
                    <img src={formData.idImage} alt="" className="staff-image-preview" />
                    <div className="preview-header-details">
                      <div className="preview-header-details-name">{formData.name}</div>
                      <div className="preview-header-details-others">{formData.role}</div>
                      <div className="preview-header-details-others">{formData.workType}</div>
                    </div>
                  </div>

                  {/* FILES */}
                  {(formData.idProof || formData.idImage || formData.bonafide) && (
                    <div className="preview-section">
                      <h4>Documents</h4>
                      <div style={{ display: "flex", gap: "10px" }}>
                        {formData.idProof &&
                          <div className="admin-form-group">
                            <label>ID proof</label>
                            <img
                              src={formData.idProof}
                              className="staff-image-preview"
                            />
                          </div>
                        }

                        {formData.idProof &&
                          <div className="admin-form-group">
                            <label>ID Image</label>
                            <img
                              src={formData.idImage}
                              className="staff-image-preview"
                            />
                          </div>
                        }

                        {formData.bonafide &&
                          <div className="admin-form-group">
                            <label>Bonafide</label>
                            <img
                              src={formData.bonafide}
                              className="staff-image-preview"
                            />
                          </div>
                        }
                      </div>
                    </div>
                  )
                  }

                  {/* PERSONAL */}
                  <div className="preview-section">
                    <h4>Personal</h4>
                    <table className="preview-table">
                      <tbody>
                        <tr><td>DOB</td><td>{formData.dob}</td></tr>
                        <tr><td>Date of Joining</td><td>₹{formData.joiningDate}</td></tr>
                        <tr><td>Education</td><td>{formData.education}</td></tr>
                        <tr><td>Experience</td><td>{formData.experience}</td></tr>
                        <tr><td>Salary</td><td>₹{formData.salary}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* CONTACT */}
                  <div className="preview-section">
                    <h4>Contact</h4>
                    <table className="preview-table">
                      <tbody>
                        <tr><td>Phone</td><td>{formData.contact}</td></tr>
                        <tr><td>Alt</td><td>{formData.altContact}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* ADDRESS */}
                  <div className="preview-section">
                    <h4>Address</h4>
                    <table className="preview-table">
                      <tbody>
                        <tr><td>Residential</td><td>{formData.residentialAddress}</td></tr>
                        <tr><td>Permanent</td><td>{formData.permanentAddress}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* EXPERIENCE TABLE */}
                  {formData.previousExperience.length > 0 && (
                    <div className="preview-section">
                      <h4>Previous Experience</h4>
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Organization</th>
                            <th>Place</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.previousExperience.map((exp, i) => (
                            <tr key={i}>
                              <td>{exp.org}</td>
                              <td>{exp.place}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* LOGIN ACCOUNT SUMMARY */}
                  {!isEditMode && accountForm.enabled && (
                    <div className="preview-section">
                      <h4>Login Account</h4>
                      <p><strong>Email:</strong> {accountForm.email}</p>
                      <p><strong>Role:</strong> {accountForm.roleTitle}</p>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="admin-modal-footer">
              {createdAccountInfo ? (
                <Button3D onClick={resetForm}>Done</Button3D>
              ) : !isEditMode && canManageStaffAccounts && createStep === 0 ? (
                <>
                  <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
                  <Button3D onClick={() => { if (validateStaff()) setCreateStep(1); }}>Next</Button3D>
                </>
              ) : !isEditMode && canManageStaffAccounts && createStep === 1 ? (
                <>
                  <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
                  <Button3D onClick={() => setCreateStep(0)}>Back</Button3D>
                  <Button3D onClick={() => { if (validateAccountStep()) { setCreateStep(2); setPreviewMode(true); } }}>Preview</Button3D>
                </>
              ) : !previewMode ? (
                <>
                  <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
                  <Button3D onClick={() => { if (validateStaff()) setPreviewMode(true); }}>Preview</Button3D>
                </>
              ) : (
                <>
                  <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
                  <Button3D onClick={() => { setPreviewMode(false); if (!isEditMode && canManageStaffAccounts) setCreateStep(accountForm.enabled ? 1 : 0); }}>Edit</Button3D>
                  <Button3D onClick={handleSave} disabled={accountSaving}>{accountSaving ? "Saving…" : "Save"}</Button3D>
                </>
              )}
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
}