/**
 * KitchenRecipe.js  —  Sam Cafe Admin Panel
 * Kitchen recipe management page
 */

import React, { useState, useMemo } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import deleteIcon from "../../icon/delete-icon.png";
import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import Button3D from "../../components/Button3D";

import "./KitchenRecipe.css";

export default function KitchenRecipe({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
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

    const newRecipe = { id: String(Date.now()), ...form };
    try {
      const res = await api.post("/recipes", newRecipe);
      const saved = res.data || newRecipe;
      setAdminData(prev => {
        const alreadyExists = (prev.recipes || []).some(r => r.id === saved.id);
        if (alreadyExists) return prev;
        return { ...prev, recipes: [...(prev.recipes || []), saved] };
      });
      toast.success("Recipe added successfully.");
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add recipe:", err);
      toast.error("Failed to add recipe");
    }
  };

  const deleteRecipe = async (id) => {
    try {
      await api.delete(`/recipes/${id}`);
      setAdminData(prev => ({
        ...prev,
        recipes: prev.recipes.filter(r => r.id !== id)
      }));
      toast.success("Recipe deleted");
    } catch (err) {
      console.error("Failed to delete recipe:", err);
      toast.error("Failed to delete recipe");
    }
  };

  // Count non-empty lines as steps
  const countSteps = (desc) =>
    (desc || "").split("\n").filter(l => l.trim() !== "").length;

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <button
            type="button"
            className="header-collapse-btn"
            onClick={() => setHeaderCollapsed(prev => !prev)}
            title={headerCollapsed ? "Expand header" : "Collapse header"}
            aria-expanded={!headerCollapsed}
          >
            <span className={`header-collapse-arrow${headerCollapsed ? " rotated" : ""}`}>▾</span>
          </button>
          <h2 className="title">Recipes</h2>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportRecipes}>Export</Button3D>
          <Button3D onClick={() => setShowForm(true)}>+ Add Recipe</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="justify">
            <input
              className="search-input"
              placeholder=" Search recipes…"
              value={recipeSearch}
              onChange={e => setRecipeSearch(allowTextInput(recipeSearch, e.target.value, 100, 5))}
            />
            {recipeSearch && (
              <button className="ae-clear-filter" onClick={() => setRecipeSearch("")}>Clear</button>
            )}
            <span className="result-count">{filteredRecipes.length} recipe(s)</span>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {filteredRecipes.length === 0 && (
        <div className="recipe-empty">
          <div className="recipe-empty-icon">🍳</div>
          <p>{(!adminData.recipes || adminData.recipes.length === 0) ? "No recipes yet" : "No recipes match your search"}</p>
          <span>{(!adminData.recipes || adminData.recipes.length === 0) ? "Add your first recipe to get started" : "Try a different search term"}</span>
        </div>
      )}

      {/* CARD GRID */}
      <div className={`card-grid-wrapper${headerCollapsed ? " header-is-collapsed" : ""}`}>
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

                <Button3D variant="cancel" iconOnly title="Delete recipe"
                  onClick={e => {
                    e.stopPropagation();
                    deleteRecipe(r.id);
                  }}><img src={deleteIcon} alt="" /></Button3D>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD MODAL */}
      {showForm && (
        <div className="modal-overlay">
          <form className="admin-modal" onSubmit={addRecipe}>
            <div className="admin-modal-header">
              <h3>Add Recipe</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { resetForm(); setShowForm(false); }}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                    placeholder=" "
                    autoFocus
                    value={form.name}
                    onChange={e => { setForm({ ...form, name: allowTextInput(form.name, e.target.value, 100, 5) }); setFormErrors(p => ({ ...p, name: false })); }}
                  />
                  <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Recipe Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group" style={{ flex: 1 }}>
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.description}
                    onChange={e => { setForm({ ...form, description: allowTextInput(form.description, e.target.value, 500, 100000) }); setFormErrors(p => ({ ...p, description: false })); }}
                    style={{ minHeight: 200 }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Steps — one per line<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button3D>
              <Button3D type="submit">Save Recipe</Button3D>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>{selected.name}</h3>
                <span style={{ fontSize: 12, color: "#a3a3a3", display: "block", marginTop: 2 }}>
                  {countSteps(selected.description)} step{countSteps(selected.description) !== 1 ? "s" : ""}
                </span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => setSelected(null)}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <ul>
                {selected.description
                  ?.split("\n")
                  .filter(line => line.trim() !== "")
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ul>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => setSelected(null)}>Close</Button3D>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}