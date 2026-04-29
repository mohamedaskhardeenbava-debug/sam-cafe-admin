import React, { useState, useMemo } from "react";
import "./Staffs.css";
import { sortArray } from "../../App";
import editIcon from "../../icon/edit-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import { useNavigate, useLocation } from "react-router-dom";

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

const generateStaffId = (name) =>
    "staff_" + name.toLowerCase().replace(/\s+/g, "_");

export default function Staffs({
    adminData,
    onAdd,
    onUpdate,
    onDelete,
    sortConfig,
    handleSort
}) {
    const [showModal, setShowModal] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [tempExp, setTempExp] = useState({ org: "", place: "" });
    const [sameAddress, setSameAddress] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [workTypeFilter, setWorkTypeFilter] = useState(location.state?.workType || "");

    const staffs = useMemo(() => {
        const sorted = sortArray(adminData.staff || [], sortConfig);
        return workTypeFilter ? sorted.filter(s => (s.workType || "full-time") === workTypeFilter) : sorted;
    }, [adminData.staff, sortConfig, workTypeFilter]);

    const resetForm = () => {
        setFormData(EMPTY_FORM);
        setPreviewMode(false);
        setIsEditMode(false);
        setShowModal(false);
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

    const handleSave = () => {
        const payload = {
            ...formData,
            id: generateStaffId(formData.name)
        };

        isEditMode ? onUpdate(payload.id, payload) : onAdd(payload);
        resetForm();
    };

    return (
        <div className="staff-page">
            {/* HEADER */}
            <div className="staff-header">
                <div className="staff-filter-pills">
                    {[["", "All"], ["full-time", "Full-Time"], ["part-time", "Part-Time"]].map(([k, lbl]) => (
                        <button key={k} className={`sched-pill-btn${workTypeFilter === k ? " active" : ""}`} onClick={() => setWorkTypeFilter(k)}>{lbl}</button>
                    ))}
                </div>
                <h2>Staff</h2>
                <button
                    className="staff-add-btn"
                    onClick={() => {
                        setFormData(EMPTY_FORM);
                        setShowModal(true);
                    }}
                >
                    + Add Staff
                </button>
            </div>

            {/* TABLE */}
            <div className="staff-table-wrapper">
                <table className="staff-table">
                    <thead>
                        <tr>
                            <th style={{ width: 200 }}>Name</th>
                            <th>Role</th>
                            <th>Salary</th>
                            <th>Exp</th>
                            <th>Contact</th>
                            <th>Work Type</th>
                            <th style={{ width: 80 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {staffs.map((staff, i) => {
                            const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3", "#fb8500", "#023e8a"];
                            const avatarBg = PALETTE[i % PALETTE.length];
                            return (
                                <tr key={staff.id} className="clickable" onClick={() => navigate(`/staff/${staff.id}`)}>
                                    <td>
                                        <div className="st-name-cell">
                                            <div className="st-avatar" style={{ background: avatarBg }}>
                                                {(staff.name || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="st-name">{staff.name}</div>
                                                <div className="st-join">Joined {staff.joiningDate || "—"}</div>
                                            </div>
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
                                        <div className="st-actions">
                                            <button className="st-act-btn st-edit"
                                                onClick={() => { setFormData(staff); setIsEditMode(true); setShowModal(true); }}
                                                title="Edit">✏️</button>
                                            <button className="st-act-btn st-delete"
                                                onClick={() => onDelete(staff.id)}
                                                title="Delete">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="staff-modal-overlay">
                    <div className="staff-modal">
                        {/* HEADER */}
                        <div className="staff-modal-header">
                            <h3>
                                {previewMode
                                    ? "Preview Staff Details"
                                    : isEditMode
                                        ? "Edit Staff"
                                        : "Add Staff"}
                            </h3>
                            <button onClick={resetForm}>✖</button>
                        </div>

                        {/* BODY */}
                        <div className="staff-modal-body">
                            {!previewMode ? (
                                <>
                                    <div className="horizantal-form-group">
                                        {/* BASIC INFO */}
                                        <div className="horizontal-form-group">
                                            <div className="form-group">
                                                <label>Full Name</label>
                                                <input required
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, name: e.target.value })
                                                    }
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Role</label>
                                                <select
                                                    value={formData.role}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, role: e.target.value })
                                                    }
                                                >
                                                    <option value="">Select Role</option>
                                                    {roles.map(role => (
                                                        <option key={role} value={role}>
                                                            {role}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="form-group">
                                                <label>Joining Date</label>
                                                <input required
                                                    type="date"
                                                    value={formData.joiningDate}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, joiningDate: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ================= WORK TYPE ================= */}
                                    <div className="form-group">
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

                                    <div className="form-group">
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

                                    <div className="form-group">
                                        <label htmlFor="">Personal Details</label>
                                        <div className="form-group border">
                                            <div className="horizontal-form-group">
                                                <div className="form-group">
                                                    <label>Date of Birth</label>
                                                    <input required
                                                        type="date"
                                                        value={formData.dob}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, dob: e.target.value })
                                                        }
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>Experience</label>
                                                    <input required
                                                        type="number"
                                                        value={formData.experience}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, experience: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className="horizontal-form-group">
                                                <div className="form-group">
                                                    <label>Salary</label>
                                                    <input required
                                                        type="number"
                                                        value={formData.salary}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, salary: e.target.value })
                                                        }
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>Education</label>
                                                    <input required
                                                        type="text"
                                                        value={formData.education}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, education: e.target.value })
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="">Documents</label>
                                        <div className="horizontal-form-group border">
                                            {/* ================= FILES ================= */}

                                            <div className="form-group">
                                                <label>ID Proof</label>
                                                <input required type="file" onChange={(e) => handleFile(e, "idProof")} />
                                                {formData.idProof && (
                                                    <img
                                                        src={formData.idProof}
                                                        alt="Preview"
                                                        className="staff-image-preview"
                                                    />
                                                )}
                                            </div>

                                            <div className="form-group">
                                                <label>ID Image</label>
                                                <input required type="file" onChange={(e) => handleFile(e, "idImage")} />
                                                {formData.idImage && (
                                                    <img
                                                        src={formData.idImage}
                                                        alt="Preview"
                                                        className="staff-image-preview"
                                                    />
                                                )}
                                            </div>

                                            <div className="form-group">
                                                <label>Bonafide</label>
                                                <input required type="file" onChange={(e) => handleFile(e, "bonafide")} />
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

                                    {/* ================= PREVIOUS EXPERIENCE ================= */}
                                    <div className="form-group">
                                        <label>Previous Experience</label>

                                        <div className="form-group border">
                                            {/* INPUT ROW */}
                                            <div className="experience-input-row">
                                                <div className="form-group">
                                                    <label htmlFor="">Organization</label>
                                                    <input required
                                                        value={tempExp.org}
                                                        onChange={(e) => setTempExp({ ...tempExp, org: e.target.value })}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="Place">Place</label>
                                                    <input required
                                                        value={tempExp.place}
                                                        onChange={(e) => setTempExp({ ...tempExp, place: e.target.value })}
                                                    />
                                                </div>

                                                <button
                                                    className="org-add-btn"
                                                    type="button"
                                                    onClick={() => {
                                                        if (!tempExp.org || !tempExp.place) return;

                                                        setFormData({
                                                            ...formData,
                                                            previousExperience: [
                                                                ...formData.previousExperience.filter(e => e.org || e.place),
                                                                tempExp
                                                            ]
                                                        });

                                                        setTempExp({ org: "", place: "" });
                                                    }}
                                                >
                                                    Add
                                                </button>
                                            </div>

                                            {/* TABLE */}
                                            {formData.previousExperience.filter(e => e.org || e.place).length > 0 && (
                                                <table className="exp-table">
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

                                    <div className="staff-form form-group">
                                        <label htmlFor="">Contact Details</label>

                                        <div className="horizontal-form-group border">
                                            {/* ================= CONTACT ================= */}
                                            <div className="form-group">
                                                <label>Contact Number</label>
                                                <input required
                                                    type="number"
                                                    value={formData.contact}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, contact: e.target.value })
                                                    }
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Alternate Contact</label>
                                                <input required
                                                    type="number"
                                                    value={formData.altContact}
                                                    onChange={(e) =>
                                                        setFormData({ ...formData, altContact: e.target.value })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="staff-form form-group">
                                        <label htmlFor="">Address Details</label>

                                        <div className="form-group border">
                                            {/* ================= ADDRESS ================= */}
                                            <div className="form-group">
                                                <label>Residential Address</label>
                                                <textarea
                                                    value={formData.residentialAddress}
                                                    onChange={(e) => {
                                                        const value = e.target.value;

                                                        setFormData(prev => ({
                                                            ...prev,
                                                            residentialAddress: value,
                                                            permanentAddress: sameAddress ? value : prev.permanentAddress
                                                        }));
                                                    }}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Permanent Address</label>
                                                <label>
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
                                                            }
                                                        }}
                                                    />
                                                    Same as Residential Address
                                                </label>
                                                <textarea
                                                    value={formData.permanentAddress}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            permanentAddress: e.target.value
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ================= BANK ================= */}
                                    <div className="form-group">
                                        <label htmlFor="">Bank Details</label>
                                        <div className="horizontal-form-group border">
                                            <div className="form-group">
                                                <label>Bank Name</label>
                                                <input required
                                                    value={formData.bank.name}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            bank: { ...formData.bank, name: e.target.value }
                                                        })
                                                    }
                                                />
                                            </div>


                                            <div className="form-group">
                                                <label>Account Number</label>
                                                <input required
                                                    type="number"
                                                    value={formData.bank.account}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            bank: { ...formData.bank, account: e.target.value }
                                                        })
                                                    }
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>IFSC Code</label>
                                                <input required
                                                    value={formData.bank.ifsc}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            bank: { ...formData.bank, ifsc: e.target.value }
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ================= REFERENCE ================= */}
                                    <div className="form-group">
                                        <label>Reference</label>
                                        <input required
                                            value={formData.reference}
                                            onChange={(e) =>
                                                setFormData({ ...formData, reference: e.target.value })
                                            }
                                        />
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
                                                    <div className="form-group">
                                                        <label>ID proof</label>
                                                        <img
                                                            src={formData.idProof}
                                                            className="staff-image-preview"
                                                        />
                                                    </div>
                                                }

                                                {formData.idProof &&
                                                    <div className="form-group">
                                                        <label>ID Image</label>
                                                        <img
                                                            src={formData.idImage}
                                                            className="staff-image-preview"
                                                        />
                                                    </div>
                                                }

                                                {formData.bonafide &&
                                                    <div className="form-group">
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
                        <div className="staff-modal-footer">
                            {!previewMode ? (
                                <>
                                    <button onClick={() => setPreviewMode(true)}>
                                        Preview
                                    </button>
                                    <button onClick={resetForm}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={handleSave}>Save</button>
                                    <button onClick={() => setPreviewMode(false)}>
                                        Edit
                                    </button>
                                    <button onClick={resetForm}>Cancel</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}