/**
 * KitchenActivityLog.js  (refactored)
 *
 * Now a thin wrapper around the shared <ActivityLog> component.
 * All filter / search / export logic lives in ActivityLog.jsx.
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
