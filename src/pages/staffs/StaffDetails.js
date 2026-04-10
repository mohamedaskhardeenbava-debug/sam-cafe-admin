import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api";
import editIcon from "../../icon/edit-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import "./StaffDetails.css";

const StaffDetails = ({ adminData, setAdminData }) => {
    const { staffId } = useParams();
    const navigate = useNavigate();

    const staff = adminData.staff.find(s => s.id === staffId);

    const [localStaff, setLocalStaff] = useState(null);
    const [editSection, setEditSection] = useState(null);
    const [editingExp, setEditingExp] = useState([]);
    const [sameAddress, setSameAddress] = useState(false);

    useEffect(() => {
        if (staff) {
            setLocalStaff(JSON.parse(JSON.stringify(staff)));
        }
    }, [staff]);

    if (!localStaff) return <div>Loading...</div>;

    /* ================= SAVE ================= */
    const persistStaff = async (updated) => {
        try {
            await api.put(`/staff/${staffId}`, updated);

            setAdminData(prev => ({
                ...prev,
                staff: prev.staff.map(s =>
                    s.id === staffId ? updated : s
                )
            }));

            setEditSection(null);
            setLocalStaff(updated);

        } catch (err) {
            console.error("Update failed:", err);
        }
    };

    /* ================= IMAGE ================= */
    const handleImageUpload = (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const updated = { ...localStaff, [field]: reader.result };
            setLocalStaff(updated);
            await persistStaff(updated);
        };
        reader.readAsDataURL(file);
    };

    /* ================= EXPERIENCE ================= */
    const startExpEdit = () => {
        setEditingExp([...localStaff.previousExperience]);
        setEditSection("experience");
    };

    const saveExp = async () => {
        await persistStaff({
            ...localStaff,
            previousExperience: editingExp
        });
    };

    return (
        <div className="staff-details-page">
            <div className="dish-container">

                {/* HEADER */}
                <div className="dish-details-header">
                    <button className="back-btn" onClick={() => navigate(-1)} />
                    <h2>{localStaff.name}</h2>
                </div>

                {/* IMAGE */}
                <div className="staff-image-row">

                    {/* PROFILE IMAGE */}
                    <div className="staff-details-image">
                        <span>Staff Image</span>
                        <img src={localStaff.idImage || "/placeholder.png"} alt="" />

                        <label className="image-upload-btn">
                            Change
                            <input
                                type="file"
                                hidden
                                onChange={(e) => handleImageUpload(e, "idImage")}
                            />
                        </label>
                    </div>

                    <div className="name-section">
                        {/* NAME */}
                        <div className="section">
                            <div className="section-title">
                                <span>Name</span>
                                <img
                                    className="edit-icon"
                                    src={editIcon}
                                    onClick={() => setEditSection("name")}
                                />
                            </div>

                            {editSection === "name" ? (
                                <>
                                    <div className="form-group">
                                        <label>Full Name</label>
                                        <input
                                            value={localStaff.name}
                                            onChange={(e) =>
                                                setLocalStaff({ ...localStaff, name: e.target.value })
                                            }
                                        />
                                    </div>

                                    <div className="actions">
                                        <button onClick={() => persistStaff(localStaff)}>Save</button>
                                        <button onClick={() => setEditSection(null)}>Cancel</button>
                                    </div>
                                </>
                            ) : (
                                <p>{localStaff.name}</p>
                            )}
                        </div>

                        {/* ROLE */}
                        <div className="section">
                            <div className="section-title">
                                <span>Role</span>
                                <img className="edit-icon" src={editIcon} onClick={() => setEditSection("role")} />
                            </div>

                            {editSection === "role" ? (
                                <div className="form-group">
                                    <label htmlFor="">Role</label>
                                    <input
                                        value={localStaff.role}
                                        onChange={(e) =>
                                            setLocalStaff({ ...localStaff, role: e.target.value })
                                        }
                                    />
                                    <div className="actions">
                                        <button onClick={() => persistStaff(localStaff)}>Save</button>
                                        <button onClick={() => setEditSection(null)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <p>{localStaff.role}</p>
                            )}
                        </div>

                        {/* WORK TYPE */}
                        <div className="section">
                            <div className="section-title">
                                <span>Work Type</span>
                                <img
                                    className="edit-icon"
                                    src={editIcon}
                                    onClick={() => setEditSection("workType")}
                                />
                            </div>

                            {editSection === "workType" ? (
                                <>
                                    <div className="form-group">
                                        <label>Work Type</label>

                                        <div className="radio-group">
                                            {["part-time", "full-time", "double-shift"].map((type) => (
                                                <label key={type} className="radio-btn">
                                                    <input
                                                        type="radio"
                                                        className="radio"
                                                        checked={
                                                            (localStaff.workType || "full-time") === type
                                                        }
                                                        onChange={() =>
                                                            setLocalStaff({
                                                                ...localStaff,
                                                                workType: type
                                                            })
                                                        }
                                                    />
                                                    {type}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="actions">
                                        <button onClick={() => persistStaff(localStaff)}>Save</button>
                                        <button onClick={() => setEditSection(null)}>Cancel</button>
                                    </div>
                                </>
                            ) : (
                                <p>{localStaff.workType || "full-time"}</p>
                            )}
                        </div>

                        {/* EMPLOYMENT TYPE */}
                        <div className="section">
                            <div className="section-title">
                                <span>Employment Type</span>
                                <img
                                    className="edit-icon"
                                    src={editIcon}
                                    onClick={() => setEditSection("employmentType")}
                                />
                            </div>

                            {editSection === "employmentType" ? (
                                <>
                                    <div className="form-group">
                                        <label>Employment Type</label>

                                        <div className="radio-group">
                                            {["permanent", "trainee", "intern"].map((type) => (
                                                <label key={type} className="radio-btn">
                                                    <input
                                                        type="radio"
                                                        className="radio"
                                                        checked={
                                                            (localStaff.employmentType || "permanent") === type
                                                        }
                                                        onChange={() =>
                                                            setLocalStaff({
                                                                ...localStaff,
                                                                employmentType: type
                                                            })
                                                        }
                                                    />
                                                    {type}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="actions">
                                        <button onClick={() => persistStaff(localStaff)}>Save</button>
                                        <button onClick={() => setEditSection(null)}>Cancel</button>
                                    </div>
                                </>
                            ) : (
                                <p>{localStaff.employmentType || "permanent"}</p>
                            )}
                        </div>

                        <div className="section">
                            <div className="section-title">
                                <span>Date of Joining</span>
                                <img className="edit-icon" src={editIcon} onClick={() => setEditSection("joiningdate")} />
                            </div>

                            {editSection === "joiningdate" ? (
                                <div className="form-group">
                                    <label htmlFor="">Date of Joining</label>
                                    <input
                                        type="date"
                                        value={localStaff.joiningDate || ""}
                                        onChange={(e) =>
                                            setLocalStaff({
                                                ...localStaff,
                                                joiningDate: e.target.value
                                            })
                                        }
                                    />
                                    <div className="actions">
                                        <button onClick={() => persistStaff(localStaff)}>Save</button>
                                        <button onClick={() => setEditSection(null)}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <p>{localStaff.joiningDate}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* PERSONAL */}
                <div className="section">
                    <div className="section-title">
                        <span>Personal Details</span>
                        <img className="edit-icon" src={editIcon} onClick={() => setEditSection("personal")} />
                    </div>

                    {editSection === "personal" ? (
                        <div className="form-group">
                            <div className="form-group">
                                <label htmlFor="">DOB</label>
                                <input type="date" value={localStaff.dob}
                                    onChange={(e) => setLocalStaff({ ...localStaff, dob: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="">Educational Qualification</label>
                                <input value={localStaff.education}
                                    onChange={(e) => setLocalStaff({ ...localStaff, education: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="">Experience</label>
                                <input type="number" value={localStaff.experience}
                                    onChange={(e) => setLocalStaff({ ...localStaff, experience: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="">Salary</label>
                                <input type="number" value={localStaff.salary}
                                    onChange={(e) => setLocalStaff({ ...localStaff, salary: e.target.value })} />

                                <div className="actions">
                                    <button onClick={() => persistStaff(localStaff)}>Save</button>
                                    <button onClick={() => setEditSection(null)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <table className="staff-details-table">
                            <tbody>
                                <tr><td>DOB</td><td>{localStaff.dob}</td></tr>
                                <tr><td>Joining Date</td><td>{localStaff.joiningDate}</td></tr>
                                <tr><td>Education</td><td>{localStaff.education}</td></tr>
                                <tr><td>Experience</td><td>{localStaff.experience}</td></tr>
                                <tr><td>Salary</td><td>₹{localStaff.salary}</td></tr>
                            </tbody>
                        </table>
                    )}
                </div>

                {/* CONTACT */}
                <div className="section">
                    <div className="section-title">
                        <span>Contact Details</span>
                        <img className="edit-icon" src={editIcon} onClick={() => setEditSection("contact")} />
                    </div>

                    {editSection === "contact" ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="">Contact Number</label>
                                <input type="number" value={localStaff.contact}
                                    onChange={(e) => setLocalStaff({ ...localStaff, contact: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="">Alternate Contact Number</label>
                                <input type="number" value={localStaff.altContact}
                                    onChange={(e) => setLocalStaff({ ...localStaff, altContact: e.target.value })} />
                            </div>

                            <div className="actions">
                                <button onClick={() => persistStaff(localStaff)}>Save</button>
                                <button onClick={() => setEditSection(null)}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <table className="staff-details-table">
                            <tbody>
                                <tr><td>Phone</td><td>{localStaff.contact}</td></tr>
                                <tr><td>Alt</td><td>{localStaff.altContact}</td></tr>
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ADDRESS */}
                <div className="section">
                    <div className="section-title">
                        <span>Address Details</span>
                        <img className="edit-icon" src={editIcon} onClick={() => setEditSection("address")} />
                    </div>

                    {editSection === "address" ? (
                        <>
                            <div className="form-group">
                                <label>Residential Address</label>
                                <textarea
                                    value={localStaff.residentialAddress}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        setLocalStaff(prev => ({
                                            ...prev,
                                            residentialAddress: value,
                                            permanentAddress: sameAddress ? value : prev.permanentAddress
                                        }));
                                    }}
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={sameAddress}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSameAddress(checked);

                                            if (checked) {
                                                setLocalStaff({
                                                    ...localStaff,
                                                    permanentAddress: localStaff.residentialAddress
                                                });
                                            }
                                        }}
                                    />
                                    Same as Residential Address
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Permanent Address</label>
                                <textarea
                                    value={localStaff.permanentAddress}
                                    onChange={(e) =>
                                        setLocalStaff({
                                            ...localStaff,
                                            permanentAddress: e.target.value
                                        })
                                    }
                                />
                            </div>

                            <div className="actions">
                                <button onClick={() => persistStaff(localStaff)}>Save</button>
                                <button onClick={() => setEditSection(null)}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <table className="staff-details-table">
                            <tbody>
                                <tr><td>Residential</td><td>{localStaff.residentialAddress}</td></tr>
                                <tr><td>Permanent</td><td>{localStaff.permanentAddress}</td></tr>
                            </tbody>
                        </table>
                    )}
                </div>

                {/* BANK */}
                <div className="section">
                    <div className="section-title">
                        <span>Bank Details</span>
                        <img className="edit-icon" src={editIcon} onClick={() => setEditSection("bank")} />
                    </div>

                    {editSection === "bank" ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="">Bank Name</label>
                                <input type="number" value={localStaff.bank.name}
                                    onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, name: e.target.value } })} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="">Account Number</label>
                                <input type="number" value={localStaff.bank.account}
                                    onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, account: e.target.value } })} />
                            </div>

                            <div className="form-group">
                                <label type="number" htmlFor="">IFSC Code</label>
                                <input value={localStaff.bank.ifsc}
                                    onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, ifsc: e.target.value } })} />
                            </div>


                            <div className="actions">
                                <button onClick={() => persistStaff(localStaff)}>Save</button>
                                <button onClick={() => setEditSection(null)}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <table className="staff-details-table">
                            <tbody>
                                <tr><td>Bank</td><td>{localStaff.bank.name}</td></tr>
                                <tr><td>Account</td><td>{localStaff.bank.account}</td></tr>
                                <tr><td>IFSC</td><td>{localStaff.bank.ifsc}</td></tr>
                            </tbody>
                        </table>
                    )}
                </div>

                {/* EXPERIENCE */}
                <div className="section">
                    <div className="section-title">
                        <span>Previous Experience Details</span>
                        <img className="edit-icon" src={editIcon} onClick={startExpEdit} />
                    </div>

                    {editSection === "experience" ? (
                        <>
                            <table className="staff-details-table">
                                <thead>
                                    <tr>
                                        <th>Organization Name</th>
                                        <th>Place</th>
                                        <th>Delete</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {editingExp.map((exp, i) => (
                                        <tr key={i}>
                                            <td>
                                                <input value={exp.org}
                                                    onChange={(e) => {
                                                        const updated = [...editingExp];
                                                        updated[i].org = e.target.value;
                                                        setEditingExp(updated);
                                                    }} />
                                            </td>
                                            <td>
                                                <input value={exp.place}
                                                    onChange={(e) => {
                                                        const updated = [...editingExp];
                                                        updated[i].place = e.target.value;
                                                        setEditingExp(updated);
                                                    }} />
                                            </td>
                                            <td>
                                                <img src={deleteIcon}
                                                    onClick={() => setEditingExp(editingExp.filter((_, idx) => idx !== i))} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button onClick={() => setEditingExp([...editingExp, { org: "", place: "" }])}>
                                + Add
                            </button>

                            <div className="actions">
                                <button onClick={saveExp}>Save</button>
                                <button onClick={() => setEditSection(null)}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <table className="staff-details-table">
                            <tbody>
                                {localStaff.previousExperience.map((exp, i) => (
                                    <tr key={i}>
                                        <td>{exp.org}</td>
                                        <td>{exp.place}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {/* DOCUMENTS */}
                <div className="section">
                    <p>
                        ID Proof:{" "}
                        <a href={localStaff.idProof} download target="_blank" rel="noreferrer">
                            Download
                        </a>
                    </p>

                    <p>
                        Bonafide:{" "}
                        <a href={localStaff.bonafide} download target="_blank" rel="noreferrer">
                            Download
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StaffDetails;