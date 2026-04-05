import React, { useEffect, useState } from "react";
import "./StaffAttendance.css";
import api from "../../api";
import editIcon from "../../icon/edit-icon.png";

const normalizeDate = (d) => {
    const date = new Date(d);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

export default function StaffAttendance({ adminData }) {
    const getDates = () => {
        const today = new Date();

        const start = new Date(
            today.getFullYear(),
            today.getMonth(),
            1   // ✅ FIRST DAY OF MONTH
        );

        const dates = [];

        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
            dates.push(normalizeDate(d));
        }

        return dates;
    };

    const dates = getDates();

    const [attendance, setAttendance] = useState({});
    const [editMode, setEditMode] = useState({});
    const [holidays, setHolidays] = useState({});
    const [loadingHolidays, setLoadingHolidays] = useState(true);

    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [columnEdit, setColumnEdit] = useState({});

    const [holidayForm, setHolidayForm] = useState({
        date: "",
        reason: ""
    });

    // ===============================
    // ✅ LOAD HOLIDAYS (FIXED)
    // ===============================
    const fetchHolidays = async () => {
        try {
            const res = await api.get("/holidays");

            const map = {};
            res.data.forEach(h => {
                if (h.date) {
                    map[normalizeDate(h.date)] = h.reason;
                }
            });

            setHolidays(map);
        } catch (err) {
            console.error("Holiday load failed", err);
        } finally {
            setLoadingHolidays(false);
        }
    };

    useEffect(() => {
        fetchHolidays();
    }, []);

    // ===============================
    // ✅ TOGGLE CHECKBOX
    // ===============================
    const handleToggle = (staffId, date, checked) => {

        if (checked) {
            saveAttendance(staffId, date, { status: "present", reason: "" });
        } else {
            setEditMode(prev => ({
                ...prev,
                [staffId]: { ...prev[staffId], [date]: true }
            }));
        }
    };

    // ===============================
    // ✅ SAVE ATTENDANCE
    // ===============================
    const saveAttendance = async (staffId, date, data) => {

        const staff = adminData.staff.find(s => s.id === staffId);

        const existing = (staff.attendance || []).filter(a => a.date !== date);

        const updated = {
            ...staff,
            attendance: [...existing, { date, ...data }]
        };

        const res = await api.put(`/staff/${staffId}`, updated);

        const updatedStaff = res.data;

        const index = adminData.staff.findIndex(s => s.id === staffId);
        adminData.staff[index] = updatedStaff;

        setAttendance(prev => ({
            ...prev,
            [staffId]: {
                ...prev[staffId],
                [date]: data
            }
        }));

        setEditMode(prev => ({
            ...prev,
            [staffId]: { ...prev[staffId], [date]: false }
        }));
    };

    // ===============================
    // ✅ ADD HOLIDAY (FIXED)
    // ===============================
    const addHoliday = async () => {

        await api.post("/holidays", {
            id: Date.now(),
            ...holidayForm
        });

        // 🔥 instant UI update
        setHolidays(prev => ({
            ...prev,
            [holidayForm.date]: holidayForm.reason
        }));

        setShowHolidayModal(false);
        setHolidayForm({ date: "", reason: "" });
    };

    // ===============================
    // ✅ REMOVE HOLIDAY (FIXED)
    // ===============================
    const removeHoliday = async (date) => {
        try {
            const normalized = normalizeDate(date);

            const res = await api.get("/holidays");

            const holiday = res.data.find(
                h => normalizeDate(h.date) === normalized
            );

            if (holiday) {
                await api.delete(`/holidays/${holiday.id}`);
            }

            // 🔥 remove from UI
            setHolidays(prev => {
                const updated = { ...prev };
                delete updated[normalized];
                return updated;
            });

            // 🔥 FORCE COLUMN TO NORMAL MODE IMMEDIATELY
            setColumnEdit(prev => ({
                ...prev,
                [normalized]: true
            }));

            // 🔥 force re-render
            setAttendance(prev => ({ ...prev }));

        } catch (err) {
            console.error("Remove holiday failed:", err);
        }
    };

    // ===============================
    // ⛔ PREVENT WRONG FIRST RENDER
    // ===============================
    if (loadingHolidays) {
        return <div className="attendance-page">Loading...</div>;
    }

    return (
        <div className="attendance-page">

            <div className="attendance-header">
                <h2>Attendance Sheet</h2>

                <button
                    className="staff-add-btn"
                    onClick={() => setShowHolidayModal(true)}
                >
                    Add Holiday
                </button>
            </div>

            <div className="attendance-table-wrapper">
                <div className="attendance-table-scroll">
                    <table className="attendance-table">

                        <thead>
                            <tr>
                                <th className="sticky-col">
                                    {new Date().toLocaleString("default", { month: "long" })}
                                </th>

                                {dates.map(date => (
                                    <th key={date}>

                                        {new Date(date).getDate()}

                                        {holidays[date] && (
                                            <div>
                                                <div className="tag holiday">
                                                    {holidays[date]}
                                                </div>

                                                {/* ✅ NEW CHECKBOX */}
                                                <input
                                                    type="checkbox"
                                                    onChange={() => removeHoliday(date)}
                                                />
                                            </div>
                                        )}

                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>

                            {adminData.staff.map(staff => (
                                <tr key={staff.id}>

                                    <td className="sticky-col">{staff.name}</td>

                                    {dates.map(date => {
                                        const isColumnEditing = columnEdit[date];

                                        const saved =
                                            attendance[staff.id]?.[date] ||
                                            staff.attendance?.find(a => a.date === date);

                                        if (isColumnEditing) {
                                            return (
                                                <td key={date}>
                                                    <input
                                                        type="checkbox"
                                                        checked={saved?.status === "present"}
                                                        onChange={(e) =>
                                                            handleToggle(staff.id, date, e.target.checked)
                                                        }
                                                    />
                                                </td>
                                            );
                                        }

                                        if (holidays[date] && !isColumnEditing) {
                                            return (
                                                <td key={date} className="holiday-cell">
                                                    {holidays[date]}
                                                </td>
                                            );
                                        }

                                        const editing = editMode[staff.id]?.[date];

                                        if (editing) {
                                            return (
                                                <td key={date}>
                                                    <input
                                                        type="checkbox"
                                                        onChange={(e) =>
                                                            handleToggle(staff.id, date, e.target.checked)
                                                        }
                                                    />

                                                    <input
                                                        className="leave-input"
                                                        placeholder="Reason"
                                                        onChange={(e) =>
                                                            setAttendance(prev => ({
                                                                ...prev,
                                                                [staff.id]: {
                                                                    ...prev[staff.id],
                                                                    [date]: {
                                                                        status: "leave",
                                                                        reason: e.target.value
                                                                    }
                                                                }
                                                            }))
                                                        }
                                                    />

                                                    <button
                                                        className="mini-btn"
                                                        onClick={() => {
                                                            const data = attendance[staff.id]?.[date];

                                                            if (!data?.reason) {
                                                                alert("Enter reason");
                                                                return;
                                                            }

                                                            saveAttendance(staff.id, date, data);
                                                        }}
                                                    >
                                                        Save
                                                    </button>
                                                </td>
                                            );
                                        }

                                        if (saved?.status === "leave") {
                                            return (
                                                <td key={date}>
                                                    <div className="leave-display">
                                                        {saved.reason}
                                                        <span
                                                            className="edit-icon"
                                                            onClick={() =>
                                                                setEditMode(prev => ({
                                                                    ...prev,
                                                                    [staff.id]: {
                                                                        ...prev[staff.id],
                                                                        [date]: true
                                                                    }
                                                                }))
                                                            }
                                                        >
                                                            <img src={editIcon} alt="" />
                                                        </span>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={date}>
                                                <input
                                                    type="checkbox"
                                                    checked
                                                    onChange={(e) =>
                                                        handleToggle(staff.id, date, e.target.checked)
                                                    }
                                                />
                                            </td>
                                        );
                                    })}

                                </tr>
                            ))}

                        </tbody>

                    </table>
                </div>
            </div>

            {/* MODAL */}
            {showHolidayModal && (
                <div className="modal-overlay">
                    <div className="modal">

                        <div className="modal-header">
                            <h3>Add Holiday</h3>
                            <div className="dish-close-btn" onClick={() => setShowHolidayModal(false)}></div>
                        </div>

                        <div className="form-group">
                            <input
                                type="date"
                                value={holidayForm.date}
                                onChange={(e) =>
                                    setHolidayForm({ ...holidayForm, date: e.target.value })
                                }
                            />
                        </div>

                        <div className="form-group">
                            <input
                                placeholder="Reason"
                                value={holidayForm.reason}
                                onChange={(e) =>
                                    setHolidayForm({ ...holidayForm, reason: e.target.value })
                                }
                            />
                        </div>

                        <div className="form-actions">
                            <button onClick={addHoliday}>Save</button>
                            <button onClick={() => setShowHolidayModal(false)}>Cancel</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}