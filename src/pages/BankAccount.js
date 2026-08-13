/**
 * BankAccount.js  —  Sam Cafe Admin Panel
 * Restaurant's own bank account details — where customer payments settle.
 * Super Admin only. Singleton settings form (one record for the
 * restaurant), following the same masked-until-revealed pattern as any
 * sensitive-field settings page: the account number stays masked
 * (••••1234) until "Edit" is clicked, which fetches the unmasked value
 * from the dedicated /bank-account/reveal endpoint.
 */

import React, { useState, useEffect } from "react";

import api from "../api";
import { allowTextInput } from "../App";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import PageLoader from "../components/PageLoader";

import "./BankAccount.css";

const EMPTY_FORM = {
  accountHolderName: "",
  accountNumber: "",
  ifscCode: "",
  bankName: "",
  branchName: "",
  upiVpa: "",
};

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const BankAccount = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(null); // masked record as last saved/loaded
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/bank-account");
      setSaved(res.data && res.data.accountHolderName ? res.data : null);
    } catch (err) {
      console.error("Failed to load bank account:", err);
      toast.error("Failed to load bank account details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) { setIsLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const startEdit = async () => {
    setFormErrors({});
    try {
      // Pull the unmasked account number only when actually editing.
      const res = await api.get("/bank-account/reveal");
      setForm({ ...EMPTY_FORM, ...res.data });
    } catch (err) {
      console.error("Failed to load bank account for editing:", err);
      toast.error("Failed to load account details for editing");
      return;
    }
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validate = () => {
    const e = {};
    if (!form.accountHolderName.trim()) e.accountHolderName = true;
    if (!form.accountNumber.trim() || !/^\d{9,18}$/.test(form.accountNumber.trim())) e.accountNumber = true;
    if (!IFSC_PATTERN.test(form.ifscCode.trim().toUpperCase())) e.ifscCode = true;
    if (!form.bankName.trim()) e.bankName = true;
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setFormErrors(e); return; }

    setSaving(true);
    try {
      const res = await api.put("/bank-account", {
        ...form,
        ifscCode: form.ifscCode.trim().toUpperCase(),
      });
      setSaved(res.data);
      setIsEditing(false);
      setForm(EMPTY_FORM);
      toast.success("Bank account details saved");
    } catch (err) {
      console.error("Failed to save bank account:", err);
      toast.error(err?.response?.data?.error || "Failed to save bank account details");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can view bank account details.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading bank account details…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Bank Accounts</h2>
            </div>
          </div>
        </div>
        {!isEditing && (
          <Button3D onClick={startEdit}>{saved ? "Edit Details" : "+ Add Bank Account"}</Button3D>
        )}
      </div>

      <p className="ba-subtitle">
        Where customer payments (Cashfree) settle. Visible to Super Admin only.
      </p>

      {!isEditing ? (
        saved ? (
          <div className="ba-card">
            <div className="ba-row"><span className="ba-label">Account Holder Name</span><span className="ba-value">{saved.accountHolderName}</span></div>
            <div className="ba-row"><span className="ba-label">Account Number</span><span className="ba-value ba-masked">{saved.accountNumber}</span></div>
            <div className="ba-row"><span className="ba-label">IFSC Code</span><span className="ba-value">{saved.ifscCode}</span></div>
            <div className="ba-row"><span className="ba-label">Bank Name</span><span className="ba-value">{saved.bankName}</span></div>
            {saved.branchName && (
              <div className="ba-row"><span className="ba-label">Branch</span><span className="ba-value">{saved.branchName}</span></div>
            )}
            {saved.upiVpa && (
              <div className="ba-row"><span className="ba-label">UPI VPA</span><span className="ba-value">{saved.upiVpa}</span></div>
            )}
          </div>
        ) : (
          <div className="ba-empty">No bank account on file yet.</div>
        )
      ) : (
        <form className="ba-card ba-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="admin-form-group">
            <div className="mat">
              <input
                className={`mat-input${formErrors.accountHolderName ? " mat-error" : ""}`}
                placeholder=" "
                autoFocus
                type="text"
                value={form.accountHolderName}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    accountHolderName: allowTextInput(p.accountHolderName, e.target.value, 100, 5),
                  }))
                }
              />
              <label className={`mat-label${formErrors.accountHolderName ? " mat-label-error" : ""}`}>
                Account Holder Name<span className="rf-req">*</span>
              </label>
              <span className={`mat-bar${formErrors.accountHolderName ? " mat-bar-error" : ""}`} />
            </div>
            {formErrors.accountHolderName && <div className="field-error-msg">Account holder name is required</div>}
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className={`mat-input${formErrors.accountNumber ? " mat-error" : ""}`}
                placeholder=" "
                type="text"
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 18);
                  setForm((p) => ({ ...p, accountNumber: digits }));
                }}
              />
              <label className={`mat-label${formErrors.accountNumber ? " mat-label-error" : ""}`}>
                Account Number<span className="rf-req">*</span>
              </label>
              <span className={`mat-bar${formErrors.accountNumber ? " mat-bar-error" : ""}`} />
            </div>
            {formErrors.accountNumber && <div className="field-error-msg">Enter a valid account number (9–18 digits)</div>}
          </div>

          <div className="horizontal-form-group">
            <div className="admin-form-group">
              <div className="mat">
                <input
                  className={`mat-input${formErrors.ifscCode ? " mat-error" : ""}`}
                  placeholder=" "
                  type="text"
                  value={form.ifscCode}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, ifscCode: e.target.value.toUpperCase().slice(0, 11) }))
                  }
                />
                <label className={`mat-label${formErrors.ifscCode ? " mat-label-error" : ""}`}>
                  IFSC Code<span className="rf-req">*</span>
                </label>
                <span className={`mat-bar${formErrors.ifscCode ? " mat-bar-error" : ""}`} />
              </div>
              {formErrors.ifscCode && <div className="field-error-msg">Enter a valid IFSC code (e.g. HDFC0001234)</div>}
            </div>

            <div className="admin-form-group">
              <div className="mat">
                <input
                  className={`mat-input${formErrors.bankName ? " mat-error" : ""}`}
                  placeholder=" "
                  type="text"
                  value={form.bankName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, bankName: allowTextInput(p.bankName, e.target.value, 100, 5) }))
                  }
                />
                <label className={`mat-label${formErrors.bankName ? " mat-label-error" : ""}`}>
                  Bank Name<span className="rf-req">*</span>
                </label>
                <span className={`mat-bar${formErrors.bankName ? " mat-bar-error" : ""}`} />
              </div>
              {formErrors.bankName && <div className="field-error-msg">Bank name is required</div>}
            </div>
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className="mat-input"
                placeholder=" "
                type="text"
                value={form.branchName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, branchName: allowTextInput(p.branchName, e.target.value, 100, 5) }))
                }
              />
              <label className="mat-label">Branch Name</label>
              <span className="mat-bar" />
            </div>
          </div>

          <div className="admin-form-group">
            <div className="mat">
              <input
                className="mat-input"
                placeholder=" "
                type="text"
                value={form.upiVpa}
                onChange={(e) => setForm((p) => ({ ...p, upiVpa: e.target.value.trim() }))}
              />
              <label className="mat-label">UPI VPA (optional)</label>
              <span className="mat-bar" />
            </div>
          </div>

          <div className="ba-form-actions">
            <Button3D variant="cancel" onClick={cancelEdit}>Cancel</Button3D>
            <Button3D type="submit" disabled={saving}>{saving ? "Saving…" : "Save Bank Account"}</Button3D>
          </div>
        </form>
      )}
    </div>
  );
};

export default BankAccount;
