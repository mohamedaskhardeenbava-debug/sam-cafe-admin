/**
 * OfferDetails.js  —  Sam Cafe Admin Panel
 * Single offer detail/edit page
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";
import { CustomDatePicker } from "../components/CustomDatePicker";

import editIcon from "../icon/edit-icon.png";
import { CustomTimePicker } from "../components/CustomTimePicker";
import CustomDropdown from "../components/CustomDropdown";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";

import "./OfferDetails.css";
import PageLoader from "../components/PageLoader";

const OfferDetails = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const { offerId } = useParams();
  const navigate = useNavigate();

  const offer = adminData.offers.find(o => o.id === offerId);

  const [localOffer, setLocalOffer] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // flatten dishes (same logic as Offers page)
  const allDishes = adminData.categories.flatMap(cat => [
    ...(cat.dishes || []).map(d => ({ ...d, categoryId: cat.id })),
    ...(cat.subCategories || []).flatMap(sub =>
      (sub.dishes || []).map(d => ({ ...d, categoryId: sub.id }))
    )
  ]);

  useEffect(() => {
    if (offer) {
      setLocalOffer(JSON.parse(JSON.stringify(offer)));
    }
  }, [offer]);

  if (!localOffer) return <PageLoader label="Loading offer…" />;

  const selectedDish = allDishes.find(d => d.id === localOffer.dishId);
  const originalPrice = Math.round(selectedDish?.basePrice || localOffer.originalPrice || 0);
  const isFlat = localOffer.discountType === "flat";
  // Flat discounts are clamped to the dish's price so a mistyped flat
  // amount can never push the offer price below zero.
  const offerAmount = isFlat
    ? Math.round(Math.min(Number(localOffer.flatAmount) || 0, originalPrice))
    : Math.round((originalPrice * (Number(localOffer.percentage) || 0)) / 100);
  const offerPrice = Math.round(originalPrice - offerAmount);

  /* ---------------- SAVE ---------------- */
  const persistOffer = async () => {
    // Every offer always carries a `percentage`, even flat ones — it's
    // derived from the flat amount so any code reading offer.percentage
    // downstream (e.g. the user-panel pricing helpers) keeps working.
    const derivedPercentage = isFlat
      ? Math.round((offerAmount / (originalPrice || 1)) * 100)
      : Number(localOffer.percentage) || 0;

    const payload = {
      ...localOffer,
      percentage: derivedPercentage,
      ...(isFlat ? { flatAmount: Number(localOffer.flatAmount) || 0 } : {}),
      originalPrice,
      offerAmount,
      offerPrice
    };

    try {
      await api.put(`/offers/${offerId}`, payload);

      setAdminData(prev => ({
        ...prev,
        offers: prev.offers.map(o =>
          o.id === offerId ? payload : o
        )
      }));

      setLocalOffer(payload);
      setIsEditing(false);
      toast.success("Offer updated");

    } catch (err) {
      toast.error("Failed to update offer");
      console.error("Failed to update offer", err);
    }
  };

  const resetEditState = () => {
    setIsEditing(false);
    setLocalOffer(JSON.parse(JSON.stringify(offer)));
  };

  return (
    <div className="details-container">

      {/* HEADER */}
      <div className="details-header">
        <button
          className="back-btn"
          onClick={() => {
            resetEditState();
            navigate(-1);
          }}
        />
        <h2>{selectedDish?.name || "Offer"}</h2>

        {!isEditing && (
          <Button3D variant="cancel" onClick={() => setIsEditing(true)}>
            <img src={editIcon} alt="edit" />
            Edit
          </Button3D>
        )}
      </div>

      <div className="details-body">
        {/* DISH */}
        <div className="section">
          <div className="section-title">
            <span>Dish</span>
          </div>

          {isEditing ? (
            <CustomDropdown
              label="Dish"
              required
              value={localOffer.dishId}
              onChange={(val) => {
                const d = allDishes.find(x => x.id === val);
                setLocalOffer({ ...localOffer, dishId: val, categoryId: d?.categoryId || "" });
              }}
              options={allDishes.map(d => ({ value: d.id, label: d.name }))}
              placeholder="Select Dish"
            />
          ) : (
            <p>{selectedDish?.name}</p>
          )}
        </div>

        {/* DISCOUNT TYPE */}
        <div className="section">
          <div className="section-title">
            <span>Discount Type</span>
          </div>

          {isEditing ? (
            <CustomDropdown
              label="Discount Type"
              value={localOffer.discountType || "percentage"}
              onChange={(val) => setLocalOffer({ ...localOffer, discountType: val })}
              options={[
                { value: "percentage", label: "Percentage (%)" },
                { value: "flat", label: "Flat Amount (₹)" }
              ]}
              placeholder="Select Discount Type"
            />
          ) : (
            <p>{isFlat ? "Flat Amount" : "Percentage"}</p>
          )}
        </div>

        {/* DISCOUNT VALUE */}
        <div className="section">
          <div className="section-title">
            <span>{isFlat ? "Flat Discount (₹)" : "Offer %"}</span>
          </div>

          {isEditing ? (
            isFlat ? (
              <input
                className="mat-input"
                placeholder=" "
                type="number"
                min="1"
                value={localOffer.flatAmount || ""}
                onChange={(e) => setLocalOffer({ ...localOffer, flatAmount: Number(e.target.value) })}
              />
            ) : (
              <input
                className="mat-input"
                placeholder=" "
                type="number"
                min="1"
                max="100"
                value={localOffer.percentage}
                onChange={(e) => setLocalOffer({ ...localOffer, percentage: Number(e.target.value) })}
              />
            )
          ) : (
            <p>{isFlat ? `₹${localOffer.flatAmount ?? offerAmount}` : `${localOffer.percentage}%`}</p>
          )}
        </div>

        {/* PRICE BREAKDOWN */}
        <div className="section">
          <div className="section-title">
            <span>Price Details</span>
          </div>

          <table className="data-table">
            <tbody>
              <tr>
                <td>Original Price</td>
                <td>₹{originalPrice}</td>
              </tr>
              <tr>
                <td>{isFlat ? "Flat Discount" : "Discount"}</td>
                <td>₹{offerAmount}</td>
              </tr>
              <tr>
                <td>Final Price</td>
                <td>₹{offerPrice}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="horizontal-form-group" style={{ flex: "1 1" }}>
          {/* START DATE */}
          <div className="section">
            <div className="section-title">
              <span>Start Date</span>
            </div>

            {isEditing ? (
              <div className="horizontal-form-group" style={{ flex: "1 1" }}>
                <CustomDatePicker
                  value={localOffer.startDate}
                  onChange={(v) => setLocalOffer({ ...localOffer, startDate: v })}
                  placeholder="Select date"
                />
                <CustomTimePicker
                  value={localOffer.startTime || ""}
                  onChange={(v) => setLocalOffer({ ...localOffer, startTime: v })}
                />
              </div>
            ) : (
              <p>{localOffer.startDate}{localOffer.startTime ? ` · ${localOffer.startTime}` : ""}</p>
            )}
          </div>

          {/* END DATE */}
          <div className="section">
            <div className="section-title">
              <span>End Date</span>
            </div>

            {isEditing ? (
              <div className="horizontal-form-group" style={{ flex: "1 1" }}>
                <CustomDatePicker
                  value={localOffer.endDate}
                  onChange={(v) => setLocalOffer({ ...localOffer, endDate: v })}
                  placeholder="Select date"
                />
                <CustomTimePicker
                  value={localOffer.endTime || ""}
                  onChange={(v) => setLocalOffer({ ...localOffer, endTime: v })}
                />
              </div>
            ) : (
              <p>{localOffer.endDate}{localOffer.endTime ? ` · ${localOffer.endTime}` : ""}</p>
            )}
          </div>

          {/* STATUS */}
          <div className="section">
            <div className="section-title">
              <span>Status</span>
            </div>

            {isEditing ? (
              <CustomDropdown
                label="Status"
                value={localOffer.active}
                onChange={(val) => setLocalOffer({ ...localOffer, active: val })}
                options={[
                  { value: "yes", label: "Active" },
                  { value: "no", label: "Inactive" },
                ]}
                placeholder="Select status"
              />
            ) : (
              <p>{localOffer.active === "yes" ? "Active" : "Inactive"}</p>
            )}
          </div>
        </div>
      </div>

      {/* STICKY SAVE / CANCEL BAR */}
      {isEditing && (
        <div className="details-footer">
          <Button3D variant="cancel" onClick={resetEditState}>Cancel</Button3D>
          <Button3D onClick={persistOffer}>Save</Button3D>
        </div>
      )}

    </div>
  );
};

export default OfferDetails;