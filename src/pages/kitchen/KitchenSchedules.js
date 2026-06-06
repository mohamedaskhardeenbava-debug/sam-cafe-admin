import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import "./KitchenSchedules.css";
import api from "../../api";
import closeIcon from "../../icon/close-icon.png";
import { CustomDatePicker } from "../../components/CustomDatePicker";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PRESETS = [
    { label: "All", fn: () => ["2000-01-01", "2099-12-31"] },
    { label: "Today", fn: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; } },
    { label: "This Month", fn: () => { const d = new Date(); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(d, "yyyy-MM-dd")]; } },
];

const EMPTY_FORM = { work: "", staff: "", date: "", department: "", status: "", lastRate: "" };

// ── CustomDropdown (floating label version) ──────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…", label, required }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
    const displayLabel = selected ? (selected.label !== undefined ? selected.label : selected) : "";
    const wrapperClass = ["mat-select", value ? "has-value" : "", open ? "is-open" : ""].filter(Boolean).join(" ");
    return (
        <div className={wrapperClass} ref={ref}>
            {label && <label className="mat-label">{label}{required && <span className="rf-req">*</span>}</label>}
            <div className="dishes-dropdown-wrapper">
                <button type="button" className="dishes-status-dropdown"
                    onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
                    {displayLabel || ""}
                </button>
                {open && (
                    <div className="dropdown-menu">
                        <div onClick={() => { onChange(""); setOpen(false); }}>{placeholder}</div>
                        {options.map((o, i) => {
                            const val = o.value !== undefined ? o.value : o;
                            const lbl = o.label !== undefined ? o.label : o;
                            return (
                                <div key={i} onClick={() => { onChange(val); setOpen(false); }}>{lbl}</div>
                            );
                        })}
                    </div>
                )}
            </div>
            <span className="mat-bar" />
        </div>
    );
}

export default function KitchenSchedules({ adminData, setAdminData }) {
    const location = useLocation();
    const [statusFilter, setStatusFilter] = useState(location.state?.status || "");
    const [searchText, setSearchText] = useState("");
    const today = format(new Date(), "yyyy-MM-dd");
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [activePreset, setActivePreset] = useState("Today");
    const [show, setShow] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});

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
        const errs = {};
        if (!form.work.trim()) errs.work = true;
        if (!form.staff) errs.staff = true;
        if (!form.date) errs.date = true;
        if (!form.department) errs.department = true;
        if (!form.status) errs.status = true;
        if (!form.lastRate && form.lastRate !== 0 && form.lastRate !== "0") errs.lastRate = true;
        if (Object.keys(errs).length) { setFormErrors(errs); return; }
        const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
        const newItem = { id: newId, ...form };
        try {
            await api.post("/kitchenSchedules", newItem);
            setAdminData(prev => ({ ...prev, kitchenSchedules: [...(prev.kitchenSchedules || []), newItem] }));
            setForm(EMPTY_FORM);
            setFormErrors({});
            setShow(false);
        } catch (err) { console.error("Failed to add schedule", err); }
    };

    const cancel = () => { setForm(EMPTY_FORM); setFormErrors({}); setShow(false); };

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

    const markCompleted = async (item) => {
        if (item.status === "Completed") return;
        const updated = { ...item, status: "Completed", completedAt: new Date().toISOString() };
        try {
            await api.put(`/kitchenSchedules/${item.id}`, updated);
        } catch (err) {
            console.warn("Could not update schedule status:", err);
        }
        try {
            await api.post("/kitchenActivity", updated);
        } catch (err) {
            console.warn("Could not write to activity:", err);
        }
        setAdminData(prev => ({
            ...prev,
            kitchenSchedules: (prev.kitchenSchedules || []).map(s => s.id === item.id ? updated : s),
            kitchenActivity: [...(prev.kitchenActivity || []), updated],
        }));
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
        XLSX.utils.book_append_sheet(wb, sheet, "Kitchen Schedules");
        XLSX.writeFile(wb, `kitchen_schedules_${fromDate}_to_${toDate}.xlsx`);
    };

    return (
        <div className="schedule-page">
            <div className="schedule-header">
                <h2>Kitchen Schedules</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        className="modal-save-btn"
                        onClick={exportToExcel}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Export</span>
                    </button>
                    <button className="modal-save-btn" onClick={() => setShow(true)}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">+ Add Schedule</span>
                    </button>
                </div>
            </div>

            <div className="ssched-filter-bar">
                <input className="search-input" placeholder=" Search work / staff…" value={searchText} onChange={e => setSearchText(e.target.value)} />

                <CustomDatePicker label="From" value={fromDate} max={toDate}
                    onChange={s => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate}
                    onChange={s => { setToDate(s); setActivePreset("custom"); }} />
                {PRESETS.map(p => (
                    <button key={p.label} className={`filter-pill${activePreset === p.label ? " active" : ""}`} onClick={() => applyPreset(p)}>
                        {p.label}
                    </button>
                ))}
                <div className="sched-status-pills">
                    {["", "Scheduled", "Completed", "Pending"].map(s => (
                        <button key={s} className={`filter-pill${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
                            {s || "All"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="schedule-table-wrapper">
                <table className="schedule-table">
                    <thead>
                        <tr>
                            <th>Work</th><th>Staff</th><th>Date</th>
                            <th>Department</th><th>Status</th><th>Response</th>
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
                            <button type="button" className="modal-cancel-btn" onClick={cancel}>
                                <span class="shadow"></span>
                                <span class="edge"></span>
                                <span class="front close-padding"><img src={closeIcon} /></span>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className={`form-group${formErrors.department ? " mat-select-error" : ""}`}>
                                <CustomDropdown
                                    label="Department"
                                    value={form.department}
                                    onChange={(val) => { setForm({ ...form, department: val }); setFormErrors(p => ({ ...p, department: false })); }}
                                    options={["Pest Control", "Maintenance", "Laundry"]}
                                    placeholder="Select Department"
                                />
                            </div>
                            <div className="form-group">
                                <div className="mat">
                                    <input
                                        className={`mat-input${formErrors.work ? " mat-error" : ""}`}
                                        placeholder=" "
                                        value={form.work}
                                        onChange={e => { setForm({ ...form, work: e.target.value }); setFormErrors(p => ({ ...p, work: false })); }}
                                    />
                                    <label className={`mat-label${formErrors.work ? " mat-label-error" : ""}`}>Work<span className="rf-req">*</span></label>
                                    <span className={`mat-bar${formErrors.work ? " mat-bar-error" : ""}`} />
                                </div>
                            </div>
                            <div className={`form-group${formErrors.staff ? " mat-select-error" : ""}`}>
                                <CustomDropdown
                                    label="Staff"
                                    value={form.staff}
                                    onChange={(val) => { setForm({ ...form, staff: val }); setFormErrors(p => ({ ...p, staff: false })); }}
                                    options={adminData.staff?.map(s => s.name) || []}
                                    placeholder="Select Staff"
                                />
                            </div>
                            <div className="form-group">
                                <label className={`mat-label${formErrors.date ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Date<span className="rf-req">*</span></label>
                                <CustomDatePicker
                                    value={form.date}
                                    onChange={(v) => { setForm({ ...form, date: v }); setFormErrors(p => ({ ...p, date: false })); }}
                                    placeholder="Select date"
                                    hasError={!!formErrors.date}
                                />
                            </div>
                            <div className={`form-group${formErrors.status ? " mat-select-error" : ""}`}>
                                <CustomDropdown
                                    label="Status"
                                    value={form.status}
                                    onChange={(val) => { setForm({ ...form, status: val }); setFormErrors(p => ({ ...p, status: false })); }}
                                    options={["Scheduled", "Completed", "Pending"]}
                                    placeholder="Select Status"
                                />
                            </div>
                            <div className={`form-group${formErrors.lastRate ? " mat-select-error" : ""}`}>
                                <CustomDropdown
                                    label="Response (Days)"
                                    value={form.lastRate}
                                    onChange={(val) => { setForm({ ...form, lastRate: val }); setFormErrors(p => ({ ...p, lastRate: false })); }}
                                    options={[0, 1, 2, 3].map(d => ({ value: String(d), label: `${d} Days` }))}
                                    placeholder="Select Days"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="modal-cancel-btn"
                                type="button"
                                onClick={cancel}
                            >
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Cancel</span>
                            </button>
                            <button
                                type="submit"
                                className="modal-save-btn"
                            >
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Save Schedule</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}