import React, { useState, useEffect } from "react";
import "./StaffModules.css";
import api from "../../api";

const roles = ["Chef", "Waiter", "Supervisor", "Manager", "Cleaner"];

export default function StaffCareer() {
    const [jobs, setJobs] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);

    const [form, setForm] = useState({
        role: "",
        description: "",
        experience: ""
    });

    useEffect(() => {
        api.get("/careers").then(res => setJobs(res.data));
    }, []);

    const addJob = async (e) => {
        e.preventDefault();

        try {
            const res = await api.post("/careers", {
                id: Date.now(),
                ...form
            });

            setJobs(prev => [...prev, res.data]); // ✅ instant UI update
            setForm({ role: "", description: "", experience: "" });
            setShowForm(false);

        } catch (err) {
            console.error("Career save failed:", err.response?.data || err.message);
        }
    };

    return (
        <div className="staff-page">

            {/* HEADER (same as staff) */}
            <div className="staff-header">
                <h2>Career</h2>
                <button className="staff-add-btn" onClick={() => setShowForm(true)}>
                    + Add Job Vacancy
                </button>
            </div>

            {/* CARD LIST */}
            <div className="card-grid">
                {jobs.map((job, i) => (
                    <div className="card" key={i} onClick={() => setSelected(job)}>
                        <h3>{job.role}</h3>
                        <p>{job.description}</p>
                        <span>{job.experience} years experience</span>
                    </div>
                ))}
            </div>

            {/* MODAL FORM */}
            {showForm && (
                <div className="category-modal-overlay">
                    <form className="category-modal">

                        <div className="category-modal-header">
                            <h3>Add Job Vacancy</h3>
                            <button className="dish-close-btn" onClick={() => setShowForm(false)}>✖</button>
                        </div>

                        <div className="category-modal-body">
                            <div className="form-group">
                                <label htmlFor="">Role</label>

                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}

                                >
                                    <option value="">Select Role</option>
                                    {roles.map(role => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="">Experience Required</label>
                                <input
                                    value={form.experience}
                                    onChange={e => setForm({ ...form, experience: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button type="button" onClick={addJob}>Save</button>
                            <button onClick={() => setShowForm(false)}>Cancel</button>
                        </div>

                    </form>
                </div >
            )}

            {selected && (
                <div className="category-modal-overlay">
                    <div className="category-modal">
                        <div className="category-modal-body">
                            <table className="staff-training-table">
                                <tr><td>Role</td><td>{selected.role}</td></tr>
                                <tr><td>Description</td><td>{selected.description}</td></tr>
                                <tr><td>Experience</td><td>{selected.experience} years</td></tr>
                            </table>
                        </div>

                        <div className="category-modal-footer form-actions">
                            <button onClick={() => setSelected(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}