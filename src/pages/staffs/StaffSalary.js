import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./StaffModules.css";
import api from "../../api";

export default function StaffSalary({ adminData }) {
    const [selected, setSelected] = useState(null);
    const [staffList, setStaffList] = useState(adminData.staff);
    const [salarySearch, setSalarySearch] = useState("");
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

    const filteredList = salarySearch.trim()
        ? staffList.filter(s =>
            (s.name || "").toLowerCase().includes(salarySearch.toLowerCase()) ||
            (s.role || "").toLowerCase().includes(salarySearch.toLowerCase())
        )
        : staffList;

    return (
        <div className="staff-page">
            <div className="staff-header">
                <h2>Salary Management</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="orders-export-btn" onClick={() => {
                        const rows = filteredList.map((s, i) => {
                            const totalAdvance = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.advance || 0), 0);
                            const totalDeduction = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.deduction || 0), 0);
                            const totalPenalty = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.penalty || 0), 0);
                            const totalBonus = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.bonus || 0), 0);
                            const totalOvertime = (s.remainingSalary || []).reduce((sum, item) => sum + Number(item.overtime || 0), 0);
                            const remaining = Number(s.salary) + totalBonus + totalOvertime - totalAdvance - totalDeduction - totalPenalty;
                            return {
                                Name: s.name || "—",
                                Role: s.role || "—",
                                "Base Salary (₹)": Number(s.salary || 0),
                                "Advance (₹)": totalAdvance,
                                "Deduction (₹)": totalDeduction,
                                "Penalty (₹)": totalPenalty,
                                "Bonus (₹)": totalBonus,
                                "Overtime (₹)": totalOvertime,
                                "Remaining (₹)": remaining,
                            };
                        });
                        if (!rows.length) { alert("No salary data to export"); return; }
                        const sheet = XLSX.utils.json_to_sheet(rows);
                        sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, sheet, "Salary");
                        XLSX.writeFile(wb, `salary_${new Date().toISOString().slice(0, 10)}.xlsx`);
                    }}>Export</button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="staff-filter-bar">
                <input
                    className="staff-search-input"
                    placeholder="🔍 Search name or role…"
                    value={salarySearch}
                    onChange={e => setSalarySearch(e.target.value)}
                />
                {salarySearch && (
                    <button className="ae-clear-filter" onClick={() => setSalarySearch("")}>Clear</button>
                )}
                <span className="ae-result-count">{filteredList.length} staff</span>
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
                        {filteredList.map((s, i) => {
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