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

// ── CustomDropdown ───────────────────────────────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…" }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
    const label = selected ? (selected.label !== undefined ? selected.label : selected) : placeholder;
    return (
        <div className="dishes-dropdown-wrapper" ref={ref}>
            <button type="button" className="dishes-status-dropdown"
                onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
                {label}
            </button>
            {open && (
                <div className="dropdown-menu">
                    {placeholder && (
                        <div onClick={() => { onChange(""); setOpen(false); }}
                            style={{ color: "#aaa", fontStyle: "italic" }}>{placeholder}</div>
                    )}
                    {options.map((o, i) => {
                        const val = o.value !== undefined ? o.value : o;
                        const lbl = o.label !== undefined ? o.label : o;
                        return (
                            <div key={i} onClick={() => { onChange(val); setOpen(false); }}>{lbl}</div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

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
                    <button className="export-btn" onClick={exportTrainings}>Export</button>
                    <button className="category-add-btn" onClick={() => setShowForm(true)}>+ Add Training</button>
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
                    <p>{trainings.length === 0 ? "No training records yet" : "No records match filters"}</p>
                    <span>{trainings.length === 0 ? "Start tracking staff training and certifications" : "Try adjusting your search or filters"}</span>
                </div>
            )}

            {/* CARD GRID */}
            <div className="card-grid-wrapper">
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
                            <button type="button" className="close-btn" onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Staff Member</label>
                                <CustomDropdown
                                    value={form.staffId || ""}
                                    onChange={v => setForm({ ...form, staffId: v })}
                                    options={adminData.staff.map(s => ({ value: s.id, label: s.name }))}
                                    placeholder="Select staff member"
                                />
                            </div>

                            <div className="form-group">
                                <label>Role</label>
                                <CustomDropdown
                                    value={form.role}
                                    onChange={v => setForm({ ...form, role: v })}
                                    options={["Chef", "Waiter", "Supervisor"]}
                                    placeholder="Select role"
                                />
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
                                    <CustomDropdown
                                        value={form.type}
                                        onChange={v => setForm({ ...form, type: v })}
                                        options={["Online", "Training", "Internship", "Workshop"]}
                                        placeholder="Select type"
                                    />
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

                        <div className="modal-footer">
                            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                            <button type="submit">Save Training</button>
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
                            <button type="button" className="close-btn" onClick={() => setSelected(null)}>✕</button>
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
                            <button type="button" onClick={() => setSelected(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}