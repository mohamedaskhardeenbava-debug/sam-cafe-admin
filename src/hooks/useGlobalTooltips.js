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

    const initExplicit = (el) => {
      // Element already carries explicit data-bs-toggle="tooltip" /
      // data-bs-title="..." markup (added directly in JSX) — just needs
      // the Bootstrap Tooltip instance created, no attribute upgrading.
      if (SKIP_TAGS.has(el.tagName)) return;
      if (window.bootstrap.Tooltip.getInstance(el)) return;
      el.setAttribute("data-bs-toggle-tooltip-tracked", "true");
      // eslint-disable-next-line no-new
      new window.bootstrap.Tooltip(el, { trigger: "hover focus" });
    };

    const upgrade = (el) => {
      if (SKIP_TAGS.has(el.tagName)) return;
      if (!el.getAttribute("title")) return;
      if (el.getAttribute("data-bs-toggle") === "tooltip" && window.bootstrap.Tooltip.getInstance(el)) return;

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
      // eslint-disable-next-line no-new
      new window.bootstrap.Tooltip(el, { trigger: "hover focus" });
    };

    const scan = () => {
      document.querySelectorAll("[title]").forEach(upgrade);
      document.querySelectorAll('[data-bs-toggle="tooltip"]:not([title])').forEach(initExplicit);

      // Elements that previously had a Bootstrap Tooltip instance attached
      // but no longer carry data-bs-toggle="tooltip" (e.g. the sidebar
      // link tooltip is conditionally spread on/off as the sidebar
      // expands/collapses) need their instance disposed, or a stale
      // tooltip can keep showing/re-showing on hover after the attribute
      // is gone.
      document.querySelectorAll('[data-bs-toggle-tooltip-tracked="true"]').forEach((el) => {
        if (el.getAttribute("data-bs-toggle") !== "tooltip") {
          const instance = window.bootstrap.Tooltip.getInstance(el);
          if (instance) instance.dispose();
          el.removeAttribute("data-bs-toggle-tooltip-tracked");
        }
      });
    };

    scan();

    // Re-scan on DOM changes (dropdowns, modals, collapsible sections)
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ["title", "data-bs-toggle"] });

    return () => {
      observer.disconnect();
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
        const instance = window.bootstrap.Tooltip.getInstance(el);
        if (instance) instance.dispose();
      });
    };
  }, [location.pathname]);
}
