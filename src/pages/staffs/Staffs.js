/**
 * Staffs.js  —  Sam Cafe Admin Panel
 * Staff list and management page
 */

import React, { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { exportToExcel } from "../../utils/excelUtils";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import api from "../../api";
import { createRecord, updateRecord, deleteRecord } from "../../utils/crudUtils";

import { sortArray } from "../../App";
import editIcon from "../../icon/edit-icon.png";
import closeIcon from "../../icon/close-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";
import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";
import CustomDropdown from "../../components/CustomDropdown";

import "./Staffs.css";
import "../ModalCSS.css";
import PageLoader from "../../components/PageLoader";

const roles = ["Chef", "Waiter", "Supervisor", "Manager", "Cleaner"];

const EMPTY_FORM = {
  id: "",
  name: "",
  dob: "",
  role: "",
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
  const [showModal, setShowModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [tempExp, setTempExp] = useState({ org: "", place: "" });
  const [sameAddress, setSameAddress] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const [workTypeFilter, setWorkTypeFilter] = useState(location.state?.workType || "");
  const [staffSearch, setStaffSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const staffs = useMemo(() => {
    let sorted = sortArray(adminData.staff || [], sortConfig);
    if (workTypeFilter) sorted = sorted.filter(s => (s.workType || "full-time") === workTypeFilter);
    if (roleFilter) sorted = sorted.filter(s => s.role === roleFilter);
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase();
      sorted = sorted.filter(s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.role || "").toLowerCase().includes(q) ||
        (s.contact || "").includes(q)
      );
    }
    return sorted;
  }, [adminData.staff, sortConfig, workTypeFilter, roleFilter, staffSearch]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(staffs.length, 30);
  if (!adminData?.staff?.length) return <PageLoader label="Loading staff…" />;

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
    setShowModal(false);
    setFormErrors({});
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

  const handleSave = () => {
    const payload = {
      ...formData,
      id: isEditMode ? formData.id : generateStaffId(formData.name)
    };

    isEditMode ? onUpdate(payload.id, payload) : onAdd(payload);
    toast.success(isEditMode ? "Staff updated" : "Staff added");
    resetForm();
  };

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <h2 className="title">Staff</h2>
        <div className="header-btn-container">
          <Button3D onClick={exportStaffs}>Export</Button3D>
          <Button3D onClick={() => { setFormData(EMPTY_FORM); setShowModal(true); }}>+ Add Staff</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="filter-groups">
          <input
            className="search-input"
            placeholder=" Search name, role, contact…"
            value={staffSearch}
            onChange={e => setStaffSearch(e.target.value)}
          />

          <div className="filter-group">
            <span className="filter-group-label">Work Type</span>
            {[["", "All"], ["full-time", "Full-Time"], ["part-time", "Part-Time"], ["double-shift", "Double Shift"]].map(([k, lbl]) => (
              <button key={k} className={`filter-pill${workTypeFilter === k ? " active" : ""}`} onClick={() => setWorkTypeFilter(k)}>{lbl}</button>
            ))}
          </div>
          <div className="filter-group">
            <span className="filter-group-label">Role</span>
            {[["", "All"], ...roles.map(r => [r, r])].map(([k, lbl]) => (
              <button key={k} className={`filter-pill${roleFilter === k ? " active" : ""}`} onClick={() => setRoleFilter(k)}>{lbl}</button>
            ))}
          </div>
          {(staffSearch || workTypeFilter || roleFilter) && (
            <button className="ae-clear-filter" onClick={() => { setStaffSearch(""); setWorkTypeFilter(""); setRoleFilter(""); }}>Clear</button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="table-wrapper" style={{ maxHeight: "calc(100vh - 260px)" }} ref={containerRef}>
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
            {staffs.slice(0, displayLimit).map((staff, i) => {
              const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3", "#fb8500", "#023e8a"];
              const avatarBg = PALETTE[i % PALETTE.length];
              return (
                <tr key={staff.id}>
                  <td>
                    <div className="st-name-cell">
                      <div className="st-avatar" style={{ background: avatarBg }}>
                        {(staff.name || "?").charAt(0).toUpperCase()}
                      </div>
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
                  <td>
                    <span className={`st-worktype-badge st-wt-${(staff.workType || "full-time").replace("-", "")}`}>
                      {staff.workType || "full-time"}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <Button3D variant="cancel" iconOnly onClick={() => { setFormData(staff); setIsEditMode(true); setShowModal(true); }}
                      title="Edit"><img src={editIcon} alt="" /></Button3D>
                  </td>

                  <td onClick={e => e.stopPropagation()}>
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
            })}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={8}
            />
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="admin-modal">
            {/* HEADER */}
            <div className="admin-modal-header">
              <h3>
                {previewMode
                  ? "Preview Staff Details"
                  : isEditMode
                    ? "Edit Staff"
                    : "Add Staff"}
              </h3>
              <Button3D variant="cancel" iconOnly onClick={resetForm}><img src={closeIcon} /></Button3D>
            </div>

            {/* BODY */}
            <div className="admin-modal-body">
              {!previewMode ? (
                <>
                  <div className="admin-form-group">
                    <div className="mat">
                      <input
                        className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                        placeholder=" "
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFormErrors(p => ({ ...p, name: false })); }}
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
                          options={roles}
                          placeholder="Select Role"
                          hasError={!!formErrors.role}
                        />
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
                              onChange={(e) => { setFormData({ ...formData, education: e.target.value }); setFormErrors(p => ({ ...p, education: false })); }}
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
                              onChange={(e) => setTempExp({ ...tempExp, org: e.target.value })}
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
                              onChange={(e) => setTempExp({ ...tempExp, place: e.target.value })}
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
                              const value = e.target.value;
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
                            onChange={(e) => { setFormData({ ...formData, permanentAddress: e.target.value }); setFormErrors(p => ({ ...p, permanentAddress: false })); }}
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
                            onChange={(e) => { setFormData({ ...formData, bank: { ...formData.bank, name: e.target.value } }); setFormErrors(p => ({ ...p, bankName: false })); }}
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
                        onChange={(e) => { setFormData({ ...formData, reference: e.target.value }); setFormErrors(p => ({ ...p, reference: false })); }}
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

                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="admin-modal-footer">
              {!previewMode ? (
                <>
                  <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
                  <Button3D onClick={() => { if (validateStaff()) setPreviewMode(true); }}>Preview</Button3D>
                </>
              ) : (
                <>
                  <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
                  <Button3D onClick={() => setPreviewMode(false)}>edit</Button3D>
                  <Button3D onClick={handleSave}>Save</Button3D>

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
