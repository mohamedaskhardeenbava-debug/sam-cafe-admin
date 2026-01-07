import React, { useState, useMemo } from "react";
import "./Stocks.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";

const Stocks = ({ adminData, setAdminData }) => {
  const navigate = useNavigate();

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [addStock, setAddStock] = useState("");
  const [pricePer100g, setPricePer100g] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [stockMax, setStockMax] = useState("");

  /* ---------------- SORT STATE ---------------- */
  const [sortConfig, setSortConfig] = useState({
    key: "name",        //  default sort by name
    direction: "asc"    //  ascending
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc"
          ? "desc"
          : "asc"
    }));
  };

  const calculateStockPercent = (ing) => {
    const { stockRemaining, stockMax } = ing;

    if (!stockMax || stockMax <= 0) return 0;

    const percent = (stockRemaining / stockMax) * 100;

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
  } else if (sortConfig.key === "stock") {
    aVal = a.stockRemaining ?? 0;
    bVal = b.stockRemaining ?? 0;
  } else if (sortConfig.key === "stockPercent") {
    aVal = calculateStockPercent(a);
    bVal = calculateStockPercent(b);
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
    setStockMin(ingredient.stockMin ?? "");
    setStockMax(ingredient.stockMax ?? "");
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
    setSelectedIngredient(null);
    setAddStock("");
    setPricePer100g("");
    setStockMin("");
    setStockMax("");
  };

  const handleSave = async () => {
    const addValue = Number(addStock || 0);
    const newPrice = Number(pricePer100g);
    const min = Number(stockMin);
    const max = Number(stockMax);

    if (newPrice <= 0) {
      alert("Price must be greater than 0");
      return;
    }

    if (min < 0 || max <= 0 || min >= max) {
      alert("Stock Min must be less than Stock Max");
      return;
    }

    const updatedStock =
      Number(selectedIngredient.stockRemaining || 0) + addValue;

    try {
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        ingredients: res.data.ingredients.map((ing) =>
          ing.id === selectedIngredient.id
            ? {
              ...ing,
              stockRemaining: updatedStock,
              pricePer100g: newPrice,
              stockMin: min,
              stockMax: max
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

  return (
    <div className="stocks-page">
      {/* HEADER */}
      <div className="stocks-header">
        <h2 className="stocks-title">Stocks</h2>
      </div>

      {/* TABLE */}
      <div className="stocks-table-wrapper">
        <table className="stocks-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("name")}>
                Ingredient
              </th>
              <th onClick={() => handleSort("price")}>
                Price / 100g
              </th>
              <th onClick={() => handleSort("stock")}>
                Stock (kg)
              </th>

              <th onClick={() => handleSort("stockPercent")}>
                Stocks (%)
                {/* {sortConfig.key === "stockPercent" &&
                  (sortConfig.direction === "asc" ? " ↑" : " ↓")} */}
              </th>

              <th>Edit</th>
            </tr>
          </thead>

          <tbody>
            {sortedIngredients.map((ing) => (
              <tr key={ing.id}>
                <td>{ing.name}</td>
                <td>₹{ing.pricePer100g}</td>
                <td>{ing.stockRemaining ?? 0}</td>
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
                <td>
                  <button
                    className="stocks-edit-btn"
                    onClick={() => openEditModal(ing)}
                  >
                    <img src={editIcon} alt="" />
                  </button>
                </td>
              </tr>
            ))}
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
              <label>Stock Min (kg)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={stockMin}
                onChange={(e) => setStockMin(e.target.value)}
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
                {selectedIngredient.stockRemaining || 0} + {addStock} ={" "}
                {Number(selectedIngredient.stockRemaining || 0) +
                  Number(addStock)}{" "}
                kg
              </p>
            )}

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
