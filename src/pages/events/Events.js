import React, { useState, useMemo, useRef, useEffect } from "react";
import "./Events.css";
import api from "../../api";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";

// ─── helpers ────────────────────────────────────────────────────────────────
const generateId = (name) =>
    `evt_${name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}_${Date.now()}`;

const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
};

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
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];

// ─── Main Component ─────────────────────────────────────────────────────────
const Events = ({ adminData, setAdminData }) => {
    const { toast } = useToast();
    const events = adminData?.events || [];
    const bookings = adminData?.eventBookings || [];

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

    const [showForm, setShowForm] = useState(false);
    const [showSpecForm, setShowSpecForm] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [specFormData, setSpecFormData] = useState(EMPTY_SPEC_FORM);
    const [specFormStep, setSpecFormStep] = useState(1);
    const [tagInput, setTagInput] = useState("");
    const [highlightInput, setHighlightInput] = useState("");
    const [specTagInput, setSpecTagInput] = useState("");
    const [specHighlightInput, setSpecHighlightInput] = useState("");
    const [activeTab, setActiveTab] = useState("events");
    const [filterEventId, setFilterEventId] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [viewBooking, setViewBooking] = useState(null);
    const [addGuestCount, setAddGuestCount] = useState(1);
    const [addGuestSaving, setAddGuestSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [useCurrentLocation, setUseCurrentLocation] = useState(false);

    // Booking table sorting
    const [bookSortKey, setBookSortKey] = useState("bookedAt");
    const [bookSortDir, setBookSortDir] = useState("desc");

    const fileInputRef = useRef();
    const specFileInputRef = useRef();

    const filteredBookings = useMemo(() => {
        let list = bookings;
        if (filterEventId !== "all") list = list.filter((b) => b.eventId === filterEventId);
        if (filterStatus !== "all") list = list.filter((b) => b.status === filterStatus);
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
    }, [bookings, filterEventId, filterStatus, searchQuery, bookSortKey, bookSortDir]);

    const toggleBookSort = (key) => {
        if (bookSortKey === key) setBookSortDir(d => d === "asc" ? "desc" : "asc");
        else { setBookSortKey(key); setBookSortDir("asc"); }
    };

    const BookSortIcon = ({ col }) => {
        if (bookSortKey !== col) return <span style={{ color: "#bbb", fontSize: 10 }}>⇅</span>;
        return <span style={{ fontSize: 10 }}>{bookSortDir === "asc" ? "↑" : "↓"}</span>;
    };

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

    const resetForm = () => {
        setShowForm(false);
        setIsEditMode(false);
        setFormData(EMPTY_FORM);
        setTagInput("");
        setHighlightInput("");
        setUseCurrentLocation(false);
    };

    const resetSpecForm = () => {
        setShowSpecForm(false);
        setSpecFormData(EMPTY_SPEC_FORM);
        setSpecFormStep(1);
        setSpecTagInput("");
        setSpecHighlightInput("");
    };

    const openAdd = () => { resetForm(); setShowForm(true); };
    const openSpecAdd = () => { resetSpecForm(); setShowSpecForm(true); };

    const openEdit = (evt) => {
        setFormData({ ...EMPTY_FORM, ...evt, images: evt.images || (evt.image ? [evt.image] : []) });
        setIsEditMode(true);
        setShowForm(true);
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

    const handleSave = async () => {
        if (!formData.title.trim() || !formData.date) {
            toast.error("Title and Date are required.");
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
            return;
        }
        const cat = EVENT_CATEGORIES.find(c => c.id === specFormData.eventCategory);
        const pkg = SPECIALIZED_PACKAGES.find(p => p.id === specFormData.selectedPackage);
        const payload = {
            ...specFormData,
            id: generateId(specFormData.title),
            eventType: "special",
            isSpecialized: true,
            image: specFormData.images?.[0] || "",
            price: specTotal,
            packageLabel: pkg?.label || "",
            categoryLabel: cat?.label || "",
            maxCapacity: specFormData.guests || 0,
        };
        try {
            await api.post("/events", payload);
            setAdminData((p) => {
                const existing = p.events || [];
                const deduped = existing.filter(e => e.id !== payload.id);
                return { ...p, events: [...deduped, payload] };
            });
            toast.success("Specialized event created successfully.");
            resetSpecForm();
        } catch (err) {
            console.error("Save failed:", err);
            toast.error("Failed to save event. Please try again.");
        }
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleDelete = async (id) => {
        try {
            // ✅ Update global state correctly
            setAdminData(prev => ({
                ...prev,
                events: (prev.events || []).filter(e => e.id !== id),
            }));

            await api.delete(`/events/${id}`);

            toast.success("Event deleted");
        } catch (err) {
            toast.error("Failed to delete event. Please try again.");
        }
    };

    const confirmDelete = async () => {
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
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

    const changeDishQty = (dishId, delta, isSpec = false) => {
        if (isSpec) {
            setSpecFormData(p => {
                const qty = Math.max(1, ((p.dishQty || {})[dishId] || 1) + delta);
                return { ...p, dishQty: { ...(p.dishQty || {}), [dishId]: qty } };
            });
        } else {
            setFormData(p => {
                const qty = Math.max(1, ((p.dishQty || {})[dishId] || 1) + delta);
                return { ...p, dishQty: { ...(p.dishQty || {}), [dishId]: qty } };
            });
        }
    };

    // ── Category-based Dish Selector ──
    const DishSelector = ({ selectedDishes, onToggle, activeCat, onCatChange, isSpec = false, hideSelectedTable = false, dishQty = {}, onQtyChange }) => {
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
        const dishesTotalPrice = selectedDetails.reduce((sum, d) => sum + Number(d.basePrice || 0) * (dishQty[d.id] || 1), 0);

        const isSelected = (id) => (selectedDishes || []).includes(id);

        return (
            <div className="ae-dish-selector-v2">
                <div className="ae-cat-dropdown-wrap">
                    <select
                        className="ae-cat-dropdown"
                        value={activeCat}
                        onChange={e => onCatChange(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <span className="ae-cat-dropdown-arrow">▾</span>
                </div>

                {catDishes.length > 0 && (
                    <div className="act-dish-grid">
                        {catDishes.map(dish => {
                            const sel = isSelected(dish.id);
                            const qty = dishQty[dish.id] || 1;
                            return (
                                <div key={dish.id} className={`act-dish-card${sel ? " selected" : ""}`}>
                                    <div className="act-dish-info">
                                        <span className="act-dish-name">{dish.name}</span>
                                        {dish.subCat && <span className="act-dish-cat">{dish.subCat}</span>}
                                        <span className="act-dish-price">₹{dish.basePrice}</span>
                                    </div>
                                    {sel ? (
                                        <div className="act-dish-stepper">
                                            <button type="button" onClick={() => onQtyChange(dish.id, -1)}>−</button>
                                            <span>{qty}</span>
                                            <button type="button" onClick={() => onQtyChange(dish.id, 1)}>+</button>

                                        </div>
                                    ) : (
                                        <button type="button" className="act-dish-add-btn" onClick={() => onToggle(dish.id)}>+ Add</button>
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
                                <tr><th>#</th><th>Dish</th><th>Category</th><th>Qty</th><th>Price</th><th></th></tr>
                            </thead>
                            <tbody>
                                {selectedDetails.map((d, i) => (
                                    <tr key={d.id}>
                                        <td>{i + 1}</td>
                                        <td><div className="ae-sdt-dish"><span>{d.name}</span></div></td>
                                        <td className="ae-sdt-cat">{d.subCat || d.cat || "—"}</td>
                                        <td style={{ textAlign: "center" }}>{dishQty[d.id] || 1}</td>
                                        <td className="ae-sdt-price">₹{(Number(d.basePrice || 0) * (dishQty[d.id] || 1)).toLocaleString("en-IN")}</td>
                                        <td><button type="button" className="ae-sdt-remove" onClick={() => onToggle(d.id)} title="Remove">×</button></td>
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
        <div className="admin-events-page">
            {/* PAGE HEADER */}
            <div className="ae-page-header">
                <div>
                    <h2 className="ae-page-title">Events</h2>
                    <p className="ae-page-sub">Manage restaurant events &amp; track bookings</p>
                </div>
                <div className="ae-header-actions">
                    <div className="ae-tab-pills">
                        <button className={`ae-tab-pill ${activeTab === "events" ? "active" : ""}`} onClick={() => setActiveTab("events")}>
                            Events
                            <span className="ae-badge">{events.length}</span>
                        </button>
                        <button className={`ae-tab-pill ${activeTab === "bookings" ? "active" : ""}`} onClick={() => setActiveTab("bookings")}>
                            Bookings
                            <span className="ae-badge ae-badge-purple">{bookings.length}</span>
                        </button>
                    </div>
                    {activeTab === "events" && (
                        <div className="ae-btn-group">
                            <button className="ae-spec-btn" onClick={openSpecAdd}>Create Event</button>
                        </div>
                    )}
                </div>
            </div>

            {/* EVENTS TAB */}
            {activeTab === "events" && (
                <>
                    {events.length === 0 ? (
                        <div className="ae-empty-state">
                            <p>No events yet. Create your first event!</p>
                        </div>
                    ) : (
                        <div className="ae-events-grid">
                            {events.map((evt) => {
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
                                            <button className="ae-card-btn ae-edit-btn" onClick={() => openEdit(evt)}>Edit</button>
                                            <button className={`ae-card-btn ae-publish-btn ${evt.isPublished ? "unpublish" : "publish"}`} onClick={() => handleTogglePublish(evt)}>
                                                {evt.isPublished ? "Unpublish" : "Publish"}
                                            </button>
                                            <button className="ae-card-btn ae-delete-btn" onClick={() => handleDelete(evt.id)}>Delete</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* BOOKINGS TAB */}
            {activeTab === "bookings" && (
                <div className="ae-bookings-section">
                    <div className="ae-booking-filters">
                        <input type="text" placeholder="Search by name, email or phone…" className="ae-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <select className="ae-filter-select" value={filterEventId} onChange={(e) => setFilterEventId(e.target.value)}>
                            <option value="all">All Events</option>
                            {events.map((e) => (<option key={e.id} value={e.id}>{e.title}</option>))}
                        </select>
                        <select className="ae-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        {(filterEventId !== "all" || filterStatus !== "all" || searchQuery) && (
                            <button className="ae-clear-filter" onClick={() => { setFilterEventId("all"); setFilterStatus("all"); setSearchQuery(""); }}>Clear</button>
                        )}
                        <span className="ae-result-count">{filteredBookings.length} result(s)</span>
                    </div>

                    <div className="ae-booking-table-wrapper">
                        {filteredBookings.length === 0 ? (
                            <div className="ae-empty-state"><p>No bookings found.</p></div>
                        ) : (
                            <table className="ae-booking-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th onClick={() => toggleBookSort("name")} style={{ cursor: "pointer" }}>Name <BookSortIcon col="name" /></th>
                                        <th onClick={() => toggleBookSort("eventId")} style={{ cursor: "pointer" }}>Event <BookSortIcon col="eventId" /></th>
                                        <th onClick={() => toggleBookSort("bookedAt")} style={{ cursor: "pointer" }}>Date <BookSortIcon col="bookedAt" /></th>
                                        <th onClick={() => toggleBookSort("guests")} style={{ cursor: "pointer" }}>Guests <BookSortIcon col="guests" /></th>
                                        <th onClick={() => toggleBookSort("totalAmount")} style={{ cursor: "pointer" }}>Amount <BookSortIcon col="totalAmount" /></th>
                                        <th onClick={() => toggleBookSort("status")} style={{ cursor: "pointer" }}>Status <BookSortIcon col="status" /></th>
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
                                                <td><span className={`ae-status-chip ae-status-${b.status}`}>{b.status}</span></td>
                                                <td>
                                                    <div className="ae-booking-actions">
                                                        <button className="ae-tbl-btn ae-tbl-view" onClick={() => setViewBooking(b)}>View</button>
                                                        {b.status === "pending" && (
                                                            <button className="ae-tbl-btn ae-tbl-confirm" onClick={() => handleBookingStatus(b.id, "confirmed")}>Confirm</button>
                                                        )}
                                                        {b.status !== "cancelled" && (
                                                            <button className="ae-tbl-btn ae-tbl-cancel" onClick={() => handleBookingStatus(b.id, "cancelled")}>Cancel</button>
                                                        )}
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
            {showForm && (
                <div className="ingredient-modal-overlay">
                    <div className="ingredient-modal ae-event-modal">
                        <div className="ingredient-modal-header">
                            <h3>{isEditMode ? "Edit Event" : "Create New Event"}</h3>
                            <button className="ingredient-close-btn" onClick={resetForm} aria-label="Close" />
                        </div>

                        <div className="ingredient-modal-body ae-event-form-body">
                            <div className="form-group">
                                <label>Event Title *</label>
                                <input type="text" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Sunday Brunch Special" />
                            </div>

                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Event Type</label>
                                    <select value={formData.eventType} onChange={(e) => setFormData((p) => ({ ...p, eventType: e.target.value }))}>
                                        <option value="dining">Dining Experience</option>
                                        <option value="special">Special Occasion</option>
                                        <option value="private">Private Booking</option>
                                        <option value="seasonal">Seasonal</option>
                                        <option value="live">Live Entertainment</option>
                                        <option value="workshop">Workshop</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}>
                                        <option value="upcoming">Upcoming</option>
                                        <option value="ongoing">Ongoing</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Date *</label>
                                    <CustomDatePicker value={formData.date} onChange={(v) => setFormData((p) => ({ ...p, date: v }))} />
                                </div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <CustomTimePicker value={formData.time} onChange={(v) => setFormData((p) => ({ ...p, time: v }))} />
                                </div>
                            </div>

                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Last Date to Enroll <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(defaults to 2 days before event)</span></label>
                                    <CustomDatePicker value={formData.bookingCloseDate || ""} max={formData.date || undefined} onChange={(v) => setFormData((p) => ({ ...p, bookingCloseDate: v }))} label="Select close date" />
                                </div>
                                <div className="form-group">
                                    <label>Last Date to Apply <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>(registration deadline)</span></label>
                                    <CustomDatePicker
                                        value={formData.lastApplyDate || ""}
                                        max={formData.date || undefined}
                                        onChange={(v) => setFormData((p) => ({ ...p, lastApplyDate: v }))}
                                        label="Select deadline"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
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
                                <textarea className="ae-venue-textarea" rows={3} value={formData.venue} disabled={formData.venueMode === "restaurant"} onChange={(e) => setFormData(p => ({ ...p, venue: e.target.value }))} placeholder="Enter full venue address…" />
                            </div>

                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Max Capacity</label>
                                    <input type="number" min="0" value={formData.maxCapacity} onChange={(e) => setFormData((p) => ({ ...p, maxCapacity: e.target.value }))} placeholder="0 = unlimited" />
                                </div>
                                <div className="form-group">
                                    <label>Price per Person (₹)</label>
                                    <input type="number" min="0" value={formData.price} onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))} placeholder="0 = free" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea value={formData.description} rows={3} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description…" />
                            </div>

                            <div className="form-group">
                                <label>Event Images (multiple)</label>
                                <ImageUploadBlock images={formData.images} onUpload={(e) => handleImagesUpload(e, false)} onRemove={(i) => removeImage(i, false)} inputRef={fileInputRef} isSpec={false} />
                            </div>

                            <div className="form-group">
                                <label>Tags</label>
                                <div className="ae-tag-input-row">
                                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add a tag…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); } }} />
                                    <button type="button" onClick={() => { if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); }}>Add</button>
                                </div>
                                <div className="ae-tag-chips">
                                    {(formData.tags || []).map((t, i) => (
                                        <span key={i} className="ae-chip">{t}<button type="button" onClick={() => setFormData((p) => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}>×</button></span>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Event Highlights</label>
                                <div className="ae-tag-input-row">
                                    <input type="text" value={highlightInput} onChange={(e) => setHighlightInput(e.target.value)} placeholder="e.g. Live music, Buffet included…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); } }} />
                                    <button type="button" onClick={() => { if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); }}>Add</button>
                                </div>
                                <div className="ae-tag-chips">
                                    {(formData.highlights || []).map((h, i) => (
                                        <span key={i} className="ae-chip ae-chip-green">{h}<button type="button" onClick={() => setFormData((p) => ({ ...p, highlights: p.highlights.filter((_, j) => j !== i) }))}>×</button></span>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Menu Dishes for this Event</label>
                                <DishSelector selectedDishes={formData.dishes} onToggle={(id) => toggleDish(id, false)} activeCat={formData.selectedCategory || ""} onCatChange={(id) => setFormData(p => ({ ...p, selectedCategory: id }))} isSpec={false} dishQty={formData.dishQty || {}} onQtyChange={(id, delta) => changeDishQty(id, delta, false)} />
                            </div>

                            <div className="form-group ae-publish-toggle">
                                <label className="ae-toggle-label">
                                    <span>Publish Event (visible to users)</span>
                                    <div className={`ae-toggle ${formData.isPublished ? "on" : "off"}`} onClick={() => setFormData((p) => ({ ...p, isPublished: !p.isPublished }))}>
                                        <div className="ae-toggle-knob" />
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="ingredient-modal-footer">
                            <div className="form-actions">
                                <button type="button" onClick={handleSave}>{isEditMode ? "Save Changes" : "Create Event"}</button>
                                <button type="button" onClick={resetForm}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SPECIALIZED EVENT MODAL */}
            {showSpecForm && (
                <div className="event-modal-overlay">
                    <div className="event-modal ae-spec-modal">
                        <div className="event-modal-header">
                            <div>
                                <h3>Create Event</h3>
                                <div className="ae-spec-steps">
                                    {["Event Details", "Packages & Add-ons", "Dishes", "Summary & Preview"].map((s, i) => (
                                        <button key={i} className={`ae-spec-step ${specFormStep === i + 1 ? "active" : ""} ${specFormStep > i + 1 ? "done" : ""}`} onClick={() => setSpecFormStep(i + 1)}>
                                            <span className="ae-step-num">{specFormStep > i + 1 ? "✓" : i + 1}</span>
                                            <span className="ae-step-label">{s}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button className="ingredient-close-btn" onClick={resetSpecForm} aria-label="Close" />
                        </div>

                        <div className={`event-modal-body ae-spec-form-body${specFormStep === 3 ? " ae-spec-form-body--split" : ""}`}>
                            {/* STEP 1 */}
                            {specFormStep === 1 && (
                                <>
                                    <div className="form-group">
                                        <label>Event Title *</label>
                                        <input type="text" value={specFormData.title} onChange={(e) => setSpecFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Grand Wedding Reception" />
                                    </div>

                                    <div className="form-group">
                                        <label>Event Category</label>
                                        <div className="ae-category-grid">
                                            {EVENT_CATEGORIES.map(cat => (
                                                <button key={cat.id} type="button" className={`ae-cat-btn ${specFormData.eventCategory === cat.id ? "active" : ""}`} onClick={() => setSpecFormData(p => ({ ...p, eventCategory: cat.id }))}>
                                                    <span className="ae-cat-label">{cat.label}</span>
                                                    <span className="ae-cat-fee">Base ₹{cat.baseFee.toLocaleString("en-IN")}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="ae-form-row">
                                        <div className="form-group">
                                            <label>Date *</label>
                                            <CustomDatePicker value={specFormData.date} onChange={(v) => setSpecFormData(p => ({ ...p, date: v }))} />
                                        </div>
                                        <div className="form-group">
                                            <label>Time</label>
                                            <CustomTimePicker value={specFormData.time} onChange={(v) => setSpecFormData(p => ({ ...p, time: v }))} />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Venue / Address</label>
                                        <div className="ae-addr-grid">
                                            <div className="ae-addr-field">
                                                <label>Door No. <span className="ae-req">*</span></label>
                                                <input type="text" value={specFormData.addrDoorNo} placeholder="Door / Flat No." onChange={e => { const v = e.target.value; setSpecFormData(p => ({ ...p, addrDoorNo: v, venue: buildAddress({ ...p, addrDoorNo: v }) })); }} />
                                            </div>
                                            <div className="ae-addr-field">
                                                <label>Street <span className="ae-req">*</span></label>
                                                <input type="text" value={specFormData.addrStreet} placeholder="Street / Road name" onChange={e => { const v = e.target.value; setSpecFormData(p => ({ ...p, addrStreet: v, venue: buildAddress({ ...p, addrStreet: v }) })); }} />
                                            </div>
                                            <div className="ae-addr-field">
                                                <label>Area <span className="ae-req">*</span></label>
                                                <input type="text" value={specFormData.addrArea} placeholder="Area / Locality" onChange={e => { const v = e.target.value; setSpecFormData(p => ({ ...p, addrArea: v, venue: buildAddress({ ...p, addrArea: v }) })); }} />
                                            </div>
                                            <div className="ae-addr-field">
                                                <label>Landmark <span style={{ fontSize: 10, color: "#aaa" }}>(optional)</span></label>
                                                <input type="text" value={specFormData.addrLandmark} placeholder="Near / opposite…" onChange={e => { const v = e.target.value; setSpecFormData(p => ({ ...p, addrLandmark: v, venue: buildAddress({ ...p, addrLandmark: v }) })); }} />
                                            </div>
                                            <div className="ae-addr-field">
                                                <label>City <span className="ae-req">*</span></label>
                                                <input type="text" value={specFormData.addrCity} placeholder="City" onChange={e => { const v = e.target.value; setSpecFormData(p => ({ ...p, addrCity: v, venue: buildAddress({ ...p, addrCity: v }) })); }} />
                                            </div>
                                            <div className="ae-addr-field">
                                                <label>State <span className="ae-req">*</span></label>
                                                <input type="text" value={specFormData.addrState} placeholder="State" onChange={e => { const v = e.target.value; setSpecFormData(p => ({ ...p, addrState: v, venue: buildAddress({ ...p, addrState: v }) })); }} />
                                            </div>
                                            <div className="ae-addr-field">
                                                <label>Pincode <span className="ae-req">*</span></label>
                                                <input type="text" value={specFormData.addrPincode} placeholder="6-digit pincode" maxLength={6} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setSpecFormData(p => ({ ...p, addrPincode: v, venue: buildAddress({ ...p, addrPincode: v }) })); }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ae-form-row">
                                        <div className="form-group">
                                            <label>Number of Guests</label>
                                            <input type="number" min="1" value={specFormData.guests} onChange={(e) => setSpecFormData(p => ({ ...p, guests: Number(e.target.value) }))} />
                                        </div>
                                        <div className="form-group">
                                            <label>Status</label>
                                            <select value={specFormData.status} onChange={(e) => setSpecFormData(p => ({ ...p, status: e.target.value }))}>
                                                <option value="upcoming">Upcoming</option>
                                                <option value="ongoing">Ongoing</option>
                                                <option value="completed">Completed</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea value={specFormData.description} rows={3} onChange={(e) => setSpecFormData(p => ({ ...p, description: e.target.value }))} placeholder="Event description…" />
                                    </div>

                                    <div className="form-group">
                                        <label>Event Images</label>
                                        <ImageUploadBlock images={specFormData.images} onUpload={(e) => handleImagesUpload(e, true)} onRemove={(i) => removeImage(i, true)} inputRef={specFileInputRef} isSpec={true} />
                                    </div>

                                    <div className="form-group">
                                        <label>Tags</label>
                                        <div className="ae-tag-input-row">
                                            <input type="text" value={specTagInput} onChange={(e) => setSpecTagInput(e.target.value)} placeholder="Add a tag…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!specTagInput.trim()) return; setSpecFormData(p => ({ ...p, tags: [...(p.tags || []), specTagInput.trim()] })); setSpecTagInput(""); } }} />
                                            <button type="button" onClick={() => { if (!specTagInput.trim()) return; setSpecFormData(p => ({ ...p, tags: [...(p.tags || []), specTagInput.trim()] })); setSpecTagInput(""); }}>Add</button>
                                        </div>
                                        <div className="ae-tag-chips">
                                            {(specFormData.tags || []).map((t, i) => (
                                                <span key={i} className="ae-chip">{t}<button type="button" onClick={() => setSpecFormData(p => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))}>×</button></span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Event Highlights</label>
                                        <div className="ae-tag-input-row">
                                            <input type="text" value={specHighlightInput} onChange={(e) => setSpecHighlightInput(e.target.value)} placeholder="e.g. Candlelight setup…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!specHighlightInput.trim()) return; setSpecFormData(p => ({ ...p, highlights: [...(p.highlights || []), specHighlightInput.trim()] })); setSpecHighlightInput(""); } }} />
                                            <button type="button" onClick={() => { if (!specHighlightInput.trim()) return; setSpecFormData(p => ({ ...p, highlights: [...(p.highlights || []), specHighlightInput.trim()] })); setSpecHighlightInput(""); }}>Add</button>
                                        </div>
                                        <div className="ae-tag-chips">
                                            {(specFormData.highlights || []).map((h, i) => (
                                                <span key={i} className="ae-chip ae-chip-green">{h}<button type="button" onClick={() => setSpecFormData(p => ({ ...p, highlights: p.highlights.filter((_, j) => j !== i) }))}>×</button></span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group ae-publish-toggle">
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
                                        <div className="form-group">
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

                                        <div className="form-group event-package-body-div2">
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
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "block" }}>Select Menu Dishes</label>
                                            <DishSelector
                                                selectedDishes={specFormData.dishes}
                                                onToggle={(id) => toggleDish(id, true)}
                                                activeCat={specFormData.selectedCategory || ""}
                                                onCatChange={(id) => setSpecFormData(p => ({ ...p, selectedCategory: id }))}
                                                isSpec={true}
                                                hideSelectedTable={true}
                                                dishQty={specFormData.dishQty || {}}
                                                onQtyChange={(id, delta) => changeDishQty(id, delta, true)}
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
                                                        const qty = (specFormData.dishQty || {})[id] || 1;
                                                        return (
                                                            <div key={id} className="ae-dishes-right-item">
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 600, fontSize: 13, color: "#111", lineHeight: 1.3 }}>{d.name}</div>
                                                                    <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{d.subCat || d.cat || "—"} · qty: {qty}</div>
                                                                </div>
                                                                <div style={{ fontWeight: 700, fontSize: 13, color: "#7c3aed", flexShrink: 0 }}>₹{(Number(d.basePrice || 0) * qty).toLocaleString("en-IN")}</div>
                                                                <button type="button" className="ae-sdt-remove" onClick={() => toggleDish(id, true)} title="Remove">×</button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Total at bottom-right */}
                                                <div className="ae-dishes-right-total">
                                                    <span>Food Total</span>
                                                    <span>₹{specFormData.dishes.reduce((sum, id) => {
                                                        const d = allDishes.find(x => x.id === id);
                                                        const qty = (specFormData.dishQty || {})[id] || 1;
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

                        <div className="event-modal-footer">
                            <div className="form-actions ae-spec-footer">
                                {specFormStep > 1 && (
                                    <button type="button" className="ae-step-prev-btn" onClick={() => setSpecFormStep(s => s - 1)}>← Back</button>
                                )}
                                {specFormStep < 4 ? (
                                    <button type="button" className="btn-primary" onClick={() => setSpecFormStep(s => s + 1)}>Next →</button>
                                ) : (
                                    <button type="button" className="btn-primary" onClick={handleSpecSave}>Create Event</button>
                                )}
                                <button type="button" onClick={resetSpecForm}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BOOKING DETAIL MODAL */}
            {viewBooking && (
                <div className="ingredient-modal-overlay">
                    <div className="ingredient-modal ae-booking-detail-modal">
                        <div className="ingredient-modal-header">
                            <h3>Booking Details</h3>
                            <button className="ingredient-close-btn" onClick={() => setViewBooking(null)} aria-label="Close" />
                        </div>
                        <div className="ingredient-modal-body ae-booking-detail-body">
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
                                            <table className="ae-detail-table">
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
                                                    <button className="ae-guest-add-confirm-btn" disabled={addGuestSaving} onClick={() => handleAddGuests(b.id, addGuestCount)}>
                                                        {addGuestSaving ? "Saving…" : `Add ${addGuestCount} Guest${addGuestCount !== 1 ? "s" : ""}`}
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
                                            <table className="ae-detail-table">
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
                        <div className="ingredient-modal-footer">
                            <div className="form-actions">
                                {viewBooking.status === "pending" && (
                                    <button onClick={() => handleBookingStatus(viewBooking.id, "confirmed")}>Confirm Booking</button>
                                )}
                                {viewBooking.status !== "cancelled" && (
                                    <button style={{ background: "#dc2626", color: "#fff" }} onClick={() => handleBookingStatus(viewBooking.id, "cancelled")}>Cancel Booking</button>
                                )}
                                <button onClick={() => { setViewBooking(null); setAddGuestCount(1); }}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRM MODAL */}
            {confirmDeleteId && (
                <div className="ingredient-modal-overlay">
                    <div className="ingredient-modal ae-confirm-modal">
                        <div className="ingredient-modal-header">
                            <h3>Delete Event</h3>
                            <button className="ingredient-close-btn" onClick={() => setConfirmDeleteId(null)} aria-label="Close" />
                        </div>
                        <div className="ingredient-modal-body">
                            <p style={{ margin: "8px 0 20px", color: "#444", fontSize: 14, lineHeight: 1.6 }}>
                                Are you sure you want to delete this event? All associated bookings will also be removed. This cannot be undone.
                            </p>
                        </div>
                        <div className="ingredient-modal-footer">
                            <div className="form-actions">
                                <button onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                                <button style={{ background: "#dc2626" }} onClick={confirmDelete}>Delete Event</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Events;