/* admin panel */
import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import closeIcon from "../../icon/close-icon.png";
import api from "../../api";
import "./Catering.css";
import "./PreviewModal.css";
import "../ModalCSS.css";
import "./EvtCommon.css";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";

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

/* ─── helpers ─── */
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; };
const fmtTime = (t) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };
const getWeekRange = () => {
  const now = new Date(); const day = now.getDay();
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

const SOURCE_OPTIONS = ["User App", "WhatsApp", "Phone", "In Person"];

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", start: "18:30", end: "22:00" },
];
const TABS = ["Details", "Dishes", "Review"];
const RESTAURANT_ADDRESS = {
  addrDoorNo: "12, Sam Cafe", addrStreet: "GR Nagar", addrArea: "GR Nagar",
  addrLandmark: "Near Andavar Meat Shop", addrCity: "Madurai",
  addrDistrict: "Madurai", addrState: "Tamil Nadu", addrPincode: "625001",
};

const DECORATION_TIERS = [
  { value: "normal", label: "Normal", price: 1500 },
  { value: "elegant", label: "Elegant", price: 3000 },
  { value: "luxury", label: "Luxury", price: 5000 },
];

const EXTRA_PRICES = {
  cake: 500, specialMention: 0, mic: 500, projector: 800, liveMusic: 2000,
  surpriseGift: 300, candleLight: 800, music: 1500, speaker: 600,
};

/* Address builder */
const buildCatAddress = (f) => [
  f.addrDoorNo, f.addrStreet, f.addrArea,
  f.addrLandmark, f.addrCity, f.addrDistrict, f.addrState, f.addrPincode,
].filter(Boolean).join(", ");

/* Detect if a saved location string matches the restaurant address */
const RESTAURANT_LOCATION_STR = buildCatAddress(RESTAURANT_ADDRESS);
const isRestaurantLocation = (loc) => loc && loc.trim() === RESTAURANT_LOCATION_STR.trim();

/* ══════════════════════════════════════
   Dish Picker (Tab 2) — isEventFood filter, no qty selector
   Price = dish.price × guests
══════════════════════════════════════ */
const DishPicker = ({ menuData, selectedItems, setSelectedItems, guests }) => {
  const { categories, dishes } = useMemo(() => {
    if (!menuData) return { categories: [], dishes: [] };
    const rawCats = Array.isArray(menuData) ? menuData : (menuData.categories || []);
    const flatCats = [];
    const flatDishes = [];

    rawCats.forEach(topCat => {
      const subs = topCat.subCategories || [];
      if (subs.length > 0) {
        subs.forEach(sub => {
          flatCats.push({ id: sub.id, name: sub.name });
          (sub.dishes || [])
            .filter(d => d.isEventFood === true)
            .forEach(dish => {
              flatDishes.push({
                ...dish,
                price: dish.basePrice || dish.price || 0,
                categoryId: sub.id,
                category: sub.name,
              });
            });
        });
      } else {
        flatCats.push({ id: topCat.id, name: topCat.name });
        (topCat.dishes || [])
          .filter(d => d.isEventFood === true)
          .forEach(dish => {
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
    return dishes.filter(d => d.categoryId === activeCat);
  }, [dishes, activeCat]);

  const guestCount = Math.max(1, parseInt(guests, 10) || 1);

  const toggle = (dish) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === dish.id);
      if (exists) return prev.filter(i => i.id !== dish.id);
      const unitPrice = dish.price || 0;
      return [...prev, {
        ...dish,
        unitPrice,
        totalPrice: unitPrice * guestCount,
      }];
    });
  };

  /* Recalculate prices when guests changes */
  useEffect(() => {
    setSelectedItems(prev => prev.map(i => ({
      ...i,
      totalPrice: (i.unitPrice || i.price || 0) * guestCount,
    })));
  }, [guestCount]);

  const isSelected = (id) => selectedItems.some(i => i.id === id);

  return (
    <div className="act-dish-picker">
      <CustomDropdown
        value={activeCat}
        onChange={setActiveCat}
        options={[
          { value: "", label: "All Categories" },
          ...categories.map(c => ({ value: c.id, label: c.name })),
        ]}
      />
      {dishes.length === 0 && (
        <div className="act-dish-empty" style={{ color: "#ca8a04", padding: "16px", background: "#fef9c3", borderRadius: 8, fontSize: 13 }}>
          No event food dishes found. Mark dishes as "Event Food" in the Dishes section first.
        </div>
      )}
      <div className="act-dish-grid">
        {filteredDishes.length === 0 ? (
          <div className="act-dish-empty">No dishes in this category</div>
        ) : (
          filteredDishes.map(dish => {
            const sel = isSelected(dish.id);
            const unitPrice = dish.price || 0;
            const total = unitPrice * guestCount;
            return (
              <div key={dish.id} className={`act-dish-card${sel ? " selected" : ""}`}>
                <div className="act-dish-info">
                  <div className="act-dish-name">{dish.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    ₹{unitPrice}/person × {guestCount} guests = <strong style={{ color: "#e74c3c" }}>₹{total.toLocaleString()}</strong>
                  </div>
                  {dish.category && <div className="act-dish-cat">{dish.category}</div>}
                </div>
                {sel ? (
                  <button type="button" className="modal-save-btn" onClick={() => toggle(dish)}>
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front close-padding">✓ Added</span>
                  </button>
                ) : (
                  <button type="button" className="modal-cancel-btn" onClick={() => toggle(dish)}>
                    <span className="shadow"></span>
                    <span className="edge"></span>
                    <span className="front close-padding">+ Add</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   Empty form state
══════════════════════════════════════ */
const EMPTY_FORM = {
  name: "", mobile: "", email: "",
  guests: 10,
  eventDate: "", time: "", slotGroup: "",
  addrDoorNo: "", addrStreet: "", addrArea: "",
  addrLandmark: "", addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
  location: "",
  notes: "",
  /* Celebration-style fields */
  decoration: null,
  cake: false, specialMention: false, specialMentionText: "",
  mic: false, projector: false, music: false, speaker: false,
  liveMusic: false, surpriseGift: false,
  specialNote: "",
  source: "Phone",
  status: "pending",
};

/* ══════════════════════════════════════
   Main Component — Admin Catering
══════════════════════════════════════ */
const Catering = ({ adminData, setAdminData, filters, patchFilters, onResetFilters }) => {
  const { fromDate: filterFromDate, toDate: filterToDate, preset: filterDatePreset, status: filterStatus, search } = filters;
  const setFilterFromDate = (v) => patchFilters({ fromDate: v });
  const setFilterToDate = (v) => patchFilters({ toDate: v });
  const setFilterDatePreset = (v) => patchFilters({ preset: v });
  const setFilterStatus = (v) => patchFilters({ status: v });
  const setSearch = (v) => patchFilters({ search: v });
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [useRestaurantAddr, setUseRestaurantAddr] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [itemsPopup, setItemsPopup] = useState(null);
  const [locTooltip, setLocTooltip] = useState(null);
  const [locTooltipPos, setLocTooltipPos] = useState({ top: 0, left: 0 });
  const [itemsTooltip, setItemsTooltip] = useState(null);
  const [itemsTooltipPos, setItemsTooltipPos] = useState({ top: 0, left: 0 });
  const locWrapRefs = useRef({});
  const itemsWrapRefs = useRef({});
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [callTooltipPos, setCallTooltipPos] = useState({ top: 0, left: 0 });
  const callWrapRefs = useRef({});

  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const data = adminData?.cateringOrders || [];

  useEffect(() => {
    if (showCreate && !menuData) {
      api.get("/categories").then(res => setMenuData(res.data)).catch(() => setMenuData([]));
    }
  }, [showCreate]);

  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterFromDate) d = d.filter(i => (i.date || i.eventDate || "") >= filterFromDate);
    if (filterToDate) d = d.filter(i => (i.date || i.eventDate || "") <= filterToDate);
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
  }, [data, filterFromDate, filterToDate, filterStatus, search]);

  const pendingCount = filteredData.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = filteredData.filter(r => r.status === "confirmed").length;
  const completedCount = filteredData.filter(r => r.status === "completed").length;
  const cancelledCount = filteredData.filter(r => r.status === "cancelled").length;

  const sortedData = useMemo(() => {
    const d = [...filteredData];
    d.sort((a, b) => {
      let va, vb;
      if (sortField === "createdAt" || sortField === "eventDate") {
        va = new Date(sortField === "eventDate" ? (a.date || a.eventDate || "") : (a.createdAt || ""));
        vb = new Date(sortField === "eventDate" ? (b.date || b.eventDate || "") : (b.createdAt || ""));
      } else if (sortField === "guests" || sortField === "totalAmount") {
        va = Number(a[sortField] || 0); vb = Number(b[sortField] || 0);
      } else {
        va = (a[sortField] || "").toString().toLowerCase();
        vb = (b[sortField] || "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return d;
  }, [filteredData, sortField, sortDir]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(sortedData.length, 30);

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

  /* call logging — persisted to JSON */
  const handleCall = async (e, id) => {
    e.stopPropagation();
    const prev = data.find(c => c.id === id);
    if (!prev) return;
    const newEntry = new Date().toISOString();
    const updatedHistory = [...(prev.callHistory || []), newEntry];
    /* optimistic update */
    if (typeof setAdminData === "function") {
      setAdminData(p => ({
        ...p,
        cateringOrders: (p.cateringOrders || []).map(c =>
          c.id === id ? { ...c, callHistory: updatedHistory } : c
        ),
      }));
    }
    try {
      try { await api.patch(`/cateringOrders/${id}`, { callHistory: updatedHistory }); }
      catch { await api.put(`/cateringOrders/${id}`, { ...prev, callHistory: updatedHistory }); }
      toast.success("Call logged!");
    } catch {
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          cateringOrders: (p.cateringOrders || []).map(c => c.id === id ? prev : c),
        }));
      }
      toast.error("Failed to log call");
    }
  };

  const fmtDateTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const setF = (key, val) => {
    setForm(p => {
      const updated = { ...p, [key]: val };
      /* Rebuild location whenever address fields change */
      updated.location = buildCatAddress(updated);
      return updated;
    });
    setFormErrors(e => ({ ...e, [key]: "" }));
  };

  const handleUseRestaurantAddr = (checked) => {
    setUseRestaurantAddr(checked);
    if (checked) {
      setForm(p => {
        const updated = { ...p, ...RESTAURANT_ADDRESS };
        updated.location = buildCatAddress(updated);
        return updated;
      });
      setFormErrors(e => ({
        ...e,
        addrDoorNo: "", addrStreet: "", addrArea: "",
        addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
      }));
    } else {
      /* Unchecked — clear all address fields so user fills fresh */
      const cleared = {
        addrDoorNo: "", addrStreet: "", addrArea: "",
        addrLandmark: "", addrCity: "", addrDistrict: "", addrState: "", addrPincode: "",
      };
      setForm(p => ({ ...p, ...cleared, location: "" }));
    }
  };

  const validateTab0 = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) e.mobile = "Valid 10-digit number";
    if (!form.eventDate) e.eventDate = "Event date required";
    if (!form.time) e.time = "Time required";
    if (!form.addrDoorNo.trim()) e.addrDoorNo = "Required";
    if (!form.addrStreet.trim()) e.addrStreet = "Required";
    if (!form.addrArea.trim()) e.addrArea = "Required";
    if (!form.addrCity.trim()) e.addrCity = "Required";
    if (!form.addrDistrict.trim()) e.addrDistrict = "Required";
    if (!form.addrState.trim()) e.addrState = "Required";
    if (!form.addrPincode || form.addrPincode.length !== 6) e.addrPincode = "Valid 6-digit pincode";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (tab === 0 && !validateTab0()) return;
    setTab(t => Math.min(t + 1, 2));
  };

  const guestCount = Math.max(1, parseInt(form.guests, 10) || 1);

  /* dish total: sum of (unitPrice × guests) */
  const dishTotal = selectedItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
  /* extras total */
  const extrasTotal = Object.keys(EXTRA_PRICES).reduce((s, k) => s + (form[k] ? EXTRA_PRICES[k] : 0), 0);
  const decorTotal = form.decoration ? (DECORATION_TIERS.find(d => d.value === form.decoration)?.price || 0) : 0;
  const totalAmount = dishTotal + extrasTotal + decorTotal;

  const handleCreate = async () => {
    if (!validateTab0()) { setTab(0); return; }
    setSaving(true);
    try {
      const id = `cat_${Date.now()}`;
      const payload = {
        id, ...form,
        date: form.eventDate,
        items: selectedItems,
        dishTotal,
        extrasTotal,
        decorTotal,
        totalAmount,
        status: form.status || "pending",
        createdAt: new Date().toISOString(),
      };
      await api.post("/cateringOrders", payload);
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

  const openCreate = () => {
    setShowCreate(true); setForm({ ...EMPTY_FORM }); setSelectedItems([]);
    setTab(0); setFormErrors({}); setUseRestaurantAddr(false); // ← add this
  };
  const isDefaultFilter = filterFromDate === todayStr() && filterToDate === todayStr() && filterDatePreset === "today" && !filterStatus && !search.trim();
  const activeFilters = !isDefaultFilter;

  const exportToExcel = () => {
    if (!sortedData.length) { alert("No catering orders to export"); return; }
    const rows = sortedData.map(item => ({
      Name: item.name || "—", Mobile: item.mobile || "—", Email: item.email || "—",
      "Event Date": item.eventDate || item.date || "—", Time: item.time || "—",
      Location: item.location || "—", Guests: item.guests ?? "—",
      Items: (item.items || []).length,
      "Total Amount": item.totalAmount ? `₹${Number(item.totalAmount).toLocaleString("en-IN")}` : "—",
      Status: item.status || "—", Source: item.source || "—",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Catering Orders");
    const suffix = filterFromDate && filterToDate
      ? `${filterFromDate}_to_${filterToDate}`
      : filterFromDate || filterToDate || "all";
    XLSX.writeFile(wb, `catering_orders_${suffix}.xlsx`);
  };

  return (
    <div className="act-page">

      <div className="act-header">
        <div>
          <h2 className="act-title">Catering Orders</h2>
          <p className="act-subtitle">Manage catering & event food orders</p>
        </div>
        <div className="evt-kpi-row">
          {[
            { label: "Total", val: filteredData.length, color: "#111" },
            { label: "Pending", val: pendingCount, color: "#ca8a04" },
            { label: "Confirmed", val: confirmedCount, color: "#16a34a" },
            { label: "Completed", val: completedCount, color: "#2980b9" },
            { label: "Cancelled", val: cancelledCount, color: "#dc2626" },
          ].map((k, i) => (
            <div key={i} className="evt-kpi" style={{ borderTopColor: k.color }}>
              <div className="evt-kpi-val" style={{ color: k.color }}>{k.val}</div>
              <div className="evt-kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="modal-save-btn" onClick={exportToExcel}>
            <span className="shadow"></span><span className="edge"></span>
            <span className="front">Export</span>
          </button>
          <button className="modal-save-btn" onClick={openCreate}>
            <span className="shadow"></span><span className="edge"></span>
            <span className="front">+ Add Catering Order</span>
          </button>
        </div>
      </div>

      <div className="evt-filter-bar">
        <div className="evt-filter-groups">
          <input className="search-input" placeholder="Search name / mobile / ID..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="evt-filter-group">
            <span className="evt-filter-group-label">Period</span>
            {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([preset, label]) => (
              <button key={preset}
                className={`filter-pill${filterDatePreset === preset ? " active evt-status-confirmed" : ""}`}
                onClick={() => {
                  if (filterDatePreset === preset) {
                    setFilterDatePreset(""); setFilterFromDate(""); setFilterToDate("");
                  } else {
                    setFilterDatePreset(preset);
                    if (preset === "today") { const t = todayStr(); setFilterFromDate(t); setFilterToDate(t); }
                    else if (preset === "week") { const [f, t] = getWeekRange(); setFilterFromDate(f); setFilterToDate(t); }
                    else { const [f, t] = getMonthRange(); setFilterFromDate(f); setFilterToDate(t); }
                  }
                }}>
                {label}
              </button>
            ))}
          </div>
          {/* From / To date pickers */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="evt-filter-group-label">From</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterFromDate} onChange={v => { setFilterFromDate(v); setFilterDatePreset(""); if (filterToDate && v > filterToDate) setFilterToDate(v); }} placeholder="Start date" />
            </div>
            <span className="evt-filter-group-label" style={{ marginLeft: 2 }}>To</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterToDate} min={filterFromDate} onChange={v => { setFilterToDate(v); setFilterDatePreset(""); }} placeholder="End date" />
            </div>
            {(filterFromDate || filterToDate) && (
              <button className="filter-pill" onClick={() => { setFilterFromDate(""); setFilterToDate(""); setFilterDatePreset(""); }} title="Clear dates">✕</button>
            )}
          </div>
        </div>
        <div className="evt-filter-groups">

          <div className="evt-filter-group">
            <span className="evt-filter-group-label">Status</span>
            {[
              ["pending", "P", "clb-status-pending", "Pending"],
              ["confirmed", "C", "clb-status-confirmed", "Confirmed"],
              ["completed", "D", "clb-status-completed", "Done"],
              ["cancelled", "X", "clb-status-cancelled", "Cancelled"],
            ].map(([key, short, cls, title]) => (
              <button key={key} title={title}
                className={`filter-pill${filterStatus === key ? " active " + cls : ""}`}
                onClick={() => setFilterStatus(p => p === key ? "" : key)}>
                {short}
              </button>
            ))}
          </div>
          {activeFilters && (
            <button className="evt-clb-clear-btn" onClick={onResetFilters}>Clear</button>
          )}
        </div>
      </div>

      <div className="act-table-wrapper" ref={containerRef}>
        <table className="act-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className={sortField === "name" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Guest</span>
                  <span className="sort-arrow">{sortField === "name" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Contact</th>
              <th onClick={() => handleSort("eventDate")} className={sortField === "eventDate" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Date</span>
                  <span className="sort-arrow">{sortField === "eventDate" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Time</th>
              <th onClick={() => handleSort("guests")} className={sortField === "guests" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Guests</span>
                  <span className="sort-arrow">{sortField === "guests" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Items</th>
              <th onClick={() => handleSort("totalAmount")} className={sortField === "totalAmount" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Total</span>
                  <span className="sort-arrow">{sortField === "totalAmount" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Location</th>
              <th onClick={() => handleSort("status")} className={sortField === "status" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Status</span>
                  <span className="sort-arrow">{sortField === "status" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="10" className="act-empty">No catering orders found</td></tr>
            ) : (
              sortedData.slice(0, displayLimit).map(item => {
                const status = item.status || "pending";
                const date = item.date || item.eventDate || "—";
                return (
                  <tr key={item.id} className="act-row clickable" onClick={() => navigate(`/catering/${item.id}`, { state: { fromDetail: true } })}>
                    <td>
                      <div className="act-name-cell">
                        <div className="act-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="act-name">{item.name || "—"}</div>
                          <div className="act-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>
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
                        <div
                          className="cat-items-wrap"
                          ref={el => { itemsWrapRefs.current[item.id] = el; }}
                          onMouseEnter={() => {
                            const el = itemsWrapRefs.current[item.id];
                            if (el) {
                              const r = el.getBoundingClientRect();
                              setItemsTooltipPos({ top: r.top, left: r.left + r.width / 2 });
                            }
                            setItemsTooltip(item.id);
                          }}
                          onMouseLeave={() => setItemsTooltip(null)}
                          style={{ display: "inline-block" }}
                        >
                          <span style={{ background: "#f0f4ff", border: "1.5px solid #c7d2fe", borderRadius: "999px", padding: "3px 12px", fontWeight: 700, fontSize: 13, color: "#3730a3", cursor: "default", display: "inline-block" }}>
                            {item.items.length}
                          </span>
                        </div>
                      ) : <span style={{ color: "#bbb", fontSize: 13 }}>0</span>}
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{(item.totalAmount || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 12 }} onClick={e => e.stopPropagation()}>
                      {!item.location ? (
                        <span style={{ color: "#bbb" }}>—</span>
                      ) : isRestaurantLocation(item.location) ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ecfdf5", color: "#065f46", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "1px solid #a7f3d0" }}>
                          Restaurant
                        </span>
                      ) : (
                        <div
                          className="cat-loc-wrap"
                          ref={el => { locWrapRefs.current[item.id] = el; }}
                          onMouseEnter={() => {
                            const el = locWrapRefs.current[item.id];
                            if (el) {
                              const r = el.getBoundingClientRect();
                              setLocTooltipPos({ top: r.top, left: r.left + r.width / 2 });
                            }
                            setLocTooltip(item.id);
                          }}
                          onMouseLeave={() => setLocTooltip(null)}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f0f4ff", color: "#3730a3", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, border: "1px solid #c7d2fe", cursor: "default" }}>
                            Other Location
                          </span>
                        </div>
                      )}
                    </td>
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

                    {/* Actions — Call + Call History */}
                    <td onClick={e => e.stopPropagation()}>
                      {(() => {
                        const history = item.callHistory || [];
                        return (
                          <div className="evt-pre-call-wrap"
                            ref={el => { callWrapRefs.current[item.id] = el; }}
                            onMouseEnter={() => {
                              if (history.length > 0) {
                                const el = callWrapRefs.current[item.id];
                                if (el) {
                                  const r = el.getBoundingClientRect();
                                  setCallTooltipPos({ top: r.top, left: r.left, width: r.width });
                                }
                                setCallTooltipId(item.id);
                              }
                            }}
                            onMouseLeave={() => setCallTooltipId(null)}>
                            <button className="modal-cancel-btn" onClick={e => handleCall(e, item.id)}>
                              <span className="shadow"></span>
                              <span className="edge"></span>
                              <span className="front close-padding">
                                📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                              </span>
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={10}
            />
          </tbody>
        </table>
      </div>
      {callTooltipId && createPortal(
        (() => {
          const histItem = (adminData?.cateringOrders || []).find(x => x.id === callTooltipId);
          const hist = histItem?.callHistory || [];
          if (!hist.length) return null;
          return (
            <div
              className="evt-pre-call-tooltip"
              style={{
                position: "fixed",
                top: callTooltipPos.top,
                left: callTooltipPos.left - 20, transform: "translate(-50%, calc(-100% - 10px))",
                zIndex: 99999,
                pointerEvents: "none",
              }}
            >
              <div className="evt-pre-call-tooltip-title">📞 Call History</div>
              {hist.map((ts, i) => (
                <div key={i} className="evt-pre-call-tooltip-row">{fmtDateTime(ts)}</div>
              ))}
            </div>
          );
        })(),
        document.body
      )}

      {/* Location tooltip */}
      {locTooltip && createPortal(
        (() => {
          const locItem = (adminData?.cateringOrders || []).find(x => x.id === locTooltip);
          if (!locItem?.location) return null;
          return (
            <div
              className="cat-addr-tooltip"
              style={{
                position: "fixed",
                top: locTooltipPos.top,
                left: locTooltipPos.left,
                transform: "translate(-50%, calc(-100% - 10px))",
                zIndex: 99999,
                pointerEvents: "none",
              }}
            >
              <div className="cat-addr-tooltip-title">Event Address</div>
              <div className="cat-addr-tooltip-body">{locItem.location}</div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Items tooltip */}
      {itemsTooltip && createPortal(
        (() => {
          const tipItem = (adminData?.cateringOrders || []).find(x => x.id === itemsTooltip);
          const tipItems = tipItem?.items || [];
          if (!tipItems.length) return null;
          return (
            <div
              className="cat-items-tooltip"
              style={{
                position: "fixed",
                top: itemsTooltipPos.top,
                left: itemsTooltipPos.left,
                transform: "translate(-50%, calc(-100% - 10px))",
                zIndex: 99999,
                pointerEvents: "none",
              }}
            >
              <div className="cat-addr-tooltip-title"> Dishes ({tipItems.length})</div>
              {tipItems.map((dish, i) => (
                <div key={i} className="cat-items-tooltip-row">
                  <span className="cat-items-tooltip-name">{dish.name || "—"}</span>
                  <span className="cat-items-tooltip-price">₹{dish.totalPrice || 0}</span>
                </div>
              ))}
              <div className="cat-items-tooltip-total">
                <span>Total</span>
                <span>₹{tipItem.totalAmount?.toLocaleString() || 0}</span>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Items popup */}
      {itemsPopup && (
        <div className="ingredient-modal-overlay" onClick={() => setItemsPopup(null)}>
          <div className="ingredient-modal" style={{ width: 520, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
            <div className="ingredient-modal-header">
              <h3>Dishes — {itemsPopup.name} <span style={{ fontSize: 12, fontWeight: 400, color: "#888", marginLeft: 8 }}>#{(itemsPopup.id || "").slice(-6)}</span></h3>
              <button
                className="modal-cancel-btn" onClick={() => setItemsPopup(null)}
              >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>
            <div className="ingredient-modal-body" style={{ padding: "12px 20px 20px" }}>
              {(!itemsPopup.items || itemsPopup.items.length === 0) ? (
                <p style={{ textAlign: "center", color: "#aaa", padding: "24px 0" }}>No dishes in this order.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                      {["#", "Dish", "Category", "Unit Price", "Guests", "Total"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", textAlign: h === "#" ? "center" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itemsPopup.items.map((dish, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ padding: "10px", textAlign: "center", fontSize: 12, color: "#bbb" }}>{idx + 1}</td>
                        <td style={{ padding: "10px", fontWeight: 600, fontSize: 13 }}>{dish.name || "—"}</td>
                        <td style={{ padding: "10px", fontSize: 12, color: "#888" }}>{dish.category || "—"}</td>
                        <td style={{ padding: "10px", fontSize: 13 }}>₹{dish.unitPrice || dish.price || 0}</td>
                        <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>{itemsPopup.guests || 1}</td>
                        <td style={{ padding: "10px", fontWeight: 700, fontSize: 13 }}>₹{dish.totalPrice || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f8fafc" }}>
                      <td colSpan="5" style={{ padding: "10px", fontWeight: 700 }}>Total Amount</td>
                      <td style={{ padding: "10px", fontWeight: 800, fontSize: 15 }}>₹{(itemsPopup.totalAmount || 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ CREATE MODAL ══ */}
      {showCreate && (
        <div className="event-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="event-modal act-modal" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3>Add Catering Order</h3>
                <div className="ecard">
                  {TABS.map((t, i) => (
                    <button key={i}
                      className={`ebutton${tab === i ? " active" : ""}${tab > i ? " done" : ""}`}
                      onClick={() => {
                        if (i > tab) {
                          if (!validateTab0()) return;
                        } else if (i < tab) {
                          setTab(i);
                        }
                      }}>
                      <span className="eevt-step-num">{tab > i ? "✓" : i + 1}</span>
                      <span className="eevt-step-label">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="modal-cancel-btn" onClick={() => setShowCreate(false)} >
                <span className="shadow"></span>
                <span className="edge"></span>
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>

            <div className={`event-modal-body act-modal-body${tab === 1 ? " act-modal-body--split" : ""}`}>

              {/* ── TAB 0: Details ── */}
              {tab === 0 && (
                <>
                  <div className="evt-res-form-section-label">Customer Information</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1.4 }}>
                      <div className="mat">
                        <input className={`mat-input${formErrors.name ? " mat-error" : ""}`} placeholder=" "
                          value={form.name} onChange={e => setF("name", e.target.value)} />
                        <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>Name <span className="evt-res-req">*</span></label>
                        <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Guests</label>
                      <div className="evt-stepper">
                        <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                        <span>{form.guests}</span>
                        <button type="button" onClick={() => setF("guests", Math.min(10000, form.guests + 1))}>+</button>
                      </div>
                    </div>
                  </div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <div className="mat">
                        <input className={`mat-input${formErrors.mobile ? " mat-error" : ""}`} placeholder=" " type="tel"
                          value={form.mobile} onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                        <label className={`mat-label${formErrors.mobile ? " mat-label-error" : ""}`}>Mobile <span className="evt-res-req">*</span></label>
                        <span className={`mat-bar${formErrors.mobile ? " mat-bar-error" : ""}`} />
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <div className="mat">
                        <input className="mat-input" placeholder=" " value={form.email} onChange={e => setF("email", e.target.value)} />
                        <label className="mat-label">Email</label>
                        <span className="mat-bar" />
                      </div>
                    </div>
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Event Details</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className={formErrors.eventDate ? "mat-label-error" : ""}>Event Date <span className="evt-res-req">*</span></label>
                      <CustomDatePicker value={form.eventDate} min={tomorrowStr()} onChange={v => { setF("eventDate", v); setF("time", ""); setF("slotGroup", ""); setFormErrors(p => ({ ...p, eventDate: false })); }} placeholder="Select date" hasError={!!formErrors.eventDate} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Dining Slot <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(select to restrict time picker)</span></label>
                    <div className="evt-res-pref-grid">
                      {SLOT_GROUPS.map(sg => (
                        <button key={sg.key} type="button"
                          className={`evt-res-pref-card${form.slotGroup === sg.key ? " active" : ""}`}
                          onClick={() => {
                            const next = form.slotGroup === sg.key ? "" : sg.key;
                            setF("slotGroup", next);
                            setF("time", "");
                          }}>
                          <span className="evt-res-slot-chip-label">{sg.label}</span>
                          <span className="evt-res-slot-chip-time">{sg.start}–{sg.end}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className={formErrors.time ? "mat-label-error" : ""}>
                      Time <span className="evt-res-req">*</span>
                      {form.slotGroup && (() => { const sg = SLOT_GROUPS.find(s => s.key === form.slotGroup); return sg ? <span style={{ fontSize: 11, color: "#2980b9", fontWeight: 500, marginLeft: 6 }}>({sg.start}–{sg.end})</span> : null; })()}
                    </label>
                    <CustomTimePicker
                      value={form.time}
                      onChange={v => { setF("time", v); setFormErrors(p => ({ ...p, time: false })); }}
                      slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                      slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                      disabled={!form.slotGroup}
                      hasError={!!formErrors.time}
                      isToday={false}
                    />
                    {!form.slotGroup && <span style={{ fontSize: 11, color: "#aaa", marginTop: 4, display: "block" }}>Select a dining slot first to enable time picker</span>}
                  </div>

                  <div className="evt-res-source-chips">
                    {SOURCE_OPTIONS.map(src => (
                      <button
                        key={src}
                        type="button"
                        className={`evt-res-source-chip ${form.source === src ? "active" : ""
                          }`}
                        onClick={() => setF("source", src)}
                      >
                        {src}
                      </button>
                    ))}
                  </div>

                  {/* Address — all mandatory */}
                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>
                    Event Address <span style={{ fontSize: 11, color: "#888" }}>(all fields required)</span>
                    <button
                      type="button"
                      className={`use-restaurant-loc-toggle${useRestaurantAddr ? " active" : ""}`}
                      onClick={() => handleUseRestaurantAddr(!useRestaurantAddr)}
                    >
                      {useRestaurantAddr ? "✓ " : ""}Use restaurant location
                    </button>
                  </div>


                  {!useRestaurantAddr && <div className="ae-addr-grid">
                    {[
                      { key: "addrDoorNo", label: "Door No. / Building", optional: false },
                      { key: "addrStreet", label: "Street Name", optional: false },
                      { key: "addrArea", label: "Area / Locality", optional: false },
                      { key: "addrLandmark", label: "Landmark", optional: true },
                      { key: "addrCity", label: "City", optional: false },
                      { key: "addrDistrict", label: "District", optional: false },
                      { key: "addrState", label: "State", optional: false },
                      { key: "addrPincode", label: "Pincode", optional: false },
                    ].map(field => (
                      <div key={field.key} className="form-group">
                        <div className="mat">
                          <input
                            className={`mat-input${formErrors[field.key] ? " mat-error" : ""}`}
                            type="text"
                            value={form[field.key]}
                            placeholder=" "
                            maxLength={field.key === "addrPincode" ? 6 : undefined}
                            readOnly={useRestaurantAddr}
                            disabled={useRestaurantAddr}
                            onChange={e => {
                              if (useRestaurantAddr) return;
                              const v = field.key === "addrPincode"
                                ? e.target.value.replace(/\D/g, "").slice(0, 6)
                                : e.target.value;
                              setF(field.key, v);
                              setFormErrors(p => ({ ...p, [field.key]: false }));
                            }}
                          />
                          <label className={`mat-label${formErrors[field.key] ? " mat-label-error" : ""}`}>
                            {field.label} {!field.optional && <span className="rf-req">*</span>}
                          </label>
                          <span className={`mat-bar${formErrors[field.key] ? " mat-bar-error" : ""}`} />
                        </div>
                      </div>
                    ))}
                  </div>}

                  {/* Decoration */}
                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Decoration</div>
                  <div className="form-group">
                    <div className="evt-res-source-chips">
                      <button type="button" className={`evt-res-source-chip${!form.decoration ? " active" : ""}`} onClick={() => setF("decoration", null)}>None</button>
                      {DECORATION_TIERS.map(d => (
                        <button key={d.value} type="button"
                          className={`evt-res-source-chip${form.decoration === d.value ? " active" : ""}`}
                          onClick={() => setF("decoration", d.value)}>
                          {d.label} ₹{d.price.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add-ons — celebration fields + catering extras (no Get Together, no event type) */}
                  <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Add-ons & Services</div>
                  <div className="form-group">
                    <div className="evt-res-source-chips">
                      {[
                        { k: "cake", l: "Cake +₹500" },
                        { k: "specialMention", l: "Special Mention" },
                        { k: "liveMusic", l: "Live Music +₹2,000" },
                        { k: "surpriseGift", l: "Surprise Gift +₹300" },
                        { k: "candleLight", l: "Candle Light +₹800" },
                        { k: "mic", l: "Mic +₹500" },
                        { k: "projector", l: "Projector +₹800" },
                        { k: "music", l: "Music System +₹1,500" },
                        { k: "speaker", l: "Speaker +₹600" },
                      ].map(ex => (
                        <button key={ex.k} type="button"
                          className={`evt-res-source-chip${form[ex.k] ? " active" : ""}`}
                          onClick={() => setF(ex.k, !form[ex.k])}>
                          {ex.l}
                        </button>
                      ))}
                    </div>
                    {form.specialMention && (
                      <div className="mat-area" style={{ marginTop: 8 }}>
                        <textarea className="mat-input mat-textarea" rows={2} placeholder=" "
                          value={form.specialMentionText}
                          onChange={e => setF("specialMentionText", e.target.value)} />
                        <label className="mat-area-label">Describe what to announce / mention...</label>
                        <span className="mat-area-bar" />
                      </div>
                    )}
                  </div>

                  {/* Source & Status */}
                  <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Source & Status</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Source</label>
                      <div className="evt-res-source-chips">
                        {SOURCE_OPTIONS.map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip${form.source === s ? " active" : ""}`}
                            onClick={() => setF("source", s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Status</label>
                      <div className="evt-res-source-chips">
                        {["pending", "confirmed"].map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip ${form.status === s ? "active status-" + s : ""}`}
                            onClick={() => setF("status", s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 4 }}>
                    <div className="mat-area">
                      <textarea className="mat-input mat-textarea" rows={2} placeholder=" " value={form.notes} onChange={e => setF("notes", e.target.value)} />
                      <label className="mat-area-label">Notes</label>
                      <span className="mat-area-bar" />
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB 1: Dishes ── */}
              {tab === 1 && (
                <div className="ae-dishes-split">
                  <div className="ae-dishes-split-left">
                    <DishPicker menuData={menuData} selectedItems={selectedItems} setSelectedItems={setSelectedItems} guests={form.guests} />
                  </div>
                  <div className="ae-dishes-split-right">
                    <div className="ae-dishes-right-header">
                      Selected Dishes
                      {selectedItems.length > 0 && <span style={{ fontSize: 11, fontWeight: 500, color: "#888", marginLeft: 6 }}>({selectedItems.length})</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>Price = unit × {guestCount} guests</div>
                    {selectedItems.length === 0 ? (
                      <div className="ae-dishes-empty-right">No dishes selected yet.</div>
                    ) : (
                      <>
                        <div className="ae-dishes-right-list">
                          {selectedItems.map(item => (
                            <div key={item.id} className="ae-dishes-right-item">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>{item.name}</div>
                                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                                  ₹{item.unitPrice || item.price} × {guestCount}
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
                          <span>Dishes Total</span>
                          <span>₹{dishTotal.toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 2: Review ── */}
              {tab === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Summary header */}
                  <div style={{ background: "linear-gradient(135deg,#f8fafc,#ecfdf5)", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#10b981,#3b82f6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
                      {(form.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{form.name || "—"}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{form.mobile || "—"} {form.email ? `· ${form.email}` : ""}</div>
                    </div>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: form.status === "confirmed" ? "#d1fae5" : "#fef3c7", color: form.status === "confirmed" ? "#065f46" : "#92400e" }}>{form.status}</span>
                      {form.source && <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#f3f4f6", color: "#555" }}>{form.source}</span>}
                    </div>
                  </div>

                  <div className="prv-section">
                    <div className="prv-section-title">Customer & Event Details</div>
                    <div className="prv-grid">
                      {[
                        ["Name", form.name || "—"],
                        ["Mobile", form.mobile || "—"],
                        ["Email", form.email || "—"],
                        ["Event Date", form.eventDate || "—"],
                        ["Time", fmtTime(form.time)],
                        ["Guests", form.guests ?? "—"],
                      ].map(([l, v]) => (
                        <div key={l} className="prv-cell"><div className="prv-cell-label">{l}</div><div className="prv-cell-val">{v}</div></div>
                      ))}
                    </div>
                  </div>

                  <div className="prv-section">
                    <div className="prv-section-title">Event Address</div>
                    <div className="prv-notes" style={{ background: "#f8fafc" }}>{form.location || "Not specified"}</div>
                  </div>

                  <div className="prv-section">
                    <div className="prv-section-title">Selected Dishes ({selectedItems.length}) — price × {guestCount} guests</div>
                    {selectedItems.length === 0 ? (
                      <div className="prv-empty">No dishes selected</div>
                    ) : (
                      <table className="prv-table">
                        <thead><tr><th>Dish</th><th>Unit Price</th><th>Guests</th><th>Total</th></tr></thead>
                        <tbody>
                          {selectedItems.map((item, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{item.name}</td>
                              <td>₹{item.unitPrice || item.price || 0}</td>
                              <td style={{ textAlign: "center", fontWeight: 700 }}>{guestCount}</td>
                              <td style={{ fontWeight: 600 }}>₹{item.totalPrice || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr><td colSpan="3" style={{ fontWeight: 700 }}>Dishes Subtotal</td><td style={{ fontWeight: 800 }}>₹{dishTotal.toLocaleString()}</td></tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  {(extrasTotal > 0 || decorTotal > 0) && (
                    <div className="prv-section">
                      <div className="prv-section-title">Extras & Decoration</div>
                      <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
                        {form.decoration && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, borderBottom: "1px solid #f5f5f5" }}><span style={{ textTransform: "capitalize" }}>Decoration ({form.decoration})</span><span style={{ fontWeight: 600 }}>₹{decorTotal.toLocaleString()}</span></div>}
                        {Object.keys(EXTRA_PRICES).filter(k => form[k] && EXTRA_PRICES[k] > 0).map(k => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, borderBottom: "1px solid #f5f5f5" }}>
                            <span style={{ textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</span>
                            <span style={{ fontWeight: 600 }}>₹{EXTRA_PRICES[k]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="prv-total-bar">
                    <span className="prv-total-label">Grand Total</span>
                    <span className="prv-total-val">₹{totalAmount.toLocaleString()}</span>
                  </div>

                  {form.notes && (
                    <div className="prv-section">
                      <div className="prv-section-title">Notes</div>
                      <div className="prv-notes">{form.notes}</div>
                    </div>
                  )}

                  {(!form.name.trim() || !form.mobile || !form.eventDate || !form.time) && (
                    <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e" }}>
                      ⚠️ Required fields missing — please go back and fill all required details.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="event-modal-footer">
              <button type="button" className="modal-cancel-btn" onClick={() => setShowCreate(false)}>
                <span className="shadow"></span><span className="edge"></span>
                <span className="front">Cancel</span>
              </button>
              {tab > 0 && (
                <button type="button" className="modal-prev-btn" onClick={() => setTab(t => t - 1)}>
                  <span className="shadow"></span><span className="edge"></span>
                  <span className="front">← Back</span>
                </button>
              )}
              {tab < 2
                ? (
                  <button type="button" className="modal-next-btn" onClick={handleNext}>
                    <span className="shadow"></span><span className="edge"></span>
                    <span className="front">Next →</span>
                  </button>
                )
                : (
                  <button type="button" className="modal-save-btn" onClick={handleCreate} disabled={saving}>
                    <span className="shadow"></span><span className="edge"></span>
                    <span className="front">{saving ? "Saving..." : "Create Order"}</span>
                  </button>
                )
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catering;