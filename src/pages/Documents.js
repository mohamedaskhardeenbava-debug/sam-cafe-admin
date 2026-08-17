/**
 * Documents.js  —  Sam Cafe Admin Panel
 * Compliance/licensing document tracker (FSSAI, Sanitary Inspection,
 * Food Inspection, Fire Inspection, GST, …) with reminder dates.
 * Super Admin only — mirrors the Ingredients/Dishes list-page layout
 * and the AuditLogs self-fetching pattern (not part of the app-start
 * global preload since only Super Admins ever see this page).
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { createRecord, deleteRecord } from "../utils/crudUtils";

import closeIcon from "../icon/close-icon.png";
import { allowTextInput, EmptyRow, sortArray, formatDisplayDate } from "../App";
import { useToast } from "../useToast";
import { useAuth } from "../context/AuthContext";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker, todayStr } from "../components/CustomDatePicker";
import { FilterBar } from "../components/FilterBar";
import PageLoader from "../components/PageLoader";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";

import "./Documents.css";
import "./ModalCSS.css";

export const DOCUMENT_DEPARTMENTS = ["FSSAI", "Sanitary Inspection", "Food Inspection", "Fire Inspection", "GST"];

const EMPTY_FORM = { name: "", department: "", date: "", reminderDate: "", fileName: "", fileType: "", fileData: "" };

const newDocId = () =>
  "doc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

/** True when reminderDate is today or in the past — surfaced as an "Overdue" flag in the table. */
const isReminderDue = (reminderDate) => {
  if (!reminderDate) return false;
  return reminderDate <= todayStr();
};

/** True when reminderDate falls within the next 15 days — same "expiring soon" window used on Ingredients. */
const isReminderSoon = (reminderDate) => {
  if (!reminderDate) return false;
  const diffDays = (new Date(reminderDate) - new Date(todayStr())) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 15;
};

const Documents = ({ sortConfig, handleSort }) => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const docFormModal = useAnimatedModal("documents-add");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [fileLabel, setFileLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/documents");
      setDocuments(res.data || []);
    } catch (err) {
      console.error("Failed to load documents:", err);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) { setIsLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const clearDocFormFields = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFileLabel("");
  };

  const resetForm = () => {
    docFormModal.close(() => setShowForm(false));
    clearDocFormFields();
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLabel(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({
        ...prev,
        fileName: file.name,
        fileType: file.type,
        fileData: reader.result,
      }));
    };
    reader.readAsDataURL(file);
    setFormErrors((p) => ({ ...p, file: false }));
  };

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.department) e.department = true;
    if (!form.date) e.date = true;
    if (!form.fileData) e.file = true;
    if (Object.keys(e).length) { setFormErrors(e); return; }

    setSaving(true);
    const payload = { ...form, id: newDocId() };
    const result = await createRecord({
      api,
      toast,
      endpoint: "/documents",
      payload,
      stateKey: "documents",
      setAdminData: (updater) => {
        setDocuments((prev) => updater({ documents: prev }).documents);
      },
      successMsg: "Document added",
      errorMsg: "Failed to add document",
      onSuccess: resetForm,
    });
    setSaving(false);
    return result;
  };

  const sortedDocs = useMemo(() => sortArray(documents, sortConfig), [documents, sortConfig]);

  const filteredDocs = useMemo(() => {
    const q = search.toLowerCase();
    return sortedDocs.filter((d) => {
      if (departmentFilter && d.department !== departmentFilter) return false;
      if (!q) return true;
      return (d.name || "").toLowerCase().includes(q) || (d.department || "").toLowerCase().includes(q);
    });
  }, [sortedDocs, search, departmentFilter]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredDocs.length, 30);

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can view documents.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading documents…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed((prev) => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Documents</h2>
              <span className="result-count">{filteredDocs.length} document(s)</span>
            </div>
          </div>
        </div>

        <Button3D onClick={() => { clearDocFormFields(); setShowForm(true); docFormModal.open(); }}>+ Add Doc</Button3D>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder=" Search name or department…"
          onClear={() => { setSearch(""); setDepartmentFilter(""); }}
          active={!!search || !!departmentFilter}
          rightContent={
            <CustomDropdown
              label="Department"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={DOCUMENT_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
              placeholder="All departments"
            />
          }
        />
      </CollapseSection>

      {/* ADD DOC MODAL */}
      {docFormModal.shouldRender && (
        <div className={`modal-overlay ${docFormModal.overlayClass}`}>
          <form
            className={`admin-modal ${docFormModal.modalClass}`}
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <div className="admin-modal-header">
              <h3>Add Document</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close" onClick={resetForm}>
                <img src={closeIcon} alt="" />
              </Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                    placeholder=" "
                    autoFocus
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        name: allowTextInput(prev.name, e.target.value, 100, 5),
                      }))
                    }
                  />
                  <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>
                    Document Name<span className="rf-req">*</span>
                  </label>
                  <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                </div>
                {formErrors.name && <div className="field-error-msg">Document name is required</div>}
              </div>

              <div className="admin-form-group">
                <CustomDropdown
                  label="Department"
                  value={form.department}
                  onChange={(val) => { setForm((p) => ({ ...p, department: val })); setFormErrors((p) => ({ ...p, department: false })); }}
                  options={DOCUMENT_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
                  placeholder="Select department"
                  hasError={formErrors.department}
                />
                {formErrors.department && <div className="field-error-msg">Select a department</div>}
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDatePicker
                    label="Date"
                    value={form.date}
                    onChange={(val) => { setForm((p) => ({ ...p, date: val })); setFormErrors((p) => ({ ...p, date: false })); }}
                    max={todayStr()}
                  />
                  {formErrors.date && <div className="field-error-msg">Date is required</div>}
                </div>
                <div className="admin-form-group">
                  <CustomDatePicker
                    label="Reminder Date"
                    value={form.reminderDate}
                    onChange={(val) => { setForm((p) => ({ ...p, reminderDate: val })); setFormErrors((p) => ({ ...p, reminderDate: false })); }}
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <div className={`file-wrap${formErrors.file ? " file-error" : ""}`}>
                  <input
                    type="file"
                    onChange={handleFilePick}
                    className={`file-input${formErrors.file ? " mat-error" : ""}`}
                  />
                  <div className={`file-label${formErrors.file ? " file-label-error" : ""}`}>
                    {fileLabel ? `✔ ${fileLabel}` : "Choose Document File"}
                  </div>
                </div>
                {formErrors.file && <div className="field-error-msg">Attach a document file</div>}
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
              <Button3D type="submit" disabled={saving}>{saving ? "Saving…" : "Save Document"}</Button3D>
            </div>
          </form>
        </div>
      )}

      {/* TABLE */}
      <div className="table-wrapper" ref={containerRef}>
        <table>
          <thead>
            <tr>
              <th
                onClick={() => handleSort?.("name")}
                className={sortConfig?.key === "name" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Name</span>
                  {sortConfig?.key === "name" && (
                    <span className="sort-arrow">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
              <th>Department</th>
              <th>Date</th>
              <th>Reminder Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <EmptyRow colSpan={5} message="No documents found" />
            ) : (
              filteredDocs.slice(0, displayLimit).map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="clickable" onClick={() => navigate(`/documents/${doc.id}`)}>
                      {doc.name}
                    </span>
                  </td>
                  <td>{doc.department}</td>
                  <td>{formatDisplayDate(doc.date) || doc.date}</td>
                  <td>
                    <span
                      className={
                        isReminderDue(doc.reminderDate)
                          ? "doc-reminder-badge doc-reminder-overdue"
                          : isReminderSoon(doc.reminderDate)
                          ? "doc-reminder-badge doc-reminder-soon"
                          : "doc-reminder-badge"
                      }
                    >
                      {formatDisplayDate(doc.reminderDate) || doc.reminderDate}
                    </span>
                  </td>
                  <td className="icon-width">
                    <Button3D
                      variant="danger"
                      onClick={() =>
                        deleteRecord({
                          api,
                          toast,
                          endpoint: `/documents/${doc.id}`,
                          item: doc,
                          stateKey: "documents",
                          adminData: { documents },
                          setAdminData: (updater) => {
                            setDocuments((prev) => updater({ documents: prev }).documents);
                          },
                          confirmMsg: `Delete "${doc.name}"?`,
                          successMsg: "Document deleted",
                          errorMsg: "Failed to delete document",
                        })
                      }
                    >
                      Delete
                    </Button3D>
                  </td>
                </tr>
              ))
            )}
            <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={5} />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
    </div>
  );
};

export default Documents;
