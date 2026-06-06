import React, { useState } from "react";
import "./Categories.css";
import "./ModalCSS.css";
import { useNavigate } from "react-router-dom";
import api from "../api";
import closeIcon from "../icon/close-icon.png";
import deleteIcon from "../icon/delete-icon.png";
import editIcon from "../icon/edit-icon.png";
import { allowTextInput } from "../App";
import { useMemo } from "react";
import { sortArray } from "../App";
import { EmptyRow } from "../App";
import useInfiniteScroll from "../components/useInfiniteScroll";
import InfiniteScrollLoader from "../components/InfiniteScrollLoader";
import { useToast } from "../useToast";

const Categories = ({ adminData, setAdminData, toCamelCase, handleSort, sortConfig }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
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

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(sortedCategories.length, 30);

  const generateCategoryId = (name) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_");

  const handleAddCategory = async () => {
    const e = {};
    if (!newCategory.name.trim()) e.name = true;
    if (!imagePreview) e.image = true;
    if (Object.keys(e).length) { setFormErrors(e); return; }

    const categoryId = generateCategoryId(newCategory.name);

    const exists = adminData.categories.some(
      cat =>
        cat.name.trim().toLowerCase() ===
        newCategory.name.trim().toLowerCase()
    );

    if (exists) {
      setFormErrors({ name: true });
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
      await api.post("/categories", newCategoryPayload);
      // State update is handled by the socket data-change handler in App.js.
      // Do NOT call setAdminData here — it would race the socket and add duplicates.
      toast.success("Category added");
      resetAddCategoryForm();
    } catch (error) {
      console.error("Failed to add category:", error);
      toast.error("Failed to add category");
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

  const deleteSubCategory = (categoryId, subId) => {
    const category = adminData.categories.find(c => c.id === categoryId);
    if (!category) return;
    const sub = category.subCategories?.find(s => s.id === subId);

    toast.confirm(`Delete "${sub?.name || "this sub-category"}"?`, async () => {
      const updatedSubs = (category.subCategories || []).filter(s => s.id !== subId);
      const updatedCategory = { ...category, subCategories: updatedSubs };

      try {
        await api.put(`/categories/${categoryId}`, updatedCategory);
        // State update handled by socket data-change handler in App.js
        toast.success("Sub-category deleted");
      } catch (error) {
        console.error("Failed to delete sub-category:", error);
        toast.error("Failed to delete sub-category");
      }
    });
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
      toast.warning("Description max 3 words and 20 characters");
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

  const handleDeleteCategory = (categoryId) => {
    const category = adminData.categories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const hasDishs = (category.dishes || []).length > 0;
    const msg = hasDishs
      ? `"${category.name}" has dishes. Delete anyway?`
      : `Delete "${category.name}"?`;

    toast.confirm(msg, async () => {
      // Optimistic update — remove immediately so the UI responds at once
      setAdminData(prev => ({
        ...prev,
        categories: prev.categories.filter(c => c.id !== categoryId)
      }));
      try {
        await api.delete(`/categories/${categoryId}`);
        toast.success("Category deleted");
      } catch (error) {
        // Revert the optimistic removal only on a true server failure
        console.error("Failed to delete category:", error);
        setAdminData(prev => ({
          ...prev,
          categories: [...prev.categories, category]
        }));
        toast.error("Failed to delete category");
      }
    });
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setEditImage(imageUrl);
  };

  const handleSaveEdit = async () => {

    if (!editName.trim()) {
      setEditFormErrors({ name: true });
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
        // State update handled by socket data-change handler in App.js

        // -------- CATEGORY EDIT --------
      } else {
        const duplicate = adminData.categories.some(
          cat =>
            cat.id !== editCategoryId &&
            cat.name.trim().toLowerCase() ===
            editName.trim().toLowerCase()
        );

        if (duplicate) {
          setEditFormErrors({ name: true });
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
        // State update handled by socket data-change handler in App.js
      }

      resetEditCategoryForm();
      toast.success("Category updated");

    } catch (error) {
      console.error("Failed to update:", error);
      toast.error("Failed to update category");
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
    setFormErrors({});
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
    setEditFormErrors({});
    setShowEditModal(false);
  };

  return (
    <div className="categories-page">
      <div className="category-header">
        <h2 className="category-title">Categories</h2>
        <button
          className="modal-save-btn"
          onClick={() => setShowForm(true)}
        >
          <span className="shadow"></span>
          <span className="edge"></span>
          <span className="front">+ Add Category</span>
        </button>
      </div>

      <div className="category-table-wrapper" ref={containerRef}>
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
              sortedCategories.slice(0, displayLimit).map((category) => {
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
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={5}
            />
          </tbody>
        </table>
      </div>

      {
        showForm && (
          <div className="modal-overlay">
            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddCategory();
            }} className="modal">
              <div className="modal-header">
                <h3>Add New Category</h3>
                <button
                  type="button"
                  className="modal-cancel-btn"
                  aria-label="Close"
                  onClick={resetAddCategoryForm}
                >
                  <span class="shadow"></span>
                  <span class="edge"></span>
                  <span class="front close-padding"><img src={closeIcon} /></span>
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                      autoFocus
                      type="text"
                      placeholder=" "
                      value={newCategory.name}
                      onChange={(e) => {
                        setNewCategory((prev) => ({
                          ...prev,
                          name: allowTextInput(prev.name, e.target.value, 100, 5)
                        }));
                        setFormErrors(p => ({ ...p, name: false }));
                      }}
                      onBlur={(e) =>
                        setNewCategory((prev) => ({
                          ...prev,
                          name: toCamelCase(e.target.value)
                        }))
                      }
                    />
                    <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Name<span className="rf-req">*</span></label>
                    <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                  </div>
                </div>

                <div className="form-group">
                  <div className={`file-wrap${formErrors.image ? " file-error" : ""}`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => { handleImageUpload(e); setFormErrors(p => ({ ...p, image: false })); }}
                      className="file-input"
                    />
                    <div className={`file-label${formErrors.image ? " file-label-error" : ""}`}>
                      {imagePreview ? "✔ Category Image selected" : "Choose Category Image"}
                    </div>
                  </div>
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="staff-image-preview" />
                  )}
                </div>

                {newCategory.subCategories.length === 0 && (
                  <div className="border">
                    <label>Size Selector</label>

                    <div className="form-group">
                      <div className="mat">
                        <input
                          className="mat-input"
                          type="text"
                          placeholder=" "
                          value={sizeName}
                          onChange={(e) => setSizeName(e.target.value)}
                        />
                        <label className="mat-label">Size Name<span className="rf-req">*</span></label>
                        <span className="mat-bar" />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="mat">
                        <input
                          className="mat-input"
                          type="number"
                          placeholder=" "
                          step="0.1"
                          value={sizeMultiplier}
                          onChange={(e) => setSizeMultiplier(e.target.value)}
                        />
                        <label className="mat-label">Price Multiplier<span className="rf-req">*</span></label>
                        <span className="mat-bar" />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="mat">
                        <input
                          className="mat-input"
                          type="text"
                          placeholder=" "
                          value={sizeDescription}
                          onChange={(e) => setSizeDescription(e.target.value)}
                        />
                        <label className="mat-label">Description<span className="rf-req">*</span></label>
                        <span className="mat-bar" />
                      </div>
                    </div>

                    <button
                      className="modal-save-btn"
                      type="button"
                      onClick={addSize}
                    >
                      <span className="shadow"></span>
                      <span className="edge"></span>
                      <span className="front">Add</span>
                    </button>

                  </div>
                )}

                {newCategory.sizes.length > 0 && (

                  <table className="preview-table">

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
                              type="button"
                              className="modal-danger-btn"
                              onClick={() => {
                                setNewCategory(prev => ({
                                  ...prev,
                                  sizes: prev.sizes.filter((_, x) => x !== i)
                                }))
                              }}
                            >
                              <span className="shadow"></span>
                              <span className="edge"></span>
                              <span className="front">Remove</span>
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
                      className="modal-save-btn"
                      type="button"
                      onClick={() => setShowSubCategoryForm(true)}
                    >
                      <span className="shadow"></span>
                      <span className="edge"></span>
                      <span className="front">Add Subcategory</span>
                    </button>
                  </div>
                </div>

                {showSubCategoryForm && (
                  <div className="border">

                    <label>
                      {editingSubIndex !== null ? "Edit Subcategory" : "Add Subcategory"}
                    </label>

                    <div className="form-group">
                      <div className="mat">
                        <input
                          className="mat-input"
                          type="text"
                          placeholder=" "
                          value={newSubCategoryData.name}
                          onChange={(e) =>
                            setNewSubCategoryData(prev => ({
                              ...prev,
                              name: e.target.value
                            }))
                          }
                        />
                        <label className="mat-label">Subcategory Name<span className="rf-req">*</span></label>
                        <span className="mat-bar" />
                      </div>
                    </div>

                    <div className="file-wrap">
                      <input
                        type="file"
                        accept="image/*"
                        className="file-input"
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
                      <div className="file-label">
                        {newSubCategoryData.image ? "✔ Subcategory Image selected" : "Choose Subcategory Image..."}
                      </div>
                    </div>
                    {newSubCategoryData.image && (
                      <img
                        src={newSubCategoryData.image}
                        className="staff-image-preview"
                        alt="Subcategory preview"
                      />
                    )}

                    <div className="subcategory-size-row">

                      <div className="form-group">
                        <div className="mat">
                          <input
                            className="mat-input"
                            type="text"
                            placeholder=" "
                            value={subSizeName}
                            onChange={(e) => setSubSizeName(e.target.value)}
                          />
                          <label className="mat-label">Size Name<span className="rf-req">*</span></label>
                          <span className="mat-bar" />
                        </div>
                      </div>

                      <div className="form-group">
                        <div className="mat">
                          <input
                            className="mat-input"
                            type="number"
                            placeholder=" "
                            value={subSizeMultiplier}
                            onChange={(e) => setSubSizeMultiplier(e.target.value)}
                          />
                          <label className="mat-label">Size Multiplier<span className="rf-req">*</span></label>
                          <span className="mat-bar" />
                        </div>
                      </div>

                      <div className="form-group">
                        <div className="mat">
                          <input
                            className="mat-input"
                            type="text"
                            placeholder=" "
                            value={subSizeDescription}
                            onChange={(e) => setSubSizeDescription(e.target.value)}
                          />
                          <label className="mat-label">Descripion<span className="rf-req">*</span></label>
                          <span className="mat-bar" />
                        </div>
                      </div>

                      <button
                        className="modal-save-btn"
                        type="button"
                        onClick={() => addSize("subcategory")}
                      >
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add Size</span>
                      </button>

                    </div>

                    {newSubCategoryData.sizes.length > 0 && (

                      <table className="preview-table">

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
                                  className="modal-danger-btn"
                                  onClick={() => {
                                    setNewSubCategoryData(prev => ({
                                      ...prev,
                                      sizes: prev.sizes.filter((_, x) => x !== i)
                                    }))
                                  }}
                                >
                                  <span className="shadow"></span>
                                  <span className="edge"></span>
                                  <span className="front">Remove</span>
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
                          className="modal-danger-btn"
                          type="button"
                          onClick={() => {
                            setNewCategory(prev => ({
                              ...prev,
                              subCategories: prev.subCategories.filter((_, x) => x !== i)
                            }))
                          }}
                        >
                          <span className="shadow"></span>
                          <span className="edge"></span>
                          <span className="front">Remove</span>
                        </button>

                      </div>

                    ))}

                    <button
                      className="modal-save-btn"
                      type="button"
                      onClick={addSubCategory}>
                      <span className="shadow"></span>
                      <span className="edge"></span>
                      <span className="front">{editingSubIndex !== null ? "Save Subcategory" : "Add Subcategory"}</span>
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

              <div className="modal-footer">
                <button
                  className="modal-cancel-btn"
                  type="button"
                  onClick={resetAddCategoryForm}
                >
                  <span className="shadow"></span>
                  <span className="edge"></span>
                  <span className="front">cancel</span>
                </button>
                <button
                  type="submit"
                  className="modal-save-btn"
                >
                  <span className="shadow"></span>
                  <span className="edge"></span>
                  <span className="front">Add</span>
                </button>
              </div>
            </form>
          </div>
        )
      }

      {
        showEditModal && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>{isEditingSubCategory ? "Edit Subcategory" : "Edit Category"}</h3>
                <button
                  type="button"
                  className="modal-cancel-btn"
                  aria-label="Close"
                  onClick={resetEditCategoryForm}
                >
                  <span class="shadow"></span>
                  <span class="edge"></span>
                  <span class="front close-padding"><img src={closeIcon} /></span>
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <div className="mat">
                    <input
                      className={`mat-input${editFormErrors.name ? " mat-error" : ""}`}
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => {
                        setEditName((prev) => allowTextInput(prev, e.target.value, 100, 5));
                        setEditFormErrors(p => ({ ...p, name: false }));
                      }}
                      onBlur={(e) => setEditName(toCamelCase(e.target.value))}
                    />
                    <label className={`mat-label${editFormErrors.name ? " mat-label-error" : ""}`}>Name <span className="rf-req">*</span></label>
                    <span className={`mat-bar${editFormErrors.name ? " mat-bar-error" : ""}`} />
                  </div>
                </div>


                <div className="form-group">
                  <div className="file-wrap">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageUpload}
                      className="file-input"
                    />
                    <div className="file-label">
                      Change Category Image...
                    </div>
                  </div>
                  {editImage && (
                    <img src={editImage} alt="Preview" className="staff-image-preview" />
                  )}
                </div>

                {editSizes.length > 0 && (

                  <table className="preview-table">

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
                                  className="modal-save-btn"
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
                                  <span className="shadow"></span>
                                  <span className="edge"></span>
                                  <span className="front">Save</span>
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
                                  className="modal-save-btn"
                                  onClick={() => {
                                    setEditingSizeIndex(i)
                                    setSizeName(s.name)
                                    setSizeDescription(s.description)
                                    setSizeMultiplier(s.priceMultiplier)
                                  }}
                                >
                                  <span className="shadow"></span>
                                  <span className="edge"></span>
                                  <span className="front">Edit</span>
                                </button>

                              </td>

                              <td>

                                <button
                                  className="modal-danger-btn"
                                  onClick={() => {
                                    setEditSizes(prev =>
                                      prev.filter((_, x) => x !== i)
                                    )
                                  }}
                                >
                                  <span className="shadow"></span>
                                  <span className="edge"></span>
                                  <span className="front">Delete</span>
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
                      <div className="form-group">
                        <div className="mat">
                          <input
                            className="mat-input"
                            type="text"
                            placeholder="Size"
                            value={sizeName}
                            onChange={(e) => setSizeName(e.target.value)}
                          />
                          <label className="mat-label">Size Name<span className="rf-req">*</span></label>
                          <span className="mat-bar" />
                        </div>
                      </div>

                      <div className="form-group">
                        <div className="mat">
                          <input
                            className="mat-input"
                            type="number"
                            placeholder="Multiplier"
                            value={sizeMultiplier}
                            onChange={(e) => setSizeMultiplier(e.target.value)}
                          />
                          <label className="mat-label">Price Multiplier<span className="rf-req">*</span></label>
                          <span className="mat-bar" />
                        </div>
                      </div>

                      <div className="form-group">
                        <div className="mat">
                          <input
                            className="mat-input"
                            type="text"
                            placeholder="Description"
                            value={sizeDescription}
                            onChange={(e) => setSizeDescription(e.target.value)}
                          />
                          <label className="mat-label">Description<span className="rf-req">*</span></label>
                          <span className="mat-bar" />
                        </div>
                      </div>

                      <button
                        className="modal-save-btn"
                        type="button"
                        onClick={() => {

                          if (!sizeName.trim()) return;

                          if (!isValidSizeDescription(sizeDescription)) {
                            toast.warning("Description max 3 words and 20 characters");
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
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add Size</span>
                      </button>

                    </div>
                  )}
              </div>

              <div className="modal-footer">
                <button
                  className="modal-cancel-btn"
                  type="button"
                  onClick={resetEditCategoryForm}
                >
                  <span className="shadow"></span>
                  <span className="edge"></span>
                  <span className="front">Cancel</span>
                </button>

                <button
                  className="modal-save-btn"
                  type="button"
                  onClick={handleSaveEdit}
                >
                  <span className="shadow"></span>
                  <span className="edge"></span>
                  <span className="front">Save</span>
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