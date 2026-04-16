import React, { useState, useEffect } from "react";
import "./ServiceSchedules.css";
import api from "../../api";

export default function ServiceSchedules({ adminData, setAdminData }) {
    const [openDropdown, setOpenDropdown] = useState(null);
    const [show, setShow] = useState(false);
    const [form, setForm] = useState({
        work: "",
        staff: "",
        date: "",
        department: "",
        status: "",
        lastRate: ""
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

        const newItem = {
            id: newId,
            ...form
        };

        try {
            // ✅ correct API (port 4000)
            await api.post("/serviceSchedules", newItem);

            setAdminData(prev => ({
                ...prev,
                serviceSchedules: [...list, newItem]
            }));

            setShow(false);
            setForm({
                work: "",
                staff: "",
                date: "",
                department: "",
                status: "",
                lastRate: ""
            });

        } catch (err) {
            console.error("Failed to add schedule", err);
        }
    };

    const cancelSchedule = () => {
        setShow(false);
        setForm({
            work: "",
            staff: "",
            date: "",
            department: "",
            status: "",
            lastRate: ""
        });
    }

    const moveExpiredSchedules = async () => {
        const today = new Date().toISOString().split("T")[0];

        const expired = list.filter(item => item.date < today);
        const upcoming = list.filter(item => item.date >= today);

        if (expired.length === 0) return;

        try {
            // ✅ 1. Move expired → activity
            for (const item of expired) {
                await api.post("/serviceActivity", item);
            }

            // ✅ 2. Delete all schedules
            for (const item of list) {
                await api.delete(`/serviceSchedules/${item.id}`);
            }

            // ✅ 3. Re-add upcoming schedules
            for (const item of upcoming) {
                await api.post("/serviceSchedules", item);
            }

            // ✅ 4. Update UI
            setAdminData(prev => ({
                ...prev,
                serviceSchedules: upcoming,
                serviceActivity: [...(prev.serviceActivity || []), ...expired]
            }));

        } catch (err) {
            console.error("MOVE FAILED:", err);
        }
    };

    useEffect(() => {
        moveExpiredSchedules();
    }, []);

    useEffect(() => {
        const close = () => setOpenDropdown(null);
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
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
                            <th>Department</th>
                            <th>Status</th>
                            <th>Last Rate</th>
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
                                    <td>{item.department || "-"}</td>
                                    <td>{item.status || "-"}</td>
                                    <td>{item.lastRate ? `${item.lastRate} days` : "-"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {show && (
                <div className="category-modal-overlay">
                    <form
                        className="category-modal"
                        onSubmit={(e) => {
                            e.preventDefault();
                            addSchedule(); // SMS / KMS
                        }}
                    >

                        {/* HEADER */}
                        <div className="category-modal-header">
                            <h3>Add Schedule</h3>
                            <button
                                type="button"
                                className="dish-close-btn"
                                onClick={cancelSchedule}
                            ></button>
                        </div>

                        {/* BODY */}
                        <div className="category-modal-body">

                            {/* WORK */}
                            <div className="form-group">
                                <label>Work</label>
                                <input
                                    required
                                    value={form.work}
                                    onChange={(e) =>
                                        setForm({ ...form, work: e.target.value })
                                    }
                                />
                            </div>

                            {/* STAFF */}
                            <div className="form-group">
                                <label>Staff</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button
                                        type="button"
                                        className="dishes-status-dropdown"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdown(prev => prev === "staff" ? null : "staff");
                                        }}
                                    >
                                        {form.staff || "Select Staff"}
                                    </button>

                                    {openDropdown === "staff" && (
                                        <div className="dishes-dropdown-menu">
                                            {adminData.staff?.map(s => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => {
                                                        setForm({ ...form, staff: s.name });
                                                        setOpenDropdown(null);
                                                    }}
                                                >
                                                    {s.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* DATE */}
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    required
                                    type="date"
                                    min={today}
                                    value={form.date}
                                    onChange={(e) =>
                                        setForm({ ...form, date: e.target.value })
                                    }
                                />
                            </div>

                            {/* DEPARTMENT */}
                            <div className="form-group">
                                <label>Department</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button
                                        type="button"
                                        className="dishes-status-dropdown"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdown(prev => prev === "dept" ? null : "dept");
                                        }}
                                    >
                                        {form.department || "Select Department"}
                                    </button>

                                    {openDropdown === "dept" && (
                                        <div className="dishes-dropdown-menu">
                                            {["Pest Control", "Maintenance", "Laundry"].map(dep => (
                                                <div
                                                    key={dep}
                                                    onClick={() => {
                                                        setForm({ ...form, department: dep });
                                                        setOpenDropdown(null);
                                                    }}
                                                >
                                                    {dep}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* STATUS */}
                            <div className="form-group">
                                <label>Status</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button
                                        type="button"
                                        className="dishes-status-dropdown"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdown(prev => prev === "status" ? null : "status");
                                        }}
                                    >
                                        {form.status || "Select Status"}
                                    </button>

                                    {openDropdown === "status" && (
                                        <div className="dishes-dropdown-menu">
                                            {["Scheduled", "Completed", "Pending"].map(st => (
                                                <div
                                                    key={st}
                                                    onClick={() => {
                                                        setForm({ ...form, status: st });
                                                        setOpenDropdown(null);
                                                    }}
                                                >
                                                    {st}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* LAST RATE */}
                            <div className="form-group">
                                <label>Last Rate</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button
                                        type="button"
                                        className="dishes-status-dropdown"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDropdown(prev => prev === "rate" ? null : "rate");
                                        }}
                                    >
                                        {form.lastRate !== ""
                                            ? `${form.lastRate} Days`
                                            : "Select Days"}
                                    </button>

                                    {openDropdown === "rate" && (
                                        <div className="dishes-dropdown-menu">
                                            {[0, 1, 2, 3].map(day => (
                                                <div
                                                    key={day}
                                                    onClick={() => {
                                                        setForm({ ...form, lastRate: String(day) });
                                                        setOpenDropdown(null);
                                                    }}
                                                >
                                                    {day} Days
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* FOOTER */}
                        <div className="category-modal-footer">
                            <div className="form-actions">
                                <button type="submit">Save Schedule</button>
                                <button type="button" onClick={cancelSchedule}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}