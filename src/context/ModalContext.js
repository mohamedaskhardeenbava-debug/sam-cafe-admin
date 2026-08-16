/**
 * ModalContext.js  —  Sam Cafe Admin Panel
 * ─────────────────────────────────────────────────────────────────────────
 * Single source of truth for modal open/close across the entire app.
 *
 * Previously every page declared its own `showX` / `editTarget` boolean(s)
 * and toggled them directly, so opening/closing logic (and now, animation
 * timing) was duplicated ~40 times. This context centralizes the actual
 * "is a modal open, which one, and how does it animate in/out" concern
 * into one place, while each page still owns *what data* the modal shows.
 *
 * Pattern:
 *   const { openModal, closeModal, isModalOpen, activeModal } = useModal();
 *
 *   openModal("addDish")          // marks "addDish" as the open modal id
 *   closeModal()                  // starts exit animation, then clears it
 *   isModalOpen("addDish")        // true while open OR mid-exit-animation
 *
 * Only one modal is ever "active" at a time app-wide, which matches how
 * the admin panel already behaves (opening one modal implicitly means no
 * other modal was open). Pages that need a modal to carry a payload
 * (e.g. "which row is being edited") keep that in their own local state —
 * this context only owns the open/closed/animating lifecycle.
 */

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const ModalContext = createContext(null);

// Must match the CSS transition duration in ModalCSS.css (.modal-overlay / .admin-modal exit).
export const MODAL_EXIT_DURATION = 220;

export function ModalProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null); // string id or null
  const [closingModal, setClosingModal] = useState(null); // id currently mid-exit-animation
  const closeTimerRef = useRef(null);

  const openModal = useCallback((id) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosingModal(null);
    setActiveModal(id);
  }, []);

  const closeModal = useCallback((onClosed) => {
    setActiveModal((current) => {
      if (!current) return current;
      setClosingModal(current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        setClosingModal(null);
        closeTimerRef.current = null;
        if (onClosed) onClosed();
      }, MODAL_EXIT_DURATION);
      return null;
    });
  }, []);

  const isModalOpen = useCallback(
    (id) => activeModal === id || closingModal === id,
    [activeModal, closingModal]
  );

  const isModalClosing = useCallback((id) => closingModal === id, [closingModal]);

  const value = {
    activeModal,
    openModal,
    closeModal,
    isModalOpen,
    isModalClosing,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return ctx;
}

export default ModalContext;
