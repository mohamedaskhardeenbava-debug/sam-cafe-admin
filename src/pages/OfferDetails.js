import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import "./OfferDetails.css";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { CustomTimePicker } from "../components/CustomTimePicker";
import { useToast } from "../useToast";

// ── CustomDropdown (floating label version) ───────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…", label, required }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
  const displayLabel = selected ? (selected.label !== undefined ? selected.label : selected) : "";
  const wrapperClass = ["mat-select", value ? "has-value" : "", open ? "is-open" : ""].filter(Boolean).join(" ");
  return (
    <div className={wrapperClass} ref={ref}>
      <div className="dishes-dropdown-wrapper">
        <button type="button" className="dishes-status-dropdown"
          onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
          {displayLabel || ""}
        </button>
        {open && (
          <div className="dropdown-menu">
            <div onClick={() => { onChange(""); setOpen(false); }}>{placeholder}</div>
            {options.map((o, i) => {
              const val = o.value !== undefined ? o.value : o;
              const lbl = o.label !== undefined ? o.label : o;
              return (
                <div key={i} onClick={() => { onChange(val); setOpen(false); }}>{lbl}</div>
              );
            })}
          </div>
        )}
      </div>
      <span className="mat-bar" />
    </div>
  );
}

const OfferDetails = ({ adminData, setAdminData }) => {
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

  if (!localOffer) return <div className="page">Loading offer...</div>;

  const selectedDish = allDishes.find(d => d.id === localOffer.dishId);
  const originalPrice = selectedDish?.basePrice || localOffer.originalPrice || 0;
  const offerAmount = (originalPrice * (localOffer.percentage || 0)) / 100;
  const offerPrice = originalPrice - offerAmount;

  /* ---------------- SAVE ---------------- */
  const persistOffer = async () => {
    const payload = {
      ...localOffer,
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
    <div className="offer-details-page">
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
            <button className="modal-cancel-btn" onClick={() => setIsEditing(true)}>
              <span className="shadow"></span>
              <span className="edge"></span>
              <span className="front">
                <img src={editIcon} alt="edit" />
                Edit
              </span>
            </button>
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

          {/* PERCENTAGE */}
          <div className="section">
            <div className="section-title">
              <span>Offer %</span>
            </div>

            {isEditing ? (
              <input
                className="mat-input"
                placeholder=" "
                type="number"
                value={localOffer.percentage}
                onChange={(e) => setLocalOffer({ ...localOffer, percentage: Number(e.target.value) })}
              />
            ) : (
              <p>{localOffer.percentage}%</p>
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
                  <td>Discount</td>
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
            <button
              className="modal-cancel-btn"
              onClick={resetEditState}
            >
              <span className="shadow"></span>
              <span className="edge"></span>
              <span className="front">Cancel</span>
            </button>
            <button
              className="modal-save-btn"
              onClick={persistOffer}
            >
              <span className="shadow"></span>
              <span className="edge"></span>
              <span className="front">Save</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default OfferDetails;