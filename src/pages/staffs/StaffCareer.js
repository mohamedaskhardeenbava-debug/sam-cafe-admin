import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./StaffModules.css";
import api from "../../api";
import closeIcon from "../../icon/close-icon.png";

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
                                <div key={i} onClick={() => { onChange(val); setOpen(false); }}>
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

export default function StaffCareer() {
    const [jobs, setJobs] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [careerSearch, setCareerSearch] = useState("");
    const [careerRoleFilter, setCareerRoleFilter] = useState("");
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
            const res = await api.post("/careers", { id: Date.now(), ...form });
            setJobs(prev => [...prev, res.data]);
            setForm({ role: "", description: "", experience: "" });
            setFormErrors({});
            setShowForm(false);
        } catch (err) {
            console.error("Career save failed:", err.response?.data || err.message);
        }
    };

    const filteredJobs = jobs.filter(j => {
        const q = careerSearch.toLowerCase();
        const matchSearch = !q || (j.role || "").toLowerCase().includes(q) || (j.description || "").toLowerCase().includes(q);
        const matchRole = !careerRoleFilter || j.role === careerRoleFilter;
        return matchSearch && matchRole;
    });

    const exportJobs = () => {
        if (!filteredJobs.length) { alert("No job vacancies to export"); return; }
        const rows = filteredJobs.map(j => ({
            Role: j.role || "—",
            "Experience Required": expLabel(j.experience),
            Description: j.description || "—",
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Career Openings");
        XLSX.writeFile(wb, `career_openings_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="staff-page">

            {/* HEADER */}
            <div className="staff-header">
                <h2>Career</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    <button
                        className="modal-save-btn"
                        onClick={exportJobs}
                    >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Export</span>
                    </button>
                    <button
                        className="modal-save-btn"
                        onClick={() => setShowForm(true)}
                    >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">+ Add Job Vacancy</span>
                    </button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="staff-filter-bar">
                <input
                    className="search-input"
                    placeholder=" Search role or description…"
                    value={careerSearch}
                    onChange={e => setCareerSearch(e.target.value)}
                />
                <div className="staff-filter-group">
                    <span className="staff-filter-label">Role</span>
                    {["", ...roles].map(r => (
                        <button key={r} className={`filter-pill${careerRoleFilter === r ? " active" : ""}`}
                            onClick={() => setCareerRoleFilter(r)}>{r || "All"}</button>
                    ))}
                </div>
                {(careerSearch || careerRoleFilter) && (
                    <button className="ae-clear-filter" onClick={() => { setCareerSearch(""); setCareerRoleFilter(""); }}>Clear</button>
                )}
                <span className="ae-result-count">{filteredJobs.length} opening(s)</span>
            </div>

            {/* EMPTY STATE */}
            {filteredJobs.length === 0 && (
                <div className="sm-empty">
                    <div className="sm-empty-icon">💼</div>
                    <p>{jobs.length === 0 ? "No job vacancies yet" : "No vacancies match filters"}</p>
                    <span>{jobs.length === 0 ? "Add your first opening to get started" : "Try adjusting your search or filters"}</span>
                </div>
            )}

            {/* CARD GRID */}
            <div className="career-grid-wrapper">
                <div className="card-grid">
                    {filteredJobs.map((job, i) => {
                        const colors = roleColors[job.role] || { bg: "#f5f4f1", color: "#3a3a3a" };
                        return (
                            <div className="card sc-card" key={i} onClick={() => setSelected(job)}>
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
                    <form className="modal" onSubmit={addJob}>
                        <div className="modal-header">
                            <h3>Add Job Vacancy</h3>
                            <button type="button" className="modal-cancel-btn" onClick={() => { setShowForm(false); setFormErrors({}); }}>
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front close-padding"><img src={closeIcon} /></span>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className={`form-group${formErrors.role ? " mat-select-error" : ""}`}>
                                <CustomDropdown
                                    label="Role"
                                    value={form.role}
                                    onChange={v => { setForm({ ...form, role: v }); setFormErrors(p => ({ ...p, role: false })); }}
                                    options={roles}
                                    placeholder="Select role"
                                    hasError={!!formErrors.role}
                                />
                            </div>

                            <div className="form-group">
                                <div className="mat">
                                    <textarea
                                        className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                                        placeholder=" "
                                        value={form.description}
                                        onChange={e => { setForm({ ...form, description: e.target.value }); setFormErrors(p => ({ ...p, description: false })); }}
                                    />
                                    <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Description<span className="rf-req">*</span></label>
                                    <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                                </div>
                            </div>

                            <div className="form-group">
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

                        <div className="modal-footer">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setFormErrors({}); }}
                                className="modal-cancel-btn"
                            >
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Cancel</span>
                            </button>
                            <button type="submit" className="modal-save-btn">
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Save Vacancy</span>
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
                                <span className="sc-modal-sub">Job Vacancy</span>
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
                                    <tr><td>Role</td><td>{selected.role}</td></tr>
                                    <tr><td>Experience</td><td>{expLabel(selected.experience)}</td></tr>
                                    <tr><td>Description</td><td style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.description || "—"}</td></tr>
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