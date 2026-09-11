/**
 * usePopupAnimation.js  —  Sam Cafe Admin Panel
 * ─────────────────────────────────────────────────────────────────────────
 * Single shared open/close animation lifecycle for every overlay in the
 * app — modals, confirm dialogs, CustomDatePicker, CustomTimePicker, and
 * any future popup. Closing something shouldn't yank it out of the DOM
 * instantly: this hook keeps `shouldRender` true for `duration` ms after
 * `close()` is called so the CSS exit keyframes get to finish playing
 * before React actually unmounts it.
 *
 * USAGE — simple show/hide popup (no payload), e.g. CustomDatePicker:
 * -----
 *   const popup = usePopupAnimation();
 *
 *   <button onClick={popup.toggle}>...</button>
 *
 *   {popup.shouldRender && (
 *     <div className={`cdp-overlay ${popup.animClass}`}>
 *       <div className={`cdp-popup ${popup.animClass}`} onMouseDown={(e) => e.stopPropagation()}>
 *         ...
 *         <button onClick={() => popup.close()}>Close</button>
 *       </div>
 *     </div>
 *   )}
 *
 * USAGE — modal carrying data, e.g. "edit this row":
 * -----
 *   const editModal = usePopupAnimation({ duration: MODAL_ANIM_EXIT_DURATION });
 *
 *   <Button3D onClick={() => editModal.open(row)}>Edit</Button3D>
 *
 *   {editModal.shouldRender && (
 *     <div className={`modal-overlay ${editModal.animClass}`}>
 *       <form className={`admin-modal ${editModal.animClass}`} onClick={(e) => e.stopPropagation()}>
 *         ...
 *         <Button3D variant="cancel" onClick={() => editModal.close()}>Cancel</Button3D>
 *       </form>
 *     </div>
 *   )}
 *
 *   editModal.data — whatever payload was passed to open(payload), or null.
 *   Re-opening (open(newPayload)) while already open just swaps the data
 *   in place — no flicker, no re-triggering the enter animation, and no
 *   stale close timer left running to null the data back out later (this
 *   was the bug behind "opening edit/preview instantly closes itself" —
 *   calling a shared close()-based reset right before open() left a
 *   pending timeout that fired after the new open).
 *
 * `close()` accepts an optional callback that fires once the exit
 * animation finishes — handy for "do X, then close" flows where the
 * next thing shouldn't start until the close animation is done.
 *
 * `animClass` is `"popup-anim-in"` / `"popup-anim-out"` by default —
 * used by CustomDatePicker.css / CustomTimePicker.css. Pass
 * `{ inClass: "modal-anim-in", outClass: "modal-anim-out" }` for modals,
 * which is what ModalCSS.css's shared keyframes key off.
 *
 * `initialOpen: true` starts the popup already open on first render —
 * for a component that's conditionally *mounted* by its caller
 * ({show && <Thing open />}) rather than always-mounted with a reactive
 * `open` prop. Without this, a value that's always `true` never fires
 * an open() call, since nothing ever transitions from false → true.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// Default exit-animation window for small anchored popups (date/time
// pickers). Must match CustomDatePicker.css / CustomTimePicker.css.
export const POPUP_EXIT_DURATION = 160;

// Exit-animation window for full modals — matches ModalCSS.css /
// ModalContext.js's MODAL_EXIT_DURATION so every modal in the app closes
// on the same timing whether it goes through ModalContext or this hook.
export const MODAL_ANIM_EXIT_DURATION = 220;

export default function usePopupAnimation({
  duration = POPUP_EXIT_DURATION,
  inClass = "popup-anim-in",
  outClass = "popup-anim-out",
  initialData = null,
  initialOpen = false,
} = {}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [data, setData] = useState(initialData);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const open = useCallback((payload) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (payload !== undefined) setData(payload);
    setIsClosing(false);
    setIsOpen(true);
  }, []);

  const close = useCallback((onClosed) => {
    setIsOpen((wasOpen) => {
      if (!wasOpen) return wasOpen;
      setIsClosing(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsClosing(false);
        setData(null);
        timerRef.current = null;
        if (onClosed) onClosed();
      }, duration);
      return false;
    });
  }, [duration]);

  const toggle = useCallback((payload) => {
    setIsOpen((wasOpen) => {
      if (wasOpen) {
        setIsClosing(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setIsClosing(false);
          setData(null);
          timerRef.current = null;
        }, duration);
        return false;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (payload !== undefined) setData(payload);
      setIsClosing(false);
      return true;
    });
  }, [duration]);

  return {
    isOpen,
    isClosing,
    shouldRender: isOpen || isClosing,
    animClass: isClosing ? outClass : inClass,
    data,
    open,
    close,
    toggle,
    duration,
  };
}
