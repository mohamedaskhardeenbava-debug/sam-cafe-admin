import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./StaffModules.css";
import api from "../../api";

const typeColors = {
    Online: { bg: "#dbeafe", color: "#1e40af" },
    Training: { bg: "#d1fae5", color: "#065f46" },
    Internship: { bg: "#fef3c7", color: "#92400e" },
    Workshop: { bg: "#ede9fe", color: "#4c1d95" },
};

const typeIcons = {
    Online: "🌐",
    Training: "📋",
    Internship: "🏢",
    Workshop: "🔧",
};

export default function StaffTraining({ adminData, setAdminData }) {
    const [trainings, setTrainings] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [trainingSearch, setTrainingSearch] = useState("");
    const [trainingTypeFilter, setTrainingTypeFilter] = useState("");
    const [form, setForm] = useState({
        staffId: "", role: "", duration: "", type: "", certificate: ""
    });

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
        } catch (err) {
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
        if (!filteredTrainings.length) { alert("No training records to export"); return; }
        const rows = filteredTrainings.map(t => ({
            "Staff Name": t.staffName || "—",
            Role: t.role || "—",
            Type: t.type || "—",
            "Duration (days)": t.duration || "—",
            "Certificate": t.certificate ? "Yes" : "No",
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Training");
        XLSX.writeFile(wb, `training_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="staff-page">

            {/* HEADER */}
            <div className="staff-header">
                <h2>Training</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="orders-export-btn" onClick={exportTrainings}>Export</button>
                    <button className="staff-add-btn" onClick={() => setShowForm(true)}>+ Add Training</button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="staff-filter-bar">
                <input
                    className="staff-search-input"
                    placeholder="🔍 Search staff, role, type…"
                    value={trainingSearch}
                    onChange={e => setTrainingSearch(e.target.value)}
                />
                <div className="staff-filter-group">
                    <span className="staff-filter-label">Type</span>
                    {["", "Online", "Training", "Internship", "Workshop"].map(t => (
                        <button key={t} className={`sched-pill-btn${trainingTypeFilter === t ? " active" : ""}`}
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
                    <div className="sm-empty-icon">📚</div>
                    <p>{trainings.length === 0 ? "No training records yet" : "No records match filters"}</p>
                    <span>{trainings.length === 0 ? "Start tracking staff training and certifications" : "Try adjusting your search or filters"}</span>
                </div>
            )}

            {/* CARD GRID */}
            <div className="card-grid">
                {filteredTrainings.map((t, i) => {
                    const colors = typeColors[t.type] || { bg: "#f5f4f1", color: "#3a3a3a" };
                    const icon = typeIcons[t.type] || "📌";
                    return (
                        <div className="card st-card" key={i} onClick={() => setSelected(t)}>
                            <div className="st-card-header">
                                <span className="st-type-chip" style={{ background: colors.bg, color: colors.color }}>
                                    {icon} {t.type || "General"}
                                </span>
                            </div>
                            <h3 className="st-card-role">{t.role}</h3>
                            <div className="st-card-meta">
                                <span className="st-meta-item">👤 {t.staffName}</span>
                                {t.duration && (
                                    <span className="st-meta-item">⏱ {t.duration} days</span>
                                )}
                            </div>
                            {t.certificate && (
                                <div className="st-cert-badge">✔ Certificate attached</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ADD MODAL */}
            {showForm && (
                <div className="category-modal-overlay">
                    <form className="category-modal" onSubmit={addTraining}>
                        <div className="category-modal-header">
                            <h3>Add Training Record</h3>
                            <button type="button" className="dish-close-btn" onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        <div className="category-modal-body">
                            <div className="form-group">
                                <label>Staff Member</label>
                                <select
                                    value={form.staffId || ""}
                                    onChange={e => setForm({ ...form, staffId: e.target.value })}
                                >
                                    <option value="">Select staff member</option>
                                    {adminData.staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="">Select role</option>
                                    <option>Chef</option>
                                    <option>Waiter</option>
                                    <option>Supervisor</option>
                                </select>
                            </div>

                            <div className="st-form-row">
                                <div className="form-group">
                                    <label>Duration (days)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 5"
                                        value={form.duration}
                                        onChange={e => setForm({ ...form, duration: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Type</label>
                                    <select
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="">Select type</option>
                                        <option>Online</option>
                                        <option>Training</option>
                                        <option>Internship</option>
                                        <option>Workshop</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Certificate (optional)</label>
                                <div className="st-file-wrap">
                                    <input type="file" onChange={handleFile} className="st-file-input" />
                                    <div className="st-file-label">
                                        {form.certificate ? "✔ File selected" : "Choose file…"}
                                    </div>
                                </div>
                                {form.certificate && (
                                    <img src={form.certificate} alt="Certificate preview" className="staff-image-preview" />
                                )}
                            </div>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button type="submit">Save Training</button>
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
                                <span className="sc-modal-sub">Training Record</span>
                            </div>
                            <button type="button" className="dish-close-btn" onClick={() => setSelected(null)}>✕</button>
                        </div>

                        <div className="category-modal-body">
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

                        <div className="category-modal-footer form-actions">
                            <button type="button" onClick={() => setSelected(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .st-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .st-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .st-type-chip {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
          letter-spacing: 0.03em;
        }
        .st-card-role {
          font-size: 16px;
          font-weight: 600;
          color: #0f0f0f;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .st-card-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .st-meta-item {
          font-size: 12px;
          color: #6b6b6b;
        }
        .st-cert-badge {
          font-size: 11px;
          font-weight: 600;
          color: #065f46;
          background: #d1fae5;
          padding: 3px 9px;
          border-radius: 999px;
          width: fit-content;
          margin-top: 2px;
        }
        .st-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .st-file-wrap {
          position: relative;
          overflow: hidden;
        }
        .st-file-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100% !important;
          padding: 0 !important;
          border: none !important;
        }
        .st-file-label {
          padding: 9px 12px;
          border: 1px dashed rgba(0,0,0,0.18);
          border-radius: 8px;
          font-size: 13px;
          color: #6b6b6b;
          background: #f5f4f1;
          cursor: pointer;
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
        .sc-modal-sub { font-size:12px; color:#a3a3a3; margin-top:2px; display:block; }
      `}</style>

        </div>
    );
}