import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Dishes.css";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png";
import { allowTextInput } from "../App";
import { EmptyRow } from "../App";

const Dishes = ({ adminData, setAdminData, toCamelCase, handleSort, sortConfig }) => {
  const [dishImagePreview, setDishImagePreview] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editingDish, setEditingDish] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [showForm, setShowForm] = useState(false);
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

  const availableIngredients = adminData.ingredients
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
    if (adminData.categories.length === 0) return;

    if (categoryId) {
      const exists = adminData.categories.some(
        (cat) => cat.id === categoryId
      );

      if (exists) {
        setSelectedCategoryId(categoryId);
        return;
      }
    }

    setSelectedCategoryId(adminData.categories[0].id);
  }, [adminData.categories, categoryId]);

  const selectedCategory = adminData.categories.find(
    (cat) => cat.id === selectedCategoryId
  );

  const sortedDishes = useMemo(() => {
    if (!selectedCategory || !sortConfig.key) {
      return selectedCategory?.dishes || [];
    }

    const data = [...selectedCategory.dishes];

    data.sort((a, b) => {
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

    return data;
  }, [selectedCategory, sortConfig]);

  const handleSaveDish = async () => {
    if (!newDish.name || !newDish.basePrice) {
      alert("Dish name and base price are required");
      return;
    }

    const duplicateDish = selectedCategory.dishes.some(
      d =>
        (!editingDish || d.id !== editingDish.id) &&
        d.name.trim().toLowerCase() ===
        newDish.name.trim().toLowerCase()
    );

    if (duplicateDish) {
      alert("Dish with this name already exists in this category");
      return;
    }

    const dishPayload = {
      id: editingDish
        ? editingDish.id
        : `${selectedCategoryId}_${Date.now()}`,
      name: newDish.name,
      image: newDish.image,
      basePrice: Number(newDish.basePrice),
      description: newDish.description,
      benefits: {
        calories: Number(newDish.benefits.calories),
        protein: Number(newDish.benefits.protein),
        fibre: Number(newDish.benefits.fibre),
        fat: Number(newDish.benefits.fat)
      },
      ingredients: newDish.ingredients
    };

    try {
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        categories: res.data.categories.map((cat) =>
          cat.id === selectedCategoryId
            ? {
              ...cat,
              dishes: editingDish
                ? cat.dishes.map((d) =>
                  d.id === editingDish.id ? dishPayload : d
                )
                : [...cat.dishes, dishPayload]
            }
            : cat
        )
      };

      await api.put("/menu", updatedMenu);

      setAdminData((prev) => ({
        ...prev,
        categories: updatedMenu.categories
      }));

      resetDishForm();
    } catch (err) {
      console.error("Failed to save dish", err);
    }
  };


  const handleSave = (dishId) => {
    setAdminData((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === selectedCategoryId
          ? {
            ...cat,
            dishes: cat.dishes.map((dish) =>
              dish.id === dishId
                ? { ...dish, basePrice: Number(editedPrice) }
                : dish
            )
          }
          : cat
      )
    }));

    setEditingDishId(null);
    setEditedPrice("");
  };

  const handleCancel = () => {
    setEditingDishId(null);
    setEditedPrice("");
  };

  const handleDelete = async (dishId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this dish?"
    );
    if (!confirmed) return;

    try {
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        categories: res.data.categories.map((cat) =>
          cat.id === selectedCategoryId
            ? {
              ...cat,
              dishes: cat.dishes.filter((dish) => dish.id !== dishId)
            }
            : cat
        )
      };

      await api.put("/menu", updatedMenu);

      setAdminData((prev) => ({
        ...prev,
        categories: updatedMenu.categories
      }));
    } catch (err) {
      console.error("Failed to delete dish", err);
    }
  };

  const handleDishImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewDish((prev) => ({
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
          {adminData.categories.map(cat => (
            <button
              key={cat.id}
              className={`category-btn ${selectedCategoryId === cat.id ? "active" : ""
                }`}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setEditingDishId(null);
                navigate(`/dishes/${cat.id}`, { replace: true });
              }}
            >
              {cat.name}
            </button>
          ))}
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
                    onClick={() => navigate(`/dishes/${selectedCategoryId}/${dish.id}`)}
                  >
                    <div
                      className="dish-image"
                      onClick={() => navigate(`/dishes/${selectedCategoryId}/${dish.id}`)}
                    >
                      <img src={dish.image || ""} alt="" />
                    </div>
                  </td>

                  <td
                    className="dish-name clickable"
                    onClick={() => navigate(`/dishes/${selectedCategoryId}/${dish.id}`)}
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
              <h3>Add New Dish for {selectedCategory?.name}</h3>
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
                    style={{
                      width: 140,
                      height: 140,
                      objectFit: "cover",
                      borderRadius: 10,
                      marginTop: 12
                    }}
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
                <div className="benefits-grid">
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
                    <select
                      value={ingredientForm.name}
                      onChange={(e) =>
                        setIngredientForm(prev => ({
                          ...prev,
                          name: e.target.value
                        }))
                      }
                    >
                      <option value="">Select ingredient</option>

                      {availableIngredients.map(ing => (
                        <option key={ing.id} value={ing.name}>
                          {ing.name}
                        </option>
                      ))}
                    </select>
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