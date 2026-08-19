/**
 * FilterBar.js  —  Sam Cafe Admin Panel
 * Universal filter-bar component: search, pill groups (Period, Status,
 * Section, Source, Slot, ...), date range, and time range — all built
 * from the existing `.filter-bar` / `.filter-group` / `.filter-pill`
 * classes so there is no visual change from page to page.
 *
 * This component is presentational only: it never owns filter state.
 * Callers pass current values + onChange callbacks, exactly like
 * CustomDatePicker / CustomTimePicker already do. Pages that lift
 * filter state to a parent (e.g. Catering.js's `filters`/`patchFilters`
 * props) keep doing so unchanged — FilterBar just renders whatever
 * values/handlers it's given.
 */

import React from "react";

import { CustomDatePicker } from "./CustomDatePicker";
import { CustomTimePicker } from "./CustomTimePicker";
import { resolveDateRange, todayStr, DEFAULT_PERIOD_PRESETS } from "../utils/dateRangeUtils";
import { allowTextInput } from "../App";

/* ────────────────────────────────────────────────────────────────
   MultiPillGroup — like PillGroup, but for Set-based multi-select
   filters (e.g. Slot, Status where more than one can be active at
   once). Mirrors the `filterX.has(key)` + `toggleSet` pattern used
   across the booking pages.

   Props:
     label, options   – same shape as PillGroup
     value            – a Set of currently-active values
     onToggle(val)    – called with the clicked value; caller is
                        expected to add/remove it from the Set
                        (typically via a toggleSet(setter, val) helper)
──────────────────────────────────────────────────────────────── */
export const MultiPillGroup = ({ label, options = [], value, onToggle, labelClass = "filter-group-label", groupClass = "filter-group" }) => {
  if (!options.length) return null;

  const normalized = options.map((opt) => {
    if (Array.isArray(opt)) {
      const [val, lbl, className, title] = opt;
      return { value: val, label: lbl, className, title };
    }
    return opt;
  });

  return (
    <div className={groupClass}>
      {label && <span className={labelClass}>{label}</span>}
      {normalized.map((opt) => {
        const isActive = value instanceof Set ? value.has(opt.value) : false;
        const cls = `filter-pill${isActive ? ` active ${opt.className || ""}` : ""}`.trim();
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={cls}
            onClick={() => onToggle(opt.value)}
            {...(opt.title ? { "data-bs-toggle": "tooltip", "data-bs-placement": "top", "data-bs-title": opt.title } : {})}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
   PillGroup — one labeled row of toggle buttons.
   Used for Period, Status, Section, Source, Slot, or any custom set.

   Props:
     label       – group label, e.g. "Status"
     options     – array of options. Each option can be:
                     [value, label]
                     [value, label, className]
                     [value, label, className, title]
                     or an object { value, label, className, title }
     value       – currently active value (or "" / null for none)
     onChange    – (value) => void
     toggle      – if true, clicking the active pill again clears it
                   (calls onChange("")). Default true.
     activeClass – extra class applied to the active pill in addition
                   to "active" (ignored if the option itself provides
                   a className)
──────────────────────────────────────────────────────────────── */
export const PillGroup = ({ label, options = [], value, onChange, toggle = true, activeClass = "", labelClass = "filter-group-label", groupClass = "filter-group" }) => {
  if (!options.length) return null;

  const normalized = options.map((opt) => {
    if (Array.isArray(opt)) {
      const [val, lbl, className, title] = opt;
      return { value: val, label: lbl, className, title };
    }
    return opt;
  });

  return (
    <div className={groupClass}>
      {label && <span className={labelClass}>{label}</span>}
      {normalized.map((opt) => {
        const isActive = value === opt.value;
        const cls = `filter-pill${isActive ? ` active ${opt.className || activeClass}` : ""}`.trim();
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={cls}
            onClick={() => {
              if (toggle && isActive) onChange("");
              else onChange(opt.value);
            }}
            {...(opt.title ? { "data-bs-toggle": "tooltip", "data-bs-placement": "top", "data-bs-title": opt.title } : {})}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────
   DateRangeGroup — Period presets (optional) + From/To date pickers.

   Props:
     from, to            – "YYYY-MM-DD" strings
     onChangeFrom(v)      onChangeTo(v)
     preset              – active preset key, or "" / "custom"
     onChangePreset(key)  – called with resolved preset key
     presets             – override the [key,label] list
                            (default: DEFAULT_PERIOD_PRESETS, i.e.
                            All/Today/This Week/This Month/Last Month)
     showPresets         – set false to render only the From/To pickers
     toggle              – clicking the active preset again clears the
                            range (default true, matches Catering.js)
     max                 – optional max date for the "To" picker
                            (defaults to today for report-style pages)
     fromLabel, toLabel  – override "From"/"To" labels
──────────────────────────────────────────────────────────────── */
export const DateRangeGroup = ({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  preset,
  onChangePreset,
  presets = DEFAULT_PERIOD_PRESETS,
  showPresets = true,
  toggle = true,
  max,
  fromLabel = "From",
  toLabel = "To",
  periodLabel = "Period",
  pickerFromLabel,
  pickerToLabel,
  noMax = false,
  labelClass = "filter-group-label",
  groupClass = "filter-group",
  separateItems = false,
  pickerLabels = false,
}) => {
  const applyPreset = (key) => {
    if (!onChangePreset) return;
    if (toggle && preset === key) {
      onChangePreset("");
      onChangeFrom?.("");
      onChangeTo?.("");
      return;
    }
    onChangePreset(key);
    if (key === "all" || key === "") {
      onChangeFrom?.("");
      onChangeTo?.("");
    } else {
      const [f, t] = resolveDateRange(key);
      onChangeFrom?.(f);
      onChangeTo?.(t);
    }
  };

  const fromPicker = (
    <>
      <span className={labelClass}>{fromLabel}</span>
      <CustomDatePicker
        label={pickerLabels ? (pickerFromLabel ?? fromLabel) : undefined}
        value={from}
        max={to || max}
        onChange={(v) => {
          onChangeFrom?.(v);
          onChangePreset?.("custom");
          if (to && v > to) onChangeTo?.(v);
        }}
        placeholder="Start date"
      />
    </>
  );

  const toPicker = (
    <>
      <span className={labelClass}>{toLabel}</span>
      <CustomDatePicker
        label={pickerLabels ? (pickerToLabel ?? toLabel) : undefined}
        value={to}
        min={from}
        max={noMax ? undefined : (max ?? todayStr())}
        onChange={(v) => {
          onChangeTo?.(v);
          onChangePreset?.("custom");
        }}
        placeholder="End date"
      />
    </>
  );

  return (
    <>
      {showPresets && (
        <div className={groupClass}>
          <span className={labelClass}>{periodLabel}</span>
          {presets.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`filter-pill${preset === key ? " active" : ""}`}
              onClick={() => applyPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {separateItems ? (
        <>
          <div className={groupClass}>{fromPicker}</div>
          <div className={groupClass}>{toPicker}</div>
        </>
      ) : (
        <div className={groupClass}>
          {fromPicker}
          {toPicker}
        </div>
      )}
    </>
  );
};

/* ────────────────────────────────────────────────────────────────
   TimeRangeGroup — From/To time-of-day pickers (e.g. slot filtering).

   Props:
     from, to             – "HH:MM" 24h strings
     onChangeFrom(v)       onChangeTo(v)
     fromLabel, toLabel    – override labels
──────────────────────────────────────────────────────────────── */
export const TimeRangeGroup = ({ from, to, onChangeFrom, onChangeTo, fromLabel = "From", toLabel = "To" }) => (
  <div className="filter-group">
    <span className="filter-group-label">{fromLabel}</span>
    <CustomTimePicker value={from} onChange={onChangeFrom} placeholder="Start time" />
    <span className="filter-group-label">{toLabel}</span>
    <CustomTimePicker value={to} onChange={onChangeTo} placeholder="End time" />
  </div>
);

/* ────────────────────────────────────────────────────────────────
   FilterBar — top-level assembly.

   Props:
     search              – current search text (omit to hide the input)
     onSearchChange(v)
     searchPlaceholder

     groups              – array of PillGroup configs, each:
                            { label, options, value, onChange, toggle, activeClass }
                            rendered as separate pill groups in order
                            (Status, Section, Source, Slot, etc.)

     dateRange           – DateRangeGroup props object, or omit to hide
     timeRange           – TimeRangeGroup props object, or omit to hide

     onClear             – shown as a trailing "Clear" button whenever
                            provided; pass `active` to control visibility
     active              – boolean, whether any filter is currently set
                            (controls whether the Clear button renders)
     clearLabel          – default "Clear"
     secondRow           – if true, renders `groups` in a second
                            `.filter-groups` row below search/date
                            (matches Catering.js's two-row layout)
     rightContent        – optional extra JSX rendered at the end of the
                            bar (e.g. a page-specific control)
──────────────────────────────────────────────────────────────── */
export const FilterBar = ({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  groups = [],
  dateRange,
  timeRange,
  onClear,
  active = false,
  clearLabel = "Clear",
  secondRow = false,
  rightContent,
}) => {
  const firstRowGroups = secondRow ? [] : groups;
  const secondRowGroups = secondRow ? groups : [];

  return (
    <div className="filter-bar">
      <div className="filter-groups">
        {onSearchChange && (
          <input
            className="search-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(allowTextInput(search, e.target.value, 100, 5))}
          />
        )}
        {dateRange && <DateRangeGroup {...dateRange} />}
        {timeRange && <TimeRangeGroup {...timeRange} />}
        {firstRowGroups.map((g, i) => (
          <PillGroup key={i} {...g} />
        ))}
        {!secondRow && rightContent}
        {!secondRow && onClear && active && (
          <button type="button" className="ae-clear-filter" onClick={onClear}>{clearLabel}</button>
        )}
      </div>

      {secondRow && (
        <div className="filter-groups">
          {secondRowGroups.map((g, i) => (
            <PillGroup key={i} {...g} />
          ))}
          {rightContent}
          {onClear && active && (
            <button type="button" className="ae-clear-filter" onClick={onClear}>{clearLabel}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterBar;