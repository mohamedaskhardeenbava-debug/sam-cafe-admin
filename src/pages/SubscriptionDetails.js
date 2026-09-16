/**
 * SubscriptionDetails.js  —  Sam Cafe Admin Panel
 * Single subscription detail/edit page
 *
 * View mode shows the customer's plan (contact info, plan type, start
 * date, status, and the full weekly/monthly meal schedule) as read-only
 * text. Edit mode swaps in the exact same "pick dish → tap days" builder
 * used by the "+ New Subscription" modal on Subscriptions.js — both
 * share useSubscriptionBuilder()/SubBuilderFields.js so there's only one
 * implementation of the schedule builder to keep in sync.
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";
import editIcon from "../icon/edit-icon.png";
import { allowTextInput } from "../App";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CustomDropdown from "../components/CustomDropdown";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { todayStr } from "../utils/dateRangeUtils";
import { fmtDate } from "../utils/dateUtils";

import { useSubscriptionBuilder, SLOT_OPTIONS, WEEKS, WEEK_LABELS, DAYS, flattenScheduledCells } from "./subscriptions/useSubscriptionBuilder";
import SubBuilderFields from "./subscriptions/SubBuilderFields";

import "./Common.css";
import "./Subscriptions.css";
import "./SubscriptionDetails.css";

const SubscriptionDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { subscriptionId } = useParams();
  const navigate = useNavigate();

  const subscription = (adminData.subscriptions || []).find(s => s.id === subscriptionId);

  const [isEditing, setIsEditing] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // The builder hook needs a record to seed from — it's only actually
  // used once `subscription` exists, but hooks can't be called
  // conditionally, so it's given an empty shell up front and reseeded
  // via resetTo() the moment the real record is available/changes.
  const builder = useSubscriptionBuilder(adminData, subscription || { slots: {}, planType: "weekly" });
  const { resetTo } = builder;

  useEffect(() => {
    if (subscription) resetTo(subscription);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription?.id]);

  if (!subscription) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <h2>Subscription</h2>
        </div>
        <div className="section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Subscription not found.</p>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    resetTo(subscription);
    setFormErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    resetTo(subscription);
    setFormErrors({});
    setIsEditing(false);
  };

  const persistChanges = async () => {
    const { subscription: draft, filledCellCount, totalPrice } = builder;
    const errs = {};
    if (!draft.customerName.trim()) errs.customerName = true;
    if (!draft.customerPhone.trim() || draft.customerPhone.replace(/\D/g, "").length !== 10) errs.customerPhone = true;
    if (!draft.addrDoorNo?.trim()) errs.addrDoorNo = true;
    if (!draft.addrStreet?.trim()) errs.addrStreet = true;
    if (!draft.addrArea?.trim()) errs.addrArea = true;
    if (!draft.addrCity?.trim()) errs.addrCity = true;
    if (!draft.addrDistrict?.trim()) errs.addrDistrict = true;
    if (!draft.addrState?.trim()) errs.addrState = true;
    if (!draft.addrPincode || draft.addrPincode.length !== 6) errs.addrPincode = true;
    if (!draft.startDate) errs.startDate = true;
    if (filledCellCount === 0) errs.slots = true;
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      if (errs.slots) toast.warning("Select at least one dish for at least one slot/day.");
      return;
    }

    const payload = { ...draft, totalPrice };

    setSaving(true);
    try {
      await api.put(`/subscriptions/${subscriptionId}`, payload);
      setAdminData(prev => ({
        ...prev,
        subscriptions: (prev.subscriptions || []).map(s => s.id === subscriptionId ? payload : s),
      }));
      toast.success("Subscription updated");
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update subscription:", err);
      toast.error("Failed to update subscription");
    } finally {
      setSaving(false);
    }
  };

  // Read-only schedule summary — every scheduled dish grouped by slot
  // (and week, for monthly plans), same data flattenScheduledCells()
  // already produces for the builder's own Summary table.
  const scheduleGroups = (() => {
    const rows = flattenScheduledCells(subscription.slots, subscription.planType);
    const byKey = new Map();
    rows.forEach(row => {
      const key = subscription.planType === "monthly" ? `${row.slot}__${row.week}` : row.slot;
      if (!byKey.has(key)) byKey.set(key, { slot: row.slot, slotLabel: row.slotLabel, week: row.week, dishes: new Map() });
      const group = byKey.get(key);
      if (!group.dishes.has(row.dishId)) group.dishes.set(row.dishId, []);
      group.dishes.get(row.dishId).push(row.dayLabel);
    });
    return Array.from(byKey.values());
  })();

  const usedSlots = SLOT_OPTIONS.filter(({ value }) =>
    WEEKS.some(w => DAYS.some(({ key }) => {
      const cell = subscription.slots?.[value]?.[w]?.[key];
      return Array.isArray(cell) ? cell.length > 0 : !!cell;
    }))
  );

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button
          className="back-btn"
          onClick={() => { if (isEditing) cancelEditing(); navigate(-1); }}
        />
        <h2>{subscription.customerName || "Subscription"}</h2>

        {!isEditing && (
          <Button3D variant="cancel" onClick={startEditing}>
            <img src={editIcon} alt="edit" />
            Edit
          </Button3D>
        )}
      </div>

      <div className="details-body">
        {isEditing ? (
          <>
            {/* CONTACT + PLAN META (edit mode) */}
            <div className="horizontal-form-group">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.customerName ? " mat-error" : ""}`}
                    placeholder=" "
                    value={builder.subscription.customerName}
                    onChange={(e) => {
                      builder.patchField("customerName", allowTextInput(builder.subscription.customerName, e.target.value, 100, 5));
                      setFormErrors(p => ({ ...p, customerName: false }));
                    }}
                  />
                  <label className={`mat-label${formErrors.customerName ? " mat-label-error" : ""}`}>Customer Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.customerName ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.customerPhone ? " mat-error" : ""}`}
                    placeholder=" "
                    type="tel"
                    value={builder.subscription.customerPhone}
                    onChange={(e) => {
                      builder.patchField("customerPhone", e.target.value.replace(/\D/g, "").slice(0, 10));
                      setFormErrors(p => ({ ...p, customerPhone: false }));
                    }}
                  />
                  <label className={`mat-label${formErrors.customerPhone ? " mat-label-error" : ""}`}>Phone Number<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.customerPhone ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group">
                <label className={`mat-label${formErrors.startDate ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Start Date<span className="rf-req">*</span></label>
                <CustomDatePicker
                  value={builder.subscription.startDate}
                  onChange={(v) => { builder.patchField("startDate", v); setFormErrors(p => ({ ...p, startDate: false })); }}
                  min={todayStr()}
                  placeholder="Select start date"
                  hasError={!!formErrors.startDate}
                />
              </div>

              <div className="admin-form-group">
                <CustomDropdown
                  label="Status"
                  value={builder.subscription.status}
                  onChange={val => builder.patchField("status", val)}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "paused", label: "Paused" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  placeholder="Select Status"
                />
              </div>
            </div>

            {/* Address — same 8-field grid as the create modal, minus the
                "use restaurant address" toggle. */}
            <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>
              Delivery Address <span style={{ fontSize: 11, color: "#888" }}>(all fields required)</span>
            </div>
            <div className="ae-addr-grid">
              {[
                { key: "addrDoorNo", label: "Door No. / Building", optional: false },
                { key: "addrStreet", label: "Street Name", optional: false },
                { key: "addrArea", label: "Area / Locality", optional: false },
                { key: "addrLandmark", label: "Landmark", optional: true },
                { key: "addrCity", label: "City", optional: false },
                { key: "addrDistrict", label: "District", optional: false },
                { key: "addrState", label: "State", optional: false },
                { key: "addrPincode", label: "Pincode", optional: false },
              ].map(field => (
                <div key={field.key} className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors[field.key] ? " mat-error" : ""}`}
                      type="text"
                      value={builder.subscription[field.key] || ""}
                      placeholder=" "
                      maxLength={field.key === "addrPincode" ? 6 : undefined}
                      onChange={e => {
                        const v = field.key === "addrPincode"
                          ? e.target.value.replace(/\D/g, "").slice(0, 6)
                          : allowTextInput(builder.subscription[field.key] || "", e.target.value, 100, 5);
                        builder.patchField(field.key, v);
                        setFormErrors(p => ({ ...p, [field.key]: false }));
                      }}
                    />
                    <label className={`mat-label${formErrors[field.key] ? " mat-label-error" : ""}`}>
                      {field.label} {!field.optional && <span className="rf-req">*</span>}
                    </label>
                    <span className={`mat-bar${formErrors[field.key] ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
              ))}
            </div>

            {/* SCHEDULE BUILDER — same component the create modal uses */}
            <SubBuilderFields builder={builder} formErrors={formErrors} />
          </>
        ) : (
          <>
            {/* CONTACT + PLAN META (view mode) */}
            <div className="horizontal-form-group">
              <div className="section">
                <div className="section-title"><span>Customer Name</span></div>
                <p>{subscription.customerName || "—"}</p>
              </div>
              <div className="section">
                <div className="section-title"><span>Phone Number</span></div>
                <p>{subscription.customerPhone || "—"}</p>
              </div>
              <div className="section">
                <div className="section-title"><span>Start Date</span></div>
                <p>{fmtDate(subscription.startDate)}</p>
              </div>
              <div className="section">
                <div className="section-title"><span>Status</span></div>
                <p>
                  <span className={`sub-status-badge ${subscription.status || "active"}`}>
                    {(subscription.status || "active").charAt(0).toUpperCase() + (subscription.status || "active").slice(1)}
                  </span>
                </p>
              </div>
            </div>

            <div className="section">
              <div className="section-title"><span>Delivery Address</span></div>
              <p>
                {[
                  subscription.addrDoorNo, subscription.addrStreet, subscription.addrArea,
                  subscription.addrLandmark, subscription.addrCity, subscription.addrDistrict,
                  subscription.addrState, subscription.addrPincode,
                ].filter(Boolean).join(", ") || "—"}
              </p>
            </div>

            <div className="section">
              <div className="section-title"><span>Plan Type</span></div>
              <p>
                <span className={`sub-plan-badge ${subscription.planType === "monthly" ? "monthly" : "weekly"}`}>
                  {subscription.planType === "monthly" ? "Custom / Monthly" : "Weekly Repeat"}
                </span>
              </p>
            </div>

            {/* SCHEDULE — read-only, grouped by slot (and week, if monthly) */}
            <div className="section">
              <div className="section-title">
                <span>Meal Schedule</span>
                <span className="sub-details-slot-summary">{usedSlots.length ? usedSlots.map(s => s.label).join(", ") : "No slots scheduled"}</span>
              </div>

              {scheduleGroups.length === 0 ? (
                <p className="sub-no-dishes">Nothing scheduled on this plan.</p>
              ) : (
                <div className="sub-schedule-groups">
                  {scheduleGroups.map(group => (
                    <div className="sub-schedule-group" key={`${group.slot}-${group.week}`}>
                      <div className="sub-schedule-group-title">
                        {group.slotLabel}
                        {subscription.planType === "monthly" && ` — ${WEEK_LABELS[group.week]}`}
                      </div>
                      <div className="sub-scheduled-dish-list">
                        {Array.from(group.dishes.entries()).map(([dishId, dayLabels]) => (
                          <div className="sub-scheduled-dish-row sub-scheduled-dish-row--readonly" key={dishId}>
                            <span className="sub-scheduled-dish-name">{builder.dishLabel(dishId)}</span>
                            <span className="sub-scheduled-dish-days">{dayLabels.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TOTALS */}
            <div className="section">
              <div className="sub-total-row">
                <span>Total Meals Scheduled</span>
                <strong>{scheduleGroups.reduce((acc, g) => acc + g.dishes.size, 0)}</strong>
              </div>
              <div className="sub-total-row sub-total-row-price">
                <span>Total Price (per month)</span>
                <strong>₹{subscription.totalPrice ?? 0}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {/* STICKY SAVE / CANCEL BAR */}
      {isEditing && (
        <div className="details-footer">
          <Button3D variant="cancel" onClick={cancelEditing} disabled={saving}>Cancel</Button3D>
          <Button3D onClick={persistChanges} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button3D>
        </div>
      )}
    </div>
  );
};

export default SubscriptionDetails;