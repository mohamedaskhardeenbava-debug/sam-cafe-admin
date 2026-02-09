import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png"
import editIcon from "../icon/edit-icon.png"
import "./DishDetails.css";
import { allowTextInput } from "../App";

const DishDetails = ({ adminData, setAdminData, toCamelCase, generateIdFromName, handleBack }) => {
    const { categoryId, dishId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const orderItem = location.state?.orderItem || null;
    const fromOrder = location.state?.fromOrder === true;

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

    // HANDLE MAKE YOUR OWN / CUSTOM DISH
    if (dishId === "__custom__" && orderItem) {
        return (
            <div className="dish-details-page">
                <div className="dish-container">
                    <div className="dish-header">
                        <button
                            className="back-btn"
                            onClick={() => navigate(-1)}
                        />
                        <h2>{orderItem.dishName}</h2>
                    </div>

                    <p><strong>Category:</strong> {orderItem.categoryId}</p>
                    <p><strong>Size:</strong> {orderItem.selectedSize}</p>
                    <p><strong>Price:</strong> ₹{orderItem.totalPrice}</p>

                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Ingredient</th>
                                <th>Qty (g)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderItem.ingredients.map((ing, i) => (
                                <tr key={i}>
                                    <td>{ing.name}</td>
                                    <td>{ing.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (!localDish) return <div className="page">Loading dish...</div>;

    /* ---------------- SAVE TO JSON ---------------- */
    const persistDish = async (updatedDish) => {
        const newDishId = generateIdFromName(updatedDish.name);

        const duplicate = category.dishes.some(
            d =>
                d.id !== dishId &&
                d.name.trim().toLowerCase() ===
                updatedDish.name.trim().toLowerCase()
        );

        if (duplicate) {
            alert("Another dish with this name already exists in this category");
            return;
        }

        const res = await api.get("/menu");

        const updatedMenu = {
            ...res.data,
            categories: res.data.categories.map(cat =>
                cat.id === categoryId
                    ? {
                        ...cat,
                        dishes: cat.dishes.map(d =>
                            d.id === dishId
                                ? { ...updatedDish, id: newDishId }
                                : d
                        )
                    }
                    : cat
            )
        };

        await api.put("/menu", updatedMenu);

        setAdminData({ ...updatedMenu });

        setEditSection(null);
        setEditingIngredients(null);
        setLocalDish(JSON.parse(JSON.stringify({ ...updatedDish, id: newDishId })));
        navigate(`/dishes/${categoryId}/${newDishId}`, { replace: true });
    };

    /* ---------------- INGREDIENT CRUD ---------------- */

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

    const resetEditState = () => {
        setEditSection(null);
        setEditingIngredients(null);

        // Reset localDish back to persisted dish
        if (dish) {
            setLocalDish(JSON.parse(JSON.stringify(dish)));
        }
    };

    const cancelIngredientEdit = resetEditState;

    const saveIngredientEdit = async () => {
        const updatedDish = {
            ...localDish,
            ingredients: editingIngredients
        };

        await persistDish(updatedDish);
        setEditSection(null);
        setEditingIngredients(null);
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

    const ingredientsToDisplay =
        fromOrder && orderItem?.ingredients?.length > 0
            ? orderItem.ingredients
            : localDish.ingredients;

    const displayDishName =
        fromOrder && orderItem?.isCustomized
            ? orderItem.dishName
            : localDish.name;

    const displayPrice =
        fromOrder && orderItem?.isCustomized
            ? orderItem.totalPrice
            : localDish.basePrice;

    if (dishId === "__custom__" && orderItem) {
        return (
            <div className="dish-details-page">
                <div className="dish-container">
                    <button className="back-btn" onClick={() => navigate(-1)} />
                    <h2>{orderItem.dishName}</h2>

                    {/* INGREDIENTS FROM ORDER */}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderItem.ingredients.map((ing, i) => (
                                <tr key={i}>
                                    <td>{ing.name}</td>
                                    <td>{ing.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="dish-details-page">
            <div className="dish-container">

                <div className="dish-header">
                    <button
                        type="button"
                        className="back-btn"
                        onClick={() => {
                            resetEditState();
                            navigate(-1);
                        }}
                    ></button>
                    <h2>{displayDishName}</h2>
                </div>

                <div className="dish-details-image">

                    <img
                        src={localDish.image || "/placeholder.png"}
                        alt={localDish.name}
                    />

                    {!fromOrder && (
                        <label className="image-upload-btn">
                            Change Image
                            <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                        </label>
                    )}
                </div>


                {/* NAME */}
                <div className="section">
                    <div className="section-title">
                        <span>Name: </span>
                        {editSection === "name" ? (
                            <>
                                <input
                                    autoFocus
                                    value={localDish.name}
                                    onChange={(e) =>
                                        setLocalDish((prev) => ({
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
                                        setLocalDish((prev) => ({
                                            ...prev,
                                            name: toCamelCase(e.target.value)
                                        }))
                                    }

                                />
                                <div className="action">
                                    <button onClick={() => persistDish(localDish)}>Save</button>
                                    <button onClick={resetEditState}>Cancel</button>
                                </div>
                            </>
                        ) : (
                            <p>{localDish.name}</p>
                        )}
                        {!fromOrder && (
                            <img
                                className="edit-icon"
                                onClick={() => setEditSection("name")}
                                src={editIcon}
                            />
                        )}
                    </div>


                </div>

                {/* NOTES (FROM ORDER) */}
                {fromOrder && (
                    <div className="section">
                        <div className="section-title">
                            <span>Notes</span>
                        </div>

                        <p>
                            {orderItem?.notes?.trim()
                                ? orderItem.notes
                                : "-"}
                        </p>
                    </div>
                )}

                {/* PRICE */}
                <div className="section">
                    <div className="section-title">
                        <span>Base Price: </span>
                        {editSection === "price" ? (
                            <>
                                <input
                                    autoFocus
                                    type="number"
                                    min="1"
                                    step="1"
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
                                    <button onClick={resetEditState}>Cancel</button>
                                </div>
                            </>
                        ) : (
                            <p>₹{displayPrice}</p>
                        )}
                        {!fromOrder && (<img className="edit-icon" onClick={() => setEditSection("price")} src={editIcon} />)}
                    </div>


                </div>

                {/* DESCRIPTION */}
                <div className="section">
                    <div className="section-title">
                        <span>Description</span>
                        {!fromOrder && (<img className="edit-icon" onClick={() => setEditSection("description")} src={editIcon} />)}
                    </div>

                    {editSection === "description" ? (
                        <>
                            <textarea
                                autoFocus
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
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <p>{localDish.description}</p>
                    )}
                </div>

                {/* BENEFITS TABLE */}
                {/* BENEFITS TABLE (HIDE FOR CUSTOMIZED ORDER DISH) */}
                {!(fromOrder && orderItem?.isCustomized) && (
                    <div className="section">
                        <div className="section-title">
                            <span>Benefits</span>
                            {!fromOrder && (<img
                                className="edit-icon"
                                onClick={() => setEditSection("benefits")}
                                src={editIcon}
                            />)}
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
                                                    min="1"
                                                    step="1"
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
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        )}
                    </div>
                )}

                {/* INGREDIENTS TABLE */}
                <div className="section">
                    <div className="section-title">
                        <span>Ingredients</span>
                    </div>

                    {ingredientsToDisplay.length === 0 ? (
                        <p>No ingredients available</p>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Qty (g)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ingredientsToDisplay.map((ing, index) => (
                                    <tr key={index}>
                                        <td>{ing.name}</td>
                                        <td>{ing.quantity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DishDetails;