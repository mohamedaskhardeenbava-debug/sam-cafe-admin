/**
 * Profile.js — one page, per-role rendering.
 *
 * UI-only redesign: the read-only view is now a clean profile card
 * (avatar, name, role/title, branch) instead of the StaffDetails-style
 * layout, and "Edit" opens a centered modal — form fields on the left,
 * a live preview panel on the right — matching the reference design.
 * The editable fields (name, phone) and role-specific sections are
 * unchanged; only the presentation moved from inline editing to a modal.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useVenue } from "../context/VenueContext";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import closeIcon from "../icon/close-icon.png";
import "./ModalCSS.css";
import "./staffs/StaffDetails.css";
import "./Profile.css";
import { fmtDate, fmtDateTime } from "../utils/dateUtils";
import { getAvatarColor } from "../utils/avatarColor";

const Profile = () => {
  const navigate = useNavigate();
  const { admin, updateProfile, logout } = useAuth();
  const { venues, isSuperAdmin } = useVenue();
  const [isEditing, setIsEditing] = useState(false);
  const profileEditModal = useAnimatedModal("profile-edit");
  const [name, setName] = useState(admin?.name || "");
  const [phone, setPhone] = useState(admin?.phone || "");
  const [photo, setPhoto] = useState(admin?.photo || "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Tracks a failed <img> load for the profile-card-avatar so a broken/
  // stale photo URL falls back to the initials avatar instead of a
  // broken-image icon.
  const [cardPhotoFailed, setCardPhotoFailed] = useState(false);

  useEffect(() => { setCardPhotoFailed(false); }, [admin?.photo]);

  if (!admin) return null;

  // Non-Super-Admin accounts are pinned to exactly one venue; Super Admin
  // is global, so there's no single "their branch" to show.
  const ownVenue = !isSuperAdmin ? venues.find((v) => v.id === admin.venueId) : null;
  const branchLabel = isSuperAdmin ? "All Branches" : ownVenue ? ownVenue.name : "—";

  const startEditing = () => {
    setName(admin.name || "");
    setPhone(admin.phone || "");
    setPhoto(admin.photo || "");
    setError("");
    setIsEditing(true);
    profileEditModal.open();
  };

  const cancelEditing = () => {
    profileEditModal.close(() => setIsEditing(false));
    setName(admin.name || "");
    setPhone(admin.phone || "");
    setPhoto(admin.photo || "");
    setError("");
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError("");
    setIsSaving(true);
    try {
      await updateProfile({ name, phone, photo });
      profileEditModal.close(() => setIsEditing(false));
    } catch (err) {
      setError(err.response?.data?.error || "Could not update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate("/")} data-bs-toggle="tooltip" data-bs-placement="bottom" data-bs-title="Back to Dashboard" />
        <h2>Profile</h2>
      </div>

      <div className="details-body">
        {/* PROFILE CARD + ACCOUNT DETAILS — same row */}
        <div className="profile-top-row">
          <div className="profile-card">
            <div
              className="profile-card-avatar"
              style={{ background: admin.photo && !cardPhotoFailed ? "#fff" : "transparent" }}
            >
              {admin.photo && !cardPhotoFailed ? (
                <img src={admin.photo} alt={admin.name} onError={() => setCardPhotoFailed(true)} />
              ) : (
                <div className="profile-avatar-fallback" style={{ background: getAvatarColor(admin.name) }}>
                  {admin.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <div className="profile-card-name">{admin.name}</div>
            <div className="profile-card-role">{admin.roleTitle}</div>
            <div className="profile-card-chip">{branchLabel}</div>

            <Button3D variant="cancel" className="profile-card-edit-btn" onClick={startEditing}>
              Edit Profile
            </Button3D>
          </div>

          <div className="section profile-account-section">
            <div className="section-title">
              <span>Account Details</span>
            </div>
            <table className="profile-table">
              <tbody>
                <tr><td>Email</td><td>{admin.email}</td></tr>
                <tr><td>Phone</td><td>{admin.phone || "—"}</td></tr>
                <tr><td>Role</td><td>{admin.roleTitle} · {admin.roleGroup}</td></tr>
                <tr><td>Branch</td><td>{branchLabel}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="profile-error">{error}</p>}

        {/* ROLE-SPECIFIC SECTIONS */}
        {admin.roleGroup === "Supervisor" && (
          <div className="section">
            <div className="section-title">
              <span>Station Info</span>
            </div>
            <table className="profile-table">
              <tbody>
                <tr><td>Linked Staff Record</td><td>{admin.staffId || "Not linked"}</td></tr>
              </tbody>
            </table>
            <p className="profile-note">
              As a {admin.roleTitle}, your view focuses on daily shift tasks
              and station-level to-dos. See the To-Do page for your shift checklist.
            </p>
          </div>
        )}

        {admin.roleGroup === "Manager" && (
          <div className="section">
            <div className="section-title">
              <span>Management Scope</span>
            </div>
            <table className="profile-table">
              <tbody>
                <tr><td>Linked Staff Record</td><td>{admin.staffId || "Not linked"}</td></tr>
              </tbody>
            </table>
            <p className="profile-note">
              As a {admin.roleTitle}, you can view and edit staff HR records
              (attendance, salary, training) and oversee kitchen/service operations.
            </p>
          </div>
        )}

        {admin.roleGroup === "Super Admin" && (
          <div className="section">
            <div className="section-title">
              <span>Platform Access</span>
            </div>
            <table className="profile-table">
              <tbody>
                <tr><td>Account Status</td><td>{admin.status}</td></tr>
                <tr><td>Last Login</td><td>{admin.lastLoginAt ? fmtDateTime(admin.lastLoginAt) : "—"}</td></tr>
              </tbody>
            </table>
            <p className="profile-note">
              As {admin.roleTitle}, you have full platform access — including managing
              other staff accounts and roles under Admin Management.
            </p>
          </div>
        )}

        <div className="section">
          <Button3D variant="danger" onClick={logout}>Log Out</Button3D>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {profileEditModal.shouldRender && (
        <div className={`modal-overlay ${profileEditModal.overlayClass}`}>
          <div className={`admin-modal profile-edit-modal ${profileEditModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Edit your profile</h3>
              <Button3D variant="cancel" iconOnly onClick={cancelEditing}>
                <img src={closeIcon} alt="Close" />
              </Button3D>
            </div>

            <div className="admin-modal-body profile-edit-body">
              {/* FORM (left) */}
              <div className="profile-edit-form">
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className="mat-input"
                      placeholder=" "
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <label className="mat-label">Full name</label>
                    <span className="mat-bar" />
                  </div>
                </div>

                <div className="admin-form-group">
                  <div className="mat">
                    <input className="mat-input profile-readonly-input" value={admin.email} readOnly />
                    <label className="mat-label">Email</label>
                    <span className="mat-bar" />
                  </div>
                </div>

                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className="mat-input"
                      placeholder=" "
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <label className="mat-label">Phone</label>
                    <span className="mat-bar" />
                  </div>
                </div>

                <div className="admin-form-group">
                  <div className="mat">
                    <input className="mat-input profile-readonly-input" value={admin.roleTitle || ""} readOnly />
                    <label className="mat-label">Title</label>
                    <span className="mat-bar" />
                  </div>
                </div>
              </div>

              {/* PREVIEW (right) — reflects the fields above live as they're typed */}
              <div className="profile-edit-preview">
                <span className="profile-edit-preview-label">Preview</span>
                <label className="profile-preview-avatar profile-preview-avatar-editable" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Change profile picture">
                  {photo ? (
                    <img src={photo} alt={name} />
                  ) : (
                    <div className="profile-avatar-fallback">
                      {name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="profile-preview-avatar-edit-badge">
                    <svg viewBox="0 0 20 20" width="12" height="12">
                      <path d="M14.5 2.5a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12L7 16H4v-3L14.5 2.5z" fill="#fff" />
                    </svg>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoPick}
                    className="profile-preview-avatar-input"
                  />
                </label>
                <div className="profile-preview-name">{name || admin.name}</div>
                <div className="profile-preview-role">{admin.roleTitle}</div>
                {phone && <div className="profile-preview-phone">{phone}</div>}
              </div>
            </div>

            <div className="admin-modal-footer profile-edit-footer">
              <span className="profile-edit-updated">
                {admin.updatedAt ? `Last updated: ${fmtDate(admin.updatedAt)}` : ""}
              </span>
              <div className="profile-edit-footer-actions">
                <Button3D variant="cancel" onClick={cancelEditing}>Cancel</Button3D>
                <Button3D onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button3D>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;