/**
 * printUtils.js
 * Shared helper for triggering KOT / Bill prints over the existing
 * socket.io connection to the Render backend. Use in both the admin
 * panel and the user panel — wherever `socket` is your connected
 * socket.io-client instance (the same one used for bell-ring, theme
 * updates, etc.).
 *
 * Usage:
 *   import { sendPrintJob, checkPrinterStatus } from "./printUtils";
 *
 *   const result = await sendPrintJob(socket, "kot", order);
 *   if (result.success) toast.success(result.message);
 *   else toast.error(result.error);
 */

function generateJobId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Sends a print job ("kot" | "bill" | "test") over the socket and
 * resolves with { success, message?, error? } once the backend
 * relays the bridge's result (or a client-side timeout occurs).
 */
export function sendPrintJob(socket, jobType, order, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ success: false, error: "Not connected to server" });
      return;
    }

    const jobId = generateJobId();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.off("printer:result", onResult);
      resolve({ success: false, error: "No response from server — please try again" });
    }, timeoutMs);

    function onResult(payload) {
      if (payload.jobId !== jobId) return; // not our job
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("printer:result", onResult);
      resolve(payload);
    }

    socket.on("printer:result", onResult);
    socket.emit("printer:print", { jobId, jobType, order });
  });
}

/** Convenience wrappers */
export const printKot = (socket, order) => sendPrintJob(socket, "kot", order);
export const printBill = (socket, order) => sendPrintJob(socket, "bill", order);
export const printTest = (socket) => sendPrintJob(socket, "test", {});

/**
 * One-shot printer online/offline check.
 * Resolves quickly (short timeout) since it's just a status ping.
 */
export function checkPrinterStatus(socket, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ online: false });
      return;
    }
    const timer = setTimeout(() => {
      socket.off("printer:status", onStatus);
      resolve({ online: false });
    }, timeoutMs);

    function onStatus(payload) {
      clearTimeout(timer);
      socket.off("printer:status", onStatus);
      resolve(payload);
    }

    socket.once("printer:status", onStatus);
    socket.emit("printer:status-check");
  });
}

/**
 * Subscribe to live printer online/offline pushes (e.g. to show a
 * badge in the admin topbar). Returns an unsubscribe function.
 *
 *   useEffect(() => subscribePrinterStatus(socket, setPrinterOnline), [socket]);
 */
export function subscribePrinterStatus(socket, onChange) {
  if (!socket) return () => {};
  const handler = (payload) => onChange(payload.online);
  socket.on("printer:status", handler);
  return () => socket.off("printer:status", handler);
}
