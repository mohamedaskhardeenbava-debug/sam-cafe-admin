/**
 * StaffCareer.js  —  Sam Cafe Admin Panel
 * Staff career/promotion records page
 */

import React, { useState, useEffect } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";
import CollapseChevron from "../../components/CollapseChevron";
import { MultiPillGroup } from "../../components/FilterBar";

import "./StaffModules.css";

const roles = ["Chef", "Waiter", "Supervisor", "Manager", "Cleaner"];

const roleColors = {
  Chef: { bg: "#fef3c7", color: "#92400e" },
  Waiter: { bg: "#dbeafe", color: "#1e40af" },
  Supervisor: { bg: "#d1fae5", color: "#065f46" },
  Manager: { bg: "#ede9fe", color: "#4c1d95" },
  Cleaner: { bg: "#fce7f3", color: "#9d174d" },
};

const expLabel = (yrs) => {
  const n = Number(yrs);
  if (!n) return "Any experience";
  if (n < 2) return `${n} yr experience`;
  return `${n}+ yrs experience`;
};

export default function StaffCareer() {
  // ── Hooks

  const { toast } = useToast();
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [careerSearch, setCareerSearch] = useState("");
  const [careerRoleFilters, setCareerRoleFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const [form, setForm] = useState({ role: "", description: "", experience: "" });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    api.get("/careers").then(res => setJobs(res.data));
  }, []);

  const addJob = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.role) err.role = true;
    if (!form.description.trim()) err.description = true;
    if (Object.keys(err).length) { setFormErrors(err); return; }
    try {
      const res = await api.post("/careers", { id: String(Date.now()), ...form });
      setJobs(prev => [...prev, res.data]);
      setForm({ role: "", description: "", experience: "" });
      setFormErrors({});
      setShowForm(false);
      toast.success("Career record saved");
    } catch (err) {
      toast.error("Failed to save career record");
      console.error("Career save failed:", err.response?.data || err.message);
    }
  };

  const filteredJobs = jobs.filter(j => {
    const q = careerSearch.toLowerCase();
    const matchSearch = !q || (j.role || "").toLowerCase().includes(q) || (j.description || "").toLowerCase().includes(q);
    const matchRole = careerRoleFilters.size === 0 || careerRoleFilters.has(j.role);
    return matchSearch && matchRole;
  });

  const exportJobs = () => {
    if (!filteredJobs.length) { toast.warning("No job vacancies to export"); return; }
    const rows = filteredJobs.map(j => ({
      Role: j.role || "—",
      "Experience Required": expLabel(j.experience),
      Description: j.description || "—",
    }));
    exportToExcel({ rows, sheetName: "Career Openings", fileName: `career_openings_${new Date().toISOString().slice(0, 10)}.xlsx` });
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
            <CollapseChevron collapsed={headerCollapsed} />
          </button>
          <h2 className="title">Career</h2>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportJobs}>Export</Button3D>
          <Button3D onClick={() => setShowForm(true)}>+ Add Job Vacancy</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search role or description…"
              value={careerSearch}
              onChange={e => setCareerSearch(allowTextInput(careerSearch, e.target.value, 100, 5))}
            />
            <MultiPillGroup
              label="Role"
              options={roles.map(r => [r, r])}
              value={careerRoleFilters}
              onToggle={(key) => toggleSet(setCareerRoleFilters, key)}
            />
            {(careerSearch || careerRoleFilters.size > 0) && (
              <button className="ae-clear-filter" onClick={() => { setCareerSearch(""); setCareerRoleFilters(new Set()); }}>Clear</button>
            )}
            <span className="result-count">{filteredJobs.length} opening(s)</span>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {filteredJobs.length === 0 && (
        <div className="sm-empty">
          <div className="sm-empty-icon">💼</div>
          <p>{jobs.length === 0 ? "No job vacancies yet" : "No vacancies match filters"}</p>
          <span>{jobs.length === 0 ? "Add your first opening to get started" : "Try adjusting your search or filters"}</span>
        </div>
      )}

      {/* CARD GRID */}
      <div className={`career-grid-wrapper${headerCollapsed ? " header-is-collapsed" : ""}`}>
        <div className="card-grid">
          {filteredJobs.map((job, i) => {
            const colors = roleColors[job.role] || { bg: "#f5f4f1", color: "#3a3a3a" };
            return (
              <div className="card sc-card" key={job.id} onClick={() => setSelected(job)}>
                <div className="st-card-accent" style={{ background: colors.color }} />

                <div className="sc-card-body">
                  <div className="sc-card-top">
                    <span
                      className="sc-role-chip"
                      style={{ background: colors.bg, color: colors.color }}
                    >
                      {job.role}
                    </span>
                    <span className="sc-exp-chip">{expLabel(job.experience)}</span>
                  </div>
                  <p className="sc-desc">{job.description || "No description provided."}</p>
                </div>

                <div className="sc-footer">
                  <div className="st-ribbon-wing1"></div>
                  <div className="st-ribbon-wing1-sq1"></div>
                  <label className="sc-ribbon-label">
                    {i < 10 ? `0${i + 1}` : i + 1}
                  </label>
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
          <form className="admin-modal" onSubmit={addJob}>
            <div className="admin-modal-header">
              <h3>Add Job Vacancy</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { setShowForm(false); setFormErrors({}); }}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className={`admin-form-group${formErrors.role ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Role"
                  value={form.role}
                  onChange={v => { setForm({ ...form, role: v }); setFormErrors(p => ({ ...p, role: false })); }}
                  options={roles}
                  placeholder="Select role"
                  hasError={!!formErrors.role}
                />
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.description}
                    onChange={e => { setForm({ ...form, description: allowTextInput(form.description, e.target.value, 500, 100000) }); setFormErrors(p => ({ ...p, description: false })); }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Description<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    min="0"
                    value={form.experience}
                    onChange={e => setForm({ ...form, experience: e.target.value })}
                  />
                  <label className="mat-label">Experience Required (years)</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { setShowForm(false); setFormErrors({}); }}>Cancel</Button3D>
              <Button3D type="submit">Save Vacancy</Button3D>
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
                <span className="sc-modal-sub">Job Vacancy</span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => setSelected(null)}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <table className="staff-training-table">
                <tbody>
                  <tr><td>Role</td><td>{selected.role}</td></tr>
                  <tr><td>Experience</td><td>{expLabel(selected.experience)}</td></tr>
                  <tr><td>Description</td><td style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.description || "—"}</td></tr>
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