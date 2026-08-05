/**
 * AuditLogs.js  —  Sam Cafe Admin Panel
 * Audit log viewer — Super Admin only. Shows who did what, and when:
 * logins/logouts, and every create/update/delete across every module.
 * Clicking "Details" navigates to /audit-logs/:id (AuditLogDetails.js)
 * for the full before/after diff, rather than expanding inline.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useVenue } from "../context/VenueContext";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import CollapseChevron from "../components/CollapseChevron";
import PageLoader from "../components/PageLoader";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import { FilterBar } from "../components/FilterBar";
import { allowTextInput, EmptyRow } from "../App";

import "./AuditLogs.css";

const ACTION_LABELS = {
  login: "Login",
  logout: "Logout",
  login_failed: "Login Failed",
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

const STATUS_OPTIONS = [
  ["positive", "Success"],
  ["negative", "Failed/Deleted"],
];

const EMPTY_FILTERS = {
  resource: "",
  action: "",
  venueId: "",
  status: "",
  who: "",
  target: "",
  from: "",
  to: "",
  fromTime: "",
  toTime: "",
};

// Who / Module / Target are combined into a single search box on the
// frontend; the same text is sent to all three backend params so it
// matches whichever field it appears in (each is an independent
// case-insensitive regex server-side).
const searchToFilters = (text) => ({ who: text, resource: text, target: text });

const AuditLogs = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { venues } = useVenue();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const patchFilters = (patch) => setFilters((p) => ({ ...p, ...patch }));
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const params = { limit: 500 };
      if (filters.resource) params.resource = filters.resource;
      if (filters.action) params.action = filters.action;
      if (filters.venueId) params.venueId = filters.venueId;
      if (filters.status) params.status = filters.status;
      if (filters.who) params.who = filters.who;
      if (filters.target) params.target = filters.target;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.fromTime) params.fromTime = filters.fromTime;
      if (filters.toTime) params.toTime = filters.toTime;
      const res = await api.get("/audit-logs", { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const venueNameFor = (id) => venues.find((v) => v.id === id)?.name || (id ? id : "—");

  const filtersActive = Object.values(filters).some(Boolean);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(logs.length, 30);

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can view audit logs.
        </div>
      </div>
    );
  }

  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading audit logs…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setFiltersCollapsed((c) => !c)}
              title={filtersCollapsed ? "Show filters" : "Hide filters"}
              aria-expanded={!filtersCollapsed}
            >
              <CollapseChevron collapsed={filtersCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Audit Logs</h2>
              <span className="result-count">{total} entr{total === 1 ? "y" : "ies"}</span>
            </div>
          </div>
        </div>
      </div>

      {!filtersCollapsed && (
        <FilterBar
          dateRange={{
            from: filters.from,
            to: filters.to,
            onChangeFrom: (v) => patchFilters({ from: v }),
            onChangeTo: (v) => patchFilters({ to: v }),
            showPresets: false,
            noMax: true,
            fromLabel: "Start Date",
            toLabel: "End Date",
          }}
          timeRange={{
            from: filters.fromTime,
            to: filters.toTime,
            onChangeFrom: (v) => patchFilters({ fromTime: v }),
            onChangeTo: (v) => patchFilters({ toTime: v }),
            fromLabel: "Start Time",
            toLabel: "End Time",
          }}
          groups={[
            { label: "Status", options: STATUS_OPTIONS, value: filters.status, onChange: (v) => patchFilters({ status: v }) },
          ]}
          onClear={() => setFilters(EMPTY_FILTERS)}
          active={filtersActive}
          rightContent={
            <>
              <CustomDropdown
                label="Action"
                value={filters.action}
                onChange={(val) => patchFilters({ action: val })}
                options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
                placeholder="All actions"
              />
              <CustomDropdown
                label="Venue"
                value={filters.venueId}
                onChange={(val) => patchFilters({ venueId: val })}
                options={venues.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="All venues"
              />
              <input
                className="search-input"
                placeholder=" Search who, module, or target…"
                value={filters.who}
                onChange={(e) => {
                  const v = allowTextInput(filters.who, e.target.value, 100, 5);
                  patchFilters(searchToFilters(v));
                }}
              />
            </>
          }
        />
      )}

      <div
        className="table-wrapper"
        ref={containerRef}
        style={{ maxHeight: filtersCollapsed ? "calc(100vh - 120px)" : "calc(100vh - 260px)" }}
      >
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Venue</th>
              <th>Action</th>
              <th>Module</th>
              <th>Target</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" style={{ padding: 0 }}>
                  <PageLoader inline label="Loading…" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <EmptyRow colSpan={7} message="No audit entries match your filters." />
            ) : (
              <>
                {logs.slice(0, displayLimit).map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      {log.adminName || "—"}
                      {log.adminRoleTitle ? <span className="audit-who-role"> · {log.adminRoleTitle}</span> : null}
                    </td>
                    <td>{venueNameFor(log.venueId)}</td>
                    <td>
                      <span
                        className={`audit-status-badge ${log.action === "delete" || log.action === "login_failed" ? "audit-status-negative" : "audit-status-positive"}`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td>{log.resource}</td>
                    <td>{log.targetId || "—"}</td>
                    <td>
                      {(log.before || log.after) && (
                        <Button3D variant="cancel" onClick={() => navigate(`/audit-logs/${log.id}`)}>
                          Details
                        </Button3D>
                      )}
                    </td>
                  </tr>
                ))}
                <InfiniteScrollLoader sentinelRef={sentinelRef} hasMore={hasMore} colSpan={7} />
              </>
            )}
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
    </div>
  );
};

export default AuditLogs;
