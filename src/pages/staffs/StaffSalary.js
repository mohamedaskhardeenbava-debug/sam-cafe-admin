/**
 * StaffSalary.js  —  Sam Cafe Admin Panel
 * Staff salary management page
 *
 * Data model (on each staff document):
 *   salary               — current base salary (number)
 *   remainingSalary[]     — monthly ledger, oldest → newest. Each entry:
 *                             { month: "YYYY-MM", baseSalary, advance,
 *                               deduction, penalty, bonus, overtime,
 *                               remaining, updatedAt }
 *                           The server appends a new zeroed entry for
 *                           the new month on rollover (see server's
 *                           resetMonthlySalaryFieldsIfNeeded); this page
 *                           edits the CURRENT month's entry in place
 *                           (updating the last entry when its month
 *                           matches, otherwise appending one) so past
 *                           months are never rewritten.
 *   salaryChangeLog[]     — base-salary revision timeline. Each entry:
 *                             { id, date, fromSalary, toSalary, percent,
 *                               note, updatedAt }
 *                           Written only by the "Increment" action.
 */

import React, { useState, useEffect } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import closeIcon from "../../icon/close-icon.png";
import editIcon from "../../icon/edit-icon.png";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../../components/InfiniteScrollLoader";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import { EmptyRow } from "../../App";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import CollapseChevron from "../../components/CollapseChevron";
import CollapseSection from "../../components/CollapseSection";
import { PillGroup } from "../../components/FilterBar";
import { fmtDate } from "../../utils/dateUtils";
import useRoleTitles from "./useRoleTitles";

import "./StaffModules.css";

const currentMonth = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

const monthLabel = (ym) => {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

export default function StaffSalary({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const { roleTitles: jobRoles } = useRoleTitles();

  const [selected, setSelected] = useState(null);
  const salaryModal = useAnimatedModal("staffSalary-detail");
  const historyModal = useAnimatedModal("staffSalary-history");
  const incrementModal = useAnimatedModal("staffSalary-increment");
  const [staffList, setStaffList] = useState(adminData.staff);
  const [salarySearch, setSalarySearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "", "hasAdvance", "hasDeduction", "hasBonus"
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [form, setForm] = useState({
    advance: 0,
    deduction: 0,
    penalty: 0,
    bonus: 0,
    overtime: 0
  });
  const [incrementForm, setIncrementForm] = useState({ mode: "percent", percent: "", amount: "", note: "" });

  useEffect(() => {
    setStaffList(adminData.staff);
  }, [adminData.staff]);

  // ── Helpers

  const ledgerOf = (staff) => staff.remainingSalary || [];

  // Current month's ledger entry — zeroed-out shape if none exists yet
  // (e.g. brand-new staff, or before their first salary edit is saved).
  const currentEntry = (staff) => {
    const ledger = ledgerOf(staff);
    const last = ledger[ledger.length - 1];
    if (last && last.month === currentMonth()) return last;
    return {
      month: currentMonth(),
      baseSalary: Number(staff.salary || 0),
      advance: 0, deduction: 0, penalty: 0, bonus: 0, overtime: 0,
      remaining: Number(staff.salary || 0),
    };
  };

  const computeRemaining = (base, e) =>
    Number(base) + Number(e.bonus || 0) + Number(e.overtime || 0) -
    Number(e.advance || 0) - Number(e.deduction || 0) - Number(e.penalty || 0);

  const openModal = (staff) => {
    setSelected(staff);
    salaryModal.open();
    const e = currentEntry(staff);
    setForm({
      advance: Number(e.advance || 0),
      deduction: Number(e.deduction || 0),
      penalty: Number(e.penalty || 0),
      bonus: Number(e.bonus || 0),
      overtime: Number(e.overtime || 0),
    });
  };

  const openHistory = (staff) => {
    setSelected(staff);
    historyModal.open();
  };

  const openIncrement = (staff) => {
    setSelected(staff);
    setIncrementForm({ mode: "percent", percent: "", amount: "", note: "" });
    incrementModal.open();
  };

  // ── Handlers

  const closeModal = () => salaryModal.close(() => setSelected(null));
  const closeHistory = () => historyModal.close(() => setSelected(null));
  const closeIncrement = () => incrementModal.close(() => setSelected(null));

  const pushUpdate = (updated) => {
    setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
    if (setAdminData) {
      setAdminData(prev => ({
        ...prev,
        staff: prev.staff.map(s => s.id === updated.id ? updated : s)
      }));
    }
  };

  const handleSave = async () => {
    const advance = Number(form.advance || 0);
    const deduction = Number(form.deduction || 0);
    const penalty = Number(form.penalty || 0);
    const bonus = Number(form.bonus || 0);
    const overtime = Number(form.overtime || 0);
    const base = Number(selected.salary || 0);
    const remaining = computeRemaining(base, { advance, deduction, penalty, bonus, overtime });

    const record = {
      month: currentMonth(),
      baseSalary: base,
      advance, deduction, penalty, bonus, overtime, remaining,
      updatedAt: new Date().toISOString(),
    };

    // Edit the current month's entry in place if it already exists in
    // the ledger; otherwise append a new one. Past months are never
    // touched, preserving full salary history.
    const ledger = ledgerOf(selected);
    const last = ledger[ledger.length - 1];
    const newLedger = last && last.month === currentMonth()
      ? [...ledger.slice(0, -1), record]
      : [...ledger, record];

    const updated = { ...selected, salaryRemaining: remaining, remainingSalary: newLedger };

    try {
      const res = await api.put(`/staff/${selected.id}`, updated);
      pushUpdate(res.data);
      toast.success("Salary updated");
    } catch (err) {
      console.error("Salary update failed:", err);
      toast.error("Failed to update salary");
    }

    closeModal();
  };

  const handleIncrement = async () => {
    const base = Number(selected.salary || 0);
    let newSalary;
    let percentApplied = null;

    if (incrementForm.mode === "percent") {
      const pct = Number(incrementForm.percent || 0);
      if (!pct || pct <= 0) { toast.warning("Enter a valid increment percentage"); return; }
      newSalary = Math.round(base * (1 + pct / 100));
      percentApplied = pct;
    } else {
      const amt = Number(incrementForm.amount || 0);
      if (!amt || amt <= 0) { toast.warning("Enter a valid increment amount"); return; }
      newSalary = base + amt;
      percentApplied = base > 0 ? Number(((amt / base) * 100).toFixed(2)) : null;
    }

    const changeEntry = {
      id: String(Date.now()),
      date: new Date().toISOString().slice(0, 10),
      fromSalary: base,
      toSalary: newSalary,
      percent: percentApplied,
      note: incrementForm.note.trim(),
      updatedAt: new Date().toISOString(),
    };

    // Also update the current month's ledger entry's baseSalary so the
    // table/ledger reflect the new salary immediately, recomputing
    // remaining with the same add-ons/deductions already entered.
    const ledger = ledgerOf(selected);
    const last = ledger[ledger.length - 1];
    const currentAddOns = last && last.month === currentMonth() ? last : { advance: 0, deduction: 0, penalty: 0, bonus: 0, overtime: 0 };
    const newRemaining = computeRemaining(newSalary, currentAddOns);
    const updatedCurrentEntry = { ...currentAddOns, month: currentMonth(), baseSalary: newSalary, remaining: newRemaining, updatedAt: new Date().toISOString() };
    const newLedger = last && last.month === currentMonth()
      ? [...ledger.slice(0, -1), updatedCurrentEntry]
      : [...ledger, updatedCurrentEntry];

    const updated = {
      ...selected,
      salary: newSalary,
      salaryRemaining: newRemaining,
      remainingSalary: newLedger,
      salaryChangeLog: [...(selected.salaryChangeLog || []), changeEntry],
    };

    try {
      const res = await api.put(`/staff/${selected.id}`, updated);
      pushUpdate(res.data);
      toast.success(`Salary incremented to ₹${newSalary.toLocaleString("en-IN")}`);
    } catch (err) {
      console.error("Increment failed:", err);
      toast.error("Failed to apply increment");
    }

    closeIncrement();
  };

  const filteredList = staffList.filter(s => {
    const q = salarySearch.trim().toLowerCase();
    const matchSearch = !q ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.role || "").toLowerCase().includes(q);
    const matchRole = !roleFilter || s.role === roleFilter;
    const e = currentEntry(s);
    const matchStatus =
      !statusFilter ||
      (statusFilter === "hasAdvance" && Number(e.advance || 0) > 0) ||
      (statusFilter === "hasDeduction" && (Number(e.deduction || 0) > 0 || Number(e.penalty || 0) > 0)) ||
      (statusFilter === "hasBonus" && (Number(e.bonus || 0) > 0 || Number(e.overtime || 0) > 0));
    return matchSearch && matchRole && matchStatus;
  });

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredList.length, 30);

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand header" : "Collapse header"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Salary Management</h2>
              <span className="result-count">{filteredList.length} staff</span>
            </div>
          </div>
        </div>
        <Button3D onClick={() => {
          const rows = filteredList.map((s) => {
            const e = currentEntry(s);
            const remaining = computeRemaining(s.salary, e);
            return {
              Name: s.name || "—",
              Role: s.role || "—",
              "Base Salary (₹)": Number(s.salary || 0),
              "Advance (₹)": Number(e.advance || 0),
              "Deduction (₹)": Number(e.deduction || 0),
              "Penalty (₹)": Number(e.penalty || 0),
              "Bonus (₹)": Number(e.bonus || 0),
              "Overtime (₹)": Number(e.overtime || 0),
              "Remaining (₹)": remaining,
              Month: monthLabel(e.month),
            };
          });
          if (!rows.length) { toast.warning("No salary data to export"); return; }
          exportToExcel({ rows, sheetName: "Salary", fileName: `salary_${new Date().toISOString().slice(0, 10)}.xlsx` });
        }}>Export</Button3D>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search name or role…"
              value={salarySearch}
              onChange={e => setSalarySearch(allowTextInput(salarySearch, e.target.value, 100, 5))}
            />
            <PillGroup
              label="Role"
              options={jobRoles.map(r => [r, r])}
              value={roleFilter}
              onChange={setRoleFilter}
            />
            <PillGroup
              label="Status"
              options={[
                ["hasAdvance", "Has Advance"],
                ["hasDeduction", "Has Deduction/Penalty"],
                ["hasBonus", "Has Bonus/Overtime"],
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {(salarySearch || roleFilter || statusFilter) && (
              <button className="ae-clear-filter" onClick={() => { setSalarySearch(""); setRoleFilter(""); setStatusFilter(""); }}>Clear</button>
            )}
          </div>
        </div>
      </CollapseSection>

      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th>Name</th>
              <th>Base Salary</th>
              <th>Advance</th>
              <th>Deduction</th>
              <th>Penalty</th>
              <th>Bonus</th>
              <th>Overtime / Extrawages</th>
              <th>Remaining</th>
              <th className="icon-width">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredList.length === 0 ? (
              <EmptyRow colSpan={9} message="No staff available" />
            ) : (
              filteredList.slice(0, displayLimit).map((s, i) => {
                const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3", "#fb8500", "#023e8a"];
                const avatarBg = PALETTE[i % PALETTE.length];

                const e = currentEntry(s);
                const totalAdvance = Number(e.advance || 0);
                const totalDeduction = Number(e.deduction || 0);
                const totalPenalty = Number(e.penalty || 0);
                const totalBonus = Number(e.bonus || 0);
                const totalOvertime = Number(e.overtime || 0);
                const computedRemaining = computeRemaining(s.salary, e);
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
                    <td className="icon-width">
                      <div className="st-actions">
                        <Button3D variant="cancel" iconOnly title="Edit this month" data-bs-toggle="tooltip" data-bs-title="Edit this month" onClick={() => openModal(s)}><img src={editIcon} alt="" /></Button3D>
                        <Button3D variant="cancel" iconOnly title="History" data-bs-toggle="tooltip" data-bs-title="Salary History" onClick={() => openHistory(s)}>🕘</Button3D>
                        <Button3D variant="cancel" iconOnly title="Increment" data-bs-toggle="tooltip" data-bs-title="Apply Increment" onClick={() => openIncrement(s)}>⬆</Button3D>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {filteredList.length > 0 && (
              <InfiniteScrollLoader
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                colSpan={9}
              />
            )}
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>

      {/* EDIT CURRENT MONTH MODAL */}
      {salaryModal.shouldRender && (
        <div className={`modal-overlay ${salaryModal.overlayClass}`}>
          <div className={`admin-modal ${salaryModal.modalClass}`}>

            <div className="admin-modal-header">
              <div>
                <h3>{selected.name}</h3>
                <span className="sc-modal-sub">{monthLabel(currentMonth())}</span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={closeModal}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    value={form.advance}
                    onChange={e => setForm({ ...form, advance: e.target.value })}
                  />
                  <label className="mat-label">Advance</label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    value={form.deduction}
                    onChange={e => setForm({ ...form, deduction: e.target.value })}
                  />
                  <label className="mat-label">Deduction</label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    value={form.penalty}
                    onChange={e => setForm({ ...form, penalty: e.target.value })}
                  />
                  <label className="mat-label">Penalty</label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    value={form.bonus}
                    onChange={e => setForm({ ...form, bonus: e.target.value })}
                  />
                  <label className="mat-label">Bonus</label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    value={form.overtime}
                    onChange={e => setForm({ ...form, overtime: e.target.value })}
                  />
                  <label className="mat-label">Overtime</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeModal}>Cancel</Button3D>
              <Button3D onClick={handleSave}>Save</Button3D>
            </div>

          </div>
        </div>
      )}

      {/* INCREMENT MODAL */}
      {incrementModal.shouldRender && (
        <div className={`modal-overlay ${incrementModal.overlayClass}`}>
          <div className={`admin-modal ${incrementModal.modalClass}`}>
            <div className="admin-modal-header">
              <div>
                <h3>Apply Increment</h3>
                <span className="sc-modal-sub">{selected.name} — current ₹{Number(selected.salary || 0).toLocaleString("en-IN")}</span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={closeIncrement}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="filter-bar" style={{ marginBottom: 16 }}>
                <PillGroup
                  options={[["percent", "By Percentage"], ["amount", "By Amount"]]}
                  value={incrementForm.mode}
                  onChange={(v) => v && setIncrementForm(f => ({ ...f, mode: v }))}
                  toggle={false}
                />
              </div>

              {incrementForm.mode === "percent" ? (
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className="mat-input"
                      placeholder=" "
                      type="number"
                      min="0"
                      step="0.1"
                      value={incrementForm.percent}
                      onChange={e => setIncrementForm({ ...incrementForm, percent: e.target.value })}
                    />
                    <label className="mat-label">Increment %</label>
                    <span className="mat-bar" />
                  </div>
                </div>
              ) : (
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className="mat-input"
                      placeholder=" "
                      type="number"
                      min="0"
                      value={incrementForm.amount}
                      onChange={e => setIncrementForm({ ...incrementForm, amount: e.target.value })}
                    />
                    <label className="mat-label">Increment Amount (₹)</label>
                    <span className="mat-bar" />
                  </div>
                </div>
              )}

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
                    value={incrementForm.note}
                    onChange={e => setIncrementForm({ ...incrementForm, note: allowTextInput(incrementForm.note, e.target.value, 300, 100000) })}
                  />
                  <label className="mat-label">Note (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>

              {(() => {
                const base = Number(selected.salary || 0);
                const pct = Number(incrementForm.percent || 0);
                const amt = Number(incrementForm.amount || 0);
                const preview = incrementForm.mode === "percent"
                  ? (pct > 0 ? Math.round(base * (1 + pct / 100)) : null)
                  : (amt > 0 ? base + amt : null);
                if (!preview) return null;
                return (
                  <div className="sc-desc" style={{ marginTop: 4 }}>
                    New base salary: <strong>₹{preview.toLocaleString("en-IN")}</strong>
                  </div>
                );
              })()}
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeIncrement}>Cancel</Button3D>
              <Button3D onClick={handleIncrement}>Apply Increment</Button3D>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModal.shouldRender && (
        <div className={`modal-overlay ${historyModal.overlayClass}`} onClick={closeHistory}>
          <div className={`admin-modal salary-history-modal ${historyModal.modalClass}`} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>{selected.name}</h3>
                <span className="sc-modal-sub">Salary History</span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={closeHistory}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <h4 className="sh-section-title">Monthly Ledger</h4>
              {ledgerOf(selected).length === 0 ? (
                <div className="sh-empty">No salary records yet.</div>
              ) : (
                <div className="sh-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Base</th>
                        <th>Advance</th>
                        <th>Deduction</th>
                        <th>Penalty</th>
                        <th>Bonus</th>
                        <th>Overtime</th>
                        <th>Final Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ledgerOf(selected)].reverse().map((rec, idx) => (
                        <tr key={rec.month + idx}>
                          <td>{monthLabel(rec.month)}</td>
                          <td>₹{Number(rec.baseSalary || 0).toLocaleString("en-IN")}</td>
                          <td>₹{Number(rec.advance || 0).toLocaleString("en-IN")}</td>
                          <td>₹{Number(rec.deduction || 0).toLocaleString("en-IN")}</td>
                          <td>₹{Number(rec.penalty || 0).toLocaleString("en-IN")}</td>
                          <td>₹{Number(rec.bonus || 0).toLocaleString("en-IN")}</td>
                          <td>₹{Number(rec.overtime || 0).toLocaleString("en-IN")}</td>
                          <td><strong>₹{Number(rec.remaining || 0).toLocaleString("en-IN")}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 className="sh-section-title" style={{ marginTop: 24 }}>Salary Revisions</h4>
              {(selected.salaryChangeLog || []).length === 0 ? (
                <div className="sh-empty">No increments recorded yet.</div>
              ) : (
                <div className="sh-timeline">
                  {[...(selected.salaryChangeLog || [])].reverse().map((c) => (
                    <div className="sh-timeline-item" key={c.id}>
                      <div className="sh-timeline-dot" />
                      <div className="sh-timeline-body">
                        <div className="sh-timeline-top">
                          <span className="sh-timeline-date">{fmtDate(c.date)}</span>
                          {c.percent != null && <span className="sh-timeline-pct">+{c.percent}%</span>}
                        </div>
                        <div className="sh-timeline-change">
                          ₹{Number(c.fromSalary).toLocaleString("en-IN")} → <strong>₹{Number(c.toSalary).toLocaleString("en-IN")}</strong>
                        </div>
                        {c.note && <div className="sh-timeline-note">{c.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeHistory}>Close</Button3D>
              <Button3D onClick={() => {
                const rows = ledgerOf(selected).map(rec => ({
                  Month: monthLabel(rec.month),
                  "Base Salary (₹)": Number(rec.baseSalary || 0),
                  "Advance (₹)": Number(rec.advance || 0),
                  "Deduction (₹)": Number(rec.deduction || 0),
                  "Penalty (₹)": Number(rec.penalty || 0),
                  "Bonus (₹)": Number(rec.bonus || 0),
                  "Overtime (₹)": Number(rec.overtime || 0),
                  "Final Paid (₹)": Number(rec.remaining || 0),
                }));
                if (!rows.length) { toast.warning("No history to export"); return; }
                exportToExcel({ rows, sheetName: "Salary History", fileName: `salary_history_${selected.name || selected.id}.xlsx` });
              }}>Export History</Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}