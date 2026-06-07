import React, { useState, useMemo } from "react";
import "./Ingredients.css";
import "./ModalCSS.css";
import { useNavigate } from "react-router-dom";
import deleteIcon from "../icon/delete-icon.png";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { sortArray } from "../App";
import { EmptyRow } from "../App";
import api from "../api";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";
import { useToast } from "../useToast";


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
  return "ing_" + (base || "item") + "_" + Date.now();
};

const Ingredients = ({ adminData, setAdminData, onAdd, onUpdate, onDelete, toCamelCase, handleSort, sortConfig }) => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [showBrandInput, setShowBrandInput] = useState(false);
  const [brandInput, setBrandInput] = useState("");

  const navigate = useNavigate();
  const resetIngredientForm = () => {
    setShowForm(false);
    setIsEditMode(false);
    setFormData(EMPTY_FORM);
    setImagePreview("");
    setFormErrors({});
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

  const { displayLimit, sentinelRef, containerRef, hasMore } =
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
      id: generateIngredientId(formData.name),
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
      await api.put(`/ingredients/${payload.id}`, payload);
      // State update handled by socket data-change handler in App.js
      toast.success("Ingredient updated");
    } else {
      await api.post(`/ingredients`, payload);
      // State update handled by socket data-change handler in App.js
      toast.success("Ingredient added");
    }

    resetIngredientForm();
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
    resetIngredientForm();
    setShowForm(true);
  };

  return (
    <div className="ingredients-page">
      {/* HEADER */}
      <div className="ingredient-header">
        <h2 className="ingredient-title">Ingredients</h2>
        <button className="modal-save-btn" onClick={openAddForm}>
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front">+ Add Ingredient</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="ingredient-filter-bar">
        <input
          className="search-input"
          placeholder=" Search name or brand…"
          value={ingredientSearch}
          onChange={e => setIngredientSearch(e.target.value)}
        />
        {ingredientSearch && (
          <button className="ae-clear-filter" onClick={() => setIngredientSearch("")}>Clear</button>
        )}
        <span className="ae-result-count">{filteredIngredients.length} ingredient(s)</span>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}>

            <div className="modal-header">
              <h3>{isEditMode ? "Edit Ingredient" : "Add New Ingredient"}</h3>
              <button
                type="button"
                className="modal-cancel-btn"
                aria-label="Close"
                onClick={resetIngredientForm}
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

              <div className="form-group">
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


              <div className="form-group">
                <label>Used For</label>
                <div className="checkbox-grid">
                  {adminData.categories.flatMap(cat => {

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

                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Nutrition per 100g</label>
                <div className="nutrition-grid border">
                  {["kcal", "protein", "fat", "fibre"].map((key) => (
                    <div className="form-group" key={key}>
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
                <div className="form-group">
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
                <div className="form-group">
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

              <div className="form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "

                    value={formData.description}
                    onChange={(e) => { setFormData({ ...formData, description: e.target.value }); setFormErrors(p => ({ ...p, description: false })); }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Description<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.history ? " mat-error" : ""}`}
                    placeholder=" "

                    value={formData.history}
                    onChange={(e) => { setFormData({ ...formData, history: e.target.value }); setFormErrors(p => ({ ...p, history: false })); }}
                  />
                  <label className={`mat-label${formErrors.history ? " mat-label-error" : ""}`}>History<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.history ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="form-group">
                <label>Brands</label>

                {!showBrandInput && (
                  <button
                    type="button"
                    className="modal-save-btn"
                    onClick={() => setShowBrandInput(true)}
                  >
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front">Add Brand</span>
                  </button>
                )}

                {showBrandInput && (
                  <div className="form-group">

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
                      <button
                        className="modal-cancel-btn"
                        type="button"
                        onClick={() => {
                          setBrandInput("");
                          setShowBrandInput(false);
                        }}
                      >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Cancel</span>
                      </button>

                      <button
                        type="button"
                        className="modal-save-btn"
                        onClick={() => {
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
                        }}
                      >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
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
                              className="ingredient-delete-btn"
                              onClick={() =>
                                setFormData(prev => ({
                                  ...prev,
                                  brands: prev.brands.filter((_, i) => i !== index)
                                }))
                              }
                            >
                              <img src={deleteIcon} alt="" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                type="button"
                onClick={resetIngredientForm}
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
                <span className="front">{isEditMode ? "Save Changes" : "Add Ingredient"}</span>
              </button>
            </div>
          </form>
        </div>
      )}


      <div className="ingredient-table-wrapper" ref={containerRef}>
        <table className="ingredient-table">
          <thead>
            <tr>
              <th>Image</th>
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
              <th>Calories</th>
              <th>Protein</th>
              <th>Fibre</th>
              <th>Fat</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {filteredIngredients.length === 0 ? (
              <EmptyRow colSpan={7} message="No ingredients found" />
            ) : (
              filteredIngredients.slice(0, displayLimit).map((ingredient) => (
                <tr key={ingredient.id}>
                  <td className="clickable"
                    onClick={() => navigate(`/ingredients/${ingredient.id}`)}>
                    <div className="ingredient-image">
                      <img src={ingredient.image} alt={ingredient.name} />
                    </div>
                  </td>

                  <td className="clickable"
                    onClick={() => navigate(`/ingredients/${ingredient.id}`)}>{ingredient.name}
                  </td>
                  <td>
                    {ingredient.brands?.length
                      ? ingredient.brands.map(b => b.name).join(" / ")
                      : "-"}
                  </td>
                  <td>{ingredient.nutritionPer100g.kcal}</td>
                  <td>{ingredient.nutritionPer100g.protein}g</td>
                  <td>{ingredient.nutritionPer100g.fibre}g</td>
                  <td>{ingredient.nutritionPer100g.fat}g</td>

                  <td>
                    <button
                      className="ingredient-icon-btn ingredient-delete-btn"
                      onClick={() => {
                        toast.confirm(
                          `Delete "${ingredient.name}"?`,
                          async () => {
                            // Optimistic update — remove immediately
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
                              // Revert on true server failure
                              console.error("Delete ingredient error:", err);
                              setAdminData(prev => ({
                                ...prev,
                                ingredients: [...prev.ingredients, ingredient]
                              }));
                              toast.error("Failed to delete ingredient");
                            }
                          }
                        );
                      }}
                    >
                      <img src={deleteIcon} alt="" />
                    </button>
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
      </div>
    </div>
  );
};

export default Ingredients;