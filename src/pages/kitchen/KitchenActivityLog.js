/**
 * KitchenActivityLog.js  —  Sam Cafe Admin Panel
 * Kitchen activity log (thin wrapper around ActivityLog)
 */

import ActivityLog from "../../components/ActivityLog";

import "./KitchenActivityLog.css";

export default function KitchenActivityLog({ adminData }) {
  return (
    <ActivityLog
      title="Kitchen Activity Log"
      items={adminData?.kitchenActivity || []}
      exportFilePrefix="kitchen_activity"
    />
  );
}
