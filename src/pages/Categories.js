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
    image: "",
    sizes: [],
    subCategories: []
  });
  const [newSubCategory, setNewSubCategory] = useState("");
  const [showSubCategoryForm, setShowSubCategoryForm] = useState(false);
  const [newSubCategoryData, setNewSubCategoryData] = useState({
    name: "",
    image: "",
    sizes: []
  });
  const [sizeName, setSizeName] = useState("");
  const [sizeMultiplier, setSizeMultiplier] = useState("");
  const [sizeDescription, setSizeDescription] = useState("");
  const [subSizeName, setSubSizeName] = useState("");
  const [subSizeMultiplier, setSubSizeMultiplier] = useState("");
  const [subSizeDescription, setSubSizeDescription] = useState("");
  const [openCategory, setOpenCategory] = useState(null);
  const [editingSizeIndex, setEditingSizeIndex] = useState(null);
  const [editingSubIndex, setEditingSubIndex] = useState(null);
  const [editSizes, setEditSizes] = useState([]);
  const [showSubEditModal, setShowSubEditModal] = useState(false)
  const [editingSubCategory, setEditingSubCategory] = useState(null)
  const [isEditingSubCategory, setIsEditingSubCategory] = useState(false);
  const [editingParentCategoryId, setEditingParentCategoryId] = useState(null);

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
      description: newCategory.description,
      sizes: newCategory.sizes,
      subCategories: newCategory.subCategories,
      dishes: []
    };

    try {
      // 1. Get current menu
      const res = await api.post("/categories", newCategoryPayload);

      setAdminData(prev => ({
        ...prev,
        categories: [...prev.categories, res.data]
      }));

      resetAddCategoryForm();
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  };

  const addSubCategory = () => {

    if (!newSubCategoryData.name.trim()) return;

    setNewCategory(prev => ({
      ...prev,
      sizes: [], // remove category sizes automatically
      subCategories: editingSubIndex !== null
        ? prev.subCategories.map((s, idx) =>
          idx === editingSubIndex
            ? {
              id: newSubCategoryData.name.toLowerCase().replace(/\s+/g, "_"),
              name: newSubCategoryData.name,
              image: newSubCategoryData.image,
              sizes: newSubCategoryData.sizes,
              dishes: []
            }
            : s
        )
        : [
          ...prev.subCategories,
          {
            id: newSubCategoryData.name.toLowerCase().replace(/\s+/g, "_"),
            name: newSubCategoryData.name,
            image: newSubCategoryData.image,
            sizes: newSubCategoryData.sizes,
            dishes: []
          }
        ]
    }));

    setNewSubCategoryData({
      name: "",
      image: "",
      sizes: []
    });

    setShowSubCategoryForm(false);
  };

  const deleteSubCategory = async (categoryId, subId) => {

    const category = adminData.categories.find(c => c.id === categoryId);

    const updatedSubs = category.subCategories.filter(s => s.id !== subId);

    const updatedCategory = {
      ...category,
      subCategories: updatedSubs
    };

    await api.put(`/categories/${categoryId}`, updatedCategory);

    setAdminData(prev => ({
      ...prev,
      categories: prev.categories.map(c =>
        c.id === categoryId ? updatedCategory : c
      )
    }));
  };

  const isValidSizeDescription = (text) => {

    if (!text || !text.trim()) return true;

    const words = text.trim().split(/\s+/);

    if (words.length > 3) return false;
    if (text.length > 20) return false;

    return true;
  };

  const addSize = (target = "category") => {

    if (target === "subcategory") {
      if (!subSizeName.trim()) return;
    } else {
      if (!sizeName.trim()) return;
    }

    if (sizeDescription && !isValidSizeDescription(sizeDescription)) {
      alert("Description max 3 words and 20 characters");
      return;
    }
    const sizeObj = {
      name: sizeName,
      description: sizeDescription,
      priceMultiplier: Number(sizeMultiplier || 1)
    };

    if (target === "subcategory") {

      const sizeObj = {
        name: subSizeName,
        description: subSizeDescription,
        priceMultiplier: Number(subSizeMultiplier || 1)
      };

      setNewSubCategoryData(prev => ({
        ...prev,
        sizes: [...prev.sizes, sizeObj]
      }));

      setSubSizeName("");
      setSubSizeMultiplier("");
      setSubSizeDescription("");
    } else {

      setNewCategory(prev => ({
        ...prev,
        sizes: [...prev.sizes, sizeObj]
      }));

    }

    setSizeName("");
    setSizeMultiplier("");
    setSizeDescription("");
  };

  const openEditModal = (category) => {
    setEditCategoryId(category.id);
    setEditName(category.name);
    setEditImage(category.image || "");
    setEditSizes(category.sizes || []);

    setSizeName("");
    setSizeDescription("");
    setSizeMultiplier("");
    setEditingSizeIndex(null);

    setShowEditModal(true);
  };

  const handleDeleteCategory = async (categoryId) => {
    const category = adminData.categories.find(
      (cat) => cat.id === categoryId
    );

    if (!category) return;

    if ((category.dishes || []).length > 0) {
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
      await api.delete(`/categories/${categoryId}`);

      setAdminData(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId)
      }));
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setEditImage(imageUrl);
  };

  const handleSaveEdit = async () => {

    if (!editName.trim()) {
      alert("Name cannot be empty");
      return;
    }

    try {

      // -------- SUBCATEGORY EDIT --------
      if (isEditingSubCategory) {

        const category = adminData.categories.find(
          c => c.id === editingParentCategoryId
        );

        if (!category) return;

        const updatedSubCategories = category.subCategories.map(sub =>
          sub.id === editingSubCategory.id
            ? {
              ...sub,
              name: editName,
              image: editImage,
              sizes: editSizes
            }
            : sub
        );

        const updatedCategory = {
          ...category,
          subCategories: updatedSubCategories
        };

        await api.put(`/categories/${category.id}`, updatedCategory);

        setAdminData(prev => ({
          ...prev,
          categories: prev.categories.map(c =>
            c.id === category.id ? updatedCategory : c
          )
        }));


        // -------- CATEGORY EDIT --------
      } else {
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

        const existing = adminData.categories.find(
          c => c.id === editCategoryId
        );

        if (!existing) return;

        const updatedCategory = {
          ...existing,
          name: editName,
          image: editImage,
          sizes: editSizes,
          subCategories: existing.subCategories
        };

        // ✅ ONLY UPDATE (no delete + no id change)
        await api.put(`/categories/${existing.id}`, updatedCategory);

        setAdminData(prev => ({
          ...prev,
          categories: prev.categories.map(cat =>
            cat.id === existing.id ? updatedCategory : cat
          )
        }));
      }

      resetEditCategoryForm();

    } catch (error) {
      console.error("Failed to update:", error);
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
      setNewCategory(prev => ({
        ...prev,
        image: reader.result
      }));
      setImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };

  // Reset Add Category form
  const resetAddCategoryForm = () => {
    setNewCategory({
      name: "",
      image: "",
      description: "",
      sizes: [],
      subCategories: []
    });
    setImagePreview("");
    setShowForm(false);
  };

  // Reset Edit Category form
  const resetEditCategoryForm = () => {
    setEditCategoryId(null);
    setEditName("");
    setEditImage("");
    setEditSizes([]);
    setIsEditingSubCategory(false);
    setEditingParentCategoryId(null);
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
                    {sortConfig.key === "name"
                      ? sortConfig.direction === "asc"
                        ? "▲"
                        : "▼"
                      : ""}
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
                  <React.Fragment key={category.id}>
                    <tr
                      key={category.id}
                      onClick={() => {
                        if ((category.subCategories || []).length > 0) {
                          setOpenCategory(openCategory === category.id ? null : category.id)
                        } else {
                          navigate(`/dishes/${category.id}`);
                        }
                      }}
                    >

                      <td>
                        <div
                          className="category-image clickable"
                          onClick={() => navigate(`/dishes/${category.id}`)}
                        >
                          <img src={category.image} alt="" />
                        </div>
                      </td>

                      <td className="category-name clickable">
                        {category.name}
                      </td>

                      <td>{(category.dishes || []).length}</td>

                      <td>
                        <button
                          className="icon-btn edit-btn"
                          onClick={(e) => {
                            openEditModal(category)
                            e.stopPropagation()
                          }}
                        >
                          <img src={editIcon} alt="" />
                        </button>
                      </td>

                      <td>
                        <button
                          className="icon-btn delete-btn"
                          onClick={(e) => {
                            handleDeleteCategory(category.id)
                            e.stopPropagation()
                          }}
                        >
                          <img src={deleteIcon} alt="" />
                        </button>
                      </td>

                    </tr >

                    {
                      openCategory === category.id &&
                      (category.subCategories || []).length > 0 && (

                        <tr className={`subcategory-row ${openCategory === category.id ? "open" : ""}`}>
                          <td colSpan="5">
                            <div className="subcategory-content">
                              <table className="subcategory-table">
                                <thead>
                                  <tr>
                                    <th>Image</th>
                                    <th>Name</th>
                                    <th>No. of Dishes</th>
                                    <th>Edit</th>
                                    <th>Delete</th>
                                  </tr>
                                </thead>
                                <tbody>

                                  {category.subCategories.map((sub, i) => (

                                    <tr
                                      key={sub.id}
                                      className="clickable"
                                      onClick={() => navigate(`/dishes/${sub.id}`)}
                                    >
                                      <td>
                                        <div className="subcategory-image">
                                          <img src={sub.image} alt="" />
                                        </div>
                                      </td>

                                      <td>{sub.name}</td>

                                      <td>{(sub.dishes || []).length}</td>

                                      <td>

                                        <button
                                          className="icon-btn edit-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();

                                            setIsEditingSubCategory(true);
                                            setEditingParentCategoryId(category.id);
                                            setEditingSubCategory(sub);

                                            setEditName(sub.name);
                                            setEditImage(sub.image);
                                            setEditSizes(sub.sizes || []);

                                            setShowEditModal(true);
                                          }}
                                        >
                                          <img src={editIcon} alt="" />
                                        </button>

                                      </td>

                                      <td>

                                        <button
                                          className="icon-btn delete-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteSubCategory(category.id, sub.id);
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
                          </td>
                        </tr>

                      )
                    }

                  </React.Fragment>
                );
              }))}
          </tbody>
        </table>
      </div>

      {
        showForm && (
          <div className="category-modal-overlay">
            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddCategory();
            }} className="category-modal form-actions">
              <div className="modal-header">
                <h3>Add New Category</h3>
                <button
                  type="button"
                  className="category-close-btn"
                  aria-label="Close"
                  onClick={resetAddCategoryForm}
                >
                </button>
              </div>

              <div className="modal-body">
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

                {newCategory.subCategories.length === 0 && (
                  <div className="form-group">

                    <label>Size Selector</label>

                    <div className="category-size-row">

                      <input
                        type="text"
                        placeholder="Size name"
                        value={sizeName}
                        onChange={(e) => setSizeName(e.target.value)}
                      />

                      <input
                        type="number"
                        placeholder="Multiplier"
                        step="0.1"
                        value={sizeMultiplier}
                        onChange={(e) => setSizeMultiplier(e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Description"
                        value={sizeDescription}
                        onChange={(e) => setSizeDescription(e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={addSize}
                      >
                        Add
                      </button>

                    </div>

                  </div>
                )}

                {newCategory.sizes.length > 0 && (

                  <table className="size-preview-table">

                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Multiplier</th>
                        <th>Remove</th>
                      </tr>
                    </thead>

                    <tbody>
                      {newCategory.sizes.map((s, i) => (
                        <tr key={i}>
                          <td>{s.name}</td>
                          <td>{s.description}</td>
                          <td>x{s.priceMultiplier}</td>
                          <td>
                            <button
                              onClick={() => {
                                setNewCategory(prev => ({
                                  ...prev,
                                  sizes: prev.sizes.filter((_, x) => x !== i)
                                }))
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                  </table>

                )}

                <div className="form-group">
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => setShowSubCategoryForm(true)}
                    >
                      Add Sub Category
                    </button>
                  </div>
                </div>

                {showSubCategoryForm && (
                  <div className="subcategory-form">

                    <h4>
                      {editingSubIndex !== null ? "Edit Subcategory" : "Add Subcategory"}
                    </h4>

                    <div className="subcategory-input-row">
                      <input
                        type="text"
                        placeholder="Subcategory name"
                        value={newSubCategoryData.name}
                        onChange={(e) =>
                          setNewSubCategoryData(prev => ({
                            ...prev,
                            name: e.target.value
                          }))
                        }
                      />

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          const reader = new FileReader();

                          reader.onloadend = () => {
                            setNewSubCategoryData(prev => ({
                              ...prev,
                              image: reader.result
                            }))
                          };

                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>

                    {newSubCategoryData.image && (
                      <img
                        src={newSubCategoryData.image}
                        className="subcategory-preview-image"
                      />
                    )}

                    <div className="subcategory-size-row">

                      <input
                        type="text"
                        placeholder="Size"
                        value={subSizeName}
                        onChange={(e) => setSubSizeName(e.target.value)}
                      />

                      <input
                        type="number"
                        placeholder="Multiplier"
                        value={subSizeMultiplier}
                        onChange={(e) => setSubSizeMultiplier(e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Description"
                        value={subSizeDescription}
                        onChange={(e) => setSubSizeDescription(e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={() => addSize("subcategory")}
                      >
                        Add Size
                      </button>

                    </div>

                    {newSubCategoryData.sizes.length > 0 && (

                      <table className="size-preview-table">

                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Multiplier</th>
                            <th>Remove</th>
                          </tr>
                        </thead>

                        <tbody>

                          {newSubCategoryData.sizes.map((s, i) => (
                            <tr key={i}>

                              <td>{s.name}</td>
                              <td>{s.description}</td>
                              <td>x{s.priceMultiplier}</td>

                              <td>
                                <button
                                  onClick={() => {
                                    setNewSubCategoryData(prev => ({
                                      ...prev,
                                      sizes: prev.sizes.filter((_, x) => x !== i)
                                    }))
                                  }}
                                >
                                  Remove
                                </button>
                              </td>

                            </tr>
                          ))}

                        </tbody>

                      </table>

                    )}

                    {newCategory.subCategories.map((sub, i) => (

                      <div
                        key={sub.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: "6px"
                        }}
                      >

                        <span>{sub.name}</span>

                        <button
                          type="button"
                          onClick={() => {
                            setNewCategory(prev => ({
                              ...prev,
                              subCategories: prev.subCategories.filter((_, x) => x !== i)
                            }))
                          }}
                        >
                          Remove
                        </button>

                      </div>

                    ))}

                    <button type="button" onClick={addSubCategory}>
                      {editingSubIndex !== null ? "Save Subcategory" : "Add Subcategory"}
                    </button>

                  </div>
                )}

                {newCategory.subCategories.length > 0 && (

                  <table className="subcategory-preview-table">

                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Name</th>
                        <th>Sizes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>

                      {newCategory.subCategories.map((sub, i) => (
                        <tr key={sub.id}>

                          <td>
                            <img src={sub.image} alt="" />
                          </td>

                          <td>{sub.name}</td>

                          <td>
                            {sub.sizes.map((s, si) => (
                              <div key={si}>
                                {s.name} – {s.description} (x{s.priceMultiplier})
                              </div>
                            ))}
                          </td>

                          <td>
                            <div className="subcategory-actions">

                              <button
                                className="sub-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation()

                                  setIsEditingSubCategory(true);
                                  setEditingParentCategoryId(editCategoryId);

                                  setEditName(sub.name);
                                  setEditImage(sub.image);
                                  setEditSizes(sub.sizes || []);

                                  setEditingSubCategory(sub);
                                  setShowEditModal(true);
                                }}
                              >
                                Edit
                              </button>

                              <button
                                className="sub-delete-btn"
                                onClick={() => {
                                  setNewCategory(prev => ({
                                    ...prev,
                                    subCategories: prev.subCategories.filter((_, x) => x !== i)
                                  }))
                                }}
                              >
                                Delete
                              </button>

                            </div>
                          </td>

                        </tr>
                      ))}

                    </tbody>
                  </table>

                )}
              </div>

              <div className="modal-actions modal-footer">
                <button type="submit">Add</button>
                <button type="button" onClick={resetAddCategoryForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )
      }

      {
        showEditModal && (
          <div className="category-modal-overlay">
            <div className="category-modal form-actions">
              <div className="modal-header">
                <h3>{isEditingSubCategory ? "Edit Subcategory" : "Edit Category"}</h3>
                <button
                  type="button"
                  className="category-close-btn"
                  aria-label="Close"
                  onClick={resetEditCategoryForm}
                ></button>
              </div>

              <div className="modal-body">
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

                {editSizes.length > 0 && (

                  <table className="size-preview-table">

                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Multiplier</th>
                        <th>Edit</th>
                        <th>Delete</th>
                      </tr>
                    </thead>

                    <tbody>

                      {editSizes.map((s, i) => (
                        <tr key={i}>

                          {editingSizeIndex === i ? (

                            <>
                              <td>
                                <input
                                  value={sizeName}
                                  onChange={(e) => setSizeName(e.target.value)}
                                />
                              </td>

                              <td>
                                <input
                                  value={sizeDescription}
                                  onChange={(e) => setSizeDescription(e.target.value)}
                                />
                              </td>

                              <td>
                                <input
                                  value={sizeMultiplier}
                                  onChange={(e) => setSizeMultiplier(e.target.value)}
                                />
                              </td>

                              <td>
                                <button
                                  onClick={() => {
                                    setEditSizes(prev =>
                                      prev.map((sz, idx) =>
                                        idx === i
                                          ? {
                                            name: sizeName,
                                            description: sizeDescription,
                                            priceMultiplier: Number(sizeMultiplier)
                                          }
                                          : sz
                                      )
                                    )

                                    setEditingSizeIndex(null)
                                  }}
                                >
                                  Save
                                </button>
                              </td>

                              <td>-</td>
                            </>

                          ) : (

                            <>
                              <td>{s.name}</td>
                              <td>{s.description}</td>
                              <td>x{s.priceMultiplier}</td>

                              <td>

                                <button
                                  onClick={() => {
                                    setEditingSizeIndex(i)
                                    setSizeName(s.name)
                                    setSizeDescription(s.description)
                                    setSizeMultiplier(s.priceMultiplier)
                                  }}
                                >
                                  Edit
                                </button>

                              </td>

                              <td>

                                <button
                                  onClick={() => {
                                    setEditSizes(prev =>
                                      prev.filter((_, x) => x !== i)
                                    )
                                  }}
                                >
                                  Delete
                                </button>

                              </td>

                            </>

                          )}

                        </tr>
                      ))}

                    </tbody>
                  </table>
                )}

                {(
                  isEditingSubCategory ||
                  (editCategoryId &&
                    (adminData.categories.find(c => c.id === editCategoryId)?.subCategories || []).length === 0)
                ) && (
                    <div className="category-size-row">

                      <input
                        type="text"
                        placeholder="Size"
                        value={sizeName}
                        onChange={(e) => setSizeName(e.target.value)}
                      />

                      <input
                        type="number"
                        placeholder="Multiplier"
                        value={sizeMultiplier}
                        onChange={(e) => setSizeMultiplier(e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Description"
                        value={sizeDescription}
                        onChange={(e) => setSizeDescription(e.target.value)}
                      />

                      <button
                        type="button"
                        onClick={() => {

                          if (!sizeName.trim()) return;

                          if (!isValidSizeDescription(sizeDescription)) {
                            alert("Description max 3 words and 20 characters");
                            return;
                          }

                          // reset edit mode
                          setEditingSizeIndex(null);

                          const newSize = {
                            name: sizeName,
                            description: sizeDescription,
                            priceMultiplier: Number(sizeMultiplier || 1)
                          };

                          setEditSizes(prev => [...prev, newSize]);

                          setSizeName("");
                          setSizeDescription("");
                          setSizeMultiplier("");

                        }}
                      >
                        Add Size
                      </button>

                    </div>
                  )}
              </div>

              <div className="modal-actions modal-footer">
                <button onClick={handleSaveEdit}>Save</button>
                <button type="button" onClick={resetEditCategoryForm}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Categories;