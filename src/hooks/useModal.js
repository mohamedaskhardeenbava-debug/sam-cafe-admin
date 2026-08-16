import { useCallback, useRef, useState } from "react";

/**
 * useModal
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for a modal's open/close lifecycle,
 * replacing the old per-page `const [showX, setShowX] = useState(false)`
 * + `{showX && <div className="modal-overlay">...}` pattern.
 *
 * Besides being one state instead of two (state + setter sprinkled
 * through handlers), it drives the closing animation: instead of the
 * modal unmounting the instant `close()` is called, `shouldRender`
 * stays true for the duration of the exit animation while `isClosing`
 * flips on so the CSS `.modal-overlay.closing` / `.admin-modal.closing`
 * keyframes can play, then the modal actually unmounts.
 *
 * USAGE
 * -----
 *   const dishModal = useModal();
 *
 *   <Button3D onClick={dishModal.open}>+ Add Dish</Button3D>
 *
 *   {dishModal.shouldRender && (
 *     <div className={`modal-overlay${dishModal.isClosing ? " closing" : ""}`}>
 *       <form className={`admin-modal${dishModal.isClosing ? " closing" : ""}`}>
 *         ...
 *         <Button3D variant="cancel" onClick={dishModal.close}>Cancel</Button3D>
 *       </form>
 *     </div>
 *   )}
 *
 * For pages that need to pass data along with opening (e.g. "edit this
 * row"), use `open(payload)` and read it back from `modal.data`:
 *
 *   const editModal = useModal();
 *   editModal.open(row);       // later: editModal.data === row
 *
 * Returns:
 *   isOpen        – true from the moment open() is called until close()
 *                    finishes (drives things like disabling the trigger
 *                    button while the modal is up)
 *   isClosing     – true only during the exit-animation window
 *   shouldRender  – true while the modal should be in the DOM at all
 *                    (isOpen || isClosing) — use this instead of isOpen
 *                    to guard the JSX
 *   data          – whatever payload was passed to open(payload), or null
 *   open(payload?) – opens the modal, optionally storing a payload
 *   close()        – starts the closing animation, unmounts after it ends
 *   modalClass(base) – helper: `${base}${isClosing ? " closing" : ""}`
 */
const CLOSE_ANIM_MS = 220;

export default function useModal(initialData = null) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [data, setData] = useState(initialData);
  const timerRef = useRef(null);

  const open = useCallback((payload) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (payload !== undefined) setData(payload);
    setIsClosing(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen((wasOpen) => {
      if (!wasOpen) return wasOpen;
      setIsClosing(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsClosing(false);
        setData(null);
        timerRef.current = null;
      }, CLOSE_ANIM_MS);
      return false;
    });
  }, []);

  const modalClass = useCallback(
    (base) => (isClosing ? `${base} closing` : base),
    [isClosing]
  );

  return {
    isOpen,
    isClosing,
    shouldRender: isOpen || isClosing,
    data,
    open,
    close,
    modalClass,
  };
}
