import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./StaffModules.css";
import api from "../../api";

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
    const [jobs, setJobs] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [careerSearch, setCareerSearch] = useState("");
    const [careerRoleFilter, setCareerRoleFilter] = useState("");
    const [form, setForm] = useState({ role: "", description: "", experience: "" });

    useEffect(() => {
        api.get("/careers").then(res => setJobs(res.data));
    }, []);

    const addJob = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/careers", { id: Date.now(), ...form });
            setJobs(prev => [...prev, res.data]);
            setForm({ role: "", description: "", experience: "" });
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
                    <button className="orders-export-btn" onClick={exportJobs}>Export</button>
                    <button className="staff-add-btn" onClick={() => setShowForm(true)}>+ Add Job Vacancy</button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="staff-filter-bar">
                <input
                    className="staff-search-input"
                    placeholder="🔍 Search role or description…"
                    value={careerSearch}
                    onChange={e => setCareerSearch(e.target.value)}
                />
                <div className="staff-filter-group">
                    <span className="staff-filter-label">Role</span>
                    {["", ...roles].map(r => (
                        <button key={r} className={`sched-pill-btn${careerRoleFilter === r ? " active" : ""}`}
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
            <div className="card-grid">
                {filteredJobs.map((job, i) => {
                    const colors = roleColors[job.role] || { bg: "#f5f4f1", color: "#3a3a3a" };
                    return (
                        <div className="card sc-card" key={i} onClick={() => setSelected(job)}>
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
                            <div className="sc-footer">
                                <span className="sc-open-label">View details →</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ADD MODAL */}
            {showForm && (
                <div className="category-modal-overlay">
                    <form className="category-modal" onSubmit={addJob}>
                        <div className="category-modal-header">
                            <h3>Add Job Vacancy</h3>
                            <button type="button" className="dish-close-btn" onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        <div className="category-modal-body">
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="">Select role</option>
                                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    placeholder="Describe responsibilities and requirements…"
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Experience Required (years)</label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={form.experience}
                                    onChange={e => setForm({ ...form, experience: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button type="submit">Save Vacancy</button>
                            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* DETAIL MODAL */}
            {selected && (
                <div className="category-modal-overlay" onClick={() => setSelected(null)}>
                    <div className="category-modal" onClick={e => e.stopPropagation()}>
                        <div className="category-modal-header">
                            <div>
                                <h3>{selected.role}</h3>
                                <span className="sc-modal-sub">Job Vacancy</span>
                            </div>
                            <button type="button" className="dish-close-btn" onClick={() => setSelected(null)}>✕</button>
                        </div>

                        <div className="category-modal-body">
                            <table className="staff-training-table">
                                <tbody>
                                    <tr><td>Role</td><td>{selected.role}</td></tr>
                                    <tr><td>Experience</td><td>{expLabel(selected.experience)}</td></tr>
                                    <tr><td>Description</td><td style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selected.description || "—"}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button type="button" onClick={() => setSelected(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* LOCAL STYLES */}
            <style>{`
        .sc-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sc-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sc-role-chip {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .sc-exp-chip {
          font-size: 11px;
          color: #a3a3a3;
          font-weight: 500;
        }
        .sc-desc {
          font-size: 13px;
          color: #555;
          line-height: 1.55;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .sc-footer {
          margin-top: 4px;
          padding-top: 10px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .sc-open-label {
          font-size: 12px;
          font-weight: 600;
          color: #888;
        }
        .sc-modal-sub {
          font-size: 12px;
          color: #a3a3a3;
          margin-top: 2px;
          display: block;
        }
        .sm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          gap: 6px;
        }
        .sm-empty-icon { font-size: 36px; margin-bottom: 6px; }
        .sm-empty p { font-size: 15px; font-weight: 600; color: #3a3a3a; margin: 0; }
        .sm-empty span { font-size: 13px; color: #a3a3a3; }
      `}</style>

        </div>
    );
}