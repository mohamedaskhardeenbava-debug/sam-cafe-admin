/**
 * KitchenRecipe.js  —  Sam Cafe Admin Panel
 * Kitchen recipe management page
 *
 * The Add/Edit modal has two tabs: "Required Ingredients" (pick a dish
 * from Dishes to auto-fill its ingredients + quantities, editable after)
 * and "Procedure" (the original one-step-per-line textarea).
 */

import React, { useState, useMemo } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";

import deleteIcon from "../../icon/delete-icon.png";
import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import CollapseChevron from "../../components/CollapseChevron";
import CustomDropdown from "../../components/CustomDropdown";

import "../Common.css";
import "./KitchenRecipe.css";

const EMPTY_FORM = { name: "", description: "", ingredients: [] };

export default function KitchenRecipe({ adminData, setAdminData }) {
  // ── Hooks

  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const recipeDetailModal = useAnimatedModal("kitchenRecipe-detail");
  const [showForm, setShowForm] = useState(false);
  const addRecipeModal = useAnimatedModal("kitchenRecipe-add");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [modalTab, setModalTab] = useState("ingredients"); // "ingredients" | "procedure"
  const [selectedDishId, setSelectedDishId] = useState("");

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.toLowerCase();
    return (adminData.recipes || []).filter(r =>
      !q || (r.name || "").toLowerCase().includes(q)
    );
  }, [adminData.recipes, recipeSearch]);

  // Dishes live nested under categories/subCategories (see Dishes.js),
  // not as a flat adminData.dishes array — flatten them all here for the
  // "auto-fill from a dish" picker.
  const allDishes = useMemo(() => {
    const out = [];
    (adminData.categories || []).forEach(cat => {
      (cat.dishes || []).forEach(d => out.push(d));
      (cat.subCategories || []).forEach(sub => (sub.dishes || []).forEach(d => out.push(d)));
    });
    return out;
  }, [adminData.categories]);

  const dishOptions = useMemo(
    () => allDishes.map(d => ({ value: d.id, label: d.name })),
    [allDishes]
  );

  const exportRecipes = () => {
    if (!filteredRecipes.length) { toast.warning("No recipes to export"); return; }
    const rows = filteredRecipes.map(r => ({
      Name: r.name || "—",
      Ingredients: (r.ingredients || []).map(i => `${i.name} (${i.quantity})`).join(", "),
      Steps: countSteps(r.description),
      Description: (r.description || "").replace(/\n/g, " | "),
    }));
    exportToExcel({ rows, sheetName: "Recipes", fileName: `recipes_${new Date().toISOString().slice(0, 10)}.xlsx` });
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalTab("ingredients");
    setSelectedDishId("");
  };

  // Selecting a dish auto-fills the ingredients tab with that dish's own
  // ingredient list + quantities (from Dishes) — still fully editable
  // afterward, since a recipe's ingredients can diverge from the dish's
  // over time (e.g. batch cooking quantities).
  const handleDishSelect = (dishId) => {
    setSelectedDishId(dishId);
    const dish = allDishes.find(d => d.id === dishId);
    if (!dish) return;
    setForm(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : dish.name,
      ingredients: (dish.ingredients || []).map(ing => ({ name: ing.name, quantity: ing.quantity || "" })),
    }));
  };

  const handleIngredientChange = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)),
    }));
  };

  const handleAddBlankIngredient = () => {
    setForm(prev => ({ ...prev, ingredients: [...prev.ingredients, { name: "", quantity: "" }] }));
  };

  const handleRemoveIngredient = (index) => {
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
  };

  const addRecipe = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.description.trim()) errs.description = true;
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      setModalTab(errs.description ? "procedure" : "ingredients");
      return;
    }

    const cleanIngredients = form.ingredients
      .filter(ing => ing.name.trim())
      .map(ing => ({ name: ing.name.trim(), quantity: (ing.quantity || "").toString().trim() }));

    const newRecipe = { id: String(Date.now()), name: form.name, description: form.description, ingredients: cleanIngredients };
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
      addRecipeModal.close(() => setShowForm(false));
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
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand header" : "Collapse header"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Recipes</h2>
              <span className="result-count">{filteredRecipes.length} recipe(s)</span>
            </div>
          </div>
        </div>
        <div className="header-btn-container">
          <Button3D onClick={exportRecipes}>Export</Button3D>
          <Button3D onClick={() => { setShowForm(true); addRecipeModal.open(); }}>+ Add Recipe</Button3D>
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
            const ingCount = (r.ingredients || []).length;
            return (
              <div
                key={r.id}
                className="recipe-card"
                onClick={() => { setSelected(r); recipeDetailModal.open(); }}
              >
                <div className="recipe-card-content">
                  <h3>{r.name}</h3>
                  <span className="recipe-card-meta">
                    {ingCount > 0 ? `${ingCount} ingredient${ingCount !== 1 ? "s" : ""}` : ""}
                    {ingCount > 0 && steps > 0 ? " · " : ""}
                    {steps > 0 ? `${steps} step${steps !== 1 ? "s" : ""}` : ""}
                  </span>
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
      {addRecipeModal.shouldRender && (
        <div className={`modal-overlay ${addRecipeModal.overlayClass}`}>
          <form className={`admin-modal ${addRecipeModal.modalClass}`} onSubmit={addRecipe}>
            <div className="admin-modal-header">
              <h3>Add Recipe</h3>
              <Button3D variant="cancel" iconOnly onClick={() => { resetForm(); addRecipeModal.close(() => setShowForm(false)); }}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-form-group" style={{ padding: "0 20px" }}>
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

            <div className="filter-pills recipe-modal-tabs">
              <button
                type="button"
                className={`filter-pill${modalTab === "ingredients" ? " active" : ""}`}
                onClick={() => setModalTab("ingredients")}
              >
                Required Ingredients
              </button>
              <button
                type="button"
                className={`filter-pill${modalTab === "procedure" ? " active" : ""}${formErrors.description ? " filter-pill-error" : ""}`}
                onClick={() => setModalTab("procedure")}
              >
                Procedure
              </button>
            </div>

            <div className="admin-modal-body">
              {modalTab === "ingredients" ? (
                <div className="recipe-ingredients-tab">
                  <div className="admin-form-group">
                    <CustomDropdown
                      label="Auto-fill from a dish"
                      value={selectedDishId}
                      onChange={handleDishSelect}
                      options={dishOptions}
                      placeholder="Select a dish to pull its ingredients"
                    />
                  </div>

                  {form.ingredients.length > 0 && (
                    <div className="recipe-ing-list">
                      {form.ingredients.map((ing, i) => (
                        <div className="recipe-ing-row" key={i}>
                          <input
                            className="recipe-ing-input"
                            placeholder="Ingredient name"
                            value={ing.name}
                            onChange={e => handleIngredientChange(i, "name", e.target.value)}
                          />
                          <input
                            className="recipe-ing-input recipe-ing-qty"
                            placeholder="Quantity"
                            value={ing.quantity}
                            onChange={e => handleIngredientChange(i, "quantity", e.target.value)}
                          />
                          <Button3D variant="cancel" iconOnly title="Remove ingredient" onClick={() => handleRemoveIngredient(i)}>
                            <img src={closeIcon} alt="" />
                          </Button3D>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button3D variant="cancel" onClick={handleAddBlankIngredient} type="button">+ Add Ingredient</Button3D>
                </div>
              ) : (
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
              )}
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => { resetForm(); addRecipeModal.close(() => setShowForm(false)); }}>Cancel</Button3D>
              <Button3D type="submit">Save Recipe</Button3D>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {recipeDetailModal.shouldRender && (
        <div className={`modal-overlay ${recipeDetailModal.overlayClass}`} onClick={() => recipeDetailModal.close(() => setSelected(null))}>
          <div className={`admin-modal ${recipeDetailModal.modalClass}`} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h3>{selected.name}</h3>
                <span style={{ fontSize: 12, color: "#a3a3a3", display: "block", marginTop: 2 }}>
                  {countSteps(selected.description)} step{countSteps(selected.description) !== 1 ? "s" : ""}
                </span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => recipeDetailModal.close(() => setSelected(null))}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              {(selected.ingredients || []).length > 0 && (
                <>
                  <h4 className="recipe-detail-subhead">Required Ingredients</h4>
                  <ul className="recipe-detail-ing-list">
                    {selected.ingredients.map((ing, i) => (
                      <li key={i}><span>{ing.name}</span><span className="recipe-detail-ing-qty">{ing.quantity}</span></li>
                    ))}
                  </ul>
                </>
              )}
              <h4 className="recipe-detail-subhead">Procedure</h4>
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
              <Button3D variant="cancel" onClick={() => recipeDetailModal.close(() => setSelected(null))}>Close</Button3D>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}