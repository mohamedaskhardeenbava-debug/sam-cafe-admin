import React, { useState, useMemo, useEffect } from "react";
import { exportToExcel } from "../utils/excelUtils";
import "./Stocks.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import closeIcon from "../icon/close-icon.png";
import { EmptyRow } from "../App";
import { formatDisplayDate } from "../App";
import { CustomDatePicker } from "../components/CustomDatePicker";
import socket from "../socket";
import useInfiniteScroll from "../components/useInfiniteScroll";
import { useToast } from "../useToast";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";
import CustomDropdown from "../components/CustomDropdown";

const toTwoDecimals = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

<<<<<<< HEAD

// ── CustomDropdown (floating label version) ──────────────────────────────────
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

  const wrapperClass = [
    "mat-select",
    value ? "has-value" : "",
    open ? "is-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} ref={ref}>
      {label && (
        <label className="mat-label">
          {label}{required && <span className="rf-req">*</span>}
        </label>
      )}
      <div className="dishes-dropdown-wrapper">
        <button type="button" className="dishes-status-dropdown"
          onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
          {displayLabel || ""}
        </button>
        {open && (
          <div className="dropdown-menu">
            <div onClick={() => { onChange(""); setOpen(false); }}>
              {placeholder}
            </div>
            {options.map((o, i) => {
              const val = o.value !== undefined ? o.value : o;
              const lbl = o.label !== undefined ? o.label : o;
              return (
                <div key={i} onClick={() => { onChange(val); setOpen(false); }}
                  style={{ padding: "8px 12px", fontSize: 14, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  {lbl}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <span className="mat-bar" />
    </div>
  );
}
=======
>>>>>>> 630e8829c13e1815b761ce29c9b3d4707d7412d7

const Stocks = ({ adminData, setAdminData, handleSort, sortConfig }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);


  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

  const { displayLimit, sentinelRef, containerRef, hasMore } =
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
  };

  const closeModal = () => {
    setShowEditModal(false);
    setSelectedIngredient(null);
    setAddStock("");
    setPricePer100g("");
    setStockMax("");
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
      "Last Purchased": ing.lastUpdated || "-"
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
    <div className="stocks-page">
      {/* HEADER */}
      <div className="stocks-header">
        <h2 className="stocks-title">Stocks</h2>

        <button
          className="modal-save-btn"
          onClick={handleExportStocks}
        >
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front">Export</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="stocks-filter-bar">
        <input
          className="search-input"
          placeholder=" Search ingredient or brand…"
          value={stockSearch}
          onChange={e => setStockSearch(e.target.value)}
        />
        {stockSearch && (
          <button className="ae-clear-filter" onClick={() => setStockSearch("")}>Clear</button>
        )}
        <span className="ae-result-count">{filteredIngredients.length} ingredient(s)</span>
      </div>

      {/* TABLE */}
      <div className="stocks-table-wrapper" ref={containerRef}>
        <table className="stocks-table">
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
              <th>Edit</th>
            </tr>
          </thead>

          <tbody>
            {filteredIngredients.length === 0 ? (
              <EmptyRow colSpan={6} message="No stock data available" />
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
                      : "-"}
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
                    {formatDisplayDate(ing.expiryDate) || "-"}
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
                  <td>
                    <button
                      className="modal-cancel-btn"
                      onClick={() => openEditModal(ing)}
                    >
                      <span className="shadow"></span>
                      <span className="edge"></span>
                      <span className="front close-padding"><img src={editIcon} /></span>
                    </button>
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
      </div>
      {showEditModal && selectedIngredient && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Stock & Price for {selectedIngredient.name}</h3>
              <button
                className="modal-cancel-btn"
                onClick={closeModal}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
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

              <div className="form-group">
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

              <div className="form-group">
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

              <div className="form-group">
                <label>Expiry Date</label>

                <CustomDatePicker
                  value={expiryDate}
                  onChange={(v) => setExpiryDate(v)}
                  placeholder="Select expiry date"
                />

              </div>

              <div className="form-group border">
                <h4>Visibility Controls</h4>

                {/* GLOBAL DISABLE */}
                <div className="form-group">
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
                <div className="form-group">
                  <div className="form-group">
                    <CustomDropdown
                      label="Disable For Dish"
                      value={selectedDishToDisable}
                      onChange={(val) => setSelectedDishToDisable(val)}
                      options={dishesContainingIngredient.map(d => ({ value: d.id, label: d.name }))}
                      placeholder="Select Dish"
                    />

                    <button
                      type="button"
                      className="modal-save-btn"
                      onClick={() => {
                        if (!selectedDishToDisable) return;

                        setSelectedIngredient(prev => ({
                          ...prev,
                          disabledForDishes: [
                            ...(prev.disabledForDishes || []),
                            selectedDishToDisable
                          ]
                        }));

                        setSelectedDishToDisable("");
                      }}
                    >
                      <span className="shadow"></span>
                      <span className="edge"></span>
                      <span className="front">Add</span>
                    </button>
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

            <div className="modal-footer">
              <button
                onClick={closeModal}
                className="modal-cancel-btn"
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Cancel</span>
              </button>
              <button
                className="modal-save-btn"
                onClick={handleSave}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stocks;