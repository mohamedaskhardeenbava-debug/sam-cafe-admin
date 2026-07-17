/**
 * StaffTraining.js  —  Sam Cafe Admin Panel
 * Staff training records page
 */

import React, { useState, useEffect } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";
import { MultiPillGroup } from "../../components/FilterBar";

import "./StaffModules.css";
import PageLoader from "../../components/PageLoader";

const typeColors = {
  Online: { bg: "#dbeafe", color: "#1e40af" },
  Training: { bg: "#d1fae5", color: "#065f46" },
  Internship: { bg: "#fef3c7", color: "#92400e" },
  Workshop: { bg: "#ede9fe", color: "#4c1d95" },
};

export default function StaffTraining({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();

  const [trainings, setTrainings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingTypeFilters, setTrainingTypeFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const [form, setForm] = useState({
    staffId: "", role: "", duration: "", type: "", certificate: ""
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/staff");
        const all = res.data.flatMap(s =>
          (s.training || []).map(t => ({ ...t, staffName: s.name }))
        );
        setTrainings(all);
      } catch (err) {
        console.error("Failed to load staff training data:", err);
        toast.error("Failed to load training data. Please reload the page.");
      }
    };
    load();
  }, []);
  if (!adminData?.staff?.length) return <PageLoader label="Loading training records…" />;

  const addTraining = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.staffId) err.staffId = true;
    if (!form.role) err.role = true;
    if (!form.duration) err.duration = true;
    if (!form.type) err.type = true;
    if (Object.keys(err).length) { setFormErrors(err); return; }
    try {
      const staff = adminData.staff.find(s => s.id === form.staffId);
      const updated = { ...staff, training: [...(staff.training || []), form] };
      const res = await api.put(`/staff/${form.staffId}`, updated);
      setTrainings(prev => [...prev, { ...form, staffName: staff.name }]);
      setAdminData(prev => ({
        ...prev,
        staff: prev.staff.map(s => s.id === form.staffId ? res.data : s)
      }));
      setForm({ staffId: "", role: "", duration: "", type: "", certificate: "" });
      setShowForm(false);
      toast.success("Training record saved");
    } catch (err) {
      toast.error("Failed to save training record");
      console.error("Training save failed:", err);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => setForm(prev => ({ ...prev, certificate: reader.result }));
    if (file) reader.readAsDataURL(file);
  };

  const filteredTrainings = trainings.filter(t => {
    const q = trainingSearch.toLowerCase();
    const matchSearch = !q ||
      (t.role || "").toLowerCase().includes(q) ||
      (t.staffName || "").toLowerCase().includes(q) ||
      (t.type || "").toLowerCase().includes(q);
    const matchType = trainingTypeFilters.size === 0 || trainingTypeFilters.has(t.type);
    return matchSearch && matchType;
  });

  const exportTrainings = () => {
    if (!filteredTrainings.length) { toast.warning("No training records to export"); return; }
    const rows = filteredTrainings.map(t => ({
      "Staff Name": t.staffName || "—",
      Role: t.role || "—",
      Type: t.type || "—",
      "Duration (days)": t.duration || "—",
      "Certificate": t.certificate ? "Yes" : "No",
    }));
    exportToExcel({ rows, sheetName: "Training", fileName: `training_${new Date().toISOString().slice(0, 10)}.xlsx` });
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <button
            type="button"
            className="header-collapse-btn"
            onClick={() => setHeaderCollapsed(prev => !prev)}
            title={headerCollapsed ? "Expand header" : "Collapse header"}
            aria-expanded={!headerCollapsed}
          >
            <span className={`header-collapse-arrow${headerCollapsed ? " rotated" : ""}`}>▾</span>
          </button>
          <h2 className="title">Training</h2>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportTrainings}>Export</Button3D>
          <Button3D onClick={() => setShowForm(true)}>+ Add Training</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search staff, role, type…"
              value={trainingSearch}
              onChange={e => setTrainingSearch(allowTextInput(trainingSearch, e.target.value, 100, 5))}
            />
            <MultiPillGroup
              label="Type"
              options={["Online", "Training", "Internship", "Workshop"].map(t => [t, t])}
              value={trainingTypeFilters}
              onToggle={(key) => toggleSet(setTrainingTypeFilters, key)}
            />
            {(trainingSearch || trainingTypeFilters.size > 0) && (
              <button className="ae-clear-filter" onClick={() => { setTrainingSearch(""); setTrainingTypeFilters(new Set()); }}>Clear</button>
            )}
            <span className="result-count">{filteredTrainings.length} record(s)</span>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {filteredTrainings.length === 0 && (
        <div className="sm-empty">
          <p>{trainings.length === 0 ? "No training records yet" : "No records match filters"}</p>
          <span>{trainings.length === 0 ? "Start tracking staff training and certifications" : "Try adjusting your search or filters"}</span>
        </div>
      )}

      {/* CARD GRID */}
      <div className={`career-grid-wrapper${headerCollapsed ? " header-is-collapsed" : ""}`}>
        <div className="card-grid">
          {filteredTrainings.map((t, i) => {
            const colors = typeColors[t.type] || { bg: "#f5f4f1", color: "#3a3a3a" };
            return (
              <div className="card st-card" key={i} onClick={() => setSelected(t)}>
                {/* accent bar coloured by type */}
                <div className="st-card-accent" style={{ background: colors.color }} />

                <div className="st-card-body">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {t.type && (
                      <span
                        className="st-type-chip"
                        style={{ background: colors.bg, color: colors.color }}
                      >
                        {t.type}
                      </span>
                    )}
                  </div>

                  {/* role title */}
                  <h3 className="st-card-role">{t.role}</h3>

                  {/* meta */}
                  <div className="st-card-meta">
                    <span className="st-meta-item">👤 {t.staffName}</span>
                    {t.duration && (
                      <span className="st-meta-item">⏱ {t.duration} days</span>
                    )}
                  </div>

                  {/* certificate badge */}
                  {t.certificate && (
                    <div className="st-cert-badge">✔ Certified</div>
                  )}
                </div>

                <div className="st-card-footer">
                  <div className="st-ribbon-wing1"></div>
                  <div className="st-ribbon-wing1-sq1"></div>
                  <label className="st-ribbon-label">{i < 10 ? `0${i + 1}` : i + 1}</label>
                  <div className="st-ribbon-wing2"></div>
                  <div className="st-ribbon-wing1-sq2"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD MODAL */}
      {showForm && (
        <div className="modal-overlay">
          <form className="admin-modal" onSubmit={addTraining}>
            <div className="admin-modal-header">
              <h3>Add Training Record</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { setShowForm(false); setFormErrors({}); }}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="horizontal-form-group">
                <div className={`admin-form-group${formErrors.staffId ? " mat-select-error" : ""}`}>
                  <CustomDropdown
                    label="Staff Member"
                    value={form.staffId || ""}
                    onChange={v => { setForm({ ...form, staffId: v }); setFormErrors(p => ({ ...p, staffId: false })); }}
                    options={adminData.staff.map(s => ({ value: s.id, label: s.name }))}
                    placeholder="Select staff member"
                    hasError={!!formErrors.staffId}
                  />
                </div>

                <div className={`admin-form-group${formErrors.role ? " mat-select-error" : ""}`}>
                  <CustomDropdown
                    label="Role"
                    value={form.role}
                    onChange={v => { setForm({ ...form, role: v }); setFormErrors(p => ({ ...p, role: false })); }}
                    options={["Chef", "Waiter", "Supervisor"]}
                    placeholder="Select role"
                    hasError={!!formErrors.role}
                  />
                </div>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.duration ? " mat-error" : ""}`}
                      placeholder=" "
                      type="number"
                      min="1"
                      value={form.duration}
                      onChange={e => { setForm({ ...form, duration: e.target.value }); setFormErrors(p => ({ ...p, duration: false })); }}
                    />
                    <label className={`mat-label${formErrors.duration ? " mat-label-error" : ""}`}>Duration (days)<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.duration ? " mat-bar-error" : ""}`} />
                  </div>
                </div>

                <div className={`admin-form-group${formErrors.type ? " mat-select-error" : ""}`}>
                  <CustomDropdown
                    label="Type"
                    value={form.type}
                    onChange={v => { setForm({ ...form, type: v }); setFormErrors(p => ({ ...p, type: false })); }}
                    options={["Online", "Training", "Internship", "Workshop"]}
                    placeholder="Select type"
                    hasError={!!formErrors.type}
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label>Certificate (optional)</label>
                <div className="file-wrap">
                  <input type="file" onChange={handleFile} className="file-input" />
                  <div className="file-label">
                    {form.certificate ? "✔ File selected" : "Choose file…"}
                  </div>
                </div>
                {form.certificate && (
                  <img src={form.certificate} alt="Certificate preview" className="staff-image-preview" />
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { setShowForm(false); setFormErrors({}); }}>Cancel</Button3D>
              <Button3D type="submit">Save Training</Button3D>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>{selected.role}</h3>
                <span className="sc-modal-sub">Training Record</span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => setSelected(null)}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <table className="staff-training-table">
                <tbody>
                  <tr><td>Staff</td><td>{selected.staffName}</td></tr>
                  <tr><td>Role</td><td>{selected.role}</td></tr>
                  <tr><td>Duration</td><td>{selected.duration} days</td></tr>
                  <tr><td>Type</td><td>{selected.type}</td></tr>
                  {selected.certificate && (
                    <tr>
                      <td>Certificate</td>
                      <td>
                        <a
                          href={selected.certificate}
                          download
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#0f0f0f", fontWeight: 600, textDecoration: "underline" }}
                        >
                          Download ↓
                        </a>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => setSelected(null)}>Close</Button3D>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}