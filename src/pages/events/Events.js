import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import "./Events.css";
import "../ModalCSS.css";
import closeIcon from "../../icon/close-icon.png";
import api from "../../api";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";

// ── CustomDropdown ────────────────────────────────────────────────────────────
function CustomDropdown({ value, onChange, options, placeholder = "Select…", label, required }) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef(null);
    React.useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);
    const selected = options.find(o => (o.value !== undefined ? o.value : o) === value);
    const displayLabel = selected ? (selected.label !== undefined ? selected.label : selected) : "";
    const wrapperClass = ["mat-select", value ? "has-value" : "", open ? "is-open" : ""].filter(Boolean).join(" ");
    return (
        <div className={wrapperClass} ref={ref}>
            {label && <label className="mat-label">{label}{required && <span className="rf-req">*</span>}</label>}
            <div className="dishes-dropdown-wrapper">
                <button type="button" className="dishes-status-dropdown"
                    onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}>
                    {displayLabel || ""}
                </button>
                {open && (
                    <div className="dropdown-menu">
                        <div onClick={() => { onChange(""); setOpen(false); }}>{placeholder}</div>
                        {options.map((o, i) => {
                            const val = o.value !== undefined ? o.value : o;
                            const lbl = o.label !== undefined ? o.label : o;
                            return (
                                <div key={i} onClick={() => { onChange(val); setOpen(false); }}
                                    style={{ padding: "8px 12px", fontSize: 14, cursor: "pointer" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                                    {lbl}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <span className="mat-bar" />
        </div>
    );
}

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

const RESTAURANT_ADDRESS = {
    addrDoorNo: "12, Sam Cafe", addrStreet: "GR Nagar", addrArea: "GR Nagar",
    addrLandmark: "Near Andavar Meat Shop", addrCity: "Madurai",
    addrDistrict: "Madurai", addrState: "Tamil Nadu", addrPincode: "625001",
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

const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [mon.toISOString().split("T")[0], sun.toISOString().split("T")[0]];
};
const getMonthRange = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [first.toISOString().split("T")[0], last.toISOString().split("T")[0]];
};

// ─── Main Component ─────────────────────────────────────────────────────────
const Events = ({ adminData, setAdminData, filters, patchFilters }) => {
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

    // Destructure persisted filter state from App
    const { activeTab, filterEventId, filterStatus, filterFromDate, filterToDate, searchQuery,
        evtSearch, evtFilterStatus, evtFilterType, evtFilterPublish, evtFromDate, evtToDate, evtDatePreset } = filters;
    const setActiveTab = (v) => patchFilters({ activeTab: v });
    const setFilterEventId = (v) => patchFilters({ filterEventId: v });
    const setFilterStatus = (v) => patchFilters({ filterStatus: v });
    const setFilterFromDate = (v) => patchFilters({ filterFromDate: v });
    const setFilterToDate = (v) => patchFilters({ filterToDate: v });
    const setSearchQuery = (v) => patchFilters({ searchQuery: v });
    const setEvtSearch = (v) => patchFilters({ evtSearch: v });
    const setEvtFilterStatus = (v) => patchFilters({ evtFilterStatus: v });
    const setEvtFilterType = (v) => patchFilters({ evtFilterType: v });
    const setEvtFilterPublish = (v) => patchFilters({ evtFilterPublish: v });
    const setEvtFromDate = (v) => patchFilters({ evtFromDate: v });
    const setEvtToDate = (v) => patchFilters({ evtToDate: v });
    const setEvtDatePreset = (v) => patchFilters({ evtDatePreset: v });

    const [showForm, setShowForm] = useState(false);
    const [showSpecForm, setShowSpecForm] = useState(false);
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
    const [addGuestCount, setAddGuestCount] = useState(1);
    const [addGuestSaving, setAddGuestSaving] = useState(false);
    const [useCurrentLocation, setUseCurrentLocation] = useState(false);
    const [useRestaurantAddrSpec, setUseRestaurantAddrSpec] = useState(false);

    // Booking table sorting — local only, no need to persist
    const [bookSortKey, setBookSortKey] = useState("bookedAt");
    const [bookSortDir, setBookSortDir] = useState("desc");

    const fileInputRef = useRef();
    const specFileInputRef = useRef();

    const filteredBookings = useMemo(() => {
        let list = bookings;
        if (filterEventId !== "all") list = list.filter((b) => b.eventId === filterEventId);
        if (filterStatus !== "all") list = list.filter((b) => b.status === filterStatus);
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
    }, [bookings, filterEventId, filterStatus, filterFromDate, filterToDate, searchQuery, bookSortKey, bookSortDir]);

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
        if (evtFilterStatus && evtFilterStatus !== "all") {
            const statuses = evtFilterStatus.split(",");
            list = list.filter(e => statuses.includes(e.status));
        }
        if (evtFilterType !== "all") list = list.filter(e => (e.eventType || "") === evtFilterType || (e.categoryLabel || "").toLowerCase() === evtFilterType);
        if (evtFilterPublish === "live") list = list.filter(e => e.isPublished);
        if (evtFilterPublish === "draft") list = list.filter(e => !e.isPublished);
        if (evtFromDate) list = list.filter(e => (e.date || "") >= evtFromDate);
        if (evtToDate) list = list.filter(e => (e.date || "") <= evtToDate);
        return list;
    }, [events, evtSearch, evtFilterStatus, evtFilterType, evtFilterPublish, evtFromDate, evtToDate]);



    const exportEvents = () => {
        if (!filteredEvents.length) { alert("No events to export"); return; }
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
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Events");
        XLSX.writeFile(wb, `events_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const exportBookings = () => {
        if (!filteredBookings.length) { alert("No bookings to export"); return; }
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
        const sheet = XLSX.utils.json_to_sheet(rows);
        sheet["!cols"] = Object.keys(rows[0]).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Event Bookings");
        const suffix = filterFromDate && filterToDate
            ? `${filterFromDate}_to_${filterToDate}`
            : new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `event_bookings_${suffix}.xlsx`);
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
        setFormErrors({});
        setTagInput("");
        setHighlightInput("");
        setUseCurrentLocation(false);
        setEditFormStep(1);
    };

    const resetSpecForm = () => {
        setShowSpecForm(false);
        setIsSpecEditMode(false);
        setSpecFormData(EMPTY_SPEC_FORM);
        setSpecFormErrors({});
        setSpecFormStep(1);
        setSpecTagInput("");
        setSpecHighlightInput("");
        setUseRestaurantAddrSpec(false);
    };

    const openAdd = () => { resetForm(); setShowForm(true); };
    const openSpecAdd = () => { resetSpecForm(); setShowSpecForm(true); };

    const openSpecEdit = (evt) => {
        setSpecFormData({ ...EMPTY_SPEC_FORM, ...evt, images: evt.images || (evt.image ? [evt.image] : []) });
        setIsSpecEditMode(true);
        setSpecFormStep(1);
        setShowSpecForm(true);
    };

    const openEdit = (evt) => {
        setFormData({ ...EMPTY_FORM, ...evt, images: evt.images || (evt.image ? [evt.image] : []) });
        setIsEditMode(true);
        setEditFormStep(1);
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
        setSpecFormErrors(prev => ({ ...prev, ...e }));
        return Object.keys(e).length === 0;
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
                                        <button type="button" className="modal-save-btn" onClick={() => onToggle(dish.id)}>
                                            <span className="shadow"></span>
                                            <span className="edge"></span>
                                            <span className="front close-padding">✓ Added</span>
                                        </button>
                                    ) : (
                                        <button type="button" className="modal-cancel-btn" onClick={() => onToggle(dish.id)}>
                                            <span className="shadow"></span>
                                            <span className="edge"></span>
                                            <span className="front close-padding">+ Add</span>
                                        </button>
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
                                <tr><th>#</th><th>Dish</th><th>Category</th><th>Qty (guests)</th><th>Price</th><th></th></tr>
                            </thead>
                            <tbody>
                                {selectedDetails.map((d, i) => (
                                    <tr key={d.id}>
                                        <td>{i + 1}</td>
                                        <td><div className="ae-sdt-dish"><span>{d.name}</span></div></td>
                                        <td className="ae-sdt-cat">{d.subCat || d.cat || "—"}</td>
                                        <td style={{ textAlign: "center" }}>{effectiveQty(d.id)}</td>
                                        <td className="ae-sdt-price">₹{(Number(d.basePrice || 0) * effectiveQty(d.id)).toLocaleString("en-IN")}</td>
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
                            <span className="ae-badge">{filteredEvents.length}/{events.length}</span>
                        </button>
                        <button className={`ae-tab-pill ${activeTab === "bookings" ? "active" : ""}`} onClick={() => setActiveTab("bookings")}>
                            Bookings
                            <span className="ae-badge ae-badge-purple">{filteredBookings.length}/{bookings.length}</span>
                        </button>
                    </div>
                    {activeTab === "events" && (
                        <div className="ae-btn-group">
                            <button className="modal-save-btn" onClick={openSpecAdd}>
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Create Event</span></button>
                        </div>
                    )}
                </div>
            </div>

            {/* EVENTS TAB */}
            {activeTab === "events" && (
                <>
                    {/* EVENTS FILTER BAR */}
                    <div className="ae-events-filter-bar">
                        <div className="ae-events-filter-top">
                            <input
                                className="search-input"
                                placeholder=" Search title, venue, type…"
                                value={evtSearch}
                                onChange={e => setEvtSearch(e.target.value)}
                            />
                            <button className="modal-save-btn" onClick={exportEvents}>
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Export</span>
                            </button>
                        </div>
                        <div className="ae-events-filter-groups">
                            {/* Status */}
                            <div className="ae-events-filter-group">
                                <span className="ae-filter-group-label">Status</span>
                                {[
                                    ["all", "All"],
                                    ["upcoming,ongoing", "Active"],
                                    ["upcoming", "Upcoming"],
                                    ["ongoing", "Ongoing"],
                                    ["completed", "Completed"],
                                    ["cancelled", "Cancelled"],
                                ].map(([val, label]) => (
                                    <button key={val}
                                        className={`filter-pill${evtFilterStatus === val ? " active" : ""}`}
                                        //style={evtFilterStatus === val && !["all", "upcoming,ongoing"].includes(val) ? { background: STATUS_COLORS[val], borderColor: STATUS_COLORS[val], color: "#fff" } : {}}
                                        onClick={() => setEvtFilterStatus(val)}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Date quick presets */}
                            <div className="ae-events-filter-group">
                                <span className="ae-filter-group-label">Period</span>
                                {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([preset, label]) => (
                                    <button key={preset}
                                        className={`filter-pill${evtDatePreset === preset ? " active" : ""}`}
                                        onClick={() => {
                                            if (evtDatePreset === preset) {
                                                setEvtDatePreset(""); setEvtFromDate(""); setEvtToDate("");
                                            } else {
                                                setEvtDatePreset(preset);
                                                if (preset === "today") { const t = todayStr(); setEvtFromDate(t); setEvtToDate(t); }
                                                else if (preset === "week") { const [f, t] = getWeekRange(); setEvtFromDate(f); setEvtToDate(t); }
                                                else { const [f, t] = getMonthRange(); setEvtFromDate(f); setEvtToDate(t); }
                                            }
                                        }}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Date range pickers */}
                            <div className="ae-events-filter-group">
                                <span className="ae-filter-group-label">From</span>
                                <div style={{ minWidth: 140 }}>
                                    <CustomDatePicker value={evtFromDate} onChange={v => { setEvtFromDate(v); setEvtDatePreset(""); if (evtToDate && v > evtToDate) setEvtToDate(v); }} placeholder="Start date" />
                                </div>
                                <span className="ae-filter-group-label" style={{ marginLeft: 4 }}>To</span>
                                <div style={{ minWidth: 140 }}>
                                    <CustomDatePicker value={evtToDate} min={evtFromDate} onChange={v => { setEvtToDate(v); setEvtDatePreset(""); }} placeholder="End date" />
                                </div>
                            </div>
                            {/* Type */}
                            <div className="ae-events-filter-group">
                                <span className="ae-filter-group-label">Type</span>
                                {[
                                    ["all", "All"],
                                    ["dining", "Dining"],
                                    ["special", "Special"],
                                    ["private", "Private"],
                                    ["seasonal", "Seasonal"],
                                    ["live", "Live"],
                                    ["workshop", "Workshop"],
                                ].map(([val, label]) => (
                                    <button key={val}
                                        className={`filter-pill${evtFilterType === val ? " active" : ""}`}
                                        onClick={() => setEvtFilterType(val)}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Publish */}
                            <div className="ae-events-filter-group">
                                <span className="ae-filter-group-label">Publish</span>
                                {[["all", "All"], ["live", "Live"], ["draft", "Draft"]].map(([val, label]) => (
                                    <button key={val}
                                        className={`filter-pill${evtFilterPublish === val ? " active" : ""}`}
                                        onClick={() => setEvtFilterPublish(val)}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Clear + count */}
                            {(evtSearch || evtFilterStatus !== "upcoming,ongoing" || evtFilterType !== "all" || evtFilterPublish !== "all" || evtFromDate || evtToDate) && (
                                <button className="ae-clear-filter" onClick={() => {
                                    setEvtSearch(""); setEvtFilterStatus("upcoming,ongoing");
                                    setEvtFilterType("all"); setEvtFilterPublish("all");
                                    setEvtFromDate(""); setEvtToDate(""); setEvtDatePreset("");
                                }}>Clear</button>
                            )}
                            <span className="ae-result-count">{filteredEvents.length} event(s)</span>
                        </div>
                    </div>

                    {filteredEvents.length === 0 ? (
                        <div className="ae-empty-state">
                            <p>{events.length === 0 ? "No events yet. Create your first event!" : "No events match the current filters."}</p>
                        </div>
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
                <div className="admin-events-page">
                    <div className="ae-events-filter-bar">
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <input type="text" placeholder="Search by name, email or phone…" className="ae-search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

                            {/* Quick date presets */}
                            {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([preset, label]) => {
                                const isActive = (() => {
                                    if (preset === "today") { const t = todayStr(); return filterFromDate === t && filterToDate === t; }
                                    if (preset === "week") { const [f, t] = getWeekRange(); return filterFromDate === f && filterToDate === t; }
                                    const [f, t] = getMonthRange(); return filterFromDate === f && filterToDate === t;
                                })();
                                return (
                                    <button key={preset}
                                        className={`filter-pill${isActive ? " active" : ""}`}
                                        onClick={() => {
                                            if (isActive) { setFilterFromDate(""); setFilterToDate(""); return; }
                                            if (preset === "today") { const t = todayStr(); setFilterFromDate(t); setFilterToDate(t); }
                                            else if (preset === "week") { const [f, t] = getWeekRange(); setFilterFromDate(f); setFilterToDate(t); }
                                            else { const [f, t] = getMonthRange(); setFilterFromDate(f); setFilterToDate(t); }
                                        }}>
                                        {label}
                                    </button>
                                );
                            })}

                            {/* Date range */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className="ae-filter-group-label">From</span>
                                <div style={{ minWidth: 150 }}>
                                    <CustomDatePicker value={filterFromDate} onChange={(v) => { setFilterFromDate(v); if (filterToDate && v > filterToDate) setFilterToDate(v); }} placeholder="Start date" />
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className="ae-filter-group-label">To</span>
                                <div style={{ minWidth: 150 }}>
                                    <CustomDatePicker value={filterToDate} min={filterFromDate} onChange={setFilterToDate} placeholder="End date" />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", marginTop: 4 }}>
                            {/* Event filter */}
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span className="ae-filter-group-label">Event</span>
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
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span className="ae-filter-group-label">Status</span>
                                {[
                                    ["all", "All"],
                                    ["pending", "Pending"],
                                    ["confirmed", "Confirmed"],
                                    ["cancelled", "Cancelled"],
                                ].map(([val, label]) => (
                                    <button key={val}
                                        className={`filter-pill${filterStatus === val ? " active" : ""}`}
                                        onClick={() => setFilterStatus(val)}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {(filterEventId !== "all" || filterStatus !== "all" || searchQuery || filterFromDate || filterToDate) && (
                                <button className="ae-clear-filter" onClick={() => {
                                    setFilterEventId("all"); setFilterStatus("all");
                                    setSearchQuery(""); setFilterFromDate(""); setFilterToDate("");
                                }}>Clear</button>
                            )}
                            <span className="ae-result-count">{filteredBookings.length} result(s)</span>
                            <button className="moal-save-btn" onClick={exportBookings} style={{ marginLeft: "auto" }}>
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front">Export</span>
                            </button>
                        </div>
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
                <div className="event-modal-overlay">
                    <div className="event-modal ae-event-modal">
                        <div className="modal-header">
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                            <button className="modal-cancel-btn" onClick={() => { resetForm(); setFormErrors({}); }} aria-label="Close">
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front close-padding"><img src={closeIcon} /></span>
                            </button>
                        </div>

                        <div className="event-modal-body ae-event-form-body">

                            {/* STEP 1 — Details */}
                            {editFormStep === 1 && (
                                <>
                                    <div className="form-group">
                                        <div className="mat">
                                            <input className={`mat-input${formErrors.title ? " mat-error" : ""}`} type="text" value={formData.title} onChange={(e) => { setFormData((p) => ({ ...p, title: e.target.value })); setFormErrors(p => ({ ...p, title: false })); }} placeholder=" " />
                                            <label className={`mat-label${formErrors.title ? " mat-label-error" : ""}`}>Event Title <span className="rf-req">*</span></label>
                                            <span className={`mat-bar${formErrors.title ? " mat-bar-error" : ""}`} />
                                        </div>
                                    </div>

                                    <div className="ae-form-row">
                                        <div className="form-group">
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
                                        <div className="form-group">
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
                                        <div className="form-group">
                                            <label className={formErrors.date ? "mat-label-error" : ""}>Date <span className="rf-req">*</span></label>
                                            <CustomDatePicker value={formData.date} onChange={(v) => { setFormData((p) => ({ ...p, date: v })); setFormErrors(p => ({ ...p, date: false })); }} hasError={!!formErrors.date} />
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
                                            <CustomDatePicker value={formData.lastApplyDate || ""} max={formData.date || undefined} onChange={(v) => setFormData((p) => ({ ...p, lastApplyDate: v }))} label="Select deadline" />
                                        </div>
                                    </div>

                                    <div className="form-group ae-publish-toggle">
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
                                        <textarea className={`ae-venue-textarea${formErrors.venue ? " mat-error" : ""}`} rows={3} value={formData.venue} disabled={formData.venueMode === "restaurant"} onChange={(e) => { setFormData(p => ({ ...p, venue: e.target.value })); setFormErrors(p => ({ ...p, venue: false })); }} placeholder="Enter full venue address…" />
                                    </div>

                                    <div className="ae-form-row">
                                        <div className="form-group">
                                            <div className="mat">
                                                <input className={`mat-input${formErrors.maxCapacity ? " mat-error" : ""}`} type="number" min="0" value={formData.maxCapacity} onChange={(e) => { setFormData((p) => ({ ...p, maxCapacity: e.target.value })); setFormErrors(p => ({ ...p, maxCapacity: false })); }} placeholder=" " />
                                                <label className={`mat-label${formErrors.maxCapacity ? " mat-label-error" : ""}`}>Max Capacity <span className="rf-req">*</span></label>
                                                <span className={`mat-bar${formErrors.maxCapacity ? " mat-bar-error" : ""}`} />
                                            </div>
                                        </div>
                                        <div className="form-group">
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
                                    <div className="form-group">
                                        <div className="mat-area">
                                            <textarea className={`mat-input${formErrors.description ? " mat-error" : ""}`} value={formData.description} rows={3} onChange={(e) => { setFormData((p) => ({ ...p, description: e.target.value })); setFormErrors(p => ({ ...p, description: false })); }} placeholder=" " style={{ height: "auto", paddingTop: 4 }} />
                                            <label className={`mat-area-label${formErrors.description ? " mat-label-error" : ""}`}>Description <span className="rf-req">*</span></label>
                                            <span className={`mat-area-bar${formErrors.description ? " mat-bar-error" : ""}`} />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Event Images (multiple)</label>
                                        <ImageUploadBlock images={formData.images} onUpload={(e) => handleImagesUpload(e, false)} onRemove={(i) => removeImage(i, false)} inputRef={fileInputRef} isSpec={false} />
                                    </div>

                                    <div className="form-group">
                                        <label>Tags</label>
                                        <div className="ae-tag-input-row">
                                            <div className="mat" style={{ flex: 1 }}>
                                                <input className="mat-input" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!tagInput.trim()) return; setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] })); setTagInput(""); } }} />
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

                                    <div className="form-group">
                                        <label>Event Highlights</label>
                                        <div className="ae-tag-input-row">
                                            <div className="mat" style={{ flex: 1 }}>
                                                <input className="mat-input" type="text" value={highlightInput} onChange={(e) => setHighlightInput(e.target.value)} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!highlightInput.trim()) return; setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] })); setHighlightInput(""); } }} />
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
                                    <div className="form-group">
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
                            <button type="button" className="modal-cancel-btn" onClick={resetForm}>
                                <span className="shadow"></span><span className="edge"></span>
                                <span className="front">Cancel</span>
                            </button>
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
                                <button type="button" className="modal-save-btn" onClick={handleSave}>
                                    <span className="shadow"></span><span className="edge"></span>
                                    <span className="front">{isEditMode ? "Save Changes" : "Create Event"}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SPECIALIZED EVENT MODAL */}
            {showSpecForm && (
                <div className="event-modal-overlay">
                    <div className="event-modal">
                        <div className="modal-header">
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
                            <button className="modal-cancel-btn" onClick={resetSpecForm} aria-label="Close" >
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front close-padding"><img src={closeIcon} /></span>
                            </button>
                        </div>

                        <div className={`event-modal-body ae-spec-form-body${specFormStep === 3 ? " ae-spec-form-body--split" : ""}`}>
                            {/* STEP 1 */}
                            {specFormStep === 1 && (
                                <>
                                    <div className="form-group">
                                        <div className="mat">
                                            <input className={`mat-input${specFormErrors.title ? " mat-error" : ""}`} type="text" value={specFormData.title} onChange={(e) => { setSpecFormData(p => ({ ...p, title: e.target.value })); setSpecFormErrors(p => ({ ...p, title: false })); }} placeholder=" " />
                                            <label className={`mat-label${specFormErrors.title ? " mat-label-error" : ""}`}>Event Title <span className="rf-req">*</span></label>
                                            <span className={`mat-bar${specFormErrors.title ? " mat-bar-error" : ""}`} />
                                        </div>
                                    </div>

                                    <div className="form-group">
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
                                        <div className="form-group">
                                            <label className={specFormErrors.date ? "mat-label-error" : ""}>Date <span className="rf-req">*</span></label>
                                            <CustomDatePicker value={specFormData.date} onChange={(v) => { setSpecFormData(p => ({ ...p, date: v })); setSpecFormErrors(p => ({ ...p, date: false })); }} hasError={!!specFormErrors.date} />
                                        </div>
                                        <div className="form-group">
                                            <label>Time</label>
                                            <CustomTimePicker value={specFormData.time} onChange={(v) => setSpecFormData(p => ({ ...p, time: v }))} />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                            <span>Venue / Address</span>
                                            <button
                                                type="button"
                                                className={`use-restaurant-loc-toggle${useRestaurantAddrSpec ? " active" : ""}`}
                                                onClick={() => {
                                                    const next = !useRestaurantAddrSpec;
                                                    setUseRestaurantAddrSpec(next);
                                                    if (next) {
                                                        setSpecFormData(p => {
                                                            const updated = { ...p, ...RESTAURANT_ADDRESS };
                                                            updated.venue = buildAddress(updated);
                                                            return updated;
                                                        });
                                                    } else {
                                                        /* Unchecked — clear all address fields so user fills fresh */
                                                        setSpecFormData(p => ({
                                                            ...p,
                                                            addrDoorNo: "", addrStreet: "", addrArea: "",
                                                            addrLandmark: "", addrCity: "", addrDistrict: "",
                                                            addrState: "", addrPincode: "", venue: "",
                                                        }));
                                                    }
                                                }}
                                            >
                                                {useRestaurantAddrSpec ? "✓ " : ""}Use restaurant location
                                            </button>
                                        </label>

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
                                                <div key={field.key} className="form-group">
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
                                                                    : e.target.value;
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
                                        <div className="form-group">
                                            <div className="mat">
                                                <input className={`mat-input${specFormErrors.guests ? " mat-error" : ""}`} type="number" min="1" value={specFormData.guests} onChange={(e) => { setSpecFormData(p => ({ ...p, guests: Number(e.target.value) })); setSpecFormErrors(p => ({ ...p, guests: false })); }} placeholder=" " />
                                                <label className={`mat-label${specFormErrors.guests ? " mat-label-error" : ""}`}>Number of Guests <span className="rf-req">*</span></label>
                                                <span className={`mat-bar${specFormErrors.guests ? " mat-bar-error" : ""}`} />
                                            </div>
                                        </div>
                                        <div className="form-group">
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

                                    <div className="form-group">
                                        <div className="mat-area">
                                            <textarea className="mat-input" value={specFormData.description} rows={3} onChange={(e) => setSpecFormData(p => ({ ...p, description: e.target.value }))} placeholder=" " style={{ height: "auto", paddingTop: 4 }} />
                                            <label className="mat-area-label">Description</label>
                                            <span className="mat-area-bar" />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Event Images</label>
                                        <ImageUploadBlock images={specFormData.images} onUpload={(e) => handleImagesUpload(e, true)} onRemove={(i) => removeImage(i, true)} inputRef={specFileInputRef} isSpec={true} />
                                    </div>

                                    <div className="form-group">
                                        <label>Tags</label>
                                        <div className="ae-tag-input-row">
                                            <div className="mat" style={{ flex: 1 }}>
                                                <input className="mat-input" type="text" value={specTagInput} onChange={(e) => setSpecTagInput(e.target.value)} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!specTagInput.trim()) return; setSpecFormData(p => ({ ...p, tags: [...(p.tags || []), specTagInput.trim()] })); setSpecTagInput(""); } }} />
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

                                    <div className="form-group">
                                        <label>Event Highlights</label>
                                        <div className="ae-tag-input-row">
                                            <div className="mat" style={{ flex: 1 }}>
                                                <input className="mat-input" type="text" value={specHighlightInput} onChange={(e) => setSpecHighlightInput(e.target.value)} placeholder=" " onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!specHighlightInput.trim()) return; setSpecFormData(p => ({ ...p, highlights: [...(p.highlights || []), specHighlightInput.trim()] })); setSpecHighlightInput(""); } }} />
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
                            <button type="button" className="modal-cancel-btn" onClick={resetSpecForm}>
                                <span className="shadow"></span><span className="edge"></span>
                                <span className="front">Cancel</span>
                            </button>
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
                                <button type="button" className="modal-save-btn" onClick={handleSpecSave}>
                                    <span className="shadow"></span><span className="edge"></span>
                                    <span className="front">{isSpecEditMode ? "Save Changes" : "Create Event"}</span>
                                </button>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* BOOKING DETAIL MODAL */}
            {viewBooking && (
                <div className="event-modal-overlay">
                    <div className="event-modal ae-booking-detail-modal">
                        <div className="modal-header">
                            <h3>Booking Details</h3>
                            <button className="modal-cancel-btn" onClick={() => setViewBooking(null)} aria-label="Close">
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front close-padding"><img src={closeIcon} /></span>
                            </button>
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
                        <div className="event-modal-footer">

                            {viewBooking.status === "pending" && (
                                <button className="modal-confirm-btn" onClick={() => handleBookingStatus(viewBooking.id, "confirmed")}>
                                    <span className="shadow"></span><span className="edge"></span>
                                    <span className="front">Confirm Booking</span>
                                </button>
                            )}
                            {viewBooking.status !== "cancelled" && (
                                <button className="modal-danger-btn" onClick={() => handleBookingStatus(viewBooking.id, "cancelled")}>
                                    <span className="shadow"></span><span className="edge"></span>
                                    <span className="front">Cancel Booking</span>
                                </button>
                            )}
                            <button className="modal-cancel-btn" onClick={() => { setViewBooking(null); setAddGuestCount(1); }}>
                                <span className="shadow"></span><span className="edge"></span>
                                <span className="front">Close</span>
                            </button>

                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRM MODAL */}
            {confirmDeleteId && (
                <div className="event-modal-overlay">
                    <div className="event-modal ae-confirm-modal">
                        <div className="modal-header">
                            <h3>Delete Event</h3>
                            <button className="modal-cancel-btn" onClick={() => setConfirmDeleteId(null)} aria-label="Close">
                                <span className="shadow"></span>
                                <span className="edge"></span>
                                <span className="front close-padding"><img src={closeIcon} /></span>
                            </button>
                        </div>
                        <div className="event-modal-body">
                            <p style={{ margin: "8px 0 20px", color: "#444", fontSize: 14, lineHeight: 1.6 }}>
                                Are you sure you want to delete this event? All associated bookings will also be removed. This cannot be undone.
                            </p>
                        </div>
                        <div className="event-modal-footer">
                            <button className="modal-cancel-btn" onClick={() => setConfirmDeleteId(null)}>
                                <span className="shadow"></span><span className="edge"></span>
                                <span className="front">Cancel</span>
                            </button>
                            <button className="modal-danger-btn" onClick={confirmDelete}>
                                <span className="shadow"></span><span className="edge"></span>
                                <span className="front">Delete Event</span>
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Events;