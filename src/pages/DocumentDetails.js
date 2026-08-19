/**
 * DocumentDetails.js  —  Sam Cafe Admin Panel
 * Single-document view/edit page for the Documents module. Super Admin
 * only. Follows the exact IngredientDetails.js convention: one render
 * tree per field, isEditing toggles <p>{value}</p> vs an editable
 * control inside the same .section, Save/Cancel in a details-footer.
 * Self-contained (fetch by id, PUT to save, DELETE + navigate back)
 * since Documents isn't part of the app-start global adminData preload.
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";
import { allowTextInput, formatDisplayDate } from "../App";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import FilePreviewLink from "../components/FilePreviewLink";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker, todayStr } from "../components/CustomDatePicker";
import PageLoader from "../components/PageLoader";
import editIcon from "../icon/edit-icon.png";
import { DOCUMENT_DEPARTMENTS, reminderFromToDate } from "./Documents";

import "./IngredientDetails.css";
import "./Documents.css";

const DocumentDetails = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();

  const [doc, setDoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [local, setLocal] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [fileLabel, setFileLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/documents/${docId}`);
      setDoc(res.data);
      setLocal(res.data);
      setFileLabel(res.data.fileName || "");
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else {
        console.error("Failed to load document:", err);
        toast.error("Failed to load document");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) { setIsLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, isSuperAdmin]);

  const resetEditState = () => {
    setLocal(doc);
    setFileLabel(doc?.fileName || "");
    setFormErrors({});
    setIsEditing(false);
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLabel(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLocal((prev) => ({
        ...prev,
        fileName: file.name,
        fileType: file.type,
        fileData: reader.result,
      }));
    };
    reader.readAsDataURL(file);
    setFormErrors((p) => ({ ...p, file: false }));
  };

  const saveDocument = async (payload) => {
    const e = {};
    if (!payload.name?.trim()) e.name = true;
    if (!payload.department) e.department = true;
    if (!payload.date) e.date = true;
    if (!payload.toDate) e.toDate = true;
    if (Object.keys(e).length) { setFormErrors(e); return; }

    setSaving(true);
    try {
      const { reminderDateEdited, ...payloadToSave } = payload;
      const res = await api.put(`/documents/${docId}`, payloadToSave);
      setDoc(res.data);
      setLocal(res.data);
      setIsEditing(false);
      toast.success("Document updated");
    } catch (err) {
      console.error("Failed to update document:", err);
      toast.error("Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    toast.confirm(`Delete "${doc.name}"?`, async () => {
      try {
        await api.delete(`/documents/${docId}`);
        toast.success("Document deleted");
        navigate("/documents");
      } catch (err) {
        console.error("Failed to delete document:", err);
        toast.error("Failed to delete document");
      }
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="details-container">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can view documents.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="details-container">
        <PageLoader fill label="Loading document…" />
      </div>
    );
  }

  if (notFound || !doc || !local) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate("/documents")} />
          <h2>Document Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="details-container">
      <div className="details-header">
        <button
          className="back-btn"
          onClick={() => { resetEditState(); navigate("/documents"); }}
        />
        <h2>{doc.name}</h2>
        {!isEditing && (
          <div style={{ display: "flex", gap: "10px" }}>
            <Button3D variant="cancel" onClick={() => setIsEditing(true)}>
              <img src={editIcon} alt="edit" />
              Edit
            </Button3D>
            <Button3D variant="danger" onClick={handleDelete}>Delete</Button3D>
          </div>
        )}
      </div>

      <div className="details-body">
        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title">
              <span>Document Name</span>
            </div>
            {isEditing ? (
              <>
                <input
                  className={formErrors.name ? "mat-error" : ""}
                  value={local.name || ""}
                  onChange={(e) =>
                    setLocal((prev) => ({
                      ...prev,
                      name: allowTextInput(prev.name || "", e.target.value, 100, 5),
                    }))
                  }
                />
                {formErrors.name && <div className="field-error-msg">Document name is required</div>}
              </>
            ) : (
              <p>{doc.name}</p>
            )}
          </div>

          <div className="section">
            <div className="section-title">
              <span>Department</span>
            </div>
            {isEditing ? (
              <>
                <CustomDropdown
                  value={local.department || ""}
                  onChange={(val) => { setLocal((p) => ({ ...p, department: val })); setFormErrors((p) => ({ ...p, department: false })); }}
                  options={DOCUMENT_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                  placeholder="Select department"
                  hasError={formErrors.department}
                />
                {formErrors.department && <div className="field-error-msg">Select a department</div>}
              </>
            ) : (
              <p>{doc.department}</p>
            )}
          </div>
        </div>

        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title">
              <span>From Date</span>
            </div>
            {isEditing ? (
              <>
                <CustomDatePicker
                  value={local.date || ""}
                  max={local.toDate || undefined}
                  onChange={(val) => { setLocal((p) => ({ ...p, date: val })); setFormErrors((p) => ({ ...p, date: false })); }}
                />
                {formErrors.date && <div className="field-error-msg">From date is required</div>}
              </>
            ) : (
              <p>{formatDisplayDate(doc.date) || doc.date}</p>
            )}
          </div>

          <div className="section">
            <div className="section-title">
              <span>To Date</span>
            </div>
            {isEditing ? (
              <>
                <CustomDatePicker
                  value={local.toDate || ""}
                  min={local.date || undefined}
                  onChange={(val) =>
                    setLocal((p) => ({
                      ...p,
                      toDate: val,
                      reminderDate: p.reminderDateEdited ? p.reminderDate : reminderFromToDate(val),
                    }))
                  }
                />
                {formErrors.toDate && <div className="field-error-msg">To date is required</div>}
              </>
            ) : (
              <p>{formatDisplayDate(doc.toDate) || doc.toDate}</p>
            )}
          </div>
        </div>

        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title">
              <span>Reminder Date</span>
            </div>
            {isEditing ? (
              <>
                <CustomDatePicker
                  value={local.reminderDate || ""}
                  onChange={(val) => setLocal((p) => ({ ...p, reminderDate: val, reminderDateEdited: true }))}
                />
                {formErrors.reminderDate && <div className="field-error-msg">Reminder date is required</div>}
              </>
            ) : (
              <p>
                <span
                  className={
                    doc.reminderDate <= todayStr()
                      ? "doc-reminder-badge doc-reminder-overdue"
                      : "doc-reminder-badge"
                  }
                >
                  {formatDisplayDate(doc.reminderDate) || doc.reminderDate}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="section">
          <div className="section-title">
            <span>Document File</span>
          </div>
          {isEditing ? (
            <div style={{ width: "220px" }}>
              <div className="file-wrap">
                <input type="file" onChange={handleFilePick} className="file-input" />
                <div className="file-label">
                  {fileLabel ? `✔ ${fileLabel}` : "Choose Document File"}
                </div>
              </div>
            </div>
          ) : doc.fileData ? (
            <p>
              <FilePreviewLink
                href={doc.fileData}
                download={doc.fileName || "document"}
                label={doc.fileName || "Preview file"}
              />
            </p>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="details-footer">
          <Button3D variant="cancel" onClick={resetEditState}>Cancel</Button3D>
          <Button3D onClick={() => saveDocument(local)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button3D>
        </div>
      )}
    </div>
  );
};

export default DocumentDetails;
