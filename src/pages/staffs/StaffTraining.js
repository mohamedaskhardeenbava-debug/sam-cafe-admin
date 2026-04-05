import React, { useState, useEffect } from "react";
import "./StaffModules.css";
import api from "../../api";

export default function StaffTraining({ adminData }) {
    const [trainings, setTrainings] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);

    const [form, setForm] = useState({
        role: "",
        duration: "",
        type: "",
        certificate: ""
    });

    useEffect(() => {
        const load = async () => {
            const res = await api.get("/staff");

            const all = res.data.flatMap(s =>
                (s.training || []).map(t => ({
                    ...t,
                    staffName: s.name
                }))
            );

            setTrainings(all);
        };

        load();
    }, []);

    const addTraining = async (e) => {
        e.preventDefault();

        try {
            const staff = adminData.staff.find(s => s.id === form.staffId);

            const updated = {
                ...staff,
                training: [...(staff.training || []), form]
            };

            await api.put(`/staff/${form.staffId}`, updated);

            setTrainings(prev => [
                ...prev,
                { ...form, staffName: staff.name }
            ]);

            setForm({ role: "", duration: "", type: "", certificate: "" });
            setShowForm(false);

        } catch (err) {
            console.error("Training save failed:", err);
        }
    };

    const handleFile = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onloadend = () => {
            setForm(prev => ({ ...prev, certificate: reader.result }));
        };

        if (file) reader.readAsDataURL(file);
    };

    return (
        <div className="staff-page">

            {/* HEADER */}
            <div className="staff-header">
                <h2>Training</h2>
                <button className="staff-add-btn" onClick={() => setShowForm(true)}>
                    + Add Training
                </button>
            </div>

            {/* CARDS */}
            <div className="card-grid">
                {trainings.map((t, i) => (
                    <div className="card" key={i} onClick={() => setSelected(t)}>
                        <h3>{t.role}</h3>
                        <p>Duration: {t.duration}</p>
                        <p>Type: {t.type}</p>
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {showForm && (
                <div className="category-modal-overlay">
                    <form className="category-modal">

                        <div className="category-modal-header">
                            <h3>Add Training</h3>
                            <button className="dish-close-btn" onClick={() => setShowForm(false)}>✖</button>
                        </div>

                        <div className="category-modal-body">
                            <div className="form-group">
                                <label>Staff</label>
                                <select
                                    value={form.staffId || ""}
                                    onChange={(e) =>
                                        setForm({ ...form, staffId: e.target.value })
                                    }
                                >
                                    <option value="">Select Staff</option>
                                    {adminData.staff.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Role</label>
                                    <select
                                        value={form.role}
                                        onChange={(e) =>
                                            setForm({ ...form, role: e.target.value })
                                        }
                                    >
                                        <option value="">Select Role</option>
                                        <option>Chef</option>
                                        <option>Waiter</option>
                                        <option>Supervisor</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Duration</label>
                                    <input
                                        type="number"
                                        value={form.duration}
                                        onChange={e => setForm({ ...form, duration: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Type</label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="">Select</option>
                                        <option>Online</option>
                                        <option>Training</option>
                                        <option>Internship</option>
                                        <option>Workshop</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Certificate</label>
                                    <input type="file" onChange={handleFile} />

                                    {form.certificate && (
                                        <img src={form.certificate} />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button type="button" onClick={addTraining}>Save</button>
                            <button onClick={() => setShowForm(false)}>Cancel</button>
                        </div>

                    </form>
                </div>
            )}

            {selected && (
                <div className="category-modal-overlay">
                    <div className="category-modal">

                        <div className="category-modal-body">
                            <table className="staff-training-table">
                                <tr><td>Role</td><td>{selected.role}</td></tr>
                                <tr><td>Staff Name</td><td>{selected.staffName}</td></tr>
                                <tr><td>Duration</td><td>{selected.duration}</td></tr>
                                <tr><td>Type of Training</td><td>{selected.type}</td></tr>
                                {selected.certificate && (
                                    <tr>
                                        <td>Certificate</td>
                                        <td>
                                            <a href={selected.certificate} download target="_blank" rel="noreferrer">
                                                Download
                                            </a>
                                        </td>
                                    </tr>
                                )}
                            </table>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button onClick={() => setSelected(null)}>Close</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}