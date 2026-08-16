/**
 * useAnimatedModal.js  —  Sam Cafe Admin Panel
 * ─────────────────────────────────────────────────────────────────────────
 * Shared entry+exit animation lifecycle for every modal in the app
 * (~40 usages across Dishes, Ingredients, Staff*, Kitchen*, Service*,
 * Events*, Categories, Venues, Offers, etc).
 *
 * Works together with `ModalContext` (src/context/ModalContext.js), which
 * owns *which* modal is open. This hook owns *how* it animates:
 *
 *   const modal = useAnimatedModal("addDish");
 *   if (!modal.shouldRender) return null;
 *   <div className={`modal-overlay ${modal.overlayClass}`} onClick={modal.close}>
 *     <form className={`admin-modal ${modal.modalClass}`} onClick={(e) => e.stopPropagation()}>
 *       ...
 *     </form>
 *   </div>
 *
 * `modal.close` always routes through the single ModalContext.closeModal
 * function — no page declares its own open/close boolean toggling for the
 * animation itself. Pages still own *data* state (e.g. which record is
 * being edited); they just gate it on `modal.shouldRender` /
 * `useModal().isModalOpen(id)` instead of a local `showX` boolean.
 *
 * Animation: overlay fades, modal scales + slides up slightly on enter,
 * reverses on exit. Duration matches MODAL_EXIT_DURATION so React only
 * unmounts after the exit transition finishes (no abrupt cut-off).
 */

import { useModal, MODAL_EXIT_DURATION } from "../context/ModalContext";

export default function useAnimatedModal(id) {
  const { isModalOpen, isModalClosing, closeModal, openModal, activeModal } = useModal();

  const shouldRender = isModalOpen(id);
  const closing = isModalClosing(id);

  const overlayClass = closing ? "modal-anim-out" : "modal-anim-in";
  const modalClass = closing ? "modal-anim-out" : "modal-anim-in";

  const open = () => openModal(id);
  const close = (onClosed) => closeModal(onClosed);

  return {
    shouldRender,
    closing,
    isOpen: activeModal === id,
    overlayClass,
    modalClass,
    open,
    close,
    duration: MODAL_EXIT_DURATION,
  };
}
