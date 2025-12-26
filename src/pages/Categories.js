import React, { useState } from "react";
import "./Categories.css";
import { useNavigate } from "react-router-dom";
import api from "../api"; // adjust path if needed

const Categories = ({ adminData, setAdminData }) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [newCategory, setNewCategory] = useState({
    name: "",
    image: ""
  });

  const generateCategoryId = (name) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_");

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      alert("Category name is required");
      return;
    }

    const categoryId = generateCategoryId(newCategory.name);

    const exists = adminData.categories.some(
      (cat) => cat.id === categoryId
    );

    if (exists) {
      alert("Category already exists");
      return;
    }

    const newCategoryPayload = {
      id: categoryId,
      name: newCategory.name,
      image: newCategory.image,
      dishes: []
    };

    try {
      // 1. Get current menu
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        categories: [...res.data.categories, newCategoryPayload]
      };

      // 2. Update menu (IMPORTANT)
      await api.put("/menu", updatedMenu);

      // 3. Update frontend state
      setAdminData((prev) => ({
        ...prev,
        categories: updatedMenu.categories
      }));

      setShowForm(false);
      setNewCategory({ name: "", image: "" });
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    const category = adminData.categories.find(
      (cat) => cat.id === categoryId
    );

    if (!category) return;

    if (category.dishes.length > 0) {
      const confirmDelete = window.confirm(
        "This category contains dishes. Are you sure you want to delete it?"
      );
      if (!confirmDelete) return;
    } else {
      const confirmDelete = window.confirm(
        "Are you sure you want to delete this category?"
      );
      if (!confirmDelete) return;
    }

    try {
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        categories: res.data.categories.filter(
          (cat) => cat.id !== categoryId
        )
      };

      await api.put("/menu", updatedMenu);

      setAdminData((prev) => ({
        ...prev,
        categories: updatedMenu.categories
      }));
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  const getMostAndLeastSelling = (dishes = []) => {
    if (dishes.length === 0) return { most: "-", least: "-" };

    let most = dishes[0];
    let least = dishes[0];

    dishes.forEach((dish) => {
      if (dish.basePrice > most.basePrice) most = dish;
      if (dish.basePrice < least.basePrice) least = dish;
    });

    return {
      most: most.name,
      least: least.name
    };
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewCategory((prev) => ({
        ...prev,
        image: reader.result   // base64 string
      }));
      setImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="categories-page">
      <div className="category-header">
        <h2 className="category-title">Categories</h2>
        <button
          className="category-add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add Category
        </button>
      </div>

      <div className="category-table-wrapper">
        <table className="category-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Category</th>
              <th>No. of Dishes</th>
              <th>Most Selling Dish</th>
              <th>Least Selling Dish</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {adminData.categories.map((category) => {
              const stats = getMostAndLeastSelling(category.dishes);

              return (
                <tr key={category.id}>

                  <td>
                    <div
                      className="category-image clickable"
                      onClick={() => navigate(`/dishes/${category.id}`)}
                    >
                      <img src={category.image || ""} alt="" />
                    </div>
                  </td>

                  <td
                    className="category-name clickable"
                    onClick={() => navigate(`/dishes/${category.id}`)}
                  >
                    {category.name}
                  </td>



                  <td>{category.dishes.length}</td>

                  <td>{stats.most}</td>

                  <td>{stats.least}</td>

                  <td>
                    <button
                      className="icon-btn delete-btn"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="category-modal-overlay">
          <div className="category-modal form-actions">
            <h3>Add New Category</h3>

            <input
              type="text"
              placeholder="Category Name"
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory({ ...newCategory, name: e.target.value })
              }
            />

            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
            />


            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  width: "120px",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginTop: "10px"
                }}
              />
            )}


            <div className="modal-actions">
              <button onClick={handleAddCategory}>Add</button>
              <button onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
