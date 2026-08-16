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

import { CustomDatePicker } from "./CustomDatePicker";
import { DateRangeGroup, PillGroup } from "./FilterBar";
import { resolveDateRange, todayStr } from "../utils/dateRangeUtils";
import { exportToExcel } from "../utils/excelUtils";

import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";
import { allowTextInput } from "../App";

/* Period presets: [key, label]. "all" resolves to a wide-open range
   (rather than empty strings) because this page's filter uses
   d >= fromDate && d <= toDate directly. */
const PERIOD_PRESETS = [
  ["all", "All"],
  ["today", "Today"],
  ["week", "This Week"],
  ["month", "This Month"],
  ["lastMonth", "Last Month"],
];
const resolveActivityLogRange = (key) => {
  if (key === "all") return ["2000-01-01", "2099-12-31"];
  return resolveDateRange(key);
};

const ActivityLog = ({ title, items = [], exportFilePrefix }) => {
  const { toast } = useToast();
  const today = todayStr();

  const [fromDate, setFromDate] = useState("2000-01-01");
  const [toDate, setToDate] = useState("2099-12-31");
  const [activePreset, setActivePreset] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

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

  const applyPreset = (key) => {
    const [f, t] = resolveActivityLogRange(key);
    setFromDate(f);
    setToDate(t);
    setActivePreset(key);
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
              <h2 className="title">{title}</h2>
              <span className="result-count">{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</span>
            </div>
          </div>
        </div>
        <Button3D onClick={handleExport}>Export</Button3D>
      </div>

      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-group">
            <input
              className="search-input"
              placeholder=" Search work / staff…"
              value={searchText}
              onChange={(e) => setSearchText(allowTextInput(searchText, e.target.value, 100, 5))}
            />

            <div className="filter-group">
              <DateRangeGroup
                from={fromDate}
                to={toDate}
                onChangeFrom={setFromDate}
                onChangeTo={setToDate}
                preset={activePreset}
                onChangePreset={setActivePreset}
                presets={PERIOD_PRESETS}
                fromLabel="from"
                toLabel="to"
                pickerFromLabel="From"
                pickerToLabel="To"
                max={today}
                showPresets={false}
                pickerLabels
              />
            </div>

            <PillGroup
              label="period"
              options={PERIOD_PRESETS}
              value={activePreset}
              onChange={applyPreset}
              toggle={false}
            />
          </div>
        </div>
      )}

      <div className="table-wrapper" >
        <table className="table">
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
                <tr key={`${item.id ?? ""}-${i}`}>
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