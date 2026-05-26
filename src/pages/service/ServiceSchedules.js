import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import "./ServiceSchedules.css";
import api from "../../api";
import { useToast } from "../../useToast";
import { CustomDatePicker } from "../../components/CustomDatePicker";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fmt = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const PRESETS = [

    { label: "All", fn: () => ["2000-01-01", "2099-12-31"] },
    {
        label: "Today",
        fn: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; }
    },
    {
        label: "This Week",
        fn: () => {
            const now = new Date();
            // Sunday = 0, Saturday = 6
            const sunday = new Date(now);
            sunday.setDate(now.getDate() - now.getDay());
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);
            return [fmt(sunday), fmt(saturday)];
        }
    },
    {
        label: "This Month",
        fn: () => {
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return [fmt(first), fmt(last)];
        }
    },
];

const EMPTY_FORM = { work: "", staff: "", date: "", department: "", status: "", lastRate: "" };

const SORT_KEYS = ["date", "work", "staff", "department", "status"];

export default function ServiceSchedules({ adminData, setAdminData }) {
    const location = useLocation();
    const { toast } = useToast();
    const [openDropdown, setOpenDropdown] = useState(null);
    const [statusFilter, setStatusFilter] = useState(location.state?.status || "");
    const [searchText, setSearchText] = useState("");
    const today = format(new Date(), "yyyy-MM-dd");

    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [activePreset, setActivePreset] = useState("Today");
    const [show, setShow] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [sortKey, setSortKey] = useState("date");
    const [sortDir, setSortDir] = useState("asc");

    const list = adminData.serviceSchedules || [];

    const filteredList = useMemo(() => {
        const base = list.filter(item => {
            const matchStatus = !statusFilter || (item.status || "").toLowerCase() === statusFilter.toLowerCase();
            const q = searchText.toLowerCase();
            const matchSearch = !q || (item.work || "").toLowerCase().includes(q) || (item.staff || "").toLowerCase().includes(q);
            const d = item.date || "";
            const matchDate = d >= fromDate && d <= toDate;
            return matchStatus && matchSearch && matchDate;
        });

        return [...base].sort((a, b) => {
            const aVal = (a[sortKey] || "").toString().toLowerCase();
            const bVal = (b[sortKey] || "").toString().toLowerCase();
            return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }, [list, statusFilter, searchText, fromDate, toDate, sortKey, sortDir]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const SortIcon = ({ col }) => {
        if (sortKey !== col) return <span style={{ color: "#bbb", fontSize: 11 }}>⇅</span>;
        return <span style={{ fontSize: 11 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
    };

    const applyPreset = (p) => { const [f, t] = p.fn(); setFromDate(f); setToDate(t); setActivePreset(p.label); };

    const add = async () => {
        if (!form.work || !form.staff || !form.date) return;
        // Use string-based IDs to avoid lodash-id issues with json-server
        const newId = `ss_${Date.now()}`;
        const newItem = { id: newId, ...form };
        try {
            await api.post("/serviceSchedules", newItem);
            setAdminData(prev => ({ ...prev, serviceSchedules: [...(prev.serviceSchedules || []), newItem] }));
            setForm(EMPTY_FORM);
            setShow(false);
            toast.success("Schedule added successfully.");
        } catch (err) {
            console.error("Failed to add schedule", err);
            toast.error("Failed to add schedule. Please try again.");
        }
    };

    const cancel = () => { setForm(EMPTY_FORM); setShow(false); };

    // FIX: Only delete expired items, not all. Use string IDs for new items.
    // For old numeric-id items that fail deletion, skip gracefully.
    const moveExpiredSchedules = async () => {
        const expired = list.filter(item => item.date < today);
        const upcoming = list.filter(item => item.date >= today);
        if (!expired.length) return;

        const activity = adminData?.serviceActivity || [];
        const deletedIds = [];

        for (const item of expired) {
            try {
                await api.delete(`/serviceSchedules/${item.id}`);
                deletedIds.push(item.id);
            } catch (err) {
                console.warn(`Could not delete schedule ${item.id}:`, err.response?.status);
                // Still move it to activity even if delete failed
                deletedIds.push(item.id);
            }
        }

        for (const item of expired) {
            try {
                await api.post("/serviceActivity", item);
            } catch (err) {
                console.warn("Could not archive schedule:", err);
            }
        }

        // Remove expired from local state regardless of API delete outcome
        setAdminData(prev => ({
            ...prev,
            serviceSchedules: (prev.serviceSchedules || []).filter(i => !deletedIds.includes(i.id)),
            serviceActivity: [...activity, ...expired]
        }));
    };

    useEffect(() => { moveExpiredSchedules(); }, []);
    useEffect(() => { const close = () => setOpenDropdown(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, []);

    const markCompleted = async (item) => {
        if (item.status === "Completed") return;
        const updated = { ...item, status: "Completed", completedAt: new Date().toISOString() };
        // Update schedule status in-place (keep in schedules for today)
        try {
            await api.put(`/serviceSchedules/${item.id}`, updated);
        } catch (err) {
            console.warn("Could not update schedule status:", err);
        }
        // Also copy to activity log
        try {
            await api.post("/serviceActivity", updated);
        } catch (err) {
            console.warn("Could not write to activity:", err);
        }
        setAdminData(prev => ({
            ...prev,
            serviceSchedules: (prev.serviceSchedules || []).map(s => s.id === item.id ? updated : s),
            serviceActivity: [...(prev.serviceActivity || []), updated],
        }));
        toast.success(`"${item.work}" marked as completed.`);
    };

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
        XLSX.utils.book_append_sheet(wb, sheet, "Service Schedules");
        XLSX.writeFile(wb, `service_schedules_${fromDate}_to_${toDate}.xlsx`);
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h2>Service Schedules</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button className="export-btn" onClick={exportToExcel}>Export</button>
                    <button onClick={() => setShow(true)}>+ Add Schedule</button>
                </div>
            </div>

            <div className="ssched-filter-bar">
                <input className="search-input" placeholder="Search work / staff…" value={searchText} onChange={e => setSearchText(e.target.value)} />
                
                <CustomDatePicker label="From" value={fromDate} max={toDate}
                    onChange={s => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate}
                    onChange={s => { setToDate(s); setActivePreset("custom"); }} />
                {PRESETS.map(p => (
                    <button key={p.label} className={`ssch-pill-btn${activePreset === p.label ? " active" : ""}`} onClick={() => applyPreset(p)}>
                        {p.label}
                    </button>
                ))}

                <div className="sched-status-pills">
                    {["", "Scheduled", "Completed", "Pending"].map(s => (
                        <button key={s} className={`ssch-pill-btn${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
                            {s || "All"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="schedule-table-wrapper">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th onClick={() => toggleSort("work")} style={{ cursor: "pointer" }}>Work <SortIcon col="work" /></th>
                            <th onClick={() => toggleSort("staff")} style={{ cursor: "pointer" }}>Staff <SortIcon col="staff" /></th>
                            <th onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date <SortIcon col="date" /></th>
                            <th onClick={() => toggleSort("department")} style={{ cursor: "pointer" }}>Department <SortIcon col="department" /></th>
                            <th onClick={() => toggleSort("status")} style={{ cursor: "pointer" }}>Status <SortIcon col="status" /></th>
                            <th>Response</th>
                            <th style={{ width: 60, textAlign: "center" }}>Done</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: "center", color: "#aaa" }}>No schedules found</td></tr>
                        ) : (
                            filteredList.map(i => (
                                <tr key={i.id}>
                                    <td>{i.work}</td>
                                    <td>{i.staff}</td>
                                    <td>{i.date}</td>
                                    <td>{i.department || "—"}</td>
                                    <td>{i.status ? <span className={`status status-${i.status.toLowerCase().replace(/\s+/g, "-")}`}>{i.status}</span> : "—"}</td>
                                    <td>{i.lastRate ? `${i.lastRate} days` : "—"}</td>
                                    <td style={{ textAlign: "center" }}>
                                        {i.status === "Completed"
                                            ? <span style={{ color: "#2e7d32", fontSize: 18 }}>✔</span>
                                            : <button
                                                onClick={() => markCompleted(i)}
                                                title="Mark as Completed"
                                                style={{ background: "none", border: "1.5px solid #2e7d32", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#2e7d32", fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                            >✓</button>
                                        }
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {show && (
                <div className="modal-overlay">
                    <form className="modal" onSubmit={e => { e.preventDefault(); add(); }}>
                        <div className="modal-header">
                            <h3>Add Schedule</h3>
                            <button type="button" className="close-btn" onClick={cancel}></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Department</label>
                                <div className="dishes-dropdown-wrapper">
                                    <button type="button" className="dishes-status-dropdown" onClick={e => { e.stopPropagation(); setOpenDropdown(p => p === "dept" ? null : "dept"); }}>
                                        {form.department || "Select Department"}
                                    </button>
                                    {openDropdown === "dept" && (
                                        <div className="dropdown-menu">
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
                                        <div className="dropdown-menu">
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
                                        <div className="dropdown-menu">
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
                                        <div className="dropdown-menu">
                                            {[0, 1, 2, 3].map(day => (
                                                <div key={day} onClick={e => { e.stopPropagation(); setForm({ ...form, lastRate: String(day) }); setOpenDropdown(null); }}>{day} Days</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" onClick={cancel}>Cancel</button>
                            <button type="submit">Save Schedule</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}