/**
 * Dishes.js  —  Sam Cafe Admin Panel
 * Dishes management page
 */

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";

import deleteIcon from "../icon/delete-icon.png";
import closeIcon from "../icon/close-icon.png";
import { allowTextInput } from "../App";
import { EmptyRow } from "../App";
import { resolveCategoryAndSubCategory } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader, { InfiniteScrollOverlay } from "../components/InfiniteScrollLoader";
import { useToast } from "../useToast";
import CustomDropdown from "../components/CustomDropdown";
import Button3D from "../components/Button3D";
import CollapseChevron from "../components/CollapseChevron";
import useAnimatedModal from "../hooks/useAnimatedModal";

import "./Dishes.css";
import "./ModalCSS.css";
import PageLoader from "../components/PageLoader";

const Dishes = ({ adminData, setAdminData, toCamelCase, handleSort, sortConfig }) => {
  // ── Hooks

  const { toast } = useToast();
  const [dishImagePreview, setDishImagePreview] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [categoryBarCollapsed, setCategoryBarCollapsed] = useState(false);
  const [dishSearch, setDishSearch] = useState("");
  const [editingDish, setEditingDish] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const dishFormModal = useAnimatedModal("dishes-addEdit");
  const [formErrors, setFormErrors] = useState({});
  const [ingErrors, setIngErrors] = useState({});

  const [newDish, setNewDish] = useState({
    name: "",
    image: "",
    basePrice: "",
    description: "",
    isVeg: true,
    isEventFood: false,
    isComboFood: false,
    benefits: {
      calories: "",
      protein: "",
      fibre: "",
      fat: ""
    },
    ingredients: [],
    variants: []
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
    dishFormModal.close(() => setShowForm(false));
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
      isComboFood: false,
      benefits: {
        calories: "",
        protein: "",
        fibre: "",
        fat: ""
      },
      ingredients: [],
      variants: []
    });

    setIngredientForm({
      name: "",
      quantity: "",
      calories: ""
    });

    setVariantForm({
      name: "",
      extraCharge: ""
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

      // category dishes
      if (selectedCategoryIds.includes(cat.id)) {
        result.push(
          ...(cat.dishes || []).map(d => ({
            ...d,
            categoryId: cat.id
          }))
        );
      }

      // subcategory dishes
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
        const aName = a.name ?? "";
        const bName = b.name ?? "";
        return sortConfig.direction === "asc"
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }

      if (sortConfig.key === "basePrice") {
        return sortConfig.direction === "asc"
          ? a.basePrice - b.basePrice
          : b.basePrice - a.basePrice;
      }

      return 0;

    });

  }, [adminData.categories, selectedCategoryIds, sortConfig]);

  const filteredDishes = useMemo(() => {
    const term = dishSearch.trim().toLowerCase();
    if (!term) return sortedDishes;
    return sortedDishes.filter(d => (d.name || "").toLowerCase().includes(term));
  }, [sortedDishes, dishSearch]);

  const { displayLimit, sentinelRef, containerRef, hasMore, isLoadingMore } =
    useInfiniteScroll(filteredDishes.length, 30);

  // ── Track which category's rows are currently in view while scrolling,
  // so the matching filter-pill can be highlighted. Only meaningful when
  // more than one category is selected (multi-select filter).
  const [visibleCategoryId, setVisibleCategoryId] = useState(null);
  const rowRefs = React.useRef({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container || selectedCategoryIds.length < 2) {
      setVisibleCategoryId(null);
      return;
    }

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let closestId = null;
      let closestDist = Infinity;

      for (const dish of filteredDishes.slice(0, displayLimit)) {
        const el = rowRefs.current[dish.id];
        if (!el) continue;
        const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
        if (el.getBoundingClientRect().top - containerTop <= 40 && dist < closestDist) {
          closestDist = dist;
          closestId = dish.categoryId;
        }
      }

      if (closestId) setVisibleCategoryId(closestId);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, filteredDishes, displayLimit, selectedCategoryIds.length]);

  const handleSaveDish = async () => {
    const e = {};
    if (!newDish.name.trim()) e.name = true;
    if (!dishImagePreview) e.image = true;
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
      isComboFood: newDish.isComboFood,

      basePrice: Number(newDish.basePrice),

      description: newDish.description,

      benefits: {
        calories: Number(newDish.benefits.calories || 0),
        protein: Number(newDish.benefits.protein || 0),
        fibre: Number(newDish.benefits.fibre || 0),
        fat: Number(newDish.benefits.fat || 0)
      },

      ingredients: newDish.ingredients,
      variants: newDish.variants
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

      const res = await api.put(`/categories/${category.id}`, updatedCategory);

      // Update local state immediately from the server's actual saved
      // document, instead of waiting for the socket echo. This is what
      // makes the new/edited dish appear instantly — previously this page
      // relied entirely on receiving its own broadcast back over the
      // socket, so any delay or drop there left the table showing nothing
      // new until a manual reload, even though the save itself succeeded.
      const saved = res.data || updatedCategory;
      setAdminData(prev => ({
        ...prev,
        categories: (prev.categories || []).map(c =>
          String(c.id) === String(saved.id) ? saved : c
        ),
      }));

      toast.success(editingDish ? "Dish updated" : "Dish added");
      resetDishForm();

    } catch (err) {
      toast.error("Failed to save dish");
      console.error("Failed to save dish", err);
    }

  };

  const handleDelete = (dishId, dishName) => {

    if (selectedCategoryIds.length !== 1) {
      toast.warning("Please select only one category to delete a dish");
      return;
    }

    const selectedId = selectedCategoryIds[0];

    toast.confirm(`Delete "${dishName}"?`, async () => {
      // Re-read the current category/subcategory at the moment the user
      // actually confirms, not from a variable captured when the toast was
      // first created. toast.confirm doesn't run its callback until the
      // user clicks "Yes, delete" — which can be well after adminData has
      // moved on (e.g. a socket update from another tab). Building the PUT
      // payload from a stale snapshot would silently overwrite that more
      // recent state, even though the delete request itself succeeds.
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
        const res = await api.put(`/categories/${category.id}`, updatedCategory);

        // Update local state immediately from the server's response
        // instead of relying solely on the socket echo — see the same
        // comment in handleSaveDish above.
        const saved = res.data || updatedCategory;
        setAdminData(prev => ({
          ...prev,
          categories: (prev.categories || []).map(c =>
            String(c.id) === String(saved.id) ? saved : c
          ),
        }));

        toast.success("Dish deleted");
      } catch (err) {
        toast.error("Failed to delete dish");
        console.error("Failed to delete dish:", err);
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

  const [variantForm, setVariantForm] = useState({
    name: "",
    extraCharge: ""
  });

  const handleAddVariant = () => {
    if (!variantForm.name.trim()) return;

    const exists = newDish.variants.some(
      v => v.name.trim().toLowerCase() === variantForm.name.trim().toLowerCase()
    );

    if (exists) {
      setFormErrors(p => ({ ...p, variantName: true }));
      return;
    }

    setNewDish(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          name: variantForm.name.trim(),
          extraCharge: Number(variantForm.extraCharge || 0)
        }
      ]
    }));

    setVariantForm({ name: "", extraCharge: "" });
  };

  const handleRemoveVariant = (index) => {
    setNewDish(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

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
    <div className="inner-page" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div className="header" style={{ alignItems: "flex-start" }}>
        <div className="header-title-with-count">
          <button
            type="button"
            className="header-collapse-btn"
            onClick={() => setCategoryBarCollapsed(prev => !prev)}
            data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={categoryBarCollapsed ? "Expand categories" : "Collapse categories"}
            aria-expanded={!categoryBarCollapsed}
          >
            <CollapseChevron collapsed={categoryBarCollapsed} />
          </button>
          <h2 className="title">Dishes</h2>
          <span className="result-count">
            {filteredDishes.length} dish{filteredDishes.length === 1 ? "" : "es"}
          </span>
          <div className="dish-header-search">
            <input
              className="search-input"
              placeholder=" Search dish name…"
              value={dishSearch}
              onChange={e => setDishSearch(e.target.value)}
            />
            {dishSearch && (
              <button type="button" className="ae-clear-filter" onClick={() => setDishSearch("")}>Clear</button>
            )}
          </div>
        </div>
        <Button3D onClick={() => { setShowForm(true); dishFormModal.open(); }}>+ Add Dish</Button3D>
      </div>

      {!categoryBarCollapsed && adminData.categories.length > 0 && (
        <div className="dish-category-buttons">
          {adminData.categories.flatMap(cat => {

            if ((cat.subCategories || []).length > 0) {

              return cat.subCategories.map(sub => (

                <button
                  key={sub.id}
                  className={`filter-pill ${selectedCategoryIds.includes(sub.id) ? "active" : ""
                    }${visibleCategoryId === sub.id ? " scroll-active" : ""}`}
                  onClick={() =>
                    setSelectedCategoryIds(prev =>
                      prev.includes(sub.id)
                        ? prev.filter(id => id !== sub.id)
                        : [...prev, sub.id]
                    )
                  }
                >
                  {sub.name}
                  <span className="filter-pill-count">{(sub.dishes || []).length}</span>
                </button>

              ));

            }

            return (

              <button
                key={cat.id}
                className={`filter-pill ${selectedCategoryIds.includes(cat.id) ? "active" : ""
                  }${visibleCategoryId === cat.id ? " scroll-active" : ""}`}
                onClick={() =>
                  setSelectedCategoryIds(prev =>
                    prev.includes(cat.id)
                      ? prev.filter(id => id !== cat.id)
                      : [...prev, cat.id]
                  )
                }
              >
                {cat.name}
                <span className="filter-pill-count">{(cat.dishes || []).length}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="table-wrapper dish-page-table"
        style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        ref={containerRef}
      >
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
              <th>Type</th>
              <th>Event Food</th>
              <th>Base Price</th>
              <th className="icon-width">Delete</th>
            </tr>
          </thead>

          <tbody>
            {filteredDishes.slice(0, displayLimit).map((dish) => (
              <tr key={dish.id} ref={el => { rowRefs.current[dish.id] = el; }}>
                <td
                  className="clickable icon-width"
                  onClick={() => navigate(`/dishes/${dish.categoryId}/${dish.id}`)}
                >
                  <div
                    className="table-image"
                    onClick={() => navigate(`/dishes/${dish.categoryId}/${dish.id}`)}
                  >
                    <img src={dish.image || ""} alt="" />
                  </div>
                </td>

                <td>
                  <span
                    className="dish-name clickable"
                    onClick={() => navigate(`/dishes/${dish.categoryId}/${dish.id}`)}
                  >{dish.name}</span>
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

                <td className="icon-width">
                  <Button3D variant="cancel" iconOnly disabled={showForm}
                    onClick={() => handleDelete(dish.id, dish.name)}><img src={deleteIcon} alt="" /></Button3D>

                </td>
              </tr>
            ))}

            {filteredDishes.length === 0 && (
              <EmptyRow colSpan={6} message="No dishes available" />
            )}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={6}
            />
          </tbody>
        </table>
        <InfiniteScrollOverlay isLoading={isLoadingMore} />
      </div>

      {dishFormModal.shouldRender && (
        <div className={`modal-overlay ${dishFormModal.overlayClass}`}>
          <form
            className={`admin-modal ${dishFormModal.modalClass}`}
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDish();
            }}>

            <div className="admin-modal-header">
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
              <Button3D variant="cancel" iconOnly aria-label="Close"
                onClick={resetDishForm}><img src={closeIcon} /></Button3D>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
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

              <div className="admin-form-group">
                <div className={`file-wrap${formErrors.image ? " file-error" : ""}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handleDishImageUpload(e);
                      setFormErrors(prev => ({ ...prev, image: false }));
                    }}
                    className="file-input"
                  />
                  <div className={`file-label${formErrors.image ? " file-label-error" : ""}`}>
                    {dishImagePreview
                      ? "✔ Dish Image selected"
                      : "Choose Dish Image"}
                  </div>
                </div>

                {dishImagePreview && (
                  <img
                    src={dishImagePreview}
                    alt="Preview"
                    className="staff-image-preview"
                  />
                )}
              </div>

              <div className="admin-form-group">
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

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`}
                    placeholder=" "
                    value={newDish.description}
                    onChange={(e) => { setNewDish({ ...newDish, description: allowTextInput(newDish.description, e.target.value, 500, 100000) }); setFormErrors(p => ({ ...p, description: false })); }}
                  />
                  <label className={`mat-label${formErrors.description ? " mat-label-error" : ""}`}>Description<span className="rf-req">*</span></label>
                  <span className={`mat-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className="horizontal-form-group">
                <div className="admin-form-group">
                  <label>Type</label>
                  <div className="dish-switch-group">
                    <button
                      type="button"
                      className={`dish-switch-btn${newDish.isVeg ? " is-active" : ""}`}
                      onClick={() => setNewDish({ ...newDish, isVeg: true })}
                    >
                      <span className="dish-switch-dot veg" /> Veg
                    </button>
                    <button
                      type="button"
                      className={`dish-switch-btn${!newDish.isVeg ? " is-active" : ""}`}
                      onClick={() => setNewDish({ ...newDish, isVeg: false })}
                    >
                      <span className="dish-switch-dot non-veg" /> Non-Veg
                    </button>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label>Event Food</label>
                  <div className="dish-switch-group">
                    <button
                      type="button"
                      className={`dish-switch-btn${newDish.isEventFood ? " is-active" : ""}`}
                      onClick={() => setNewDish({ ...newDish, isEventFood: true })}
                    >
                      <span className="dish-switch-dot veg" /> Yes
                    </button>
                    <button
                      type="button"
                      className={`dish-switch-btn${!newDish.isEventFood ? " is-active" : ""}`}
                      onClick={() => setNewDish({ ...newDish, isEventFood: false })}
                    >
                      <span className="dish-switch-dot non-veg" /> No
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-form-group">
                <label>Combo Food</label>
                <div className="dish-switch-group">
                  <button
                    type="button"
                    className={`dish-switch-btn${newDish.isComboFood ? " is-active" : ""}`}
                    onClick={() => setNewDish({ ...newDish, isComboFood: true })}
                  >
                    <span className="dish-switch-dot veg" /> Yes
                  </button>
                  <button
                    type="button"
                    className={`dish-switch-btn${!newDish.isComboFood ? " is-active" : ""}`}
                    onClick={() => setNewDish({ ...newDish, isComboFood: false })}
                  >
                    <span className="dish-switch-dot non-veg" /> No
                  </button>
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="">Nutrition</label>
                <div className="benefits-grid border">
                  {["calories", "protein", "fibre", "fat"].map(key => (
                    <div className="admin-form-group" key={key}>
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

              <div className="admin-form-group">
                <label htmlFor="">Ingredients</label>
                <div className="border form-group">
                  <div className="horizontal-form-group">
                    <div className="admin-form-group">
                      <CustomDropdown
                        label="Select Ingredient"
                        value={ingredientForm.name}
                        onChange={(val) => setIngredientForm(prev => ({ ...prev, name: val }))}
                        options={availableIngredients.map(ing => ing.name)}
                        placeholder="Select Ingredient"
                      />
                    </div>

                    <div className="admin-form-group">
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
                        <label className={`mat-label${ingErrors.quantity ? " mat-label-error" : ""}`}>Quantity in grams</label>
                        <span className={`mat-bar${ingErrors.quantity ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                  </div>

                  <Button3D onClick={handleAddIngredient}>Add Ingredient</Button3D>
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
                              <Button3D variant="danger" iconOnly onClick={() => handleRemoveIngredient(index)}>Remove</Button3D>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                </div>
              </div>

              {/* VARIANT INPUT */}

              <div className="admin-form-group">
                <label htmlFor="">Variants</label>
                <div className="border form-group">
                  <div className="horizontal-form-group">
                    <div className="admin-form-group">
                      <div className="mat">
                        <input
                          className={`mat-input${formErrors.variantName ? " mat-error" : ""}`}
                          placeholder=" "
                          value={variantForm.name}
                          onChange={(e) => {
                            setVariantForm({ ...variantForm, name: allowTextInput(variantForm.name, e.target.value, 100, 5) });
                            setFormErrors(p => ({ ...p, variantName: false }));
                          }}
                        />
                        <label className={`mat-label${formErrors.variantName ? " mat-label-error" : ""}`}>Variant Name<span className="rf-req">*</span></label>
                        <span className={`mat-bar${formErrors.variantName ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>

                    <div className="admin-form-group">
                      <div className="mat">
                        <input
                          className="mat-input"
                          placeholder=" "
                          type="number"
                          min="0"
                          step="1"
                          value={variantForm.extraCharge}
                          onChange={(e) => setVariantForm({ ...variantForm, extraCharge: e.target.value })}
                        />
                        <label className="mat-label">Additional Cost</label>
                        <span className="mat-bar" />
                      </div>
                    </div>
                  </div>

                  <Button3D onClick={handleAddVariant}>Add Variant</Button3D>
                  {newDish.variants.length > 0 && (
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th>Additional Cost</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {newDish.variants.map((v, index) => (
                          <tr key={index}>
                            <td>{v.name}</td>
                            <td>₹{v.extraCharge}</td>
                            <td>
                              <Button3D variant="danger" iconOnly onClick={() => handleRemoveVariant(index)}>Remove</Button3D>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={resetDishForm}>Cancel</Button3D>
              <Button3D type="submit">Add Dish</Button3D>
            </div>
          </form>
        </div >
      )}
    </div >
  );
};

export default Dishes;