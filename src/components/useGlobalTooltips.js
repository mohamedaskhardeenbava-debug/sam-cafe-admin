import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * useGlobalTooltips
 * -------------------
 * App-wide Bootstrap tooltip initializer. Rather than editing every
 * page that uses `title="..."` (header-collapse-btn appears in 30+
 * files, sidebar links, etc.), this hook scans the whole document for
 * elements carrying a plain `title` attribute and upgrades them into
 * Bootstrap tooltips — same visual affordance, richer/faster-appearing
 * tooltip UI, no per-page changes required.
 *
 * - Skips elements that already opted out via `data-bs-toggle="tooltip"`
 *   applied manually elsewhere (those are handled by their own local
 *   hook instance) to avoid double-initializing.
 * - Skips <input>/<textarea>/<select> — native browser title tooltips
 *   are fine there and Bootstrap's popup can interfere with typing UX.
 * - Also initializes Bootstrap Tooltip instances on elements that already
 *   carry explicit `data-bs-toggle="tooltip"` / `data-bs-title="..."`
 *   markup written directly in JSX (no `title` attribute to scan for),
 *   since Bootstrap's data-API auto-init only runs once on page load and
 *   won't pick up elements mounted later by React.
 * - Re-scans on route change and on DOM mutations (menus, modals, and
 *   collapsible headers mount/unmount `title` elements dynamically).
 */
export default function useGlobalTooltips() {
  const location = useLocation();

  useEffect(() => {
    if (!window.bootstrap?.Tooltip) return undefined;

    const SKIP_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

    // Elements whose tooltip was just force-closed by a click. Reinit
    // (via scan(), triggered by the MutationObserver reacting to
    // whatever DOM change the click caused) is suppressed for these
    // until the pointer actually leaves and re-enters — otherwise a
    // fresh Tooltip instance built while the cursor is still sitting
    // on the trigger immediately shows itself again, which is exactly
    // what looked like "the tooltip is stuck."
    const suppressedUntilLeave = new WeakSet();

    const initExplicit = (el) => {
      // Element already carries explicit data-bs-toggle="tooltip" /
      // data-bs-title="..." markup (added directly in JSX) — just needs
      // the Bootstrap Tooltip instance created, no attribute upgrading.
      if (SKIP_TAGS.has(el.tagName)) return;
      if (suppressedUntilLeave.has(el)) return;
      if (window.bootstrap.Tooltip.getInstance(el)) return;
      el.setAttribute("data-bs-tooltip-tracked", "true");
      // eslint-disable-next-line no-new
      new window.bootstrap.Tooltip(el, { trigger: "hover focus" });
    };

    const upgrade = (el) => {
      if (SKIP_TAGS.has(el.tagName)) return;
      if (!el.getAttribute("title")) return;
      if (suppressedUntilLeave.has(el)) return;

      // Already has a live instance and is correctly wired — leave it
      // alone. Tearing down and rebuilding an existing, correctly-
      // configured instance on every scan() is what let a tooltip
      // re-show itself immediately after being force-hidden (see
      // handleDocumentClick below): a brand-new instance has no memory
      // of "just hidden," so if the cursor is still physically over the
      // element (the normal case right after a click), it shows again.
      if (
        el.getAttribute("data-bs-toggle") === "tooltip" &&
        el.getAttribute("data-bs-placement") &&
        window.bootstrap.Tooltip.getInstance(el)
      ) {
        return;
      }

      el.setAttribute("data-bs-toggle", "tooltip");
      if (!el.getAttribute("data-bs-placement")) {
        // Sidebar links/collapse toggle sit flush against the left
        // edge when collapsed — a "top" tooltip would clip against the
        // viewport edge, so those get "right" placement instead.
        const isSidebarEl = el.closest(".sidebar-link, .sidebar-brand") ||
          el.classList.contains("sidebar-link");
        el.setAttribute("data-bs-placement", isSidebarEl ? "right" : "top");
      }

      const existing = window.bootstrap.Tooltip.getInstance(el);
      if (existing) existing.dispose();
      el.setAttribute("data-bs-tooltip-tracked", "true");
      // eslint-disable-next-line no-new
      new window.bootstrap.Tooltip(el, { trigger: "hover focus" });
    };

    const scan = () => {
      document.querySelectorAll("[title]").forEach(upgrade);
      document.querySelectorAll('[data-bs-toggle="tooltip"]:not([title])').forEach(initExplicit);

      // Any element that ever got a Bootstrap Tooltip instance (via either
      // path above) is marked data-bs-tooltip-tracked. Two situations mean
      // that instance needs disposing:
      //   1. The element no longer carries data-bs-toggle="tooltip" at all
      //      (e.g. the sidebar link tooltip is conditionally spread on/off
      //      as the sidebar expands/collapses).
      //   2. The element has been removed from the document entirely (e.g.
      //      a list row — a to-do, a table row — was deleted). Bootstrap
      //      has no way to detect this on its own: its floating tooltip
      //      popup lives in document.body, not as a child of the trigger
      //      element, so if the trigger unmounts without an explicit
      //      dispose() the popup is orphaned and keeps showing.
      // Either way, a stale tooltip can otherwise keep showing/re-showing
      // after the element/attribute is gone.
      document.querySelectorAll('[data-bs-tooltip-tracked="true"]').forEach((el) => {
        const stillWired = el.isConnected && el.getAttribute("data-bs-toggle") === "tooltip";
        if (!stillWired) {
          const instance = window.bootstrap.Tooltip.getInstance(el);
          if (instance) instance.dispose();
          if (el.isConnected) el.removeAttribute("data-bs-tooltip-tracked");
        }
      });
    };

    scan();

    // Re-scan on DOM changes (dropdowns, modals, collapsible sections)
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ["title", "data-bs-toggle"] });

    // Clicking a tooltip-bearing button leaves the tooltip stuck visible:
    // with trigger "hover focus", a click focuses the button but doesn't
    // hover-out or blur it, so the tooltip has no event left to tell it
    // to close — it just sits there once the mouse moves away. Force-hide
    // on every click, blur the trigger, and suppress reinit until the
    // pointer actually leaves — this closes it immediately and keeps it
    // closed even though the click itself often triggers a DOM mutation
    // that would otherwise cause scan() to rebuild (and re-show) a fresh
    // instance a moment later.
    const handleDocumentClick = (e) => {
      // e.target can be a non-Element node in edge cases (e.g. a Text
      // node when a click lands on a bare text child), and Text nodes
      // have no .closest(). Guard so this never throws.
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      const trigger = target.closest('[data-bs-toggle="tooltip"]');
      if (!trigger) return;
      const instance = window.bootstrap.Tooltip.getInstance(trigger);
      if (instance) instance.hide();
      suppressedUntilLeave.add(trigger);
      // Deferred so the click's own handler runs first — blurring
      // immediately can interfere with handlers checking activeElement.
      setTimeout(() => trigger.blur(), 0);
    };
    document.addEventListener("click", handleDocumentClick, true);

    // Once the pointer truly leaves a suppressed trigger, it's safe to
    // let it get a normal tooltip instance again on the next hover.
    const handlePointerOut = (e) => {
      // Same non-Element-target guard as handleDocumentClick above —
      // pointerleave's target is occasionally `document` itself or a
      // Text node, neither of which has .closest().
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      const trigger = target.closest('[data-bs-toggle="tooltip"]');
      if (trigger && suppressedUntilLeave.has(trigger)) {
        suppressedUntilLeave.delete(trigger);
      }
    };
    document.addEventListener("pointerleave", handlePointerOut, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("pointerleave", handlePointerOut, true);
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
        const instance = window.bootstrap.Tooltip.getInstance(el);
        if (instance) instance.dispose();
      });
    };
  }, [location.pathname]);
}