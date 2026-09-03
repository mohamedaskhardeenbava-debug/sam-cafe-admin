/**
 * useSubscriptionBuilder.js  —  Sam Cafe Admin Panel
 *
 * All the state + derived data behind the "pick dish → tap days" meal
 * schedule builder — extracted out of Subscriptions.js so the exact
 * same logic drives both the "+ New Subscription" modal (Subscriptions.js)
 * and the Edit mode on a single subscription's detail page
 * (SubscriptionDetails.js), instead of two copies drifting apart.
 *
 * A subscription is a 4-week (1 month) meal plan. For each of the 5 meal
 * slots (breakfast, brunch, lunch, hi-tea, dinner) the admin picks which
 * dish(es) (if any) are served on which day of week 1..4. A day can hold
 * more than one dish, or be left empty. "Weekly repeat" mode fills weeks
 * 2-4 automatically from week 1 (same dishes every week); "Custom per
 * week" lets each of the 4 weeks be configured independently. The total
 * price is the sum of the base price of every dish placed anywhere in
 * the plan.
 */

import { useState, useMemo } from "react";

// Meal slots — kept in sync with the dish "Slot" field (Dishes.js).
export const SLOT_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "brunch", label: "Brunch" },
  { value: "lunch", label: "Lunch" },
  { value: "hi-tea", label: "Hi-Tea" },
  { value: "dinner", label: "Dinner" },
];

export const WEEKS = ["week1", "week2", "week3", "week4"];
export const WEEK_LABELS = { week1: "Week 1", week2: "Week 2", week3: "Week 3", week4: "Week 4" };
export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Builds an empty { mon: [], tue: [], ... sun: [] } day map — each day
// holds an array of dish ids (0, 1, or many).
const emptyDayMap = () => DAYS.reduce((acc, d) => ({ ...acc, [d.key]: [] }), {});

// Builds an empty { week1: {...emptyDayMap}, week2: {...}, week3: {...}, week4: {...} }.
const emptyWeekMap = () => WEEKS.reduce((acc, w) => ({ ...acc, [w]: emptyDayMap() }), {});

// Builds an empty slots object: one week-map per meal slot.
const emptySlotsMap = () =>
  SLOT_OPTIONS.reduce((acc, s) => ({ ...acc, [s.value]: emptyWeekMap() }), {});

export const EMPTY_SUBSCRIPTION = {
  customerName: "",
  customerPhone: "",
  planType: "weekly", // "weekly" (week1 repeats to 2-4) | "monthly" (each week set independently)
  startDate: "",
  status: "active",
  slots: emptySlotsMap(),
};

// Every (slot, week, day, dish) cell with a dish in it, as a flat list —
// the shared source for both the summary table and the total-price/meal-
// count calculations, so they can never disagree with each other. Each
// day can hold more than one dish, so a cell's value may be an array of
// dish ids — but old records saved before multi-select was added may
// still have a single dish id string, so both shapes are normalized here.
export function flattenScheduledCells(slots, planType) {
  const rows = [];
  SLOT_OPTIONS.forEach(({ value: slot, label: slotLabel }) => {
    const weeksToShow = planType === "monthly" ? WEEKS : ["week1"];
    weeksToShow.forEach(week => {
      DAYS.forEach(({ key, label: dayLabel }) => {
        const cell = slots?.[slot]?.[week]?.[key];
        const dishIds = Array.isArray(cell) ? cell : (cell ? [cell] : []);
        dishIds.forEach(dishId => {
          if (dishId) rows.push({ slot, slotLabel, week, dayKey: key, dayLabel, dishId });
        });
      });
    });
  });
  return rows;
}

/**
 * useSubscriptionBuilder(adminData, initialSubscription)
 *
 * `initialSubscription` seeds the working copy — pass EMPTY_SUBSCRIPTION
 * (or a deep clone of it) for the "create" flow, or an existing
 * subscription record for the "edit" flow. The hook owns its own
 * `subscription` state from that point on; the caller reads back
 * `subscription`/`totalPrice`/etc. and calls `resetTo(record)` to reseed
 * it (e.g. when the user cancels an edit).
 */
export function useSubscriptionBuilder(adminData, initialSubscription) {
  const [subscription, setSubscription] = useState(
    () => JSON.parse(JSON.stringify(initialSubscription))
  );

  const [activeSlot, setActiveSlotState] = useState(SLOT_OPTIONS[0].value);
  const [activeWeek, setActiveWeek] = useState("week1");
  const [pickerCategoryId, setPickerCategoryId] = useState("");
  const [pickerSubCategoryId, setPickerSubCategoryId] = useState("");
  const [pickerDishId, setPickerDishId] = useState("");

  // Flatten all dishes across categories/subCategories, same pattern used
  // by Dishes.js / Offers.js, and keep each dish's slot list + price for
  // filtering the per-slot dropdown and computing the running total.
  const allDishes = useMemo(
    () =>
      (adminData?.categories || []).flatMap(cat => [
        ...(cat.dishes || []).map(d => ({ ...d, categoryId: cat.id, subCategoryId: null })),
        ...(cat.subCategories || []).flatMap(sub =>
          (sub.dishes || []).map(d => ({ ...d, categoryId: cat.id, subCategoryId: sub.id }))
        )
      ]),
    [adminData?.categories]
  );

  const dishById = useMemo(() => {
    const map = {};
    allDishes.forEach(d => { map[d.id] = d; });
    return map;
  }, [allDishes]);

  // Only offer dishes tagged for the slot currently being edited — a dish
  // with no `slots` field (not yet migrated / no slot chosen) is left out,
  // since it hasn't been marked available in any slot yet.
  const dishesForActiveSlot = useMemo(
    () => allDishes.filter(d => (d.slots || []).includes(activeSlot)),
    [allDishes, activeSlot]
  );

  // Category → SubCategory → Dish cascade, scoped to whatever dishes are
  // actually available in the active slot, so a category with no dishes
  // in this slot never shows up as a dead end.
  const categoriesForActiveSlot = useMemo(() => {
    const catIds = new Set(dishesForActiveSlot.map(d => d.categoryId));
    return (adminData?.categories || []).filter(c => catIds.has(c.id));
  }, [adminData?.categories, dishesForActiveSlot]);

  const subCategoriesForPicker = useMemo(() => {
    if (!pickerCategoryId) return [];
    const cat = (adminData?.categories || []).find(c => c.id === pickerCategoryId);
    if (!cat) return [];
    const subIds = new Set(
      dishesForActiveSlot
        .filter(d => d.categoryId === pickerCategoryId && d.subCategoryId)
        .map(d => d.subCategoryId)
    );
    return (cat.subCategories || []).filter(s => subIds.has(s.id));
  }, [adminData?.categories, pickerCategoryId, dishesForActiveSlot]);

  const dishesForPicker = useMemo(() => {
    if (!pickerCategoryId) return [];
    return dishesForActiveSlot.filter(d => {
      if (d.categoryId !== pickerCategoryId) return false;
      // If the category has subcategories being used for filtering, only
      // show dishes belonging to the chosen subcategory (or the
      // category's own direct dishes when subCategoryId is null and no
      // subcategory filter is active).
      if (subCategoriesForPicker.length > 0) {
        return pickerSubCategoryId
          ? d.subCategoryId === pickerSubCategoryId
          : !d.subCategoryId; // direct category dishes, shown before a subcategory is picked
      }
      return true;
    });
  }, [dishesForActiveSlot, pickerCategoryId, pickerSubCategoryId, subCategoriesForPicker]);

  // Switching the active slot always clears the in-progress picker
  // selections — a category/dish chosen for "Breakfast" has no bearing
  // once the admin moves on to "Lunch".
  const switchActiveSlot = (slot) => {
    setActiveSlotState(slot);
    setPickerCategoryId("");
    setPickerSubCategoryId("");
    setPickerDishId("");
  };

  // Toggles a dish in/out of one slot/week/day cell (a day can hold more
  // than one dish). In "weekly" plans, editing week1 mirrors the same
  // change into weeks 2-4 automatically since the whole point of that
  // mode is one recurring weekly pattern; "monthly" plans only touch the
  // exact week being edited.
  const toggleCellDish = (slot, week, dayKey, dishId) => {
    setSubscription(prev => {
      const nextSlots = { ...prev.slots };
      const weeksToUpdate = prev.planType === "weekly" ? WEEKS : [week];

      const nextSlotWeeks = { ...nextSlots[slot] };
      weeksToUpdate.forEach(w => {
        const existing = nextSlotWeeks[w]?.[dayKey];
        const currentIds = Array.isArray(existing) ? existing : (existing ? [existing] : []);
        const nextIds = currentIds.includes(dishId)
          ? currentIds.filter(id => id !== dishId)
          : [...currentIds, dishId];
        nextSlotWeeks[w] = { ...nextSlotWeeks[w], [dayKey]: nextIds };
      });
      nextSlots[slot] = nextSlotWeeks;

      return { ...prev, slots: nextSlots };
    });
  };

  // Switching plan type doesn't touch dishes already picked — "weekly"
  // just means further edits to week1 propagate; existing week2-4 data
  // (if any) from a prior "monthly" pass is left as-is until re-edited.
  const setPlanType = (planType) => {
    setSubscription(prev => ({ ...prev, planType }));
  };

  const patchField = (field, value) => {
    setSubscription(prev => ({ ...prev, [field]: value }));
  };

  // Flat list of every scheduled (slot, week, day, dish) cell — feeds
  // both the summary table and the totals below, so they always match.
  const scheduledRows = useMemo(
    () => flattenScheduledCells(subscription.slots, subscription.planType),
    [subscription.slots, subscription.planType]
  );

  // Running total: sum of every dish's basePrice across every
  // slot/week/day it appears in. Empty days simply contribute nothing.
  const totalPrice = useMemo(() => {
    const sum = scheduledRows.reduce((acc, row) => {
      const dish = dishById[row.dishId];
      return acc + (dish ? Number(dish.basePrice) || 0 : 0);
    }, 0);
    return Math.round(sum);
  }, [scheduledRows, dishById]);

  const filledCellCount = scheduledRows.length;

  // Small helper to render a dish's name for a scheduled cell.
  const dishLabel = (dishId) => (dishId ? (dishById[dishId]?.name || "—") : "—");

  // Reseeds the whole working copy (e.g. Cancel on an edit page, or
  // clearing the create-modal form) and clears any in-progress picker
  // state along with it.
  const resetTo = (record) => {
    setSubscription(JSON.parse(JSON.stringify(record)));
    setActiveSlotState(SLOT_OPTIONS[0].value);
    setActiveWeek("week1");
    setPickerCategoryId("");
    setPickerSubCategoryId("");
    setPickerDishId("");
  };

  return {
    subscription,
    setSubscription,
    patchField,

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

    allDishes,
    dishById,
    dishesForActiveSlot,
    categoriesForActiveSlot,
    subCategoriesForPicker,
    dishesForPicker,

    toggleCellDish,
    setPlanType,
    dishLabel,

    scheduledRows,
    totalPrice,
    filledCellCount,

    resetTo,
  };
}
