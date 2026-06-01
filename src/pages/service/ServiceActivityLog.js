import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import "./ServiceActivityLog.css";
import { CustomDatePicker } from "../../components/CustomDatePicker";

const PRESETS = [
    { label: "All", getRange: () => ["2000-01-01", "2099-12-31"] },
    { label: "Today", getRange: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; } },
    { label: "This Month", getRange: () => { const d = new Date(); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd")]; } },
];

export default function ServiceActivityLog({ adminData }) {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    /* Default: show All so existing data is always visible */
    const [fromDate, setFromDate] = useState("2000-01-01");
    const [toDate, setToDate] = useState("2099-12-31");
    const [activePreset, setActivePreset] = useState("All");
    const [searchText, setSearchText] = useState("");

    const list = adminData?.serviceActivity || [];

    const filtered = useMemo(() => list.filter(item => {
        const d = item.date || "";
        const matchDate = d >= fromDate && d <= toDate;
        const q = searchText.toLowerCase();
        const matchSearch = !q || (item.work || "").toLowerCase().includes(q) || (item.staff || "").toLowerCase().includes(q);
        return matchDate && matchSearch;
    }), [list, fromDate, toDate, searchText]);

    const applyPreset = (preset) => {
        const [f, t] = preset.getRange();
        setFromDate(f); setToDate(t);
        setActivePreset(preset.label);
    };

    const exportToExcel = () => {
        if (!filtered.length) { alert("No activity data to export"); return; }
        const rows = filtered.map(item => ({
            Work: item.work || "—",
            Staff: item.staff || "—",
            Date: item.date || "—",
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(key => ({
            wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? "").length)) + 2
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Service Activity");
        XLSX.writeFile(wb, `service_activity_${fromDate}_to_${toDate}.xlsx`);
    };

    return (
        <div className="activity-page">
            <div className="activity-header">
                <h2 className="activity-title">Service Activity Log</h2>
                <button className="export-btn" onClick={exportToExcel}>Export</button>
            </div>

            <div className="activity-filter-bar">
                <input className="search-input" placeholder=" Search work / staff…"
                    value={searchText} onChange={e => setSearchText(e.target.value)} />
                <CustomDatePicker label="From" value={fromDate} max={toDate}
                    onChange={(s) => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
                <CustomDatePicker label="To" value={toDate} min={fromDate} max={todayStr}
                    onChange={(s) => { setToDate(s); setActivePreset("custom"); }} />
                {PRESETS.map(p => (
                    <button key={p.label}
                        className={`sact-pill-btn${activePreset === p.label ? " active" : ""}`}
                        onClick={() => applyPreset(p)}>
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="activity-table-wrapper">
                <table className="activity-table">
                    <thead>
                        <tr>
                            <th>Work</th>
                            <th>Staff</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan="3" style={{ textAlign: "center", color: "#aaa" }}>No activity found</td></tr>
                        ) : (
                            filtered.map((item, i) => (
                                <tr key={item.id ?? i}>
                                    <td>{item.work || "—"}</td>
                                    <td>{item.staff || "—"}</td>
                                    <td>{item.date || "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}