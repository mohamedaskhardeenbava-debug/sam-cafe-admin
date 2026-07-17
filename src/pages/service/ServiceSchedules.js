/**
 * ServiceSchedules.js  —  Sam Cafe Admin Panel
 * Service shift schedules page
 */

import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { format } from "date-fns";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";

import "./ServiceSchedules.css";

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
      // Monday of the current week → today (not out to Sunday), matching
      // the shared dateRangeUtils.getWeekRange() convention used elsewhere.
      const day = now.getDay(); // 0=Sun
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return [fmt(monday), fmt(now)];
    }
  },
  {
    label: "This Month",
    fn: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return [fmt(first), fmt(now)];
    }
  },
  {
    label: "Last Month",
    fn: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return [fmt(first), fmt(last)];
    }
  },
];

const EMPTY_FORM = { work: "", staff: "", date: "", department: "", status: "", lastRate: "" };

const SORT_KEYS = ["date", "work", "staff", "department", "status"];

export default function ServiceSchedules({ adminData, setAdminData }) {
  // ── Hooks

  const location = useLocation();
  const { toast } = useToast();

  const [openDropdown, setOpenDropdown] = useState(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [statusFilter, setStatusFilter] = useState(location.state?.status || "");
  const [searchText, setSearchText] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [activePreset, setActivePreset] = useState("Today");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
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
    const errs = {};
    if (!form.work.trim()) errs.work = true;
    if (!form.staff) errs.staff = true;
    if (!form.date) errs.date = true;
    if (!form.department) errs.department = true;
    if (!form.status) errs.status = true;
    if (!form.lastRate && form.lastRate !== 0 && form.lastRate !== "0") errs.lastRate = true;
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    const newId = `ss_${Date.now()}`;
    const newItem = { id: newId, ...form };
    try {
      await api.post("/serviceSchedules", newItem);
      setAdminData(prev => ({ ...prev, serviceSchedules: [...(prev.serviceSchedules || []), newItem] }));
      setForm(EMPTY_FORM);
      setFormErrors({});
      setShow(false);
      toast.success("Schedule added successfully.");
    } catch (err) {
      toast.error("Failed to add schedule. Please try again.");
    }
  };

  const cancel = () => { setForm(EMPTY_FORM); setFormErrors({}); setShow(false); };

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
        toast.error(`Failed to delete schedule ${item.id}.`);
        deletedIds.push(item.id);
      }
    }

    for (const item of expired) {
      try {
        await api.post("/serviceActivity", item);
      } catch (err) {
        toast.error("Failed to archive schedule.");
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
      toast.error("Failed to update schedule status.");
    }
    // Also copy to activity log
    try {
      await api.post("/serviceActivity", updated);
    } catch (err) {
      toast.error("Failed to write to activity log.");
    }
    setAdminData(prev => ({
      ...prev,
      serviceSchedules: (prev.serviceSchedules || []).map(s => s.id === item.id ? updated : s),
      serviceActivity: [...(prev.serviceActivity || []), updated],
    }));
    toast.success(`"${item.work}" marked as completed.`);
  };

  const handleExport = () => {
    if (!filteredList.length) { toast.warning("No schedule data to export"); return; }
    const rows = filteredList.map(item => ({
      Work: item.work || "—",
      Staff: item.staff || "—",
      Date: item.date || "—",
      Department: item.department || "—",
      Status: item.status || "—",
      "Response (Days)": item.lastRate !== "" && item.lastRate != null ? `${item.lastRate} days` : "—",
    }));
    exportToExcel({ rows, sheetName: "Service Schedules", fileName: `service_schedules_${fromDate}_to_${toDate}.xlsx` });
  };

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <button
            type="button"
            className="header-collapse-btn"
            onClick={() => setHeaderCollapsed(prev => !prev)}
            title={headerCollapsed ? "Expand header" : "Collapse header"}
            aria-expanded={!headerCollapsed}
          >
            <span className={`header-collapse-arrow${headerCollapsed ? " rotated" : ""}`}>▾</span>
          </button>
          <h2 className="title">Service Schedules</h2>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={handleExport}>Export</Button3D>
          <Button3D onClick={() => setShow(true)}>+ Add Schedule</Button3D>
        </div>
      </div>

      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input className="search-input" placeholder="Search work / staff…" value={searchText} onChange={e => setSearchText(allowTextInput(searchText, e.target.value, 100, 5))} />

            <div className="filter-group">
              <span className="filter-group-label">from</span>
              <CustomDatePicker label="From" value={fromDate} max={toDate}
                onChange={s => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
              <span className="filter-group-label">to</span>
              <CustomDatePicker label="To" value={toDate} min={fromDate}
                onChange={s => { setToDate(s); setActivePreset("custom"); }} />
            </div>

            <div className="filter-group">
              <span className="filter-group-label">period</span>
              {PRESETS.map(p => (
                <button key={p.label} className={`filter-pill${activePreset === p.label ? " active" : ""}`} onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>

            <div className="filter-group">
              <span className="filter-group-label">status</span>
              {["", "Scheduled", "Completed", "Pending"].map(s => (
                <button key={s} className={`filter-pill${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
                  {s || "All"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="table-wrapper" style={{ maxHeight: headerCollapsed ? "calc(100vh - 160px)" : "calc(100vh - 290px)" }} >
        <table >
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
          <form className="admin-modal" onSubmit={e => { e.preventDefault(); add(); }}>
            <div className="admin-modal-header">
              <h3>Add Schedule</h3>
              <Button3D variant="cancel" iconOnly onClick={cancel}><img src={closeIcon} /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className={`admin-form-group${formErrors.department ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Department"
                  value={form.department}
                  onChange={val => { setForm({ ...form, department: val }); setFormErrors(p => ({ ...p, department: false })); }}
                  options={["Pest Control", "Maintenance", "Laundry"]}
                  placeholder="Select Department"
                />
              </div>
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.work ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.work}
                    onChange={e => { setForm({ ...form, work: allowTextInput(form.work, e.target.value, 100, 5) }); setFormErrors(p => ({ ...p, work: false })); }}
                  />
                  <label className={`mat-label${formErrors.work ? " mat-label-error" : ""}`}>Work<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.work ? " mat-bar-error" : ""}`} />
                </div>
              </div>
              <div className={`admin-form-group${formErrors.staff ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Staff"
                  value={form.staff}
                  onChange={val => { setForm({ ...form, staff: val }); setFormErrors(p => ({ ...p, staff: false })); }}
                  options={(adminData.staff || []).map(s => ({ value: s.name, label: s.name }))}
                  placeholder="Select Staff"
                />
              </div>
              <div className="admin-form-group">
                <label className={`mat-label${formErrors.date ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Date<span className="rf-req">*</span></label>
                <CustomDatePicker
                  value={form.date}
                  onChange={(v) => { setForm({ ...form, date: v }); setFormErrors(p => ({ ...p, date: false })); }}
                  placeholder="Select date"
                  hasError={!!formErrors.date}
                />
              </div>
              <div className={`admin-form-group${formErrors.status ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Status"
                  value={form.status}
                  onChange={val => { setForm({ ...form, status: val }); setFormErrors(p => ({ ...p, status: false })); }}
                  options={["Scheduled", "Completed", "Pending"]}
                  placeholder="Select Status"
                />
              </div>
              <div className={`admin-form-group${formErrors.lastRate ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Response (Days)"
                  value={form.lastRate}
                  onChange={val => { setForm({ ...form, lastRate: val }); setFormErrors(p => ({ ...p, lastRate: false })); }}
                  options={[0, 1, 2, 3].map(d => ({ value: String(d), label: `${d} Days` }))}
                  placeholder="Select Days"
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={cancel}>Cancel</Button3D>
              <Button3D type="submit">Save Schedule</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}