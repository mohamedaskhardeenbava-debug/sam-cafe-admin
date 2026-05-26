import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "./KitchenRecipe.css";
import deleteIcon from "../../icon/delete-icon.png";
import api from "../../api";

export default function KitchenRecipe({ adminData, setAdminData }) {
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [recipeSearch, setRecipeSearch] = useState("");

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.toLowerCase();
    return (adminData.recipes || []).filter(r =>
      !q || (r.name || "").toLowerCase().includes(q)
    );
  }, [adminData.recipes, recipeSearch]);

  const exportRecipes = () => {
    if (!filteredRecipes.length) { alert("No recipes to export"); return; }
    const rows = filteredRecipes.map(r => ({
      Name: r.name || "—",
      Steps: countSteps(r.description),
      Description: (r.description || "").replace(/\n/g, " | "),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Recipes");
    XLSX.writeFile(wb, `recipes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const resetForm = () => setForm({ name: "", description: "" });

  const addRecipe = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    const newRecipe = { id: Date.now(), ...form };
    await api.post("/recipes", newRecipe);
    setAdminData(prev => ({ ...prev, recipes: [...prev.recipes, newRecipe] }));
    resetForm();
    setShowForm(false);
  };

  const deleteRecipe = async (id) => {
    await api.delete(`/recipes/${id}`);
    setAdminData(prev => ({
      ...prev,
      recipes: prev.recipes.filter(r => r.id !== id)
    }));
  };

  // Count non-empty lines as steps
  const countSteps = (desc) =>
    (desc || "").split("\n").filter(l => l.trim() !== "").length;

  return (
    <div className="recipe-page">

      {/* HEADER */}
      <div className="recipe-header">
        <h2>Recipes</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="export-btn" onClick={exportRecipes}>Export</button>
          <button className="category-add-btn" onClick={() => setShowForm(true)}>+ Add Recipe</button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="recipe-filter-bar">
        <input
          className="search-input"
          placeholder="🔍 Search recipes…"
          value={recipeSearch}
          onChange={e => setRecipeSearch(e.target.value)}
        />
        {recipeSearch && (
          <button className="ae-clear-filter" onClick={() => setRecipeSearch("")}>Clear</button>
        )}
        <span className="ae-result-count">{filteredRecipes.length} recipe(s)</span>
      </div>

      {/* EMPTY STATE */}
      {filteredRecipes.length === 0 && (
        <div className="recipe-empty">
          <div className="recipe-empty-icon">🍳</div>
          <p>{(!adminData.recipes || adminData.recipes.length === 0) ? "No recipes yet" : "No recipes match your search"}</p>
          <span>{(!adminData.recipes || adminData.recipes.length === 0) ? "Add your first recipe to get started" : "Try a different search term"}</span>
        </div>
      )}

      {/* CARD GRID */}
      <div className="card-grid-wrapper">
        <div className="recipe-card-grid">
          {filteredRecipes.map(r => {
            const steps = countSteps(r.description);
            return (
              <div
                key={r.id}
                className="recipe-card"
                onClick={() => setSelected(r)}
              >
                <div className="recipe-card-content">
                  <h3>{r.name}</h3>
                  {steps > 0 && (
                    <span className="recipe-card-meta">{steps} step{steps !== 1 ? "s" : ""}</span>
                  )}
                </div>

                <button
                  className="recipe-delete-btn"
                  title="Delete recipe"
                  onClick={e => {
                    e.stopPropagation();
                    deleteRecipe(r.id);
                  }}
                >
                  <img src={deleteIcon} alt="Delete" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD MODAL */}
      {showForm && (
        <div className="modal-overlay">
          <form className="modal" onSubmit={addRecipe}>
            <div className="modal-header">
              <h3>Add Recipe</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => { resetForm(); setShowForm(false); }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Recipe Name</label>
                <input
                  autoFocus
                  placeholder="e.g. Grilled Salmon"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label>Steps — one per line</label>
                <textarea
                  placeholder={"Preheat oven to 200°C\nSeason the salmon with salt and pepper\nGrill for 12 minutes…"}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ minHeight: 200 }}
                />
              </div>
            </div>

            <div className="modal-footer ">
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
              >
                Cancel
              </button>
              <button type="submit">Save Recipe</button>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selected.name}</h3>
                <span style={{ fontSize: 12, color: "#a3a3a3", display: "block", marginTop: 2 }}>
                  {countSteps(selected.description)} step{countSteps(selected.description) !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <ul>
                {selected.description
                  ?.split("\n")
                  .filter(line => line.trim() !== "")
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ul>
            </div>

            <div className="modal-footer ">
              <button type="button" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}