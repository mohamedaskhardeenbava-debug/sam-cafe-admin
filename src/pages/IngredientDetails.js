/**
 * IngredientDetails.js  —  Sam Cafe Admin Panel
 * Single ingredient detail/edit page
 */

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../api";

import editIcon from "../icon/edit-icon.png";
import { allowTextInput } from "../App";
import deleteIcon from "../icon/delete-icon.png";
import { formatDisplayDate } from "../App"
import { EmptyState } from "../App";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";

import "./IngredientDetails.css";
import PageLoader from "../components/PageLoader";

const IngredientDetails = ({ adminData, setAdminData, toCamelCase, generateIdFromName }) => {
  // ── Hooks

  const { toast } = useToast();
  const { ingredientId } = useParams();
  const navigate = useNavigate();

  const ingredient = adminData.ingredients?.find(
    (ing) => ing.id === ingredientId
  );

  const [localIngredient, setLocalIngredient] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showBrandInput, setShowBrandInput] = useState(false);
  const [brandInput, setBrandInput] = useState("");

  useEffect(() => {
    if (ingredient) {
      setLocalIngredient(JSON.parse(JSON.stringify(ingredient)));
    }
  }, [ingredient]);

  const resetEditState = () => {
    setIsEditing(false);
    setShowBrandInput(false);
    setBrandInput("");

    // Revert unsaved changes
    if (ingredient) {
      setLocalIngredient(JSON.parse(JSON.stringify(ingredient)));
    }
  };

  if (!localIngredient) {
    return <PageLoader fill label="Loading ingredient…" />;
  }

  /* ---------------- SAVE TO JSON ---------------- */
  const saveIngredient = async (updated) => {

    const oldId = ingredient.id;   // ingredient ids never change on edit

    const payload = {
      ...updated,
      id: oldId
    };

    try {

      await api.put(`/ingredients/${oldId}`, payload);

      setAdminData(prev => ({
        ...prev,
        ingredients: prev.ingredients.map(i =>
          i.id === oldId ? payload : i
        )
      }));

      setLocalIngredient(payload);
      setIsEditing(false);
      setShowBrandInput(false);
      setBrandInput("");

    } catch (err) {
      console.error("Ingredient update failed:", err);
      toast.error("Ingredient update failed:");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = async () => {

      const updated = {
        ...localIngredient,
        image: reader.result
      };

      setLocalIngredient(updated);

      await saveIngredient(updated);
    };

    reader.readAsDataURL(file);
  };

  const getDisabledInfo = () => {
    if (!localIngredient) return { label: "—", type: "none" };

    if (localIngredient.isDisabledGlobally === true) {
      return { label: "All Dishes", type: "all" };
    }

    const disabled = localIngredient.disabledForDishes || [];

    if (disabled.length === 0) {
      return { label: "—", type: "none" };
    }

    const dishNames = adminData.categories
      .flatMap(cat => [
        ...(cat.dishes || []),
        ...(cat.subCategories || []).flatMap(sub => sub.dishes || [])
      ])
      .filter(d => disabled.includes(d.id))
      .map(d => d.name);

    return {
      label: dishNames.length ? dishNames.join(", ") : "—",
      type: "partial"
    };
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;

    const today = new Date();
    const expiry = new Date(expiryDate);

    const diffTime = expiry - today;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    return diffDays <= 15;
  };

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button
          className="back-btn"
          onClick={() => {
            resetEditState();
            navigate(-1);
          }}
        />
        <h2>{localIngredient.name}</h2>
        {!isEditing && (
          <Button3D variant="cancel" onClick={() => setIsEditing(true)}>
            <img src={editIcon} alt="edit" />
            Edit
          </Button3D>
        )}
      </div>

      <div className="details-body">
        <div className="horizontal-form-group">
          {/* IMAGE — thumbnail style (matches DishDetails) */}
          <div className="ingredient-details-image">
            <img src={localIngredient.image} alt={localIngredient.name} />
          </div>

          {isEditing && (
            <div style={{ width: "150px" }}>
              <div className="file-wrap">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e)}
                  className="file-input"
                />
                <div className="file-label">Change Image</div>
              </div>
            </div>
          )}

          {/* NAME */}
          <div className="section">
            <div className="section-title">
              <span>Name</span>
            </div>
            {isEditing ? (
              <input
                value={localIngredient.name}
                onChange={(e) =>
                  setLocalIngredient((prev) => ({
                    ...prev,
                    name: allowTextInput(prev.name, e.target.value, 100, 5)
                  }))
                }
                onBlur={(e) =>
                  setLocalIngredient((prev) => ({
                    ...prev,
                    name: toCamelCase(e.target.value)
                  }))
                }
              />
            ) : (
              <p>{localIngredient.name}</p>
            )}
          </div>

          <div className="section">
            <div className="section-title">
              <span>Brands</span>
            </div>

            {isEditing ? (
              <>
                {!showBrandInput && (
                  <Button3D onClick={() => setShowBrandInput(true)}>Add Brand</Button3D>
                )}

                {showBrandInput && (
                  <div className="inline-input">
                    <input
                      autoFocus
                      value={brandInput}
                      onChange={(e) =>
                        setBrandInput(
                          allowTextInput(brandInput, e.target.value, 50, 2)
                        )
                      }
                    />

                    <div className="actions">
                      <Button3D variant="cancel" onClick={() => {
                        setBrandInput("");
                        setShowBrandInput(false);
                      }}>Cancel</Button3D>

                      <Button3D onClick={() => {
                        if (!brandInput.trim()) return;

                        const id = `brand_${brandInput
                          .toLowerCase()
                          .replace(/\s+/g, "_")}`;

                        if (
                          localIngredient.brands?.some(
                            b => b.name.toLowerCase() === brandInput.toLowerCase()
                          )
                        ) {
                          toast.warning("Brand already exists");
                          return;
                        }

                        setLocalIngredient(prev => ({
                          ...prev,
                          brands: [...(prev.brands || []), { id, name: brandInput }]
                        }));

                        setBrandInput("");
                        setShowBrandInput(false);
                      }}>Add</Button3D>
                    </div>
                  </div>
                )}

                {localIngredient.brands?.length > 0 && (
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Brand</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localIngredient.brands.map((b, index) => (
                        <tr key={b.id}>
                          <td>{b.name}</td>
                          <td>
                            <div
                              className="ingredient-delete-btn"
                              onClick={() =>
                                setLocalIngredient(prev => ({
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
              </>
            ) : (
              <p>
                {localIngredient.brands?.length
                  ? localIngredient.brands.map(b => b.name).join(", ")
                  : "—"}
              </p>
            )}
          </div>
        </div>

        <div className="horizontal-form-group">
          {/* DESCRIPTION */}
          <div className="section">
            <div className="section-title">
              Description
            </div>

            {isEditing ? (
              <textarea
                value={localIngredient.description}
                onChange={(e) =>
                  setLocalIngredient({
                    ...localIngredient,
                    description: allowTextInput(localIngredient.description, e.target.value, 500, 100000)
                  })
                }
              />
            ) : (
              <p>{localIngredient.description}</p>
            )}
          </div>

          {/* HISTORY */}
          <div className="section">
            <div className="section-title">
              History
            </div>

            {isEditing ? (
              <textarea
                value={localIngredient.history}
                onChange={(e) =>
                  setLocalIngredient({
                    ...localIngredient,
                    history: allowTextInput(localIngredient.history, e.target.value, 500, 100000)
                  })
                }
              />
            ) : (
              <p>{localIngredient.history}</p>
            )}
          </div>
        </div>

        {/* USED IN */}
        <div className="section">
          <div className="section-title">
            <span>Used In</span>
          </div>

          {isEditing ? (
            <div className="checkbox-grid">
              {adminData.categories.length === 0 ? (
                <EmptyState message="No categories or dishes available yet" />
              ) : (
                adminData.categories.flatMap(cat => {

                if ((cat.subCategories || []).length > 0) {

                  return cat.subCategories.map(sub => (

                    <label key={sub.id} className="checkbox-item">

                      <input
                        type="checkbox"
                        checked={(localIngredient.usedInCategories || []).includes(sub.id)}
                        onChange={(e) => {

                          const updated = e.target.checked
                            ? [...(localIngredient.usedInCategories || []), sub.id]
                            : (localIngredient.usedInCategories || []).filter(
                              id => id !== sub.id
                            );

                          setLocalIngredient({
                            ...localIngredient,
                            usedInCategories: updated
                          });

                        }}
                      />

                      {sub.name}

                    </label>

                  ));

                }

                return (

                  <label key={cat.id} className="checkbox-item">

                    <input
                      type="checkbox"
                      checked={(localIngredient.usedInCategories || []).includes(cat.id)}
                      onChange={(e) => {

                        const updated = e.target.checked
                          ? [...(localIngredient.usedInCategories || []), cat.id]
                          : (localIngredient.usedInCategories || []).filter(
                            id => id !== cat.id
                          );

                        setLocalIngredient({
                          ...localIngredient,
                          usedInCategories: updated
                        });

                      }}
                    />

                    {cat.name}

                  </label>

                );

              })
              )}
            </div>
          ) : (
            <div className="tag-list">
              {(localIngredient.usedInCategories || []).length === 0 ? (
                <EmptyState message="Not used in any dish yet" />
              ) : (
                (localIngredient.usedInCategories || []).map((c) => {
                let label = null;

                for (const cat of adminData.categories) {

                  if (cat.id === c) {
                    label = cat.name;
                    break;
                  }

                  const sub = (cat.subCategories || []).find(s => s.id === c);

                  if (sub) {
                    label = sub.name;
                    break;
                  }

                }

                return (
                  <span key={c} className="tag">
                    {label || c}
                  </span>
                );
                })
              )}
            </div>
          )}
        </div>

        <div className="horizontal-form-group">
          <div className="section">
            <div className="section-title">
              <span>Stock & Visibility Info</span>
            </div>

            <table className="data-table">
              <tbody>
                <tr>
                  <td><strong>Disabled In</strong></td>
                  <td
                    style={{
                      fontWeight: 600,
                      color:
                        getDisabledInfo().type === "all"
                          ? "red"
                          : getDisabledInfo().type === "partial"
                            ? "#e6a700"
                            : "#888"
                    }}
                  >
                    {getDisabledInfo().label}
                  </td>
                </tr>

                <tr>
                  <td><strong>Expiry Date</strong></td>
                  <td
                    style={{
                      color: isExpiringSoon(localIngredient.expiryDate)
                        ? "red"
                        : "inherit",
                      fontWeight: isExpiringSoon(localIngredient.expiryDate)
                        ? 600
                        : 400
                    }}
                  >
                    {formatDisplayDate(localIngredient.expiryDate) || "—"}
                  </td>
                </tr>

                <tr>
                  <td><strong>Last Purchased</strong></td>
                  <td>{formatDisplayDate(localIngredient.lastUpdated) || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* NUTRITION TABLE */}
          <div className="section">
            <div className="section-title">
              <span>Nutrition per 100g</span>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Nutrition</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(localIngredient.nutritionPer100g).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={value}
                          onChange={(e) =>
                            setLocalIngredient({
                              ...localIngredient,
                              nutritionPer100g: {
                                ...localIngredient.nutritionPer100g,
                                [key]: Number(e.target.value)
                              }
                            })
                          }
                        />
                      ) : (
                        value
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* GLOBAL SAVE / CANCEL BAR */}
      {isEditing && (
        <div className="details-footer">
          <Button3D variant="cancel" onClick={resetEditState}>Cancel</Button3D>
          <Button3D onClick={() => saveIngredient(localIngredient)}>Save</Button3D>
        </div>
      )}
    </div>
  );
};

export default IngredientDetails;
