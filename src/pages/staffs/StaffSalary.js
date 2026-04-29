import React, { useState, useEffect } from "react";
import "./StaffModules.css";
import api from "../../api";

export default function StaffSalary({ adminData }) {
    const [selected, setSelected] = useState(null);
    const [staffList, setStaffList] = useState(adminData.staff);
    const [form, setForm] = useState({
        advance: 0,
        deduction: 0,
        penalty: 0,
        bonus: 0,
        overtime: 0
    });

    useEffect(() => {
        setStaffList(adminData.staff);
    }, [adminData]);

    const openModal = (staff) => {
        setSelected(staff);

        const history = staff.remainingSalary || [];

        const totalAdvance = history.reduce((sum, i) => sum + Number(i.advance || 0), 0);
        const totalDeduction = history.reduce((sum, i) => sum + Number(i.deduction || 0), 0);
        const totalPenalty = history.reduce((sum, i) => sum + Number(i.penalty || 0), 0);
        const totalBonus = history.reduce((sum, i) => sum + Number(i.bonus || 0), 0);
        const totalOvertime = history.reduce((sum, i) => sum + Number(i.overtime || 0), 0);

        setForm({
            advance: totalAdvance,
            deduction: totalDeduction,
            penalty: totalPenalty,
            bonus: totalBonus,
            overtime: totalOvertime
        });
    };

    const closeModal = () => setSelected(null);

    const handleSave = async () => {

        const history = selected.remainingSalary || [];

        // 👉 add new entry FIRST
        const newHistory = [
            ...history,
            {
                ...form
            }
        ];

        // 👉 calculate totals from FULL history
        const totalAdvance = newHistory.reduce((sum, i) => sum + Number(i.advance || 0), 0);
        const totalDeduction = newHistory.reduce((sum, i) => sum + Number(i.deduction || 0), 0);
        const totalPenalty = newHistory.reduce((sum, i) => sum + Number(i.penalty || 0), 0);
        const totalBonus = newHistory.reduce((sum, i) => sum + Number(i.bonus || 0), 0);
        const totalOvertime = newHistory.reduce((sum, i) => sum + Number(i.overtime || 0), 0);

        const remaining =
            Number(selected.salary) +
            totalBonus +
            totalOvertime -
            totalAdvance -
            totalDeduction -
            totalPenalty;

        const updated = {
            ...selected,
            salaryRemaining: remaining,
            remainingSalary: newHistory.map(item => ({
                ...item,
                remaining // optional snapshot
            }))
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
                            <th>Bonus</th>
                            <th>Overtime</th>
                            <th>Remaining</th>
                            <th>Edit</th>
                        </tr>
                    </thead>

                    <tbody>
                        {staffList.map((s, i) => {
                            const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3", "#fb8500", "#023e8a"];
                            const avatarBg = PALETTE[i % PALETTE.length];

                            const totalAdvance = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.advance || 0), 0);
                            const totalDeduction = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.deduction || 0), 0);
                            const totalPenalty = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.penalty || 0), 0);
                            const totalBonus = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.bonus || 0), 0);
                            const totalOvertime = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.overtime || 0), 0);
                            const computedRemaining = Number(s.salary) + totalBonus + totalOvertime - totalAdvance - totalDeduction - totalPenalty;
                            const base = Number(s.salary) || 1;
                            const remainPct = Math.max(0, Math.min(100, Math.round((computedRemaining / base) * 100)));

                            return (
                                <tr key={s.id}>
                                    <td>
                                        <div className="st-name-cell">
                                            <div className="st-avatar" style={{ background: avatarBg }}>
                                                {(s.name || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="st-name">{s.name}</div>
                                                <div className="st-join">{s.role || "—"}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className="st-salary">₹{Number(s.salary || 0).toLocaleString("en-IN")}</span></td>
                                    <td><span className={totalAdvance > 0 ? "st-neg-val" : "st-zero-val"}>₹{totalAdvance.toLocaleString("en-IN")}</span></td>
                                    <td><span className={totalDeduction > 0 ? "st-neg-val" : "st-zero-val"}>₹{totalDeduction.toLocaleString("en-IN")}</span></td>
                                    <td><span className={totalPenalty > 0 ? "st-neg-val" : "st-zero-val"}>₹{totalPenalty.toLocaleString("en-IN")}</span></td>
                                    <td><span className={totalBonus > 0 ? "st-pos-val" : "st-zero-val"}>₹{totalBonus.toLocaleString("en-IN")}</span></td>
                                    <td><span className={totalOvertime > 0 ? "st-pos-val" : "st-zero-val"}>₹{totalOvertime.toLocaleString("en-IN")}</span></td>
                                    <td>
                                        <div className="st-remain-cell">
                                            <span className="st-remain-val" style={{ color: remainPct >= 80 ? "#1dd1a1" : remainPct >= 50 ? "#ff9f43" : "#ee5253" }}>
                                                ₹{computedRemaining.toLocaleString("en-IN")}
                                            </span>
                                            <div className="st-mini-bar-track">
                                                <div className="st-mini-bar-fill" style={{ width: `${remainPct}%`, background: remainPct >= 80 ? "#1dd1a1" : remainPct >= 50 ? "#ff9f43" : "#ee5253" }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <button className="st-edit-btn" onClick={() => openModal(s)}>Edit</button>
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

                            <div className="form-group">
                                <label>Bonus</label>
                                <input
                                    type="number"
                                    value={form.bonus}
                                    onChange={e => setForm({ ...form, bonus: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Overtime</label>
                                <input
                                    type="number"
                                    value={form.overtime}
                                    onChange={e => setForm({ ...form, overtime: e.target.value })}
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