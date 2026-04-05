import React, { useState, useEffect } from "react";
import "./Offers.css";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { formatDisplayDate } from "../App";

const Offers = ({ adminData, setAdminData }) => {
    const [showModal, setShowModal] = useState(false);
    const [openDishDropdown, setOpenDishDropdown] = useState(false);
    const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
    const navigate = useNavigate();

    const [newOffer, setNewOffer] = useState({
        dishId: "",
        categoryId: "",
        percentage: "",
        startDate: "",
        endDate: "",
        active: "yes"
    });

    useEffect(() => {
        const closeDropdowns = () => {
            setOpenDishDropdown(false);
            setOpenStatusDropdown(false);
        };

        window.addEventListener("click", closeDropdowns);
        return () => window.removeEventListener("click", closeDropdowns);
    }, []);

    // 🔥 flatten all dishes
    const allDishes = adminData.categories.flatMap(cat => [
        ...(cat.dishes || []).map(d => ({ ...d, categoryId: cat.id })),
        ...(cat.subCategories || []).flatMap(sub =>
            (sub.dishes || []).map(d => ({ ...d, categoryId: sub.id }))
        )
    ]);

    const selectedDish = allDishes.find(d => d.id === newOffer.dishId);

    const originalPrice = selectedDish?.basePrice || 0;
    const offerAmount = Math.floor((originalPrice * newOffer.percentage) / 100 || 0);
    const offerPrice = Math.floor(originalPrice - offerAmount);

    const handleSave = async () => {
        const payload = {
            id: `offer_${Date.now()}`,
            ...newOffer,
            originalPrice,
            offerAmount,
            offerPrice
        };

        await api.post("/offers", payload);

        setAdminData(prev => ({
            ...prev,
            offers: [...(prev.offers || []), payload]
        }));

        setShowModal(false);
    };

    return (
        <div className="offers-page">
            <div className="offers-header">
                <h2 className="offers-title">Offers</h2>
                <button className="offers-add-btn" onClick={() => setShowModal(true)}>
                    Add Offer
                </button>
            </div>

            <div className="offers-table-wrapper">
                <table className="offers-table">
                    <thead>
                        <tr>
                            <th>Dish</th>
                            <th>Original</th>
                            <th>%</th>
                            <th>Offer Price</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(adminData.offers || []).map(o => (
                            <tr key={o.id}>
                                <td className="clickable" onClick={() => navigate(`/offers/${o.id}`)}>{o.dishId}</td>
                                <td>{o.originalPrice}</td>
                                <td>{o.percentage}%</td>
                                <td>{o.offerPrice}</td>
                                <td>{formatDisplayDate(o.startDate)}</td>
                                <td>{formatDisplayDate(o.endDate)}</td>
                                <td>{o.active}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="offers-modal-overlay">
                    <form
                        className="offers-modal"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                    >

                        {/* HEADER */}
                        <div className="offers-modal-header">
                            <h3>Add Offer</h3>
                            <button
                                type="button"
                                className="offers-close-btn"
                                onClick={() => setShowModal(false)}
                            ></button>
                        </div>

                        {/* BODY */}
                        <div className="offers-modal-body">
                            <div className="horizontal-form-group">
                                {/* DISH */}
                                <div className="form-group">
                                    <label>Select Dish</label>
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
                                                            setNewOffer({
                                                                ...newOffer,
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
                                </div>

                                {/* OFFER % */}
                                <div className="form-group">
                                    <label>Offer Percentage (%)</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        max="100"
                                        placeholder="Enter discount %"
                                        value={newOffer.percentage}
                                        onChange={(e) =>
                                            setNewOffer({
                                                ...newOffer,
                                                percentage: Number(e.target.value)
                                            })
                                        }
                                    />
                                </div>
                            </div>

                            {/* PRICE PREVIEW */}
                            <div className="form-group">
                                <label>Price Breakdown</label>

                                <div className="offers-price-preview">
                                    <div>
                                        <span>Original</span>
                                        <strong>₹{originalPrice}</strong>
                                    </div>

                                    <div>
                                        <span>Discount</span>
                                        <strong>₹{offerAmount}</strong>
                                    </div>

                                    <div>
                                        <span>Final</span>
                                        <strong>₹{offerPrice}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="horizontal-form-group">
                                {/* DATE RANGE */}
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input
                                        required
                                        type="date"
                                        value={newOffer.startDate}
                                        onChange={(e) =>
                                            setNewOffer({ ...newOffer, startDate: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="form-group">
                                    <label>End Date</label>
                                    <input
                                        required
                                        type="date"
                                        value={newOffer.endDate}
                                        onChange={(e) =>
                                            setNewOffer({ ...newOffer, endDate: e.target.value })
                                        }
                                    />
                                </div>

                                {/* STATUS */}
                                <div className="form-group">
                                    <label>Status</label>
                                    <div className="offers-dropdown-wrapper">
                                        <button
                                            type="button"
                                            className="offersdetails-status-dropdown"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenStatusDropdown(prev => !prev);
                                            }}
                                        >
                                            {newOffer.active === "yes" ? "Active" : "Inactive"}
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
                                                            setNewOffer({
                                                                ...newOffer,
                                                                active: opt.value
                                                            });
                                                            setOpenStatusDropdown(false);
                                                        }}
                                                    >
                                                        {opt.label}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="offers-modal-footer">
                            <div className="form-actions">
                                <button type="submit">Save Offer</button>
                                <button type="button" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            )}
        </div>
    );
};

export default Offers;