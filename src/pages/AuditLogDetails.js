/**
 * AuditLogDetails.js  —  Sam Cafe Admin Panel
 * Full-page view of a single audit log entry, reached by clicking
 * "Details" on a row in AuditLogs.js. Shows the who/when/what summary
 * plus the same field-level before/after diff that used to expand
 * inline in the table, now on its own page (GET /audit-logs/:id).
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";
import { useVenue } from "../context/VenueContext";
import { useToast } from "../useToast";

import "./AuditLogDetails.css";

const ACTION_LABELS = {
  login: "Login",
  logout: "Logout",
  login_failed: "Login Failed",
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

const DIFF_IGNORE_KEYS = new Set(["_id", "__v", "updatedAt", "createdAt"]);

function valuesEqual(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function diffLog(log) {
  const before = log.before || null;
  const after = log.after || null;
  if (!before && !after) return [];

  if (before && !after) {
    return Object.keys(before)
      .filter((k) => !DIFF_IGNORE_KEYS.has(k))
      .map((key) => ({ key, kind: "removed", from: before[key] }));
  }

  if (!before && after) {
    return Object.keys(after)
      .filter((k) => !DIFF_IGNORE_KEYS.has(k))
      .map((key) => ({ key, kind: "added", to: after[key] }));
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes = [];
  for (const key of keys) {
    if (DIFF_IGNORE_KEYS.has(key)) continue;
    const from = before[key];
    const to = after[key];
    if (!valuesEqual(from, to)) {
      if (from === undefined) changes.push({ key, kind: "added", to });
      else if (to === undefined) changes.push({ key, kind: "removed", from });
      else changes.push({ key, kind: "changed", from, to });
    }
  }
  return changes;
}

function formatDiffValue(v) {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "object") {
    const s = JSON.stringify(v, null, 2);
    return s.length > 400 ? s.slice(0, 397) + "…" : s;
  }
  const s = String(v);
  return s.length > 400 ? s.slice(0, 397) + "…" : s;
}

const AuditLogDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { venues } = useVenue();

  const [log, setLog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await api.get(`/audit-logs/${id}`);
        if (!cancelled) setLog(res.data);
      } catch (err) {
        if (!cancelled) {
          if (err?.response?.status === 404) setNotFound(true);
          else toast.error("Failed to load audit log entry");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const venueNameFor = (vid) => venues.find((v) => v.id === vid)?.name || (vid ? vid : "—");

  if (isLoading) {
    return (
      <div className="details-container">
        <div className="ald-container">
          <div className="details-header">
            <button className="back-btn" onClick={() => navigate(-1)} />
            <h2>Audit Log Detail</h2>
          </div>
          <p className="ald-loading">Loading…</p>
        </div>
      </div>
    );
  }

  if (notFound || !log) {
    return (
      <div className="details-container">
        <div className="ald-container">
          <div className="details-header">
            <button className="back-btn" onClick={() => navigate(-1)} />
            <h2>Audit Log Detail</h2>
          </div>
          <p className="ald-loading">Audit log entry not found.</p>
        </div>
      </div>
    );
  }

  const changes = diffLog(log);
  const isNegative = log.action === "delete" || log.action === "login_failed";

  return (
    <div className="details-container">
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <h2>Audit Log Detail</h2>
        <span className={`audit-status-badge ald-header-badge ${isNegative ? "audit-status-negative" : "audit-status-positive"}`}>
          {ACTION_LABELS[log.action] || log.action}
        </span>
      </div>

      <div className="details-body">
        <div className="ald-summary-grid">
          <div className="ald-summary-item">
            <span className="ald-summary-label">When</span>
            <span className="ald-summary-value">{new Date(log.createdAt).toLocaleString()}</span>
          </div>
          <div className="ald-summary-item">
            <span className="ald-summary-label">Who</span>
            <span className="ald-summary-value">
              {log.adminName || "—"}
              {log.adminRoleTitle ? <span className="audit-who-role"> · {log.adminRoleTitle}</span> : null}
            </span>
          </div>
          <div className="ald-summary-item">
            <span className="ald-summary-label">Venue</span>
            <span className="ald-summary-value">{venueNameFor(log.venueId)}</span>
          </div>
          <div className="ald-summary-item">
            <span className="ald-summary-label">Module</span>
            <span className="ald-summary-value">{log.resource || "—"}</span>
          </div>
          <div className="ald-summary-item">
            <span className="ald-summary-label">Target</span>
            <span className="ald-summary-value">{log.targetId || "—"}</span>
          </div>
          {log.ip && (
            <div className="ald-summary-item">
              <span className="ald-summary-label">IP Address</span>
              <span className="ald-summary-value">{log.ip}</span>
            </div>
          )}
          {log.userAgent && (
            <div className="ald-summary-item ald-summary-item-wide">
              <span className="ald-summary-label">User Agent</span>
              <span className="ald-summary-value ald-summary-value-small">{log.userAgent}</span>
            </div>
          )}
        </div>

        <div className="ald-diff-section">
          <h3 className="ald-diff-heading">What changed</h3>
          {changes.length === 0 ? (
            <p className="audit-diff-empty">No field-level changes recorded for this entry.</p>
          ) : (
            <table className="audit-diff-table ald-diff-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.key} className={`audit-diff-row audit-diff-${c.kind}`}>
                    <td className="audit-diff-key">{c.key}</td>
                    <td className="audit-diff-value">
                      {c.kind === "added" ? <span className="audit-diff-dash">—</span> : formatDiffValue(c.from)}
                    </td>
                    <td className="audit-diff-value">
                      {c.kind === "removed" ? <span className="audit-diff-dash">—</span> : formatDiffValue(c.to)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogDetails;
