/**
 * Ingredients.js  —  Sam Cafe Admin Panel
 * Ingredients management page
 */

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { createRecord, updateRecord, deleteRecord } from "../utils/crudUtils";

import deleteIcon from "../icon/delete-icon.png";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { sortArray } from "../App";
import { EmptyRow, EmptyState } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";
import CollapseSection from "../components/CollapseSection";
import { FilterBar } from "../components/FilterBar";
import useAnimatedModal from "../hooks/useAnimatedModal";

import "./Ingredients.css";
import "./ModalCSS.css";

const EMPTY_FORM = {
  id: "",
  name: "",
  brands: [],
  image: "",
  usedInCategories: [],
  pricePer100g: "",
  stockRemaining: "",
  nutritionPer100g: {
    kcal: "",
    protein: "",
    fat: "",
    fibre: ""
  },
  description: "",
  history: ""
};

const generateIngredientId = (name) => {
  const base = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  return "ing_" + (base || "item") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
};

const Ingredients = ({ adminData, setAdminData, onAdd, onUpdate, onDelete, toCamelCase, handleSort, sortConfig }) => {
  // ── Hooks

  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const ingredientFormModal = useAnimatedModal("ingredients-addEdit");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [showBrandInput, setShowBrandInput] = useState(false);
  const [brandInput, setBrandInput] = useState("");

  const navigate = useNavigate();
  const clearIngredientFormFields = () => {
    setIsEditMode(false);
    setFormData(EMPTY_FORM);
    setImagePreview("");
    setFormErrors({});
  };

  const resetIngredientForm = () => {
    ingredientFormModal.close(() => setShowForm(false));
    clearIngredientFormFields();
  };

  const [ingredientSearch, setIngredientSearch] = useState("");

  const sortedIngredients = useMemo(
    () => sortArray(adminData.ingredients, sortConfig),
    [adminData.ingredients, sortConfig]
  );

  const filteredIngredients = useMemo(() => {
    const q = ingredientSearch.toLowerCase();
    return q
      ? sortedIngredients.filter(i =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.brands || []).some(b => b.name.toLowerCase().includes(q))
      )
      : sortedIngredients;
  }, [sortedIngredients, ingredientSearch]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredIngredients.length, 30);

  const handleSave = async () => {
    const e = {};
    if (!formData.name.trim()) e.name = true;
    if (!imagePreview && !formData.image) e.image = true;
    if (!formData.pricePer100g) e.pricePer100g = true;
    if (!formData.stockRemaining) e.stockRemaining = true;
    if (!formData.nutritionPer100g.kcal) e.kcal = true;
    if (!formData.nutritionPer100g.protein) e.protein = true;
    if (!formData.nutritionPer100g.fat) e.fat = true;
    if (!formData.nutritionPer100g.fibre) e.fibre = true;
    if (!formData.description.trim()) e.description = true;
    if (!formData.history.trim()) e.history = true;
    if (Object.keys(e).length) { setFormErrors(e); return; }

    const normalizedName = formData.name.trim().toLowerCase();

    const duplicate = adminData.ingredients.some(
      ing =>
        (!isEditMode || ing.id !== formData.id) &&
        ing.name.trim().toLowerCase() === normalizedName
    );

    if (duplicate) {
      setFormErrors({ name: true });
      return;
    }

    const payload = {
      ...formData,
      brands: formData.brands || [],
      id: isEditMode ? formData.id : generateIngredientId(formData.name),
      pricePer100g: Number(formData.pricePer100g),
      stockRemaining: Number(formData.stockRemaining),
      nutritionPer100g: {
        kcal: Number(formData.nutritionPer100g.kcal),
        protein: Number(formData.nutritionPer100g.protein),
        fat: Number(formData.nutritionPer100g.fat),
        fibre: Number(formData.nutritionPer100g.fibre)
      },
      description: (formData.description),
      history: (formData.history)
    };

    if (isEditMode) {
      await updateRecord({
        api, toast,
        endpoint: `/ingredients/${payload.id}`,
        payload,
        stateKey: "ingredients",
        setAdminData,
        successMsg: "Ingredient updated",
        errorMsg: "Failed to update ingredient",
        onSuccess: resetIngredientForm,
      });
    } else {
      await createRecord({
        api, toast,
        endpoint: "/ingredients",
        payload,
        stateKey: "ingredients",
        setAdminData,
        successMsg: "Ingredient added",
        errorMsg: "Failed to add ingredient",
        onSuccess: resetIngredientForm,
      });
    }
  };

  const handleIngredientImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        image: reader.result
      }));
      setImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };

  const openAddForm = () => {
    clearIngredientFormFields();
    setShowForm(true);
    ingredientFormModal.open();
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
              <h2 className="title">Ingredients</h2>
              <span className="result-count">{filteredIngredients.length} ingredient(s)</span>
            </div>
          </div>
        </div>

        <Button3D onClick={openAddForm}>+ Add Ingredient</Button3D>
      </div>

      {/* FILTER BAR */}
      <CollapseSection collapsed={headerCollapsed}>
        <FilterBar
          search={ingredientSearch}
          onSearchChange={setIngredientSearch}
          searchPlaceholder=" Search name or brand…"
          onClear={() => setIngredientSearch("")}
          active={!!ingredientSearch}
        />
      </CollapseSection>

      {ingredientFormModal.shouldRender && (
        <div className={`modal-overlay ${ingredientFormModal.overlayClass}`}>
          <form
            className={`admin-modal ${ingredientFormModal.modalClass}`}
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}>

            <div className="admin-modal-header">
              <h3>{isEditMode ? "Edit Ingredient" : "Add New Ingredient"}</h3>
              <Button3D variant="cancel" iconOnly aria-label="Close"
                onClick={resetIngredientForm}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className={`mat-input ${formErrors.name ? " mat-error" : ""}`}
                    placeholder=" "
                    autoFocus
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: allowTextInput(
                          prev.name,
                          e.target.value,
                          100,
                          5
                        )
                      }))
                    }
                    onBlur={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: toCamelCase(e.target.value)
                      }))
                    }
                  />
                  <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Ingredient Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group">
                <div className={`file-wrap${formErrors.image ? " file-error" : ""}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleIngredientImageUpload(e);
                      setFormErrors(p => ({ ...p, image: false }));
                    }}
                    className={`file-input${formErrors.image ? " mat-error" : ""}`}
                  />

                  <div className={`file-label${formErrors.image ? " file-label-error" : ""}`}>
                    {imagePreview ? "✔ Ingredient Image selected" : "Choose Ingredient Image"}
                  </div>
                </div>

                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Ingredient preview"
                    className="staff-image-preview"
                  />
                )}
              </div>

              <div className="admin-form-group">
                <label>Used For</label>
                <div className="checkbox-grid">
                  {adminData.categories.length === 0 ? (
                    <EmptyState message="No categories or dishes available yet" />
                  ) : (
                    adminData.categories.flatMap(cat => {

                    if ((cat.subCategories || []).length > 0) {

                      return cat.subCategories.map(sub => (

                        <label key={sub.id} className="checkbox-item">

                          <input
                            type="checkbox"
                            checked={formData.usedInCategories.includes(sub.id)}
                            onChange={(e) => {

                              const updated = e.target.checked
                                ? [...formData.usedInCategories, sub.id]
                                : formData.usedInCategories.filter(id => id !== sub.id);

                              setFormData({
                                ...formData,
                                usedInCategories: updated
                              });

                            }}
                          />

                          {sub.name}

                        </label>

                      ));

                    }

                    return (

                      <label key={cat.id} className="checkbox-item">

                        <input
                          type="checkbox"
                          checked={formData.usedInCategories.includes(cat.id)}
                          onChange={(e) => {

                            const updated = e.target.checked
                              ? [...formData.usedInCategories, cat.id]
                              : formData.usedInCategories.filter(id => id !== cat.id);

                            setFormData({
                              ...formData,
                              usedInCategories: updated
                            });

                          }}
                        />

                        {cat.name}

                      </label>

                    );

                  })
                  )}
                </div>
              </div>

              <div className="admin-form-group">
                <label>Nutrition per 100g</label>
                <div className="nutrition-grid border">
                  {["kcal", "protein", "fat", "fibre"].map((key) => (
                    <div className="admin-form-group" key={key}>
                      <div className="mat">
                        <input
                          className={`mat-input${formErrors[key] ? " mat-error" : ""}`}
                          placeholder=" "

                          type="number"
                          min="1"
                          step="1"
                          value={formData.nutritionPer100g[key]}
                          onChange={(e) => {
                            setFormData({ ...formData, nutritionPer100g: { ...formData.nutritionPer100g, [key]: e.target.value } });
                            setFormErrors(p => ({ ...p, [key]: false }));
                          }}
                        />
                        <label className={`mat-label${formErrors[key] ? " mat-label-error" : ""}`}>{key}<span className="rf-req">*</span></label>
                        <span className={`mat-bar${formErrors[key] ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.pricePer100g ? " mat-error" : ""}`}
                      placeholder=" "
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.pricePer100g}
                      onChange={(e) => { setFormData({ ...formData, pricePer100g: e.target.value }); setFormErrors(p => ({ ...p, pricePer100g: false })); }}
                    />
                    <label className={`mat-label${formErrors.pricePer100g ? " mat-label-error" : ""}`}>Price per 100g (₹)<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.pricePer100g ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.stockRemaining ? " mat-error" : ""}`}
                      placeholder=" "
                      type="number"
                      min="0"
                      step="1"
                      value={formData.stockRemaining}
                      onChange={(e) => { setFormData({ ...formData, stockRemaining: e.target.value }); setFormErrors(p => ({ ...p, stockRemaining: false })); }}
                    />
                    <label className={`mat-label${formErrors.stockRemaining ? " mat-label-error" : ""}`}>Stock Remaining (g)<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.stockRemaining ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "

                    value={formData.description}
                    onChange={(e) => { setFormData({ ...formData, description: allowTextInput(formData.description, e.target.value, 500, 100000) }); setFormErrors(p => ({ ...p, description: false })); }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Description<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.history ? " mat-error" : ""}`}
                    placeholder=" "

                    value={formData.history}
                    onChange={(e) => { setFormData({ ...formData, history: allowTextInput(formData.history, e.target.value, 500, 100000) }); setFormErrors(p => ({ ...p, history: false })); }}
                  />
                  <label className={`mat-label${formErrors.history ? " mat-label-error" : ""}`}>History<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.history ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="admin-form-group">
                <label>Brands</label>

                {!showBrandInput && (
                  <Button3D onClick={() => setShowBrandInput(true)}>Add Brand</Button3D>
                )}

                {showBrandInput && (
                  <div className="admin-form-group">

                    <div className="mat">
                      <input
                        className="mat-input"
                        placeholder=" "
                        autoFocus
                        type="text"
                        value={brandInput}
                        onChange={(e) =>
                          setBrandInput(
                            allowTextInput(brandInput, e.target.value, 50, 2)
                          )
                        }
                      />
                      <label className="mat-label">Brand Name<span className="rf-req">*</span></label>
                      <span className="mat-bar" />
                    </div>

                    <div className="action">
                      <Button3D variant="cancel" onClick={() => {
                        setBrandInput("");
                        setShowBrandInput(false);
                      }}>Cancel</Button3D>

                      <Button3D onClick={() => {
                        if (!brandInput.trim()) return;

                        const id = `brand_${brandInput
                          .toLowerCase()
                          .replace(/\s+/g, "_")}`;

                        if (
                          formData.brands.some(
                            b => b.name.toLowerCase() === brandInput.toLowerCase()
                          )
                        ) {
                          toast.warning("Brand already added");
                          return;
                        }

                        setFormData(prev => ({
                          ...prev,
                          brands: [...prev.brands, { id, name: brandInput }]
                        }));

                        setBrandInput("");
                        setShowBrandInput(false);
                      }}>Add</Button3D>
                    </div>
                  </div>
                )}

                {formData.brands.length > 0 && (
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.brands.map((b, index) => (
                        <tr key={b.id}>
                          <td>{b.name}</td>
                          <td>
                            <div
                              className="modal-danger-btn"
                              onClick={() =>
                                setFormData(prev => ({
                                  ...prev,
                                  brands: prev.brands.filter((_, i) => i !== index)
                                }))
                              }
                            >
                              <span className="shadow"></span>
                              <span className="edge"></span>
                              <span className="front close-padding">Remove</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={resetIngredientForm}>Cancel</Button3D>
              <Button3D type="submit">{isEditMode ? "Save Changes" : "Add Ingredient"}</Button3D>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper" ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th className="icon-width">Image</th>
              <th
                onClick={() => handleSort("name")}
                className={sortConfig.key === "name" ? "sorted" : ""}
              >
                <span className="th-content sort-th">
                  <span>Name</span>
                  <span className="sort-arrow">
                    {sortConfig.direction === "asc" ? "▲" : "▼"}
                  </span>
                </span>
              </th>
              <th>Brand</th>
              <th className="icon-width">Calories</th>
              <th className="icon-width">Protein</th>
              <th className="icon-width">Fibre</th>
              <th className="icon-width">Fat</th>
              <th className="icon-width">Delete</th>
            </tr>
          </thead>

          <tbody>
            {filteredIngredients.length === 0 ? (
              <EmptyRow colSpan={8} message="No ingredients found" />
            ) : (
              filteredIngredients.slice(0, displayLimit).map((ingredient) => (
                <tr key={ingredient.id}>
                  <td className="icon-width">
                    <div className="table-image">
                      <img src={ingredient.image} alt={ingredient.name} />
                    </div>
                  </td>

                  <td>
                    <span
                      className="clickable"
                      onClick={() => navigate(`/ingredients/${ingredient.id}`)}
                    >
                      {ingredient.name}
                    </span>
                  </td>
                  <td>
                    {ingredient.brands?.length
                      ? ingredient.brands.map(b => b.name).join(" / ")
                      : "—"}
                  </td>
                  <td className="icon-width">{ingredient.nutritionPer100g.kcal}</td>
                  <td className="icon-width">{ingredient.nutritionPer100g.protein}g</td>
                  <td className="icon-width">{ingredient.nutritionPer100g.fibre}g</td>
                  <td className="icon-width">{ingredient.nutritionPer100g.fat}g</td>

                  <td className="icon-width">
                    <Button3D variant="cancel" iconOnly onClick={() => {
                      // Capture the index now (at click time) so revert can
                      // restore the row at its original position, not appended
                      const originalIndex = adminData.ingredients.findIndex(
                        i => i.id === ingredient.id
                      );
                      toast.confirm(
                        `Delete "${ingredient.name}"?`,
                        async () => {
                          // Optimistic removal
                          setAdminData(prev => ({
                            ...prev,
                            ingredients: prev.ingredients.filter(
                              i => i.id !== ingredient.id
                            )
                          }));
                          try {
                            await api.delete(`/ingredients/${ingredient.id}`);
                            toast.success("Ingredient deleted");
                          } catch (err) {
                            // Revert at original position (single toast)
                            console.error("Delete ingredient failed:", err);
                            setAdminData(prev => {
                              const next = [...prev.ingredients];
                              next.splice(Math.min(originalIndex, next.length), 0, ingredient);
                              return { ...prev, ingredients: next };
                            });
                            toast.error("Failed to delete ingredient");
                          }
                        }
                      );
                    }}><img src={deleteIcon} /></Button3D>
                  </td>
                </tr>
              )))}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={8}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>
    </div>
  );
};

export default Ingredients;