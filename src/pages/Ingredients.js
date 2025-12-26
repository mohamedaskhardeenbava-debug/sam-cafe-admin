import React, { useState } from "react";
import "./Ingredients.css";
import { useNavigate } from "react-router-dom";

const CATEGORY_OPTIONS = [
  { id: "pizza", label: "Pizza" },
  { id: "burger", label: "Burger" },
  { id: "sandwich", label: "Sandwich" },
  { id: "wraps", label: "Wraps" },
  { id: "pasta", label: "Pasta" },
  { id: "rice", label: "Rice" },
  { id: "noodles", label: "Noodles" },
  { id: "nachos", label: "Nachos" }
];

const EMPTY_FORM = {
  id: "",
  name: "",
  image: "",          // ✅ ADD THIS
  usedInCategories: [],
  pricePer100g: "",
  stockRemaining: "",
  nutritionPer100g: {
    kcal: "",
    protein: "",
    fat: "",
    fibre: ""
  }
};


const generateIngredientId = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const Ingredients = ({ adminData, onAdd, onUpdate, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const navigate = useNavigate();

  const handleSave = () => {
    if (!formData.name) {
      alert("Ingredient name is required");
      return;
    }

    const payload = {
  ...formData,        // includes image
  id: isEditMode
    ? formData.id
    : generateIngredientId(formData.name),
  pricePer100g: Number(formData.pricePer100g),
  stockRemaining: Number(formData.stockRemaining),
  nutritionPer100g: {
    kcal: Number(formData.nutritionPer100g.kcal),
    protein: Number(formData.nutritionPer100g.protein),
    fat: Number(formData.nutritionPer100g.fat),
    fibre: Number(formData.nutritionPer100g.fibre)
  }
};


    isEditMode ? onUpdate(payload.id, payload) : onAdd(payload);

    setShowForm(false);
  };

  const handleIngredientImageUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    setFormData((prev) => ({
      ...prev,
      image: reader.result
    }));
    setImagePreview(reader.result);
  };

  reader.readAsDataURL(file);
};

const openAddForm = () => {
  setFormData(EMPTY_FORM);
  setImagePreview("");     // ✅ RESET
  setIsEditMode(false);
  setShowForm(true);
};

const openEditForm = (ingredient) => {
  setFormData({ ...ingredient });
  setImagePreview(ingredient.image || ""); // ✅ LOAD EXISTING IMAGE
  setIsEditMode(true);
  setShowForm(true);
};


  return (
    <div className="ingredients-page">
      {/* HEADER */}
      <div className="ingredient-header">
        <h2 className="ingredient-title">Ingredients</h2>
        <button className="ingredient-add-btn" onClick={openAddForm}>
          + Add Ingredient
        </button>
      </div>

      {showForm && (
  <div className="ingredient-modal-overlay">
    <div className="ingredient-modal">
      <h3>{isEditMode ? "Edit Ingredient" : "Add New Ingredient"}</h3>

      <div className="form-group">
        <label>Ingredient Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          disabled={isEditMode}
        />
      </div>

      <div className="form-group">
  <label>Ingredient Image</label>
  <input
    type="file"
    accept="image/*"
    onChange={handleIngredientImageUpload}
  />

  {imagePreview && (
    <img
      src={imagePreview}
      alt="Ingredient preview"
      className="ingredient-image-preview"
    />
  )}
</div>


      <div className="form-group">
        <label>Used For</label>
        <div className="checkbox-grid">
          {CATEGORY_OPTIONS.map((cat) => (
            <label key={cat.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={formData.usedInCategories.includes(cat.id)}
                onChange={(e) => {
                  const updated = e.target.checked
                    ? [...formData.usedInCategories, cat.id]
                    : formData.usedInCategories.filter(
                        (c) => c !== cat.id
                      );

                  setFormData({
                    ...formData,
                    usedInCategories: updated
                  });
                }}
              />
              {cat.label}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Price per 100g (₹)</label>
        <input
          type="number"
          value={formData.pricePer100g}
          onChange={(e) =>
            setFormData({
              ...formData,
              pricePer100g: e.target.value
            })
          }
        />
      </div>

      <div className="form-group">
        <label>Stock Remaining (grams)</label>
        <input
          type="number"
          value={formData.stockRemaining}
          onChange={(e) =>
            setFormData({
              ...formData,
              stockRemaining: e.target.value
            })
          }
        />
      </div>

      <div className="form-group">
        <label>Nutrition per 100g</label>
        <div className="nutrition-grid">
          {["kcal", "protein", "fat", "fibre"].map((key) => (
            <div key={key}>
              <label>{key.toUpperCase()}</label>
              <input
                type="number"
                value={formData.nutritionPer100g[key]}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nutritionPer100g: {
                      ...formData.nutritionPer100g,
                      [key]: e.target.value
                    }
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button onClick={handleSave}>
          {isEditMode ? "Save Changes" : "Add Ingredient"}
        </button>
        <button onClick={() => setShowForm(false)}>Cancel</button>
      </div>
    </div>
  </div>
)}


      <div className="ingredient-table-wrapper">
        <table className="ingredient-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Price / 100g</th>
              <th>Stock</th>
              <th>Calories</th>
              <th>Protein</th>
              <th>Fibre</th>
              <th>Fat</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {adminData.ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td className="clickable"
                  onClick={() => navigate(`/ingredients/${ingredient.id}`)}>
                  <div className="ingredient-image">
                    <img src="" alt="" />
                  </div>
                </td>

                <td className="clickable"
                  onClick={() => navigate(`/ingredients/${ingredient.id}`)}>{ingredient.name}</td>
                <td>₹{ingredient.pricePer100g}</td>
                <td>{ingredient.stockRemaining}</td>
                <td>{ingredient.nutritionPer100g.kcal}</td>
                <td>{ingredient.nutritionPer100g.protein}g</td>
                <td>{ingredient.nutritionPer100g.fibre}g</td>
                <td>{ingredient.nutritionPer100g.fat}g</td>

                <td>
                  <button
                    className="ingredient-icon-btn ingredient-delete-btn"
                    onClick={() => {
                      if (window.confirm("Delete this ingredient?")) {
                        onDelete(ingredient.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Ingredients;
