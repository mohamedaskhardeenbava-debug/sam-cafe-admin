/**
 * Events.js  —  Sam Cafe Admin Panel
 * Events management page
 */

import React, { useState, useMemo, useRef } from "react";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import { DateRangeGroup, MultiPillGroup } from "../../components/FilterBar";
import { todayStr } from "../../utils/dateRangeUtils";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { allowTextInput } from "../../App";
import { EmptyState } from "../../App";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import CustomDropdown from "../../components/CustomDropdown";
import Button3D from "../../components/Button3D";
import useAnimatedModal from "../../hooks/useAnimatedModal";
import CollapseChevron from "../../components/CollapseChevron";
import CollapseSection from "../../components/CollapseSection";
import CurrentLocationToggle from "../../components/CurrentLocationToggle";
import { useVenue } from "../../context/VenueContext";
import { venueToAddressFields, emptyAddressFields } from "../../utils/resolveVenueAddress";

import "../Common.css";
import "./Events.css";
import "../ModalCSS.css";
import { fmtDate as formatDate } from "../../utils/dateUtils";
import { useTabLiquid } from "../../hooks/useTabLiquid";

// ─── helpers ────────────────────────────────────────────────────────────────
const generateId = (name) =>
  `evt_${name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const buildAddress = (f) => [
  f.addrDoorNo, f.addrStreet, f.addrArea,
  f.addrLandmark, f.addrCity, f.addrState, f.addrPincode,
].filter(Boolean).join(", ");

const STATUS_COLORS = {
  upcoming: "#2563eb",
  ongoing: "#16a34a",
  completed: "#6b7280",
  cancelled: "#dc2626",
};

const SPECIALIZED_PACKAGES = [
  { id: "full_planning", label: "Full Planning", desc: "End-to-end planning & execution", price: 80000 },
  { id: "partial_planning", label: "Partial Planning", desc: "We handle vendors & timelines", price: 40000 },
  { id: "day_coordination", label: "Day-of Coordination", desc: "On-the-day management only", price: 20000 },
];

const SPECIALIZED_ADDONS = [
  { id: "stage_decorations", label: "Stage Decorations", price: 15000 },
  { id: "catering", label: "Catering", pricePerGuest: 800 },
  { id: "makeup_artist", label: "Makeup Artist", price: 12000 },
  { id: "photography", label: "Photography & Videography", price: 20000 },
  { id: "dj_sound", label: "DJ & Sound", price: 10000 },
  { id: "lighting", label: "Lighting", price: 8000 },
  { id: "florist", label: "Floral Arrangements", price: 18000 },
  { id: "mc_host", label: "MC / Host", price: 7000 },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  eventType: "dining",
  date: "",
  time: "",
  bookingCloseDate: "",
  lastApplyDate: "",
  venueMode: "restaurant",
  venue: "Sam Cafe, Madurai",
  maxCapacity: "",
  price: "",
  images: [],
  tags: [],
  status: "upcoming",
  isPublished: true,
  highlights: [],
  dishes: [],
  dishQty: {},
  selectedCategory: "",
};

const EMPTY_SPEC_FORM = {
  title: "",
  eventCategory: "marriage",
  date: "",
  time: "",
  venue: "",
  addrDoorNo: "",
  addrStreet: "",
  addrArea: "",
  addrLandmark: "",
  addrCity: "",
  addrState: "",
  addrPincode: "",
  guests: 100,
  selectedCategory: "",
  description: "",
  selectedPackage: "full_planning",
  selectedAddons: { stage_decorations: true, catering: true, makeup_artist: true, photography: true },
  images: [],
  tags: [],
  highlights: [],
  dishes: [],
  dishQty: {},
  status: "upcoming",
  isPublished: true,
};

const EVENT_CATEGORIES = [
  { id: "marriage", label: "Marriage", baseFee: 50000 },
  { id: "birthday", label: "Birthday", baseFee: 15000 },
  { id: "corporate", label: "Corporate", baseFee: 30000 },
  { id: "anniversary", label: "Anniversary", baseFee: 20000 },
  { id: "graduation", label: "Graduation", baseFee: 12000 },
  { id: "babyshower", label: "Baby Shower", baseFee: 10000 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Main Component ─────────────────────────────────────────────────────────
const Events = ({ adminData, setAdminData, filters, patchFilters }) => {
  // ── Hooks

  const { toast } = useToast();
  const { currentVenue } = useVenue();
  const events = useMemo(
    () => adminData?.events ?? [],
    [adminData?.events]
  );

  const bookings = useMemo(
    () => adminData?.eventBookings ?? [],
    [adminData?.eventBookings]
  );

  const allDishes = useMemo(() => {
    const cats = adminData?.categories || [];
    const list = [];
    cats.forEach(cat => {
      (cat.subCategories || []).forEach(sub => {
        (sub.dishes || []).forEach(d => list.push({ ...d, subCat: sub.name, cat: cat.name }));
      });
      (cat.dishes || []).forEach(d => list.push({ ...d, subCat: cat.name, cat: cat.name }));
    });
    return list;
  }, [adminData]);

  // Destructure persisted filter state from App
  const { activeTab, filterEventId, filterStatuses, filterFromDate, filterToDate, searchQuery,
    bookingsDatePreset,
    evtSearch, evtFilterStatuses, evtFilterTypes, evtFilterPublish, evtFromDate, evtToDate, evtDatePreset } = filters;

  // ── Helpers

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const setActiveTab = (v) => patchFilters({ activeTab: v });
  const { containerRef: evtTabPillsRef, thumbStyle: evtTabThumbStyle } = useTabLiquid(activeTab);
  const setFilterEventId = (v) => patchFilters({ filterEventId: v });
  const setFilterStatuses = (v) => patchFilters({ filterStatuses: typeof v === "function" ? v(filterStatuses) : v });
  const setFilterFromDate = (v) => patchFilters({ filterFromDate: v });
  const setFilterToDate = (v) => patchFilters({ filterToDate: v });
  const setBookingsDatePreset = (v) => patchFilters({ bookingsDatePreset: v });
  const setSearchQuery = (v) => patchFilters({ searchQuery: v });
  const setEvtSearch = (v) => patchFilters({ evtSearch: v });
  const setEvtFilterStatuses = (v) => patchFilters({ evtFilterStatuses: typeof v === "function" ? v(evtFilterStatuses) : v });
  const setEvtFilterTypes = (v) => patchFilters({ evtFilterTypes: typeof v === "function" ? v(evtFilterTypes) : v });
  const setEvtFilterPublish = (v) => patchFilters({ evtFilterPublish: typeof v === "function" ? v(evtFilterPublish) : v });
  const setEvtFromDate = (v) => patchFilters({ evtFromDate: v });
  const setEvtToDate = (v) => patchFilters({ evtToDate: v });
  const setEvtDatePreset = (v) => patchFilters({ evtDatePreset: v });


  const [showForm, setShowForm] = useState(false);
  const formModal = useAnimatedModal("events-createEdit");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [showSpecForm, setShowSpecForm] = useState(false);
  const specModal = useAnimatedModal("events-specCreateEdit");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSpecEditMode, setIsSpecEditMode] = useState(false);
  const [editFormStep, setEditFormStep] = useState(1);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [specFormData, setSpecFormData] = useState(EMPTY_SPEC_FORM);
  const [specFormStep, setSpecFormStep] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [specFormErrors, setSpecFormErrors] = useState({});
  const [tagInput, setTagInput] = useState("");
  const [highlightInput, setHighlightInput] = useState("");
  const [specTagInput, setSpecTagInput] = useState("");
  const [specHighlightInput, setSpecHighlightInput] = useState("");
  const [viewBooking, setViewBooking] = useState(null);
  const bookingDetailModal = useAnimatedModal("events-bookingDetail");
  const [addGuestCount, setAddGuestCount] = useState(1);
  const [addGuestSaving, setAddGuestSaving] = useState(false);
  const [useRestaurantAddrSpec, setUseRestaurantAddrSpec] = useState(true);

  // Booking table sorting — local only, no need to persist
  const [bookSortKey, setBookSortKey] = useState("bookedAt");
  const [bookSortDir, setBookSortDir] = useState("desc");

  const fileInputRef = useRef();
  const specFileInputRef = useRef();

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (filterEventId !== "all") list = list.filter((b) => b.eventId === filterEventId);
    if (filterStatuses.size > 0) list = list.filter((b) => filterStatuses.has(b.status || "pending"));
    if (filterFromDate) list = list.filter((b) => {
      const d = (b.bookedAt || b.date || "").slice(0, 10);
      return d >= filterFromDate;
    });
    if (filterToDate) list = list.filter((b) => {
      const d = (b.bookedAt || b.date || "").slice(0, 10);
      return d <= filterToDate;
    });
    if (searchQuery.trim())
      list = list.filter(
        (b) =>
          b.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.phone?.includes(searchQuery)
      );

    return [...list].sort((a, b) => {
      const aVal = String(a[bookSortKey] ?? "").toLowerCase();
      const bVal = String(b[bookSortKey] ?? "").toLowerCase();
      return bookSortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [bookings, filterEventId, filterStatuses, filterFromDate, filterToDate, searchQuery, bookSortKey, bookSortDir]);

  const toggleBookSort = (key) => {
    if (bookSortKey === key) setBookSortDir(d => d === "asc" ? "desc" : "asc");
    else { setBookSortKey(key); setBookSortDir("asc"); }
  };

  const filteredEvents = useMemo(() => {
    let list = events;
    if (evtSearch.trim()) {
      const q = evtSearch.toLowerCase();
      list = list.filter(e =>
        (e.title || "").toLowerCase().includes(q) ||
        (e.venue || "").toLowerCase().includes(q) ||
        (e.categoryLabel || e.eventType || "").toLowerCase().includes(q)
      );
    }
    if (evtFilterStatuses.size > 0) {
      list = list.filter(e => evtFilterStatuses.has(e.status));
    }
    if (evtFilterTypes.size > 0) list = list.filter(e => evtFilterTypes.has(e.eventType || "") || evtFilterTypes.has((e.categoryLabel || "").toLowerCase()));
    if (evtFilterPublish.size > 0 && !(evtFilterPublish.has("live") && evtFilterPublish.has("draft"))) {
      if (evtFilterPublish.has("live")) list = list.filter(e => e.isPublished);
      else if (evtFilterPublish.has("draft")) list = list.filter(e => !e.isPublished);
    }
    if (evtFromDate) list = list.filter(e => (e.date || "") >= evtFromDate);
    if (evtToDate) list = list.filter(e => (e.date || "") <= evtToDate);
    return list;
  }, [events, evtSearch, evtFilterStatuses, evtFilterTypes, evtFilterPublish, evtFromDate, evtToDate]);

  const exportEvents = () => {
    if (!filteredEvents.length) { toast.warning("No events to export"); return; }
    const rows = filteredEvents.map(evt => {
      const stats = statsForEvent(evt.id);
      return {
        Title: evt.title || "—",
        Type: evt.categoryLabel || evt.eventType || "—",
        Date: evt.date || "—",
        Time: evt.time || "—",
        Venue: evt.venue || "—",
        "Max Capacity": evt.maxCapacity || 0,
        "Price (₹)": evt.price || 0,
        "Total Bookings": stats.total,
        Confirmed: stats.confirmed,
        Pending: stats.pending,
        Status: evt.status || "—",
        Published: evt.isPublished ? "Live" : "Draft",
        Specialized: evt.isSpecialized ? "Yes" : "No",
      };
    });
    exportToExcel({ rows, sheetName: "Events", fileName: `events_${new Date().toISOString().slice(0, 10)}.xlsx` });
  };

  const exportBookings = () => {
    if (!filteredBookings.length) { toast.warning("No bookings to export"); return; }
    const rows = filteredBookings.map((b) => {
      const evt = events.find((e) => e.id === b.eventId);
      return {
        Name: b.name || "—",
        Email: b.email || "—",
        Phone: b.phone || "—",
        Event: evt?.title || b.eventId || "—",
        "Booked On": (b.bookedAt || b.date || "—").slice(0, 10),
        Guests: b.guests ?? "—",
        Amount: b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—",
        Status: b.status || "—",
      };
    });
    const suffix = filterFromDate && filterToDate
      ? `${filterFromDate}_to_${filterToDate}`
      : new Date().toISOString().slice(0, 10);
    exportToExcel({ rows, sheetName: "Event Bookings", fileName: `event_bookings_${suffix}.xlsx` });
  };

  const BookSortIcon = ({ col }) => (
    <span className="sort-arrow">
      {bookSortKey === col ? (bookSortDir === "asc" ? "▲" : "▼") : "▼"}
    </span>
  );

  const statsForEvent = (eventId) => ({
    total: bookings.filter((b) => b.eventId === eventId).length,
    confirmed: bookings.filter((b) => b.eventId === eventId && b.status === "confirmed").length,
    pending: bookings.filter((b) => b.eventId === eventId && b.status === "pending").length,
  });

  const specTotal = useMemo(() => {
    const cat = EVENT_CATEGORIES.find(c => c.id === specFormData.eventCategory);
    const baseFee = cat?.baseFee || 0;
    const pkg = SPECIALIZED_PACKAGES.find(p => p.id === specFormData.selectedPackage);
    const pkgPrice = pkg?.price || 0;
    const addonsTotal = SPECIALIZED_ADDONS.reduce((sum, addon) => {
      if (!specFormData.selectedAddons[addon.id]) return sum;
      if (addon.pricePerGuest) return sum + (addon.pricePerGuest * (specFormData.guests || 0));
      return sum + addon.price;
    }, 0);
    return baseFee + pkgPrice + addonsTotal;
  }, [specFormData.eventCategory, specFormData.selectedPackage, specFormData.selectedAddons, specFormData.guests]);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const deleteConfirmModal = useAnimatedModal("events-deleteConfirm");


  const resetForm = () => {
    formModal.close(() => setShowForm(false));
    setIsEditMode(false);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setTagInput("");
    setHighlightInput("");
    setEditFormStep(1);
  };

  const clearSpecFormFields = () => {
    setIsSpecEditMode(false);
    setSpecFormData({ ...EMPTY_SPEC_FORM, ...venueToAddressFields(currentVenue) });
    setSpecFormErrors({});
    setSpecFormStep(1);
    setSpecTagInput("");
    setSpecHighlightInput("");
    setUseRestaurantAddrSpec(true);
  };

  const resetSpecForm = () => {
    specModal.close(() => setShowSpecForm(false));
    clearSpecFormFields();
  };

  const openSpecAdd = () => { clearSpecFormFields(); setShowSpecForm(true); specModal.open(); };

  const openSpecEdit = (evt) => {
    setSpecFormData({ ...EMPTY_SPEC_FORM, ...evt, images: evt.images || (evt.image ? [evt.image] : []) });
    const venueLine = venueToAddressFields(currentVenue).venue;
    setUseRestaurantAddrSpec(!!venueLine && evt.venue === venueLine);
    setIsSpecEditMode(true);
    setSpecFormStep(1);
    setShowSpecForm(true);
    specModal.open();
  };

  const openEdit = (evt) => {
    setFormData({ ...EMPTY_FORM, ...evt, images: evt.images || (evt.image ? [evt.image] : []) });
    setIsEditMode(true);
    setEditFormStep(1);
    setShowForm(true);
    formModal.open();
  };

  const handleImagesUpload = (e, isSpec = false) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isSpec) {
          setSpecFormData(p => ({ ...p, images: [...(p.images || []), reader.result] }));
        } else {
          setFormData(p => ({ ...p, images: [...(p.images || []), reader.result] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx, isSpec = false) => {
    if (isSpec) {
      setSpecFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
    } else {
      setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
    }
  };

  const validateEvtStep = (step) => {
    const e = {};
    if (step === 1) {
      if (!formData.title.trim()) e.title = true;
      if (!formData.date) e.date = true;
    }
    if (step === 2) {
      if (!formData.venue?.trim()) e.venue = true;
      if (!formData.maxCapacity || Number(formData.maxCapacity) < 1) e.maxCapacity = true;
    }
    if (step === 3) {
      if (!formData.description?.trim()) e.description = true;
    }
    setFormErrors(prev => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  };

  const validateSpecStep = (step) => {
    const e = {};
    if (step === 1) {
      if (!specFormData.title.trim()) e.title = true;
      if (!specFormData.date) e.date = true;
      if (!specFormData.guests || Number(specFormData.guests) < 1) e.guests = true;
      if (!useRestaurantAddrSpec) {
        if (!specFormData.addrDoorNo?.trim()) e.addrDoorNo = true;
        if (!specFormData.addrStreet?.trim()) e.addrStreet = true;
        if (!specFormData.addrArea?.trim()) e.addrArea = true;
        if (!specFormData.addrCity?.trim()) e.addrCity = true;
        if (!specFormData.addrState?.trim()) e.addrState = true;
        if (!specFormData.addrPincode || specFormData.addrPincode.length !== 6) e.addrPincode = true;
      }
    }
    // Steps 2 (package) and 3 (dishes) previously had no validation at
    // all — forward-jumping the tab pill (or Next) could reach Preview
    // with no package chosen and no dishes selected. toast is used
    // instead of inline field errors here since these are selection
    // grids, not text inputs with an error-state style.
    if (step === 2 && !specFormData.selectedPackage) {
      toast.error("Choose a package before continuing");
      e.selectedPackage = true;
    }
    if (step === 3 && (!specFormData.dishes || specFormData.dishes.length === 0)) {
      toast.error("Select at least one dish before continuing");
      e.dishes = true;
    }
    setSpecFormErrors(prev => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.date) {
      toast.error("Title and Date are required.");
      return;
    }
    if (!formData.venue?.trim() || !formData.maxCapacity || Number(formData.maxCapacity) < 1) {
      toast.error("Venue and capacity are required.");
      setEditFormStep(2);
      return;
    }
    if (!formData.description?.trim()) {
      toast.error("Description is required.");
      setEditFormStep(3);
      return;
    }
    if (!formData.dishes?.length) {
      toast.error("Select at least one dish for the menu.");
      setEditFormStep(4);
      return;
    }
    // FIX: always use string ID for new events to avoid lodash-id 500 errors
    const payload = {
      ...formData,
      id: isEditMode ? formData.id : generateId(formData.title),
      image: formData.images?.[0] || "",
      maxCapacity: Number(formData.maxCapacity) || 0,
      price: Number(formData.price) || 0,
    };

    try {
      if (isEditMode) {
        await api.put(`/events/${payload.id}`, payload);
        setAdminData((p) => ({
          ...p,
          events: p.events.map((e) => (e.id === payload.id ? payload : e)),
        }));
        toast.success("Event updated successfully.");
      } else {
        await api.post("/events", payload);
        // Use local payload (not res.data) to avoid duplicates when adminData re-fetches
        setAdminData((p) => {
          const existing = p.events || [];
          // Deduplicate: if somehow ID already present, replace it
          const deduped = existing.filter(e => e.id !== payload.id);
          return { ...p, events: [...deduped, payload] };
        });
        toast.success("Event created successfully.");
      }
      resetForm();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save event. Please try again.");
    }
  };

  const handleSpecSave = async () => {
    if (!specFormData.title.trim() || !specFormData.date) {
      toast.error("Title and Date are required.");
      setSpecFormStep(1);
      return;
    }
    if (!specFormData.selectedPackage) {
      toast.error("Choose a package before saving.");
      setSpecFormStep(2);
      return;
    }
    if (!specFormData.dishes?.length) {
      toast.error("Select at least one dish for the menu.");
      setSpecFormStep(3);
      return;
    }
    const cat = EVENT_CATEGORIES.find(c => c.id === specFormData.eventCategory);
    const pkg = SPECIALIZED_PACKAGES.find(p => p.id === specFormData.selectedPackage);
    const payload = {
      ...specFormData,
      id: isSpecEditMode ? specFormData.id : generateId(specFormData.title),
      eventType: "special",
      isSpecialized: true,
      image: specFormData.images?.[0] || "",
      price: specTotal,
      packageLabel: pkg?.label || "",
      categoryLabel: cat?.label || "",
      maxCapacity: specFormData.guests || 0,
    };
    try {
      if (isSpecEditMode) {
        await api.put(`/events/${payload.id}`, payload);
        setAdminData((p) => ({
          ...p,
          events: p.events.map((e) => (e.id === payload.id ? payload : e)),
        }));
        toast.success("Specialized event updated successfully.");
      } else {
        await api.post("/events", payload);
        setAdminData((p) => {
          const existing = p.events || [];
          const deduped = existing.filter(e => e.id !== payload.id);
          return { ...p, events: [...deduped, payload] };
        });
        toast.success("Specialized event created successfully.");
      }
      resetSpecForm();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save event. Please try again.");
    }
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    deleteConfirmModal.close(() => setConfirmDeleteId(null));
    // Optimistic update first — remove from UI immediately
    const snapshot = adminData.events || [];
    const bookingsSnapshot = adminData.eventBookings || [];
    setAdminData((p) => ({
      ...p,
      events: (p.events || []).filter((e) => String(e.id) !== String(id)),
      eventBookings: (p.eventBookings || []).filter((b) => String(b.eventId) !== String(id)),
    }));
    try {
      await api.delete(`/events/${id}`);
      toast.success("Event deleted.");
    } catch (err) {
      console.error("Delete failed:", err);
      // Rollback on failure
      setAdminData((p) => ({
        ...p,
        events: snapshot,
        eventBookings: bookingsSnapshot,
      }));
      toast.error("Failed to delete event. Please try again.");
    }
  };

  const handleTogglePublish = async (evt) => {
    const updated = { ...evt, isPublished: !evt.isPublished };
    try {
      await api.put(`/events/${evt.id}`, updated);
      setAdminData((p) => ({
        ...p,
        events: p.events.map((e) => (e.id === evt.id ? updated : e)),
      }));
      toast.success(updated.isPublished ? "Event published." : "Event unpublished.");
    } catch (err) {
      console.error("Toggle publish failed:", err);
      toast.error("Failed to update event. The event may have an invalid ID format.");
    }
  };

  const handleBookingStatus = async (bookingId, newStatus) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const updated = { ...booking, status: newStatus };
    try {
      await api.put(`/eventBookings/${bookingId}`, updated);
      setAdminData((p) => ({
        ...p,
        eventBookings: p.eventBookings.map((b) => (b.id === bookingId ? updated : b)),
      }));
      if (viewBooking?.id === bookingId) setViewBooking(updated);
    } catch (err) {
      toast.error("Failed to update booking status.");
    }
  };

  const handleAddGuests = async (bookingId, extraGuests) => {
    if (!extraGuests || extraGuests < 1) return;
    setAddGuestSaving(true);
    try {
      const booking = bookings.find((b) => b.id === bookingId);
      if (!booking) return;
      const evt = (adminData?.events || []).find(e => e.id === booking.eventId);
      const pricePerGuest = Number(evt?.price || 0);
      const newGuests = (Number(booking.guests) || 1) + extraGuests;
      const newAmount = newGuests * pricePerGuest;
      const updated = { ...booking, guests: newGuests, totalAmount: newAmount };
      await api.put(`/eventBookings/${bookingId}`, updated);
      setAdminData((p) => ({
        ...p,
        eventBookings: p.eventBookings.map((b) => (b.id === bookingId ? updated : b)),
      }));
      setViewBooking(updated);
      setAddGuestCount(1);
      toast.success("Guest count updated.");
    } catch (err) {
      console.error("Add guests failed", err);
      toast.error("Failed to update guest count. Please try again.");
    } finally {
      setAddGuestSaving(false);
    }
  };

  const toggleAddon = (id) => {
    setSpecFormData(p => ({
      ...p,
      selectedAddons: { ...p.selectedAddons, [id]: !p.selectedAddons[id] }
    }));
  };

  const toggleDish = (dishId, isSpec = false) => {
    if (isSpec) {
      setSpecFormData(p => {
        const dishes = p.dishes || [];
        const dishQty = { ...(p.dishQty || {}) };
        if (dishes.includes(dishId)) {
          delete dishQty[dishId];
          return { ...p, dishes: dishes.filter(d => d !== dishId), dishQty };
        }
        dishQty[dishId] = 1;
        return { ...p, dishes: [...dishes, dishId], dishQty };
      });
    } else {
      setFormData(p => {
        const dishes = p.dishes || [];
        const dishQty = { ...(p.dishQty || {}) };
        if (dishes.includes(dishId)) {
          delete dishQty[dishId];
          return { ...p, dishes: dishes.filter(d => d !== dishId), dishQty };
        }
        dishQty[dishId] = 1;
        return { ...p, dishes: [...dishes, dishId], dishQty };
      });
    }
  };

  // ── Category-based Dish Selector ──
  const DishSelector = ({ selectedDishes, onToggle, activeCat, onCatChange, isSpec = false, hideSelectedTable = false, dishQty = {}, guests = 1 }) => {
    const categories = adminData?.categories || [];
    const catObj = categories.find(c => c.id === activeCat);
    let catDishes = [];
    if (catObj) {
      if (catObj.subCategories?.length) {
        catObj.subCategories.forEach(sub => {
          (sub.dishes || []).forEach(d => catDishes.push({ ...d, subCat: sub.name }));
        });
      }
      (catObj.dishes || []).forEach(d => catDishes.push({ ...d, subCat: catObj.name }));
    } else {
      // No category selected → show all dishes across all categories
      categories.forEach(cat => {
        if (cat.subCategories?.length) {
          cat.subCategories.forEach(sub => {
            (sub.dishes || []).forEach(d => catDishes.push({ ...d, subCat: sub.name }));
          });
        }
        (cat.dishes || []).forEach(d => catDishes.push({ ...d, subCat: cat.name }));
      });
    }
    const selectedDetails = (selectedDishes || []).map(id => allDishes.find(d => d.id === id)).filter(Boolean);
    const effectiveQty = (id) => dishQty[id] ?? guests ?? 1;
    const dishesTotalPrice = selectedDetails.reduce((sum, d) => sum + Number(d.basePrice || 0) * effectiveQty(d.id), 0);

    const isSelected = (id) => (selectedDishes || []).includes(id);

    return (
      <div className="ae-dish-selector-v2">
        <CustomDropdown
          value={activeCat}
          onChange={onCatChange}
          options={[
            { value: "", label: "All Categories" },
            ...categories.map(cat => ({ value: cat.id, label: cat.name })),
          ]}
        />

        {catDishes.length > 0 && (
          <div className="act-dish-grid">
            {catDishes.map(dish => {
              const sel = isSelected(dish.id);
              return (
                <div key={dish.id} className={`act-dish-card${sel ? " selected" : ""}`}>
                  <div className="act-dish-info">
                    <span className="act-dish-name">{dish.name}</span>
                    {dish.subCat && <span className="act-dish-cat">{dish.subCat}</span>}
                    <span className="act-dish-price">₹{dish.basePrice}</span>
                  </div>
                  {sel ? (
                    <Button3D iconOnly onClick={() => onToggle(dish.id)}>✓ Added</Button3D>
                  ) : (
                    <Button3D variant="cancel" iconOnly onClick={() => onToggle(dish.id)}>+ Add</Button3D>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {catDishes.length === 0 && <p className="ae-dish-empty" style={{ textAlign: "center", padding: "24px 0" }}>No dishes available.</p>}

        {selectedDetails.length > 0 && !hideSelectedTable && (
          <div className="ae-selected-dishes-table">
            <div className="ae-sdt-header">
              <span>Selected Menu Dishes</span>
              <span>{selectedDetails.length} dish(es) · Food Total: <strong>₹{dishesTotalPrice.toLocaleString("en-IN")}</strong></span>
            </div>
            <table className="ae-sdt">
              <thead>
                <tr><th className="icon-width">#</th><th>Dish</th><th>Category</th><th>Qty (guests)</th><th>Price</th><th></th></tr>
              </thead>
              <tbody>
                {selectedDetails.map((d, i) => (
                  <tr key={d.id}>
                    <td className="icon-width">{i + 1}</td>
                    <td><div className="ae-sdt-dish"><span>{d.name}</span></div></td>
                    <td className="ae-sdt-cat">{d.subCat || d.cat || "—"}</td>
                    <td style={{ textAlign: "center" }}>{effectiveQty(d.id)}</td>
                    <td className="ae-sdt-price">₹{(Number(d.basePrice || 0) * effectiveQty(d.id)).toLocaleString("en-IN")}</td>
                    <td><button type="button" className="ae-sdt-remove" onClick={() => onToggle(d.id)} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Remove">×</button></td>
                  </tr>
                ))}
                <tr className="ae-sdt-total-row">
                  <td colSpan="4"><strong>Food Total</strong></td>
                  <td colSpan="2"><strong>₹{dishesTotalPrice.toLocaleString("en-IN")}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const ImageUploadBlock = ({ images, onUpload, onRemove, inputRef, isSpec }) => (
    <div className="ae-image-upload-block">
      <div className="ae-image-thumbs">
        {(images || []).map((img, i) => (
          <div key={i} className="ae-image-thumb">
            <img src={img} alt={`img-${i}`} />
            <button type="button" className="ae-thumb-remove" onClick={() => onRemove(i, isSpec)}>×</button>
          </div>
        ))}
        <label className="ae-image-add-btn" onClick={() => inputRef.current?.click()}>+ Add</label>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onUpload(e, isSpec)} />
    </div>
  );

  return (
    <div className="inner-page evt-page">
      {/* PAGE HEADER */}
      <div className="evt-header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed(prev => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="evt-title">Events</h2>
              <span className="result-count">
                {activeTab === "events"
                  ? `${filteredEvents.length} event(s)`
                  : `${filteredBookings.length} result(s)`}
              </span>
            </div>
            <p className="evt-subtitle">Manage restaurant events &amp; track bookings</p>
          </div>
        </div>
        <div className="ae-header-actions">
          <div className="app-tab-pills" ref={evtTabPillsRef}>
            <span className="app-tab-pill-liquid" style={evtTabThumbStyle} />
            <button className={`app-tab-pill ${activeTab === "events" ? "active" : ""}`} onClick={() => setActiveTab("events")}>
              Events
              <span className="ae-badge">{filteredEvents.length}/{events.length}</span>
            </button>
            <button className={`app-tab-pill ${activeTab === "bookings" ? "active" : ""}`} onClick={() => setActiveTab("bookings")}>
              Bookings
              <span className="ae-badge ae-badge-purple">{filteredBookings.length}/{bookings.length}</span>
            </button>
          </div>
          {activeTab === "events" && (
            <div className="ae-btn-group">
              <Button3D onClick={openSpecAdd}>Create Event</Button3D>
            </div>
          )}
        </div>
      </div>

      {/* EVENTS TAB */}
      {activeTab === "events" && (
        <>
          {/* EVENTS FILTER BAR */}
          <CollapseSection collapsed={headerCollapsed}>
            <div className="filter-bar">
              <div className="ae-events-filter-top">
                <input
                  className="search-input"
                  placeholder=" Search title, venue, type…"
                  value={evtSearch}
                  onChange={e => setEvtSearch(allowTextInput(evtSearch, e.target.value, 100, 5))}
                />
                <Button3D onClick={exportEvents}>Export</Button3D>
              </div>
              <div className="filter-groups">
                {/* Status */}
                <MultiPillGroup
                  label="Status"
                  labelClass="ae-filter-group-label"
                  options={[
                    ["upcoming", "Upcoming"],
                    ["ongoing", "Ongoing"],
                    ["completed", "Completed"],
                    ["cancelled", "Cancelled"],
                  ]}
                  value={evtFilterStatuses}
                  onToggle={(key) => toggleSet(setEvtFilterStatuses, key)}
                />
                {/* Date quick presets + range */}
                <DateRangeGroup
                  from={evtFromDate}
                  to={evtToDate}
                  onChangeFrom={setEvtFromDate}
                  onChangeTo={setEvtToDate}
                  preset={evtDatePreset}
                  onChangePreset={setEvtDatePreset}
                  presets={[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]]}
                  labelClass="ae-filter-group-label"
                  noMax
                />
                {/* Type */}
                <MultiPillGroup
                  label="Type"
                  labelClass="ae-filter-group-label"
                  options={[
                    ["dining", "Dining"],
                    ["special", "Special"],
                    ["private", "Private"],
                    ["seasonal", "Seasonal"],
                    ["live", "Live"],
                    ["workshop", "Workshop"],
                  ]}
                  value={evtFilterTypes}
                  onToggle={(key) => toggleSet(setEvtFilterTypes, key)}
                />
                {/* Publish */}
                <MultiPillGroup
                  label="Publish"
                  labelClass="ae-filter-group-label"
                  options={[["live", "Live"], ["draft", "Draft"]]}
                  value={evtFilterPublish}
                  onToggle={(key) => toggleSet(setEvtFilterPublish, key)}
                />
                {/* Clear + count */}
                {(evtSearch || evtFilterStatuses.size > 0 || evtFilterTypes.size > 0 || evtFilterPublish.size > 0 || evtFromDate || evtToDate) && (
                  <button className="ae-clear-filter" onClick={() => {
                    setEvtSearch(""); setEvtFilterStatuses(new Set());
                    setEvtFilterTypes(new Set()); setEvtFilterPublish(new Set());
                    setEvtFromDate(""); setEvtToDate(""); setEvtDatePreset("");
                  }}>Clear</button>
                )}
              </div>
            </div>
          </CollapseSection>

          <div className="ae-events-scroll">
            {filteredEvents.length === 0 ? (
              <EmptyState message={events.length === 0 ? "No events yet. Create your first event!" : "No events match the current filters."} />
            ) : (
              <div className="ae-events-grid">
                {filteredEvents.map((evt) => {
                  const stats = statsForEvent(evt.id);
                  const pct = evt.maxCapacity
                    ? Math.min(100, Math.round((stats.confirmed / evt.maxCapacity) * 100))
                    : 0;
                  const images = evt.images?.length ? evt.images : (evt.image ? [evt.image] : []);
                  return (
                    <div className="ae-event-card" key={evt.id}>
                      <div className="ae-event-card-image">
                        {images.length > 0 ? (
                          <div className="ae-card-carousel">
                            {images.map((img, i) => (
                              <img key={i} src={img} alt={evt.title} className={i === 0 ? "active" : ""} />
                            ))}
                            {images.length > 1 && <span className="ae-img-count">+{images.length - 1}</span>}
                          </div>
                        ) : (
                          <div className="ae-event-card-placeholder">Event</div>
                        )}
                        <span className="ae-status-badge" style={{ background: STATUS_COLORS[evt.status] }}>
                          {evt.status}
                        </span>
                        <span className={`ae-publish-dot ${evt.isPublished ? "published" : "draft"}`}>
                          {evt.isPublished ? "Live" : "Draft"}
                        </span>
                        {evt.isSpecialized && <span className="ae-spec-badge">Specialized</span>}
                      </div>

                      <div className="ae-event-card-body">
                        <div className="ae-event-type-tag">{evt.categoryLabel || evt.eventType}</div>
                        <h3 className="ae-event-title">{evt.title}</h3>
                        <p className="ae-event-desc">{evt.description}</p>

                        <div className="ae-event-meta">
                          <span>{formatDate(evt.date)}</span>
                          {evt.time && <span>{evt.time}</span>}
                          {evt.venue && <span>{evt.venue}</span>}
                          <span>{evt.price === 0 || !evt.price ? "Free" : `₹${Number(evt.price).toLocaleString("en-IN")}`}</span>
                        </div>

                        {evt.dishes?.length > 0 && (
                          <div className="ae-event-dishes-preview">
                            {evt.dishes.length} dish(es) on menu
                          </div>
                        )}

                        {evt.maxCapacity > 0 && (
                          <div className="ae-capacity-bar">
                            <div className="ae-capacity-label">
                              <span>Capacity</span>
                              <span>{stats.confirmed}/{evt.maxCapacity} confirmed</span>
                            </div>
                            <div className="ae-progress-track">
                              <div className="ae-progress-fill" style={{ width: `${pct}%`, background: pct >= 90 ? "#dc2626" : pct >= 60 ? "#f59e0b" : "#16a34a" }} />
                            </div>
                          </div>
                        )}

                        <div className="ae-mini-stats">
                          <div className="ae-mini-stat"><span className="ae-mini-val">{stats.total}</span><span className="ae-mini-label">Total</span></div>
                          <div className="ae-mini-stat"><span className="ae-mini-val" style={{ color: "#16a34a" }}>{stats.confirmed}</span><span className="ae-mini-label">Confirmed</span></div>
                          <div className="ae-mini-stat"><span className="ae-mini-val" style={{ color: "#f59e0b" }}>{stats.pending}</span><span className="ae-mini-label">Pending</span></div>
                        </div>
                      </div>

                      <div className="ae-event-card-footer">
                        <button className="ae-card-btn ae-view-btn" onClick={() => { setFilterEventId(evt.id); setActiveTab("bookings"); }}>View Bookings</button>
                        <button className="ae-card-btn ae-edit-btn" onClick={() => evt.isSpecialized ? openSpecEdit(evt) : openEdit(evt)}>Edit</button>
                        <button className={`ae-card-btn ae-publish-btn ${evt.isPublished ? "unpublish" : "publish"}`} onClick={() => handleTogglePublish(evt)}>
                          {evt.isPublished ? "Unpublish" : "Publish"}
                        </button>
                        <button className="ae-card-btn ae-delete-btn" onClick={() => { setConfirmDeleteId(evt.id); deleteConfirmModal.open(); }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* BOOKINGS TAB */}
      {activeTab === "bookings" && (
        <div className="admin-events-page">
          {!headerCollapsed && (
            <div className="filter-bar">
              <div className="ae-events-filter-top">
                <input type="text" placeholder="Search by name, email or phone…" className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(allowTextInput(searchQuery, e.target.value, 100, 5))} />

                <Button3D onClick={exportBookings} style={{ marginLeft: "auto" }}>Export</Button3D>

                <DateRangeGroup
                  from={filterFromDate}
                  to={filterToDate}
                  onChangeFrom={setFilterFromDate}
                  onChangeTo={setFilterToDate}
                  preset={bookingsDatePreset}
                  onChangePreset={setBookingsDatePreset}
                  presets={[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["lastMonth", "Last Month"]]}
                  periodLabel="period"
                  showPresets
                  noMax
                />
              </div>

              <div className="filter-groups">
                <div className="filter-group">
                  <span className="filter-group-label">Event</span>
                  <CustomDropdown
                    value={filterEventId}
                    onChange={setFilterEventId}
                    options={[
                      { value: "all", label: "All Events" },
                      ...events.map(e => ({ value: e.id, label: e.title })),
                    ]}
                  />
                </div>

                {/* Status pills */}
                <MultiPillGroup
                  label="Status"
                  options={[
                    ["pending", "P", "clb-status-pending", "Pending"],
                    ["confirmed", "C", "clb-status-confirmed", "Confirmed"],
                    ["cancelled", "X", "clb-status-cancelled", "Cancelled"],
                  ]}
                  value={filterStatuses}
                  onToggle={(key) => toggleSet(setFilterStatuses, key)}
                />

                {(filterEventId !== "all" || filterStatuses.size > 0 || searchQuery || filterFromDate || filterToDate) && (
                  <button className="evt-clb-clear-btn" onClick={() => {
                    setFilterEventId("all"); setFilterStatuses(new Set());
                    setSearchQuery(""); setFilterFromDate(""); setFilterToDate("");
                  }}>Clear</button>
                )}

              </div>
            </div>
          )}

          <div className="table-wrapper">
            {filteredBookings.length === 0 ? (
              <div className="ae-empty-state"><p>No bookings found.</p></div>
            ) : (
              <table >
                <thead>
                  <tr>
                    <th>#</th>
                    <th onClick={() => toggleBookSort("name")} className={bookSortKey === "name" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Name</span>
                        <BookSortIcon col="name" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("eventId")} className={bookSortKey === "eventId" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Event</span>
                        <BookSortIcon col="eventId" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("bookedAt")} className={bookSortKey === "bookedAt" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Date</span>
                        <BookSortIcon col="bookedAt" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("guests")} className={bookSortKey === "guests" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Guests</span>
                        <BookSortIcon col="guests" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("totalAmount")} className={bookSortKey === "totalAmount" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Amount</span>
                        <BookSortIcon col="totalAmount" />
                      </span>
                    </th>
                    <th onClick={() => toggleBookSort("status")} className={bookSortKey === "status" ? "sorted" : ""}>
                      <span className="th-content sort-th">
                        <span>Status</span>
                        <BookSortIcon col="status" />
                      </span>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b, i) => {
                    const evt = events.find((e) => e.id === b.eventId);
                    return (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td>
                          <div className="ae-booking-name">{b.name}</div>
                          <div className="ae-booking-email">{b.email}</div>
                        </td>
                        <td>{evt?.title || b.eventId}</td>
                        <td>{formatDate(b.bookedAt || b.date)}</td>
                        <td>{b.guests}</td>
                        <td>{b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—"}</td>
                        <td>
                          <div className="evt-res-inline-status">
                            {["pending", "confirmed", "cancelled"].map(s => (
                              <button key={s} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={s}
                                className={`evt-res-istatus-btn evt-res-istatus-${s}${b.status === s ? " active" : ""}`}
                                onClick={() => handleBookingStatus(b.id, s)}>
                                {s === "pending" ? "P" : s === "confirmed" ? "C" : "X"}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="ae-booking-actions">
                            <Button3D variant="cancel" iconOnly onClick={() => { setViewBooking(b); bookingDetailModal.open(); }}>View</Button3D>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formModal.shouldRender && (
        <div className={`event-modal-overlay ${formModal.overlayClass}`}>
          <div className={`event-modal ae-event-modal ${formModal.modalClass}`}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "flex-start" }}>
                <h3>{isEditMode ? "Edit Event" : "Create New Event"}</h3>
                <div className="ecard">
                  {["Details", "Venue & Capacity", "Content", "Dishes & Preview"].map((s, i) => (
                    <button key={i} className={`ebutton ${editFormStep === i + 1 ? "active" : ""} ${editFormStep > i + 1 ? "done" : ""}`} onClick={() => {
                      if (i + 1 > editFormStep) {
                        for (let s = editFormStep; s < i + 1; s++) {
                          if (!validateEvtStep(s)) return;
                        }
                      }
                      setEditFormStep(i + 1);
                    }}>
                      <span className="eevt-step-num">{editFormStep > i + 1 ? "✓" : i + 1}</span>
                      <span className="eevt-step-label">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => { resetForm(); setFormErrors({}); }} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>

            <div className="event-modal-body ae-event-form-body">

              {/* STEP 1 — Details */}
              {editFormStep === 1 && (
                <>
                  <div className="admin-form-group">
                    <div className="mat">
                      <input className={`mat-input${formErrors.title ? " mat-error" : ""}`} type="text" value={formData.title} onChange={(e) => { setFormData((p) => ({ ...p, title: allowTextInput(p.title, e.target.value, 100, 5) })); setFormErrors(p => ({ ...p, title: false })); }} placeholder=" " />
                      <label className={`mat-label${formErrors.title ? " mat-label-error" : ""}`}>Event Title <span className="rf-req">*</span></label>
                      <span className={`mat-bar${formErrors.title ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label>Event Type</label>
                      <CustomDropdown
                        value={formData.eventType}
                        onChange={v => setFormData((p) => ({ ...p, eventType: v }))}
                        options={[
                          { value: "dining", label: "Dining Experience" },
                          { value: "special", label: "Special Occasion" },
                          { value: "private", label: "Private Booking" },
                          { value: "seasonal", label: "Seasonal" },
                          { value: "live", label: "Live Entertainment" },
                          { value: "workshop", label: "Workshop" },
                        ]}
                      />
                    </div>
                    <div className="admin-form-group">
                      <label>Status</label>
                      <CustomDropdown
                        value={formData.status}
                        onChange={v => setFormData((p) => ({ ...p, status: v }))}
                        options={[
                          { value: "upcoming", label: "Upcoming" },
                          { value: "ongoing", label: "Ongoing" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label className={formErrors.date ? "mat-label-error" : ""}>Date <span className="rf-req">*</span></label>
                      <CustomDatePicker value={formData.date} onChange={(v) => { setFormData((p) => ({ ...p, date: v })); setFormErrors(p => ({ ...p, date: false })); }} hasError={!!formErrors.date} />
                    </div>
                    <div className="admin-form-group">
                      <label>Time</label>
                      <CustomTimePicker value={formData.time} onChange={(v) => setFormData((p) => ({ ...p, time: v }))} />
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label>Last Date to Enroll <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(defaults to 2 days before event)</span></label>
                      <CustomDatePicker value={formData.bookingCloseDate || ""} max={formData.date || undefined} onChange={(v) => setFormData((p) => ({ ...p, bookingCloseDate: v }))} label="Select close date" />
                    </div>
                    <div className="admin-form-group">
                      <label>Last Date to Apply <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(registration deadline)</span></label>
                      <CustomDatePicker value={formData.lastApplyDate || ""} max={formData.date || undefined} onChange={(v) => setFormData((p) => ({ ...p, lastApplyDate: v }))} label="Select deadline" />
                    </div>
                  </div>

                  <div className="admin-form-group ae-publish-toggle">
                    <label className="ae-toggle-label">
                      <span>Publish Event (visible to users)</span>
                      <div className={`ae-toggle ${formData.isPublished ? "on" : "off"}`} onClick={() => setFormData((p) => ({ ...p, isPublished: !p.isPublished }))}>
                        <div className="ae-toggle-knob" />
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* STEP 2 — Venue & Capacity */}
              {editFormStep === 2 && (
                <>
                  <div className="admin-form-group">
                    <label>Venue / Location</label>
                    <div className="ae-venue-radio-row">
                      <label className={`ae-venue-radio ${formData.venueMode === "restaurant" ? "active" : ""}`}>
                        <input type="radio" name="venueMode" value="restaurant" checked={formData.venueMode === "restaurant"} onChange={() => setFormData(p => ({ ...p, venueMode: "restaurant", venue: "Sam Cafe, Madurai" }))} />
                        Restaurant
                      </label>
                      <label className={`ae-venue-radio ${formData.venueMode === "custom" ? "active" : ""}`}>
                        <input type="radio" name="venueMode" value="custom" checked={formData.venueMode === "custom"} onChange={() => setFormData(p => ({ ...p, venueMode: "custom", venue: "" }))} />
                        Custom
                      </label>
                    </div>
                    <textarea className={`ae-venue-textarea${formErrors.venue ? " mat-error" : ""}`} rows={3} value={formData.venue} disabled={formData.venueMode === "restaurant"} onChange={(e) => { setFormData(p => ({ ...p, venue: allowTextInput(p.venue, e.target.value, 500, 100000) })); setFormErrors(p => ({ ...p, venue: false })); }} placeholder="Enter full venue address…" />
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <div className="mat">
                        <input className={`mat-input${formErrors.maxCapacity ? " mat-error" : ""}`} type="number" min="0" value={formData.maxCapacity} onChange={(e) => { setFormData((p) => ({ ...p, maxCapacity: e.target.value })); setFormErrors(p => ({ ...p, maxCapacity: false })); }} placeholder=" " />
                        <label className={`mat-label${formErrors.maxCapacity ? " mat-label-error" : ""}`}>Max Capacity <span className="rf-req">*</span></label>
                        <span className={`mat-bar${formErrors.maxCapacity ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="admin-form-group">
                      <div className="mat">
                        <input className="mat-input" type="number" min="0" value={formData.price} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))} placeholder=" " />
                        <label className="mat-label">Price per Person (₹)</label>
                        <span className="mat-bar" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3 — Content */}
              {editFormStep === 3 && (
                <>
                  <div className="admin-form-group">
                    <div className="mat-area">
                      <textarea className={`mat-input mat-textarea${formErrors.description ? " mat-error" : ""}`} value={formData.description} rows={3} onChange={(e) => { setFormData((p) => ({ ...p, description: allowTextInput(p.description, e.target.value, 500, 100000) })); setFormErrors(p => ({ ...p, description: false })); }} placeholder=" " style={{ height: "auto", paddingTop: 4 }} />
                      <label className={`mat-area-label${formErrors.description ? " mat-label-error" : ""}`}>Description <span className="rf-req">*</span></label>
                      <span className={`mat-area-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Images (multiple)</label>
                    <ImageUploadBlock images={formData.images} onUpload={(e) => handleImagesUpload(e, false)} onRemove={(i) => removeImage(i, false)} inputRef={fileInputRef} isSpec={false} />
                  </div>

                  <div className="admin-form-group">
                    <label>Tags</label>
                    <div className="ae-tag-input-row">
                      <div className="mat" style={{ flex: 1 }}>
                        <input className="mat-input" type="text" value={tagInput} onChange={(e) => setTagInput(allowTextInput(tagInput, e.target.value, 100, 5))} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); } }} />
                        <label className="mat-label">Add a tag…</label>
                        <span className="mat-bar" />
                      </div>
                      <button type="button" onClick={() => { if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); }}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
                    </div>
                    <div className="ae-tag-chips">
                      {(formData.tags || []).map((t, i) => (
                        <span key={i} className="ae-chip">{t}<button type="button" onClick={() => setFormData((p) => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}>×</button></span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Highlights</label>
                    <div className="ae-tag-input-row">
                      <div className="mat" style={{ flex: 1 }}>
                        <input className="mat-input" type="text" value={highlightInput} onChange={(e) => setHighlightInput(allowTextInput(highlightInput, e.target.value, 100, 5))} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); } }} />
                        <label className="mat-label">e.g. Live music, Buffet included…</label>
                        <span className="mat-bar" />
                      </div>
                      <button type="button" onClick={() => { if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); }}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
                    </div>
                    <div className="ae-tag-chips">
                      {(formData.highlights || []).map((h, i) => (
                        <span key={i} className="ae-chip ae-chip-green">{h}<button type="button" onClick={() => setFormData((p) => ({ ...p, highlights: p.highlights.filter((_, j) => j !== i) }))}>×</button></span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 4 — Dishes & Preview */}
              {editFormStep === 4 && (
                <>
                  <div className="admin-form-group">
                    <label>Menu Dishes for this Event</label>
                    <DishSelector selectedDishes={formData.dishes} onToggle={(id) => toggleDish(id, false)} activeCat={formData.selectedCategory || ""} onCatChange={(id) => setFormData(p => ({ ...p, selectedCategory: id }))} isSpec={false} dishQty={formData.dishQty || {}} guests={Number(formData.maxCapacity) || 1} />
                  </div>

                  {/* Summary preview */}
                  <div className="ae-spec-summary">
                    <div className="evt-res-form-section-label">Preview</div>
                    <div className="ae-summary-grid">
                      <div className="ae-summary-row"><span className="ae-summary-key">Title</span><span className="ae-summary-val">{formData.title || "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Type</span><span className="ae-summary-val">{formData.eventType}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Status</span><span className="ae-summary-val">{formData.status}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Date</span><span className="ae-summary-val">{formData.date ? formatDate(formData.date) : "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Time</span><span className="ae-summary-val">{formData.time || "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Venue</span><span className="ae-summary-val">{formData.venue || "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Capacity</span><span className="ae-summary-val">{formData.maxCapacity || "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Price</span><span className="ae-summary-val">{formData.price ? `₹${Number(formData.price).toLocaleString("en-IN")} / person` : "Free"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Published</span><span className="ae-summary-val">{formData.isPublished ? "Live" : "Draft"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Tags</span><span className="ae-summary-val">{formData.tags?.length ? formData.tags.join(", ") : "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Highlights</span><span className="ae-summary-val">{formData.highlights?.length ? formData.highlights.join(", ") : "—"}</span></div>
                      <div className="ae-summary-row"><span className="ae-summary-key">Dishes</span><span className="ae-summary-val">{formData.dishes?.length ? `${formData.dishes.length} selected` : "None"}</span></div>
                    </div>
                  </div>
                </>
              )}

            </div>

            <div className="event-modal-footer">
              <Button3D variant="cancel" onClick={resetForm}>Cancel</Button3D>
              {editFormStep > 1 && (
                <button type="button" className="modal-prev-btn" onClick={() => setEditFormStep(s => s - 1)}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">← Back</span>
                </button>
              )}
              {editFormStep < 4 ? (
                <button type="button" className="modal-next-btn" onClick={() => {
                  if (validateEvtStep(editFormStep)) setEditFormStep(s => s + 1);
                }}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">Next →</span>
                </button>
              ) : (
                <Button3D onClick={handleSave}>{isEditMode ? "Save Changes" : "Create Event"}</Button3D>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SPECIALIZED EVENT MODAL */}
      {specModal.shouldRender && (
        <div className={`event-modal-overlay ${specModal.overlayClass}`}>
          <div className={`event-modal ${specModal.modalClass}`}>
            <div className="admin-modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3>{isSpecEditMode ? "Edit Specialized Event" : "Create Event"}</h3>
                <div className="ecard">
                  {["Event Details", "Packages & Add-ons", "Dishes", "Summary & Preview"].map((s, i) => (
                    <button key={i} className={`ebutton ${specFormStep === i + 1 ? "active" : ""} ${specFormStep > i + 1 ? "done" : ""}`} onClick={() => {
                      if (i + 1 > specFormStep) {
                        for (let step = specFormStep; step < i + 1; step++) {
                          if (!validateSpecStep(step)) return;
                        }
                      }
                      setSpecFormStep(i + 1);
                    }}>
                      <span className="eevt-step-num">{specFormStep > i + 1 ? "✓" : i + 1}</span>
                      <span className="eevt-step-label">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button3D variant="cancel" iconOnly onClick={resetSpecForm} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>

            <div className={`event-modal-body ae-spec-form-body${specFormStep === 3 ? " ae-spec-form-body--split" : ""}`}>
              {/* STEP 1 */}
              {specFormStep === 1 && (
                <>
                  <div className="admin-form-group">
                    <div className="mat">
                      <input className={`mat-input${specFormErrors.title ? " mat-error" : ""}`} type="text" value={specFormData.title} onChange={(e) => { setSpecFormData(p => ({ ...p, title: allowTextInput(p.title, e.target.value, 100, 5) })); setSpecFormErrors(p => ({ ...p, title: false })); }} placeholder=" " />
                      <label className={`mat-label${specFormErrors.title ? " mat-label-error" : ""}`}>Event Title <span className="rf-req">*</span></label>
                      <span className={`mat-bar${specFormErrors.title ? " mat-bar-error" : ""}`} />
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Category</label>
                    <div className="ae-category-grid">
                      {EVENT_CATEGORIES.map(cat => (
                        <button key={cat.id} type="button"
                          className={`ae-cat-btn ${specFormData.eventCategory === cat.id ? "active" : ""}`}
                          onClick={() => setSpecFormData(p => ({ ...p, eventCategory: cat.id }))}>
                          <input className="ae-cat-radio" type="radio" name="aeCat"
                            readOnly checked={specFormData.eventCategory === cat.id} />
                          <div className="ae-cat-text">
                            <span className="ae-cat-label">{cat.label}</span>
                            <span className="ae-cat-fee">Base ₹{cat.baseFee.toLocaleString("en-IN")}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <label className={specFormErrors.date ? "mat-label-error" : ""}>Date <span className="rf-req">*</span></label>
                      <CustomDatePicker value={specFormData.date} onChange={(v) => { setSpecFormData(p => ({ ...p, date: v })); setSpecFormErrors(p => ({ ...p, date: false })); }} hasError={!!specFormErrors.date} />
                    </div>
                    <div className="admin-form-group">
                      <label>Time</label>
                      <CustomTimePicker value={specFormData.time} onChange={(v) => setSpecFormData(p => ({ ...p, time: v }))} />
                    </div>
                  </div>

                  <CurrentLocationToggle
                    value={useRestaurantAddrSpec}
                    onChange={(next) => {
                      setUseRestaurantAddrSpec(next);
                      if (next) {
                        setSpecFormData(p => ({ ...p, ...venueToAddressFields(currentVenue) }));
                      } else {
                        setSpecFormData(p => ({ ...p, ...emptyAddressFields() }));
                      }
                    }}
                  />

                  <div className="admin-form-group">
                    {!useRestaurantAddrSpec && <div className="ae-addr-grid">
                      {[
                        { key: "addrDoorNo", label: "Door No.", placeholder: "Door / Flat No.", req: true },
                        { key: "addrStreet", label: "Street", placeholder: "Street / Road name", req: true },
                        { key: "addrArea", label: "Area", placeholder: "Area / Locality", req: true },
                        { key: "addrLandmark", label: "Landmark", placeholder: "Near / opposite…", req: false },
                        { key: "addrCity", label: "City", placeholder: "City", req: true },
                        { key: "addrState", label: "State", placeholder: "State", req: true },
                        { key: "addrPincode", label: "Pincode", placeholder: "6-digit pincode", req: true },
                      ].map(field => (
                        <div key={field.key} className="admin-form-group">
                          <div className="mat">
                            <input
                              className={`mat-input${specFormErrors[field.key] ? " mat-error" : ""}`}
                              type="text"
                              value={specFormData[field.key]}
                              placeholder=" "
                              maxLength={field.key === "addrPincode" ? 6 : undefined}
                              readOnly={useRestaurantAddrSpec}
                              disabled={useRestaurantAddrSpec}
                              onChange={e => {
                                if (useRestaurantAddrSpec) return;
                                const v = field.key === "addrPincode"
                                  ? e.target.value.replace(/\D/g, "").slice(0, 6)
                                  : allowTextInput(specFormData[field.key], e.target.value, 100, 5);
                                setSpecFormData(p => ({ ...p, [field.key]: v, venue: buildAddress({ ...p, [field.key]: v }) }));
                                setSpecFormErrors(p => ({ ...p, [field.key]: false }));
                              }}
                            />
                            <label className={`mat-label${specFormErrors[field.key] ? " mat-label-error" : ""}`}>
                              {field.label} {field.req && <span className="rf-req">*</span>}
                            </label>
                            <span className={`mat-bar${specFormErrors[field.key] ? " mat-bar-error" : ""}`} />
                          </div>
                        </div>
                      ))}
                    </div>}
                  </div>

                  <div className="ae-form-row">
                    <div className="admin-form-group">
                      <div className="mat">
                        <input className={`mat-input${specFormErrors.guests ? " mat-error" : ""}`} type="number" min="1" value={specFormData.guests} onChange={(e) => { setSpecFormData(p => ({ ...p, guests: Number(e.target.value) })); setSpecFormErrors(p => ({ ...p, guests: false })); }} placeholder=" " />
                        <label className={`mat-label${specFormErrors.guests ? " mat-label-error" : ""}`}>Number of Guests <span className="rf-req">*</span></label>
                        <span className={`mat-bar${specFormErrors.guests ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="admin-form-group">
                      <label>Status</label>
                      <CustomDropdown
                        value={specFormData.status}
                        onChange={v => setSpecFormData(p => ({ ...p, status: v }))}
                        options={[
                          { value: "upcoming", label: "Upcoming" },
                          { value: "ongoing", label: "Ongoing" },
                          { value: "completed", label: "Completed" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <div className="mat-area">
                      <textarea className="mat-input mat-textarea" value={specFormData.description} rows={3} onChange={(e) => setSpecFormData(p => ({ ...p, description: allowTextInput(p.description, e.target.value, 500, 100000) }))} placeholder=" " style={{ height: "auto", paddingTop: 4 }} />
                      <label className="mat-area-label">Description</label>
                      <span className="mat-area-bar" />
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Images</label>
                    <ImageUploadBlock images={specFormData.images} onUpload={(e) => handleImagesUpload(e, true)} onRemove={(i) => removeImage(i, true)} inputRef={specFileInputRef} isSpec={true} />
                  </div>

                  <div className="admin-form-group">
                    <label>Tags</label>
                    <div className="ae-tag-input-row">
                      <div className="mat" style={{ flex: 1 }}>
                        <input className="mat-input" type="text" value={specTagInput} onChange={(e) => setSpecTagInput(allowTextInput(specTagInput, e.target.value, 100, 5))} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!specTagInput.trim()) return; setSpecFormData(p => ({ ...p, tags: [...(p.tags || []), specTagInput.trim()] })); setSpecTagInput(""); } }} />
                        <label className="mat-label">Add a tag…</label>
                        <span className="mat-bar" />
                      </div>
                      <button type="button" onClick={() => { if (!specTagInput.trim()) return; setSpecFormData(p => ({ ...p, tags: [...(p.tags || []), specTagInput.trim()] })); setSpecTagInput(""); }}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
                    </div>
                    <div className="ae-tag-chips">
                      {(specFormData.tags || []).map((t, i) => (
                        <span key={i} className="ae-chip">{t}<button type="button" onClick={() => setSpecFormData(p => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}>×</button></span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-group">
                    <label>Event Highlights</label>
                    <div className="ae-tag-input-row">
                      <div className="mat" style={{ flex: 1 }}>
                        <input className="mat-input" type="text" value={specHighlightInput} onChange={(e) => setSpecHighlightInput(allowTextInput(specHighlightInput, e.target.value, 100, 5))} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!specHighlightInput.trim()) return; setSpecFormData(p => ({ ...p, highlights: [...(p.highlights || []), specHighlightInput.trim()] })); setSpecHighlightInput(""); } }} />
                        <label className="mat-label">e.g. Candlelight setup…</label>
                        <span className="mat-bar" />
                      </div>
                      <button type="button" onClick={() => { if (!specHighlightInput.trim()) return; setSpecFormData(p => ({ ...p, highlights: [...(p.highlights || []), specHighlightInput.trim()] })); setSpecHighlightInput(""); }}>
                        <span className="shadow"></span>
                        <span className="edge"></span>
                        <span className="front">Add</span>
                      </button>
                    </div>
                    <div className="ae-tag-chips">
                      {(specFormData.highlights || []).map((h, i) => (
                        <span key={i} className="ae-chip ae-chip-green">{h}<button type="button" onClick={() => setSpecFormData(p => ({ ...p, highlights: p.highlights.filter((_, j) => j !== i) }))}>×</button></span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-group ae-publish-toggle">
                    <label className="ae-toggle-label">
                      <span>Publish Event (visible to users)</span>
                      <div className={`ae-toggle ${specFormData.isPublished ? "on" : "off"}`} onClick={() => setSpecFormData(p => ({ ...p, isPublished: !p.isPublished }))}>
                        <div className="ae-toggle-knob" />
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* STEP 2 */}
              {specFormStep === 2 && (
                <div className="event-package-body">
                  <div className="event-package-body-div1">
                    <div className="admin-form-group">
                      <label className="ae-section-label">Choose Package</label>
                      <div className="ae-packages-grid">
                        {SPECIALIZED_PACKAGES.map(pkg => (
                          <button key={pkg.id} type="button" className={`ae-package-card ${specFormData.selectedPackage === pkg.id ? "active" : ""}`} onClick={() => setSpecFormData(p => ({ ...p, selectedPackage: pkg.id }))}>
                            <div className="ae-pkg-label">{pkg.label}</div>
                            <div className="ae-pkg-desc">{pkg.desc}</div>
                            <div className="ae-pkg-price">₹{pkg.price.toLocaleString("en-IN")}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="admin-form-group event-package-body-div2">
                      <label className="ae-section-label">Add-ons</label>
                      <div className="ae-addons-list">
                        {SPECIALIZED_ADDONS.map(addon => {
                          const checked = !!specFormData.selectedAddons[addon.id];
                          const price = addon.pricePerGuest
                            ? `₹${addon.pricePerGuest}/guest × ${specFormData.guests} = ₹${(addon.pricePerGuest * specFormData.guests).toLocaleString("en-IN")}`
                            : `₹${addon.price.toLocaleString("en-IN")}`;
                          return (
                            <label key={addon.id} className={`ae-addon-row ${checked ? "checked" : ""}`}>
                              <div className="ae-addon-left">
                                <div>
                                  <div className="ae-addon-label">{addon.label}</div>
                                  <div className="ae-addon-price">{price}</div>
                                </div>
                                <input type="checkbox" checked={checked} onChange={() => toggleAddon(addon.id)} className="ae-addon-check" />
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="ae-live-summary">
                    <div className="ae-live-summary-row">
                      <span>Base Fee ({EVENT_CATEGORIES.find(c => c.id === specFormData.eventCategory)?.label})</span>
                      <span>₹{(EVENT_CATEGORIES.find(c => c.id === specFormData.eventCategory)?.baseFee || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="ae-live-summary-row">
                      <span>Package ({SPECIALIZED_PACKAGES.find(p => p.id === specFormData.selectedPackage)?.label})</span>
                      <span>₹{(SPECIALIZED_PACKAGES.find(p => p.id === specFormData.selectedPackage)?.price || 0).toLocaleString("en-IN")}</span>
                    </div>
                    {SPECIALIZED_ADDONS.filter(a => specFormData.selectedAddons[a.id]).map(addon => (
                      <div key={addon.id} className="ae-live-summary-row addon">
                        <span>{addon.label}</span>
                        <span>₹{(addon.pricePerGuest ? addon.pricePerGuest * specFormData.guests : addon.price).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    <div className="ae-live-summary-total">
                      <span>Total</span>
                      <span>₹{specTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 — Dishes (two-column) */}
              {specFormStep === 3 && (
                <div className="ae-dishes-split">
                  {/* LEFT: category + dish picker */}
                  <div className="ae-dishes-split-left">
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "block" }}>Select Menu Dishes</label>
                      <DishSelector
                        selectedDishes={specFormData.dishes}
                        onToggle={(id) => toggleDish(id, true)}
                        activeCat={specFormData.selectedCategory || ""}
                        onCatChange={(id) => setSpecFormData(p => ({ ...p, selectedCategory: id }))}
                        isSpec={true}
                        hideSelectedTable={true}
                        dishQty={specFormData.dishQty || {}}
                        guests={Number(specFormData.guests) || 1}
                      />
                    </div>
                  </div>
                  {/* RIGHT: selected dishes list */}
                  <div className="ae-dishes-split-right">
                    <div className="ae-dishes-right-header">
                      Selected Dishes
                      {specFormData.dishes?.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#888", marginLeft: 6 }}>
                          ({specFormData.dishes.length})
                        </span>
                      )}
                    </div>
                    {(!specFormData.dishes || specFormData.dishes.length === 0) ? (
                      <div className="ae-dishes-empty-right">No dishes selected yet.<br />Pick dishes from the left panel.</div>
                    ) : (
                      <>
                        <div className="ae-dishes-right-list">
                          {specFormData.dishes.map(id => {
                            const d = allDishes.find(x => x.id === id);
                            if (!d) return null;
                            const qty = Number(specFormData.guests) || 1;
                            return (
                              <div key={id} className="ae-dishes-right-item">
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: "#111", lineHeight: 1.3 }}>{d.name}</div>
                                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{d.subCat || d.cat || "—"} · qty: {Number(specFormData.guests) || 1} (guests)</div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#2563eb", flexShrink: 0 }}>₹{(Number(d.basePrice || 0) * qty).toLocaleString("en-IN")}</div>
                                <button type="button" className="ae-sdt-remove" onClick={() => toggleDish(id, true)} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Remove">×</button>
                              </div>
                            );
                          })}
                        </div>
                        {/* Total at bottom-right */}
                        <div className="ae-dishes-right-total">
                          <span>Food Total</span>
                          <span>₹{specFormData.dishes.reduce((sum, id) => {
                            const d = allDishes.find(x => x.id === id);
                            const qty = Number(specFormData.guests) || 1;
                            return sum + Number(d?.basePrice || 0) * qty;
                          }, 0).toLocaleString("en-IN")}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4 — Summary & Preview */}
              {specFormStep === 4 && (
                <div className="event-package-body">
                  <div className="ae-spec-summary-card event-package-body-div2" style={{ flex: 1 }}>
                    <h4>Event Summary</h4>
                    <div className="ae-spec-summary-grid">
                      <div><span>Event</span><strong>{specFormData.title || "—"}</strong></div>
                      <div><span>Category</span><strong>{EVENT_CATEGORIES.find(c => c.id === specFormData.eventCategory)?.label || "—"}</strong></div>
                      <div><span>Date</span><strong>{specFormData.date ? formatDate(specFormData.date) : "—"}</strong></div>
                      <div><span>Venue</span><strong style={{ wordBreak: "break-word" }}>{specFormData.venue || "—"}</strong></div>
                      <div><span>Guests</span><strong>{specFormData.guests}</strong></div>
                      <div><span>Package</span><strong>{SPECIALIZED_PACKAGES.find(p => p.id === specFormData.selectedPackage)?.label || "—"}</strong></div>
                      <div><span>Add-ons</span><strong>{Object.keys(specFormData.selectedAddons).filter(k => specFormData.selectedAddons[k]).length} selected</strong></div>
                      <div><span>Dishes</span><strong>{specFormData.dishes?.length || 0} selected</strong></div>
                      <div><span>Images</span><strong>{specFormData.images?.length || 0} uploaded</strong></div>
                    </div>
                    <div className="ae-spec-summary-total">
                      <span>Total Estimate</span>
                      <span>₹{specTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="evt-modal-footer">
              <Button3D variant="cancel" onClick={resetSpecForm}>Cancel</Button3D>
              {specFormStep > 1 && (
                <button type="button" className="modal-prev-btn" onClick={() => setSpecFormStep(s => s - 1)}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">← Back</span>
                </button>
              )}
              {specFormStep < 4 ? (
                <button type="button" className="modal-next-btn" onClick={() => {
                  if (validateSpecStep(specFormStep)) setSpecFormStep(s => s + 1);
                }}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">Next →</span>
                </button>
              ) : (
                <Button3D onClick={handleSpecSave}>{isSpecEditMode ? "Save Changes" : "Create Event"}</Button3D>
              )}

            </div>
          </div>
        </div>
      )}

      {/* BOOKING DETAIL MODAL */}
      {bookingDetailModal.shouldRender && (
        <div className={`event-modal-overlay ${bookingDetailModal.overlayClass}`}>
          <div className={`event-modal ae-booking-detail-modal ${bookingDetailModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Booking Details</h3>
              <Button3D variant="cancel" iconOnly onClick={() => bookingDetailModal.close(() => setViewBooking(null))} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="event-modal-body ae-booking-detail-body">
              {(() => {
                const b = viewBooking;
                const evt = events.find((e) => e.id === b.eventId);
                return (
                  <>
                    <div className="ae-detail-section">
                      <h4>Event</h4>
                      <p className="ae-detail-event-title">{evt?.title || b.eventId}</p>
                      <p>{formatDate(evt?.date)} {evt?.time && `· ${evt.time}`}</p>
                    </div>
                    <div className="ae-detail-section">
                      <h4>Guest Information</h4>
                      <table className="data-table">
                        <tbody>
                          <tr><td>Name</td><td>{b.name}</td></tr>
                          <tr><td>Email</td><td>{b.email}</td></tr>
                          <tr><td>Phone</td><td>{b.phone}</td></tr>
                          <tr><td>Guests</td><td><span className="ae-guest-count-badge">{b.guests}</span></td></tr>
                          {b.specialRequests && <tr><td>Special Requests</td><td>{b.specialRequests}</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    {b.status !== "cancelled" && (
                      <div className="ae-detail-section ae-add-guest-section">
                        <h4>Add More Guests</h4>
                        <p className="ae-add-guest-hint">
                          Current: <strong>{b.guests}</strong> guest{b.guests !== 1 ? "s" : ""}.
                          {evt?.maxCapacity > 0 && (<> Max capacity: <strong>{evt.maxCapacity}</strong>.</>)}
                        </p>
                        <div className="ae-add-guest-row">
                          <button className="ae-guest-stepper-btn" onClick={() => setAddGuestCount(c => Math.max(1, c - 1))} disabled={addGuestCount <= 1}>−</button>
                          <span className="ae-guest-stepper-val">{addGuestCount}</span>
                          <button className="ae-guest-stepper-btn" onClick={() => { const max = evt?.maxCapacity ? evt.maxCapacity - Number(b.guests) : 20; setAddGuestCount(c => Math.min(max, c + 1)); }}>+</button>
                          <button className="modal-confirm-btn" disabled={addGuestSaving} onClick={() => handleAddGuests(b.id, addGuestCount)}>
                            <span className="shadow"></span><span className="edge"></span>
                            <span className="front">
                              {addGuestSaving ? "Saving…" : `Add ${addGuestCount} Guest${addGuestCount !== 1 ? "s" : ""}`}
                            </span>
                          </button>
                        </div>
                        {evt?.price > 0 && (
                          <p className="ae-add-guest-cost">
                            Additional charge: ₹{(addGuestCount * Number(evt.price)).toLocaleString("en-IN")}
                            &nbsp;· New total: ₹{((Number(b.guests) + addGuestCount) * Number(evt.price)).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="ae-detail-section">
                      <h4>Booking Info</h4>
                      <table className="data-table">
                        <tbody>
                          <tr><td>Booking ID</td><td className="ae-mono">{b.id}</td></tr>
                          <tr><td>Booked On</td><td>{formatDate(b.bookedAt)}</td></tr>
                          <tr><td>Amount</td><td>{b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—"}</td></tr>
                          <tr><td>Status</td><td><span className={`ae-status-chip ae-status-${b.status}`}>{b.status}</span></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="event-modal-footer">

              {viewBooking.status === "pending" && (
                <button className="modal-confirm-btn" onClick={() => handleBookingStatus(viewBooking.id, "confirmed")}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">Confirm Booking</span>
                </button>
              )}
              {viewBooking.status !== "cancelled" && (
                <Button3D variant="danger" onClick={() => handleBookingStatus(viewBooking.id, "cancelled")}>Cancel Booking</Button3D>
              )}
              <Button3D variant="cancel" onClick={() => { bookingDetailModal.close(() => setViewBooking(null)); setAddGuestCount(1); }}>Close</Button3D>

            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmModal.shouldRender && (
        <div className={`event-modal-overlay ${deleteConfirmModal.overlayClass}`}>
          <div className={`event-modal ae-confirm-modal ${deleteConfirmModal.modalClass}`}>
            <div className="admin-modal-header">
              <h3>Delete Event</h3>
              <Button3D variant="cancel" iconOnly onClick={() => deleteConfirmModal.close(() => setConfirmDeleteId(null))} aria-label="Close"><img src={closeIcon} alt="" /></Button3D>
            </div>
            <div className="event-modal-body">
              <p style={{ margin: "8px 0 20px", color: "#444", fontSize: 14, lineHeight: 1.6 }}>
                Are you sure you want to delete this event? All associated bookings will also be removed. This cannot be undone.
              </p>
            </div>
            <div className="event-modal-footer">
              <Button3D variant="cancel" onClick={() => deleteConfirmModal.close(() => setConfirmDeleteId(null))}>Cancel</Button3D>
              <Button3D variant="danger" onClick={confirmDelete}>Delete Event</Button3D>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;