/**
 * Offers.js  —  Sam Cafe Admin Panel
 * Offers management page
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { exportToExcel } from "../utils/excelUtils";
import api from "../api";
import { CustomDatePicker, todayStr } from "../components/CustomDatePicker";

import closeIcon from "../icon/close-icon.png";
import { formatDisplayDate } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import { useToast } from "../useToast";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";
import CustomDropdown from "../components/CustomDropdown";
import Button3D from "../components/Button3D";

import "./Offers.css";
import PageLoader from "../components/PageLoader";

const Offers = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [formErrors, setFormErrors] = useState({});
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

  // flatten all dishes

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

  const EMPTY_OFFER = { dishId: "", categoryId: "", percentage: "", startDate: "", endDate: "", active: "yes" };

  const handleSave = async () => {
    const errs = {};
    if (!newOffer.dishId) errs.dishId = true;
    if (!newOffer.percentage) errs.percentage = true;
    if (!newOffer.startDate) errs.startDate = true;
    if (!newOffer.endDate) errs.endDate = true;
    if (!newOffer.active) errs.active = true;
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    const payload = {
      id: `offer_${Date.now()}`,
      ...newOffer,
      originalPrice,
      offerAmount,
      offerPrice
    };

    try {
      const res = await api.post("/offers", payload);
      const saved = res.data || payload;

      setAdminData(prev => {
        const alreadyExists = (prev.offers || []).some(o => o.id === saved.id);
        if (alreadyExists) return prev;
        return { ...prev, offers: [...(prev.offers || []), saved] };
      });

      toast.success("Offer added successfully.");
      setNewOffer(EMPTY_OFFER);
      setFormErrors({});
      setShowModal(false);
    } catch (err) {
      console.error("Failed to add offer:", err);
      toast.error("Failed to add offer");
    }
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
  if (!adminData?.offers?.length) return <PageLoader label="Loading offers…" />;

  const exportOffers = () => {
    if (!filteredOffers.length) { toast.warning("No offers to export"); return; }
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
    const suffix = offerFromDate && offerToDate
      ? `${offerFromDate}_to_${offerToDate}`
      : new Date().toISOString().slice(0, 10);
    exportToExcel({ rows, sheetName: "Offers", fileName: `offers_${suffix}.xlsx` });
  };

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <h2 className="title">Offers</h2>
        <div className="header-btn-container">
          <Button3D onClick={exportOffers}>Export</Button3D>
          <Button3D onClick={() => setShowModal(true)}>+ Add Offer</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="filter-groups">
          <input
            className="search-input"
            placeholder=" Search dish…"
            value={offerSearch}
            onChange={e => setOfferSearch(e.target.value)}
          />
          {/* Date range */}
          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <CustomDatePicker
              value={offerFromDate}
              onChange={v => { setOfferFromDate(v); if (offerToDate && v > offerToDate) setOfferToDate(v); }}
              placeholder="Start date"
            />

            <span className="filter-group-label">To</span>
            <CustomDatePicker
              value={offerToDate}
              min={offerFromDate}
              onChange={setOfferToDate}
              placeholder="End date"
            />
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Status</span>
            {[["all", "All"], ["yes", "Active"], ["no", "Inactive"]].map(([val, lbl]) => (
              <button
                key={val}
                className={`filter-pill${offerStatusFilter === val ? " active" : ""}${val === "yes" && offerStatusFilter === "yes" ? " offer-pill-active" : ""}${val === "no" && offerStatusFilter === "no" ? " offer-pill-inactive" : ""}`}
                onClick={() => setOfferStatusFilter(val)}
              >{lbl}</button>
            ))}

            {(offerSearch || offerStatusFilter !== "all" || offerFromDate || offerToDate) && (
              <button className="ae-clear-filter" onClick={() => {
                setOfferSearch("");
                setOfferStatusFilter("all");
                setOfferFromDate(todayStr());
                setOfferToDate(todayStr());
              }}>Clear</button>
            )}
          </div>

          <span className="result-count">{filteredOffers.length} offer(s)</span>
        </div>
      </div>

      <div className="table-wrapper" style={{ maxHeight: "calc(100vh - 260px)" }} ref={containerRef}>
        <table >
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
                <td>
                  <span
                    className="clickable"
                    onClick={() => navigate(`/offers/${o.id}`)}
                  >
                    {o.dishId}
                  </span>
                </td>
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
            className="admin-modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >

            {/* HEADER */}
            <div className="admin-modal-header">
              <h3>Add Offer</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { setShowModal(false); setFormErrors({}); }}><img src={closeIcon} /></Button3D>
            </div>

            {/* BODY */}
            <div className="admin-modal-body">
              <div className="horizontal-form-group">
                {/* DISH */}
                <div className={`admin-form-group${formErrors.dishId ? " mat-select-error" : ""}`}>
                  <CustomDropdown
                    label="Select Dish"
                    value={newOffer.dishId}
                    onChange={val => {
                      const dish = allDishes.find(d => d.id === val);
                      setNewOffer({ ...newOffer, dishId: val, categoryId: dish?.categoryId || "" });
                      setFormErrors(p => ({ ...p, dishId: false }));
                    }}
                    options={allDishes.map(d => ({ value: d.id, label: d.name }))}
                    placeholder="Select Dish"
                  />
                </div>

                {/* OFFER % */}
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.percentage ? " mat-error" : ""}`}
                      placeholder=" "
                      type="number"
                      min="1"
                      max="100"
                      value={newOffer.percentage}
                      onChange={(e) => {
                        setNewOffer({ ...newOffer, percentage: Number(e.target.value) });
                        setFormErrors(p => ({ ...p, percentage: false }));
                      }}
                    />
                    <label className={`mat-label${formErrors.percentage ? " mat-label-error" : ""}`}>Offer Percentage (%)<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.percentage ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
              </div>

              {/* PRICE PREVIEW */}
              <div className="admin-form-group">
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
                <div className="admin-form-group">
                  <label className={`mat-label${formErrors.startDate ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>Start Date<span className="rf-req">*</span></label>
                  <CustomDatePicker
                    value={newOffer.startDate}
                    onChange={(v) => { setNewOffer({ ...newOffer, startDate: v }); setFormErrors(p => ({ ...p, startDate: false })); }}
                    min={todayStr()}
                    placeholder="Select start date"
                    hasError={!!formErrors.startDate}
                  />
                </div>

                <div className="admin-form-group">
                  <label className={`mat-label${formErrors.endDate ? " mat-label-error" : ""}`} style={{ position: "static", transform: "none", fontSize: 13, display: "block", marginBottom: 4 }}>End Date<span className="rf-req">*</span></label>
                  <CustomDatePicker
                    value={newOffer.endDate}
                    onChange={(v) => { setNewOffer({ ...newOffer, endDate: v }); setFormErrors(p => ({ ...p, endDate: false })); }}
                    min={newOffer.startDate || todayStr()}
                    placeholder="Select end date"
                    hasError={!!formErrors.endDate}
                  />
                </div>
              </div>

              {/* STATUS */}
              <div className={`admin-form-group${formErrors.active ? " mat-select-error" : ""}`}>
                <CustomDropdown
                  label="Status"
                  value={newOffer.active}
                  onChange={val => { setNewOffer({ ...newOffer, active: val }); setFormErrors(p => ({ ...p, active: false })); }}
                  options={[
                    { value: "yes", label: "Active" },
                    { value: "no", label: "Inactive" }
                  ]}
                  placeholder="Select Status"
                />
              </div>
            </div>

            {/* FOOTER */}
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { setShowModal(false); setFormErrors({}); }}>Cancel</Button3D>
              <Button3D type="submit">Save</Button3D>
            </div>

          </form>
        </div>
      )}
    </div>
  );
};

export default Offers;
