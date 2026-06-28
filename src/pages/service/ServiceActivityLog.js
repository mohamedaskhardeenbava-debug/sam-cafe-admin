/**
 * ServiceActivityLog.js  —  Sam Cafe Admin Panel
 * Service activity log (thin wrapper around ActivityLog)
 */

import ActivityLog from "../../components/ActivityLog";

import "./ServiceActivityLog.css";

export default function ServiceActivityLog({ adminData }) {
  return (
    <ActivityLog
      title="Service Activity Log"
      items={adminData?.serviceActivity || []}
      exportFilePrefix="service_activity"
    />
  );
}
