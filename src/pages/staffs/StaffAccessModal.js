/**
 * StaffAccessModal.js — Sam Cafe Admin Panel
 *
 * Requirement 1: employee account creation/deletion is done in the
 * Staffs page by whoever outranks the new hire in the creation
 * hierarchy (Super Admin > all; Chef > Sous Chef; Service Manager >
 * Captain; Captain > Supervisor) — no self-serve signup anymore.
 *
 * This modal covers both directions:
 *  - "Create login access" for an HR staff record that doesn't have
 *    one yet: creator picks a roleTitle (only ones they're allowed to
 *    create), optionally a named Role (from the Roles page), and an
 *    email; the server generates a temporary password, which is shown
 *    once here so the creator can hand it to the new hire directly (it
 *    is also emailed if SMTP is configured).
 *  - "Remove login access" for an existing admin account, gated the
 *    same way on the backend.
 */
import { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../useToast";
import Button3D from "../../components/Button3D";
import ConfirmDialog from "../../components/ConfirmDialog";
import CustomDropdown from "../../components/CustomDropdown";
import closeIcon from "../../icon/close-icon.png";
import { allowTextInput } from "../../App";
import "../ModalCSS.css";

const StaffAccessModal = ({ staff, existingAccount, onClose, onChanged }) => {
  const { toast } = useToast();
  const { creatableRoleTitles } = useAuth();

  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { admin, tempPassword } after creation
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    api
      .get("/roles", { params: roleTitle ? { roleTitle } : {} })
      .then((res) => setRoles(res.data || []))
      .catch(() => setRoles([]));
  }, [roleTitle]);

  const validate = () => {
    const e = {};
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) e.email = true;
    if (!roleTitle) e.roleTitle = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const res = await api.post("/staff-auth/create-staff", {
        name: staff.name,
        email: email.trim(),
        roleTitle,
        staffId: staff.id,
        phone: staff.contact || "",
        ...(roleId ? { roleId } : {}),
      });
      setResult(res.data);
      toast.success("Login access created");
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create login access");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = () => setShowRemoveConfirm(true);

  const confirmRemove = async () => {
    setShowRemoveConfirm(false);
    setIsSubmitting(true);
    try {
      await api.delete(`/staff-auth/staff/${existingAccount.id}`);
      toast.success("Login access removed");
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to remove login access");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPassword = () => {
    if (!result?.tempPassword) return;
    navigator.clipboard?.writeText(result.tempPassword);
    toast.success("Temporary password copied");
  };

  return (
    <div className="modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h3>{existingAccount ? "Login Access" : "Grant Login Access"}</h3>
          <Button3D variant="cancel" iconOnly onClick={onClose}>
            <img src={closeIcon} alt="Close" />
          </Button3D>
        </div>

        <div className="admin-modal-body">
          {existingAccount ? (
            <>
              <p style={{ margin: "0 0 12px" }}>
                <strong>{staff.name}</strong> already has login access as{" "}
                <strong>{existingAccount.roleTitle}</strong>, signing in with{" "}
                <strong>{existingAccount.email}</strong>.
              </p>
              <p style={{ color: "#888", fontSize: 13 }}>
                Removing access deletes their admin login (not their HR staff record) — they can no longer
                sign in until a new account is created for them.
              </p>
            </>
          ) : result ? (
            <>
              <p style={{ margin: "0 0 12px" }}>
                Account created for <strong>{staff.name}</strong>. Share this temporary password with them —
                it won't be shown again. They can change it after logging in via "Forgot password".
              </p>
              <div className="staff-access-credentials">
                <div>
                  <span className="sac-label">Email</span>
                  <span className="sac-value">{result.admin.email}</span>
                </div>
                <div>
                  <span className="sac-label">Temporary Password</span>
                  <span className="sac-value sac-password">{result.tempPassword}</span>
                </div>
              </div>
              <Button3D onClick={copyPassword} style={{ marginTop: 12 }}>Copy Password</Button3D>
            </>
          ) : (
            <>
              {creatableRoleTitles.length === 0 ? (
                <p style={{ color: "#888" }}>You are not permitted to create login accounts.</p>
              ) : (
                <>
                  <div className="admin-form-group">
                    <div className="mat">
                      <input
                        className={`mat-input${errors.email ? " mat-error" : ""}`}
                        placeholder=" "
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(allowTextInput(email, e.target.value, 100, 0));
                          setErrors((p) => ({ ...p, email: false }));
                        }}
                      />
                      <label className={`mat-label${errors.email ? " mat-label-error" : ""}`}>
                        Login Email<span className="rf-req">*</span>
                      </label>
                      <span className={`mat-bar${errors.email ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className={`admin-form-group${errors.roleTitle ? " mat-select-error" : ""}`}>
                    <CustomDropdown
                      label="Role"
                      required
                      value={roleTitle}
                      onChange={(v) => { setRoleTitle(v); setErrors((p) => ({ ...p, roleTitle: false })); }}
                      options={creatableRoleTitles}
                      placeholder="Select role"
                      hasError={!!errors.roleTitle}
                    />
                  </div>

                  {roles.length > 0 && (
                    <div className="admin-form-group">
                      <CustomDropdown
                        label="Named Role (optional)"
                        value={roleId}
                        onChange={setRoleId}
                        options={roles.map((r) => ({ value: r.id, label: r.name }))}
                        placeholder="No specific named role"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="admin-modal-footer">
          {existingAccount ? (
            <>
              <Button3D variant="cancel" onClick={onClose}>Close</Button3D>
              <Button3D variant="danger" onClick={handleRemove} disabled={isSubmitting}>
                {isSubmitting ? "Removing…" : "Remove Access"}
              </Button3D>
            </>
          ) : result ? (
            <Button3D onClick={onClose}>Done</Button3D>
          ) : (
            <>
              <Button3D variant="cancel" onClick={onClose}>Cancel</Button3D>
              {creatableRoleTitles.length > 0 && (
                <Button3D onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create Access"}
                </Button3D>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove login access"
        message={<>Remove login access for <strong>{existingAccount?.name}</strong>? They will no longer be able to log in.</>}
        confirmLabel="Remove"
        danger
        onCancel={() => setShowRemoveConfirm(false)}
        onConfirm={confirmRemove}
      />
    </div>
  );
};

export default StaffAccessModal;
