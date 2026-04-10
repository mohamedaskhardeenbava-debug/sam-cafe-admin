import React, { useState, useEffect } from "react";
import "./StaffModules.css";
import api from "../../api";

export default function StaffSalary({ adminData }) {
    const [selected, setSelected] = useState(null);
    const [staffList, setStaffList] = useState(adminData.staff);
    const [form, setForm] = useState({
        advance: 0,
        deduction: 0,
        penalty: 0
    });

    useEffect(() => {
        setStaffList(adminData.staff);
    }, [adminData]);

    const openModal = (staff) => {
        setSelected(staff);

        const last = (staff.remainingSalary || []).slice(-1)[0] || {};

        setForm({
            advance: last.advance || 0,
            deduction: last.deduction || 0,
            penalty: last.penalty || 0
        });
    };

    const closeModal = () => setSelected(null);

    const handleSave = async () => {
        const previousRemaining =
            Number(selected.salaryRemaining || selected.salary);

        const totalDeduction =
            Number(form.advance) +
            Number(form.deduction) +
            Number(form.penalty);

        const remaining = Math.max(0, previousRemaining - totalDeduction);

        const updated = {
            ...selected,
            salaryRemaining: remaining,
            remainingSalary: [
                ...(selected.remainingSalary || []),
                {
                    ...form,
                    remaining
                }
            ]
        };

        try {
            const res = await api.put(`/staff/${selected.id}`, updated);

            setStaffList(prev =>
                prev.map(s =>
                    s.id === selected.id ? res.data : s
                )
            );

        } catch (err) {
            console.error("Salary update failed:", err);
        }

        closeModal();
    };

    return (
        <div className="staff-page">
            <div className="staff-header">
                <h2>Salary Management</h2>
            </div>

            <div className="staff-salary-table-wrapper">
                <table className="staff-salary-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Base Salary</th>
                            <th>Advance</th>
                            <th>Deduction</th>
                            <th>Penalty</th>
                            <th>Remaining</th>
                            <th>Edit</th>
                        </tr>
                    </thead>

                    <tbody>
                        {staffList.map(s => {

                            // ✅ CALCULATE TOTALS
                            const totalAdvance = (s.remainingSalary || []).reduce(
                                (sum, item) => sum + Number(item.advance || 0),
                                0
                            );

                            const totalDeduction = (s.remainingSalary || []).reduce(
                                (sum, item) => sum + Number(item.deduction || 0),
                                0
                            );

                            const totalPenalty = (s.remainingSalary || []).reduce(
                                (sum, item) => sum + Number(item.penalty || 0),
                                0
                            );

                            return (
                                <tr key={s.id}>
                                    <td>{s.name}</td>
                                    <td>₹{s.salary}</td>

                                    <td>₹{totalAdvance}</td>
                                    <td>₹{totalDeduction}</td>
                                    <td>₹{totalPenalty}</td>

                                    <td>₹{s.salaryRemaining || s.salary}</td>

                                    <td>
                                        <button onClick={() => openModal(s)}>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {selected && (
                <div className="modal-overlay">
                    <div className="modal">

                        <div className="modal-header">
                            <h3>{selected.name}</h3>
                            <button onClick={closeModal} className="dish-close-btn"></button>
                        </div>

                        <div className="modal-body">

                            <div className="form-group">
                                <label>Advance</label>
                                <input
                                    type="number"
                                    value={form.advance}
                                    onChange={e => setForm({ ...form, advance: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Deduction</label>
                                <input
                                    type="number"
                                    value={form.deduction}
                                    onChange={e => setForm({ ...form, deduction: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Penalty</label>
                                <input
                                    type="number"
                                    value={form.penalty}
                                    onChange={e => setForm({ ...form, penalty: e.target.value })}
                                />
                            </div>

                        </div>

                        <div className="modal-footer form-actions">
                            <button onClick={handleSave}>Save</button>
                            <button onClick={closeModal}>Cancel</button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}