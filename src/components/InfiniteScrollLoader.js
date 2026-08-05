/**
 * InfiniteScrollLoader.js  —  Sam Cafe Admin Panel
 * Shared infinite-scroll sentinel + spinner component
 */

import React from "react";

import "./InfiniteScrollLoader.css";

/**
 * InfiniteScrollLoader
 *
 * Drop this component right after your <tbody> (or at the bottom of a
 * scrollable list).  It renders:
 *   - A sentinel <div> that the IntersectionObserver watches
 *   - An animated spinner + "Loading more…" label while more rows exist
 *   - Nothing (sentinel only) once all rows are loaded
 *
 * Props
 * ──────────────────────────────────────────
 * sentinelRef  RefObject   Required. Ref from useInfiniteScroll.
 * hasMore      boolean     Required. Whether more rows remain.
 * label        string      Optional. Override the loading text.
 * colSpan      number      Optional. If provided, wraps inside a <tr><td>.
 *                          Use this when placed inside a <tbody>.
 * isLoading    boolean     Optional. When true, renders a translucent
 *                          overlay across the whole table/list while the
 *                          next page of infinite-scroll rows loads in.
 *                          Only meaningful when colSpan is NOT set (i.e.
 *                          rendered as a sibling of the scroll container),
 *                          pair with InfiniteScrollOverlay below for
 *                          <table> layouts.
 */
const InfiniteScrollLoader = ({
  sentinelRef,
  hasMore,
  label = "Loading more…",
  colSpan,
}) => {
  const content = (
    <>
      <div ref={sentinelRef} className="isl-sentinel" aria-hidden="true" />
      {hasMore && (
        <div className="isl-loader" role="status" aria-live="polite">
          <span className="isl-spinner" aria-hidden="true" />
          <span className="isl-label">{label}</span>
        </div>
      )}
    </>
  );

  // When used inside a <table><tbody>, we must wrap in <tr><td>
  if (colSpan) {
    return (
      <tr className="isl-row">
        <td colSpan={colSpan} className="isl-cell">
          {content}
        </td>
      </tr>
    );
  }

  return <div className="isl-wrapper">{content}</div>;
};

/**
 * InfiniteScrollOverlay
 *
 * Renders a translucent full-table inline loader while the next batch
 * of infinite-scroll rows is being appended. Place it as a sibling
 * inside the same `position: relative` scroll wrapper that holds the
 * <table>/list, right after it — it absolutely covers the whole area.
 *
 * Props
 * ──────────────────────────────────────────
 * isLoading   boolean   Required. Show/hide the overlay.
 * label       string    Optional. Override the loading text.
 */
export const InfiniteScrollOverlay = ({ isLoading, label = "Loading…" }) => {
  if (!isLoading) return null;
  return (
    <div className="isl-table-overlay" role="status" aria-live="polite">
      <span className="isl-spinner" aria-hidden="true" />
      <span className="isl-label">{label}</span>
    </div>
  );
};

export default InfiniteScrollLoader;
