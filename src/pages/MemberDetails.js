/**
 * MemberDetails.js  —  Sam Cafe Admin Panel
 * Single subscription-member detail/edit page
 *
 * A "member" isn't its own database record — it's every subscription
 * sharing the same customerPhone (falling back to customerName if a
 * record has no phone), rolled up into one profile, mirroring the
 * grouping Subscriptions.js's Members tab already does. Editing a
 * member's name/phone here updates every one of their subscription
 * records at once (PUT one at a time), since that's the only place
 * the customer's identity is actually stored.
 */

import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";
import editIcon from "../icon/edit-icon.png";
import { allowTextInput } from "../App";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";

import { SLOT_OPTIONS, WEEKS, DAYS } from "./subscriptions/useSubscriptionBuilder";

import "./Common.css";
import "./Subscriptions.css";
import "./SubscriptionDetails.css";

const MemberDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { memberPhone } = useParams();
  const navigate = useNavigate();
  const key = decodeURIComponent(memberPhone || "");

  const memberSubscriptions = useMemo(
    () => (adminData.subscriptions || []).filter(s => (s.customerPhone || s.customerName) === key),
    [adminData.subscriptions, key]
  );

  const latest = useMemo(
    () => [...memberSubscriptions].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))[0],
    [memberSubscriptions]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  if (memberSubscriptions.length === 0) {
    return (
      <div className="details-container">
        <div className="details-header">
          <button className="back-btn" onClick={() => navigate(-1)} />
          <h2>Member</h2>
        </div>
        <div className="section">
          <p style={{ color: "#a3a3a3", fontSize: 14, margin: 0 }}>Member not found.</p>
        </div>
      </div>
    );
  }

  const memberName = latest?.customerName || "";
  const memberPhoneVal = latest?.customerPhone || "";
  const activeCount = memberSubscriptions.filter(s => (s.status || "active") === "active").length;
  const totalSpend = Math.round(memberSubscriptions.reduce((acc, s) => acc + (Number(s.totalPrice) || 0), 0));

  const startEditing = () => {
    setDraftName(memberName);
    setDraftPhone(memberPhoneVal);
    setFormErrors({});
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFormErrors({});
    setIsEditing(false);
  };

  // Renames/re-numbers the member by updating every one of their
  // subscription records — there's no separate "member" row to PUT.
  const persistChanges = async () => {
    const errs = {};
    if (!draftName.trim()) errs.name = true;
    if (!draftPhone.trim()) errs.phone = true;
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const updates = await Promise.all(
        memberSubscriptions.map(sub => {
          const payload = { ...sub, customerName: draftName.trim(), customerPhone: draftPhone.trim() };
          return api.put(`/subscriptions/${sub.id}`, payload).then(() => payload);
        })
      );

      setAdminData(prev => ({
        ...prev,
        subscriptions: (prev.subscriptions || []).map(s => {
          const updated = updates.find(u => u.id === s.id);
          return updated || s;
        }),
      }));

      toast.success("Member updated");
      setIsEditing(false);

      // The URL key is the phone number — if it changed, the old URL
      // no longer resolves to this member, so follow it to the new one.
      if (draftPhone.trim() !== key) {
        navigate(`/subscriptions/members/${encodeURIComponent(draftPhone.trim())}`, { replace: true });
      }
    } catch (err) {
      console.error("Failed to update member:", err);
      toast.error("Failed to update member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button
          className="back-btn"
          onClick={() => { if (isEditing) cancelEditing(); navigate(-1); }}
        />
        <h2>{memberName || "Member"}</h2>

        {!isEditing && (
          <Button3D variant="cancel" onClick={startEditing}>
            <img src={editIcon} alt="edit" />
            Edit
          </Button3D>
        )}
      </div>

      <div className="details-body">
        {/* PROFILE */}
        <div className="horizontal-form-group" style={{ flex: "1 1" }}>
          <div className="section">
            <div className="section-title"><span>Name</span></div>
            {isEditing ? (
              <div className="mat">
                <input
                  className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                  placeholder=" "
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(allowTextInput(draftName, e.target.value, 100, 8));
                    setFormErrors(p => ({ ...p, name: false }));
                  }}
                />
                <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
              </div>
            ) : (
              <p>{memberName || "—"}</p>
            )}
          </div>

          <div className="section">
            <div className="section-title"><span>Phone</span></div>
            {isEditing ? (
              <div className="mat">
                <input
                  className={`mat-input${formErrors.phone ? " mat-error" : ""}`}
                  placeholder=" "
                  value={draftPhone}
                  onChange={(e) => {
                    setDraftPhone(allowTextInput(draftPhone, e.target.value, 20, 3));
                    setFormErrors(p => ({ ...p, phone: false }));
                  }}
                />
                <span className={`mat-bar${formErrors.phone ? " mat-bar-error" : ""}`} />
              </div>
            ) : (
              <p>{memberPhoneVal || "—"}</p>
            )}
          </div>
        </div>

        {/* SUMMARY STATS */}
        <div className="horizontal-form-group" style={{ flex: "1 1" }}>
          <div className="section">
            <div className="section-title"><span>Total Subscriptions</span></div>
            <p>{memberSubscriptions.length}</p>
          </div>
          <div className="section">
            <div className="section-title"><span>Active Subscriptions</span></div>
            <p>{activeCount}</p>
          </div>
          <div className="section">
            <div className="section-title"><span>Total Spend</span></div>
            <p>₹{totalSpend}</p>
          </div>
        </div>

        {/* SUBSCRIPTIONS LIST — one row per plan this member has, linking
            into SubscriptionDetails.js for the full schedule + edit. */}
        <div className="section">
          <div className="section-title"><span>Subscriptions</span></div>
          <div className="sub-schedule-groups">
            {memberSubscriptions
              .slice()
              .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))
              .map(sub => {
                const usedSlots = SLOT_OPTIONS.filter(({ value }) =>
                  WEEKS.some(w => DAYS.some(({ key: dayKey }) => {
                    const cell = sub.slots?.[value]?.[w]?.[dayKey];
                    return Array.isArray(cell) ? cell.length > 0 : !!cell;
                  }))
                ).map(s => s.label);

                return (
                  <div className="sub-schedule-group" key={sub.id}>
                    <div
                      className="sub-schedule-group-title clickable"
                      onClick={() => navigate(`/subscriptions/${sub.id}`)}
                    >
                      {sub.planType === "monthly" ? "Custom / Monthly" : "Weekly Repeat"} — started {sub.startDate || "—"}
                    </div>
                    <div className="sub-scheduled-dish-row sub-scheduled-dish-row--readonly">
                      <span className="sub-scheduled-dish-name">{usedSlots.length ? usedSlots.join(", ") : "No slots scheduled"}</span>
                      <span className="sub-scheduled-dish-days">₹{sub.totalPrice ?? 0} / month</span>
                      <span className={`sub-status-badge ${sub.status || "active"}`}>
                        {(sub.status || "active").charAt(0).toUpperCase() + (sub.status || "active").slice(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
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

export default MemberDetails;
