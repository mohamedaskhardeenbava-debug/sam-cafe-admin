// import React, { useState, useEffect } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import "./Dishes.css";
// import api from "../api";
// import Categories from "./Categories";

// const Dishes = ({ adminData, setAdminData }) => {
//   const [dishImagePreview, setDishImagePreview] = useState("");
//   const [selectedCategoryId, setSelectedCategoryId] = useState("");
//   const [editingDish, setEditingDish] = useState(null);
//   const [editingDishId, setEditingDishId] = useState(null);
//   const [editedPrice, setEditedPrice] = useState("");
//   const [showForm, setShowForm] = useState(false);
//   const [newDish, setNewDish] = useState({
//     name: "",
//     image: "",
//     basePrice: "",
//     description: "",
//     benefits: {
//       calories: "",
//       protein: "",
//       fibre: "",
//       fat: ""
//     },
//     ingredients: ""
//   });

//   const { categoryId } = useParams();
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (adminData.categories.length === 0) return;

//     if (categoryId) {
//       const exists = adminData.categories.some(
//         (cat) => cat.id === categoryId
//       );

//       if (exists) {
//         setSelectedCategoryId(categoryId);
//         return;
//       }
//     }

//     setSelectedCategoryId(adminData.categories[0].id);
//   }, [adminData.categories, categoryId]);

//   const selectedCategory = adminData.categories.find(
//     (cat) => cat.id === selectedCategoryId
//   );

//   const handleSaveDish = async () => {
//     if (!newDish.name || !newDish.basePrice) {
//       alert("Dish name and base price are required");
//       return;
//     }

//     const dishPayload = {
//       id: editingDish
//         ? editingDish.id
//         : `${selectedCategoryId}_${Date.now()}`,
//       name: newDish.name,
//       image: newDish.image,
//       basePrice: Number(newDish.basePrice),
//       description: newDish.description,
//       benefits: {
//         calories: Number(newDish.benefits.calories),
//         protein: Number(newDish.benefits.protein),
//         fibre: Number(newDish.benefits.fibre),
//         fat: Number(newDish.benefits.fat)
//       },
//       ingredients: newDish.ingredients
//         .split(",")
//         .map((i) => i.trim())
//         .filter(Boolean)
//     };

//     try {
//       const res = await api.get("/menu");

//       const updatedMenu = {
//         ...res.data,
//         categories: res.data.categories.map((cat) =>
//           cat.id === selectedCategoryId
//             ? {
//               ...cat,
//               dishes: editingDish
//                 ? cat.dishes.map((d) =>
//                   d.id === editingDish.id ? dishPayload : d
//                 )
//                 : [...cat.dishes, dishPayload]
//             }
//             : cat
//         )
//       };

//       await api.put("/menu", updatedMenu);

//       setAdminData((prev) => ({
//         ...prev,
//         categories: updatedMenu.categories
//       }));

//       setShowForm(false);
//       setEditingDish(null);
//       setNewDish({
//         name: "",
//         image: "",
//         basePrice: "",
//         description: "",
//         benefits: { calories: "", protein: "", fibre: "", fat: "" },
//         ingredients: ""
//       });
//     } catch (err) {
//       console.error("Failed to save dish", err);
//     }
//   };


//   const handleSave = (dishId) => {
//     setAdminData((prev) => ({
//       ...prev,
//       categories: prev.categories.map((cat) =>
//         cat.id === selectedCategoryId
//           ? {
//             ...cat,
//             dishes: cat.dishes.map((dish) =>
//               dish.id === dishId
//                 ? { ...dish, basePrice: Number(editedPrice) }
//                 : dish
//             )
//           }
//           : cat
//       )
//     }));

//     setEditingDishId(null);
//     setEditedPrice("");
//   };

//   const handleCancel = () => {
//     setEditingDishId(null);
//     setEditedPrice("");
//   };

//   const handleDelete = async (dishId) => {
//     const confirmed = window.confirm(
//       "Are you sure you want to delete this dish?"
//     );
//     if (!confirmed) return;

//     try {
//       const res = await api.get("/menu");

//       const updatedMenu = {
//         ...res.data,
//         categories: res.data.categories.map((cat) =>
//           cat.id === selectedCategoryId
//             ? {
//               ...cat,
//               dishes: cat.dishes.filter((dish) => dish.id !== dishId)
//             }
//             : cat
//         )
//       };

//       await api.put("/menu", updatedMenu);

//       setAdminData((prev) => ({
//         ...prev,
//         categories: updatedMenu.categories
//       }));
//     } catch (err) {
//       console.error("Failed to delete dish", err);
//     }
//   };

//   const handleDishImageUpload = (e) => {
//     const file = e.target.files[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onloadend = () => {
//       setNewDish((prev) => ({
//         ...prev,
//         image: reader.result   // base64 stored in JSON
//       }));
//       setDishImagePreview(reader.result);
//     };

//     reader.readAsDataURL(file);
//   };


//   return (
//     <div className="dishes-page">
//       <div className="dish-header">
//         <h2 className="dish-title">Dishes</h2>

//         <select
//           className="category-dropdown"
//           value={selectedCategoryId}
//           onChange={(e) => {
//             const newCategoryId = e.target.value;

//             setSelectedCategoryId(newCategoryId);
//             setEditingDishId(null);

//             navigate(`/dishes/${newCategoryId}`, { replace: true });
//           }}

//         >
//           {adminData.categories.map((category) => (
//             <option key={category.id} value={category.id}>
//               {category.name}
//             </option>
//           ))}
//         </select>

//         <button
//           className="dish-add-btn"
//           onClick={() => setShowForm(true)}
//         >
//           + Add Dish
//         </button>

//       </div>

//       <div className="dish-block">
//         {/* <div className="dish-title">{selectedCategory?.name}</div> */}

//         <div className="dish-table-wrapper">
//           <table className="dish-table">
//             <thead>
//               <tr>
//                 <th>Image</th>
//                 <th>Dish Name</th>
//                 <th>Base Price</th>
//                 <th>Delete</th>
//               </tr>
//             </thead>

//             <tbody>
//               {selectedCategory?.dishes.map((dish) => (
//                 <tr key={dish.id}>
//                   <td
//                     className="clickable"
//                     onClick={() => navigate(`/dishes/${selectedCategoryId}/${dish.id}`)}
//                   >
//                     <div
//                       className="dish-image"
//                       onClick={() => navigate(`/dishes/${selectedCategoryId}/${dish.id}`)}
//                     >
//                       <img src={dish.image || ""} alt="" />
//                     </div>
//                   </td>

//                   <td
//                     className="dish-name clickable"
//                     onClick={() => navigate(`/dishes/${selectedCategoryId}/${dish.id}`)}
//                   >
//                     {dish.name}
//                   </td>

//                   <td>
//                     {editingDishId === dish.id ? (
//                       <input
//                         type="number"
//                         value={editedPrice}
//                         onChange={(e) => setEditedPrice(e.target.value)}
//                         className="dish-input"
//                       />
//                     ) : (
//                       `₹${dish.basePrice}`
//                     )}
//                   </td>

//                   <td>
//                     <button
//                       className="icon-btn delete-btn"
//                       disabled={showForm}
//                       onClick={() => handleDelete(dish.id)}
//                     >
//                       Delete
//                     </button>

//                   </td>
//                 </tr>
//               ))}

//               {selectedCategory?.dishes.length === 0 && (
//                 <tr>
//                   <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
//                     No dishes available
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {showForm && (
//         <div className="category-modal-overlay">
//           <div className="category-modal large form-actions">
//             <h3>
//               {editingDish
//                 ? `Edit Dish for ${selectedCategory?.name}`
//                 : `Add New Dish for ${selectedCategory?.name}`}
//             </h3>

//             <input
//               type="text"
//               placeholder="Dish Name"
//               value={newDish.name}
//               onChange={(e) =>
//                 setNewDish({ ...newDish, name: e.target.value })
//               }
//             />

//             <input
//               type="file"
//               accept="image/*"
//               onChange={handleDishImageUpload}
//             />

//             {dishImagePreview && (
//               <img
//                 src={dishImagePreview}
//                 alt="Dish preview"
//                 style={{
//                   width: "140px",
//                   height: "140px",
//                   objectFit: "cover",
//                   borderRadius: "10px",
//                   marginTop: "12px"
//                 }}
//               />
//             )}


//             <input
//               type="number"
//               placeholder="Base Price"
//               value={newDish.basePrice}
//               onChange={(e) =>
//                 setNewDish({ ...newDish, basePrice: e.target.value })
//               }
//             />

//             <textarea
//               placeholder="Description"
//               value={newDish.description}
//               onChange={(e) =>
//                 setNewDish({ ...newDish, description: e.target.value })
//               }
//             />

//             <div className="benefits-grid">
//               <input
//                 type="number"
//                 placeholder="Calories"
//                 onChange={(e) =>
//                   setNewDish({
//                     ...newDish,
//                     benefits: { ...newDish.benefits, calories: e.target.value }
//                   })
//                 }
//               />
//               <input
//                 type="number"
//                 placeholder="Protein"
//                 onChange={(e) =>
//                   setNewDish({
//                     ...newDish,
//                     benefits: { ...newDish.benefits, protein: e.target.value }
//                   })
//                 }
//               />
//               <input
//                 type="number"
//                 placeholder="Fibre"
//                 onChange={(e) =>
//                   setNewDish({
//                     ...newDish,
//                     benefits: { ...newDish.benefits, fibre: e.target.value }
//                   })
//                 }
//               />
//               <input
//                 type="number"
//                 placeholder="Fat"
//                 onChange={(e) =>
//                   setNewDish({
//                     ...newDish,
//                     benefits: { ...newDish.benefits, fat: e.target.value }
//                   })
//                 }
//               />
//             </div>

//             <input
//               type="text"
//               placeholder="Ingredients (comma separated)"
//               value={newDish.ingredients}
//               onChange={(e) =>
//                 setNewDish({ ...newDish, ingredients: e.target.value })
//               }
//             />

//             <div className="modal-actions">
//               <button onClick={handleSaveDish}>
//                 {editingDish ? "Save Changes" : "Add Dish"}
//               </button>
//               <button
//                 onClick={() => {
//                   setShowForm(false);
//                   setEditingDish(null);
//                 }}
//               >
//                 Cancel
//               </button>
//             </div>

//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Dishes;


import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Dishes.css";
import deleteIcon from "../icon/delete-icon.png";

const Dishes = ({ adminData, setAdminData, toCamelCase }) => {
  const [dishImagePreview, setDishImagePreview] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [editingDish, setEditingDish] = useState(null);
  const [editingDishId, setEditingDishId] = useState(null);
  const [editedPrice, setEditedPrice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [ingredientInput, setIngredientInput] = useState("");

  const [newDish, setNewDish] = useState({
    name: "",
    image: "",
    basePrice: "",
    description: "",
    benefits: { calories: "", protein: "", fibre: "", fat: "" },
    ingredients: []
  });

  const { categoryId } = useParams();
  const navigate = useNavigate();

  /* ===============================
     CATEGORY SELECTION
  =============================== */

  useEffect(() => {
    if (!adminData.categories.length) return;

    if (categoryId) {
      const exists = adminData.categories.some(c => c.id === categoryId);
      if (exists) {
        setSelectedCategoryId(categoryId);
        return;
      }
    }

    setSelectedCategoryId(adminData.categories[0].id);
  }, [adminData.categories, categoryId]);

  const selectedCategory = adminData.categories.find(
    c => c.id === selectedCategoryId
  );

  /* ===============================
     ADD / UPDATE DISH
  =============================== */

  const handleSaveDish = () => {
    if (!newDish.name || !newDish.basePrice) {
      alert("Dish name and base price are required");
      return;
    }

    const dishPayload = {
      id: editingDish
        ? editingDish.id
        : `${selectedCategoryId}_${Date.now()}`,
      name: newDish.name,
      image: newDish.image,
      basePrice: Number(newDish.basePrice),
      description: newDish.description,
      benefits: {
        calories: Number(newDish.benefits.calories),
        protein: Number(newDish.benefits.protein),
        fibre: Number(newDish.benefits.fibre),
        fat: Number(newDish.benefits.fat)
      },
      ingredients: newDish.ingredients
    };

    setAdminData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === selectedCategoryId
          ? {
            ...cat,
            dishes: editingDish
              ? cat.dishes.map(d =>
                d.id === editingDish.id ? dishPayload : d
              )
              : [...cat.dishes, dishPayload]
          }
          : cat
      )
    }));

    setShowForm(false);
    setEditingDish(null);
    setDishImagePreview("");
    setNewDish({
      name: "",
      image: "",
      basePrice: "",
      description: "",
      benefits: { calories: "", protein: "", fibre: "", fat: "" },
      ingredients: []
    });
  };

  /* ===============================
     QUICK PRICE EDIT
  =============================== */

  const handleSavePrice = (dishId) => {
    setAdminData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === selectedCategoryId
          ? {
            ...cat,
            dishes: cat.dishes.map(d =>
              d.id === dishId
                ? { ...d, basePrice: Number(editedPrice) }
                : d
            )
          }
          : cat
      )
    }));

    setEditingDishId(null);
    setEditedPrice("");
  };

  const handleCancelPriceEdit = () => {
    setEditingDishId(null);
    setEditedPrice("");
  };

  /* ===============================
     DELETE DISH
  =============================== */

  const handleDelete = (dishId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this dish?"
    );
    if (!confirmed) return;

    setAdminData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === selectedCategoryId
          ? {
            ...cat,
            dishes: cat.dishes.filter(d => d.id !== dishId)
          }
          : cat
      )
    }));
  };

  /* ===============================
     IMAGE HANDLING
  =============================== */

  const handleDishImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewDish(prev => ({
        ...prev,
        image: reader.result
      }));
      setDishImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
  };

  /* ===============================
     UI
  =============================== */

  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    quantity: "",
    calories: ""
  });

  const handleAddIngredient = () => {
    if (!ingredientForm.name.trim()) return;

    setNewDish((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          name: ingredientForm.name.trim(),
          quantity: ingredientForm.quantity,
          calories: Number(ingredientForm.calories || 0)
        }
      ]
    }));

    setIngredientForm({ name: "", quantity: "", calories: "" });
  };

  const handleRemoveIngredient = (index) => {
    setNewDish((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="dishes-page">
      <div className="dish-header">
        <h2 className="dish-title">Dishes</h2>

        <select
          className="category-dropdown"
          value={selectedCategoryId}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedCategoryId(id);
            setEditingDishId(null);
            navigate(`/dishes/${id}`, { replace: true });
          }}
        >
          {adminData.categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <button
          className="dish-add-btn"
          onClick={() => setShowForm(true)}
        >
          + Add Dish
        </button>
      </div>

      <div className="dish-table-wrapper">
        <table className="dish-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Dish Name</th>
              <th>Base Price</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {selectedCategory?.dishes.map(dish => (
              <tr key={dish.id}>
                <td
                  className="clickable"
                  onClick={() =>
                    navigate(`/dishes/${selectedCategoryId}/${dish.id}`)
                  }
                >
                  <div className="dish-image">
                    <img src={dish.image || ""} alt="" />
                  </div>
                </td>

                <td
                  className="dish-name clickable"
                  onClick={() =>
                    navigate(`/dishes/${selectedCategoryId}/${dish.id}`)
                  }
                >
                  {dish.name}
                </td>

                <td>
                  {editingDishId === dish.id ? (
                    <>
                      <input
                        type="number"
                        value={editedPrice}
                        onChange={(e) =>
                          setEditedPrice(e.target.value)
                        }
                        className="dish-input"
                      />
                      <button onClick={() => handleSavePrice(dish.id)}>
                        Save
                      </button>
                      <button onClick={handleCancelPriceEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    `₹${dish.basePrice}`
                  )}
                </td>

                <td>
                  <button
                    className="icon-btn delete-btn"
                    disabled={showForm}
                    onClick={() => handleDelete(dish.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {selectedCategory?.dishes.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: "center", padding: 20 }}>
                  No dishes available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="category-modal-overlay">
          <div className="category-modal">
            <h3>Add New Dish for {selectedCategory?.name}</h3>

<div className="form-group">
  <label htmlFor="">Dish name</label>
            <input
              value={newDish.name}
              onChange={(e) =>
                setNewDish({ ...newDish, name: e.target.value })
              }
              onBlur={(e) =>
                setNewDish({
                  ...newDish,
                  name: toCamelCase(e.target.value)
                })
              }
            />
</div>

<div className="form-group">
  <label htmlFor="">
    Dish image
  </label>
              <input type="file" accept="image/*" onChange={handleDishImageUpload} />


            {dishImagePreview && (
              <img
                src={dishImagePreview}
                alt="Preview"
                style={{
                  width: 140,
                  height: 140,
                  objectFit: "cover",
                  borderRadius: 10,
                  marginTop: 12
                }}
              />
            )}
</div>
<div className="form-group">
  <label htmlFor="">Base price</label>
            <input
              type="number"
              value={newDish.basePrice}
              onChange={(e) =>
                setNewDish({ ...newDish, basePrice: e.target.value })
              }
            />
</div>
<div className="form-group">
  <label htmlFor="">Description</label>
            <textarea
              value={newDish.description}
              onChange={(e) =>
                setNewDish({ ...newDish, description: e.target.value })
              }
            />
</div>
<div className="form-group">
  <label htmlFor="">Benefits</label>
            <div className="benefits-grid">
              {["calories", "protein", "fibre", "fat"].map(key => (
                <input
                  key={key}
                  type="number"
                  placeholder={key}
                  onChange={(e) =>
                    setNewDish({
                      ...newDish,
                      benefits: {
                        ...newDish.benefits,
                        [key]: e.target.value
                      }
                    })
                  }
                />
              ))}
            </div>
</div>

            {/* INGREDIENT INPUT */}
            <div className="ingredient-form border">
              <div className="form-group">
                <label htmlFor="">Ingredient Name</label>
              <input
                value={ingredientForm.name}
                onChange={(e) =>
                  setIngredientForm({ ...ingredientForm, name: e.target.value })
                }
                onBlur={(e) =>
                  setIngredientForm({
                    ...ingredientForm,
                    name: toCamelCase(e.target.value)
                  })
                }
              />
              </div>

              <div className="form-group">
                <label htmlFor="">Quantity in Kg</label>
              <input
                type="number"
                value={ingredientForm.quantity}
                onChange={(e) =>
                  setIngredientForm({ ...ingredientForm, quantity: e.target.value })
                }
              />
              </div>

              <div className="form-group">
                <label htmlFor="">Calories</label>
              <input
                type="number"
                value={ingredientForm.calories}
                onChange={(e) =>
                  setIngredientForm({ ...ingredientForm, calories: e.target.value })
                }
              />
              </div>

              <button type="button" onClick={handleAddIngredient}>
                Add Ingredient
              </button>
{newDish.ingredients.length > 0 && (
              <table className="ingredient-form-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Quantity</th>
                    <th>Calories (kcal)</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {newDish.ingredients.map((ing, index) => (
                    <tr key={index}>
                      <td>{ing.name}</td>
                      <td>{ing.quantity}</td>
                      <td>{ing.calories}</td>
                      <td>
                        <div
                          type="button"
                          className="ingredient-delete-btn"
                          onClick={() => handleRemoveIngredient(index)}
                        >
                          <img src={deleteIcon} alt="" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            </div>

            {/* INGREDIENT LIST */}
            



            <div className="form-actions">
              <button onClick={handleSaveDish}>Add Dish</button>
              <button onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dishes;
