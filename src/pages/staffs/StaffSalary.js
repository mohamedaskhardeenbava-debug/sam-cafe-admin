/**
 * StaffSalary.js  —  Sam Cafe Admin Panel
 * Staff salary management page
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

import "./StaffModules.css";

export default function StaffSalary({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();

  const [selected, setSelected] = useState(null);
  const salaryModal = useAnimatedModal("staffSalary-detail");
  const [staffList, setStaffList] = useState(adminData.staff);
  const [salarySearch, setSalarySearch] = useState("");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [form, setForm] = useState({
    advance: 0,
    deduction: 0,
    penalty: 0,
    bonus: 0,
    overtime: 0
  });

  useEffect(() => {
    setStaffList(adminData.staff);
  }, [adminData.staff]);

  const currentMonth = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const openModal = (staff) => {
    setSelected(staff);
    salaryModal.open();

    // Use the last saved record as the starting values (absolute, not
    // cumulative) — but only if it's from the current month. Advance,
    // deduction, penalty, bonus, and overtime are per-month figures (the
    // server also zeroes them out on the 1st of each month), so a record
    // still carrying last month's stamp is treated as already reset here
    // too, rather than showing stale numbers for the gap before the
    // server's own periodic check catches up.
    const history = staff.remainingSalary || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;
    const isCurrentMonth = latest?.month === currentMonth();

    setForm({
      advance: isCurrentMonth ? Number(latest?.advance || 0) : 0,
      deduction: isCurrentMonth ? Number(latest?.deduction || 0) : 0,
      penalty: isCurrentMonth ? Number(latest?.penalty || 0) : 0,
      bonus: isCurrentMonth ? Number(latest?.bonus || 0) : 0,
      overtime: isCurrentMonth ? Number(latest?.overtime || 0) : 0,
    });
  };

  // ── Handlers

  const closeModal = () => salaryModal.close(() => setSelected(null));

  const handleSave = async () => {
    const advance = Number(form.advance || 0);
    const deduction = Number(form.deduction || 0);
    const penalty = Number(form.penalty || 0);
    const bonus = Number(form.bonus || 0);
    const overtime = Number(form.overtime || 0);

    const remaining =
      Number(selected.salary) +
      bonus +
      overtime -
      advance -
      deduction -
      penalty;

    const record = { advance, deduction, penalty, bonus, overtime, remaining, month: currentMonth() };

    const updated = {
      ...selected,
      salaryRemaining: remaining,
      remainingSalary: [record],   // single source-of-truth record
    };

    try {
      const res = await api.put(`/staff/${selected.id}`, updated);

      setStaffList(prev =>
        prev.map(s =>
          s.id === selected.id ? res.data : s
        )
      );

      if (setAdminData) {
        setAdminData(prev => ({
          ...prev,
          staff: prev.staff.map(s =>
            s.id === selected.id ? res.data : s
          )
        }));
      }

      toast.success("Salary updated");

    } catch (err) {
      console.error("Salary update failed:", err);
      toast.error("Failed to update salary");
    }

    closeModal();
  };

  // Reads a staff member's current salary add-on/deduction record, but
  // treats one stamped with a past month as already reset to zero for
  // display — the server clears these for real shortly after the month
  // rolls over, but this keeps the table from showing stale figures in
  // the meantime.
  const effectiveRecord = (staff) => {
    const rec = (staff.remainingSalary || [])[0] || {};
    if (rec.month && rec.month !== currentMonth()) {
      return { advance: 0, deduction: 0, penalty: 0, bonus: 0, overtime: 0 };
    }
    return rec;
  };

  const filteredList = salarySearch.trim()
    ? staffList.filter(s =>
      (s.name || "").toLowerCase().includes(salarySearch.toLowerCase()) ||
      (s.role || "").toLowerCase().includes(salarySearch.toLowerCase())
    )
    : staffList;

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
          const rows = filteredList.map((s, i) => {
            const rec = effectiveRecord(s);
            const totalAdvance = Number(rec.advance || 0);
            const totalDeduction = Number(rec.deduction || 0);
            const totalPenalty = Number(rec.penalty || 0);
            const totalBonus = Number(rec.bonus || 0);
            const totalOvertime = Number(rec.overtime || 0);
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
          if (!rows.length) { toast.warning("No salary data to export"); return; }
          exportToExcel({ rows, sheetName: "Salary", fileName: `salary_${new Date().toISOString().slice(0, 10)}.xlsx` });
        }}>Export</Button3D>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="justify">
            <input
              className="search-input"
              placeholder=" Search name or role…"
              value={salarySearch}
              onChange={e => setSalarySearch(allowTextInput(salarySearch, e.target.value, 100, 5))}
            />
            {salarySearch && (
              <button className="ae-clear-filter" onClick={() => setSalarySearch("")}>Clear</button>
            )}
          </div>
        </div>
      )}

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
              <th className="icon-width">Edit</th>
            </tr>
          </thead>

          <tbody>
            {filteredList.length === 0 ? (
              <EmptyRow colSpan={9} message="No staff available" />
            ) : (
              filteredList.slice(0, displayLimit).map((s, i) => {
              const PALETTE = ["#4361ee", "#06d6a0", "#ffd166", "#ef476f", "#7209b7", "#4cc9f0", "#f72585", "#3a0ca3", "#fb8500", "#023e8a"];
              const avatarBg = PALETTE[i % PALETTE.length];

              // Single record — read the latest (or only) entry, zeroed
              // out for display if it's stamped with a past month.
              const rec = effectiveRecord(s);
              const totalAdvance = Number(rec.advance || 0);
              const totalDeduction = Number(rec.deduction || 0);
              const totalPenalty = Number(rec.penalty || 0);
              const totalBonus = Number(rec.bonus || 0);
              const totalOvertime = Number(rec.overtime || 0);
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
                  <td className="icon-width">
                    <Button3D variant="cancel" iconOnly onClick={() => openModal(s)}><img src={editIcon} alt="" /></Button3D>
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
      {salaryModal.shouldRender && (
        <div className={`modal-overlay ${salaryModal.overlayClass}`}>
          <div className={`admin-modal ${salaryModal.modalClass}`}>

            <div className="admin-modal-header">
              <h3>{selected.name}</h3>
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
    </div>
  );
}