import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./PreBookings.css";
import "./PreviewModal.css";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];
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

const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", short: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", short: "Br", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", short: "Lu", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", short: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", short: "Di", start: "18:30", end: "22:00" },
];

const timeToSlotKey = (time) => {
  if (!time) return null;
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 7 && h < 10) return "BF";
  if (h >= 10 && h < 12) return "BR";
  if (h >= 12 && h < 15) return "LU";
  if (h >= 15 && h < 18) return "HT";
  if (h >= 18) return "DI";
  return null;
};

const resolveSlotKey = (r) => r.slotGroup || timeToSlotKey(r.time);

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

/* ══════════════════════════════════════════════
   Add PreBooking Modal (admin)
══════════════════════════════════════════════ */
const EMPTY_FORM = { name: "", mobile: "", email: "", guests: 1, date: todayStr(), time: "", slotGroup: "", notes: "", source: "Phone" };
const SOURCE_OPTIONS = ["Phone", "WhatsApp", "In Person", "User App"];

/* ── Dish Picker for admin pre-booking (all dishes, no qty, price × guests) ── */
const PreDishPicker = ({ menuData, selectedItems, setSelectedItems, guests }) => {
  const { categories, dishes } = React.useMemo(() => {
    if (!menuData) return { categories: [], dishes: [] };
    const rawCats = Array.isArray(menuData) ? menuData : (menuData.categories || []);
    const flatCats = [];
    const flatDishes = [];
    rawCats.forEach(topCat => {
      const subs = topCat.subCategories || [];
      if (subs.length > 0) {
        subs.forEach(sub => {
          flatCats.push({ id: sub.id, name: sub.name });
          (sub.dishes || []).forEach(d => flatDishes.push({
            ...d, price: d.basePrice || d.price || 0, categoryId: sub.id, category: sub.name,
          }));
        });
      } else {
        flatCats.push({ id: topCat.id, name: topCat.name });
        (topCat.dishes || []).forEach(d => flatDishes.push({
          ...d, price: d.basePrice || d.price || 0, categoryId: topCat.id, category: topCat.name,
        }));
      }
    });
    return { categories: flatCats, dishes: flatDishes };
  }, [menuData]);

  const [activeCat, setActiveCat] = useState("");
  const guestCount = Math.max(1, parseInt(guests, 10) || 1);

  const filteredDishes = activeCat ? dishes.filter(d => d.categoryId === activeCat) : dishes;

  const toggle = (dish) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === dish.id);
      if (exists) return prev.filter(i => i.id !== dish.id);
      return [...prev, { ...dish, unitPrice: dish.price, totalPrice: dish.price * guestCount }];
    });
  };

  useEffect(() => {
    setSelectedItems(prev => prev.map(i => ({
      ...i, totalPrice: (i.unitPrice || i.price || 0) * guestCount,
    })));
  }, [guestCount]);

  const isSelected = (id) => selectedItems.some(i => i.id === id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      <select style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit" }}
        value={activeCat} onChange={e => setActiveCat(e.target.value)}>
        <option value="">All Categories</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, border: "1px solid #e5e7eb", borderRadius: 8, padding: 6 }}>
        {filteredDishes.length === 0
          ? <div style={{ textAlign: "center", color: "#aaa", padding: 20, fontSize: 13 }}>No dishes</div>
          : filteredDishes.map(dish => {
            const sel = isSelected(dish.id);
            return (
              <div key={dish.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, background: sel ? "#fff5f5" : "transparent", cursor: "pointer" }}
                onClick={() => toggle(dish)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#111" }}>{dish.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>₹{dish.price}/person × {guestCount} = <strong style={{ color: "#e74c3c" }}>₹{(dish.price * guestCount).toLocaleString()}</strong></div>
                </div>
                <button type="button"
                  style={{ padding: "3px 10px", borderRadius: 6, border: sel ? "1.5px solid #e74c3c" : "1.5px solid #e74c3c", background: sel ? "#fee2e2" : "transparent", color: "#e74c3c", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {sel ? "✓" : "+ Add"}
                </button>
              </div>
            );
          })
        }
      </div>
    </div>
  );
};

const AddPreBookingModal = ({ onClose, onSaved, toast }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [menuData, setMenuData] = useState(null);
  const [tab, setTab] = useState(0); // 0=Details, 1=Dishes, 2=Preview

  useEffect(() => {
    api.get("/categories").then(res => setMenuData(res.data)).catch(() => setMenuData([]));
  }, []);

  const setF = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };

  const guestCount = Math.max(1, parseInt(form.guests, 10) || 1);
  const isGroupDiscount = guestCount > 8;
  const subtotal = selectedItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const discount = isGroupDiscount ? Math.round(subtotal * 0.1) : 0;
  const totalAmount = subtotal - discount;

  const validate = () => {
    const err = {};
    if (!form.name.trim() || form.name.trim().length < 2) err.name = true;
    const mob = form.mobile.replace(/\D/g, "");
    if (!mob || mob.length !== 10) err.mobile = true;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = true;
    if (!form.guests || guestCount < 1) err.guests = true;
    if (!form.date) err.date = true;
    if (!form.time) err.time = true;
    return err;
  };

  const handleSave = async () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) { setErrors(ve); setTab(0); return; }
    setSaving(true);
    try {
      const newId = `pre_${Date.now()}`;
      const body = {
        id: newId,
        name: form.name, mobile: form.mobile, email: form.email || "",
        guests: guestCount, date: form.date, time: form.time,
        slotGroup: form.slotGroup || "", notes: form.notes || "",
        source: form.source || "Phone",
        items: selectedItems, subtotal, discount, totalAmount,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      };
      await api.post("/preBookings", body);
      toast.success("PreBooking added!");
      onSaved(body);
      onClose();
    } catch {
      toast.error("Failed to add pre-booking.");
    } finally {
      setSaving(false);
    }
  };

  const slotLabel = SLOT_GROUPS.find(s => s.key === form.slotGroup)?.label || "—";

  return (
    <div className="ingredient-modal-overlay" onClick={onClose}>
      <div className="ingredient-modal" style={{ width: 680, maxWidth: "96vw" }} onClick={e => e.stopPropagation()}>

        <div className="ingredient-modal-header">
          <div>
            <h3>Add PreBooking</h3>
            <div className="ae-spec-steps">
              {["Details", "Dishes", "Preview"].map((t, i) => (
                <button key={i}
                  className={`ae-spec-step${tab === i ? " active" : ""}${tab > i ? " done" : ""}`}
                  onClick={() => i < tab && setTab(i)}>
                  <span className="ae-step-num">{tab > i ? "✓" : i + 1}</span>
                  <span className="ae-step-label">{t}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="ingredient-close-btn" onClick={onClose}></button>
        </div>

        <div className="ingredient-modal-body" style={{ minHeight: 360 }}>

          {/* TAB 0: Details */}
          {tab === 0 && (
            <>
              <div className="evt-pre-modal-row">
                <div className="form-group">
                  <label>Name <span className="evt-pre-req">*</span></label>
                  <input className={`evt-pre-modal-input${errors.name ? " error" : ""}`} placeholder="Guest name"
                    value={form.name} onChange={e => setF("name", e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: "0 0 130px" }}>
                  <label>Guests <span className="evt-pre-req">*</span></label>
                  <div className={`evt-pre-modal-stepper${errors.guests ? " error" : ""}`}>
                    <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                    <span>{form.guests}</span>
                    <button type="button" onClick={() => setF("guests", Math.min(500, form.guests + 1))}>+</button>
                  </div>
                  {isGroupDiscount && <span style={{ fontSize: 10, color: "#065f46", marginTop: 2, display: "block" }}>🎉 &gt;8 guests — 10% off</span>}
                </div>
              </div>

              <div className="evt-pre-modal-row">
                <div className="form-group">
                  <label>Mobile <span className="evt-pre-req">*</span></label>
                  <input className={`evt-pre-modal-input${errors.mobile ? " error" : ""}`} placeholder="10-digit number" type="tel"
                    value={form.mobile} onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                </div>
                <div className="form-group">
                  <label>Email <span className="evt-pre-opt">(optional)</span></label>
                  <input className={`evt-pre-modal-input${errors.email ? " error" : ""}`} placeholder="email@example.com" type="email"
                    value={form.email} onChange={e => setF("email", e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Dining Slot <span className="evt-pre-opt">(optional)</span></label>
                <div className="evt-pre-modal-slots">
                  {SLOT_GROUPS.map(sg => {
                    const nowH = new Date().getHours();
                    const slotEndH = parseInt(sg.end.split(":")[0]);
                    const isPast = form.date === todayStr() && nowH >= slotEndH;
                    return (
                      <button key={sg.key} type="button"
                        className={`evt-pre-modal-slot-chip${form.slotGroup === sg.key ? " active" : ""}${isPast ? " chip-disabled" : ""}`}
                        title={isPast ? "This slot has passed today" : ""}
                        onClick={() => {
                          if (isPast) return;
                          const next = form.slotGroup === sg.key ? "" : sg.key;
                          setF("slotGroup", next);
                          setF("time", "");
                        }}>
                        {sg.label}
                        <span className="evt-pre-modal-slot-time">{sg.start}–{sg.end}</span>
                        {isPast && <span style={{ fontSize: 9, color: "#ef4444", display: "block" }}>Passed</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="evt-pre-modal-row">
                <div className="form-group">
                  <label>Date <span className="evt-pre-req">*</span></label>
                  <CustomDatePicker value={form.date} min={todayStr()} onChange={v => setF("date", v)} hasError={!!errors.date} />
                </div>
                <div className="form-group">
                  <label>Time <span className="evt-pre-req">*</span>{!form.slotGroup && <span className="evt-pre-opt"> (select slot first)</span>}</label>
                  <CustomTimePicker value={form.time} onChange={v => setF("time", v)}
                    slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                    slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                    disabled={!form.slotGroup}
                    isToday={form.date === todayStr()} />
                </div>
              </div>

              <div className="form-group">
                <label>Source</label>
                <div className="evt-pre-modal-source-row">
                  {SOURCE_OPTIONS.map(s => (
                    <button key={s} type="button"
                      className={`evt-pre-modal-source-btn${form.source === s ? " active" : ""}`}
                      onClick={() => setF("source", s)}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Notes <span className="evt-pre-opt">(optional)</span></label>
                <textarea className="evt-pre-modal-textarea" rows={2} placeholder="Special requests..."
                  value={form.notes} onChange={e => setF("notes", e.target.value)} />
              </div>
            </>
          )}

          {/* TAB 1: Dishes */}
          {tab === 1 && (
            <div style={{ display: "flex", gap: 12, height: 340 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <PreDishPicker menuData={menuData} selectedItems={selectedItems} setSelectedItems={setSelectedItems} guests={form.guests} />
              </div>
              <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111", paddingBottom: 6, borderBottom: "1px solid #f0f0f0" }}>
                  Selected ({selectedItems.length})
                </div>
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {selectedItems.length === 0
                    ? <div style={{ fontSize: 12, color: "#aaa", padding: "12px 0", textAlign: "center" }}>No dishes yet</div>
                    : selectedItems.map(item => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, gap: 4 }}>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{item.name}</span>
                        <span style={{ fontWeight: 700, color: "#e74c3c", flexShrink: 0 }}>₹{item.totalPrice}</span>
                        <button type="button" onClick={() => setSelectedItems(p => p.filter(x => x.id !== item.id))}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>×</button>
                      </div>
                    ))
                  }
                </div>
                {subtotal > 0 && (
                  <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
                    {isGroupDiscount && <div style={{ display: "flex", justifyContent: "space-between", color: "#065f46" }}><span>Discount 10%</span><span>−₹{discount}</span></div>}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, marginTop: 4 }}><span>Total</span><span>₹{totalAmount.toLocaleString()}</span></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Preview */}
          {tab === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Summary header */}
              <div style={{ background: "linear-gradient(135deg,#f8fafc,#fef3c7)", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
                  {(form.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{form.name || "—"}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{form.mobile || "—"} {form.email ? `· ${form.email}` : ""}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {form.slotGroup && <span className={`evt-pre-slot-badge slot-${form.slotGroup.toLowerCase()}`} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, fontWeight: 600 }}>{slotLabel}</span>}
                  <span className="prv-status-badge scheduled">scheduled</span>
                </div>
              </div>

              <div className="prv-section">
                <div className="prv-section-title">Booking Details</div>
                <div className="prv-grid">
                  {[
                    ["Date", form.date || "—"],
                    ["Time", fmtTime(form.time)],
                    ["Slot", slotLabel],
                    ["Guests", form.guests ?? "—"],
                    ["Source", form.source || "—"],
                    ["Status", "scheduled"],
                  ].map(([l, v]) => (
                    <div key={l} className="prv-cell"><div className="prv-cell-label">{l}</div><div className="prv-cell-val" style={{ textTransform: "capitalize" }}>{v}</div></div>
                  ))}
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="prv-section">
                  <div className="prv-section-title">Pre-ordered Dishes ({selectedItems.length})</div>
                  <table className="prv-table">
                    <thead><tr><th>#</th><th>Dish</th><th>Unit Price</th><th>Guests</th><th>Total</th></tr></thead>
                    <tbody>
                      {selectedItems.map((dish, idx) => (
                        <tr key={idx}>
                          <td style={{ color: "#aaa", fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{dish.name}</td>
                          <td>₹{dish.unitPrice || dish.price || 0}</td>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{guestCount}</td>
                          <td style={{ fontWeight: 700 }}>₹{dish.totalPrice || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan="4">Subtotal</td><td>₹{subtotal.toLocaleString()}</td></tr>
                      {isGroupDiscount && <tr><td colSpan="4" style={{ color: "#065f46" }}>Group Discount (10%)</td><td style={{ color: "#065f46" }}>−₹{discount.toLocaleString()}</td></tr>}
                      <tr><td colSpan="4" style={{ fontWeight: 800 }}>Total</td><td style={{ fontWeight: 800 }}>₹{totalAmount.toLocaleString()}</td></tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {selectedItems.length === 0 && (
                <div className="prv-section">
                  <div className="prv-section-title">Pre-ordered Dishes</div>
                  <div className="prv-empty">No dishes selected — guest will order on arrival</div>
                </div>
              )}

              {form.notes && (
                <div className="prv-section">
                  <div className="prv-section-title">Notes</div>
                  <div className="prv-notes">{form.notes}</div>
                </div>
              )}

              {totalAmount > 0 && (
                <div className="prv-total-bar">
                  <span className="prv-total-label">Total Amount</span>
                  <span className="prv-total-val">₹{totalAmount.toLocaleString()}</span>
                </div>
              )}

              {Object.keys(validate()).length > 0 && (
                <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e" }}>
                  ⚠️ Required fields missing — please go back and fill: Name, Mobile, Date, Time.
                </div>
              )}
            </div>
          )}

        </div>

        <div className="ingredient-modal-footer form-actions">
          {tab > 0 && (
            <button type="button" className="ae-step-prev-btn" onClick={() => setTab(t => t - 1)}>← Back</button>
          )}
          {tab < 2 ? (
            <button type="button" className="evt-res-create-btn"
              onClick={() => {
                if (tab === 0) {
                  const ve = validate();
                  if (Object.keys(ve).length > 0) { setErrors(ve); return; }
                }
                setTab(t => t + 1);
              }}>
              Next →
            </button>
          ) : (
            <button type="button" className="evt-res-create-btn" disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Create PreBooking"}
            </button>
          )}
          <button type="button" className="orders-export-btn" onClick={onClose}>Cancel</button>
        </div>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
const PreBookings = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [filterFromDate, setFilterFromDate] = useState(todayStr());
  const [filterToDate, setFilterToDate] = useState(todayStr());
  const [filterDatePreset, setFilterDatePreset] = useState("today");
  const [filterSlots, setFilterSlots] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [callTooltipPos, setCallTooltipPos] = useState({ top: 0, left: 0 });
  const callWrapRefs = useRef({});
  const [showAddModal, setShowAddModal] = useState(false);

  const data = adminData?.preBookings || [];

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  /* filter */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterFromDate) d = d.filter(r => (r.date || "") >= filterFromDate);
    if (filterToDate) d = d.filter(r => (r.date || "") <= filterToDate);
    if (filterSlots.size > 0) d = d.filter(r => { const k = resolveSlotKey(r); return k && filterSlots.has(k); });
    if (filterStatuses.size > 0) d = d.filter(r => filterStatuses.has(r.status || "scheduled"));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(r => (r.name || "").toLowerCase().includes(q) || (r.mobile || "").includes(q) || (r.id || "").toLowerCase().includes(q));
    }
    return d;
  }, [data, filterFromDate, filterToDate, filterSlots, filterStatuses, search]);

  /* sort */
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let va, vb;
      if (sortField === "date") { va = new Date(`${a.date}T${a.time || "00:00"}`); vb = new Date(`${b.date}T${b.time || "00:00"}`); }
      else if (sortField === "guests") { va = Number(a.guests || 0); vb = Number(b.guests || 0); }
      else if (sortField === "totalAmount") { va = Number(a.totalAmount || 0); vb = Number(b.totalAmount || 0); }
      else { va = (a[sortField] || "").toString().toLowerCase(); vb = (b[sortField] || "").toString().toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDir]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(sortedData.length, 30);
  const today = todayStr();
  const todayCount = data.filter(r => r.date === today).length;
  const scheduledCount = data.filter(r => (r.status || "scheduled") === "scheduled").length;
  const completedCount = data.filter(r => r.status === "completed").length;

  /* inline status update */
  const updateStatus = async (e, id, status) => {
    e.stopPropagation();
    const prev = data.find(r => r.id === id);
    if (!prev) return;
    if (typeof setAdminData === "function") {
      setAdminData(p => ({ ...p, preBookings: (p.preBookings || []).map(r => r.id === id ? { ...r, status } : r) }));
    }
    try {
      try { await api.patch(`/preBookings/${id}`, { status }); }
      catch { await api.put(`/preBookings/${id}`, { ...prev, status }); }
      toast.success(`Status updated to ${status}`);
    } catch {
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, preBookings: (p.preBookings || []).map(r => r.id === id ? prev : r) }));
      }
      toast.error("Failed to update status");
    }
  };

  /* call logging — persisted to JSON */
  const handleCall = async (e, id) => {
    e.stopPropagation();
    const prev = (adminData?.preBookings || []).find(r => r.id === id);
    if (!prev) return;
    const newEntry = new Date().toISOString();
    const updatedHistory = [...(prev.callHistory || []), newEntry];
    /* optimistic update */
    if (typeof setAdminData === "function") {
      setAdminData(p => ({
        ...p,
        preBookings: (p.preBookings || []).map(r =>
          r.id === id ? { ...r, callHistory: updatedHistory } : r
        ),
      }));
    }
    try {
      try { await api.patch(`/preBookings/${id}`, { callHistory: updatedHistory }); }
      catch { await api.put(`/preBookings/${id}`, { ...prev, callHistory: updatedHistory }); }
      toast.success("Call logged!");
    } catch {
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          preBookings: (p.preBookings || []).map(r => r.id === id ? prev : r),
        }));
      }
      toast.error("Failed to log call");
    }
  };

  /* modal saved callback */
  const handleModalSaved = (newRecord) => {
    if (typeof setAdminData === "function") {
      setAdminData(p => ({ ...p, preBookings: [newRecord, ...(p.preBookings || [])] }));
    }
  };

  const activeFilters = filterFromDate || filterToDate || filterSlots.size > 0 || filterStatuses.size > 0 || search.trim();

  const exportToExcel = () => {
    if (!sortedData.length) { alert("No pre-bookings to export"); return; }
    const rows = sortedData.map(item => ({
      Name: item.name || "—",
      Mobile: item.mobile || "—",
      Email: item.email || "—",
      Date: item.date || "—",
      Slot: item.slotGroup || "—",
      Time: item.time || "—",
      Guests: item.guests ?? "—",
      Items: (item.items || []).length,
      "Total Amount": item.totalAmount ? `₹${Number(item.totalAmount).toLocaleString("en-IN")}` : "—",
      Status: item.status || "—",
      Source: item.source || "—",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "PreBookings");
    const suffix = filterFromDate && filterToDate
      ? `${filterFromDate}_to_${filterToDate}`
      : filterFromDate || filterToDate || "all";
    XLSX.writeFile(wb, `prebookings_${suffix}.xlsx`);
  };

  const SortTh = ({ field, children }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}
      <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
        {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );

  return (
    <div className="evt-pre-page">

      {/* HEADER */}
      <div className="evt-pre-header">
        <div>
          <h2 className="evt-pre-title">PreBookings</h2>
          <p className="evt-pre-subtitle">Manage pre-orders &amp; advance bookings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="orders-export-btn" onClick={exportToExcel}>Export</button>
          <button className="evt-pre-add-btn" onClick={() => setShowAddModal(true)}>
            + Add PreBooking
          </button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="evt-pre-kpi-row">
        {[
          { label: "Total", val: data.length, color: "#111" },
          { label: "Today", val: todayCount, color: "#2980b9" },
          { label: "Scheduled", val: scheduledCount, color: "#ca8a04" },
          { label: "Completed", val: completedCount, color: "#16a34a" },
        ].map((k, i) => (
          <div key={i} className="evt-pre-kpi" style={{ borderTopColor: k.color }}>
            <div className="evt-pre-kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="evt-pre-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="evt-pre-filter-bar">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="evt-pre-search" placeholder="Search name / mobile / ID..."
            value={search} onChange={e => setSearch(e.target.value)} />

          {/* Quick date presets */}
          {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([preset, label]) => (
            <button key={preset}
              className={`evt-pre-filter-btn${filterDatePreset === preset ? " active" : ""}`}
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

          {/* From / To date pickers */}
          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">From</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterFromDate} onChange={v => { setFilterFromDate(v); setFilterDatePreset(""); if (filterToDate && v > filterToDate) setFilterToDate(v); }} placeholder="Start date" />
            </div>
          </div>
          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">To</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterToDate} min={filterFromDate} onChange={v => { setFilterToDate(v); setFilterDatePreset(""); }} placeholder="End date" />
            </div>
            {(filterFromDate || filterToDate) && (
              <button className="evt-pre-filter-btn" onClick={() => { setFilterFromDate(""); setFilterToDate(""); setFilterDatePreset(""); }} title="Clear dates">✕</button>
            )}
          </div>
        </div>

        <div className="evt-pre-filter-groups">
          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">Slot</span>
            {SLOT_GROUPS.map(sg => (
              <button key={sg.key} title={`${sg.label} (${sg.start}–${sg.end})`}
                className={`evt-pre-filter-btn${filterSlots.has(sg.key) ? " active" : ""}`}
                onClick={() => toggleSet(setFilterSlots, sg.key)}>
                {sg.short}
              </button>
            ))}
          </div>

          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">Status</span>
            {[
              ["scheduled", "S", "status-scheduled", "Scheduled"],
              ["preparing", "P", "status-preparing", "Preparing"],
              ["completed", "D", "status-completed", "Done"],
            ].map(([key, short, cls, title]) => (
              <button key={key} title={title}
                className={`evt-pre-filter-btn${filterStatuses.has(key) ? " active " + cls : ""}`}
                onClick={() => toggleSet(setFilterStatuses, key)}>{short}
              </button>
            ))}
          </div>

          {activeFilters && (
            <button className="evt-pre-clear-all" onClick={() => {
              setSearch(""); setFilterFromDate(todayStr()); setFilterToDate(todayStr());
              setFilterDatePreset("today"); setFilterSlots(new Set()); setFilterStatuses(new Set());
            }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-pre-table-wrapper" ref={containerRef}>
        <table className="evt-pre-table">
          <thead>
            <tr>
              <SortTh field="name">Guest Name</SortTh>
              <th>Contact</th>
              <SortTh field="date">Date</SortTh>
              <th>Slot</th>
              <th>Time</th>
              <SortTh field="guests">Guests</SortTh>
              <th>Items</th>
              <SortTh field="totalAmount">Total</SortTh>
              <SortTh field="status">Status</SortTh>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="10" className="evt-pre-empty">No preBookings found</td></tr>
            ) : (
              sortedData.slice(0, displayLimit).map(item => {
                const status = item.status || "scheduled";
                const slotKey = resolveSlotKey(item);
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";
                const history = item.callHistory || [];

                return (
                  <tr key={item.id} className="evt-pre-row clickable"
                    onClick={() => navigate(`/prebookings/${item.id}`)}>

                    {/* Guest name */}
                    <td>
                      <div className="evt-pre-name-cell">
                        <div className="evt-pre-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="evt-pre-name">{item.name || "—"}</div>
                          <div className="evt-pre-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="evt-pre-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-pre-email">{item.email}</span>}
                      </div>
                    </td>

                    {/* Date */}
                    <td style={{ fontWeight: 600 }}>{item.date || "—"}</td>

                    {/* Slot */}
                    <td>
                      <span className={`evt-pre-slot-badge slot-${slotKey?.toLowerCase() || "any"}`}>
                        {slotLabel}
                      </span>
                    </td>

                    {/* Time */}
                    <td>{fmtTime(item.time)}</td>

                    {/* Guests */}
                    <td style={{ textAlign: "center", fontWeight: 700 }}>
                      {item.guests || 1}
                      {item.guests > 8 && <span className="evt-pre-discount-badge">-10%</span>}
                    </td>

                    {/* Items */}
                    <td style={{ textAlign: "center" }}>{item.items?.length || 0}</td>

                    {/* Total */}
                    <td>
                      <span style={{ fontWeight: 600 }}>₹{item.totalAmount || 0}</span>
                      {item.discount > 0 && <div style={{ fontSize: 10, color: "#065f46" }}>saved ₹{item.discount}</div>}
                    </td>

                    {/* Status inline */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-pre-inline-status">
                        {["scheduled", "preparing", "completed"].map(s => (
                          <button key={s}
                            className={`evt-pre-istatus-btn evt-pre-istatus-${s}${status === s ? " active" : ""}`}
                            title={s}
                            onClick={e => updateStatus(e, item.id, s)}>
                            {s === "scheduled" ? "S" : s === "preparing" ? "P" : "D"}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td onClick={e => e.stopPropagation()}>
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
                        <button className="evt-pre-act-btn" onClick={e => handleCall(e, item.id)}>
                          📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                        </button>
                      </div>
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


      {/* ── Call History Portal Tooltip ── */}
      {callTooltipId && createPortal(
        (() => {
          const histItem = (adminData?.preBookings || []).find(x => x.id === callTooltipId);
          const hist = histItem?.callHistory || [];
          if (!hist.length) return null;
          return (
            <div
              className="evt-pre-call-tooltip"
              style={{
                position: "fixed",
                top: callTooltipPos.top,
                left: callTooltipPos.left - 20,
                transform: "translate(-50%, calc(-100% - 10px))",
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

      {/* ADD MODAL */}
      {showAddModal && (
        <AddPreBookingModal
          onClose={() => setShowAddModal(false)}
          onSaved={handleModalSaved}
          toast={toast}
        />
      )}

    </div>
  );
};

export default PreBookings;