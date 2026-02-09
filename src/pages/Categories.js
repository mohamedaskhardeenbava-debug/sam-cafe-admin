import React, { useState } from "react";
import "./Categories.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png";
import editIcon from "../icon/edit-icon.png";
import { allowTextInput } from "../App";
import { useMemo } from "react";
import { sortArray } from "../App";
import { EmptyRow } from "../App";

const Categories = ({ adminData, setAdminData, toCamelCase, handleSort, sortConfig }) => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [imagePreview, setImagePreview] = useState("")
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState("");
  const [newCategory, setNewCategory] = useState({
    name: "",
    image: ""
  });

  const sortedCategories = useMemo(
    () => sortArray(adminData.categories, sortConfig),
    [adminData.categories, sortConfig]
  );

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
      cat =>
        cat.name.trim().toLowerCase() ===
        newCategory.name.trim().toLowerCase()
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

      resetAddCategoryForm();
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  };

  const openEditModal = (category) => {
    setEditCategoryId(category.id);
    setEditName(category.name);
    setEditImage(category.image || "");
    setShowEditModal(true);
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

  const handleSaveCategoryEdit = async () => {
    if (!editName.trim()) {
      alert("Category name cannot be empty");
      return;
    }

    try {
      const res = await api.get("/menu");

      const updatedMenu = {
        ...res.data,
        categories: res.data.categories.map((cat) =>
          cat.id === editCategoryId
            ? {
              ...cat,
              name: editName,
              image: editImage
            }
            : cat
        )
      };

      await api.put("/menu", updatedMenu);

      setAdminData((prev) => ({
        ...prev,
        categories: updatedMenu.categories
      }));

      setEditCategoryId(null);
      setEditName("");
      setEditImage("");
    } catch (err) {
      console.error("Failed to update category", err);
    }
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setEditImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      alert("Category name cannot be empty");
      return;
    }

    const newCategoryId = generateCategoryId(editName);

    const duplicate = adminData.categories.some(
      cat =>
        cat.id !== editCategoryId &&
        cat.name.trim().toLowerCase() ===
        editName.trim().toLowerCase()
    );

    if (duplicate) {
      alert("Another category with this name already exists");
      return;
    }

    const res = await api.get("/menu");

    const updatedMenu = {
      ...res.data,
      categories: res.data.categories.map((cat) =>
        cat.id === editCategoryId
          ? {
            ...cat,
            id: newCategoryId,
            name: editName,
            image: editImage
          }
          : cat
      ),
      ingredients: res.data.ingredients.map((ing) => ({
        ...ing,
        usedInCategories: ing.usedInCategories.map((cid) =>
          cid === editCategoryId ? newCategoryId : cid
        )
      }))
    };

    await api.put("/menu", updatedMenu);

    setAdminData({
      ...updatedMenu
    });

    resetEditCategoryForm();
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
        image: reader.result
      }));
      setImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };

  // Reset Add Category form
  const resetAddCategoryForm = () => {
    setNewCategory({ name: "", image: "" });
    setImagePreview("");
    setShowForm(false);
  };

  // Reset Edit Category form
  const resetEditCategoryForm = () => {
    setEditCategoryId(null);
    setEditName("");
    setEditImage("");
    setShowEditModal(false);
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
              <th>No. of Dishes</th>
              <th>Edit</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {sortedCategories.length === 0 ? (
              <EmptyRow colSpan={5} message="No categories available" />
            ) : (
              sortedCategories.map((category) => {
                const stats = getMostAndLeastSelling(category.dishes);

                return (
                  <tr key={category.id}>

                    <td>
                      <div
                        className="category-image clickable"
                        onClick={() => navigate(`/dishes/${category.id}`)}
                      >
                        <img src="" alt="" />
                      </div>
                    </td>

                    <td
                      className="category-name clickable"
                      onClick={() => navigate(`/dishes/${category.id}`)}
                    >
                      {category.name}
                    </td>

                    <td>{category.dishes.length}</td>

                    <td>
                      <button
                        className="icon-btn edit-btn"
                        onClick={() => openEditModal(category)}
                      >
                        <img src={editIcon} alt="" />
                      </button>
                    </td>

                    <td>
                      <button
                        className="icon-btn delete-btn"
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        <img src={deleteIcon} alt="" />
                      </button>
                    </td>
                  </tr>
                );
              }))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="category-modal-overlay">
          <form onSubmit={(e) => {
            e.preventDefault();
            handleAddCategory();
          }} className="category-modal form-actions">
            <h3>Add New Category</h3>
            <button
              type="button"
              className="category-close-btn"
              aria-label="Close"
              onClick={resetAddCategoryForm}
            >

            </button>

            <div className="form-group">
              <input
                autoFocus
                required
                type="text"
                placeholder="Category Name"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory((prev) => ({
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
                  setNewCategory((prev) => ({
                    ...prev,
                    name: toCamelCase(e.target.value)
                  }))
                }
              />
            </div>

            <div className="form-group">
              <input
                required
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </div>


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
              <button type="submit">Add</button>
              <button type="button" onClick={resetAddCategoryForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showEditModal && (
        <div className="category-modal-overlay">
          <div className="category-modal form-actions">
            <h3>Edit Category</h3>
            <button
              type="button"
              className="category-close-btn"
              aria-label="Close"
              onClick={resetEditCategoryForm}
            ></button>

            <div className="form-group">
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={(e) =>
                  setEditName((prev) =>
                    allowTextInput(prev, e.target.value, 100, 5)
                  )
                }
                onBlur={(e) =>
                  setEditName(toCamelCase(e.target.value))
                }
              />
            </div>

            <div className="form-group">
              <input
                type="file"
                accept="image/*"
                onChange={handleEditImageUpload}
              />
            </div>

            {editImage && (
              <img
                src={editImage}
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
              <button onClick={handleSaveEdit}>Save</button>
              <button type="button" onClick={resetEditCategoryForm}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;