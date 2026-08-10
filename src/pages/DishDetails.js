/**
 * DishDetails.js  —  Sam Cafe Admin Panel
 * Single dish detail/edit page
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

import api from "../api";

import deleteIcon from "../icon/delete-icon.png"
import editIcon from "../icon/edit-icon.png"
import { allowTextInput } from "../App";
import { resolveCategoryAndSubCategory } from "../App"
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";

import "./DishDetails.css";
import PageLoader from "../components/PageLoader";

const DishDetails = ({ adminData, setAdminData, toCamelCase, generateIdFromName, handleBack }) => {
  // ── Hooks

  const { toast } = useToast();
  const { categoryId, dishId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const orderItem = location.state?.orderItem || null;
  const fromOrder = location.state?.fromOrder === true;

  let category = adminData.categories.find(c => c.id === categoryId);
  let subCategory = null;

  if (!category) {
    for (const cat of adminData.categories) {
      const found = (cat.subCategories || []).find(sub => sub.id === categoryId);
      if (found) {
        category = cat;
        subCategory = found;
        break;
      }
    }
  }

  let dish = category?.dishes?.find(d => d.id === dishId);

  if (!dish && category?.subCategories) {
    for (const sub of category.subCategories) {
      const found = sub.dishes?.find(d => d.id === dishId);
      if (found) {
        dish = found;
        break;
      }
    }
  }

  const [openIngredientDropdown, setOpenIngredientDropdown] = useState(false);
  const [localDish, setLocalDish] = useState(null);
  // Single global edit mode — replaces per-section editSection state
  const [isEditing, setIsEditing] = useState(false);
  // Temp buffer for ingredients (still needed because of add/delete row logic)
  const [editingIngredients, setEditingIngredients] = useState(null);
  // Temp buffer for variants (same add/delete row logic as ingredients)
  const [editingVariants, setEditingVariants] = useState(null);

  const disabledIngredientsForThisDish = adminData.ingredients
    .filter(ing =>
      ing.isDisabledGlobally === true ||
      (ing.disabledForDishes || []).includes(dishId)
    )
    .map(ing => ing.name);

  useEffect(() => {
    if (dish) {
      setLocalDish(JSON.parse(JSON.stringify(dish)));
    }
  }, [dish]);

  useEffect(() => {
    const closeDropdowns = () => setOpenIngredientDropdown(false);
    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  if (!localDish) return <PageLoader fill label="Loading dish…" />;

  /* ---------------- SAVE TO JSON ---------------- */
  const persistDish = async (updatedDish) => {
    const newDishId = dishId;

    let duplicate;
    if (subCategory) {
      duplicate = (subCategory.dishes || []).some(
        d => d.id !== dishId && d.name.trim().toLowerCase() === updatedDish.name.trim().toLowerCase()
      );
    } else {
      duplicate = (category.dishes || []).some(
        d => d.id !== dishId && d.name.trim().toLowerCase() === updatedDish.name.trim().toLowerCase()
      );
    }

    if (duplicate) {
      toast.error("Another dish with this name already exists in this category");
      return;
    }

    let updatedCategory;
    if (subCategory) {
      updatedCategory = {
        ...category,
        subCategories: (category.subCategories || []).map(sub => {
          if (sub.id !== subCategory.id) return sub;
          return {
            ...sub,
            dishes: (sub.dishes || []).map(d =>
              d.id === dishId ? { ...d, ...updatedDish, id: newDishId } : d
            )
          };
        })
      };
    } else {
      updatedCategory = {
        ...category,
        dishes: (category.dishes || []).map(d =>
          d.id === dishId ? { ...d, ...updatedDish, id: newDishId } : d
        )
      };
    }

    try {
      await api.put(`/categories/${category.id}`, updatedCategory);

      setAdminData(prev => ({
        ...prev,
        categories: prev.categories.map(cat =>
          cat.id === category.id ? updatedCategory : cat
        )
      }));

      setIsEditing(false);
      setEditingIngredients(null);
      setLocalDish(JSON.parse(JSON.stringify({ ...updatedDish, id: newDishId })));
      navigate(`/dishes/${categoryId}/${newDishId}`, { replace: true });

    } catch (err) {
      toast.error("Failed to update dish");
      console.error("Failed to update dish", err);
    }
  };

  /* ---------------- INGREDIENT CRUD ---------------- */
  const addIngredient = () => {
    setEditingIngredients(prev => [...prev, { name: "", quantity: 0 }]);
  };

  const deleteIngredient = (index) => {
    setEditingIngredients(prev => prev.filter((_, i) => i !== index));
  };

  /* ---------------- VARIANT CRUD ---------------- */
  const addVariant = () => {
    setEditingVariants(prev => [...prev, { name: "", extraCharge: 0 }]);
  };

  const deleteVariant = (index) => {
    setEditingVariants(prev => prev.filter((_, i) => i !== index));
  };

  const startEditing = () => {
    setEditingIngredients(JSON.parse(JSON.stringify(localDish.ingredients)));
    setEditingVariants(JSON.parse(JSON.stringify(localDish.variants || [])));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingIngredients(null);
    setEditingVariants(null);
    if (dish) setLocalDish(JSON.parse(JSON.stringify(dish)));
  };

  const saveAll = async () => {
    const updatedDish = {
      ...localDish,
      ingredients: editingIngredients,
      variants: editingVariants
    };
    await persistDish(updatedDish);
  };

  /* ---------------- IMAGE UPLOAD (independent, no edit mode needed) ---------------- */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const updatedDish = { ...localDish, image: reader.result };
      setLocalDish(updatedDish);
      await persistDish(updatedDish);
    };
    reader.readAsDataURL(file);
  };

  const ingredientsToDisplay =
    fromOrder && orderItem?.ingredients?.length > 0
      ? orderItem.ingredients
      : (localDish?.ingredients || []);

  const displayDishName =
    fromOrder && orderItem?.isCustomized ? orderItem.dishName : localDish?.name;

  const displayPrice =
    fromOrder && orderItem?.isCustomized ? orderItem.totalPrice : localDish?.basePrice;

  if (dishId === "__custom__" && orderItem) {
    return (
      <div className="details-container">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <h2>{orderItem.dishName}</h2>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Qty</th></tr>
          </thead>
          <tbody>
            {orderItem.ingredients.map((ing, i) => (
              <tr key={i}>
                <td>{ing.name}</td>
                <td>{ing.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const sortedIngredients = [...adminData.ingredients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="details-container">

      {/* HEADER */}
      <div className="details-header">
        <button
          type="button"
          className="back-btn"
          onClick={() => {
            cancelEditing();
            navigate(-1);
          }}
        ></button>
        <h2>{displayDishName}</h2>
        {!fromOrder && !isEditing && (
          <Button3D variant="cancel" onClick={startEditing}>
            <img src={editIcon} alt="" />
            Edit
          </Button3D>
        )}
      </div>

      <div className="details-body">

        <div
          className="horizontal-form-group"
        >
          <div>
            {/* IMAGE */}
            <div className="dish-details-image">
              <img src={localDish.image || "/placeholder.png"} alt={localDish.name} />
            </div>
            {!fromOrder && isEditing && (
              <div style={{ width: "150px" }}>
                <div className="file-wrap">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  <div className="file-label">Change Image</div>
                </div>
              </div>
            )}
          </div>

          {/* NAME */}
          <div className="section">
            <div className="section-title">
              <span>Name</span>
            </div>
            {isEditing ? (
              <input
                value={localDish.name}
                onChange={(e) =>
                  setLocalDish(prev => ({
                    ...prev,
                    name: allowTextInput(prev.name, e.target.value, 100, 5)
                  }))
                }
                onBlur={(e) =>
                  setLocalDish(prev => ({ ...prev, name: toCamelCase(e.target.value) }))
                }
              />
            ) : (
              <p>{localDish.name}</p>
            )}
          </div>

          {/* NOTES (FROM ORDER) */}
          {fromOrder && (
            <div className="section">
              <div className="section-title"><span>Notes</span></div>
              <p>{orderItem?.notes?.trim() ? orderItem.notes : "—"}</p>
            </div>
          )}

          {/* PRICE */}
          <div className="section">
            <div className="section-title"><span>Base Price</span></div>
            {isEditing ? (
              <input
                type="number"
                min="1"
                step="1"
                value={localDish.basePrice}
                onChange={e => setLocalDish({ ...localDish, basePrice: Number(e.target.value) })}
              />
            ) : (
              <p>₹{displayPrice}</p>
            )}
          </div>

          {/* VEG / NON-VEG */}
          <div className="section">
            <div className="section-title"><span>Type</span></div>
            {isEditing ? (
              <div className="dish-switch-group" style={{ marginTop: 5 }}>
                <button
                  type="button"
                  className={`dish-switch-btn${localDish.isVeg !== false ? " is-active" : ""}`}
                  onClick={() => setLocalDish({ ...localDish, isVeg: true })}
                >
                  <span className="dish-switch-dot veg" /> Veg
                </button>
                <button
                  type="button"
                  className={`dish-switch-btn${localDish.isVeg === false ? " is-active" : ""}`}
                  onClick={() => setLocalDish({ ...localDish, isVeg: false })}
                >
                  <span className="dish-switch-dot non-veg" /> Non-Veg
                </button>
              </div>
            ) : (
              <span
                className={`veg-badge ${localDish.isVeg === false ? "non-veg" : "veg"}`}
              >
                {localDish.isVeg === false ? "Non-Veg" : "Veg"}
              </span>
            )}
          </div>

          {/* EVENT FOOD */}
          <div className="section">
            <div className="section-title"><span>Event Food</span></div>
            {isEditing ? (
              <div className="dish-switch-group" style={{ marginTop: 5 }}>
                <button
                  type="button"
                  className={`dish-switch-btn${localDish.isEventFood ? " is-active" : ""}`}
                  onClick={() => setLocalDish({ ...localDish, isEventFood: true })}
                >
                  <span className="dish-switch-dot veg" /> Yes
                </button>
                <button
                  type="button"
                  className={`dish-switch-btn${!localDish.isEventFood ? " is-active" : ""}`}
                  onClick={() => setLocalDish({ ...localDish, isEventFood: false })}
                >
                  <span className="dish-switch-dot non-veg" /> No
                </button>
              </div>
            ) : (
              <span
                className={`veg-badge ${localDish.isEventFood ? "veg" : "non-veg"}`}
              >
                {localDish.isEventFood ? "Yes" : "No"}
              </span>
            )}
          </div>

          {/* COMBO FOOD */}
          <div className="section">
            <div className="section-title"><span>Combo Food</span></div>
            {isEditing ? (
              <div className="dish-switch-group" style={{ marginTop: 5 }}>
                <button
                  type="button"
                  className={`dish-switch-btn${localDish.isComboFood ? " is-active" : ""}`}
                  onClick={() => setLocalDish({ ...localDish, isComboFood: true })}
                >
                  <span className="dish-switch-dot veg" /> Yes
                </button>
                <button
                  type="button"
                  className={`dish-switch-btn${!localDish.isComboFood ? " is-active" : ""}`}
                  onClick={() => setLocalDish({ ...localDish, isComboFood: false })}
                >
                  <span className="dish-switch-dot non-veg" /> No
                </button>
              </div>
            ) : (
              <span
                className={`veg-badge ${localDish.isComboFood ? "veg" : "non-veg"}`}
              >
                {localDish.isComboFood ? "Yes" : "No"}
              </span>
            )}
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="section">
          <div className="section-title"><span>Description</span></div>
          {isEditing ? (
            <div className="mat">
              <textarea
                className="mat-input mat-textarea"
                placeholder=" "
                value={localDish.description}
                onChange={e => setLocalDish({ ...localDish, description: allowTextInput(localDish.description, e.target.value, 500, 100000) })}
              />
              <label className="mat-label">Description</label>
              <span className="mat-bar" />
            </div>
          ) : (
            <p>{localDish.description}</p>
          )}
        </div>

        <div className="horizontal-form-group">
          {/* BENEFITS TABLE */}
          {!(fromOrder && orderItem?.isCustomized) && (
            <div className="section">
              <div className="section-title"><span>Nutrition</span></div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nutrition</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(localDish.benefits).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={v}
                            onChange={e =>
                              setLocalDish({
                                ...localDish,
                                benefits: {
                                  ...localDish.benefits,
                                  [k]: Number(e.target.value)
                                }
                              })
                            }
                          />
                        ) : (
                          v
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* INGREDIENTS */}
          <div className="section">
            <div className="section-title"><span>Ingredients</span></div>

            {isEditing ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Qty (g)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingIngredients.map((ing, index) => {
                      const isNew = !ing.name;
                      return (
                        <tr key={index}>
                          <td>
                            {isNew ? (
                              <div className="dishes-dropdown-wrapper">
                                <button
                                  type="button"
                                  className="dishes-status-dropdown"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenIngredientDropdown(prev => !prev);
                                  }}
                                >
                                  {editingIngredients?.[index]?.name || "Select Ingredient"}
                                </button>
                                {openIngredientDropdown && (
                                  <div className="dropdown-menu">
                                    {sortedIngredients.map(ing => (
                                      <div
                                        key={ing.id}
                                        onClick={() => {
                                          const updated = [...editingIngredients];
                                          updated[index].name = ing.name;
                                          setEditingIngredients(updated);
                                          setOpenIngredientDropdown(false);
                                        }}
                                      >
                                        {ing.name}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span>{ing.name}</span>
                            )}
                          </td>
                          <td>
                            <input
                              id={`qty-${index}`}
                              type="number"
                              min="0"
                              value={ing.quantity}
                              onChange={(e) => {
                                const updated = [...editingIngredients];
                                updated[index].quantity = Number(e.target.value);
                                setEditingIngredients(updated);
                              }}
                            />
                          </td>
                          <td>
                            <div
                              className="modal-danger-btn"
                              onClick={() => deleteIngredient(index)}
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
                <Button3D onClick={addIngredient}>+ Add Ingredient</Button3D>
              </>
            ) : (
              ingredientsToDisplay.length === 0 ? (
                <p>No ingredients available</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Name</th><th>Qty (g)</th></tr>
                  </thead>
                  <tbody>
                    {ingredientsToDisplay.map((ing, index) => (
                      <tr key={index}>
                        <td>{ing.name}</td>
                        <td>{ing.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* VARIANTS */}
        {!(fromOrder && orderItem?.isCustomized) && (
          <div className="section">
            <div className="section-title"><span>Variants</span></div>

            {isEditing ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Variant Name</th>
                      <th>Additional Cost</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editingVariants.map((v, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="text"
                            value={v.name}
                            onChange={(e) => {
                              const updated = [...editingVariants];
                              updated[index].name = allowTextInput(v.name, e.target.value, 100, 5);
                              setEditingVariants(updated);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={v.extraCharge}
                            onChange={(e) => {
                              const updated = [...editingVariants];
                              updated[index].extraCharge = Number(e.target.value);
                              setEditingVariants(updated);
                            }}
                          />
                        </td>
                        <td>
                          <div
                            className="modal-danger-btn"
                            onClick={() => deleteVariant(index)}
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
                <Button3D onClick={addVariant}>+ Add Variant</Button3D>
              </>
            ) : (
              (localDish.variants || []).length === 0 ? (
                <p>No variants available</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Variant Name</th><th>Additional Cost</th></tr>
                  </thead>
                  <tbody>
                    {localDish.variants.map((v, index) => (
                      <tr key={index}>
                        <td>{v.name}</td>
                        <td>₹{v.extraCharge}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}

        {disabledIngredientsForThisDish.length > 0 && (
          <div className="section">
            <div className="section-title">
              <span>Disabled Ingredients For This Dish</span>
            </div>
            <p style={{ color: "red", fontWeight: 600 }}>
              {disabledIngredientsForThisDish.join(", ")}
            </p>
          </div>
        )}
      </div>

      {/* GLOBAL SAVE / CANCEL — shown at bottom when editing */}
      {isEditing && (
        <div className="details-footer">
          <Button3D variant="cancel" onClick={cancelEditing}>Cancel</Button3D>
          <Button3D onClick={saveAll}>Save</Button3D>
        </div>
      )}

    </div>
  );
};

export default DishDetails;