import React, { useState, useEffect } from "react";
import "./ServiceSchedules.css";
import api from "../../api";

export default function ServiceSchedules({ adminData, setAdminData }) {

    const [show, setShow] = useState(false);

    const [form, setForm] = useState({
        work: "",
        staff: "",
        date: ""
    });

    // ✅ SAFE ARRAY
    const list = Array.isArray(adminData?.serviceSchedules)
        ? adminData.serviceSchedules
        : [];

    const addSchedule = async () => {

        if (!form.work || !form.staff || !form.date) return;

        // ✅ incremental ID
        const newId = list.length > 0
            ? Math.max(...list.map(i => i.id)) + 1
            : 1;

        const newItem = { id: newId, ...form };

        try {
            // ✅ correct API (port 4000)
            await api.post("/serviceSchedules", newItem);

            setAdminData(prev => ({
                ...prev,
                serviceSchedules: [...list, newItem]
            }));

            setShow(false);
            setForm({ work: "", staff: "", date: "" });

        } catch (err) {
            console.error("Failed to add schedule", err);
        }
    };

    const cancelSchedule = () => {
        setShow(false);
        setForm({ work: "", staff: "", date: "" });
    }

    const moveExpiredSchedules = async () => {

        const today = new Date().toISOString().split("T")[0];

        const expired = list.filter(item => item.date < today);
        const upcoming = list.filter(item => item.date >= today);

        if (expired.length === 0) return;

        // 👉 Add to activity
        const activity = adminData?.serviceActivity || [];
        const updatedActivity = [...activity, ...expired];

        // 👉 Update backend
        try {
            await api.put("/serviceActivity", updatedActivity);
            await api.put("/serviceSchedules", upcoming);

            setAdminData(prev => ({
                ...prev,
                serviceSchedules: upcoming,
                serviceActivity: updatedActivity
            }));

        } catch (err) {
            console.error("MOVE FAILED:", err);
        }
    };

    useEffect(() => {
        moveExpiredSchedules();
    }, []);

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="schedule-page">

            <div className="schedule-header">
                <h2>Service Schedules</h2>

                <button onClick={() => setShow(true)}>
                    + Add Schedule
                </button>
            </div>

            <div className="schedule-table-wrapper">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th>Work</th>
                            <th>Staff</th>
                            <th>Date</th>
                        </tr>
                    </thead>

                    <tbody>
                        {list.length === 0 ? (
                            <tr>
                                <td colSpan="3" style={{ textAlign: "center" }}>
                                    No schedules available
                                </td>
                            </tr>
                        ) : (
                            list.map(item => (
                                <tr key={item.id}>
                                    <td>{item.work}</td>
                                    <td>{item.staff}</td>
                                    <td>{item.date}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {show && (
                <div className="modal-overlay">
                    <div className="modal">

                        <div className="modal-header">
                            <h3>Add Schedule</h3>
                            <button onClick={cancelSchedule} className="dish-close-btn"></button>
                        </div>

                        <div className="modal-body">
                            <input
                                placeholder="Work"
                                value={form.work}
                                onChange={e => setForm({ ...form, work: e.target.value })}
                            />

                            <select
                                value={form.staff}
                                onChange={e => setForm({ ...form, staff: e.target.value })}
                            >
                                <option value="">Select Staff</option>
                                {adminData.staff?.map(s => (
                                    <option key={s.id}>{s.name}</option>
                                ))}
                            </select>

                            <input
                                type="date"
                                min={today}
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                            />
                        </div>

                        <div className="modal-footer form-actions">
                            <button onClick={addSchedule}>Save</button>
                            <button onClick={cancelSchedule}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}