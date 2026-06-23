/**
 * useStatusUpdate
 * ─────────────────────────────────────────────────────────────
 * Custom hook that encapsulates the pattern used in every event /
 * booking detail page:
 *   1. Optimistically update local status
<<<<<<< HEAD
 *   2. PATCH (or fall back to PUT) to the API
=======
 *   2. PATCH the new status to the API
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
 *   3. Sync back to adminData via setAdminData
 *   4. Toast success / error
 *
 * USAGE
 * -----
 * import useStatusUpdate from "../../hooks/useStatusUpdate";
 *
 * const { localStatus, saving, handleStatusChange } = useStatusUpdate({
 *   id,
<<<<<<< HEAD
 *   data,                        // the current record object
=======
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
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
<<<<<<< HEAD
  data,
=======
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7
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
<<<<<<< HEAD
      /* Try PATCH first (json-server 0.x only supports PUT) */
      try {
        await api.patch(`${apiPath}/${id}`, { status: newStatus });
      } catch {
        await api.put(`${apiPath}/${id}`, { ...data, status: newStatus });
      }
=======
      await api.patch(`${apiPath}/${id}`, { status: newStatus });
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7

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
