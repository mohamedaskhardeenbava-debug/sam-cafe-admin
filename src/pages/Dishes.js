import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Dishes.css";
import "./ModalCSS.css";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { EmptyRow } from "../App";
import { resolveCategoryAndSubCategory } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";
import { useToast } from "../useToast";

// ── CustomDropdown (floating label version) ──────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…", label, required }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
  const displayLabel = selected ? (selected.label !== undefined ? selected.label : selected) : "";

  const wrapperClass = [
    "mat-select",
    value ? "has-value" : "",
    open ? "is-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} ref={ref}>
      {label && (
        <label className="mat-label">
          {label}{required && <span className="rf-req">*</span>}
        </label>
      )}
      <div className="dishes-dropdown-wrapper">
        <button type="button" className="dishes-status-dropdown"
          onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
          {displayLabel || ""}
        </button>
        {open && (
          <div className="dropdown-menu">
            <div onClick={() => { onChange(""); setOpen(false); }}>
              {placeholder}
            </div>
            {options.map((o, i) => {
              const val = o.value !== undefined ? o.value : o;
              const lbl = o.label !== undefined ? o.label : o;
              return (
                <div key={i} onClick={() => { onChange(val); setOpen(false); }}
                  style={{ padding: "8px 12px", fontSize: 14, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  {lbl}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <span className="mat-bar" />
    </div>
  );
}

const Dishes = ({ adminData, setAdminData, toCamelCase, handleSort, sortConfig }) => {
  const { toast } = useToast();
  const [dishImagePreview, setDishImagePreview] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [editingDish, setEditingDish] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [ingErrors, setIngErrors] = useState({});

  const [newDish, setNewDish] = useState({
    name: "",
    image: "",
    basePrice: "",
    description: "",
    isVeg: true,
    isEventFood: false,
    benefits: {
      calories: "",
      protein: "",
      fibre: "",
      fat: ""
    },
    ingredients: []
  });


  const availableIngredients = (adminData.ingredients || [])
    .filter(
      ing =>
        !newDish.ingredients.some(
          selected => selected.name === ing.name
        )
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const resetDishForm = () => {
    setShowForm(false);
    setEditingDish(null);
    setEditingDishId(null);
    setEditedPrice("");
    setFormErrors({});
    setIngErrors({});

    setNewDish({
      name: "",
      image: "",
      basePrice: "",
      description: "",
      isVeg: true,
      isEventFood: false,
      benefits: {
        calories: "",
        protein: "",
        fibre: "",
        fat: ""
      },
      ingredients: []
    });

    setIngredientForm({
      name: "",
      quantity: "",
      calories: ""
    });

    setDishImagePreview("");
  };

  const { categoryId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!adminData.categories?.length) return;

    if (categoryId) {
      setSelectedCategoryIds([categoryId]);
    } else {
      // auto-select the first available category/subcategory on load
      const firstCat = adminData.categories[0];
      const firstId =
        firstCat?.subCategories?.length
          ? firstCat.subCategories[0].id
          : firstCat?.id;
      if (firstId) setSelectedCategoryIds([firstId]);
    }
  }, [adminData.categories, categoryId]);

  const sortedDishes = useMemo(() => {

    if (!selectedCategoryIds.length) return [];

    const dishes = adminData.categories.flatMap(cat => {

      let result = [];

      // ✅ category dishes
      if (selectedCategoryIds.includes(cat.id)) {
        result.push(
          ...(cat.dishes || []).map(d => ({
            ...d,
            categoryId: cat.id
          }))
        );
      }

      // ✅ subcategory dishes
      (cat.subCategories || []).forEach(sub => {

        if (selectedCategoryIds.includes(sub.id)) {
          result.push(
            ...(sub.dishes || []).map(d => ({
              ...d,
              categoryId: sub.id
            }))
          );
        }

      });

      return result;

    });

    if (!sortConfig.key) return dishes;

    return [...dishes].sort((a, b) => {

      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      if (sortConfig.key === "basePrice") {
        return sortConfig.direction === "asc"
          ? a.basePrice - b.basePrice
          : b.basePrice - a.basePrice;
      }

      return 0;

    });

  }, [adminData.categories, selectedCategoryIds, sortConfig]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(sortedDishes.length, 30);

  const handleSaveDish = async () => {
    const e = {};
    if (!newDish.name.trim()) e.name = true;
    if (!newDish.basePrice) e.basePrice = true;
    if (!newDish.description.trim()) e.description = true;
    if (!newDish.benefits.calories) e.calories = true;
    if (!newDish.benefits.protein) e.protein = true;
    if (!newDish.benefits.fibre) e.fibre = true;
    if (!newDish.benefits.fat) e.fat = true;
    if (Object.keys(e).length) { setFormErrors(e); return; }

    if (selectedCategoryIds.length !== 1) {
      setFormErrors({ category: true });
      return;
    }

    const selectedId = selectedCategoryIds[0];

    let category = adminData.categories.find(c => c.id === selectedId);
    let subCategory = null;

    if (!category) {

      for (const cat of adminData.categories) {

        const found = (cat.subCategories || []).find(
          sub => sub.id === selectedId
        );

        if (found) {
          category = cat;
          subCategory = found;
          break;
        }

      }

    }

    if (!category) return;

    const duplicateDish = (
      subCategory ? (subCategory.dishes || []) : (category.dishes || [])
    ).some(
      d =>
        (!editingDish || d.id !== editingDish.id) &&
        d.name.trim().toLowerCase() ===
        newDish.name.trim().toLowerCase()
    );

    if (duplicateDish) {
      setFormErrors({ name: true });
      return;
    }

    const dishPayload = {
      id: editingDish
        ? editingDish.id
        : `${selectedId}_${Date.now()}`,

      categoryId: selectedId,

      name: newDish.name,
      image: newDish.image,
      isVeg: newDish.isVeg,
      isEventFood: newDish.isEventFood,

      basePrice: Number(newDish.basePrice),

      description: newDish.description,

      benefits: {
        calories: Number(newDish.benefits.calories || 0),
        protein: Number(newDish.benefits.protein || 0),
        fibre: Number(newDish.benefits.fibre || 0),
        fat: Number(newDish.benefits.fat || 0)
      },

      ingredients: newDish.ingredients
    };

    try {

      let updatedCategory;

      if (subCategory) {

        updatedCategory = {
          ...category,
          subCategories: (category.subCategories || []).map(sub => {

            if (sub.id === subCategory.id) {

              return {
                ...sub,
                dishes: editingDish
                  ? (sub.dishes || []).map(d =>
                    d.id === editingDish.id ? dishPayload : d
                  )
                  : [...(sub.dishes || []), dishPayload]
              };

            }

            return sub;

          })
        };

      } else {

        updatedCategory = {
          ...category,
          dishes: editingDish
            ? (category.dishes || []).map(d =>
              d.id === editingDish.id ? dishPayload : d
            )
            : [...(category.dishes || []), dishPayload]
        };

      }

      await api.put(`/categories/${category.id}`, updatedCategory);
      // State update handled by socket data-change handler in App.js
      toast.success(editingDish ? "Dish updated" : "Dish added");
      resetDishForm();

    } catch (err) {
      console.error("Failed to save dish", err);
    }

  };

  const handleDelete = (dishId, dishName) => {

    if (selectedCategoryIds.length !== 1) {
      toast.warning("Please select only one category to delete a dish");
      return;
    }

    toast.confirm(`Delete "${dishName}"?`, async () => {
      const selectedId = selectedCategoryIds[0];

      let category = adminData.categories.find(c => c.id === selectedId);
      let subCategory = null;

      if (!category) {
        for (const cat of adminData.categories) {
          const found = (cat.subCategories || []).find(sub => sub.id === selectedId);
          if (found) { category = cat; subCategory = found; break; }
        }
      }

      if (!category) return;

      let updatedCategory;

      if (subCategory) {
        updatedCategory = {
          ...category,
          subCategories: (category.subCategories || []).map(sub =>
            sub.id === subCategory.id
              ? { ...sub, dishes: (sub.dishes || []).filter(d => d.id !== dishId) }
              : sub
          )
        };
      } else {
        updatedCategory = {
          ...category,
          dishes: (category.dishes || []).filter(d => d.id !== dishId)
        };
      }

      try {
        await api.put(`/categories/${category.id}`, updatedCategory);
        // State update handled by socket data-change handler in App.js
        toast.success("Dish deleted");
      } catch (err) {
        console.error("Failed to delete dish:", err);
        toast.error("Failed to delete dish");
      }
    });

  };

  const handleDishImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setNewDish(prev => ({
        ...prev,
        image: reader.result
      }));
      setDishImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };

  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    quantity: "",
    calories: ""
  });

  const handleAddIngredient = () => {
    if (!ingredientForm.name) return;

    const exists = newDish.ingredients.some(
      ing =>
        ing.name.trim().toLowerCase() ===
        ingredientForm.name.trim().toLowerCase()
    );

    if (exists) {
      setIngErrors({ name: true });
      return;
    }

    setNewDish(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          name: ingredientForm.name,
          quantity: ingredientForm.quantity,
          calories: Number(ingredientForm.calories || 0)
        }
      ]
    }));

    setIngredientForm({ name: "", quantity: "", calories: "" });
  };

  const handleRemoveIngredient = (index) => {
    setNewDish((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };


  return (
    <div className="dishes-page">
      <div className="dish-header">
        <h2 className="dish-title">Dishes</h2>

        <div className="dish-category-buttons">

          {adminData.categories.flatMap(cat => {

            if ((cat.subCategories || []).length > 0) {

              return cat.subCategories.map(sub => (

                <button
                  key={sub.id}
                  className={`filter-pill ${selectedCategoryIds.includes(sub.id) ? "active" : ""
                    }`}
                  onClick={() => {
                    setSelectedCategoryIds(prev =>
                      prev.includes(sub.id)
                        ? prev.filter(id => id !== sub.id)
                        : [...prev, sub.id]
                    );
                  }}
                >
                  {sub.name}
                </button>

              ));

            }

            return (

              <button
                key={cat.id}
                className={`filter-pill ${selectedCategoryIds.includes(cat.id) ? "active" : ""
                  }`}
                onClick={() => {
                  setSelectedCategoryIds(prev =>
                    prev.includes(cat.id)
                      ? prev.filter(id => id !== cat.id)
                      : [...prev, cat.id]
                  );
                }}
              >
                {cat.name}
              </button>

            );

          })}

        </div>

        <button
          className="modal-save-btn"
          onClick={() => setShowForm(true)}
        >
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front">+ Add Dish</span>
        </button>

      </div>

      <div className="dish-block">
        {/* <div className="dish-title">{selectedCategory?.name}</div> */}

        <div className="dish-table-wrapper" ref={containerRef}>
          <table className="dish-table">
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
                <th>Type</th>
                <th>Event Food</th>
                <th>Base Price</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {sortedDishes.slice(0, displayLimit).map((dish) => (
                <tr key={dish.id}>
                  <td
                    className="clickable"
                    onClick={() => navigate(`/dishes/${dish.categoryId}/${dish.id}`)}
                  >
                    <div
                      className="dish-image"
                      onClick={() => navigate(`/dishes/${dish.categoryId}/${dish.id}`)}
                    >
                      <img src={dish.image || ""} alt="" />
                    </div>
                  </td>

                  <td
                    className="dish-name clickable"
                    onClick={() => navigate(`/dishes/${dish.categoryId}/${dish.id}`)}
                  >
                    {dish.name}
                  </td>

                  <td>
                    <span className={`veg-badge ${dish.isVeg === false ? "non-veg" : "veg"}`}>
                      {dish.isVeg === false ? "Non-Veg" : "Veg"}
                    </span>
                  </td>

                  <td>
                    <span className={`veg-badge ${dish.isEventFood ? "veg" : "non-veg"}`}>
                      {dish.isEventFood ? "Yes" : "No"}
                    </span>
                  </td>

                  <td>{dish.basePrice}
                  </td>

                  <td>
                    <button
                      className="icon-btn delete-btn"
                      disabled={showForm}
                      onClick={() => handleDelete(dish.id, dish.name)}
                    >
                      <img src={deleteIcon} alt="" />
                    </button>

                  </td>
                </tr>
              ))}

              {sortedDishes.length === 0 && (
                <EmptyRow colSpan={5} message="No dishes available" />
              )}
              <InfiniteScrollLoader
                sentinelRef={sentinelRef}
                hasMore={hasMore}
                colSpan={6}
              />
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDish();
            }}>

            <div className="modal-header">
              <h3>
                Add New Dish
                {selectedCategoryIds.length === 1 && (
                  <>
                    {" "}for{" "}
                    {
                      (() => {
                        const id = selectedCategoryIds[0];

                        for (const cat of adminData.categories) {
                          if (cat.id === id) return cat.name;

                          const sub = (cat.subCategories || []).find(s => s.id === id);
                          if (sub) return sub.name;
                        }

                        return "";
                      })()
                    }
                  </>
                )}
              </h3>
              <button
                type="button"
                className="modal-cancel-btn"
                aria-label="Close"
                onClick={resetDishForm}
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
                    value={newDish.name}
                    onChange={(e) => {
                      setNewDish((prev) => ({ ...prev, name: allowTextInput(prev.name, e.target.value, 100, 5) }));
                      setFormErrors(p => ({ ...p, name: false }));
                    }}
                    onBlur={(e) =>
                      setNewDish((prev) => ({ ...prev, name: toCamelCase(e.target.value) }))
                    }
                  />
                  <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Dish Name<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="form-group">
                <div className="file-wrap">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDishImageUpload}
                    className="file-input"
                  />
                  <div className="file-label">
                    {dishImagePreview ? "✔ Dish Image selected" : "Choose file for Dish Image…"}
                  </div>
                </div>
                {dishImagePreview && (
                  <img src={dishImagePreview} alt="Preview" className="staff-image-preview" />
                )}
              </div>

              <div className="form-group">
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.basePrice ? " mat-error" : ""}`}
                    type="number"
                    min="1"
                    step="1"
                    placeholder=" "
                    value={newDish.basePrice}
                    onChange={(e) => { setNewDish({ ...newDish, basePrice: e.target.value }); setFormErrors(p => ({ ...p, basePrice: false })); }}
                  />
                  <label className={`mat-label${formErrors.basePrice ? " mat-label-error" : ""}`}>Base Price<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.basePrice ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "
                    value={newDish.description}
                    onChange={(e) => { setNewDish({ ...newDish, description: e.target.value }); setFormErrors(p => ({ ...p, description: false })); }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Description<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="form-group">
                <label>Type</label>
                <div className="veg-toggle-group">
                  <button
                    type="button"
                    className={`veg-toggle-btn${newDish.isVeg ? " active-veg" : ""}`}
                    onClick={() => setNewDish({ ...newDish, isVeg: true })}
                  >
                    <span className="veg-dot veg" /> Veg
                  </button>
                  <button
                    type="button"
                    className={`veg-toggle-btn${!newDish.isVeg ? " active-non-veg" : ""}`}
                    onClick={() => setNewDish({ ...newDish, isVeg: false })}
                  >
                    <span className="veg-dot non-veg" /> Non-Veg
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Event Food</label>
                <div className="veg-toggle-group">
                  <button
                    type="button"
                    className={`veg-toggle-btn${newDish.isEventFood ? " active-veg" : ""}`}
                    onClick={() => setNewDish({ ...newDish, isEventFood: true })}
                  >
                    <span className="veg-dot veg" /> Yes
                  </button>
                  <button
                    type="button"
                    className={`veg-toggle-btn${!newDish.isEventFood ? " active-non-veg" : ""}`}
                    onClick={() => setNewDish({ ...newDish, isEventFood: false })}
                  >
                    <span className="veg-dot non-veg" /> No
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="">Nutrition</label>
                <div className="benefits-grid border">
                  {["calories", "protein", "fibre", "fat"].map(key => (
                    <div className="form-group" key={key}>
                      <div className="mat">
                        <input
                          className={`mat-input${formErrors[key] ? " mat-error" : ""}`}
                          type="number"
                          placeholder=" "
                          min="1"
                          step="1"
                          value={newDish.benefits[key]}
                          onChange={(e) => {
                            setNewDish({ ...newDish, benefits: { ...newDish.benefits, [key]: e.target.value } });
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

              {/* INGREDIENT INPUT */}

              <div className="ingredient-form form-group">
                <label htmlFor="">Ingredients</label>
                <div className="border form-group">
                  <div className="form-group">
                    <CustomDropdown
                      label="Select Ingredient"
                      value={ingredientForm.name}
                      onChange={(val) => setIngredientForm(prev => ({ ...prev, name: val }))}
                      options={availableIngredients.map(ing => ing.name)}
                      placeholder="Select Ingredient"
                    />
                  </div>

                  <div className="form-group">
                    <div className="mat">
                      <input
                        className={`mat-input${ingErrors.quantity ? " mat-error" : ""}`}
                        placeholder=" "
                        type="number"
                        min="1"
                        step="1"
                        value={ingredientForm.quantity}
                        onChange={(e) => { setIngredientForm({ ...ingredientForm, quantity: e.target.value }); setIngErrors(p => ({ ...p, quantity: false })); }}
                      />
                      <label className={`mat-label${ingErrors.quantity ? " mat-label-error" : ""}`}>Quantity in grams<span className="rf-req">*</span></label>
                      <span className={`mat-bar${ingErrors.quantity ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <button
                    className="modal-save-btn"
                    type="button"
                    onClick={handleAddIngredient}>
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front">Add Ingredient</span>
                  </button>
                  {newDish.ingredients.length > 0 && (
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Quantity</th>
                          <th>Calories (kcal)</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {newDish.ingredients.map((ing, index) => (
                          <tr key={index}>
                            <td>{ing.name}</td>
                            <td>{ing.quantity}</td>
                            <td>{ing.calories}</td>
                            <td>
                              <div
                                type="button"
                                className="ingredient-delete-btn"
                                onClick={() => handleRemoveIngredient(index)}
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

            </div>
            <div className="modal-footer">
              <button
                className="modal-cancel-btn"
                type="button"
                onClick={resetDishForm}>
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
                <span className="front">Add Dish</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Dishes;