import { useLayoutEffect, useRef, useState } from "react";

/**
 * useTabLiquid(activeKey)
 * ────────────────────────────────────────────────────────────────
 * Powers the "liquid" sliding highlight behind .app-tab-pills (shared
 * page-level tab switch used by Dashboard, Events, Staffs, Roles and
 * Responsibilities). Unlike the 3-fixed-tabs radio/CSS-only version,
 * this measures the actual active <button class="app-tab-pill"> in the
 * DOM, so it works for any number of pills and any pill width (including
 * variable-width labels and the mobile horizontal-scroll layout) without
 * each page needing to know how many tabs its neighbours have.
 *
 * Usage:
 *   const { containerRef, thumbStyle } = useTabLiquid(activeTab);
 *   <div className="app-tab-pills" ref={containerRef}>
 *     <span className="app-tab-pill-liquid" style={thumbStyle} />
 *     <button className={`app-tab-pill${activeTab === "x" ? " active" : ""}`} ...>
 *   </div>
 *
 * The thumb <span> must be the FIRST child inside the container — it's
 * positioned absolutely, sits behind the pill buttons (z-index handled in
 * CSS), and its width/left are recomputed whenever activeKey changes or
 * the container resizes (tab added/removed, sidebar collapse, viewport
 * resize triggering the mobile layout).
 */
export function useTabLiquid(activeKey) {
  const containerRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ opacity: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const activeBtn = container.querySelector(".app-tab-pill.active");
      if (!activeBtn) {
        setThumbStyle((prev) => ({ ...prev, opacity: 0 }));
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setThumbStyle({
        opacity: 1,
        width: btnRect.width,
        transform: `translateX(${btnRect.left - containerRect.left}px)`,
      });
    };

    measure();

    // Re-measure on container resize — covers the mobile breakpoint
    // (horizontal-scroll pills), sidebar collapse changing available
    // width, and window resize, all without a manual listener per page.
    const ro = new ResizeObserver(measure);
    ro.observe(container);

    return () => ro.disconnect();
  }, [activeKey]);

  return { containerRef, thumbStyle };
}

export default useTabLiquid;
