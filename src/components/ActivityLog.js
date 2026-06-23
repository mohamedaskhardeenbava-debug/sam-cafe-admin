/**
 * ActivityLog
 * ─────────────────────────────────────────────────────────────
 * Generic activity-log page used by both KitchenActivityLog and
 * ServiceActivityLog. The two pages were 100% identical apart
 * from their title, the adminData key, and the export filename.
 *
 * USAGE
 * ─────
 * // KitchenActivityLog.js
 * import ActivityLog from "../../components/ActivityLog";
 * export default function KitchenActivityLog({ adminData }) {
 *   return (
 *     <ActivityLog
 *       title="Kitchen Activity Log"
 *       items={adminData?.kitchenActivity || []}
 *       exportFilePrefix="kitchen_activity"
 *     />
 *   );
 * }
 *
 * // ServiceActivityLog.js
 * import ActivityLog from "../../components/ActivityLog";
 * export default function ServiceActivityLog({ adminData }) {
 *   return (
 *     <ActivityLog
 *       title="Service Activity Log"
 *       items={adminData?.serviceActivity || []}
 *       exportFilePrefix="service_activity"
 *     />
 *   );
 * }
 */

import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { CustomDatePicker } from "./CustomDatePicker";
import { exportToExcel } from "../utils/excelUtils";
import { useToast } from "../useToast";

const PRESETS = [
  { label: "All", getRange: () => ["2000-01-01", "2099-12-31"] },
  {
    label: "Today",
    getRange: () => {
      const t = format(new Date(), "yyyy-MM-dd");
      return [t, t];
    },
  },
  {
    label: "This Month",
    getRange: () => {
      const d = new Date();
      return [
        format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd"),
        format(new Date(), "yyyy-MM-dd"),
      ];
    },
  },
];

const ActivityLog = ({ title, items = [], exportFilePrefix }) => {
  const { toast } = useToast();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [fromDate, setFromDate] = useState("2000-01-01");
  const [toDate, setToDate] = useState("2099-12-31");
  const [activePreset, setActivePreset] = useState("All");
  const [searchText, setSearchText] = useState("");

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const d = item.date || "";
        const matchDate = d >= fromDate && d <= toDate;
        const q = searchText.toLowerCase();
        const matchSearch =
          !q ||
          (item.work || "").toLowerCase().includes(q) ||
          (item.staff || "").toLowerCase().includes(q);
        return matchDate && matchSearch;
      }),
    [items, fromDate, toDate, searchText]
  );

  const applyPreset = (preset) => {
    const [f, t] = preset.getRange();
    setFromDate(f);
    setToDate(t);
    setActivePreset(preset.label);
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.warning("No activity data to export");
      return;
    }
    const rows = filtered.map((item) => ({
      Work: item.work || "—",
      Staff: item.staff || "—",
      Date: item.date || "—",
    }));
    const ok = exportToExcel({
      rows,
      sheetName: title,
      fileName: `${exportFilePrefix}_${fromDate}_to_${toDate}.xlsx`,
    });
    if (!ok) toast.warning("No data to export");
  };

  return (
    <div className="activity-page">
      <div className="activity-header">
        <h2 className="activity-title">{title}</h2>
        <button className="modal-save-btn" onClick={handleExport}>
          <span className="shadow" />
          <span className="edge" />
          <span className="front">Export</span>
        </button>
      </div>

      <div className="activity-filter-bar">
        <input
          className="search-input"
          placeholder=" Search work / staff…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <CustomDatePicker
          label="From"
          value={fromDate}
          max={toDate}
          onChange={(s) => {
            setFromDate(s);
            if (s > toDate) setToDate(s);
            setActivePreset("custom");
          }}
        />
        <CustomDatePicker
          label="To"
          value={toDate}
          min={fromDate}
          max={todayStr}
          onChange={(s) => {
            setToDate(s);
            setActivePreset("custom");
          }}
        />
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`filter-pill${activePreset === p.label ? " active" : ""}`}
            onClick={() => applyPreset(p)}
          >
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
              <tr>
                <td colSpan="3" style={{ textAlign: "center", color: "#aaa" }}>
                  No activity found
                </td>
              </tr>
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
};

export default ActivityLog;
