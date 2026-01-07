import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import editIcon from "../icon/edit-icon.png";
import "./IngredientDetails.css";
import { allowTextInput } from "../App";

const IngredientDetails = ({ adminData, setAdminData, toCamelCase, generateIdFromName }) => {
    const { ingredientId } = useParams();
    const navigate = useNavigate();

    const ingredient = adminData.ingredients.find(
        (ing) => ing.id === ingredientId
    );

    const [localIngredient, setLocalIngredient] = useState(null);
    const [editSection, setEditSection] = useState(null);

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
        const newIngredientId = generateIdFromName(updated.name);

        const res = await api.get("/menu");

        const updatedMenu = {
            ...res.data,
            ingredients: res.data.ingredients.map((ing) =>
                ing.id === ingredientId
                    ? { ...updated, id: newIngredientId }
                    : ing
            )
        };

        await api.put("/menu", updatedMenu);

        setAdminData({ ...updatedMenu });
        setEditSection(null);
        setLocalIngredient(
            JSON.parse(JSON.stringify({ ...updated, id: newIngredientId }))
        );
        navigate(`/ingredients/${newIngredientId}`, { replace: true });
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onloadend = () => {
            setAdminData((prev) => ({
                ...prev,
                image: reader.result
            }));
        };

        reader.readAsDataURL(file);
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
                                {adminData.categories.map((cat) => (
                                    <label key={cat.id} className="checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={localIngredient.usedInCategories.includes(cat.id)}
                                            onChange={(e) => {
                                                const updated = e.target.checked
                                                    ? [...localIngredient.usedInCategories, cat.id]
                                                    : localIngredient.usedInCategories.filter(
                                                        (c) => c !== cat.id
                                                    );

                                                setLocalIngredient({
                                                    ...localIngredient,
                                                    usedInCategories: updated
                                                });
                                            }}
                                        />
                                        {cat.name}
                                    </label>
                                ))}
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
                                const cat = adminData.categories.find((x) => x.id === c);
                                return (
                                    <span key={c} className="tag">
                                        {cat?.name || c}
                                    </span>
                                );
                            })}
                        </div>
                    )}
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