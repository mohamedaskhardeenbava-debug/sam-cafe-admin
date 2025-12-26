import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png"
import editIcon from "../icon/edit-icon.png"
import "./DishDetails.css";

const DishDetails = ({ adminData, setAdminData }) => {
    const { categoryId, dishId } = useParams();
    const navigate = useNavigate();

    const category = adminData.categories.find(c => c.id === categoryId);
    const dish = category?.dishes.find(d => d.id === dishId);

    const [localDish, setLocalDish] = useState(null);
    const [editSection, setEditSection] = useState(null);

    // TEMP buffer ONLY for ingredients editing
    const [editingIngredients, setEditingIngredients] = useState(null);

    useEffect(() => {
        if (dish) {
            setLocalDish(JSON.parse(JSON.stringify(dish)));
        }
    }, [dish]);

    if (!localDish) return <div className="page">Loading dish...</div>;

    /* ---------------- SAVE TO JSON ---------------- */
    const persistDish = async (updatedDish) => {
        const res = await api.get("/menu");

        const updatedMenu = {
            ...res.data,
            categories: res.data.categories.map(cat =>
                cat.id === categoryId
                    ? {
                        ...cat,
                        dishes: cat.dishes.map(d =>
                            d.id === dishId ? updatedDish : d
                        )
                    }
                    : cat
            )
        };

        await api.put("/menu", updatedMenu);

        setAdminData(prev => ({
            ...prev,
            categories: updatedMenu.categories
        }));

        setLocalDish(updatedDish);
        setEditSection(null);
        setEditingIngredients(null);
    };

    /* ---------------- INGREDIENT CRUD (SAFE) ---------------- */

    const startIngredientEdit = () => {
        setEditingIngredients(
            JSON.parse(JSON.stringify(localDish.ingredients))
        );
        setEditSection("ingredients");
    };

    const addIngredient = () => {
        setEditingIngredients(prev => [
            ...prev,
            { name: "", quantity: "", calories: 0 }
        ]);
    };

    const deleteIngredient = (index) => {
        setEditingIngredients(prev =>
            prev.filter((_, i) => i !== index)
        );
    };

    const cancelIngredientEdit = () => {
        setEditingIngredients(null);
        setEditSection(null);
    };

    const saveIngredientEdit = async () => {
        const updatedDish = {
            ...localDish,
            ingredients: editingIngredients
        };
        await persistDish(updatedDish);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onloadend = () => {
            setLocalDish((prev) => ({
                ...prev,
                image: reader.result
            }));
        };

        reader.readAsDataURL(file);
    };


    /* ---------------- UI ---------------- */

    return (
        <div className="dish-details-page">
            <div className="dish-container">

                <div className="dish-header">
                    <button className="back-btn" onClick={() => navigate(-1)}></button>
                    <h2>{localDish.name}</h2>
                </div>

                <div className="dish-details-image">

                    <img
                        src={localDish.image || "/placeholder.png"}
                        alt={localDish.name}
                    />

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
                        <span>Name: </span>
                        {editSection === "name" ? (
                            <>
                                <input
                                    value={localDish.name}
                                    onChange={e =>
                                        setLocalDish({ ...localDish, name: e.target.value })
                                    }
                                />
                                <div className="action">
                                    <button onClick={() => persistDish(localDish)}>Save</button>
                                    <button onClick={() => setEditSection(null)}>Cancel</button>
                                </div>
                            </>
                        ) : (
                            <p>{localDish.name}</p>
                        )}
                        <img className="edit-icon" onClick={() => setEditSection("name")} src={editIcon} />
                    </div>


                </div>

                {/* PRICE */}
                <div className="section">
                    <div className="section-title">
                        <span>Base Price: </span>
                        {editSection === "price" ? (
                            <>
                                <input
                                    type="number"
                                    value={localDish.basePrice}
                                    onChange={e =>
                                        setLocalDish({
                                            ...localDish,
                                            basePrice: Number(e.target.value)
                                        })
                                    }
                                />
                                <div className="action">
                                    <button onClick={() => persistDish(localDish)}>Save</button>
                                    <button onClick={() => setEditSection(null)}>Cancel</button>
                                </div>
                            </>
                        ) : (
                            <p>₹{localDish.basePrice}</p>
                        )}
                        <img className="edit-icon" onClick={() => setEditSection("price")} src={editIcon} />
                    </div>


                </div>

                {/* DESCRIPTION */}
                <div className="section">
                    <div className="section-title">
                        <span>Description</span>
                        <img className="edit-icon" onClick={() => setEditSection("description")} src={editIcon} />
                    </div>

                    {editSection === "description" ? (
                        <>
                            <textarea
                                value={localDish.description}
                                onChange={e =>
                                    setLocalDish({
                                        ...localDish,
                                        description: e.target.value
                                    })
                                }
                            />
                            <div className="actions">
                                <button onClick={() => persistDish(localDish)}>Save</button>
                                <button onClick={() => setEditSection(null)}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <p>{localDish.description}</p>
                    )}
                </div>

                {/* BENEFITS TABLE */}
                <div className="section">
                    <div className="section-title">
                        <span>Benefits</span>
                        <img className="edit-icon" onClick={() => setEditSection("benefits")} src={editIcon} />
                    </div>

                    <table className="data-table">
                        <tbody>
                            {Object.entries(localDish.benefits).map(([k, v]) => (
                                <tr key={k}>
                                    <td>{k}</td>
                                    <td>
                                        {editSection === "benefits" ? (
                                            <input
                                                type="number"
                                                value={v}
                                                onChange={e =>
                                                    setLocalDish({
                                                        ...localDish,
                                                        benefits: {
                                                            ...localDish.benefits,
                                                            [k]: Number(e.target.value)
                                                        }
                                                    })
                                                }
                                            />
                                        ) : (
                                            v
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {editSection === "benefits" && (
                        <div className="actions">
                            <button onClick={() => persistDish(localDish)}>Save</button>
                            <button onClick={() => setEditSection(null)}>Cancel</button>
                        </div>
                    )}
                </div>

                {/* INGREDIENTS TABLE */}
                <div className="section">
                    <div className="section-title with-action">
                        <span>Ingredients</span>
                        <img className="edit-icon" onClick={startIngredientEdit} src={editIcon} />
                    </div>

                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Quantity (in grams)</th>
                                    <th>Calories</th>
                                    {editSection === "ingredients" && <th />}
                                </tr>
                            </thead>
                            <tbody>
                                {(editSection === "ingredients"
                                    ? editingIngredients
                                    : localDish.ingredients
                                ).map((ing, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            {editSection === "ingredients" ? (
                                                <input
                                                    value={ing.name}
                                                    onChange={e => {
                                                        const copy = [...editingIngredients];
                                                        copy[idx].name = e.target.value;
                                                        setEditingIngredients(copy);
                                                    }}
                                                />
                                            ) : ing.name}
                                        </td>

                                        <td>
                                            {editSection === "ingredients" ? (
                                                <input
                                                    value={ing.quantity}
                                                    onChange={e => {
                                                        const copy = [...editingIngredients];
                                                        copy[idx].quantity = e.target.value;
                                                        setEditingIngredients(copy);
                                                    }}
                                                />
                                            ) : ing.quantity}
                                        </td>

                                        <td>
                                            {editSection === "ingredients" ? (
                                                <input
                                                    type="number"
                                                    value={ing.calories}
                                                    onChange={e => {
                                                        const copy = [...editingIngredients];
                                                        copy[idx].calories = Number(e.target.value);
                                                        setEditingIngredients(copy);
                                                    }}
                                                />
                                            ) : ing.calories}
                                        </td>

                                        {editSection === "ingredients" && (
                                            <td>
                                                <img
                                                    className="delete-icon"
                                                    src={deleteIcon}
                                                    onClick={() => deleteIngredient(idx)}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {editSection === "ingredients" && (
                        <div className="actions">
                            <button onClick={addIngredient}>+ Add</button>
                            <button onClick={saveIngredientEdit}>Save</button>
                            <button onClick={cancelIngredientEdit}>Cancel</button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DishDetails;
