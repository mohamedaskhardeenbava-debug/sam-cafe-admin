import React, { useState, useEffect } from "react";
import { exportToExcel } from "../../utils/excelUtils";
import "./StaffModules.css";
import api from "../../api";
import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";

const typeColors = {
  Online: { bg: "#dbeafe", color: "#1e40af" },
  Training: { bg: "#d1fae5", color: "#065f46" },
  Internship: { bg: "#fef3c7", color: "#92400e" },
  Workshop: { bg: "#ede9fe", color: "#4c1d95" },
};

// ── CustomDropdown ───────────────────────────────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…", label, required }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
  const displayLabel = selected ? (selected.label !== undefined ? selected.label : selected) : "";

  const wrapperClass = [
    "mat-select",
    value ? "has-value" : "",
    open ? "is-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} ref={ref}>
      {label && (
        <label className="mat-label">
          {label}{required && <span className="rf-req">*</span>}
        </label>
      )}
      <div className="dishes-dropdown-wrapper">
        <button type="button" className="dishes-status-dropdown"
          onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
          {displayLabel || ""}
        </button>
        {open && (
          <div className="dropdown-menu">
            <div onClick={() => { onChange(""); setOpen(false); }}
            >
              {placeholder}
            </div>
            {options.map((o, i) => {
              const val = o.value !== undefined ? o.value : o;
              const lbl = o.label !== undefined ? o.label : o;
              return (
                <div key={i} onClick={() => { onChange(val); setOpen(false); }}
                >
                  {lbl}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <span className="mat-bar" />
    </div>
  );
}

export default function StaffTraining({ adminData, setAdminData }) {
  const { toast } = useToast();
  const [trainings, setTrainings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingTypeFilter, setTrainingTypeFilter] = useState("");
  const [form, setForm] = useState({
    staffId: "", role: "", duration: "", type: "", certificate: ""
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      const res = await api.get("/staff");
      const all = res.data.flatMap(s =>
        (s.training || []).map(t => ({ ...t, staffName: s.name }))
      );
      setTrainings(all);
    };
    load();
  }, []);

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
    const matchType = !trainingTypeFilter || t.type === trainingTypeFilter;
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
    <div className="staff-page">

      {/* HEADER */}
      <div className="staff-header">
        <h2>Training</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="modal-save-btn"
            onClick={exportTrainings}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Export</span>
          </button>
          <button className="modal-save-btn" onClick={() => setShowForm(true)}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">+ Add Training</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="staff-filter-bar">
        <input
          className="search-input"
          placeholder=" Search staff, role, type…"
          value={trainingSearch}
          onChange={e => setTrainingSearch(e.target.value)}
        />
        <div className="staff-filter-group">
          <span className="staff-filter-label">Type</span>
          {["", "Online", "Training", "Internship", "Workshop"].map(t => (
            <button key={t} className={`filter-pill${trainingTypeFilter === t ? " active" : ""}`}
              onClick={() => setTrainingTypeFilter(t)}>{t || "All"}</button>
          ))}
        </div>
        {(trainingSearch || trainingTypeFilter) && (
          <button className="ae-clear-filter" onClick={() => { setTrainingSearch(""); setTrainingTypeFilter(""); }}>Clear</button>
        )}
        <span className="ae-result-count">{filteredTrainings.length} record(s)</span>
      </div>

      {/* EMPTY STATE */}
      {filteredTrainings.length === 0 && (
        <div className="sm-empty">
          <p>{trainings.length === 0 ? "No training records yet" : "No records match filters"}</p>
          <span>{trainings.length === 0 ? "Start tracking staff training and certifications" : "Try adjusting your search or filters"}</span>
        </div>
      )}

      {/* CARD GRID */}
      <div className="career-grid-wrapper">
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
          <form className="modal" onSubmit={addTraining}>
            <div className="modal-header">
              <h3>Add Training Record</h3>
              <button type="button" className="modal-cancel-btn" onClick={() => { setShowForm(false); setFormErrors({}); }}>
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>

            <div className="modal-body">
              <div className="horizontal-form-group">
                <div className={`form-group${formErrors.staffId ? " mat-select-error" : ""}`}>
                  <CustomDropdown
                    label="Staff Member"
                    value={form.staffId || ""}
                    onChange={v => { setForm({ ...form, staffId: v }); setFormErrors(p => ({ ...p, staffId: false })); }}
                    options={adminData.staff.map(s => ({ value: s.id, label: s.name }))}
                    placeholder="Select staff member"
                    hasError={!!formErrors.staffId}
                  />
                </div>

                <div className={`form-group${formErrors.role ? " mat-select-error" : ""}`}>
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
                <div className="form-group">
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

                <div className={`form-group${formErrors.type ? " mat-select-error" : ""}`}>
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

              <div className="form-group">
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

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                type="button"
                onClick={() => { setShowForm(false); setFormErrors({}); }}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Cancel</span>
              </button>
              <button type="submit" className="modal-save-btn">
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Save Training</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selected.role}</h3>
                <span className="sc-modal-sub">Training Record</span>
              </div>
              <button type="button" className="modal-cancel-btn" onClick={() => setSelected(null)}>
                <span class="shadow"></span>
                <span class="edge"></span>
                <span class="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>

            <div className="modal-body">
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

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="modal-cancel-btn"
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}