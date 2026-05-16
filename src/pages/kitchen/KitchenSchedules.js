import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import "./KitchenSchedules.css";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PRESETS = [
    { label: "All", fn: () => ["2000-01-01", "2099-12-31"] },
    { label: "Today", fn: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; } },
    { label: "This Month", fn: () => { const d = new Date(); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(d, "yyyy-MM-dd")]; } },
];

const EMPTY_FORM = { work: "", staff: "", date: "", department: "", status: "", lastRate: "" };

export default function KitchenSchedules({ adminData, setAdminData }) {
    const location = useLocation();
    const [openDropdown, setOpenDropdown] = useState(null);
    const [statusFilter, setStatusFilter] = useState(location.state?.status || "");
    const [searchText, setSearchText] = useState("");
    const today = format(new Date(), "yyyy-MM-dd");
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [activePreset, setActivePreset] = useState("Today");
    const [show, setShow] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const list = adminData.kitchenSchedules || [];

    const filteredList = useMemo(() => list.filter(item => {
        const matchStatus = !statusFilter || (item.status || "").toLowerCase() === statusFilter.toLowerCase();
        const q = searchText.toLowerCase();
        const matchSearch = !q || (item.work || "").toLowerCase().includes(q) || (item.staff || "").toLowerCase().includes(q);
        const d = item.date || "";
        const matchDate = d >= fromDate && d <= toDate;
        return matchStatus && matchSearch && matchDate;
    }), [list, statusFilter, searchText, fromDate, toDate]);

    const applyPreset = (p) => { const [f, t] = p.fn(); setFromDate(f); setToDate(t); setActivePreset(p.label); };

    const add = async () => {
        if (!form.work || !form.staff || !form.date) return;
        const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
        const newItem = { id: newId, ...form };
        try {
            await api.post("/kitchenSchedules", newItem);
            setAdminData(prev => ({ ...prev, kitchenSchedules: [...(prev.kitchenSchedules || []), newItem] }));
            setForm(EMPTY_FORM);
            setShow(false);
        } catch (err) { console.error("Failed to add schedule", err); }
    };

    const cancel = () => { setForm(EMPTY_FORM); setShow(false); };

    const moveExpiredSchedules = async () => {
        const expired = list.filter(item => item.date < today);
        const upcoming = list.filter(item => item.date >= today);
        if (!expired.length) return;
        const activity = adminData?.kitchenActivity || [];
        for (const item of list) await api.delete(`/kitchenSchedules/${item.id}`);
        for (const item of upcoming) await api.post("/kitchenSchedules", item);
        for (const item of expired) await api.post("/kitchenActivity", item);
        setAdminData(prev => ({ ...prev, kitchenSchedules: upcoming, kitchenActivity: [...activity, ...expired] }));
    };

    useEffect(() => { moveExpiredSchedules(); }, []);
    useEffect(() => { const close = () => setOpenDropdown(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, []);

    const exportToExcel = () => {
        if (!filteredList.length) { alert("No schedule data to export"); return; }
        const rows = filteredList.map(item => ({
            Work: item.work || "—",
            Staff: item.staff || "—",
            Date: item.date || "—",
            Department: item.department || "—",
            Status: item.status || "—",
            "Response (Days)": item.lastRate !== "" && item.lastRate != null ? `${item.lastRate} days` : "—",
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? "").length)) + 2
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Kitchen Schedules");
        XLSX.writeFile(wb, `kitchen_schedules_${fromDate}_to_${toDate}.xlsx`);
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h2>Kitchen Schedules</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button className="orders-export-btn" onClick={exportToExcel}>Export</button>
                    <button onClick={() => setShow(true)}>+ Add Schedule</button>
                </div>
            </div>

            <div className="ssched-filter-bar">
                <input className="cdp-search-input" placeholder="🔍 Search work / staff…" value={searchText} onChange={e => setSearchText(e.target.value)} />
                <div className="sched-status-pills">
                    {["", "Scheduled", "Completed", "Pending"].map(s => (
                        <button key={s} className={`ssch-pill-btn${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
                            {s || "All"}
                        </button>
                    ))}
                </div>
                <CustomDatePicker label="From" value={fromDate} max={toDate}
                    onChange={s => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate}
                    onChange={s => { setToDate(s); setActivePreset("custom"); }} />
                {PRESETS.map(p => (
                    <button key={p.label} className={`sact-pill-btn${activePreset === p.label ? " active" : ""}`} onClick={() => applyPreset(p)}>
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="schedule-table-wrapper">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th>Work</th><th>Staff</th><th>Date</th>
                            <th>Department</th><th>Status</th><th>Response</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: "center", color: "#aaa" }}>No schedules found</td></tr>
                        ) : (
                            filteredList.map(i => (
                                <tr key={i.id}>
                                    <td>{i.work}</td>
                                    <td>{i.staff}</td>
                                    <td>{i.date}</td>
                                    <td>{i.department || "—"}</td>
                                    <td>{i.status ? <span className={`status status-${i.status.toLowerCase().replace(/\s+/g, "-")}`}>{i.status}</span> : "—"}</td>
                                    <td>{i.lastRate ? `${i.lastRate} days` : "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {show && (
                <div className="category-modal-overlay">
                    <form className="category-modal" onSubmit={e => { e.preventDefault(); add(); }}>
                        <div className="category-modal-header">
                            <h3>Add Schedule</h3>
                            <button type="button" className="dish-close-btn" onClick={cancel}></button>
                        </div>
                        <div className="category-modal-body">
                            <div className="form-group">
                                <label>Department</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "dept" ? null : "dept"); }}>
                                        {form.department || "Select Department"}
                                    </button>
                                    {openDropdown === "dept" && (
                                        <div className="dishes-dropdown-menu">
                                            {["Pest Control", "Maintenance", "Laundry"].map(dep => (
                                                <div key={dep} onClick={e => { e.stopPropagation(); setForm({ ...form, department: dep }); setOpenDropdown(null); }}>{dep}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Work</label>
                                <input required value={form.work} onChange={e => setForm({ ...form, work: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Staff</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "staff" ? null : "staff"); }}>
                                        {form.staff || "Select Staff"}
                                    </button>
                                    {openDropdown === "staff" && (
                                        <div className="dishes-dropdown-menu">
                                            {adminData.staff?.map(s => (
                                                <div key={s.id} onClick={e => { e.stopPropagation(); setForm({ ...form, staff: s.name }); setOpenDropdown(null); }}>{s.name}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Date</label>
                                <CustomDatePicker
                                    value={form.date}
                                    onChange={(v) => setForm({ ...form, date: v })}
                                    placeholder="Select date"
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "status" ? null : "status"); }}>
                                        {form.status || "Select Status"}
                                    </button>
                                    {openDropdown === "status" && (
                                        <div className="dishes-dropdown-menu">
                                            {["Scheduled", "Completed", "Pending"].map(st => (
                                                <div key={st} onClick={e => { e.stopPropagation(); setForm({ ...form, status: st }); setOpenDropdown(null); }}>{st}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Response (Days)</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "rate" ? null : "rate"); }}>
                                        {form.lastRate !== "" ? `${form.lastRate} Days` : "Select Days"}
                                    </button>
                                    {openDropdown === "rate" && (
                                        <div className="dishes-dropdown-menu">
                                            {[0, 1, 2, 3].map(day => (
                                                <div key={day} onClick={e => { e.stopPropagation(); setForm({ ...form, lastRate: String(day) }); setOpenDropdown(null); }}>{day} Days</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="category-modal-footer">
                            <div className="form-actions">
                                <button type="submit">Save Schedule</button>
                                <button type="button" onClick={cancel}>Cancel</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}