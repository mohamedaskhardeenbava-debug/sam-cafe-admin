import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import "./OfferDetails.css";

const OfferDetails = ({ adminData, setAdminData }) => {
  const { offerId } = useParams();
  const navigate = useNavigate();

  const offer = adminData.offers.find(o => o.id === offerId);

  const [localOffer, setLocalOffer] = useState(null);
  const [editSection, setEditSection] = useState(null);
  const [openDishDropdown, setOpenDishDropdown] = useState(false);
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);

  // 🔥 flatten dishes (same logic as Offers page)
  const allDishes = adminData.categories.flatMap(cat => [
    ...(cat.dishes || []).map(d => ({ ...d, categoryId: cat.id })),
    ...(cat.subCategories || []).flatMap(sub =>
      (sub.dishes || []).map(d => ({ ...d, categoryId: sub.id }))
    )
  ]);

  useEffect(() => {
    const closeDropdowns = () => {
      setOpenDishDropdown(false);
      setOpenStatusDropdown(false);
    };

    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  useEffect(() => {
    if (offer) {
      setLocalOffer(JSON.parse(JSON.stringify(offer)));
    }
  }, [offer]);

  if (!localOffer) return <div className="page">Loading offer...</div>;

  const selectedDish = allDishes.find(d => d.id === localOffer.dishId);

  const originalPrice = selectedDish?.basePrice || localOffer.originalPrice || 0;

  const offerAmount =
    (originalPrice * (localOffer.percentage || 0)) / 100;

  const offerPrice = originalPrice - offerAmount;

  /* ---------------- SAVE ---------------- */
  const persistOffer = async (updatedOffer) => {
    const payload = {
      ...updatedOffer,
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
      setEditSection(null);

    } catch (err) {
      console.error("Failed to update offer", err);
    }
  };

  const resetEditState = () => {
    setEditSection(null);
    setLocalOffer(JSON.parse(JSON.stringify(offer)));
  };

  return (
    <div className="offer-details-page">
      <div className="details-container">

        {/* HEADER */}
        <div className="details-header">
          <button
            className="offer-back-btn"
            onClick={() => {
              resetEditState();
              navigate(-1);
            }}
          />
          <h2>{selectedDish?.name || "Offer"}</h2>
        </div>

        {/* DISH */}
        <div className="offer-section">
          <div className="offer-section-title">
            <span>Dish</span>

            {editSection === "dish" ? (
              <>
                <div className="offers-dropdown-wrapper">
                  <button
                    className="offers-status-dropdown"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDishDropdown(prev => !prev);
                    }}
                  >
                    {selectedDish?.name || "Select Dish"}
                  </button>

                  {openDishDropdown && (
                    <div className="offers-dropdown-menu">
                      {allDishes.map(d => (
                        <div
                          key={d.id}
                          onClick={() => {
                            setLocalOffer({
                              ...localOffer,
                              dishId: d.id,
                              categoryId: d.categoryId
                            });
                            setOpenDishDropdown(false);
                          }}
                        >
                          {d.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="offer-action">
                  <button onClick={() => persistOffer(localOffer)}>Save</button>
                  <button onClick={resetEditState}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p>{selectedDish?.name}</p>
                <img
                  className="offer-edit-icon"
                  src={editIcon}
                  onClick={() => setEditSection("dish")}
                />
              </>
            )}
          </div>
        </div>

        {/* PERCENTAGE */}
        <div className="offer-section">
          <div className="offer-section-title">
            <span>Offer %</span>

            {editSection === "percentage" ? (
              <>
                <input
                  type="number"
                  value={localOffer.percentage}
                  onChange={(e) =>
                    setLocalOffer({
                      ...localOffer,
                      percentage: Number(e.target.value)
                    })
                  }
                />

                <div className="offer-action">
                  <button onClick={() => persistOffer(localOffer)}>Save</button>
                  <button onClick={resetEditState}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p>{localOffer.percentage}%</p>
                <img
                  className="offer-edit-icon"
                  src={editIcon}
                  onClick={() => setEditSection("percentage")}
                />
              </>
            )}
          </div>
        </div>

        {/* PRICE BREAKDOWN */}
        <div className="offer-section">
          <div className="offer-section-title">
            <span>Price Details</span>
          </div>

          <table className="offer-data-table">
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

        {/* DATE */}
        <div className="offer-section">
          <div className="offer-section-title">
            <span>Start Date</span>

            {editSection === "startDate" ? (
              <>
                <input
                  type="date"
                  value={localOffer.startDate}
                  onChange={(e) =>
                    setLocalOffer({
                      ...localOffer,
                      startDate: e.target.value
                    })
                  }
                />

                <div className="offer-action">
                  <button onClick={() => persistOffer(localOffer)}>Save</button>
                  <button onClick={resetEditState}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p>{localOffer.startDate}</p>
                <img
                  className="offer-edit-icon"
                  src={editIcon}
                  onClick={() => setEditSection("startDate")}
                />
              </>
            )}
          </div>
        </div>

        <div className="offer-section">
          <div className="offer-section-title">
            <span>End Date</span>

            {editSection === "endDate" ? (
              <>
                <input
                  type="date"
                  value={localOffer.endDate}
                  onChange={(e) =>
                    setLocalOffer({
                      ...localOffer,
                      endDate: e.target.value
                    })
                  }
                />

                <div className="offer-action">
                  <button onClick={() => persistOffer(localOffer)}>Save</button>
                  <button onClick={resetEditState}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p>{localOffer.endDate}</p>
                <img
                  className="offer-edit-icon"
                  src={editIcon}
                  onClick={() => setEditSection("endDate")}
                />
              </>
            )}
          </div>
        </div>

        {/* ACTIVE */}
        <div className="offer-section">
          <div className="offer-section-title">
            <span>Status</span>

            {editSection === "active" ? (
              <>
                <div className="offers-dropdown-wrapper">
                  <button
                    type="button"
                    className="offers-status-dropdown"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenStatusDropdown(prev => !prev);
                    }}
                  >
                    {localOffer.active === "yes" ? "Active" : "Inactive"}
                  </button>

                  {openStatusDropdown && (
                    <div className="offers-dropdown-menu">
                      {[
                        { label: "Active", value: "yes" },
                        { label: "Inactive", value: "no" }
                      ].map(opt => (
                        <div
                          key={opt.value}
                          onClick={() => {
                            setLocalOffer({ ...localOffer, active: opt.value });
                            setOpenStatusDropdown(false);
                          }}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="offer-action">
                  <button onClick={() => persistOffer(localOffer)}>Save</button>
                  <button onClick={resetEditState}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p>{localOffer.active}</p>
                <img
                  className="offer-edit-icon"
                  src={editIcon}
                  onClick={() => setEditSection("active")}
                />
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default OfferDetails;