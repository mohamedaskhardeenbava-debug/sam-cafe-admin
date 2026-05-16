import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import deleteIcon from "../icon/delete-icon.png"
import editIcon from "../icon/edit-icon.png"
import "./DishDetails.css";
import { allowTextInput } from "../App";
import { resolveCategoryAndSubCategory } from "../App"

const DishDetails = ({ adminData, setAdminData, toCamelCase, generateIdFromName, handleBack }) => {
    const { categoryId, dishId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const orderItem = location.state?.orderItem || null;
    const fromOrder = location.state?.fromOrder === true;

    let category = adminData.categories.find(c => c.id === categoryId);
    let subCategory = null;

    if (!category) {

        for (const cat of adminData.categories) {

            const found = (cat.subCategories || []).find(
                sub => sub.id === categoryId
            );

            if (found) {
                category = cat;
                subCategory = found;
                break;
            }

        }

    }

    let dish = category?.dishes?.find(d => d.id === dishId);

    if (!dish && category?.subCategories) {
        for (const sub of category.subCategories) {
            const found = sub.dishes?.find(d => d.id === dishId);
            if (found) {
                dish = found;
                break;
            }
        }
    }

    const [openIngredientDropdown, setOpenIngredientDropdown] = useState(false);
    const [localDish, setLocalDish] = useState(null);
    const [editSection, setEditSection] = useState(null);

    // TEMP buffer ONLY for ingredients editing
    const [editingIngredients, setEditingIngredients] = useState(null);

    const disabledIngredientsForThisDish = adminData.ingredients
        .filter(ing =>
            ing.isDisabledGlobally === true ||
            (ing.disabledForDishes || []).includes(dishId)
        )
        .map(ing => ing.name);

    useEffect(() => {
        if (dish) {
            setLocalDish(JSON.parse(JSON.stringify(dish)));
        }
    }, [dish]);

    useEffect(() => {
        const closeDropdowns = () => {
            setOpenIngredientDropdown(false);
        };

        window.addEventListener("click", closeDropdowns);
        return () => window.removeEventListener("click", closeDropdowns);
    }, []);

    if (!localDish) return <div className="page">Loading dish...</div>;

    /* ---------------- SAVE TO JSON ---------------- */
    const persistDish = async (updatedDish) => {

        const newDishId = dishId;

        let duplicate;

        if (subCategory) {

            duplicate = (subCategory.dishes || []).some(
                d =>
                    d.id !== dishId &&
                    d.name.trim().toLowerCase() ===
                    updatedDish.name.trim().toLowerCase()
            );

        } else {

            duplicate = (category.dishes || []).some(
                d =>
                    d.id !== dishId &&
                    d.name.trim().toLowerCase() ===
                    updatedDish.name.trim().toLowerCase()
            );

        }

        if (duplicate) {
            alert("Another dish with this name already exists in this category");
            return;
        }

        let updatedCategory;

        if (subCategory) {

            updatedCategory = {
                ...category,
                subCategories: (category.subCategories || []).map(sub => {

                    if (sub.id !== subCategory.id) return sub;

                    return {
                        ...sub,
                        dishes: (sub.dishes || []).map(d =>
                            d.id === dishId
                                ? { ...d, ...updatedDish, id: newDishId }
                                : d
                        )
                    };

                })
            };

        } else {

            updatedCategory = {
                ...category,
                dishes: (category.dishes || []).map(d =>
                    d.id === dishId
                        ? { ...d, ...updatedDish, id: newDishId }
                        : d
                )
            };

        }

        try {

            await api.put(`/categories/${category.id}`, updatedCategory);

            setAdminData(prev => ({
                ...prev,
                categories: prev.categories.map(cat =>
                    cat.id === category.id ? updatedCategory : cat
                )
            }));

            setEditSection(null);
            setEditingIngredients(null);

            setLocalDish(JSON.parse(JSON.stringify({
                ...updatedDish,
                id: newDishId
            })));

            navigate(`/dishes/${categoryId}/${newDishId}`, { replace: true });

        } catch (err) {
            console.error("Failed to update dish", err);
        }
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
            { name: "", quantity: 0 }
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

        reader.onloadend = async () => {

            const updatedDish = {
                ...localDish,
                image: reader.result
            };

            setLocalDish(updatedDish);

            // SAVE TO JSON
            await persistDish(updatedDish);

        };

        reader.readAsDataURL(file);
    };

    const ingredientsToDisplay =
        fromOrder && orderItem?.ingredients?.length > 0
            ? orderItem.ingredients
            : (localDish?.ingredients || []);

    const displayDishName =
        fromOrder && orderItem?.isCustomized
            ? orderItem.dishName
            : localDish?.name;

    const displayPrice =
        fromOrder && orderItem?.isCustomized
            ? orderItem.totalPrice
            : localDish?.basePrice;

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

    const sortedIngredients = [...adminData.ingredients].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    return (
        <div className="dish-details-page">
            <div className="dish-container">

                <div className="dish-details-header">
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
                            <input
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={handleImageUpload}
                            />
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

                {/* VEG / NON-VEG */}
                <div className="section">
                    <div className="section-title">
                        <span>Type</span>
                        {!fromOrder && editSection !== "vegType" && (
                            <img
                                className="edit-icon"
                                onClick={() => setEditSection("vegType")}
                                src={editIcon}
                            />
                        )}
                    </div>

                    {editSection === "vegType" ? (
                        <>
                            <div className="veg-toggle-group" style={{ marginTop: 8 }}>
                                <button
                                    type="button"
                                    className={`veg-toggle-btn${localDish.isVeg !== false ? " active-veg" : ""}`}
                                    onClick={() => setLocalDish({ ...localDish, isVeg: true })}
                                >
                                    <span className="veg-dot veg" /> Veg
                                </button>
                                <button
                                    type="button"
                                    className={`veg-toggle-btn${localDish.isVeg === false ? " active-non-veg" : ""}`}
                                    onClick={() => setLocalDish({ ...localDish, isVeg: false })}
                                >
                                    <span className="veg-dot non-veg" /> Non-Veg
                                </button>
                            </div>
                            <div className="actions">
                                <button onClick={() => persistDish(localDish)}>Save</button>
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <span className={`veg-badge ${localDish.isVeg === false ? "non-veg" : "veg"}`} style={{ marginTop: 8, display: "inline-flex" }}>
                            {localDish.isVeg === false ? "Non-Veg" : "Veg"}
                        </span>
                    )}
                </div>

                {/* EVENT FOOD */}
                <div className="section">
                    <div className="section-title">
                        <span>Event Food</span>
                        {!fromOrder && editSection !== "eventFood" && (
                            <img
                                className="edit-icon"
                                onClick={() => setEditSection("eventFood")}
                                src={editIcon}
                            />
                        )}
                    </div>

                    {editSection === "eventFood" ? (
                        <>
                            <div className="veg-toggle-group" style={{ marginTop: 8 }}>
                                <button
                                    type="button"
                                    className={`veg-toggle-btn${localDish.isEventFood ? " active-veg" : ""}`}
                                    onClick={() => setLocalDish({ ...localDish, isEventFood: true })}
                                >
                                    <span className="veg-dot veg" /> Yes
                                </button>
                                <button
                                    type="button"
                                    className={`veg-toggle-btn${!localDish.isEventFood ? " active-non-veg" : ""}`}
                                    onClick={() => setLocalDish({ ...localDish, isEventFood: false })}
                                >
                                    <span className="veg-dot non-veg" /> No
                                </button>
                            </div>
                            <div className="actions">
                                <button onClick={() => persistDish(localDish)}>Save</button>
                                <button onClick={resetEditState}>Cancel</button>
                            </div>
                        </>
                    ) : (
                        <span className={`veg-badge ${localDish.isEventFood ? "veg" : "non-veg"}`} style={{ marginTop: 8, display: "inline-flex" }}>
                            {localDish.isEventFood ? "Yes" : "No"}
                        </span>
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
                {/* INGREDIENTS */}
                <div className="section">

                    <div className="section-title">
                        <span>Ingredients</span>

                        {!fromOrder && editSection !== "ingredients" && (
                            <img
                                className="edit-icon"
                                src={editIcon}
                                alt=""
                                onClick={startIngredientEdit}
                            />
                        )}
                    </div>

                    {editSection === "ingredients" ? (

                        <>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Qty (g)</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {editingIngredients.map((ing, index) => {

                                        const isNew = !ing.name;

                                        return (
                                            <tr key={index}>

                                                <td>

                                                    {isNew ? (

                                                        <div className="dishes-dropdown-wrapper">
                                                            <button
                                                                type="button"
                                                                className="dishes-status-dropdown"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenIngredientDropdown(prev => !prev);
                                                                }}
                                                            >
                                                                {editingIngredients?.[index]?.name || "Select Ingredient"}
                                                            </button>

                                                            {openIngredientDropdown && (
                                                                <div className="dishes-dropdown-menu">
                                                                    {sortedIngredients.map(ing => (
                                                                        <div
                                                                            key={ing.id}
                                                                            onClick={() => {
                                                                                const updated = [...editingIngredients];
                                                                                updated[index].name = ing.name;
                                                                                setEditingIngredients(updated);
                                                                                setOpenIngredientDropdown(false);
                                                                            }}
                                                                        >
                                                                            {ing.name}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                    ) : (

                                                        <span>{ing.name}</span>

                                                    )}

                                                </td>

                                                <td>

                                                    <input
                                                        id={`qty-${index}`}
                                                        type="number"
                                                        min="0"
                                                        value={ing.quantity}
                                                        onChange={(e) => {

                                                            const updated = [...editingIngredients];
                                                            updated[index].quantity = Number(e.target.value);

                                                            setEditingIngredients(updated);

                                                        }}
                                                    />

                                                </td>

                                                <td>

                                                    <div
                                                        className="ingredient-delete-btn"
                                                        onClick={() => deleteIngredient(index)}
                                                    >
                                                        <img src={deleteIcon} alt="" />
                                                    </div>

                                                </td>

                                            </tr>
                                        );

                                    })}

                                </tbody>
                            </table>

                            <button
                                className="add-ingredient-button"
                                onClick={addIngredient}
                            >
                                + Add Ingredient
                            </button>

                            <div className="actions">

                                <button onClick={saveIngredientEdit}>
                                    Save
                                </button>

                                <button onClick={cancelIngredientEdit}>
                                    Cancel
                                </button>

                            </div>

                        </>

                    ) : (

                        ingredientsToDisplay.length === 0 ? (
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
                        )

                    )}

                </div>

                {disabledIngredientsForThisDish.length > 0 && (
                    <div className="section">
                        <div className="section-title">
                            <span>Disabled Ingredients For This Dish</span>
                        </div>

                        <p
                            style={{
                                color: "red",
                                fontWeight: 600
                            }}
                        >
                            {disabledIngredientsForThisDish.join(", ")}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DishDetails;