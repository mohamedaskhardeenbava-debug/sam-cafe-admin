import React, { useState, useMemo, useEffect } from "react";
import "./Stocks.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import deleteIcon from "../icon/delete-icon.png";
import * as XLSX from "xlsx";
import { EmptyRow } from "../App";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { formatDisplayDate } from "../App"
import socket from "../socket";

const toTwoDecimals = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const applyAutoColumnWidth = (sheet, rows) => {
  if (!rows.length) return;

  sheet["!cols"] = Object.keys(rows[0]).map(key => ({
    wch: Math.max(
      key.length,
      ...rows.map(r => String(r[key] ?? "").length)
    ) + 2
  }));
};

const Stocks = ({ adminData, setAdminData, handleSort, sortConfig }) => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const [openDishDropdown, setOpenDishDropdown] = useState(false);
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

  useEffect(() => {
    const closeDropdowns = () => {
      setOpenDishDropdown(false);
    };

    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  const dishesContainingIngredient = useMemo(() => {
    if (!selectedIngredient) return [];

    return adminData.categories.flatMap(category => {

      // 1️⃣ Dishes directly inside category
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


      // 2️⃣ Dishes inside subCategories
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
      alert("Price must be greater than 0");
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

      // ✅ MOVE HERE
      socket.emit("data-change", {
        resource: "ingredients",
        action: "updated",
        payload: res.data
      });

      closeModal();

    } catch (err) {
      console.error("Failed to update stock", err);
    }
  };

  const handleExportStocks = () => {
    if (!adminData.ingredients.length) {
      alert("No stock data available");
      return;
    }

    const rows = adminData.ingredients.map((ing) => ({
      Ingredient: ing.name,
      "Stock Remaining (kg)": toTwoDecimals(ing.stockRemaining ?? 0),
      "Last Purchased": ing.lastUpdated || "-"
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    applyAutoColumnWidth(sheet, rows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Stocks");

    XLSX.writeFile(workbook, "stocks_export.xlsx");
  };

  const getDisabledLabel = (ingredient) => {
    if (ingredient.isDisabledGlobally === true) {
      return { text: "All", type: "all" };
    }

    const disabled = ingredient.disabledForDishes || [];

    if (disabled.length === 0) {
      return { text: "—", type: "none" };
    }

    // Get dish names
    const dishNames = adminData.categories
      .flatMap(cat => cat.dishes || [])
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
          className="stocks-export-btn"
          onClick={handleExportStocks}
        >
          Export
        </button>
      </div>

      {/* TABLE */}
      <div className="stocks-table-wrapper">
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
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
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
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
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
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
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
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
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
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
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
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                </span>
              </th>
              <th>Disabled In</th>
              <th>Edit</th>
            </tr>
          </thead>

          <tbody>
            {sortedIngredients.length === 0 ? (
              <EmptyRow colSpan={6} message="No stock data available" />
            ) : (
              sortedIngredients.map((ing) => (
                <tr key={ing.id}>
                  <td
                    className="clickable"
                    onClick={() => navigate(`/ingredients/${ing.id}`)}
                  >
                    {ing.name}
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
                      className="stocks-edit-btn"
                      onClick={() => openEditModal(ing)}
                    >
                      <img src={editIcon} alt="" />
                    </button>
                  </td>
                </tr>
              )))}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && selectedIngredient && (
        <div className="category-modal-overlay">
          <div className="category-modal">
            <div className="category-modal-header">
              <button
                className="category-close-btn"
                onClick={closeModal}
              ></button>

              <h3>Edit Stock & Price for {selectedIngredient.name}</h3>
            </div>

            <div className="category-modal-body">
              <div className="stocks-form-group">
                <label>Price per 100g</label>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  step="1"
                  value={pricePer100g}
                  onChange={(e) => setPricePer100g(e.target.value)}
                />
              </div>

              <div className="stocks-form-group">
                <label>Stock Max (kg)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockMax}
                  onChange={(e) => setStockMax(e.target.value)}
                />
              </div>

              <div className="stocks-form-group">
                <label>Add Stock in kg</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={addStock}
                  onChange={(e) => setAddStock(e.target.value)}
                />
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

              <div className="stocks-form-group">
                <label>Expiry Date</label>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    value={expiryDate ? dayjs(expiryDate) : null}
                    format="DD/MM/YYYY"
                    onChange={(newValue) => {
                      if (!newValue) {
                        setExpiryDate("");
                        return;
                      }

                      setExpiryDate(newValue.format("YYYY-MM-DD"));
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        fullWidth: true
                      }
                    }}
                  />
                </LocalizationProvider>

              </div>

              <div className="disable-section border">
                <h4>Visibility Controls</h4>

                {/* GLOBAL DISABLE */}
                <div className="stocks-form-group">
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
                <div className="stocks-form-group">
                  <label>Disable For Dish</label>

                  <div className="stocks-form-group-select-container">
                    <div className="orders-dropdown-wrapper">
                      <button
                        type="button"
                        className="orders-status-dropdown"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDishDropdown(prev => !prev);
                        }}
                      >
                        {selectedDishToDisable || "Select Dish"}
                      </button>

                      {openDishDropdown && (
                        <div className="orders-dropdown-menu">
                          {dishesContainingIngredient.map(d => (
                            <div
                              key={d.id}
                              onClick={() => {
                                setSelectedDishToDisable(d.id);
                                setOpenDishDropdown(false);
                              }}
                            >
                              {d.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="add-visibility-button"
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
                      Add
                    </button>
                  </div>
                </div>

                {/* TABLE OF DISABLED DISHES */}
                {(selectedIngredient.disabledForDishes || []).length > 0 && (
                  <table className="stocks-form-table">
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
                                className="ingredient-delete-btn"
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
                                <img src={deleteIcon} alt="" />
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

            <div className="category-modal-footer">
              <div className="form-actions">
                <button onClick={handleSave}>Save</button>
                <button onClick={closeModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stocks;
