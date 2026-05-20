import "./App.css"; //admon panel
import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import api from "./api";
import socket from "./socket";

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
import Offers from "./pages/Offers";
import OfferDetails from "./pages/OfferDetails";
import Users from "./pages/Users";
import UserDetails from "./pages/UserDetails";

// EVENTS
import Reservations from "./pages/events/Reservations";
import ReservationDetails from "./pages/events/ReservationDetails";
import Celebrations from "./pages/events/Celebrations";
import CelebrationDetails from "./pages/events/CelebrationDetails";
import PreBookings from "./pages/events/PreBookings";
import PreBookingDetails from "./pages/events/PreBookingDetails";
import Catering from "./pages/events/Catering";
import CateringDetails from "./pages/events/CateringDetails";
import Events from "./pages/events/Events";

// STAFFS
import Staffs from "./pages/staffs/Staffs";
import StaffDetails from "./pages/staffs/StaffDetails";
import StaffAttendance from "./pages/staffs/StaffAttendance";
import StaffSalary from "./pages/staffs/StaffSalary";
import StaffCareer from "./pages/staffs/StaffCareer";
import StaffTraining from "./pages/staffs/StaffTraining";

// KMS
import KitchenRecipe from "./pages/kitchen/KitchenRecipe";
import KitchenGrooming from "./pages/kitchen/KitchenGrooming";
import KitchenMise from "./pages/kitchen/KitchenMise";
import KitchenAssign from "./pages/kitchen/KitchenAssign";
import KitchenReports from "./pages/kitchen/KitchenReports";
import TableManagement from "./pages/service/TableManagement";
import KitchenActivityLog from "./pages/kitchen/KitchenActivityLog";
import KitchenSchedules from "./pages/kitchen/KitchenSchedules";

//SMS
import ServiceAssign from "./pages/service/ServiceAssign";
import ServiceGrooming from "./pages/service/ServiceGrooming";
import ServiceMise from "./pages/service/ServiceMise";
import ServiceReports from "./pages/service/ServiceReports";
import ServiceActivityLog from "./pages/service/ServiceActivityLog";
import ServiceSchedules from "./pages/service/ServiceSchedules";

import ThemeSettings from "./ThemeSettings";


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
    ingredients: [],
    orders: [],
    users: [],
    favourites: [],
    staff: [],
    callHistory: [],
    reservations: [],
    celebrations: [],
    preBookings: [],
    cateringOrders: [],
    events: [],
    kitchenAssign: {},
  });

  /* ---------------- LOGIN HANDLER ---------------- */
  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  /* ---------------- FETCH DATA ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAllData = async () => {
      try {
        const [
          catRes,
          ingRes,
          ordersRes,
          usersRes,
          favRes,
          staffRes,
          groomRes,
          miseRes,
          kitchenAssignRes,
          recipeRes,
          offerRes,              // ✅ offers FIRST
          activityRes,           // kitchenActivity
          schedulesRes,          // kitchenSchedules
          serviceAssignRes,
          serviceGroomRes,
          serviceMiseRes,
          serviceActivityRes,
          serviceSchedulesRes,
          tablesRes,
          reservationsRes,
          celebrationsRes,
          preBookingsRes,
          cateringRes,
          eventsRes,
          bookingsRes,
          tasksRes,
          callHistoryRes
        ] = await Promise.all([
          api.get("/categories"),
          api.get("/ingredients"),
          api.get("/orders"),
          api.get("/users"),
          api.get("/favourites"),
          api.get("/staff"),
          api.get("/grooming"),
          api.get("/mise"),
          api.get("/kitchenAssign"),
          api.get("/recipes"),
          api.get("/offers"),              // ✅ HERE
          api.get("/kitchenActivity"),     // ✅
          api.get("/kitchenSchedules"),    // ✅
          api.get("/serviceAssign"),
          api.get("/serviceGrooming"),
          api.get("/serviceMise"),
          api.get("/serviceActivity"),
          api.get("/serviceSchedules"),
          api.get("/tables"),
          api.get("/reservations"),
          api.get("/celebrations"),
          api.get("/preBookings"),
          api.get("/cateringOrders"),
          api.get("/events"),
          api.get("/eventBookings"),
          api.get("/tasks"),
          api.get("/callHistory")
        ]);

        setAdminData({
          categories: catRes.data || [],
          ingredients: ingRes.data || [],
          orders: ordersRes.data || [],
          users: usersRes.data || [],
          favourites: favRes.data || [],
          staff: staffRes.data || [],
          grooming: groomRes.data || {},
          mise: miseRes.data || {},
          kitchenAssign: kitchenAssignRes.data || {},
          recipes: recipeRes.data || [],
          kitchenActivity: activityRes.data || [],
          kitchenSchedules: schedulesRes.data || [],
          offers: offerRes.data || [],
          serviceAssign: serviceAssignRes.data || {},
          serviceActivity: serviceActivityRes.data || [],
          serviceGrooming: serviceGroomRes.data || {},
          serviceMise: serviceMiseRes.data || {},
          serviceSchedules: serviceSchedulesRes.data || [],
          tables: tablesRes.data || [],
          reservations: reservationsRes.data || [],
          celebrations: celebrationsRes.data || [],
          preBookings: preBookingsRes.data || [],
          cateringOrders: cateringRes.data || [],
          events: eventsRes.data || [],
          eventBookings: bookingsRes.data || [],
          tasks: tasksRes.data?.[0] || {
            kitchen: { mise: [], cleaning: [] },
            service: { mise: [], cleaning: [] }
          },
          callHistory: callHistoryRes.data || []
        });

      } catch (err) {
        console.error("Failed to fetch admin data", err);
      }
    };

    fetchAllData();
  }, [isAuthenticated]);

  /* ---------------- SOCKET: real-time data-change listener ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleDataChange = ({ resource, action, payload }) => {
      setAdminData(prev => {
        switch (resource) {

          // ── Events ──────────────────────────────────────────────────────
          case "events":
            if (action === "created") {
              // Avoid duplicates if our own optimistic update already added it
              const alreadyExists = (prev.events || []).some(e => e.id === payload.id);
              if (alreadyExists) return prev;
              return { ...prev, events: [...(prev.events || []), payload] };
            }
            if (action === "updated") {
              return {
                ...prev,
                events: (prev.events || []).map(e => e.id === payload.id ? payload : e),
              };
            }
            if (action === "deleted") {
              // payload is the string id from the server
              const deletedId = String(payload);
              return {
                ...prev,
                events: (prev.events || []).filter(e => String(e.id) !== deletedId),
                eventBookings: (prev.eventBookings || []).filter(b => String(b.eventId) !== deletedId),
              };
            }
            return prev;

          // ── Event Bookings ───────────────────────────────────────────────
          case "eventBookings":
            if (action === "created") {
              const exists = (prev.eventBookings || []).some(b => b.id === payload.id);
              if (exists) return prev;
              return { ...prev, eventBookings: [...(prev.eventBookings || []), payload] };
            }
            if (action === "updated") {
              return {
                ...prev,
                eventBookings: (prev.eventBookings || []).map(b => b.id === payload.id ? payload : b),
              };
            }
            if (action === "deleted") {
              return {
                ...prev,
                eventBookings: (prev.eventBookings || []).filter(b => String(b.id) !== String(payload)),
              };
            }
            return prev;

          // ── Orders (light-weight: just re-fetch since they live inside users) ──
          case "orders":
            if (action === "updated" || action === "created") {
              api.get("/orders").then(r => {
                setAdminData(p => ({ ...p, orders: r.data || [] }));
              }).catch(() => { });
            }
            return prev;

          // ── Other simple flat resources ─────────────────────────────────
          default:
            // For any other resource (ingredients, staff, offers…)
            // do a targeted re-fetch of just that slice
            const RESOURCE_KEY_MAP = {
              ingredients: "ingredients",
              staff: "staff",
              offers: "offers",
              categories: "categories",
              reservations: "reservations",
              celebrations: "celebrations",
              preBookings: "preBookings",
              cateringOrders: "cateringOrders",
            };
            const key = RESOURCE_KEY_MAP[resource];
            if (key) {
              api.get(`/${resource}`).then(r => {
                setAdminData(p => ({ ...p, [key]: r.data || [] }));
              }).catch(() => { });
            }
            return prev;
        }
      });
    };

    socket.on("data-change", handleDataChange);

    return () => {
      socket.off("data-change", handleDataChange);
    };
  }, [isAuthenticated]);

  /* ---------------- INGREDIENT CRUD ---------------- */
  const addIngredient = async (ingredient) => {
    try {
      await api.post("/ingredients", ingredient);
    } catch (err) {
      console.error("Add ingredient failed:", err);
    }
  };

  const addStaff = async (staff) => {
    try {
      const res = await api.post("/staff", staff);

      setAdminData(prev => ({
        ...prev,
        staff: [...prev.staff, res.data]
      }));
    } catch (err) {
      console.error("Add staff failed:", err.response?.data || err.message);
    }
  };

  const updateStaff = async (id, updated) => {
    const res = await api.put(`/staff/${id}`, updated);

    setAdminData(prev => ({
      ...prev,
      staff: prev.staff.map(s => s.id === id ? res.data : s)
    }));
  };

  const deleteStaff = async (id) => {
    await api.delete(`/staff/${id}`);

    setAdminData(prev => ({
      ...prev,
      staff: prev.staff.filter(s => s.id !== id)
    }));
  };

  const updateIngredient = async (id, updated) => {
    try {
      const res = await api.put(`/ingredients/${id}`, updated);

      setAdminData(prev => ({
        ...prev,
        ingredients: prev.ingredients.map(i =>
          i.id === id ? res.data : i
        )
      }));
    } catch (err) {
      console.error("Update ingredient failed:", err);
    }
  };

  const deleteIngredient = async (id) => {
    try {
      await api.delete(`/ingredients/${id}`);

      setAdminData(prev => ({
        ...prev,
        ingredients: prev.ingredients.filter(i => i.id !== id)
      }));
    } catch (err) {
      console.error("Delete ingredient failed:", err);
    }
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
          adminData={adminData}
          setAdminData={setAdminData}
        />

        <div className="page">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  adminData={adminData}
                  orders={adminData.orders}
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
                  setAdminData={setAdminData}
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
                  adminData={adminData}
                  setAdminData={setAdminData}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route path="/reservations" element={<Reservations adminData={adminData} setAdminData={setAdminData} />} />
            <Route path="/reservations/:id" element={<ReservationDetails adminData={adminData} setAdminData={setAdminData} />} />

            <Route path="/celebrations" element={<Celebrations adminData={adminData} />} />
            <Route path="/celebrations/:id" element={<CelebrationDetails adminData={adminData} setAdminData={setAdminData} />} />

            <Route path="/prebookings" element={<PreBookings adminData={adminData} />} />
            <Route path="/prebookings/:id" element={<PreBookingDetails adminData={adminData} />} />

            <Route path="/catering" element={<Catering adminData={adminData} />} />
            <Route path="/catering/:id" element={<CateringDetails adminData={adminData} />} />

            <Route
              path="/events"
              element={
                <Events
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route
              path="/orders/:orderId"
              element={
                <OrderDetails
                  orders={adminData.orders}
                  menu={adminData}
                />
              }
            />

            <Route
              path="/users"
              element={
                <Users
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                  users={adminData.users}
                />
              }
            />

            <Route path="/users/:userId" element={<UserDetails users={adminData.users} />} />

            <Route
              path="/staffs"
              element={
                <Staffs
                  adminData={adminData}
                  onAdd={addStaff}
                  onUpdate={updateStaff}
                  onDelete={deleteStaff}
                  sortConfig={sortConfig}
                  handleSort={handleSort}
                />
              }
            />

            <Route
              path="/staff/:staffId"
              element={
                <StaffDetails
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route
              path="/staff-attendance"
              element={
                <StaffAttendance
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route path="/staff-salary" element={<StaffSalary adminData={adminData} />} />
            <Route path="/staff-career" element={<StaffCareer adminData={adminData} />} />
            <Route path="/staff-training" element={<StaffTraining adminData={adminData} setAdminData={setAdminData} />} />

            <Route
              path="/kitchen-assign"
              element={<KitchenAssign adminData={adminData} setAdminData={setAdminData} />}
            />

            <Route
              path="/kitchen-mise"
              element={<KitchenMise adminData={adminData} setAdminData={setAdminData} />}
            />

            <Route
              path="/kitchen-grooming"
              element={<KitchenGrooming adminData={adminData} setAdminData={setAdminData} />}
            />

            <Route
              path="/kitchen-recipe"
              element={<KitchenRecipe adminData={adminData} setAdminData={setAdminData} />}
            />
            <Route path="/kitchen-reports" element={<KitchenReports adminData={adminData} />} />

            <Route
              path="/kitchen-activity"
              element={<KitchenActivityLog adminData={adminData} />}
            />

            <Route
              path="/kitchen-schedules"
              element={
                <KitchenSchedules
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route
              path="/tables"
              element={
                <TableManagement
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route path="/service-assign" element={
              <ServiceAssign adminData={adminData} setAdminData={setAdminData} />
            } />

            <Route path="/service-grooming" element={
              <ServiceGrooming adminData={adminData} setAdminData={setAdminData} />
            } />

            <Route path="/service-mise" element={
              <ServiceMise adminData={adminData} setAdminData={setAdminData} />
            } />

            <Route path="/service-reports" element={
              <ServiceReports adminData={adminData} />
            } />

            <Route
              path="/service-activity"
              element={<ServiceActivityLog adminData={adminData} />}
            />

            <Route
              path="/service-schedules"
              element={
                <ServiceSchedules
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route path="/offers"
              element={
                <Offers
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route path="/offers/:offerId"
              element={
                <OfferDetails
                  adminData={adminData}
                  setAdminData={setAdminData}
                />
              }
            />

            <Route path="/theme-settings" element={<ThemeSettings />} />

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

      const aStr = aVal.toLowerCase().trim();
      const bStr = bVal.toLowerCase().trim();

      return sortConfig.direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
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

export const resolveCategoryAndSubCategory = (categories, id) => {
  let category = categories.find(c => c.id === id);
  let subCategory = null;

  if (!category) {
    for (const cat of categories) {
      const found = (cat.subCategories || []).find(sub => sub.id === id);
      if (found) {
        category = cat;
        subCategory = found;
        break;
      }
    }
  }

  return { category, subCategory };
};

export const formatDisplayDate = (date) => {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${d.getFullYear()}`;
};

export const formatIndianTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return "—";

  const dateTime = new Date(`${dateStr}T${timeStr}`);

  if (isNaN(dateTime.getTime())) return timeStr;

  return dateTime.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

// ================= DATE UTILITIES (GLOBAL) =================

// ✅ Safe local date key (NO timezone bug)
export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ✅ Clean formatted date (UI)
export const getTodayFormatted = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("default", { month: "long" })} ${d.getFullYear()}`;
};

// ✅ Full readable date (optional)
export const getTodayFull = () => {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

export const getTomorrowKey = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const getTomorrowFormatted = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);

  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};