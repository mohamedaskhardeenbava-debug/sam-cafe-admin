/**
 * crudUtils.js  —  Sam Cafe Admin Panel
 *
 * Three generic async helpers that every page uses for CREATE, UPDATE, DELETE.
 * Each helper follows the same contract:
 *
 *   - Optimistic UI update on DELETE (revert on failure)
 *   - Dedup guard on CREATE  (socket echo is a safe no-op)
 *   - Always reads the freshest item from adminDataRef (not stale closure)
 *   - toast.confirm() gating for DELETE
 *   - Returns { ok: true } on success, { ok: false, error } on failure
 *
 * ──────────────────────────────────────────────────────────────────────────
 * USAGE  (see per-function JSDoc for full parameter list)
 *
 *   import { createRecord, updateRecord, deleteRecord } from "../../utils/crudUtils";
 *
 *   // CREATE
 *   createRecord({
 *     api,
 *     toast,
 *     endpoint:      "/ingredients",
 *     payload:       { id: "ing_abc", name: "Salt", ... },
 *     stateKey:      "ingredients",       // key inside adminData
 *     setAdminData,
 *     successMsg:    "Ingredient added",
 *     errorMsg:      "Failed to add ingredient",
 *     onSuccess:     resetForm,           // optional callback
 *   });
 *
 *   // UPDATE
 *   updateRecord({
 *     api,
 *     toast,
 *     endpoint:      `/ingredients/${id}`,
 *     payload:       updatedIngredient,
 *     stateKey:      "ingredients",
 *     setAdminData,
 *     successMsg:    "Ingredient updated",
 *     errorMsg:      "Failed to update ingredient",
 *     onSuccess:     resetForm,
 *   });
 *
 *   // DELETE
 *   deleteRecord({
 *     api,
 *     toast,
 *     endpoint:      `/ingredients/${id}`,
 *     item,                               // the full item object being deleted
 *     stateKey:      "ingredients",
 *     adminData,
 *     setAdminData,
 *     confirmMsg:    `Delete "${item.name}"?`,
 *     successMsg:    "Ingredient deleted",
 *     errorMsg:      "Failed to delete ingredient",
 *     onSuccess:     () => {},            // optional callback
 *   });
 * ──────────────────────────────────────────────────────────────────────────
 */

// ─── CREATE ────────────────────────────────────────────────────────────────

/**
 * POST a new record to the server and append it to adminData[stateKey].
 *
 * @param {object}   p
 * @param {object}   p.api            – axios instance (from api.js)
 * @param {object}   p.toast          – useToast() toast object
 * @param {string}   p.endpoint       – e.g. "/ingredients"
 * @param {object}   p.payload        – full record to POST (must have .id)
 * @param {string}   p.stateKey       – key inside adminData, e.g. "ingredients"
 * @param {function} p.setAdminData   – React setter
 * @param {string}   [p.successMsg]   – toast on success   (default: "Added")
 * @param {string}   [p.errorMsg]     – toast on failure   (default: "Failed to add")
 * @param {function} [p.onSuccess]    – callback after success (reset form, close modal…)
 * @returns {Promise<{ok:boolean, data?:object, error?:any}>}
 */
export async function createRecord({
  api,
  toast,
  endpoint,
  payload,
  stateKey,
  setAdminData,
  successMsg = "Added",
  errorMsg   = "Failed to add",
  onSuccess,
}) {
  try {
    const res  = await api.post(endpoint, payload);
    // Prefer server-returned document; fall back to what we sent.
    const saved = { ...(res.data || payload), id: payload.id };

    setAdminData(prev => {
      // Dedup: socket echo may arrive before this state update resolves.
      const alreadyExists = (prev[stateKey] || []).some(
        item => String(item.id) === String(saved.id)
      );
      if (alreadyExists) return prev;
      return { ...prev, [stateKey]: [...(prev[stateKey] || []), saved] };
    });

    toast.success(successMsg);
    onSuccess?.();
    return { ok: true, data: saved };

  } catch (error) {
    console.error(`[createRecord] ${endpoint}:`, error);
    toast.error(errorMsg);
    return { ok: false, error };
  }
}

// ─── UPDATE ────────────────────────────────────────────────────────────────

/**
 * PUT a record and patch it in-place inside adminData[stateKey].
 *
 * For partial updates (PATCH), just pass { method: "patch" }.
 *
 * @param {object}   p
 * @param {object}   p.api            – axios instance
 * @param {object}   p.toast          – useToast() toast object
 * @param {string}   p.endpoint       – e.g. "/ingredients/ing_abc"
 * @param {object}   p.payload        – full updated record (must have .id)
 * @param {string}   p.stateKey       – key inside adminData
 * @param {function} p.setAdminData   – React setter
 * @param {string}   [p.method]       – "put" (default) | "patch"
 * @param {string}   [p.successMsg]
 * @param {string}   [p.errorMsg]
 * @param {function} [p.onSuccess]
 * @returns {Promise<{ok:boolean, data?:object, error?:any}>}
 */
export async function updateRecord({
  api,
  toast,
  endpoint,
  payload,
  stateKey,
  setAdminData,
  method      = "put",
  successMsg  = "Updated",
  errorMsg    = "Failed to update",
  onSuccess,
}) {
  try {
    const res  = await api[method](endpoint, payload);
    const saved = { ...(res.data || payload), id: payload.id };

    setAdminData(prev => ({
      ...prev,
      [stateKey]: (prev[stateKey] || []).map(item =>
        String(item.id) === String(saved.id) ? saved : item
      ),
    }));

    toast.success(successMsg);
    onSuccess?.();
    return { ok: true, data: saved };

  } catch (error) {
    console.error(`[updateRecord] ${endpoint}:`, error);
    toast.error(errorMsg);
    return { ok: false, error };
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────────

/**
 * Confirm → optimistic removal → DELETE → revert on failure.
 *
 * The confirmation dialog is shown via toast.confirm(). The DELETE only fires
 * after the user clicks "Yes". On failure the row is restored to its original
 * position in the list.
 *
 * @param {object}   p
 * @param {object}   p.api            – axios instance
 * @param {object}   p.toast          – useToast() toast object
 * @param {string}   p.endpoint       – e.g. "/ingredients/ing_abc"
 * @param {object}   p.item           – the full record being deleted (must have .id)
 * @param {string}   p.stateKey       – key inside adminData
 * @param {object}   p.adminData      – current adminData (for snapshot + index)
 * @param {function} p.setAdminData   – React setter
 * @param {string}   [p.confirmMsg]   – text shown in the confirm dialog
 * @param {string}   [p.successMsg]
 * @param {string}   [p.errorMsg]
 * @param {function} [p.onSuccess]    – runs after successful delete
 */
export function deleteRecord({
  api,
  toast,
  endpoint,
  item,
  stateKey,
  adminData,
  setAdminData,
  confirmMsg  = "Delete this item?",
  successMsg  = "Deleted",
  errorMsg    = "Failed to delete",
  onSuccess,
}) {
  // Snapshot the index NOW (at click time) so the revert can restore the
  // row to its original position, not appended to the end.
  const list          = adminData[stateKey] || [];
  const originalIndex = list.findIndex(i => String(i.id) === String(item.id));

  toast.confirm(confirmMsg, async () => {
    // ── Optimistic removal ──────────────────────────────────────────────
    setAdminData(prev => ({
      ...prev,
      [stateKey]: (prev[stateKey] || []).filter(
        i => String(i.id) !== String(item.id)
      ),
    }));

    try {
      await api.delete(endpoint);
      toast.success(successMsg);
      onSuccess?.();

    } catch (error) {
      // ── Revert at original position ─────────────────────────────────
      console.error(`[deleteRecord] ${endpoint}:`, error);
      setAdminData(prev => {
        const next      = [...(prev[stateKey] || [])];
        const insertAt  = Math.min(originalIndex, next.length);
        next.splice(insertAt, 0, item);
        return { ...prev, [stateKey]: next };
      });
      toast.error(errorMsg);
    }
  });
}
