import { useEffect } from "react";

const useCustomScrollbar = (scrollRef, thumbRef, direction = "vertical") => {
  useEffect(() => {
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    let isDragging = false;
    let startPos = 0;
    let startScroll = 0;

    const syncThumb = () => {
      if (direction === "vertical") {
        const scrollableHeight = el.scrollHeight - el.clientHeight;
        const ratio = el.scrollTop / (scrollableHeight || 1);

        const thumbHeight =
          (el.clientHeight / el.scrollHeight) * el.clientHeight;

        thumb.style.height = `${thumbHeight}px`;
        thumb.style.transform = `translateY(${ratio * (el.clientHeight - thumbHeight)}px)`;
      } else {
        const scrollableWidth = el.scrollWidth - el.clientWidth;
        const ratio = el.scrollLeft / (scrollableWidth || 1);

        const thumbWidth =
          (el.clientWidth / el.scrollWidth) * el.clientWidth;

        thumb.style.width = `${thumbWidth}px`;
        thumb.style.transform = `translateX(${ratio * (el.clientWidth - thumbWidth)}px)`;
      }
    };

    /* ---------- DRAG START ---------- */
    const onMouseDown = (e) => {
      isDragging = true;
      startPos = direction === "vertical" ? e.clientY : e.clientX;
      startScroll =
        direction === "vertical" ? el.scrollTop : el.scrollLeft;

      document.body.style.userSelect = "none";
    };

    /* ---------- DRAG MOVE ---------- */
    const onMouseMove = (e) => {
      if (!isDragging) return;

      const currentPos =
        direction === "vertical" ? e.clientY : e.clientX;

      const delta = currentPos - startPos;

      const scrollSize =
        direction === "vertical"
          ? el.scrollHeight - el.clientHeight
          : el.scrollWidth - el.clientWidth;

      const trackSize =
        direction === "vertical"
          ? el.clientHeight - thumb.offsetHeight
          : el.clientWidth - thumb.offsetWidth;

      const scrollDelta = (delta / trackSize) * scrollSize;

      if (direction === "vertical") {
        el.scrollTop = startScroll + scrollDelta;
      } else {
        el.scrollLeft = startScroll + scrollDelta;
      }
    };

    /* ---------- DRAG END ---------- */
    const onMouseUp = () => {
      isDragging = false;
      document.body.style.userSelect = "";
    };

    /* ---------- EVENTS ---------- */
    el.addEventListener("scroll", syncThumb);
    thumb.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", syncThumb);

    syncThumb();

    return () => {
      el.removeEventListener("scroll", syncThumb);
      thumb.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", syncThumb);
    };
  }, [scrollRef, thumbRef, direction]);
};

export default useCustomScrollbar;