import React, { useState, useMemo } from "react";
import "./Stocks.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import * as XLSX from "xlsx";
import { EmptyRow } from "../App";

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

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [addStock, setAddStock] = useState("");
  const [pricePer100g, setPricePer100g] = useState("");
  const [stockMax, setStockMax] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

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

    const updatedStock = toTwoDecimals(
      Number(selectedIngredient.stockRemaining || 0) + addValue
    );

    const roundedPrice = toTwoDecimals(newPrice);

    try {
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        ingredients: res.data.ingredients.map((ing) =>
          ing.id === selectedIngredient.id
            ? {
              ...ing,
              stockRemaining: updatedStock,
              pricePer100g: roundedPrice,
              stockMax: max,
              expiryDate: expiryDate || null,
              lastUpdated: date
            }
            : ing
        )
      };

      await api.put("/menu", updatedMenu);

      setAdminData((prev) => ({
        ...prev,
        ingredients: updatedMenu.ingredients
      }));

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
                  <td>{ing.lastUpdated}</td>
                  <td>
                    {ing.expiryDate || "-"}
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
        <div className="stocks-modal-overlay">
          <div className="stocks-modal">
            <button
              className="stocks-close-btn"
              onClick={closeModal}
            ></button>

            <h3>Edit Stock & Price for {selectedIngredient.name}</h3>

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
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button onClick={handleSave}>Save</button>
              <button onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stocks;
