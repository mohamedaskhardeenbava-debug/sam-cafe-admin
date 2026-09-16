/**
 * StaffDetails.js  —  Sam Cafe Admin Panel
 * Single staff member detail page
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import { fmtDate } from "../../utils/dateUtils";

import editIcon from "../../icon/edit-icon.png";
import deleteIcon from "../../icon/delete-icon.png";
import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";
import FilePreviewLink from "../../components/FilePreviewLink";
import CustomDropdown from "../../components/CustomDropdown";
import useRoleTitles from "./useRoleTitles";
import { allowTextInput } from "../../App";

import "./StaffDetails.css";
import PageLoader from "../../components/PageLoader";

const StaffDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { staffId } = useParams();
  const navigate = useNavigate();
  const { roleTitles: jobRoles } = useRoleTitles(); // same Roles and Responsibilities registry used on the Staffs list, so this page can't drift out of sync with login account role titles

  const staff = adminData.staff.find(s => s.id === staffId);
  // The staff record itself has no email field — that lives on the
  // linked login account (Admin doc), if one exists. adminData.staffAccounts
  // is already loaded app-wide (see fetchAllData in App.js), so this is
  // just a lookup, no extra request needed.
  const linkedAccount = (adminData.staffAccounts || []).find(a => a.staffId === staffId);

  const [localStaff, setLocalStaff] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingExp, setEditingExp] = useState([]);
  const [sameAddress, setSameAddress] = useState(false);

  useEffect(() => {
    if (staff) {
      setLocalStaff(JSON.parse(JSON.stringify(staff)));
    }
  }, [staff]);

  if (!localStaff) return <PageLoader fill label="Loading staff…" />;

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
        {/* PROFILE CARD */}
        <div className="staff-profile-card">
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
              {/* NAME + ROLE */}
              <div className="staff-identity-row">
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
                      <CustomDropdown
                        value={localStaff.role}
                        onChange={(v) => setLocalStaff({ ...localStaff, role: v })}
                        options={jobRoles}
                        placeholder="Select Role"
                      />
                    </div>
                  ) : (
                    <span className="staff-role-pill">{localStaff.role}</span>
                  )}
                </div>
              </div>

              {/* WORK TYPE / EMPLOYMENT TYPE / DATE OF JOINING */}
              <div className="staff-meta-row">
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
                    <p>{fmtDate(localStaff.joiningDate)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PERSONAL */}
        <div className="staff-details-card section">
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
            <div className="staff-info-grid">
              <div className="staff-info-cell">
                <span className="staff-info-label">DOB</span>
                <span className="staff-info-value">{fmtDate(localStaff.dob)}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Joining Date</span>
                <span className="staff-info-value">{fmtDate(localStaff.joiningDate)}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Education</span>
                <span className="staff-info-value">{localStaff.education || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Experience</span>
                <span className="staff-info-value">{localStaff.experience || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Salary</span>
                <span className="staff-info-value">₹{localStaff.salary || "—"}</span>
              </div>
            </div>
          )}
        </div>

        {/* CONTACT */}
        <div className="staff-details-card section">
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
            <div className="staff-info-grid">
              <div className="staff-info-cell">
                <span className="staff-info-label">Phone</span>
                <span className="staff-info-value">{localStaff.contact || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Alt Phone</span>
                <span className="staff-info-value">{localStaff.altContact || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Login Email</span>
                <span className="staff-info-value">
                  {linkedAccount?.email || "— (no login account)"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ADDRESS */}
        <div className="staff-details-card section">
          <div className="section-title">
            <span>Address Details</span>
          </div>
          {isEditing ? (
            <>
              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
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
                  <label className="mat-label">Residential Address</label>
                  <span className="mat-bar" />
                </div>
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
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
                    value={localStaff.permanentAddress}
                    onChange={(e) =>
                      setLocalStaff({ ...localStaff, permanentAddress: allowTextInput(localStaff.permanentAddress, e.target.value, 500, 100000) })
                    }
                  />
                  <label className="mat-label">Permanent Address</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </>
          ) : (
            <div className="staff-info-grid">
              <div className="staff-info-cell">
                <span className="staff-info-label">Residential</span>
                <span className="staff-info-value">{localStaff.residentialAddress || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Permanent</span>
                <span className="staff-info-value">{localStaff.permanentAddress || "—"}</span>
              </div>
            </div>
          )}
        </div>

        {/* BANK */}
        <div className="staff-details-card section">
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
                  onChange={(e) => setLocalStaff({ ...localStaff, bank: { ...localStaff.bank, ifsc: e.target.value.toUpperCase().slice(0, 11) } })}
                />
              </div>
            </>
          ) : (
            <div className="staff-info-grid">
              <div className="staff-info-cell">
                <span className="staff-info-label">Bank</span>
                <span className="staff-info-value">{localStaff.bank.name || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">Account</span>
                <span className="staff-info-value">{localStaff.bank.account || "—"}</span>
              </div>
              <div className="staff-info-cell">
                <span className="staff-info-label">IFSC</span>
                <span className="staff-info-value">{localStaff.bank.ifsc || "—"}</span>
              </div>
            </div>
          )}
        </div>

        {/* EXPERIENCE */}
        <div className="staff-details-card section">
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
            localStaff.previousExperience.length > 0 ? (
              <div className="staff-experience-list">
                {localStaff.previousExperience.map((exp, i) => (
                  <div className="staff-experience-row" key={i}>
                    <span className="exp-org">{exp.org}</span>
                    <span className="exp-place">{exp.place}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>—</p>
            )
          )}
        </div>

        {/* DOCUMENTS */}
        <div className="staff-details-card section">
          <div className="section-title">
            <span>Documents</span>
          </div>
          <div className="staff-documents-row">
            <div className="staff-document-item">
              <span className="staff-info-label">ID Proof</span>
              <FilePreviewLink
                href={localStaff.idProof}
                thumbnail={localStaff.idProofThumbnail}
                download={`${localStaff.name || "id-proof"}-id-proof`}
                label="Preview / Download"
              />
            </div>
            <div className="staff-document-item">
              <span className="staff-info-label">Bonafide</span>
              <FilePreviewLink
                href={localStaff.bonafide}
                thumbnail={localStaff.bonafideThumbnail}
                download={`${localStaff.name || "bonafide"}-bonafide`}
                label="Preview / Download"
              />
            </div>
          </div>
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