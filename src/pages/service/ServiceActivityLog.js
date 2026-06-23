/**
 * ServiceActivityLog.js  (refactored)
 *
 * Now a thin wrapper around the shared <ActivityLog> component.
 * All filter / search / export logic lives in ActivityLog.jsx.
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
