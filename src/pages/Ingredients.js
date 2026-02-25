import React, { useState, useMemo } from "react";
import "./Ingredients.css";
import { useNavigate } from "react-router-dom";
import deleteIcon from "../icon/delete-icon.png";
import { allowTextInput } from "../App";
import { sortArray } from "../App";
import { EmptyRow } from "../App";


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


const generateIngredientId = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

const Ingredients = ({ adminData, onAdd, onUpdate, onDelete, toCamelCase, handleSort, sortConfig }) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showBrandInput, setShowBrandInput] = useState(false);
  const [brandInput, setBrandInput] = useState("");

  const navigate = useNavigate();
  const resetIngredientForm = () => {
    setShowForm(false);
    setIsEditMode(false);
    setFormData(EMPTY_FORM);
    setImagePreview("");
  };

  const sortedIngredients = useMemo(
    () => sortArray(adminData.ingredients, sortConfig),
    [adminData.ingredients, sortConfig]
  );

  const handleSave = () => {
    const normalizedName = formData.name.trim().toLowerCase();

    const duplicate = adminData.ingredients.some(
      ing =>
        (!isEditMode || ing.id !== formData.id) &&
        ing.name.trim().toLowerCase() === normalizedName
    );

    if (duplicate) {
      alert("Ingredient with this name already exists");
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
                  {adminData.categories.map((cat) => (
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
                      {cat.name}
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

              <div className="form-group">
                <label>Brands</label>

                {!showBrandInput && (
                  <button
                    type="button"
                    className="add-ingredient-button"
                    onClick={() => setShowBrandInput(true)}
                  >
                    + Add Brand
                  </button>
                )}

                {showBrandInput && (
                  <div className="inline-input">
                    <input
                      autoFocus
                      type="text"
                      value={brandInput}
                      onChange={(e) =>
                        setBrandInput(
                          allowTextInput(brandInput, e.target.value, 50, 2)
                        )
                      }
                    />

                    <div className="action">
                      <button
                        type="button"
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
                            alert("Brand already added");
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
                        Add
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBrandInput("");
                          setShowBrandInput(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {formData.brands.length > 0 && (
                  <table className="ingredient-form-table">
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
            {sortedIngredients.length === 0 ? (
              <EmptyRow colSpan={7} message="No ingredients found" />
            ) : (
              sortedIngredients.map((ingredient) => (
                <tr key={ingredient.id}>
                  <td className="clickable"
                    onClick={() => navigate(`/ingredients/${ingredient.id}`)}>
                    <div className="ingredient-image">
                      <img src="" alt="" />
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
                        if (window.confirm("Delete this ingredient?")) {
                          onDelete(ingredient.id);
                        }
                      }}
                    >
                      <img src={deleteIcon} alt="" />
                    </button>
                  </td>
                </tr>
              )))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Ingredients;