/**
 * Offers.js  —  Sam Cafe Admin Panel
 * Offers management page
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { exportToExcel } from "../utils/excelUtils";
import api from "../api";
import { CustomDatePicker } from "../components/CustomDatePicker";
import { DateRangeGroup, MultiPillGroup } from "../components/FilterBar";
import { todayStr, resolveDateRange } from "../utils/dateRangeUtils";

import closeIcon from "../icon/close-icon.png";
import { formatDisplayDate } from "../App";
import { EmptyRow } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import { useToast } from "../useToast";
import { allowTextInput } from "../App";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import CustomDropdown from "../components/CustomDropdown";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";

import "./Offers.css";

const Offers = ({ adminData, setAdminData }) => {
  // ── Hooks

  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const navigate = useNavigate();

  // Filter states
  const [offerSearch, setOfferSearch] = useState("");
  const [offerStatusFilters, setOfferStatusFilters] = useState(new Set());
  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });
  const [offerDatePreset, setOfferDatePreset] = useState("today");
  const [offerFromDate, setOfferFromDate] = useState(todayStr());
  const [offerToDate, setOfferToDate] = useState(todayStr());

  const [newOffer, setNewOffer] = useState({
    dishId: "",
    categoryId: "",
    discountType: "percentage", // "percentage" | "flat"
    percentage: "",
    flatAmount: "",
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

  const originalPrice = Math.round(selectedDish?.basePrice || 0);
  const isFlat = newOffer.discountType === "flat";
  // Flat discounts are clamped to the dish's price so a mistyped flat
  // amount can never push the offer price below zero.
  const offerAmount = isFlat
    ? Math.round(Math.min(Number(newOffer.flatAmount) || 0, originalPrice))
    : Math.round((originalPrice * (Number(newOffer.percentage) || 0)) / 100);
  const offerPrice = Math.round(originalPrice - offerAmount);

  const EMPTY_OFFER = { dishId: "", categoryId: "", discountType: "percentage", percentage: "", flatAmount: "", startDate: "", endDate: "", active: "yes" };

  const applyOfferPreset = (preset) => {
    setOfferDatePreset(preset);
    if (preset === "all" || preset === "") { setOfferFromDate(""); setOfferToDate(""); }
    else { const [f, t] = resolveDateRange(preset); setOfferFromDate(f); setOfferToDate(t); }
  };

  const handleSave = async () => {
    const errs = {};
    if (!newOffer.dishId) errs.dishId = true;
    if (isFlat) {
      if (!newOffer.flatAmount) errs.flatAmount = true;
    } else {
      if (!newOffer.percentage) errs.percentage = true;
    }
    if (!newOffer.startDate) errs.startDate = true;
    if (!newOffer.endDate) errs.endDate = true;
    if (!newOffer.active) errs.active = true;
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    // Every offer always carries a `percentage`, even flat ones — it's
    // derived from the flat amount so any code reading offer.percentage
    // downstream (e.g. the user-panel pricing helpers) keeps working.
    const derivedPercentage = isFlat
      ? Math.round((offerAmount / (originalPrice || 1)) * 100)
      : Number(newOffer.percentage) || 0;

    const payload = {
      id: `offer_${Date.now()}`,
      ...newOffer,
      percentage: derivedPercentage,
      ...(isFlat ? { flatAmount: Number(newOffer.flatAmount) || 0 } : {}),
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
      if (offerStatusFilters.size > 0 && !offerStatusFilters.has(o.active)) return false;
      if (offerFromDate && o.endDate && o.endDate < offerFromDate) return false;
      if (offerToDate && o.startDate && o.startDate > offerToDate) return false;
      return true;
    });
  }, [adminData.offers, offerSearch, offerStatusFilters, offerFromDate, offerToDate]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredOffers.length, 30);
  // Gate on categories, not offers.length — an empty offers list is a
  // legitimate state (no active promotions), not a "still loading" state.
  // adminData starts as {..., offers: [], categories: []} before the
  // initial fetch resolves, so offers.length === 0 is indistinguishable
  // between "not loaded yet" and "loaded, zero offers" — checking
  // categories (which offers always depend on for the dish dropdown,
  // and which every seeded café has at least one of) gives a real signal.

  const exportOffers = () => {
    if (!filteredOffers.length) { toast.warning("No offers to export"); return; }
    const rows = filteredOffers.map(o => ({
      Dish: o.dishId || "—",
      "Original Price (₹)": o.originalPrice ?? "—",
      Discount: o.discountType === "flat" ? `₹${o.flatAmount ?? o.offerAmount ?? 0} flat` : (o.percentage ? `${o.percentage}%` : "—"),
      "Offer Amount (₹)": o.offerAmount ?? "—",
      "Offer Price (₹)": o.offerPrice ?? "—",
      "Start Date": formatDisplayDate(o.startDate) || "—",
      "End Date": formatDisplayDate(o.endDate) || "—",
      Status: o.active === "yes" ? "Active" : "Inactive",
    }));
    const suffix = offerFromDate && offerToDate
      ? `${offerFromDate}_to_${offerToDate}`
      : todayStr();
    exportToExcel({ rows, sheetName: "Offers", fileName: `offers_${suffix}.xlsx` });
  };

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Offers</h2>
              <span className="result-count">{filteredOffers.length} offer(s)</span>
            </div>
          </div>
        </div>

        <div className="header-btn-container">
          <Button3D onClick={exportOffers}>Export</Button3D>
          <Button3D onClick={() => setShowModal(true)}>+ Add Offer</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search dish…"
              value={offerSearch}
              onChange={e => setOfferSearch(allowTextInput(offerSearch, e.target.value, 100, 5))}
            />
            <DateRangeGroup
              from={offerFromDate}
              to={offerToDate}
              onChangeFrom={setOfferFromDate}
              onChangeTo={setOfferToDate}
              preset={offerDatePreset}
              onChangePreset={applyOfferPreset}
              presets={[["all", "All"], ["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]]}
              toggle={false}
              noMax
            />

            <MultiPillGroup
              label="Status"
              options={[
                ["yes", "Active", "offer-pill-active"],
                ["no", "Inactive", "offer-pill-inactive"],
              ]}
              value={offerStatusFilters}
              onToggle={(key) => toggleSet(setOfferStatusFilters, key)}
            />

            {(offerSearch || offerStatusFilters.size > 0 || offerDatePreset !== "today") && (
              <button className="ae-clear-filter" onClick={() => {
                setOfferSearch("");
                setOfferStatusFilters(new Set());
                applyOfferPreset("today");
              }}>Clear</button>
            )}
          </div>
        </div>
      )}

      <div className="table-wrapper" style={{ maxHeight: headerCollapsed ? "calc(100vh - 120px)" : "calc(100vh - 260px)" }} ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th>Dish</th>
              <th>Original</th>
              <th>Discount</th>
              <th>Offer Price</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {filteredOffers.length === 0 ? (
              <EmptyRow
                colSpan={7}
                message={(adminData.offers || []).length === 0 ? "No offers yet" : "No offers match filters"}
              />
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
                <td>{o.discountType === "flat" ? `₹${o.flatAmount ?? o.offerAmount} flat` : `${o.percentage}%`}</td>
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
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
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
                  <CustomDropdown
                    label="Discount Type"
                    value={newOffer.discountType}
                    onChange={val => {
                      setNewOffer({ ...newOffer, discountType: val });
                      setFormErrors(p => ({ ...p, percentage: false, flatAmount: false }));
                    }}
                    options={[
                      { value: "percentage", label: "Percentage (%)" },
                      { value: "flat", label: "Flat Amount (₹)" }
                    ]}
                    placeholder="Select Discount Type"
                  />
                </div>

                <div className="admin-form-group">
                  {isFlat ? (
                    <div className="mat">
                      <input
                        className={`mat-input${formErrors.flatAmount ? " mat-error" : ""}`}
                        placeholder=" "
                        type="number"
                        min="1"
                        value={newOffer.flatAmount}
                        onChange={(e) => {
                          setNewOffer({ ...newOffer, flatAmount: Number(e.target.value) });
                          setFormErrors(p => ({ ...p, flatAmount: false }));
                        }}
                      />
                      <label className={`mat-label${formErrors.flatAmount ? " mat-label-error" : ""}`}>Flat Discount (₹)<span className="rf-req">*</span></label>
                      <span className={`mat-bar${formErrors.flatAmount ? " mat-bar-error" : ""}`} />
                    </div>
                  ) : (
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
                  )}
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
                    <span>{isFlat ? "Flat Discount" : "Discount"}</span>
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