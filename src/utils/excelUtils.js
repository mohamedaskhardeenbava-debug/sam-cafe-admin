/**
 * excelUtils.js
 * ─────────────────────────────────────────────────────────────
 * All SheetJS / XLSX helpers for the admin panel.
 *
 * TWO EXPORTS
 * ───────────
 *
 * 1. exportToExcel({ rows, sheetName, fileName })
 *    Single-sheet export — the common case.
 *    Returns false when rows is empty so the caller can toast a warning.
 *
 * 2. exportMultiSheet({ sheets, fileName })
 *    Multi-sheet export (Dashboard, KitchenReports, ServiceReports).
 *    sheets = [{ name: "Orders", rows: [...] }, { name: "Staff", rows: [...] }, ...]
 *    Sheets with zero rows are silently skipped.
 *    Returns false when every sheet is empty.
 *
 * USAGE — single sheet
 * ──────────────────────
 *   import { handleExport} from "../utils/excelUtils";
 *
 *   const ok = exportToExcel({
 *     rows: filteredUsers.map((u, i) => ({ "#": i + 1, Name: u.name })),
 *     sheetName: "Users",
 *     fileName: `users_${todayStr()}.xlsx`,
 *   });
 *   if (!ok) toast.warning("No data to export");
 *
 * USAGE — multi sheet
 * ──────────────────────
 *   import { exportMultiSheet } from "../utils/excelUtils";
 *
 *   exportMultiSheet({
 *     sheets: [
 *       { name: "Attendance", rows: attRows },
 *       { name: "Grooming",   rows: groomRows },
 *     ],
 *     fileName: `kitchen_report_${today}.xlsx`,
 *   });
 */

import * as XLSX from "xlsx";

/* ── Internal: set auto-width columns on a worksheet ── */
const applyAutoWidth = (sheet, rows) => {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  sheet["!cols"] = keys.map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2,
  }));
};

/**
 * Single-sheet export.
 * @returns {boolean} false when rows is empty (caller should toast a warning)
 */
export const exportToExcel = ({ rows, sheetName = "Sheet1", fileName }) => {
  if (!rows || rows.length === 0) return false;

  const sheet = XLSX.utils.json_to_sheet(rows);
  applyAutoWidth(sheet, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  XLSX.writeFile(wb, fileName);
  return true;
};

/**
 * Multi-sheet export.
 * @param {{ sheets: Array<{ name: string, rows: object[] }>, fileName: string }} opts
 * @returns {boolean} false when every sheet is empty
 */
export const exportMultiSheet = ({ sheets, fileName }) => {
  const wb = XLSX.utils.book_new();
  let hasData = false;

  sheets.forEach(({ name, rows }) => {
    if (!rows || rows.length === 0) return;
    const sheet = XLSX.utils.json_to_sheet(rows);
    applyAutoWidth(sheet, rows);
    XLSX.utils.book_append_sheet(wb, sheet, name);
    hasData = true;
  });

  if (!hasData) return false;
  XLSX.writeFile(wb, fileName);
  return true;
};
