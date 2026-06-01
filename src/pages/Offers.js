import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import "./Offers.css";
import api from "../api";
import { useNavigate } from "react-router-dom";
import { formatDisplayDate } from "../App";
import { CustomDatePicker, todayStr } from "../components/CustomDatePicker";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";

const Offers = ({ adminData, setAdminData }) => {
    const [showModal, setShowModal] = useState(false);
    const [openDishDropdown, setOpenDishDropdown] = useState(false);
    const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
    const navigate = useNavigate();

    // Filter states
    const [offerSearch, setOfferSearch] = useState("");
    const [offerStatusFilter, setOfferStatusFilter] = useState("all"); // "all" | "yes" | "no"
    const [offerFromDate, setOfferFromDate] = useState(todayStr());
    const [offerToDate, setOfferToDate] = useState(todayStr());

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

        const res = await api.post("/offers", payload);

        setAdminData(prev => ({
            ...prev,
            offers: [...(prev.offers || []), res.data]
        }));

        setShowModal(false);
    };

    const filteredOffers = useMemo(() => {
        return (adminData.offers || []).filter(o => {
            const q = offerSearch.toLowerCase();
            if (q && !(o.dishId || "").toLowerCase().includes(q)) return false;
            if (offerStatusFilter !== "all" && o.active !== offerStatusFilter) return false;
            if (offerFromDate && o.endDate && o.endDate < offerFromDate) return false;
            if (offerToDate && o.startDate && o.startDate > offerToDate) return false;
            return true;
        });
    }, [adminData.offers, offerSearch, offerStatusFilter, offerFromDate, offerToDate]);

    const { displayLimit, sentinelRef, containerRef, hasMore } =
        useInfiniteScroll(filteredOffers.length, 30);

    const exportOffers = () => {
        if (!filteredOffers.length) { alert("No offers to export"); return; }
        const rows = filteredOffers.map(o => ({
            Dish: o.dishId || "—",
            "Original Price (₹)": o.originalPrice ?? "—",
            "Discount %": o.percentage ? `${o.percentage}%` : "—",
            "Offer Amount (₹)": o.offerAmount ?? "—",
            "Offer Price (₹)": o.offerPrice ?? "—",
            "Start Date": formatDisplayDate(o.startDate) || "—",
            "End Date": formatDisplayDate(o.endDate) || "—",
            Status: o.active === "yes" ? "Active" : "Inactive",
        }));
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Offers");
        const suffix = offerFromDate && offerToDate
            ? `${offerFromDate}_to_${offerToDate}`
            : new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `offers_${suffix}.xlsx`);
    };

    return (
        <div className="offers-page">
            {/* HEADER */}
            <div className="offers-header">
                <h2 className="offers-title">Offers</h2>
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="export-btn" onClick={exportOffers}>Export</button>
                    <button className="category-add-btn" onClick={() => setShowModal(true)}>Add Offer</button>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="offers-filter-bar">
                <input
                    className="search-input"
                    placeholder=" Search dish…"
                    value={offerSearch}
                    onChange={e => setOfferSearch(e.target.value)}
                />
                {/* Date range */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="offers-filter-label">From</span>
                    <CustomDatePicker
                        value={offerFromDate}
                        onChange={v => { setOfferFromDate(v); if (offerToDate && v > offerToDate) setOfferToDate(v); }}
                        placeholder="Start date"
                    />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="offers-filter-label">To</span>
                    <CustomDatePicker
                        value={offerToDate}
                        min={offerFromDate}
                        onChange={setOfferToDate}
                        placeholder="End date"
                    />
                </div>
                {/* Status pills */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span className="offers-filter-label">Status</span>
                    {[["all", "All"], ["yes", "Active"], ["no", "Inactive"]].map(([val, lbl]) => (
                        <button
                            key={val}
                            className={`sched-pill-btn${offerStatusFilter === val ? " active" : ""}${val === "yes" && offerStatusFilter === "yes" ? " offer-pill-active" : ""}${val === "no" && offerStatusFilter === "no" ? " offer-pill-inactive" : ""}`}
                            onClick={() => setOfferStatusFilter(val)}
                        >{lbl}</button>
                    ))}
                </div>
                {(offerSearch || offerStatusFilter !== "all" || offerFromDate || offerToDate) && (
                    <button className="ae-clear-filter" onClick={() => {
                        setOfferSearch("");
                        setOfferStatusFilter("all");
                        setOfferFromDate(todayStr());
                        setOfferToDate(todayStr());
                    }}>Clear</button>
                )}
                <span className="ae-result-count">{filteredOffers.length} offer(s)</span>
            </div>

            <div className="offers-table-wrapper" ref={containerRef}>
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
                        {filteredOffers.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: "center", color: "#aaa", padding: 20 }}>
                                {(adminData.offers || []).length === 0 ? "No offers yet" : "No offers match filters"}
                            </td></tr>
                        ) : filteredOffers.slice(0, displayLimit).map(o => (
                            <tr key={o.id}>
                                <td className="clickable" onClick={() => navigate(`/offers/${o.id}`)}>{o.dishId}</td>
                                <td>{o.originalPrice}</td>
                                <td>{o.percentage}%</td>
                                <td>{o.offerPrice}</td>
                                <td>{formatDisplayDate(o.startDate)}</td>
                                <td>{formatDisplayDate(o.endDate)}</td>
                                <td>
                                    <span className={`offer-status-badge ${o.active === "yes" ? "offer-active" : "offer-inactive"}`}>
                                        {o.active === "yes" ? "Active" : "Inactive"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        <InfiniteScrollLoader
                            sentinelRef={sentinelRef}
                            hasMore={hasMore}
                            colSpan={7}
                        />
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="modal-overlay">
                    <form
                        className="modal"
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                    >

                        {/* HEADER */}
                        <div className="modal-header">
                            <h3>Add Offer</h3>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setShowModal(false)}
                            ></button>
                        </div>

                        {/* BODY */}
                        <div className="modal-body">
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
                                            <div className="dropdown-menu">
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
                                    <CustomDatePicker
                                        value={newOffer.startDate}
                                        onChange={(v) => setNewOffer({ ...newOffer, startDate: v })}
                                        min={todayStr()}
                                        placeholder="Select start date"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>End Date</label>
                                    <CustomDatePicker
                                        value={newOffer.endDate}
                                        onChange={(v) => setNewOffer({ ...newOffer, endDate: v })}
                                        min={newOffer.startDate || todayStr()}
                                        placeholder="Select end date"
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
                                            <div className="dropdown-menu">
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
                        <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                            <button type="submit">Save Offer</button>
                        </div>

                    </form>
                </div>
            )}
        </div>
    );
};

export default Offers;