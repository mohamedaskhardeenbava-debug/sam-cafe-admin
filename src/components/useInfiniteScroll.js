/**
 * useInfiniteScroll.js  —  Sam Cafe Admin Panel
 * Infinite-scroll IntersectionObserver hook
 */

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * useInfiniteScroll
 *
 * @param {number} total        - Total number of items in the full list
 * @param {number} pageSize     - How many items to reveal per load step (default 30)
 * @param {Element|null} root   - Scroll container (null = viewport)
 * @returns {{
 *   displayLimit: number,
 *   sentinelRef: React.RefObject,
 *   containerRef: React.RefObject,
 *   hasMore: boolean,
 *   reset: () => void
 * }}
 */
const useInfiniteScroll = (total, pageSize = 30, root = null) => {
  const [displayLimit, setDisplayLimit] = useState(pageSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const containerRef = useRef(null);
  const loadTimerRef = useRef(null);

  const hasMore = displayLimit < total;

  const reset = useCallback(() => {
    setDisplayLimit(pageSize);
    setIsLoadingMore(false);
  }, [pageSize]);

  // Reset when the total dataset changes (e.g. filter applied)
  useEffect(() => {
    setDisplayLimit(pageSize);
    setIsLoadingMore(false);
  }, [total, pageSize]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = root ?? containerRef.current ?? null;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit((prev) => {
            if (prev < total) {
              setIsLoadingMore(true);
              clearTimeout(loadTimerRef.current);
              loadTimerRef.current = setTimeout(() => setIsLoadingMore(false), 350);
              return prev + pageSize;
            }
            return prev;
          });
        }
      },
      { root: scrollRoot, rootMargin: "150px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      clearTimeout(loadTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, pageSize]);

  return { displayLimit, sentinelRef, containerRef, hasMore, reset, isLoadingMore };
};

export default useInfiniteScroll;
