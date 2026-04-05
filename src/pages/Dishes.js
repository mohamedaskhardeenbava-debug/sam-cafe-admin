import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Dishes.css";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png";
import { allowTextInput } from "../App";
import { EmptyRow } from "../App";
import { resolveCategoryAndSubCategory } from "../App"

const Dishes = ({ adminData, setAdminData, toCamelCase, handleSort, sortConfig }) => {
  const [dishImagePreview, setDishImagePreview] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [editingDish, setEditingDish] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [openIngredientDropdown, setOpenIngredientDropdown] = useState(false);
  const [newDish, setNewDish] = useState({
    name: "",
    image: "",
    basePrice: "",
    description: "",
    benefits: {
      calories: "",
      protein: "",
      fibre: "",
      fat: ""
    },
    ingredients: []
  });

  useEffect(() => {
          const closeDropdowns = () => {
              setOpenIngredientDropdown(false);
          };
  
          window.addEventListener("click", closeDropdowns);
          return () => window.removeEventListener("click", closeDropdowns);
      }, []);

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

    setNewDish({
      name: "",
      image: "",
      basePrice: "",
      description: "",
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
      setSelectedCategoryIds([]);
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

  const handleSaveDish = async () => {

    if (!newDish.name || !newDish.basePrice) {
      alert("Dish name and base price are required");
      return;
    }

    if (selectedCategoryIds.length !== 1) {
      alert("Please select exactly one category to add a dish");
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
      alert("Dish with this name already exists");
      return;
    }

    const dishPayload = {
      id: editingDish
        ? editingDish.id
        : `${selectedId}_${Date.now()}`,

      categoryId: selectedId,

      name: newDish.name,
      image: newDish.image,

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

      setAdminData(prev => ({
        ...prev,
        categories: prev.categories.map(cat =>
          cat.id === category.id ? updatedCategory : cat
        )
      }));

      resetDishForm();

    } catch (err) {
      console.error("Failed to save dish", err);
    }

  };

  const handleDelete = async (dishId) => {

    if (selectedCategoryIds.length !== 1) {
      alert("Please select only one category to delete a dish");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this dish?"
    );

    if (!confirmed) return;

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

    let updatedCategory;

    if (subCategory) {

      updatedCategory = {
        ...category,
        subCategories: (category.subCategories || []).map(sub =>
          sub.id === subCategory.id
            ? {
              ...sub,
              dishes: (sub.dishes || []).filter(d => d.id !== dishId)
            }
            : sub
        )
      };

    } else {

      updatedCategory = {
        ...category,
        dishes: (category.dishes || []).filter(d => d.id !== dishId)
      };

    }

    await api.put(`/categories/${category.id}`, updatedCategory);

    setAdminData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === category.id ? updatedCategory : cat
      )
    }));

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
      alert("Ingredient already added to this dish");
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

        <div className="category-buttons">

          {adminData.categories.flatMap(cat => {

            if ((cat.subCategories || []).length > 0) {

              return cat.subCategories.map(sub => (

                <button
                  key={sub.id}
                  className={`category-btn ${selectedCategoryIds.includes(sub.id) ? "active" : ""
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
                className={`category-btn ${selectedCategoryIds.includes(cat.id) ? "active" : ""
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
          className="dish-add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add Dish
        </button>

      </div>

      <div className="dish-block">
        {/* <div className="dish-title">{selectedCategory?.name}</div> */}

        <div className="dish-table-wrapper">
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
                <th>Base Price</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {sortedDishes.map((dish) => (
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

                  <td>{dish.basePrice}
                  </td>

                  <td>
                    <button
                      className="icon-btn delete-btn"
                      disabled={showForm}
                      onClick={() => handleDelete(dish.id)}
                    >
                      <img src={deleteIcon} alt="" />
                    </button>

                  </td>
                </tr>
              ))}

              {sortedDishes.length === 0 && (
                <EmptyRow colSpan={4} message="No dishes available" />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="category-modal-overlay">
          <form
            className="category-modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDish();
            }}>

            <div className="category-modal-header">
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
                className="dish-close-btn"
                aria-label="Close"
                onClick={resetDishForm}
              ></button>
            </div>
            <div className="category-modal-body">
              <div className="form-group">
                <label htmlFor="">Dish name</label>
                <input
                  autoFocus
                  required
                  value={newDish.name}
                  onChange={(e) =>
                    setNewDish((prev) => ({
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
                    setNewDish((prev) => ({
                      ...prev,
                      name: toCamelCase(e.target.value)
                    }))
                  }

                />
              </div>

              <div className="form-group">
                <label htmlFor="">
                  Dish image
                </label>
                <input required type="file" accept="image/*" onChange={handleDishImageUpload} />


                {dishImagePreview && (
                  <img
                    src={dishImagePreview}
                    alt="Preview"
                  />
                )}
              </div>
              <div className="form-group">
                <label htmlFor="">Base price</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={newDish.basePrice}
                  onChange={(e) =>
                    setNewDish({ ...newDish, basePrice: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="">Description</label>
                <textarea
                  required
                  value={newDish.description}
                  onChange={(e) =>
                    setNewDish({ ...newDish, description: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="">Nutrition</label>
                <div className="benefits-grid border">
                  {["calories", "protein", "fibre", "fat"].map(key => (
                    <div key={key}>
                      <label>{key.toUpperCase()}</label>
                      <input
                        required
                        key={key}
                        type="number"
                        min="1"
                        step="1"
                        onChange={(e) =>
                          setNewDish({
                            ...newDish,
                            benefits: {
                              ...newDish.benefits,
                              [key]: e.target.value
                            }
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* INGREDIENT INPUT */}

              <div className="ingredient-form form-group">
                <label htmlFor="">Ingredients</label>
                <div className="border">
                  <div className="form-group">
                    <label htmlFor="">Ingredient Name</label>
                    <div className="dishes-dropdown-wrapper">
                      <button
                        type="button"
                        className="dishes-status-dropdown"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenIngredientDropdown(prev => !prev);
                        }}
                      >
                        {ingredientForm.name || "Select Ingredient"}
                      </button>

                      {openIngredientDropdown && (
                        <div className="dishes-dropdown-menu">
                          {availableIngredients.map(ing => (
                            <div
                              key={ing.id}
                              onClick={() => {
                                setIngredientForm(prev => ({
                                  ...prev,
                                  name: ing.name
                                }));
                                setOpenIngredientDropdown(false);
                              }}
                            >
                              {ing.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="">Quantity in grams</label>
                    <input

                      type="number"
                      min="1"
                      step="1"
                      value={ingredientForm.quantity}
                      onChange={(e) =>
                        setIngredientForm({ ...ingredientForm, quantity: e.target.value })
                      }
                    />
                  </div>

                  <button className="add-ingredient-button" type="button" onClick={handleAddIngredient}>
                    Add Ingredient
                  </button>
                  {newDish.ingredients.length > 0 && (
                    <table className="ingredient-form-table">
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
            <div className="category-modal-footer">
              <div className="form-actions">
                <button type="submit">Add Dish</button>
                <button type="button" onClick={resetDishForm}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Dishes;