/**
 * App.js  —  Sam Cafe Admin Panel
 * Root router, global state, socket listener
 */

import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import api from "./api";
import socket from "./socket";

import { useAuth } from "./context/AuthContext";
import { useToast } from "./useToast";
import useGlobalTooltips from "./hooks/useGlobalTooltips";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import Dashboard from "./pages/Dashboard";
import Ingredients from "./pages/Ingredients";
import Dishes from "./pages/Dishes";
import Categories from "./pages/Categories";
import IngredientDetails from "./pages/IngredientDetails";
import DishDetails from "./pages/DishDetails";
import Stocks from "./pages/Stocks";
import ComboOffers from "./pages/ComboOffers";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ForcePasswordReset from "./pages/ForcePasswordReset";
import Profile from "./pages/Profile";
import Todo from "./pages/Todo";
import Favourites from "./pages/Favourites";
import FavouriteDetails from "./pages/FavouriteDetails";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import Offers from "./pages/Offers";
import OfferDetails from "./pages/OfferDetails";
import Users from "./pages/Users";
import UserDetails from "./pages/UserDetails";
import Venues from "./pages/Venues";
import Permissions from "./pages/Permissions";
import CategoryCards from "./pages/CategoryCards";
import AuditLogs from "./pages/AuditLogs";
import AuditLogDetails from "./pages/AuditLogDetails";
import Documents from "./pages/Documents";
import BankAccount from "./pages/BankAccount";
import DocumentDetails from "./pages/DocumentDetails";

import { useVenue } from "./context/VenueContext";

import "./App.css"; //admin panel

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
import PageLoader from "./components/PageLoader";

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
  const { toast } = useToast();
  const navigate = useNavigate();
  useGlobalTooltips();
  const { isAuthenticated, isLoading: isAuthLoading, admin, isSuperAdmin: isSuperAdminUser } = useAuth();
  const { venueParam, venueId: activeVenueId, isLoading: isVenueLoading } = useVenue();
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
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

  // ── Filter state owned here so it survives route unmount/remount ──
  // Sorting is local to each page — no need to persist across navigation.
  const _today = () => new Date().toISOString().split("T")[0];

  const [resFilters, setResFilters] = useState({ filterDate: "", fromDate: _today(), toDate: _today(), preset: "today", slots: new Set(), statuses: new Set(), sources: new Set(), search: "" });
  const [celFilters, setCelFilters] = useState({ fromDate: _today(), toDate: _today(), preset: "today", types: new Set(), statuses: new Set(), search: "" });
  const [preFilters, setPreFilters] = useState({ fromDate: _today(), toDate: _today(), preset: "today", slots: new Set(), statuses: new Set(), search: "" });
  const [catFilters, setCatFilters] = useState({ fromDate: _today(), toDate: _today(), preset: "today", statuses: new Set(), search: "" });
  const [evtFilters, setEvtFilters] = useState({ activeTab: "events", filterEventId: "all", filterStatuses: new Set(), filterFromDate: "", filterToDate: "", bookingsDatePreset: "", searchQuery: "", evtSearch: "", evtFilterStatuses: new Set(["upcoming", "ongoing"]), evtFilterTypes: new Set(), evtFilterPublish: new Set(), evtFromDate: "", evtToDate: "", evtDatePreset: "" });

  const patchRes = (patch) => setResFilters(p => ({ ...p, ...patch }));
  const patchCel = (patch) => setCelFilters(p => ({ ...p, ...patch }));
  const patchPre = (patch) => setPreFilters(p => ({ ...p, ...patch }));
  const patchCat = (patch) => setCatFilters(p => ({ ...p, ...patch }));
  const patchEvt = (patch) => setEvtFilters(p => ({ ...p, ...patch }));

  const resetResFilters = () => setResFilters({ filterDate: "", fromDate: _today(), toDate: _today(), preset: "today", slots: new Set(), statuses: new Set(), sources: new Set(), search: "" });
  const resetCelFilters = () => setCelFilters({ fromDate: _today(), toDate: _today(), preset: "today", types: new Set(), statuses: new Set(), search: "" });
  const resetPreFilters = () => setPreFilters({ fromDate: _today(), toDate: _today(), preset: "today", slots: new Set(), statuses: new Set(), search: "" });
  const resetCatFilters = () => setCatFilters({ fromDate: _today(), toDate: _today(), preset: "today", statuses: new Set(), search: "" });

  const [adminData, setAdminData] = useState({
    categories: [],
    ingredients: [],
    orders: [],
    users: [],
    favourites: [],
    staff: [],
    reservations: [],
    celebrations: [],
    preBookings: [],
    cateringOrders: [],
    events: [],
    kitchenAssign: {},
    staffAccounts: [],
    unlinkedStaff: [],
    roles: [],
  });

  /* ---------------- FETCH DATA ---------------- */
  // Guards against a race between two overlapping fetchAllData() calls —
  // e.g. one firing while activeVenueId is still null (before the venue
  // switcher/own-venue lookup has resolved) and a second firing right
  // after with the real venueId. Without this, whichever response
  // happens to arrive last wins, even if it's the stale/unscoped one —
  // which is what made staff records (and everything else) sometimes
  // come back empty or wrong right after landing on a page.
  const fetchRequestIdRef = useRef(0);

  const fetchAllData = async () => {
    const requestId = ++fetchRequestIdRef.current;
    try {
      const endpoints = [
        "/categories", "/ingredients", "/orders", "/users", "/favourites",
        "/staff", "/grooming", "/mise", "/kitchenAssign", "/recipes",
        "/offers", "/kitchenActivity", "/kitchenSchedules", "/serviceAssign",
        "/serviceGrooming", "/serviceMise", "/serviceActivity",
        "/serviceSchedules", "/tables", "/reservations", "/celebrations",
        "/preBookings", "/cateringOrders", "/events", "/eventBookings",
        "/tasks", "/work-plan", "/staff-auth/admins",
        "/staff-auth/unlinked-staff", "/roles",
      ];

      const settled = await Promise.allSettled(
        endpoints.map((path) => api.get(path, { params: venueParam() }))
      );

      // A newer fetchAllData() call has started since this one began —
      // discard this response entirely instead of writing possibly
      // stale/mis-scoped data over whatever the newer call already set.
      if (requestId !== fetchRequestIdRef.current) return;

      // Log each failure individually so a single bad route is visible in
      // the console instead of silently killing every other endpoint. A
      // 403 is an expected "this role can't read this module" outcome, not
      // a bug — logged at info level without the stack trace so it doesn't
      // read as a crash; anything else is a genuine failure worth a full
      // console.error.
      settled.forEach((result, i) => {
        if (result.status !== "rejected") return;
        if (result.reason?.response?.status === 403) {
          console.info(`No permission to read ${endpoints[i]} (expected for this role)`);
        } else {
          console.error(`Failed to fetch ${endpoints[i]}:`, result.reason);
        }
      });

      const dataOf = (i) =>
        settled[i].status === "fulfilled" ? settled[i].value.data : undefined;

      const [
        catRes, ingRes, ordersRes, usersRes, favRes, staffRes, groomRes,
        miseRes, kitchenAssignRes, recipeRes, offerRes, activityRes,
        schedulesRes, serviceAssignRes, serviceGroomRes, serviceMiseRes,
        serviceActivityRes, serviceSchedulesRes, tablesRes, reservationsRes,
        celebrationsRes, preBookingsRes, cateringRes, eventsRes, bookingsRes,
        tasksRes, workPlanRes, staffAccountsRes, unlinkedStaffRes, rolesRes,
      ] = endpoints.map((_, i) => ({ data: dataOf(i) }));

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
        workPlan: workPlanRes.data || [],
        staffAccounts: staffAccountsRes.data || [],
        unlinkedStaff: unlinkedStaffRes.data || [],
        roles: rolesRes.data || [],
      });

      // A 403 here means "this role isn't permitted to read this module" —
      // an expected, per-endpoint outcome for anyone who isn't Super Admin,
      // not a connection problem. Only count genuine failures (network
      // errors, 5xx, etc.) toward the connection-error/retry path, or a
      // role-restricted login would otherwise show a misleading "connection
      // error" banner and burn through the retry budget hitting the same
      // permission wall every time.
      const anyGenuineFailure = settled.some(
        (r) => r.status === "rejected" && r.reason?.response?.status !== 403
      );

      // Show a non-blocking error banner if something actually failed, but
      // never let a partial failure keep the app stuck on the loader —
      // the admin shell renders with whatever data did come back.
      setConnectionError(anyGenuineFailure);
      setIsAppLoading(false);
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      console.error("Failed to fetch admin data", err);
      setConnectionError(true);
      setIsAppLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || isVenueLoading) return;
    // For anyone pinned to their own venue (everyone except Super Admin),
    // wait until that venue has actually resolved before fetching —
    // isVenueLoading can flip to false a render before admin.venueId is
    // reflected in activeVenueId, which previously let an unscoped (or
    // wrongly-scoped) request slip through and race the correctly-scoped
    // one that follows right after.
    if (isSuperAdminUser && !activeVenueId) return;
    if (!isSuperAdminUser && admin?.venueId && !activeVenueId) return;
    setIsAppLoading(true);
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isAuthLoading, isVenueLoading, activeVenueId, admin?.venueId]);


  // Auto-retry the initial connection a bounded number of times if it
  // failed, so a genuinely down backend doesn't retry forever — but the
  // admin shell is still visible in the meantime since isAppLoading is
  // cleared above regardless of success/failure.
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  useEffect(() => {
    if (!isAuthenticated || !connectionError) return;
    if (retryCountRef.current >= MAX_RETRIES) return;
    const retryTimer = setTimeout(() => {
      retryCountRef.current += 1;
      fetchAllData();
    }, 3000);
    return () => clearTimeout(retryTimer);
  }, [isAuthenticated, connectionError]);

  /* ---------------- SOCKET: real-time data-change listener ---------------- */
  useEffect(() => {
    if (!isAuthenticated) return;
    const seenEvents = new Set();

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

          // ── Orders ──────────────────────────────────────────────────────
          // payload is already the full order document, so patch/append in
          // place instead of re-fetching the whole collection. Re-fetching
          // here raced against this tab's own optimistic updates and the
          // Orders page's 5s polling interval, which produced the
          // duplicate/flicker behaviour on that page.
          case "orders": {
            if (action === "created") {
              const alreadyExists = (prev.orders || []).some(o => o.id === payload.id);
              if (alreadyExists) return prev;
              return { ...prev, orders: [...(prev.orders || []), payload] };
            }
            if (action === "updated") {
              const exists = (prev.orders || []).some(o => o.id === payload.id);
              if (!exists) return { ...prev, orders: [...(prev.orders || []), payload] };
              return {
                ...prev,
                orders: (prev.orders || []).map(o =>
                  o.id === payload.id ? payload : o
                ),
              };
            }
            if (action === "deleted") {
              const deletedId = payload?.id ?? payload;
              return {
                ...prev,
                orders: (prev.orders || []).filter(o => String(o.id) !== String(deletedId)),
              };
            }
            return prev;
          }

          // ── Other simple flat resources ─────────────────────────────────
          default: {
            const RESOURCE_KEY_MAP = {
              users: "users",
              categories: "categories",
              ingredients: "ingredients",
              combo: "combo",
              favourites: "favourites",
              staff: "staff",
              careers: "careers",
              holidays: "holidays",
              recipes: "recipes",
              offers: "offers",
              reservations: "reservations",
              celebrations: "celebrations",
              preBookings: "preBookings",
              cateringOrders: "cateringOrders",
              events: "events",
              eventBookings: "eventBookings",
              tables: "tables",
              serviceActivity: "serviceActivity",
              serviceSchedules: "serviceSchedules",
              kitchenActivity: "kitchenActivity",
              kitchenSchedules: "kitchenSchedules",
              tasks: "tasks",
              tablePreferences: "tablePreferences",
              combo_offers: "combo_offers",
            };
            const key = RESOURCE_KEY_MAP[resource];
            if (!key) return prev;

            // ── deleted: remove by id — NO async re-fetch ─────────────────
            // Re-fetching after delete races against the page component's own
            // setAdminData call: the fetch resolves ~50-200 ms later and writes
            // the stale list back, making the deleted row reappear until reload.
            if (action === "deleted") {
              const deletedId = payload?.id ?? payload;
              if (!deletedId) return prev;
              return {
                ...prev,
                [key]: (prev[key] || []).filter(
                  item => String(item.id) !== String(deletedId)
                )
              };
            }

            // ── created: append in place ──────────────────────────────────
            if (action === "created" && payload) {
              const alreadyExists = (prev[key] || []).some(
                item => String(item.id) === String(payload.id)
              );
              if (alreadyExists) return prev;
              return { ...prev, [key]: [...(prev[key] || []), payload] };
            }

            // ── updated: patch in place ───────────────────────────────────
            if (action === "updated" && payload) {
              const exists = (prev[key] || []).some(
                item => String(item.id) === String(payload.id)
              );
              if (!exists) return prev;
              return {
                ...prev,
                [key]: (prev[key] || []).map(item =>
                  String(item.id) === String(payload.id) ? payload : item
                )
              };
            }

            // ── unknown action: safe fallback re-fetch ────────────────────
            api.get(`/${resource}`).then(r => {
              setAdminData(p => ({ ...p, [key]: r.data || [] }));
            }).catch(() => { });
            return prev;
          }
        }
      });
    };

    socket.on("data-change", handleDataChange);

    // Booking notifications
    const handleNewBooking = ({ message, route }) => {
      toast.booking(message, () => navigate(route));
    };
    socket.on("new-booking", handleNewBooking);

    return () => {
      socket.off("data-change", handleDataChange);
      socket.off("new-booking", handleNewBooking);
    };
  }, [isAuthenticated]);

  /* ---------------- INGREDIENT CRUD ---------------- */
  const addIngredient = async (ingredient) => {
    try {
      await api.post("/ingredients", ingredient, { params: venueParam() });
    } catch (err) {
      console.error("Add ingredient failed:", err);
    }
  };

  const addStaff = async (staff) => {
    try {
      await api.post("/staff", staff, { params: venueParam() });
      // State update handled by socket data-change handler
    } catch (err) {
      console.error("Add staff failed:", err.response?.data || err.message);
    }
  };

  const updateStaff = async (id, updated) => {
    try {
      await api.put(`/staff/${id}`, updated);
      // State update handled by socket data-change handler
    } catch (err) {
      console.error("Update staff failed:", err.response?.data || err.message);
    }
  };

  const deleteStaff = async (id) => {
    try {
      await api.delete(`/staff/${id}`);
      setAdminData(prev => ({
        ...prev,
        staff: prev.staff.filter(s => s.id !== id)
      }));
    } catch (err) {
      console.error("Delete staff failed:", err.response?.data || err.message);
    }
  };

  const updateIngredient = async (id, updated) => {
    try {
      await api.put(`/ingredients/${id}`, updated);
      // State update handled by socket data-change handler
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
  // Wait for the initial GET /staff-auth/me check to resolve before
  // deciding whether to show the login screen — otherwise a logged-in
  // admin would flash the login page on every reload while the session
  // cookie is still being verified against the server.
  if (isAuthLoading) {
    return <PageLoader label="Checking session…" />;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Migrated accounts (created from HR staff records) carry a temp
  // password and mustResetPassword=true — block the app shell until
  // they set their own password.
  if (admin?.mustResetPassword) {
    return <ForcePasswordReset />;
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
          admin={admin}
          adminData={adminData}
          setAdminData={setAdminData}
        />

        <div className="page">
          {isAppLoading && (
            <PageLoader
              fill
              label={connectionError ? "Reconnecting to the server…" : "Connecting to the server…"}
            />
          )}
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

            <Route path="/profile" element={<Profile />} />
            <Route path="/todo" element={<Todo />} />

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

            <Route path="/combo-offers" element={<ComboOffers />} />

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
                  handleSort={handleSort}
                  sortConfig={sortConfig}
                />
              }
            />

            <Route path="/reservations" element={
              <Reservations adminData={adminData} setAdminData={setAdminData}
                filters={resFilters} patchFilters={patchRes}
                onResetFilters={resetResFilters}
              />} />
            <Route path="/reservations/:id" element={<ReservationDetails adminData={adminData} setAdminData={setAdminData} />} />

            <Route path="/celebrations" element={
              <Celebrations adminData={adminData} setAdminData={setAdminData}
                filters={celFilters} patchFilters={patchCel}
                onResetFilters={resetCelFilters}
              />} />
            <Route path="/celebrations/:id" element={<CelebrationDetails adminData={adminData} setAdminData={setAdminData} />} />

            <Route path="/prebookings" element={
              <PreBookings adminData={adminData} setAdminData={setAdminData}
                filters={preFilters} patchFilters={patchPre}
                onResetFilters={resetPreFilters}
              />} />
            <Route path="/prebookings/:id" element={<PreBookingDetails adminData={adminData} />} />

            <Route path="/catering" element={
              <Catering adminData={adminData} setAdminData={setAdminData}
                filters={catFilters} patchFilters={patchCat}
                onResetFilters={resetCatFilters}
              />} />
            <Route path="/catering/:id" element={<CateringDetails adminData={adminData} />} />

            <Route
              path="/events"
              element={
                <Events
                  adminData={adminData}
                  setAdminData={setAdminData}
                  filters={evtFilters}
                  patchFilters={patchEvt}
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
                  setAdminData={setAdminData}
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

            <Route path="/staff-salary" element={<StaffSalary adminData={adminData} setAdminData={setAdminData} />} />
            <Route path="/staff-career" element={<StaffCareer adminData={adminData} setAdminData={setAdminData} />} />
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

            <Route path="/venues" element={<Venues />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/category-cards" element={<CategoryCards />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/audit-logs/:id" element={<AuditLogDetails />} />

            <Route path="/documents" element={<Documents sortConfig={sortConfig} handleSort={handleSort} />} />
            <Route path="/documents/:docId" element={<DocumentDetails />} />
            <Route path="/bank-account" element={<BankAccount />} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;

// ─────────────────────────────────────────────────────
// Utility exports (shared across all pages)
// ─────────────────────────────────────────────────────

export const sortArray = (data, sortConfig) => {
  if (!sortConfig.key) return data;

  return [...data].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];

    if (aVal == null || bVal == null) return 0;

    if (typeof aVal === "string") {

      const aStr = (aVal ?? "").toLowerCase().trim();
      const bStr = (bVal ?? "").toLowerCase().trim();

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
        fontSize: "14px",
        fontWeight: 500
      }}
    >
      {message}
    </td>
  </tr>
);

// Same "no data" styling as EmptyRow, for card/grid pages that aren't
// tables (e.g. Events) — keeps the empty-state look consistent across
// every page regardless of layout.
export const EmptyState = ({ message = "No data available" }) => (
  <div
    style={{
      textAlign: "center",
      padding: "20px",
      color: "#777",
      fontSize: "14px",
      fontWeight: 500
    }}
  >
    {message}
  </div>
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
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
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

// ─────────────────────────────────────────────────────
// Date utilities
// ─────────────────────────────────────────────────────

// Safe local date key (NO timezone bug)
export const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Clean formatted date (UI)
export const getTodayFormatted = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("default", { month: "long" })} ${d.getFullYear()}`;
};

// Full readable date (optional)
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