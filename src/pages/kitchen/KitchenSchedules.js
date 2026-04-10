import React, { useState, useEffect } from "react";
import "./KitchenSchedules.css";
import api from "../../api";

export default function KitchenSchedules({ adminData, setAdminData }) {

    const [show, setShow] = useState(false);
    const [form, setForm] = useState({
        work: "",
        staff: "",
        date: ""
    });

    const list = adminData.kitchenSchedules || [];

    const add = async () => {

        if (!form.work || !form.staff || !form.date) return;

        const newId = list.length > 0
            ? Math.max(...list.map(i => i.id)) + 1
            : 1;

        const newItem = {
            id: newId,
            work: form.work,
            staff: form.staff,
            date: form.date
        };

        try {
            // ✅ USE YOUR API (port 4000)
            await api.post("/kitchenSchedules", newItem);

            // ✅ update UI manually
            setAdminData(prev => ({
                ...prev,
                kitchenSchedules: [...(prev.kitchenSchedules || []), newItem]
            }));

            setForm({ work: "", staff: "", date: "" });
            setShow(false);

        } catch (err) {
            console.error("Failed to add schedule", err);
        }
    };

    const cancel = () => {
        setForm({ work: "", staff: "", date: "" });
        setShow(false);
    }

    const moveExpiredSchedules = async () => {

        const today = new Date().toISOString().split("T")[0];

        const expired = list.filter(item => item.date < today);
        const upcoming = list.filter(item => item.date >= today);

        if (expired.length === 0) return;

        const activity = adminData?.kitchenActivity || [];
        const updatedActivity = [...activity, ...expired];

        await api.put("/kitchenSchedules", upcoming);

        await api.put("/kitchenActivity", updatedActivity);

        setAdminData(prev => ({
            ...prev,
            kitchenSchedules: upcoming,
            kitchenActivity: updatedActivity
        }));
    };

    useEffect(() => {
        moveExpiredSchedules();
    }, []);

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="schedule-page">

            <div className="schedule-header">
                <h2>Kitchen Schedules</h2>

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
                            list.map(i => (
                                <tr key={i.id}>
                                    <td>{i.work}</td>
                                    <td>{i.staff}</td>
                                    <td>{i.date}</td>
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
                            <button onClick={cancel} className="dish-close-btn"></button>
                        </div>

                        <div className="modal-body">
                            <input placeholder="Work"
                                onChange={e => setForm({ ...form, work: e.target.value })}
                            />

                            <select
                                onChange={e => setForm({ ...form, staff: e.target.value })}
                            >
                                <option>Select Staff</option>
                                {adminData.staff?.map(s => (
                                    <option key={s.id}>{s.name}</option>
                                ))}
                            </select>

                            <input
                                type="date"
                                min={today}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                            />
                        </div>

                        <div className="modal-footer form-actions">
                            <button onClick={add}>Save</button>
                            <button onClick={cancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}