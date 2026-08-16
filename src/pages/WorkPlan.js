/**
 * WorkPlan.js  —  Sam Cafe Admin Panel
 * Dashboard → Work Plan tab. Upcoming meetings and work-schedule items
 * for the Super Admin — visible and editable only by Super Admin
 * accounts (enforced both by only being reachable from SalesDashboard,
 * which already Super-Admin-gates via Dashboard.js, and again
 * server-side on every /work-plan route). Each Super Admin account only
 * ever sees their own plan (scoped by adminId server-side).
 */
import React, { useMemo, useState } from "react";

import api from "../api";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import ConfirmDialog from "../components/ConfirmDialog";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { CustomTimePicker } from "../components/CustomTimePicker";
import { allowTextInput } from "../App";
import { todayStr } from "../utils/dateRangeUtils";
import { fmtDate as fmtDateNumeric } from "../utils/dateUtils";

import "./WorkPlan.css";

const EMPTY_FORM = { title: "", notes: "", type: "meeting", date: "", time: "", location: "" };

const TYPE_LABELS = { meeting: "Meeting", task: "Task" };

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString("en-IN", { weekday: "short" });
  return `${weekday}, ${fmtDateNumeric(dateStr)}`;
}

export default function WorkPlan({ adminData, setAdminData }) {
  const { toast } = useToast();
  const items = adminData?.workPlan || [];

  const [showModal, setShowModal] = useState(false);
  const workPlanModal = useAnimatedModal("workPlan-addEdit");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { upcoming, past } = useMemo(() => {
    const today = todayStr();
    const sorted = [...items].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    return {
      upcoming: sorted.filter((i) => i.status !== "cancelled" && i.date >= today),
      past: sorted.filter((i) => i.status === "cancelled" || i.date < today).reverse(),
    };
  }, [items]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: todayStr() });
    setFormErrors({});
    setShowModal(true);
    workPlanModal.open();
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ title: item.title, notes: item.notes || "", type: item.type, date: item.date, time: item.time || "", location: item.location || "" });
    setFormErrors({});
    setShowModal(true);
    workPlanModal.open();
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = true;
    if (!form.date) e.date = true;
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await api.patch(`/work-plan/${editingId}`, form);
        setAdminData((prev) => ({ ...prev, workPlan: (prev.workPlan || []).map((i) => (i.id === editingId ? res.data : i)) }));
        toast.success("Work plan item updated.");
      } else {
        const res = await api.post("/work-plan", form);
        setAdminData((prev) => ({ ...prev, workPlan: [...(prev.workPlan || []), res.data] }));
        toast.success("Added to work plan.");
      }
      workPlanModal.close(() => setShowModal(false));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save work plan item");
    } finally {
      setSaving(false);
    }
  };

  const markDone = async (item) => {
    try {
      const res = await api.patch(`/work-plan/${item.id}`, { status: item.status === "done" ? "upcoming" : "done" });
      setAdminData((prev) => ({ ...prev, workPlan: (prev.workPlan || []).map((i) => (i.id === item.id ? res.data : i)) }));
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/work-plan/${deleteTarget.id}`);
      setAdminData((prev) => ({ ...prev, workPlan: (prev.workPlan || []).filter((i) => i.id !== deleteTarget.id) }));
      toast.success("Removed from work plan.");
    } catch (err) {
      toast.error("Failed to delete work plan item");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="wp-panel">
      <div className="wp-panel-header">
        <div className="wp-panel-title">
          <h3>Your Work Plan</h3>
          <span className="result-count">{upcoming.length} upcoming</span>
        </div>
        <Button3D onClick={openCreate}>+ Add to Work Plan</Button3D>
      </div>

      <p className="wp-hint">Meetings and work schedule items only you can see.</p>

      <div className="wp-list">
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="wp-empty">Nothing planned yet — add a meeting or task to get started.</div>
        ) : (
          <>
            {upcoming.map((item) => (
              <div key={item.id} className={`wp-item wp-item--${item.type}`}>
                <label className="wp-item-check">
                  <input type="checkbox" checked={item.status === "done"} onChange={() => markDone(item)} />
                </label>
                <div className="wp-item-body" onClick={() => openEdit(item)}>
                  <div className="wp-item-top">
                    <span className={`wp-type-badge wp-type-badge--${item.type}`}>{TYPE_LABELS[item.type] || item.type}</span>
                    <span className="wp-item-date">{fmtDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
                  </div>
                  <div className={`wp-item-title${item.status === "done" ? " wp-item-title--done" : ""}`}>{item.title}</div>
                  {item.location && <div className="wp-item-location">📍 {item.location}</div>}
                  {item.notes && <div className="wp-item-notes">{item.notes}</div>}
                </div>
                <Button3D variant="cancel" iconOnly title="Remove" onClick={() => setDeleteTarget(item)}>✕</Button3D>
              </div>
            ))}

            {past.length > 0 && (
              <>
                <div className="wp-section-divider">Past</div>
                {past.slice(0, 10).map((item) => (
                  <div key={item.id} className={`wp-item wp-item--past wp-item--${item.type}`}>
                    <div className="wp-item-body" onClick={() => openEdit(item)}>
                      <div className="wp-item-top">
                        <span className={`wp-type-badge wp-type-badge--${item.type}`}>{TYPE_LABELS[item.type] || item.type}</span>
                        <span className="wp-item-date">{fmtDate(item.date)}{item.time ? ` · ${item.time}` : ""}</span>
                      </div>
                      <div className="wp-item-title">{item.title}</div>
                    </div>
                    <Button3D variant="cancel" iconOnly title="Remove" onClick={() => setDeleteTarget(item)}>✕</Button3D>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {workPlanModal.shouldRender && (
        <div className={`modal-overlay ${workPlanModal.overlayClass}`}>
          <form
            className={`admin-modal ${workPlanModal.modalClass}`}
            onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          >
            <div className="admin-modal-header">
              <h3>{editingId ? "Edit Work Plan Item" : "Add to Work Plan"}</h3>
              <Button3D variant="cancel" iconOnly onClick={() => workPlanModal.close(() => setShowModal(false))}>×</Button3D>
            </div>

            <div className="admin-modal-body">
              <div className={`admin-form-group${formErrors.title ? " mat-select-error" : ""}`}>
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.title ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.title}
                    onChange={(e) => { setForm({ ...form, title: allowTextInput(form.title, e.target.value, 100, 5) }); setFormErrors((p) => ({ ...p, title: false })); }}
                  />
                  <label className={`mat-label${formErrors.title ? " mat-label-error" : ""}`}>Title<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.title ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <CustomDropdown
                    label="Type"
                    value={form.type}
                    onChange={(v) => setForm({ ...form, type: v })}
                    options={[{ value: "meeting", label: "Meeting" }, { value: "task", label: "Task" }]}
                  />
                </div>
                <div className={`admin-form-group${formErrors.date ? " mat-select-error" : ""}`}>
                  <label className="mat-label" style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Date<span className="rf-req">*</span></label>
                  <CustomDatePicker
                    value={form.date}
                    onChange={(v) => { setForm({ ...form, date: v }); setFormErrors((p) => ({ ...p, date: false })); }}
                    placeholder="Select date"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="mat-label" style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Time (optional)</label>
                <CustomTimePicker
                  value={form.time}
                  onChange={(v) => setForm({ ...form, time: v })}
                  placeholder="Select time"
                />
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: allowTextInput(form.location, e.target.value, 100, 5) })}
                  />
                  <label className="mat-label">Location / Link (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: allowTextInput(form.notes, e.target.value, 500, 100) })}
                  />
                  <label className="mat-label">Notes (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => workPlanModal.close(() => setShowModal(false))}>Cancel</Button3D>
              <Button3D type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add"}</Button3D>
            </div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove from work plan"
        message={<>Remove "<strong>{deleteTarget?.title}</strong>"? This cannot be undone.</>}
        confirmLabel="Remove"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
