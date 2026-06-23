/**
 * useStatusUpdate
 * ─────────────────────────────────────────────────────────────
 * Custom hook that encapsulates the pattern used in every event /
 * booking detail page:
 *   1. Optimistically update local status
 *   2. PATCH the new status to the API
 *   3. Sync back to adminData via setAdminData
 *   4. Toast success / error
 *
 * USAGE
 * -----
 * import useStatusUpdate from "../../hooks/useStatusUpdate";
 *
 * const { localStatus, saving, handleStatusChange } = useStatusUpdate({
 *   id,
 *   apiPath: "/cateringOrders",  // e.g. "/reservations", "/celebrations"
 *   adminDataKey: "cateringOrders",
 *   setAdminData,
 *   initialStatus: data?.status || "pending",
 * });
 */

import { useState } from "react";
import api from "../api";
import { useToast } from "../useToast";

const useStatusUpdate = ({
  id,
  apiPath,
  adminDataKey,
  setAdminData,
  initialStatus = "pending",
}) => {
  const { toast } = useToast();
  const [localStatus, setLocalStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    try {
      await api.patch(`${apiPath}/${id}`, { status: newStatus });

      setLocalStatus(newStatus);
      toast.success(`Status updated to ${newStatus}.`);

      if (typeof setAdminData === "function") {
        setAdminData((prev) => ({
          ...prev,
          [adminDataKey]: (prev[adminDataKey] || []).map((item) =>
            item.id === id ? { ...item, status: newStatus } : item
          ),
        }));
      }
    } catch (err) {
      console.error("Status update failed", err);
      toast.error("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return { localStatus, saving, handleStatusChange };
};

export default useStatusUpdate;
