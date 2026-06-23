import React, { useState, useMemo } from "react";
import { exportToExcel } from "../../utils/excelUtils";
import "./KitchenRecipe.css";
import deleteIcon from "../../icon/delete-icon.png";
import closeIcon from "../../icon/close-icon.png";
import api from "../../api";
import { useToast } from "../../useToast";

export default function KitchenRecipe({ adminData, setAdminData }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [recipeSearch, setRecipeSearch] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.toLowerCase();
    return (adminData.recipes || []).filter(r =>
      !q || (r.name || "").toLowerCase().includes(q)
    );
  }, [adminData.recipes, recipeSearch]);

  const exportRecipes = () => {
    if (!filteredRecipes.length) { toast.warning("No recipes to export"); return; }
    const rows = filteredRecipes.map(r => ({
      Name: r.name || "—",
      Steps: countSteps(r.description),
      Description: (r.description || "").replace(/\n/g, " | "),
    }));
    exportToExcel({ rows, sheetName: "Recipes", fileName: `recipes_${new Date().toISOString().slice(0, 10)}.xlsx` });
  };

  const resetForm = () => { setForm({ name: "", description: "" }); setFormErrors({}); };

  const addRecipe = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.description.trim()) errs.description = true;
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    const newRecipe = { id: Date.now(), ...form };
    await api.post("/recipes", newRecipe);
    setAdminData(prev => ({ ...prev, recipes: [...prev.recipes, newRecipe] }));
    toast.success("Recipe added successfully.");
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
          <button
            className="modal-save-btn"
            onClick={exportRecipes}
          >
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">Export</span>
          </button>
          <button className="modal-save-btn" onClick={() => setShowForm(true)}>
            <span className="shadow"></span>
            <span className="edge"></span>
            <span className="front">+ Add Recipe</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="recipe-filter-bar">
        <input
          className="search-input"
          placeholder=" Search recipes…"
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
                  className="modal-cancel-btn"
                  title="Delete recipe"
                  onClick={e => {
                    e.stopPropagation();
                    deleteRecipe(r.id);
                  }}
                >
                  <span className="shadow"></span>
                  <span className="edge"></span>
                  <span className="front close-padding">
                    <img src={deleteIcon} alt="" />
                  </span>
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
                className="modal-cancel-btn"
                onClick={() => { resetForm(); setShowForm(false); }}
              >
                <span class="shadow"></span>
                <span class="edge"></span>
                <span class="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                    placeholder=" "
                    autoFocus
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(p => ({ ...p, name: false })); }}
                  />
                  <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Recipe Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.description}
                    onChange={e => { setForm({ ...form, description: e.target.value }); setFormErrors(p => ({ ...p, description: false })); }}
                    style={{ minHeight: 200 }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Steps — one per line<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>
            </div>

            <div className="modal-footer ">
              <button
                className="modal-cancel-btn"
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Cancel</span>
              </button>
              <button
                className="modal-save-btn"
                type="submit"
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Save Recipe</span>
              </button>
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
                className="modal-cancel-btn"
                onClick={() => setSelected(null)}
              >
                <span class="shadow"></span>
                <span class="edge"></span>
                <span class="front close-padding"><img src={closeIcon} /></span>
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

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                type="button"
                onClick={() => setSelected(null)}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}