/**
 * KitchenSchedules.js  —  Sam Cafe Admin Panel
 * Kitchen shift schedules page
 */

import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { format } from "date-fns";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";

import "./KitchenSchedules.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PRESETS = [
  { label: "All", fn: () => ["2000-01-01", "2099-12-31"] },
  { label: "Today", fn: () => { const t = format(new Date(), "yyyy-MM-dd"); return [t, t]; } },
  { label: "This Month", fn: () => { const d = new Date(); return [format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"), format(d, "yyyy-MM-dd")]; } },
];

const EMPTY_FORM = { work: "", staff: "", date: "", department: "", status: "", lastRate: "" };

export default function KitchenSchedules({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
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

  // ── Handlers

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
      toast.success("Schedule added successfully.");
    } catch (err) { toast.error("Failed to add schedule. Please try again."); }
  };

  // ── Helpers

  const cancel = () => { setForm(EMPTY_FORM); setFormErrors({}); setShow(false); };

  const moveExpiredSchedules = async () => {
    const expired = list.filter(item => item.date < today);
    if (!expired.length) return;

    const activity = adminData?.kitchenActivity || [];
    const deletedIds = [];

    // correct
    for (const item of expired) {
      try {
        await api.delete(`/kitchenSchedules/${item.id}`);
        deletedIds.push(item.id);
      } catch (err) {
        toast.error(`Failed to delete schedule ${item.id}.`);
        deletedIds.push(item.id);
      }
    }

    for (const item of expired) {
      try {
        await api.post("/kitchenActivity", item);
      } catch (err) {
        toast.error("Failed to archive schedule.");
      }
    }

    // Remove expired from local state regardless of API delete outcome
    setAdminData(prev => ({
      ...prev,
      kitchenSchedules: (prev.kitchenSchedules || []).filter(i => !deletedIds.includes(i.id)),
      kitchenActivity: [...activity, ...expired]
    }));
  };

  // ── Effects

  useEffect(() => { moveExpiredSchedules(); }, []);

  const markCompleted = async (item) => {
    if (item.status === "Completed") return;
    const updated = { ...item, status: "Completed", completedAt: new Date().toISOString() };
    try {
      await api.put(`/kitchenSchedules/${item.id}`, updated);
    } catch (err) {
      toast.error("Failed to update schedule status.");
    }
    try {
      await api.post("/kitchenActivity", updated);
    } catch (err) {
      toast.error("Failed to write to activity log.");
    }
    setAdminData(prev => ({
      ...prev,
      kitchenSchedules: (prev.kitchenSchedules || []).map(s => s.id === item.id ? updated : s),
      kitchenActivity: [...(prev.kitchenActivity || []), updated],
    }));
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
    exportToExcel({ rows, sheetName: "Kitchen Schedules", fileName: `kitchen_schedules_${fromDate}_to_${toDate}.xlsx` });
  };

  return (
    <div className="inner-page">
      <div className="header">
        <h2 className="title">Kitchen Schedules</h2>
        <div className="header-btn-container">
          <Button3D onClick={handleExport}>Export</Button3D>
          <Button3D onClick={() => setShow(true)}>+ Add Schedule</Button3D>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <input className="search-input" placeholder=" Search work / staff…" value={searchText} onChange={e => setSearchText(e.target.value)} />
          <div className="filter-group">
            <span className="filter-group-label">from</span>
            <CustomDatePicker label="From" value={fromDate} max={toDate}
              onChange={s => { setFromDate(s); if (s > toDate) setToDate(s); setActivePreset("custom"); }} />
            <span className="filter-group-label">to</span>
            <CustomDatePicker label="To" value={toDate} min={fromDate}
              onChange={s => { setToDate(s); setActivePreset("custom"); }} />

            <div className="filter-group">
              <span className="filter-group-label">period</span>
              {PRESETS.map(p => (
                <button key={p.label} className={`filter-pill${activePreset === p.label ? " active" : ""}`} onClick={() => applyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
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

      <div className="table-wrapper" style={{ maxHeight: "calc(100vh - 290px)" }} >
        <table className="table">
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
              <Button3D variant="cancel" iconOnly onClick={cancel}><img src={closeIcon} /></Button3D>
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
              <Button3D variant="cancel" onClick={cancel}>Cancel</Button3D>
              <Button3D type="submit">Save Schedule</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}