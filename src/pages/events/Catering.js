/* admin panel */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Catering.css";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";

/* ─── helpers ─── */
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; };
const fmtTime = (t) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };

const SOURCE_OPTIONS = ["User App", "WhatsApp", "Phone", "In Person"];

/* ── tabs for create modal ── */
const TABS = ["Details", "Dishes", "Review"];

/* ══════════════════════════════════════
   Dish Picker (Tab 2) — categories + items
══════════════════════════════════════ */
const DishPicker = ({ menuData, selectedItems, setSelectedItems }) => {
  // menuData is the raw /categories response: array of { id, name, subCategories: [{ id, name, dishes: [...] }] }
  const { categories, dishes } = useMemo(() => {
    if (!menuData) return { categories: [], dishes: [] };

    // Case 1: flat array of dishes (legacy)
    if (Array.isArray(menuData) && menuData.length > 0 && menuData[0].basePrice !== undefined) {
      return { categories: [], dishes: menuData };
    }

    // Case 2: array of top-level categories with subCategories->dishes (db structure)
    const rawCats = Array.isArray(menuData) ? menuData : (menuData.categories || []);
    const flatCats = [];
    const flatDishes = [];

    rawCats.forEach(topCat => {
      const subs = topCat.subCategories || [];
      if (subs.length > 0) {
        subs.forEach(sub => {
          flatCats.push({ id: sub.id, name: sub.name, parentName: topCat.name });
          (sub.dishes || []).forEach(dish => {
            flatDishes.push({
              ...dish,
              price: dish.basePrice || dish.price || 0,
              categoryId: sub.id,
              category: sub.name,
            });
          });
        });
      } else {
        // top-level category has dishes directly
        flatCats.push({ id: topCat.id, name: topCat.name });
        (topCat.dishes || []).forEach(dish => {
          flatDishes.push({
            ...dish,
            price: dish.basePrice || dish.price || 0,
            categoryId: topCat.id,
            category: topCat.name,
          });
        });
      }
    });

    return { categories: flatCats, dishes: flatDishes };
  }, [menuData]);

  const [activeCat, setActiveCat] = useState("");

  const filteredDishes = useMemo(() => {
    if (!activeCat) return dishes;
    return dishes.filter(d => d.categoryId === activeCat || d.category === activeCat);
  }, [dishes, activeCat]);

  const toggle = (dish) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === dish.id);
      if (exists) return prev.filter(i => i.id !== dish.id);
      return [...prev, { ...dish, quantity: 1, totalPrice: dish.price || dish.unitPrice || 0 }];
    });
  };

  const changeQty = (dishId, delta) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.id !== dishId) return i;
      const qty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: qty, totalPrice: (i.price || i.unitPrice || 0) * qty };
    }));
  };

  const isSelected = (id) => selectedItems.some(i => i.id === id);
  const getQty = (id) => selectedItems.find(i => i.id === id)?.quantity || 0;

  return (
    <div className="act-dish-picker">
      {/* Category filter dropdown */}
      <div className="act-cat-dropdown-wrap">
        <select
          className="act-cat-dropdown"
          value={activeCat}
          onChange={e => setActiveCat(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="act-cat-dropdown-arrow">▾</span>
      </div>

      {/* Dish grid */}
      <div className="act-dish-grid">
        {filteredDishes.length === 0 ? (
          <div className="act-dish-empty">No dishes found</div>
        ) : (
          filteredDishes.map(dish => {
            const sel = isSelected(dish.id);
            const qty = getQty(dish.id);
            const price = dish.price || dish.unitPrice || 0;
            return (
              <div key={dish.id} className={`act-dish-card${sel ? " selected" : ""}`}>
                <div className="act-dish-info">
                  <div className="act-dish-name">{dish.name}</div>
                  <div className="act-dish-price">₹{price}</div>
                  {dish.category && <div className="act-dish-cat">{dish.category}</div>}
                </div>
                {sel ? (
                  <div className="act-dish-stepper">
                    <button onClick={() => changeQty(dish.id, -1)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => changeQty(dish.id, 1)}>+</button>
                  </div>
                ) : (
                  <button className="act-dish-add-btn" onClick={() => toggle(dish)}>+ Add</button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const buildCatAddress = (f) => [
  f.addrDoorNo, f.addrStreet, f.addrArea,
  f.addrLandmark, f.addrCity, f.addrState, f.addrPincode,
].filter(Boolean).join(", ");

/* ══════════════════════════════════════
   Empty form state
══════════════════════════════════════ */
const EMPTY_FORM = {
  name: "", mobile: "", email: "",
  guests: 2,
  eventDate: "", time: "",
  location: "",
  addrDoorNo: "", addrStreet: "", addrArea: "",
  addrLandmark: "", addrCity: "", addrState: "", addrPincode: "",
  notes: "",
  source: "Phone",
  status: "pending",
};

/* ══════════════════════════════════════
   Main Component — Admin Catering
══════════════════════════════════════ */
const Catering = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  /* filters */
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  /* create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [itemsPopup, setItemsPopup] = useState(null); // holds the order whose items we're viewing

  const data = adminData?.cateringOrders || [];

  /* KPI counts */
  const todayCount = data.filter(r => r.date === todayStr() || r.eventDate === todayStr()).length;
  const pendingCount = data.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = data.filter(r => r.status === "confirmed").length;

  /* Load menu when modal opens */
  useEffect(() => {
    if (showCreate && !menuData) {
      api.get("/categories").then(res => setMenuData(res.data)).catch(() => setMenuData([]));
    }
  }, [showCreate]);

  /* Filter + sort */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterDate) d = d.filter(i => (i.date || i.eventDate) === filterDate);
    if (filterStatus) d = d.filter(i => (i.status || "pending") === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(i =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.mobile || "").includes(q) ||
        (i.id || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filterDate, filterStatus, search]);

  const sortedData = useMemo(() =>
    [...filteredData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [filteredData]);

  /* Inline status update */
  const updateStatus = async (e, id, newStatus) => {
    e.stopPropagation();
    const prev = data.find(c => c.id === id);
    if (!prev) return;
    setAdminData(p => ({ ...p, cateringOrders: (p.cateringOrders || []).map(c => c.id === id ? { ...c, status: newStatus } : c) }));
    try {
      try { await api.patch(`/cateringOrders/${id}`, { status: newStatus }); }
      catch { await api.put(`/cateringOrders/${id}`, { ...prev, status: newStatus }); }
      toast.success(`Status updated to ${newStatus}`);
    } catch {
      setAdminData(p => ({ ...p, cateringOrders: (p.cateringOrders || []).map(c => c.id === id ? prev : c) }));
      toast.error("Failed to update status");
    }
  };

  /* Form helpers */
  const setF = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormErrors(e => ({ ...e, [key]: "" })); };

  const validateTab0 = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) e.mobile = "Valid 10-digit number";
    if (!form.eventDate) e.eventDate = "Event date required";
    if (!form.time) e.time = "Time required";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (tab === 0 && !validateTab0()) return;
    setTab(t => Math.min(t + 1, 2));
  };

  const totalAmount = selectedItems.reduce((s, i) => s + (i.totalPrice || 0), 0);

  const handleCreate = async () => {
    if (!validateTab0()) { setTab(0); return; }
    setSaving(true);
    try {
      const id = `cat_${Date.now()}`;
      const payload = {
        id,
        ...form,
        date: form.eventDate,
        items: selectedItems,
        totalAmount,
        status: form.status || "pending",
        createdAt: new Date().toISOString(),
      };
      await api.post("/cateringOrders", payload);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, cateringOrders: [...(p.cateringOrders || []), payload] }));
      }
      toast.success("Catering order created.");
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      setSelectedItems([]);
      setTab(0);
    } catch {
      toast.error("Failed to create catering order.");
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => { setShowCreate(true); setForm({ ...EMPTY_FORM }); setSelectedItems([]); setTab(0); setFormErrors({}); };

  const activeFilters = filterDate || filterStatus || search.trim();

  return (
    <div className="act-page">

      {/* HEADER */}
      <div className="act-header">
        <div>
          <h2 className="act-title">Catering Orders</h2>
          <p className="act-subtitle">Manage catering & event food orders</p>
        </div>
        <button className="evt-res-create-btn" onClick={openCreate}>+ Add Catering Order</button>
      </div>

      {/* KPI STRIP */}
      <div className="act-kpi-row">
        {[
          { label: "Total", val: data.length, color: "#111" },
          { label: "Today", val: todayCount, color: "#2980b9" },
          { label: "Pending", val: pendingCount, color: "#ca8a04" },
          { label: "Confirmed", val: confirmedCount, color: "#16a34a" },
        ].map((k, i) => (
          <div key={i} className="act-kpi" style={{ borderTopColor: k.color }}>
            <div className="act-kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="act-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="act-filter-bar">
        <input className="act-search" placeholder="Search name / mobile / ID..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="act-filter-groups">

          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="act-filter-group-label">Date</span>
            <div style={{ minWidth: 160 }}>
              <CustomDatePicker value={filterDate} onChange={setFilterDate} placeholder="All dates" />
            </div>
            {filterDate && <button className="act-filter-btn" onClick={() => setFilterDate("")}>✕</button>}
          </div>

          {/* Status */}
          <div className="act-filter-group">
            <span className="act-filter-group-label">Status</span>
            {["pending", "confirmed", "completed"].map(s => (
              <button key={s}
                className={`act-filter-btn${filterStatus === s ? " active act-status-" + s : ""}`}
                onClick={() => setFilterStatus(p => p === s ? "" : s)}>
                {s === "pending" ? "P" : s === "confirmed" ? "C" : "D"}
              </button>
            ))}
          </div>

          {activeFilters && (
            <button className="act-clear-btn" onClick={() => { setFilterDate(todayStr()); setFilterStatus(""); setSearch(""); }}>Clear</button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="act-table-wrapper">
        <table className="act-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Contact</th>
              <th>Date</th>
              <th>Time</th>
              <th>Guests</th>
              <th>Items</th>
              <th>Total</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="9" className="act-empty">No catering orders found</td></tr>
            ) : (
              sortedData.map(item => {
                const status = item.status || "pending";
                const date = item.date || item.eventDate || "—";
                return (
                  <tr key={item.id} className="act-row clickable" onClick={() => navigate(`/catering/${item.id}`)}>

                    {/* Guest */}
                    <td>
                      <div className="act-name-cell">
                        <div className="act-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="act-name">{item.name || "—"}</div>
                          <div className="act-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="act-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="act-email">{item.email}</span>}
                      </div>
                    </td>

                    <td style={{ fontWeight: 600 }}>{date}</td>
                    <td>{fmtTime(item.time)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.guests || "—"}</td>
                    <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      {item.items?.length > 0 ? (
                        <button
                          onClick={() => setItemsPopup(item)}
                          style={{
                            background: "#f0f4ff", border: "1.5px solid #c7d2fe",
                            borderRadius: "999px", padding: "3px 12px",
                            fontWeight: 700, fontSize: 13, color: "#3730a3",
                            cursor: "pointer", fontFamily: "inherit",
                          }}>
                          {item.items.length}
                        </button>
                      ) : (
                        <span style={{ color: "#bbb", fontSize: 13 }}>0</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{(item.totalAmount || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: "#666" }}>{item.location || "—"}</td>

                    {/* Inline status */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-res-inline-status">
                        {["pending", "confirmed", "completed", "cancelled"].map(s => (
                          <button key={s} title={s}
                            className={`evt-res-istatus-btn evt-res-istatus-${s}${status === s ? " active" : ""}`}
                            onClick={e => updateStatus(e, item.id, s)}>
                            {s === "pending" ? "P" : s === "confirmed" ? "C" : s === "completed" ? "D" : "X"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ══ ITEMS POPUP ══ */}
      {itemsPopup && (
        <div className="ingredient-modal-overlay" onClick={() => setItemsPopup(null)}>
          <div className="ingredient-modal" style={{ width: 520, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
            <div className="ingredient-modal-header">
              <h3>
                Dishes — {itemsPopup.name}
                <span style={{ fontSize: 12, fontWeight: 400, color: "#888", marginLeft: 8 }}>
                  #{(itemsPopup.id || "").slice(-6)}
                </span>
              </h3>
              <button className="ingredient-close-btn" onClick={() => setItemsPopup(null)} />
            </div>
            <div className="ingredient-modal-body" style={{ padding: "12px 20px 20px" }}>
              {(!itemsPopup.items || itemsPopup.items.length === 0) ? (
                <p style={{ textAlign: "center", color: "#aaa", padding: "24px 0" }}>No dishes in this order.</p>
              ) : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                        {["#", "Dish", "Category", "Qty", "Unit Price", "Total"].map(h => (
                          <th key={h} style={{
                            padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#888",
                            textTransform: "uppercase", textAlign: h === "#" || h === "Qty" ? "center" : "left"
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itemsPopup.items.map((dish, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f5f5f5" }}>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: 12, color: "#bbb", fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: "10px", fontWeight: 600, fontSize: 13, color: "#111" }}>{dish.name || "—"}</td>
                          <td style={{ padding: "10px", fontSize: 12, color: "#888" }}>{dish.category || dish.categoryId || "—"}</td>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, fontSize: 13 }}>{dish.quantity || 1}</td>
                          <td style={{ padding: "10px", fontSize: 13 }}>₹{dish.price || dish.unitPrice || dish.basePrice || 0}</td>
                          <td style={{ padding: "10px", fontWeight: 700, fontSize: 13, color: "#111" }}>
                            ₹{dish.totalPrice || ((dish.price || dish.unitPrice || dish.basePrice || 0) * (dish.quantity || 1))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f8fafc" }}>
                        <td colSpan="5" style={{ padding: "10px", fontWeight: 700, fontSize: 13 }}>Total Amount</td>
                        <td style={{ padding: "10px", fontWeight: 800, fontSize: 15, color: "#111" }}>
                          ₹{(itemsPopup.totalAmount || itemsPopup.items.reduce((s, d) => s + (d.totalPrice || 0), 0)).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CREATE MODAL ══ */}
      {showCreate && (
        <div className="event-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="event-modal act-modal" onClick={e => e.stopPropagation()}>

            <div className="event-modal-header">
              <div>
                <h3>Add Catering Order</h3>
                <div className="ae-spec-steps">
                  {TABS.map((t, i) => (
                    <button key={i}
                      className={`ae-spec-step${tab === i ? " active" : ""}${tab > i ? " done" : ""}`}
                      onClick={() => i < tab && setTab(i)}>
                      <span className="ae-step-num">{tab > i ? "✓" : i + 1}</span>
                      <span className="ae-step-label">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="ingredient-close-btn" onClick={() => setShowCreate(false)} />
            </div>

            <div className={`event-modal-body act-modal-body${tab === 1 ? " act-modal-body--split" : ""}`}>

              {/* ── TAB 0: Details ── */}
              {tab === 0 && (
                <>
                  <div className="evt-res-form-section-label">Customer Information</div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1.4 }}>
                      <label>Name <span className="evt-res-req">*</span></label>
                      <input className={formErrors.name ? "error" : ""} placeholder="Customer name"
                        value={form.name} onChange={e => setF("name", e.target.value)} />
                      {formErrors.name && <span className="evt-res-form-error">{formErrors.name}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Guests</label>
                      <div className="evt-res-stepper">
                        <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                        <span>{form.guests}</span>
                        <button type="button" onClick={() => setF("guests", Math.min(1000, form.guests + 1))}>+</button>
                      </div>
                    </div>
                  </div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Mobile <span className="evt-res-req">*</span></label>
                      <input className={formErrors.mobile ? "error" : ""} placeholder="10-digit number" type="tel"
                        value={form.mobile} onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                      {formErrors.mobile && <span className="evt-res-form-error">{formErrors.mobile}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Email</label>
                      <input placeholder="email@example.com" value={form.email} onChange={e => setF("email", e.target.value)} />
                    </div>
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Event Details</div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Event Date <span className="evt-res-req">*</span></label>
                      <CustomDatePicker value={form.eventDate} min={todayStr()} onChange={v => setF("eventDate", v)} placeholder="Select date" />
                      {formErrors.eventDate && <span className="evt-res-form-error">{formErrors.eventDate}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Time <span className="evt-res-req">*</span></label>
                      <CustomTimePicker value={form.time} onChange={v => setF("time", v)} />
                      {formErrors.time && <span className="evt-res-form-error">{formErrors.time}</span>}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Event Location</label>
                    <div className="ae-addr-grid">
                      <div className="ae-addr-field">
                        <label>Door No. <span className="ae-req">*</span></label>
                        <input type="text" value={form.addrDoorNo} placeholder="Door / Flat No."
                          onChange={e => { const v = e.target.value; setForm(p => ({ ...p, addrDoorNo: v, location: buildCatAddress({ ...p, addrDoorNo: v }) })); }} />
                      </div>
                      <div className="ae-addr-field">
                        <label>Street <span className="ae-req">*</span></label>
                        <input type="text" value={form.addrStreet} placeholder="Street / Road name"
                          onChange={e => { const v = e.target.value; setForm(p => ({ ...p, addrStreet: v, location: buildCatAddress({ ...p, addrStreet: v }) })); }} />
                      </div>
                      <div className="ae-addr-field">
                        <label>Area <span className="ae-req">*</span></label>
                        <input type="text" value={form.addrArea} placeholder="Area / Locality"
                          onChange={e => { const v = e.target.value; setForm(p => ({ ...p, addrArea: v, location: buildCatAddress({ ...p, addrArea: v }) })); }} />
                      </div>
                      <div className="ae-addr-field">
                        <label>Landmark <span style={{ fontSize: 10, color: "#aaa" }}>(optional)</span></label>
                        <input type="text" value={form.addrLandmark} placeholder="Near / opposite…"
                          onChange={e => { const v = e.target.value; setForm(p => ({ ...p, addrLandmark: v, location: buildCatAddress({ ...p, addrLandmark: v }) })); }} />
                      </div>
                      <div className="ae-addr-field">
                        <label>City <span className="ae-req">*</span></label>
                        <input type="text" value={form.addrCity} placeholder="City"
                          onChange={e => { const v = e.target.value; setForm(p => ({ ...p, addrCity: v, location: buildCatAddress({ ...p, addrCity: v }) })); }} />
                      </div>
                      <div className="ae-addr-field">
                        <label>State <span className="ae-req">*</span></label>
                        <input type="text" value={form.addrState} placeholder="State"
                          onChange={e => { const v = e.target.value; setForm(p => ({ ...p, addrState: v, location: buildCatAddress({ ...p, addrState: v }) })); }} />
                      </div>
                      <div className="ae-addr-field">
                        <label>Pincode <span className="ae-req">*</span></label>
                        <input type="text" value={form.addrPincode} placeholder="6-digit pincode" maxLength={6}
                          onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setForm(p => ({ ...p, addrPincode: v, location: buildCatAddress({ ...p, addrPincode: v }) })); }} />
                      </div>
                    </div>
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Source & Status</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Source</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {SOURCE_OPTIONS.map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip${form.source === s ? " active" : ""}`}
                            onClick={() => setF("source", s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Status</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["pending", "confirmed"].map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip${form.status === s ? " active" : ""}`}
                            onClick={() => setF("status", s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 4 }}>
                    <label>Notes</label>
                    <textarea rows={2} placeholder="Special requirements..." value={form.notes} onChange={e => setF("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* ── TAB 1: Dishes (two-column) ── */}
              {tab === 1 && (
                <div className="ae-dishes-split">
                  {/* LEFT: picker */}
                  <div className="ae-dishes-split-left">
                    <DishPicker
                      menuData={menuData}
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                    />
                  </div>
                  {/* RIGHT: selected list + total */}
                  <div className="ae-dishes-split-right">
                    <div className="ae-dishes-right-header">
                      Selected Dishes
                      {selectedItems.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#888", marginLeft: 6 }}>
                          ({selectedItems.length})
                        </span>
                      )}
                    </div>
                    {selectedItems.length === 0 ? (
                      <div className="ae-dishes-empty-right">No dishes selected yet.<br />Pick dishes from the left panel.</div>
                    ) : (
                      <>
                        <div className="ae-dishes-right-list">
                          {selectedItems.map(item => (
                            <div key={item.id} className="ae-dishes-right-item">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "#111", lineHeight: 1.3 }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                  {item.category || "—"} · qty: {item.quantity}
                                </div>
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-red,#e74c3c)", flexShrink: 0 }}>
                                ₹{item.totalPrice || 0}
                              </div>
                              <button type="button" className="ae-sdt-remove"
                                onClick={() => setSelectedItems(p => p.filter(x => x.id !== item.id))}
                                title="Remove">×</button>
                            </div>
                          ))}
                        </div>
                        <div className="ae-dishes-right-total">
                          <span>Total Amount</span>
                          <span>₹{totalAmount.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 2: Review ── */}
              {tab === 2 && (
                <div className="act-review">
                  <div className="act-review-section">
                    <div className="act-review-title">Customer Details</div>
                    <div className="act-review-grid">
                      {[
                        ["Name", form.name], ["Mobile", form.mobile], ["Email", form.email || "—"],
                        ["Date", form.eventDate], ["Time", fmtTime(form.time)], ["Guests", form.guests],
                        ["Location", form.location || "—"], ["Source", form.source], ["Status", form.status],
                      ].map(([l, v]) => (
                        <div key={l} className="act-review-cell">
                          <div className="act-review-label">{l}</div>
                          <div className="act-review-val">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="act-review-section">
                    <div className="act-review-title">Selected Dishes ({selectedItems.length})</div>
                    {selectedItems.length === 0 ? (
                      <div className="act-review-empty">No dishes selected</div>
                    ) : (
                      <table className="act-review-table">
                        <thead>
                          <tr><th>Dish</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                          {selectedItems.map((item, i) => (
                            <tr key={i}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: "center" }}>{item.quantity}</td>
                              <td>₹{item.price || item.unitPrice || 0}</td>
                              <td style={{ fontWeight: 600 }}>₹{item.totalPrice || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="act-review-total-row">
                            <td colSpan="3" style={{ fontWeight: 700 }}>Total Amount</td>
                            <td style={{ fontWeight: 800, fontSize: 15 }}>₹{totalAmount.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  {form.notes && (
                    <div className="act-review-section">
                      <div className="act-review-title">Notes</div>
                      <div className="act-review-notes">{form.notes}</div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="event-modal-footer">
              <div className="form-actions ae-spec-footer">
                {tab > 0 && <button type="button" className="ae-step-prev-btn" onClick={() => setTab(t => t - 1)}>← Back</button>}
                {tab < 2
                  ? <button type="button" className="btn-primary" onClick={handleNext}>Next →</button>
                  : <button type="button" className="btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Saving..." : "Create Order"}</button>
                }
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Catering;