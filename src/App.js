import "./App.css";
import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";

import Dashboard from "./pages/Dashboard";
import Ingredients from "./pages/Ingredients";
import Dishes from "./pages/Dishes";
import Categories from "./pages/Categories";
import IngredientDetails from "./pages/IngredientDetails";
import DishDetails from "./pages/DishDetails";
import Stocks from "./pages/Stocks";
import Login from "./pages/Login";
import Favourites from "./pages/Favourites";
import FavouriteDetails from "./pages/FavouriteDetails";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import Users from "./pages/Users";
import UserDetails from "./pages/UserDetails";

import api from "./api";

// Hard input limiter (chars + words)
export const allowTextInput = (
  currentValue,
  nextValue,
  maxChars = 100,
  maxWords = 5
) => {
  if (!nextValue) return "";

  // Normalize spaces only for validation
  const normalized = nextValue.replace(/\s+/g, " ").trim();

  const charCount = normalized.length;
  const wordCount =
    normalized === "" ? 0 : normalized.split(" ").length;

  // Block typing / paste if limit exceeded
  if (charCount > maxChars || wordCount > maxWords) {
    return currentValue;
  }

  return nextValue;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: "id",
    direction: "desc"
  });

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc"
        };
      }
      return { key, direction: "asc" };
    });
  };

  const [adminData, setAdminData] = useState({
    categories: [],
    favourites: [],
    ingredients: []
  });

  const [orders, setOrders] = useState({
    orders: []
  });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get("/orders");
        setOrders({ orders: res.data || [] });
      } catch (err) {
        console.error("Failed to fetch orders", err);
      }
    };

    fetchOrders();
  }, []);

  /* ---------------- LOGIN HANDLER ---------------- */
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  /* ---------------- FETCH MENU ---------------- */
  const fetchMenu = async () => {
    try {
      const res = await api.get("/menu");
      setAdminData({
        categories: res.data.categories || [],
        favourites: res.data.favourites || [],
        ingredients: res.data.ingredients || []
      });
    } catch (err) {
      console.error("Failed to fetch menu", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMenu();
    }
  }, [isAuthenticated]);

  /* ---------------- INGREDIENT CRUD ---------------- */
  const addIngredient = async (ingredient) => {
    const res = await api.get("/menu");

    const updatedMenu = {
      ...res.data,
      ingredients: [...res.data.ingredients, ingredient]
    };

    await api.put("/menu", updatedMenu);

    setAdminData((prev) => ({
      ...prev,
      ingredients: updatedMenu.ingredients
    }));
  };

  const updateIngredient = async (id, updated) => {
    const res = await api.get("/menu");

    const updatedMenu = {
      ...res.data,
      ingredients: res.data.ingredients.map((ing) =>
        ing.id === id ? updated : ing
      )
    };

    await api.put("/menu", updatedMenu);

    setAdminData((prev) => ({
      ...prev,
      ingredients: updatedMenu.ingredients
    }));
  };

  const deleteIngredient = async (id) => {
    const res = await api.get("/menu");

    const updatedMenu = {
      ...res.data,
      ingredients: res.data.ingredients.filter(
        (ing) => ing.id !== id
      )
    };

    await api.put("/menu", updatedMenu);

    setAdminData((prev) => ({
      ...prev,
      ingredients: updatedMenu.ingredients
    }));
  };

  /* ---------------- AUTH GUARD ---------------- */
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route
          path="*"
          element={<Login onLogin={handleLogin} />}
        />
      </Routes>
    );
  }

  const toCamelCase = (value) =>
    value
      .trim()
      .split(/\s+/)
      .map(
        word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");

  const generateIdFromName = (name) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_");

  /* ---------------- ADMIN LAYOUT ---------------- */
  return (
    <div className="app">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className={`app-main ${isSidebarOpen ? "expanded" : "collapsed"}`}>
        <Topbar
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
          orders={orders.orders}
          ingredients={adminData.ingredients}
        />

        <div className="page">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  adminData={adminData}
                  orders={orders.orders}
                />
              }
            />

            <Route
              path="/categories"
              element={
                <Categories
                  adminData={adminData}
                  setAdminData={setAdminData}
                  toCamelCase={toCamelCase}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/ingredients"
              element={
                <Ingredients
                  adminData={adminData}
                  onAdd={addIngredient}
                  onUpdate={updateIngredient}
                  onDelete={deleteIngredient}
                  toCamelCase={toCamelCase}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/ingredients/:ingredientId"
              element={
                <IngredientDetails
                  adminData={adminData}
                  setAdminData={setAdminData}
                  toCamelCase={toCamelCase}
                  generateIdFromName={generateIdFromName}
                />
              }
            />

            <Route
              path="/dishes/:categoryId?"
              element={
                <Dishes
                  adminData={adminData}
                  setAdminData={setAdminData}
                  toCamelCase={toCamelCase}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/dishes/:categoryId/:dishId"
              element={
                <DishDetails
                  adminData={adminData}
                  setAdminData={setAdminData}
                  toCamelCase={toCamelCase}
                  generateIdFromName={generateIdFromName}
                />
              }
            />

            <Route
              path="/stocks"
              element={
                <Stocks
                  adminData={adminData}
                  setAdminData={setAdminData}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/favourites"
              element={
                <Favourites
                  adminData={adminData}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/favourites/:dishId"
              element={<FavouriteDetails adminData={adminData} />}
            />

            <Route
              path="/orders"
              element={
                <Orders
                  order={orders}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/orders/:orderId"
              element={<OrderDetails orders={orders.orders} menu={adminData} />}
            />

            <Route
              path="/users"
              element={
                <Users
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route path="/users/:userId" element={<UserDetails />} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;

export const sortArray = (data, sortConfig) => {
  if (!sortConfig.key) return data;

  return [...data].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal == null || bVal == null) return 0;

    if (typeof aVal === "string") {
      return sortConfig.direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortConfig.direction === "asc"
      ? aVal - bVal
      : bVal - aVal;
  });
};

// Reusable empty table row
export const EmptyRow = ({ colSpan, message = "No data available" }) => (
  <tr>
    <td
      colSpan={colSpan}
      style={{
        textAlign: "center",
        padding: "20px",
        color: "#777",
        fontWeight: 500
      }}
    >
      {message}
    </td>
  </tr>
);