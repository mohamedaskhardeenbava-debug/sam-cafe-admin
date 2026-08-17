/**
 * Stocks.js  —  Sam Cafe Admin Panel
 * Ingredient stock tracking page
 */

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { exportToExcel } from "../utils/excelUtils";
import api from "../api";
import { CustomDatePicker } from "../components/CustomDatePicker";
import socket from "../socket";

import editIcon from "../icon/edit-icon.png";
import closeIcon from "../icon/close-icon.png";
import { EmptyRow } from "../App";
import { formatDisplayDate } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import { useToast } from "../useToast";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import CustomDropdown from "../components/CustomDropdown";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { FilterBar } from "../components/FilterBar";

import "./Stocks.css";

const toTwoDecimals = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const Stocks = ({ adminData, setAdminData, handleSort, sortConfig }) => {
  // ── Hooks

  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];


  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const stockEditModal = useAnimatedModal("stocks-edit");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [addStock, setAddStock] = useState("");
  const [pricePer100g, setPricePer100g] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [disableGlobally, setDisableGlobally] = useState(false);
  const [selectedDishToDisable, setSelectedDishToDisable] = useState("");

  const dishesContainingIngredient = useMemo(() => {
    if (!selectedIngredient) return [];

    return adminData.categories.flatMap(category => {

      // Dishes directly inside category
      const directDishes = (category.dishes || [])
        .filter(dish =>
          (dish.ingredients || []).some(
            ing =>
              ing.name === selectedIngredient.name ||
              ing.id === selectedIngredient.id
          )
        )
        .map(dish => ({
          id: dish.id,
          name: dish.name,
          parentCategoryId: category.id,
          categoryId: category.id
        }));

      // Dishes inside subCategories
      const subCategoryDishes = (category.subCategories || []).flatMap(sub =>
        (sub.dishes || [])
          .filter(dish =>
            (dish.ingredients || []).some(
              ing =>
                ing.name === selectedIngredient.name ||
                ing.id === selectedIngredient.id
            )
          )
          .map(dish => ({
            id: dish.id,
            name: dish.name,
            parentCategoryId: category.id,
            categoryId: sub.id
          }))
      );

      return [...directDishes, ...subCategoryDishes];

    });

  }, [selectedIngredient, adminData.categories]);

  const calculateStockPercent = (ing) => {
    const remaining = toTwoDecimals(ing.stockRemaining ?? 0);
    const max = toTwoDecimals(ing.stockMax ?? 0);

    if (!max || max <= 0) return 0;

    const percent = (remaining / max) * 100;
    return Math.max(0, Math.min(100, Math.round(percent)));
  };

  /* ---------------- SORTED DATA ---------------- */
  const sortedIngredients = useMemo(() => {
    const data = [...adminData.ingredients];

    data.sort((a, b) => {
      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      let aVal = 0;
      let bVal = 0;

      if (sortConfig.key === "price") {
        aVal = a.pricePer100g ?? 0;
        bVal = b.pricePer100g ?? 0;
      }
      else if (sortConfig.key === "stock") {
        aVal = toTwoDecimals(a.stockRemaining ?? 0);
        bVal = toTwoDecimals(b.stockRemaining ?? 0);
      }
      else if (sortConfig.key === "stockPercent") {
        aVal = calculateStockPercent(a);
        bVal = calculateStockPercent(b);
      }
      else if (sortConfig.key === "lastUpdated") {
        aVal = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        bVal = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      }

      else if (sortConfig.key === "expiryDate") {
        aVal = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        bVal = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
      }

      return sortConfig.direction === "asc"
        ? aVal - bVal
        : bVal - aVal;
    });

    return data;
  }, [adminData.ingredients, sortConfig]);

  const [stockSearch, setStockSearch] = useState("");

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(sortedIngredients.length, 30);

  const filteredIngredients = useMemo(() => {
    const q = stockSearch.toLowerCase();
    return q
      ? sortedIngredients.filter(i =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.brands || []).some(b => b.name.toLowerCase().includes(q))
      )
      : sortedIngredients;
  }, [sortedIngredients, stockSearch]);

  /* ---------------- EDIT MODAL ---------------- */
  const openEditModal = (ingredient) => {
    setSelectedIngredient(ingredient);
    setDisableGlobally(ingredient.isDisabledGlobally || false);
    setSelectedDishToDisable("");
    setAddStock("");
    setPricePer100g(ingredient.pricePer100g || "");
    setStockMax(ingredient.stockMax ?? "");
    setExpiryDate(ingredient.expiryDate || "");
    setShowEditModal(true);
    stockEditModal.open();
  };

  const closeModal = () => {
    stockEditModal.close(() => {
      setShowEditModal(false);
      setSelectedIngredient(null);
      setAddStock("");
      setPricePer100g("");
      setStockMax("");
    });
  };

  const handleSave = async () => {
    const addValue = Number(addStock || 0);
    const newPrice = Number(pricePer100g);
    const max = Number(stockMax);
    const date = new Date().toISOString().split("T")[0];

    if (newPrice <= 0) {
      toast.warning("Price must be greater than 0");
      return;
    }

    const updatedIngredient = {
      ...selectedIngredient,
      stockRemaining:
        Number(selectedIngredient.stockRemaining || 0) + addValue,
      pricePer100g: newPrice,
      stockMax: max,
      expiryDate: expiryDate || null,
      lastUpdated: date,
      isDisabledGlobally: disableGlobally
    };

    try {
      const res = await api.put(
        `/ingredients/${selectedIngredient.id}`,
        updatedIngredient
      );

      setAdminData(prev => ({
        ...prev,
        ingredients: prev.ingredients.map(i =>
          i.id === selectedIngredient.id ? res.data : i
        )
      }));

      socket.emit("data-change", {
        resource: "ingredients",
        action: "updated",
        payload: res.data
      });

      closeModal();

    } catch (err) {
      toast.error("Failed to update stock");
      console.error("Failed to update stock", err);
    }
  };

  const handleExportStocks = () => {
    if (!adminData.ingredients.length) {
      toast.warning("No stock data available");
      return;
    }

    const rows = adminData.ingredients.map((ing) => ({
      Ingredient: ing.name,
      "Stock Remaining (kg)": toTwoDecimals(ing.stockRemaining ?? 0),
      "Last Purchased": ing.lastUpdated || "—"
    }));

    exportToExcel({ rows, sheetName: "Stocks", fileName: "stocks_export.xlsx" });
  };

  const getDisabledLabel = (ingredient) => {
    if (ingredient.isDisabledGlobally === true) {
      return { text: "All", type: "all" };
    }

    const disabled = ingredient.disabledForDishes || [];

    if (disabled.length === 0) {
      return { text: "—", type: "none" };
    }

    // Get dish names (dishes can live directly on a category or nested under its subcategories)
    const dishNames = adminData.categories
      .flatMap(cat => [
        ...(cat.dishes || []),
        ...(cat.subCategories || []).flatMap(sub => sub.dishes || [])
      ])
      .filter(d => disabled.includes(d.id))
      .map(d => d.name);

    return {
      text:
        dishNames.length <= 2
          ? dishNames.join(", ")
          : `${dishNames.slice(0, 2).join(", ")} +${dishNames.length - 2}`,
      type: "partial"
    };
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;

    const today = new Date();
    const expiry = new Date(expiryDate);

    const diffTime = expiry - today;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    return diffDays <= 15;
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
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Stocks</h2>
              <span className="result-count">{filteredIngredients.length} ingredient(s)</span>
            </div>
          </div>
        </div>

        <Button3D onClick={handleExportStocks}>Export</Button3D>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={stockSearch}
          onSearchChange={setStockSearch}
          searchPlaceholder=" Search ingredient or brand…"
          onClear={() => setStockSearch("")}
          active={!!stockSearch}
        />
      </CollapseSection>

      {/* TABLE */}
      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th
                onClick={() => handleSort("name")}
                className={sortConfig.key === "name" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Ingredient</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "name"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th>Brand</th>
              <th
                onClick={() => handleSort("price")}
                className={sortConfig.key === "price" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Price / 100g</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "price"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>

              <th
                onClick={() => handleSort("stock")}
                className={sortConfig.key === "stock" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Stock (kg)</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "stock"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>

              <th
                onClick={() => handleSort("stockPercent")}
                className={sortConfig.key === "stockPercent" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Stocks (%)</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "stockPercent"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>

              <th
                onClick={() => handleSort("lastUpdated")}
                className={sortConfig.key === "lastUpdated" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Last Purchased</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "lastUpdated"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>

              <th
                onClick={() => handleSort("expiryDate")}
                className={sortConfig.key === "expiryDate" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Expiry Date</span>
                  <span className="sort-arrow">
                    {sortConfig.key === "expiryDate"
                      ? sortConfig.direction === "asc" ? "▲" : "▼"
                      : ""}
                  </span>
                </span>
              </th>
              <th>Disabled In</th>
              <th className="icon-width">Edit</th>
            </tr>
          </thead>

          <tbody>
            {filteredIngredients.length === 0 ? (
              <EmptyRow colSpan={9} message="No stock data available" />
            ) : (
              filteredIngredients.slice(0, displayLimit).map((ing) => (
                <tr key={ing.id}>
                  <td>
                    <span
                      className="clickable"
                      onClick={() => navigate(`/ingredients/${ing.id}`)}
                    >
                      {ing.name}
                    </span>
                  </td>
                  <td>
                    {ing.brands?.length
                      ? ing.brands.map(b => b.name).join("/ ")
                      : "—"}
                  </td>
                  <td>₹{toTwoDecimals(ing.pricePer100g)}</td>
                  <td>{toTwoDecimals(ing.stockRemaining ?? 0)}</td>
                  <td
                    style={{
                      fontWeight: 600,
                      color:
                        calculateStockPercent(ing) < 30
                          ? "red"
                          : calculateStockPercent(ing) < 60
                            ? "#e6a700"
                            : "green"
                    }}
                  >
                    {calculateStockPercent(ing)}%
                  </td>
                  <td>{formatDisplayDate(ing.lastUpdated)}</td>
                  <td
                    style={{
                      color: isExpiringSoon(ing.expiryDate) ? "red" : "green",
                      fontWeight: isExpiringSoon(ing.expiryDate) ? 600 : 500
                    }}
                  >
                    {formatDisplayDate(ing.expiryDate) || "—"}
                  </td>
                  <td>
                    {(() => {
                      const status = getDisabledLabel(ing);

                      return (
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              status.type === "all"
                                ? "red"
                                : status.type === "partial"
                                  ? "#e6a700"
                                  : "#888"
                          }}
                        >
                          {status.text}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="icon-width">
                    <Button3D variant="cancel" iconOnly onClick={() => openEditModal(ing)}><img src={editIcon} /></Button3D>
                  </td>
                </tr>
              )))}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={9}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
      {stockEditModal.shouldRender && selectedIngredient && (
        <div className={`modal-overlay ${stockEditModal.overlayClass}`}>
          <div className={`admin-modal ${stockEditModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Edit Stock & Price for {selectedIngredient.name}</h3>
              <Button3D variant="cancel" iconOnly onClick={closeModal}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className="mat-input"
                      placeholder=" "
                      autoFocus
                      type="number"
                      min="1"
                      step="1"
                      value={pricePer100g}
                      onChange={(e) => setPricePer100g(e.target.value)}
                    />
                    <label className="mat-label">Price per 100g<span className="rf-req">*</span></label>
                    <span className="mat-bar" />
                  </div>
                </div>

                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className="mat-input"
                      placeholder=" "
                      type="number"
                      min="1"
                      step="1"
                      value={stockMax}
                      onChange={(e) => setStockMax(e.target.value)}
                    />
                    <label className="mat-label">Stock Max (kg)<span className="rf-req">*</span></label>
                    <span className="mat-bar" />
                  </div>
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    type="number"
                    min="1"
                    step="1"
                    value={addStock}
                    onChange={(e) => setAddStock(e.target.value)}
                  />
                  <label className="mat-label">Add Stock in kg</label>
                  <span className="mat-bar" />
                </div>
              </div>

              {addStock && (
                <p className="stocks-calc-text">
                  {toTwoDecimals(selectedIngredient.stockRemaining ?? 0)} +{" "}
                  {toTwoDecimals(addStock)} ={" "}
                  <strong>
                    {toTwoDecimals(
                      toTwoDecimals(selectedIngredient.stockRemaining ?? 0) +
                      toTwoDecimals(addStock)
                    )}
                  </strong>{" "}
                  kg
                </p>
              )}

              <div className="admin-form-group">
                <label>Expiry Date</label>

                <CustomDatePicker
                  value={expiryDate}
                  onChange={(v) => setExpiryDate(v)}
                  placeholder="Select expiry date"
                />

              </div>

              <div className="admin-form-group border">
                <label>Visibility Controls</label>

                {/* GLOBAL DISABLE */}
                <div className="admin-form-group">
                  <label>
                    <input
                      className="stock-all-input"
                      type="checkbox"
                      checked={disableGlobally}
                      onChange={(e) => setDisableGlobally(e.target.checked)}
                    />
                    &nbsp; Disable Globally
                  </label>
                </div>

                {/* DISABLE FOR SPECIFIC DISH */}
                <div className="admin-form-group">
                  <div className="admin-form-group">
                    <CustomDropdown
                      label="Disable For Dish"
                      value={selectedDishToDisable}
                      onChange={(val) => setSelectedDishToDisable(val)}
                      options={dishesContainingIngredient.map(d => ({ value: d.id, label: d.name }))}
                      placeholder="Select Dish"
                    />

                    <Button3D onClick={() => {
                      if (!selectedDishToDisable) return;

                      setSelectedIngredient(prev => ({
                        ...prev,
                        disabledForDishes: [
                          ...(prev.disabledForDishes || []),
                          selectedDishToDisable
                        ]
                      }));

                      setSelectedDishToDisable("");
                    }}>Add</Button3D>
                  </div>
                </div>

                {/* TABLE OF DISABLED DISHES */}
                {(selectedIngredient.disabledForDishes || []).length > 0 && (
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Dish</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selectedIngredient.disabledForDishes || []).map((dishId) => {
                        const dish = dishesContainingIngredient.find(
                          d => d.id === dishId
                        );

                        return (
                          <tr key={dishId}>
                            <td>{dish?.name || dishId}</td>
                            <td>
                              <div
                                className="modal-danger-btn"
                                onClick={() =>
                                  setSelectedIngredient(prev => ({
                                    ...prev,
                                    disabledForDishes:
                                      (prev.disabledForDishes || []).filter(
                                        id => id !== dishId
                                      )
                                  }))
                                }
                              >
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front close-padding">Remove</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeModal}>Cancel</Button3D>
              <Button3D onClick={handleSave}>Save</Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stocks;