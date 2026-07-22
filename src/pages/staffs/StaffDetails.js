/**
 * StaffDetails.js  —  Sam Cafe Admin Panel
 * Single staff member detail page
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";

import editIcon from "../../icon/edit-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";
import { allowTextInput } from "../../App";

import "./StaffDetails.css";
import PageLoader from "../../components/PageLoader";

const StaffDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { staffId } = useParams();
  const navigate = useNavigate();

  const staff = adminData.staff.find(s => s.id === staffId);

  const [localStaff, setLocalStaff] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingExp, setEditingExp] = useState([]);
  const [sameAddress, setSameAddress] = useState(false);

  useEffect(() => {
    if (staff) {
      setLocalStaff(JSON.parse(JSON.stringify(staff)));
    }
  }, [staff]);

  if (!localStaff) return <PageLoader label="Loading staff…" />;

  /* ------------------------------- ENTER / EXIT EDIT ------------------------------- */
  const startEditing = () => {
    setEditingExp([...localStaff.previousExperience]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setLocalStaff(JSON.parse(JSON.stringify(staff)));
    setEditingExp([]);
    setSameAddress(false);
  };

  /* ------------------------------- SAVE ------------------------------- */
  const persistStaff = async () => {
    const updated = {
      ...localStaff,
      previousExperience: editingExp
    };

    try {
      await api.put(`/staff/${staffId}`, updated);

      setAdminData(prev => ({
        ...prev,
        staff: prev.staff.map(s =>
          s.id === staffId ? updated : s
        )
      }));

      setLocalStaff(updated);
      setIsEditing(false);
      setEditingExp([]);
      toast.success("Staff details updated");

    } catch (err) {
      toast.error("Failed to update staff details");
      console.error("Update failed:", err);
    }
  };

  /* ------------------------------- IMAGE (always live-save, independent of edit mode) ------------------------------- */
  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const updated = { ...localStaff, [field]: reader.result };
      setLocalStaff(updated);

      try {
        await api.put(`/staff/${staffId}`, updated);
        setAdminData(prev => ({
          ...prev,
          staff: prev.staff.map(s => s.id === staffId ? updated : s)
        }));
      } catch (err) {
        toast.error("Failed to upload image");
        console.error("Image upload failed:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="details-container">

      {/* HEADER */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <h2>{localStaff.name}</h2>

        {!isEditing && (
          <Button3D variant="cancel" onClick={startEditing}>
            <img src={editIcon} alt="edit" />
            Edit
          </Button3D>
        )}
      </div>

      <div className="details-body">
        {/* IMAGE */}
        <div className="staff-image-row">

          {/* PROFILE IMAGE */}
          <div className="staff-details-image">
            <span>Staff Image</span>
            <img src={localStaff.idImage || "/placeholder.png"} alt="" />
            {isEditing && (
              <div className="file-wrap">
                <input
                  type="file"
                  className="file-input"
                  onChange={(e) => handleImageUpload(e, "idImage")}
                />
                <div className="file-label">Change</div>
              </div>
            )}
          </div>

          <div className="name-section">
            {/* NAME */}
            <div className="section">
              <div className="section-title">
                <span>Full Name</span>
              </div>
              {isEditing ? (
                <div className="admin-form-group">
                  <input
                    value={localStaff.name}
                    onChange={(e) =>
                      setLocalStaff({ ...localStaff, name: allowTextInput(localStaff.name, e.target.value, 100, 5) })
                    }
                  />
                </div>
              ) : (
                <p>{localStaff.name}</p>
              )}
            </div>

            {/* ROLE */}
            <div className="section">
              <div className="section-title">
                <span>Role</span>
              </div>
              {isEditing ? (
                <div className="admin-form-group">
                  <input
                    value={localStaff.role}
                    onChange={(e) =>
                      setLocalStaff({ ...localStaff, role: allowTextInput(localStaff.role, e.target.value, 100, 5) })
                    }
                  />
                </div>
              ) : (
                <p>{localStaff.role}</p>
              )}
            </div>

            {/* WORK TYPE */}
            <div className="section">
              <div className="section-title">
                <span>Work Type</span>
              </div>
              {isEditing ? (
                <div className="admin-form-group">
                  <div className="radio-group">
                    {["part-time", "full-time", "double-shift"].map((type) => (
                      <label key={type} className="radio-btn">
                        <input
                          type="radio"
                          className="radio"
                          checked={(localStaff.workType || "full-time") === type}
                          onChange={() =>
                            setLocalStaff({ ...localStaff, workType: type })
                          }
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p>{localStaff.workType || "full-time"}</p>
              )}
            </div>

            {/* EMPLOYMENT TYPE */}
            <div className="section">
              <div className="section-title">
                <span>Employment Type</span>
              </div>
              {isEditing ? (
                <div className="admin-form-group">
                  <div className="radio-group">
                    {["permanent", "trainee", "intern"].map((type) => (
                      <label key={type} className="radio-btn">
                        <input
                          type="radio"
                          className="radio"
                          checked={(localStaff.employmentType || "permanent") === type}
                          onChange={() =>
                            setLocalStaff({ ...localStaff, employmentType: type })
                          }
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p>{localStaff.employmentType || "permanent"}</p>
              )}
            </div>

            {/* DATE OF JOINING */}
            <div className="section">
              <div className="section-title">
                <span>Date of Joining</span>
              </div>
              {isEditing ? (
                <div className="admin-form-group">
                  <CustomDatePicker
                    value={localStaff.joiningDate || ""}
                    onChange={(v) => setLocalStaff({ ...localStaff, joiningDate: v })}
                    placeholder="Select joining date"
                  />
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
          </div>
          {isEditing ? (
            <div className="admin-form-group">
              <div className="admin-form-group">
                <label>DOB</label>
                <CustomDatePicker
                  value={localStaff.dob || ""}
                  onChange={(v) => setLocalStaff({ ...localStaff, dob: v })}
                  placeholder="Select date of birth"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="admin-form-group">
                <label>Educational Qualification</label>
                <input
                  value={localStaff.education}
                  onChange={(e) => setLocalStaff({ ...localStaff, education: allowTextInput(localStaff.education, e.target.value, 100, 5) })}
                />
              </div>
              <div className="admin-form-group">
                <label>Experience</label>
                <input
                  type="number"
                  value={localStaff.experience}
                  onChange={(e) => setLocalStaff({ ...localStaff, experience: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>Salary</label>
                <input
                  type="number"
                  value={localStaff.salary}
                  onChange={(e) => setLocalStaff({ ...localStaff, salary: e.target.value })}
                />
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
          </div>
          {isEditing ? (
            <>
              <div className="admin-form-group">
                <label>Contact Number</label>
                <input
                  type="number"
                  value={localStaff.contact}
                  onChange={(e) => setLocalStaff({ ...localStaff, contact: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label>Alternate Contact Number</label>
                <input
                  type="number"
                  value={localStaff.altContact}
                  onChange={(e) => setLocalStaff({ ...localStaff, altContact: e.target.value })}
                />
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
          </div>
          {isEditing ? (
            <>
              <div className="admin-form-group">
                <label>Residential Address</label>
                <textarea
                  value={localStaff.residentialAddress}
                  onChange={(e) => {
                    const value = allowTextInput(localStaff.residentialAddress, e.target.value, 500, 100000);
                    setLocalStaff(prev => ({
                      ...prev,
                      residentialAddress: value,
                      permanentAddress: sameAddress ? value : prev.permanentAddress
                    }));
                  }}
                />
              </div>

              <div className="admin-form-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={sameAddress}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSameAddress(checked);
                      if (checked) {
                        setLocalStaff(prev => ({
                          ...prev,
                          permanentAddress: prev.residentialAddress
                        }));
                      }
                    }}
                  />
                  {" "}Same as Residential Address
                </label>
              </div>

              <div className="admin-form-group">
                <label>Permanent Address</label>
                <textarea
                  value={localStaff.permanentAddress}
                  onChange={(e) =>
                    setLocalStaff({ ...localStaff, permanentAddress: allowTextInput(localStaff.permanentAddress, e.target.value, 500, 100000) })
                  }
                />
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
          </div>
          {isEditing ? (
            <>
              <div className="admin-form-group">
                <label>Bank Name</label>
                <input
                  value={localStaff.bank.name}
                  onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, name: allowTextInput(localStaff.bank.name, e.target.value, 100, 5) } })}
                />
              </div>
              <div className="admin-form-group">
                <label>Account Number</label>
                <input
                  type="number"
                  value={localStaff.bank.account}
                  onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, account: e.target.value } })}
                />
              </div>
              <div className="admin-form-group">
                <label>IFSC Code</label>
                <input
                  value={localStaff.bank.ifsc}
                  onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, ifsc: e.target.value } })}
                />
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
          </div>
          {isEditing ? (
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
                        <input
                          value={exp.org}
                          onChange={(e) => {
                            const updated = [...editingExp];
                            updated[i] = { ...updated[i], org: allowTextInput(exp.org, e.target.value, 100, 5) };
                            setEditingExp(updated);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          value={exp.place}
                          onChange={(e) => {
                            const updated = [...editingExp];
                            updated[i] = { ...updated[i], place: allowTextInput(exp.place, e.target.value, 100, 5) };
                            setEditingExp(updated);
                          }}
                        />
                      </td>
                      <td>
                        <img
                          src={deleteIcon}
                          alt="delete"
                          onClick={() => setEditingExp(editingExp.filter((_, idx) => idx !== i))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Button3D onClick={() => setEditingExp([...editingExp, { org: "", place: "" }])}>Add</Button3D>
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

      {/* STICKY SAVE / CANCEL BAR */}
      {isEditing && (
        <div className="details-footer">
          <Button3D variant="cancel" onClick={cancelEditing}>Cancel</Button3D>
          <Button3D onClick={persistStaff}>Save</Button3D>
        </div>
      )}

    </div>
  );
};

export default StaffDetails;
