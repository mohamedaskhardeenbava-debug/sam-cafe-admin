/**
 * SubBuilderFields.js  —  Sam Cafe Admin Panel
 *
 * The two-column meal-schedule builder body — Plan Type / Slot / Week
 * tabs and the "pick dish → tap days" flow on the left, the Summary
 * table + totals on the right. Pure presentation: all state and
 * derived data comes from `builder`, the object returned by
 * useSubscriptionBuilder(). Used identically by:
 *   - Subscriptions.js   — inside the "+ New Subscription" modal
 *   - SubscriptionDetails.js — inside the Edit mode of a single
 *                              subscription's detail page
 * so the schedule-building logic only exists in one place.
 */

import React from "react";
import CustomDropdown from "../../components/CustomDropdown";
import { SLOT_OPTIONS, WEEKS, WEEK_LABELS, DAYS } from "./useSubscriptionBuilder";

const SubBuilderFields = ({ builder, formErrors = {} }) => {
  const {
    subscription,
    activeSlot,
    switchActiveSlot,
    activeWeek,
    setActiveWeek,
    pickerCategoryId,
    setPickerCategoryId,
    pickerSubCategoryId,
    setPickerSubCategoryId,
    pickerDishId,
    setPickerDishId,
    dishesForActiveSlot,
    categoriesForActiveSlot,
    subCategoriesForPicker,
    dishesForPicker,
    toggleCellDish,
    setPlanType,
    dishLabel,
    dishById,
    scheduledRows,
    totalPrice,
    filledCellCount,
  } = builder;

  const weekForCell = subscription.planType === "monthly" ? activeWeek : "week1";

  return (
    <div className="sub-builder-body">
      <div className="sub-builder-col sub-builder-col-left">

        {/* PLAN TYPE */}
        <div className="admin-form-group">
          <label>Plan Type</label>
          <div className="dish-switch-group">
            <button
              type="button"
              className={`dish-switch-btn${subscription.planType === "weekly" ? " is-active" : ""}`}
              onClick={() => setPlanType("weekly")}
            >
              <span className="dish-switch-dot veg" /> Same Every Week
            </button>
            <button
              type="button"
              className={`dish-switch-btn${subscription.planType === "monthly" ? " is-active" : ""}`}
              onClick={() => setPlanType("monthly")}
            >
              <span className="dish-switch-dot non-veg" /> Custom Per Week
            </button>
          </div>
          <p className="sub-plan-hint">
            {subscription.planType === "weekly"
              ? "Pick dishes for Week 1 — the same days/dishes repeat automatically for Weeks 2-4."
              : "Each week (1-4) can have different dishes on different days."}
          </p>
        </div>

        {/* SLOT TABS */}
        <div className="admin-form-group">
          <label>Slot</label>
          <div className="sub-tab-group">
            {SLOT_OPTIONS.map(opt => (
              <button
                type="button"
                key={opt.value}
                className={`sub-tab-btn${activeSlot === opt.value ? " is-active" : ""}`}
                onClick={() => switchActiveSlot(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* WEEK TABS (hidden entirely for "weekly" mode — week1 IS the plan) */}
        {subscription.planType === "monthly" && (
          <div className="admin-form-group">
            <label>Week</label>
            <div className="sub-tab-group">
              {WEEKS.map(w => (
                <button
                  type="button"
                  key={w}
                  className={`sub-tab-btn${activeWeek === w ? " is-active" : ""}`}
                  onClick={() => setActiveWeek(w)}
                >
                  {WEEK_LABELS[w]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DISH PICKER + DAY ASSIGNMENT
            Simple two-step flow, easy for staff to follow:
              1) Pick ONE dish (Category → Sub-Category → Dish).
              2) Tick the days it should be served on (Mon..Sun).
            Repeat for as many dishes as needed — everything already
            scheduled for this slot/week is listed below so it's always
            clear what's been set so far. */}
        <div className="admin-form-group">
          <label>
            {SLOT_OPTIONS.find(o => o.value === activeSlot)?.label}
            {subscription.planType === "monthly" ? ` — ${WEEK_LABELS[activeWeek]}` : " — Week 1 (repeats every week)"}
          </label>

          {dishesForActiveSlot.length === 0 ? (
            <p className="sub-no-dishes">
              No dishes are tagged for this slot yet. Add the "{SLOT_OPTIONS.find(o => o.value === activeSlot)?.label}" slot to a dish on the Dishes page first.
            </p>
          ) : (
            <>
              {/* STEP 1 — narrow down to one dish via Category → SubCategory. */}
              <div className="horizontal-form-group sub-picker-row">
                <div className="admin-form-group">
                  <CustomDropdown
                    label="Category"
                    value={pickerCategoryId}
                    onChange={val => { setPickerCategoryId(val); setPickerSubCategoryId(""); setPickerDishId(""); }}
                    options={categoriesForActiveSlot.map(c => ({ value: c.id, label: c.name }))}
                    placeholder="Select Category"
                  />
                </div>

                {pickerCategoryId && subCategoriesForPicker.length > 0 && (
                  <div className="admin-form-group">
                    <CustomDropdown
                      label="Sub-Category"
                      value={pickerSubCategoryId}
                      onChange={val => { setPickerSubCategoryId(val); setPickerDishId(""); }}
                      options={subCategoriesForPicker.map(s => ({ value: s.id, label: s.name }))}
                      placeholder="All / Category dishes"
                    />
                  </div>
                )}

                {pickerCategoryId && (
                  <div className="admin-form-group">
                    <CustomDropdown
                      label="Dish"
                      value={pickerDishId}
                      onChange={val => setPickerDishId(val)}
                      options={dishesForPicker.map(d => ({ value: d.id, label: `${d.name} — ₹${Math.round(d.basePrice || 0)}` }))}
                      placeholder={dishesForPicker.length === 0 ? "No dishes here" : "Select Dish"}
                    />
                  </div>
                )}
              </div>

              {/* STEP 2 — tick the days this dish should be served on. */}
              {pickerDishId && (
                <div className="sub-dish-days-picker">
                  <span className="sub-dish-days-picker-label">
                    Serve <strong>{dishLabel(pickerDishId)}</strong> on:
                  </span>
                  <div className="sub-day-chip-row">
                    {DAYS.map(({ key, label }) => {
                      const cellValue = subscription.slots?.[activeSlot]?.[weekForCell]?.[key];
                      const dayIds = Array.isArray(cellValue) ? cellValue : (cellValue ? [cellValue] : []);
                      const checked = dayIds.includes(pickerDishId);
                      return (
                        <label
                          key={key}
                          className={`sub-day-checkbox${checked ? " is-checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCellDish(activeSlot, weekForCell, key, pickerDishId)}
                          />
                          <span className="sub-day-checkbox-box" aria-hidden="true" />
                          <span className="sub-day-checkbox-label">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {!pickerDishId && (
                <p className="sub-no-dishes">
                  {!pickerCategoryId
                    ? "Pick a category, then a dish, to choose which days it's served."
                    : "Pick a dish above to choose which days it's served."}
                </p>
              )}

              {/* Everything already scheduled for this slot/week — one
                  row per dish, with the days it's on and a quick remove.
                  This is the plain-language record of what's been set so
                  far, independent of the picker above. */}
              <div className="sub-scheduled-dishes">
                <span className="sub-scheduled-dishes-label">Already scheduled for this {subscription.planType === "monthly" ? "week" : "slot"}:</span>
                {(() => {
                  const byDish = new Map();
                  DAYS.forEach(({ key, label }) => {
                    const cellValue = subscription.slots?.[activeSlot]?.[weekForCell]?.[key];
                    const dayIds = Array.isArray(cellValue) ? cellValue : (cellValue ? [cellValue] : []);
                    dayIds.forEach(id => {
                      if (!byDish.has(id)) byDish.set(id, []);
                      byDish.get(id).push(label);
                    });
                  });
                  if (byDish.size === 0) {
                    return <p className="sub-no-dishes">Nothing scheduled yet for this slot.</p>;
                  }
                  return (
                    <div className="sub-scheduled-dish-list">
                      {Array.from(byDish.entries()).map(([dishId, dayLabels]) => (
                        <div className="sub-scheduled-dish-row" key={dishId}>
                          <span className="sub-scheduled-dish-name">{dishLabel(dishId)}</span>
                          <span className="sub-scheduled-dish-days">{dayLabels.join(", ")}</span>
                          <button
                            type="button"
                            className="sub-scheduled-dish-remove"
                            onClick={() => {
                              DAYS.forEach(({ key }) => {
                                const cellValue = subscription.slots?.[activeSlot]?.[weekForCell]?.[key];
                                const dayIds = Array.isArray(cellValue) ? cellValue : (cellValue ? [cellValue] : []);
                                if (dayIds.includes(dishId)) toggleCellDish(activeSlot, weekForCell, key, dishId);
                              });
                            }}
                            title={`Remove ${dishLabel(dishId)} from every day this week`}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {formErrors.slots && (
          <p className="sub-error-text">Select at least one dish in at least one slot/day before saving.</p>
        )}
      </div>

      <div className="sub-builder-col sub-builder-col-right">
        {/* SUMMARY TABLE — exact dish / day / slot (+ week, if monthly) */}
        <div className="admin-form-group">
          <label>Summary</label>
          {scheduledRows.length === 0 ? (
            <p className="sub-no-dishes">Nothing scheduled yet.</p>
          ) : (
            <div className="sub-summary-table-wrap">
              <table className="sub-summary-table">
                <thead>
                  <tr>
                    <th>Dish Name</th>
                    <th>Slot</th>
                    <th>Day</th>
                    {subscription.planType === "monthly" && <th>Week</th>}
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledRows.map((row, idx) => (
                    <tr key={`${row.slot}-${row.week}-${row.dayKey}-${idx}`}>
                      <td>{dishLabel(row.dishId)}</td>
                      <td>{row.slotLabel}</td>
                      <td>{row.dayLabel}</td>
                      {subscription.planType === "monthly" && <td>{WEEK_LABELS[row.week]}</td>}
                      <td>₹{Math.round(dishById[row.dishId]?.basePrice || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PRICE TOTAL */}
        <div className="admin-form-group">
          <div className="sub-total-row">
            <span>Total Meals Scheduled</span>
            <strong>{filledCellCount}</strong>
          </div>
          <div className="sub-total-row sub-total-row-price">
            <span>Total Price (per month)</span>
            <strong>₹{totalPrice}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubBuilderFields;
