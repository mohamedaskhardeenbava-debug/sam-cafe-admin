import React, { useState, useMemo } from "react";
import "./Events.css";
import api from "../../api";

// ─── helpers ───────────────────────────────────────────────────────────────
const generateId = (name) =>
    `evt_${name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}_${Date.now()}`;

const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
};

const STATUS_COLORS = {
    upcoming: "#2563eb",
    ongoing: "#16a34a",
    completed: "#6b7280",
    cancelled: "#dc2626",
};

const EMPTY_FORM = {
    title: "",
    description: "",
    eventType: "dining",          // dining | special | private | seasonal
    date: "",
    time: "",
    venue: "",
    maxCapacity: "",
    price: "",                    // per-person price (0 = free)
    image: "",
    tags: [],
    status: "upcoming",
    isPublished: true,
    highlights: [],               // short bullet features
};

// ─── Main Component ─────────────────────────────────────────────────────────
const Events = ({ adminData, setAdminData }) => {
    const events = adminData?.events || [];
    const bookings = adminData?.eventBookings || [];

    const [showForm, setShowForm] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [imagePreview, setImagePreview] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [highlightInput, setHighlightInput] = useState("");
    const [activeTab, setActiveTab] = useState("events"); // events | bookings
    const [filterEventId, setFilterEventId] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [viewBooking, setViewBooking] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    // ── derived ──
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
        return list;
    }, [bookings, filterEventId, filterStatus, searchQuery]);

    const statsForEvent = (eventId) => ({
        total: bookings.filter((b) => b.eventId === eventId).length,
        confirmed: bookings.filter((b) => b.eventId === eventId && b.status === "confirmed").length,
        pending: bookings.filter((b) => b.eventId === eventId && b.status === "pending").length,
    });

    // ── form handlers ──
    const resetForm = () => {
        setShowForm(false);
        setIsEditMode(false);
        setFormData(EMPTY_FORM);
        setImagePreview("");
        setTagInput("");
        setHighlightInput("");
    };

    const openAdd = () => { resetForm(); setShowForm(true); };

    const openEdit = (evt) => {
        setFormData({ ...EMPTY_FORM, ...evt });
        setImagePreview(evt.image || "");
        setIsEditMode(true);
        setShowForm(true);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData((p) => ({ ...p, image: reader.result }));
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!formData.title.trim() || !formData.date) {
            alert("Title and Date are required.");
            return;
        }
        const payload = {
            ...formData,
            id: isEditMode ? formData.id : generateId(formData.title),
            maxCapacity: Number(formData.maxCapacity) || 0,
            price: Number(formData.price) || 0,
        };

        if (isEditMode) {
            await api.put(`/events/${payload.id}`, payload);
            setAdminData((p) => ({
                ...p,
                events: p.events.map((e) => (e.id === payload.id ? payload : e)),
            }));
        } else {
            const res = await api.post("/events", payload);
            setAdminData((p) => ({ ...p, events: [...(p.events || []), res.data] }));
        }
        resetForm();
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this event?")) return;
        await api.delete(`/events/${id}`);
        setAdminData((p) => ({ ...p, events: p.events.filter((e) => e.id !== id) }));
    };

    const handleTogglePublish = async (evt) => {
        const updated = { ...evt, isPublished: !evt.isPublished };
        await api.put(`/events/${evt.id}`, updated);
        setAdminData((p) => ({
            ...p,
            events: p.events.map((e) => (e.id === evt.id ? updated : e)),
        }));
    };

    const handleBookingStatus = async (bookingId, newStatus) => {
        const booking = bookings.find((b) => b.id === bookingId);
        if (!booking) return;
        const updated = { ...booking, status: newStatus };
        await api.put(`/eventBookings/${bookingId}`, updated);
        setAdminData((p) => ({
            ...p,
            eventBookings: p.eventBookings.map((b) => (b.id === bookingId ? updated : b)),
        }));
        if (viewBooking?.id === bookingId) setViewBooking(updated);
    };

    // ── render ──
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
                        <button
                            className={`ae-tab-pill ${activeTab === "events" ? "active" : ""}`}
                            onClick={() => setActiveTab("events")}
                        >
                            🎉 Events
                            <span className="ae-badge">{events.length}</span>
                        </button>
                        <button
                            className={`ae-tab-pill ${activeTab === "bookings" ? "active" : ""}`}
                            onClick={() => setActiveTab("bookings")}
                        >
                            📋 Bookings
                            <span className="ae-badge ae-badge-purple">{bookings.length}</span>
                        </button>
                    </div>
                    {activeTab === "events" && (
                        <button className="ae-add-btn" onClick={openAdd}>
                            + Create Event
                        </button>
                    )}
                </div>
            </div>

            {/* ══════════════════════ EVENTS TAB ══════════════════════ */}
            {activeTab === "events" && (
                <>
                    {events.length === 0 ? (
                        <div className="ae-empty-state">
                            <div className="ae-empty-icon">🎪</div>
                            <p>No events yet. Create your first event!</p>
                        </div>
                    ) : (
                        <div className="ae-events-grid">
                            {events.map((evt) => {
                                const stats = statsForEvent(evt.id);
                                const pct = evt.maxCapacity
                                    ? Math.min(100, Math.round((stats.confirmed / evt.maxCapacity) * 100))
                                    : 0;
                                return (
                                    <div className="ae-event-card" key={evt.id}>
                                        <div className="ae-event-card-image">
                                            {evt.image ? (
                                                <img src={evt.image} alt={evt.title} />
                                            ) : (
                                                <div className="ae-event-card-placeholder">🎉</div>
                                            )}
                                            <span
                                                className="ae-status-badge"
                                                style={{ background: STATUS_COLORS[evt.status] }}
                                            >
                                                {evt.status}
                                            </span>
                                            <span className={`ae-publish-dot ${evt.isPublished ? "published" : "draft"}`}>
                                                {evt.isPublished ? "● Live" : "● Draft"}
                                            </span>
                                        </div>

                                        <div className="ae-event-card-body">
                                            <div className="ae-event-type-tag">{evt.eventType}</div>
                                            <h3 className="ae-event-title">{evt.title}</h3>
                                            <p className="ae-event-desc">{evt.description}</p>

                                            <div className="ae-event-meta">
                                                <span>📅 {formatDate(evt.date)}</span>
                                                {evt.time && <span>⏰ {evt.time}</span>}
                                                {evt.venue && <span>📍 {evt.venue}</span>}
                                                <span>
                                                    💰 {evt.price === 0 || !evt.price ? "Free" : `₹${Number(evt.price).toLocaleString("en-IN")}/person`}
                                                </span>
                                            </div>

                                            {evt.maxCapacity > 0 && (
                                                <div className="ae-capacity-bar">
                                                    <div className="ae-capacity-label">
                                                        <span>Capacity</span>
                                                        <span>
                                                            {stats.confirmed}/{evt.maxCapacity} confirmed
                                                        </span>
                                                    </div>
                                                    <div className="ae-progress-track">
                                                        <div
                                                            className="ae-progress-fill"
                                                            style={{
                                                                width: `${pct}%`,
                                                                background: pct >= 90 ? "#dc2626" : pct >= 60 ? "#f59e0b" : "#16a34a",
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="ae-mini-stats">
                                                <div className="ae-mini-stat">
                                                    <span className="ae-mini-val">{stats.total}</span>
                                                    <span className="ae-mini-label">Total</span>
                                                </div>
                                                <div className="ae-mini-stat">
                                                    <span className="ae-mini-val" style={{ color: "#16a34a" }}>{stats.confirmed}</span>
                                                    <span className="ae-mini-label">Confirmed</span>
                                                </div>
                                                <div className="ae-mini-stat">
                                                    <span className="ae-mini-val" style={{ color: "#f59e0b" }}>{stats.pending}</span>
                                                    <span className="ae-mini-label">Pending</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ae-event-card-footer">
                                            <button
                                                className="ae-card-btn ae-view-btn"
                                                onClick={() => {
                                                    setFilterEventId(evt.id);
                                                    setActiveTab("bookings");
                                                }}
                                            >
                                                View Bookings
                                            </button>
                                            <button className="ae-card-btn ae-edit-btn" onClick={() => openEdit(evt)}>
                                                Edit
                                            </button>
                                            <button
                                                className={`ae-card-btn ae-publish-btn ${evt.isPublished ? "unpublish" : "publish"}`}
                                                onClick={() => handleTogglePublish(evt)}
                                            >
                                                {evt.isPublished ? "Unpublish" : "Publish"}
                                            </button>
                                            <button
                                                className="ae-card-btn ae-delete-btn"
                                                onClick={() => handleDelete(evt.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ══════════════════════ BOOKINGS TAB ══════════════════════ */}
            {activeTab === "bookings" && (
                <div className="ae-bookings-section">
                    {/* filters */}
                    <div className="ae-booking-filters">
                        <input
                            type="text"
                            placeholder="Search by name, email or phone…"
                            className="ae-search-input"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <select
                            className="ae-filter-select"
                            value={filterEventId}
                            onChange={(e) => setFilterEventId(e.target.value)}
                        >
                            <option value="all">All Events</option>
                            {events.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.title}
                                </option>
                            ))}
                        </select>
                        <select
                            className="ae-filter-select"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        {(filterEventId !== "all" || filterStatus !== "all" || searchQuery) && (
                            <button
                                className="ae-clear-filter"
                                onClick={() => { setFilterEventId("all"); setFilterStatus("all"); setSearchQuery(""); }}
                            >
                                Clear
                            </button>
                        )}
                        <span className="ae-result-count">{filteredBookings.length} result(s)</span>
                    </div>

                    {/* table */}
                    <div className="ae-booking-table-wrapper">
                        {filteredBookings.length === 0 ? (
                            <div className="ae-empty-state">
                                <div className="ae-empty-icon">📭</div>
                                <p>No bookings found.</p>
                            </div>
                        ) : (
                            <table className="ae-booking-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Name</th>
                                        <th>Event</th>
                                        <th>Date</th>
                                        <th>Guests</th>
                                        <th>Amount</th>
                                        <th>Status</th>
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
                                                <td>
                                                    {b.totalAmount
                                                        ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}`
                                                        : "—"}
                                                </td>
                                                <td>
                                                    <span className={`ae-status-chip ae-status-${b.status}`}>
                                                        {b.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="ae-booking-actions">
                                                        <button
                                                            className="ae-tbl-btn ae-tbl-view"
                                                            onClick={() => setViewBooking(b)}
                                                        >
                                                            View
                                                        </button>
                                                        {b.status === "pending" && (
                                                            <button
                                                                className="ae-tbl-btn ae-tbl-confirm"
                                                                onClick={() => handleBookingStatus(b.id, "confirmed")}
                                                            >
                                                                Confirm
                                                            </button>
                                                        )}
                                                        {b.status !== "cancelled" && (
                                                            <button
                                                                className="ae-tbl-btn ae-tbl-cancel"
                                                                onClick={() => handleBookingStatus(b.id, "cancelled")}
                                                            >
                                                                Cancel
                                                            </button>
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

            {/* ══════════════════════ CREATE / EDIT MODAL ══════════════════════ */}
            {showForm && (
                <div className="ingredient-modal-overlay">
                    <div className="ingredient-modal ae-event-modal">
                        <div className="ingredient-modal-header">
                            <h3>{isEditMode ? "Edit Event" : "Create New Event"}</h3>
                            <button className="ingredient-close-btn" onClick={resetForm} aria-label="Close" />
                        </div>

                        <div className="ingredient-modal-body ae-event-form-body">
                            {/* Title */}
                            <div className="form-group">
                                <label>Event Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Sunday Brunch Special"
                                    required
                                />
                            </div>

                            {/* Type + Status row */}
                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Event Type</label>
                                    <select
                                        value={formData.eventType}
                                        onChange={(e) => setFormData((p) => ({ ...p, eventType: e.target.value }))}
                                    >
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
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
                                    >
                                        <option value="upcoming">Upcoming</option>
                                        <option value="ongoing">Ongoing</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Date + Time row */}
                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Date *</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <input
                                        type="time"
                                        value={formData.time}
                                        onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Venue */}
                            <div className="form-group">
                                <label>Venue / Location</label>
                                <input
                                    type="text"
                                    value={formData.venue}
                                    onChange={(e) => setFormData((p) => ({ ...p, venue: e.target.value }))}
                                    placeholder="e.g. Rooftop Hall, Sam Cafe"
                                />
                            </div>

                            {/* Capacity + Price */}
                            <div className="ae-form-row">
                                <div className="form-group">
                                    <label>Max Capacity</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.maxCapacity}
                                        onChange={(e) => setFormData((p) => ({ ...p, maxCapacity: e.target.value }))}
                                        placeholder="0 = unlimited"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Price per Person (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                                        placeholder="0 = free"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={formData.description}
                                    rows={3}
                                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="Brief description of the event…"
                                />
                            </div>

                            {/* Image */}
                            <div className="form-group">
                                <label>Event Image</label>
                                <input type="file" accept="image/*" onChange={handleImageUpload} />
                                {imagePreview && (
                                    <img src={imagePreview} alt="preview" className="ingredient-image-preview" />
                                )}
                            </div>

                            {/* Tags */}
                            <div className="form-group">
                                <label>Tags</label>
                                <div className="ae-tag-input-row">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        placeholder="Add a tag…"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                if (!tagInput.trim()) return;
                                                setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] }));
                                                setTagInput("");
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!tagInput.trim()) return;
                                            setFormData((p) => ({ ...p, tags: [...(p.tags || []), tagInput.trim()] }));
                                            setTagInput("");
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="ae-tag-chips">
                                    {(formData.tags || []).map((t, i) => (
                                        <span key={i} className="ae-chip">
                                            {t}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormData((p) => ({ ...p, tags: p.tags.filter((_, j) => j !== i) }))
                                                }
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Highlights */}
                            <div className="form-group">
                                <label>Event Highlights</label>
                                <div className="ae-tag-input-row">
                                    <input
                                        type="text"
                                        value={highlightInput}
                                        onChange={(e) => setHighlightInput(e.target.value)}
                                        placeholder="e.g. Live music, Buffet included…"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                if (!highlightInput.trim()) return;
                                                setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] }));
                                                setHighlightInput("");
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!highlightInput.trim()) return;
                                            setFormData((p) => ({ ...p, highlights: [...(p.highlights || []), highlightInput.trim()] }));
                                            setHighlightInput("");
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="ae-tag-chips">
                                    {(formData.highlights || []).map((h, i) => (
                                        <span key={i} className="ae-chip ae-chip-green">
                                            ✓ {h}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setFormData((p) => ({ ...p, highlights: p.highlights.filter((_, j) => j !== i) }))
                                                }
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Published toggle */}
                            <div className="form-group ae-publish-toggle">
                                <label className="ae-toggle-label">
                                    <span>Publish Event (visible to users)</span>
                                    <div
                                        className={`ae-toggle ${formData.isPublished ? "on" : "off"}`}
                                        onClick={() => setFormData((p) => ({ ...p, isPublished: !p.isPublished }))}
                                    >
                                        <div className="ae-toggle-knob" />
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="ingredient-modal-footer">
                            <div className="form-actions">
                                <button type="button" onClick={handleSave}>
                                    {isEditMode ? "Save Changes" : "Create Event"}
                                </button>
                                <button type="button" onClick={resetForm}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════ BOOKING DETAIL MODAL ══════════════════════ */}
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
                                                    <tr><td>Guests</td><td>{b.guests}</td></tr>
                                                    {b.specialRequests && (
                                                        <tr><td>Special Requests</td><td>{b.specialRequests}</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="ae-detail-section">
                                            <h4>Booking Info</h4>
                                            <table className="ae-detail-table">
                                                <tbody>
                                                    <tr><td>Booking ID</td><td className="ae-mono">{b.id}</td></tr>
                                                    <tr><td>Booked On</td><td>{formatDate(b.bookedAt)}</td></tr>
                                                    <tr><td>Amount</td><td>{b.totalAmount ? `₹${Number(b.totalAmount).toLocaleString("en-IN")}` : "—"}</td></tr>
                                                    <tr>
                                                        <td>Status</td>
                                                        <td>
                                                            <span className={`ae-status-chip ae-status-${b.status}`}>{b.status}</span>
                                                        </td>
                                                    </tr>
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
                                    <button onClick={() => handleBookingStatus(viewBooking.id, "confirmed")}>
                                        Confirm Booking
                                    </button>
                                )}
                                {viewBooking.status !== "cancelled" && (
                                    <button
                                        style={{ background: "#dc2626" }}
                                        onClick={() => handleBookingStatus(viewBooking.id, "cancelled")}
                                    >
                                        Cancel Booking
                                    </button>
                                )}
                                <button onClick={() => setViewBooking(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Events;