import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import "./IngredientDetails.css";
import { allowTextInput } from "../App";
import deleteIcon from "../icon/delete-icon.png";
import { formatDisplayDate } from "../App"

const IngredientDetails = ({ adminData, setAdminData, toCamelCase, generateIdFromName }) => {
    const { ingredientId } = useParams();
    const navigate = useNavigate();

    const ingredient = adminData.ingredients?.find(
        (ing) => ing.id === ingredientId
    );

    const [localIngredient, setLocalIngredient] = useState(null);
    const [editSection, setEditSection] = useState(null);
    const [showBrandInput, setShowBrandInput] = useState(false);
    const [brandInput, setBrandInput] = useState("");

    useEffect(() => {
        if (ingredient) {
            setLocalIngredient(JSON.parse(JSON.stringify(ingredient)));
        }
    }, [ingredient]);

    const resetEditState = () => {
        setEditSection(null);

        // Revert unsaved changes
        if (ingredient) {
            setLocalIngredient(JSON.parse(JSON.stringify(ingredient)));
        }
    };

    if (!localIngredient) {
        return <div className="page">Loading ingredient...</div>;
    }

    /* ---------------- SAVE TO JSON ---------------- */
    const saveIngredient = async (updated) => {

        const oldId = ingredient.id;   // always use actual ingredient
        const newId = generateIdFromName(updated.name);

        const payload = {
            ...updated,
            id: newId
        };

        try {

            if (oldId !== newId) {

                // remove old
                await api.delete(`/ingredients/${oldId}`);

                // create new
                await api.post(`/ingredients`, payload);

            } else {

                // update existing
                await api.put(`/ingredients/${oldId}`, payload);

            }

            // update local state
            setAdminData(prev => ({
                ...prev,
                ingredients: prev.ingredients
                    .filter(i => i.id !== oldId)
                    .concat(payload)
            }));

            setLocalIngredient(payload);
            setEditSection(null);

            // update route if id changed
            if (oldId !== newId) {
                navigate(`/ingredients/${newId}`, { replace: true });
            }

        } catch (err) {
            console.error("Ingredient update failed:", err);
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
        <div className="ingredient-details-page">

            <div className="ingredient-container">
                {/* HEADER */}
                <div className="ingredient-details-header">
                    <button
                        className="back-btn"
                        onClick={() => {
                            resetEditState();
                            navigate(-1);
                        }}
                    />
                    <h2>{localIngredient.name}</h2>
                </div>

                {/* CARD */}

                {/* IMAGE */}
                <div className="ingredient-details-image">
                    <img src={localIngredient.image} alt={localIngredient.name} />
                    <label className="image-upload-btn">
                        Change Image
                        <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => handleImageUpload(e)}
                        />
                    </label>
                </div>

                {/* NAME */}
                <div className="section">
                    <div className="section-title">
                        <span>
                            Name:
                        </span>
                        {editSection === "name" ? (
                            <div className="edit-row">
                                <input
                                    autoFocus
                                    value={localIngredient.name}
                                    onChange={(e) =>
                                        setLocalIngredient((prev) => ({
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
                                        setLocalIngredient((prev) => ({
                                            ...prev,
                                            name: toCamelCase(e.target.value)
                                        }))
                                    }

                                />
                                <div className="action">
                                    <button onClick={() => saveIngredient(localIngredient)}>Save</button>
                                    <button onClick={resetEditState}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <p>{localIngredient.name}</p>
                        )}
                        <img
                            className="edit-icon"
                            src={editIcon}
                            alt="edit"
                            onClick={() => setEditSection("name")}
                        />
                    </div>
                </div>

                <div className="section">
                    <div className="section-title">
                        <span>Brands</span>
                        <img
                            className="edit-icon"
                            src={editIcon}
                            alt="edit"
                            onClick={() => setEditSection("brands")}
                        />
                    </div>

                    {editSection === "brands" ? (
                        <>
                            {!showBrandInput && (
                                <button
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
                                        value={brandInput}
                                        onChange={(e) =>
                                            setBrandInput(
                                                allowTextInput(brandInput, e.target.value, 50, 2)
                                            )
                                        }
                                    />

                                    <div className="actions">
                                        <button
                                            onClick={() => {
                                                if (!brandInput.trim()) return;

                                                const id = `brand_${brandInput
                                                    .toLowerCase()
                                                    .replace(/\s+/g, "_")}`;

                                                if (
                                                    localIngredient.brands?.some(
                                                        b => b.name.toLowerCase() === brandInput.toLowerCase()
                                                    )
                                                ) {
                                                    alert("Brand already exists");
                                                    return;
                                                }

                                                setLocalIngredient(prev => ({
                                                    ...prev,
                                                    brands: [...(prev.brands || []), { id, name: brandInput }]
                                                }));

                                                setBrandInput("");
                                                setShowBrandInput(false);
                                            }}
                                        >
                                            Add
                                        </button>

                                        <button
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

                            {localIngredient.brands?.length > 0 && (
                                <table className="ingredient-detail-table">
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

                            <div className="actions">
                                <button onClick={() => saveIngredient(localIngredient)}>
                                    Save
                                </button>
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <p>
                            {localIngredient.brands?.length
                                ? localIngredient.brands.map(b => b.name).join(", ")
                                : "-"}
                        </p>
                    )}
                </div>

                {/* USED IN */}
                <div className="section">
                    <div className="section-title">
                        <span>Used In</span>
                        <img
                            className="edit-icon"
                            src={editIcon}
                            alt="edit"
                            onClick={() => setEditSection("usedIn")}
                        />
                    </div>

                    {editSection === "usedIn" ? (
                        <>
                            <div className="checkbox-grid">
                                {adminData.categories.flatMap(cat => {

                                    if ((cat.subCategories || []).length > 0) {

                                        return cat.subCategories.map(sub => (

                                            <label key={sub.id} className="checkbox-item">

                                                <input
                                                    type="checkbox"
                                                    checked={(localIngredient.usedInCategories || []).includes(sub.id)}
                                                    onChange={(e) => {

                                                        const updated = e.target.checked
                                                            ? [...localIngredient.usedInCategories, sub.id]
                                                            : localIngredient.usedInCategories.filter(
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
                                                        ? [...localIngredient.usedInCategories, cat.id]
                                                        : localIngredient.usedInCategories.filter(
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

                                })}
                            </div>

                            <div className="actions">
                                <button onClick={() => saveIngredient(localIngredient)}>
                                    Save
                                </button>
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <div className="tag-list">
                            {localIngredient.usedInCategories.map((c) => {
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
                            })}
                        </div>
                    )}
                </div>

                <div className="section">
                    <div className="section-title">
                        <span>Stock & Visibility Info</span>
                    </div>

                    <table className="stock-visibility-table">
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
                                    {formatDisplayDate(localIngredient.expiryDate) || "-"}
                                </td>
                            </tr>

                            <tr>
                                <td><strong>Last Purchased</strong></td>
                                <td>{formatDisplayDate(localIngredient.lastUpdated) || "-"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* NUTRITION TABLE */}
                <div className="section">
                    <div className="section-title">
                        <span>Nutrition per 100g</span>
                        <img
                            className="edit-icon"
                            src={editIcon}
                            alt="edit"
                            onClick={() => setEditSection("nutrition")}
                        />
                    </div>

                    <table className="data-table">
                        <tbody>
                            {Object.entries(localIngredient.nutritionPer100g).map(([key, value]) => (
                                <tr key={key}>
                                    <td>{key}</td>
                                    <td>
                                        {editSection === "nutrition" ? (
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

                    {editSection === "nutrition" && (
                        <div className="actions">
                            <button onClick={() => saveIngredient(localIngredient)}>
                                Save
                            </button>
                            <button onClick={resetEditState}>Cancel</button>
                        </div>
                    )}
                </div>


                {/* DESCRIPTION */}
                <div className="section">
                    <div className="section-title">
                        Description
                        <img
                            className="edit-icon"
                            src={editIcon}
                            alt="edit"
                            onClick={() => setEditSection("description")}
                        />
                    </div>

                    {editSection === "description" ? (
                        <div className="edit-row">
                            <textarea
                                autoFocus
                                value={localIngredient.description}
                                onChange={(e) =>
                                    setLocalIngredient({
                                        ...localIngredient,
                                        description: e.target.value
                                    })
                                }
                            />
                            <div className="actions">
                                <button onClick={() => saveIngredient(localIngredient)}>Save</button>
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <p>{localIngredient.description}</p>
                    )}
                </div>

                {/* HISTORY */}
                <div className="section">
                    <div className="section-title">
                        History
                        <img
                            className="edit-icon"
                            src={editIcon}
                            alt="edit"
                            onClick={() => setEditSection("history")}
                        />
                    </div>

                    {editSection === "history" ? (
                        <div className="edit-row">
                            <textarea
                                autoFocus
                                value={localIngredient.history}
                                onChange={(e) =>
                                    setLocalIngredient({
                                        ...localIngredient,
                                        history: e.target.value
                                    })
                                }
                            />
                            <div className="actions">
                                <button onClick={() => saveIngredient(localIngredient)}>Save</button>
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <p>{localIngredient.history}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IngredientDetails;