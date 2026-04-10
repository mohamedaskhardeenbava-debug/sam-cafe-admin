import React, { useState } from "react";
import "./KitchenRecipe.css"; // 🔥 reuse recipe-card + modal styles
import deleteIcon from "../../icon/delete-icon.png";
import api from "../../api";

export default function KitchenRecipe({ adminData, setAdminData }) {

  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: ""
  });

  const resetForm = () => {
    setForm({
      name: "",
      description: ""
    });
  };

  const addRecipe = async (e) => {
    e.preventDefault();

    const newRecipe = {
      id: Date.now(),
      ...form
    };

    await api.post("/recipes", newRecipe);

    // 🔥 instant UI update
    setAdminData(prev => ({
      ...prev,
      recipes: [...prev.recipes, newRecipe]
    }));

    resetForm();
    setShowForm(false);
  };

  const deleteRecipe = async (id) => {
    await api.delete(`/recipes/${id}`);

    // 🔥 update UI instantly
    setAdminData(prev => ({
      ...prev,
      recipes: prev.recipes.filter(r => r.id !== id)
    }));
  };

  return (
    <div className="recipe-page">

      {/* HEADER */}
      <div className="recipe-header">
        <h2>Recipes</h2>

        <button
          className="recipe-add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add Recipe
        </button>
      </div>

      {/* recipe-card LIST */}
      <div className="recipe-card-grid">
        {adminData.recipes?.length ? (
          (adminData.recipes || []).map(r => (
            <div
              key={r.id}
              className="recipe-card"
              onClick={() => setSelected(r)}
            >
              <h3>{r.name}</h3>

              {/* DELETE BUTTON */}
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation(); // ❗ prevent opening modal
                  deleteRecipe(r.id);
                }}
              >
                <img src={deleteIcon} alt="" />
              </button>
            </div>
          ))) : (
          <p>No recipes available</p>
        )}
      </div>

      {/* ADD MODAL */}
      {showForm && (
        <div className="category-modal-overlay">
          <form className="category-modal" onSubmit={addRecipe}>

            <div className="category-modal-header">
              <h3>Add Recipe</h3>
              <button
                className="dish-close-btn"
                onClick={() => {
                  resetForm();        // ✅ clear form
                  setShowForm(false);
                }}
              >
                ✖
              </button>
            </div>

            <div className="category-modal-body">

              <div className="form-group">
                <label>Recipe Name</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>

              <div className="form-group" style={{ height: "70%", boxSizing: "border-box" }}>
                <label>Recipe</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

            </div>

            <div className="category-modal-footer form-actions">
              <button type="submit" onClick={addRecipe}>
                Save
              </button>
              <button
                onClick={() => {
                  resetForm();      // ✅ clear form
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="category-modal-overlay">
          <div className="category-modal">

            <div className="category-modal-header">
              <h3>{selected.name}</h3>
              <button
                className="dish-close-btn"
                onClick={() => setSelected(null)}
              />
            </div>

            <div className="category-modal-body">
              <ul>
                {selected.description
                  ?.split("\n")
                  .filter(line => line.trim() !== "")
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ul>
            </div>

            <div className="category-modal-footer form-actions">
              <button onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}