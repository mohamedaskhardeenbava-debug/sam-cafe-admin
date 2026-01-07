import React, { useState } from "react";
import "./Ingredients.css";
import { useNavigate } from "react-router-dom";
import deleteIcon from "../icon/delete-icon.png";
import { allowTextInput } from "../App";

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


const generateIngredientId = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const Ingredients = ({ adminData, onAdd, onUpdate, onDelete, toCamelCase }) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const navigate = useNavigate();
  const resetIngredientForm = () => {
    setShowForm(false);
    setIsEditMode(false);
    setFormData(EMPTY_FORM);
    setImagePreview("");
  };

  const handleSave = () => {

    const payload = {
      ...formData,
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


    isEditMode ? onUpdate(payload.id, payload) : onAdd(payload);

    resetIngredientForm();
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
    resetIngredientForm();
    setShowForm(true);
  };

  const openEditForm = (ingredient) => {
    setFormData({ ...ingredient });
    setImagePreview(ingredient.image || "");
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
          <form
            className="ingredient-modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}>

            <div className="ingredient-modal-header">
              <h3>{isEditMode ? "Edit Ingredient" : "Add New Ingredient"}</h3>
              <button
                type="button"
                className="ingredient-close-btn"
                aria-label="Close"
                onClick={resetIngredientForm}
              ></button>
            </div>

            <div className="ingredient-modal-body">
              <div className="form-group">
                <label>Ingredient Name</label>
                <input
                  autoFocus
                  required
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
              </div>

              <div className="form-group">
                <label>Ingredient Image</label>
                <input
                  required
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
                <label>Nutrition per 100g</label>
                <div className="nutrition-grid">
                  {["kcal", "protein", "fat", "fibre"].map((key) => (
                    <div key={key}>
                      <label>{key.toUpperCase()}</label>
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
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

              <div className="form-group">
                <label htmlFor="">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="">History</label>
                <textarea
                  required
                  value={formData.history}
                  onChange={(e) =>
                    setFormData({ ...formData, history: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="ingredient-modal-footer">
              <div className="form-actions">
                <button type="submit">
                  {isEditMode ? "Save Changes" : "Add Ingredient"}
                </button>
                <button type="button" onClick={resetIngredientForm}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}


      <div className="ingredient-table-wrapper">
        <table className="ingredient-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
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
                    <img src={deleteIcon} alt="" />
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