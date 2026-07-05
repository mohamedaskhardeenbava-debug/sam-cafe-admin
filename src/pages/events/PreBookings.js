/**
 * PreBookings.js  —  Sam Cafe Admin Panel
 * Pre-bookings management page
 */

import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import { exportToExcel } from "../../utils/excelUtils";
import api from "../../api";
import { CustomDatePicker } from "../../components/CustomDatePicker";

import closeIcon from "../../icon/close-icon.png";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";
import Button3D from "../../components/Button3D";
import CustomDropdown from "../../components/CustomDropdown";

import "./PreBookings.css";
import "./EvtCommon.css";
import "../ModalCSS.css";
import "./PreviewModal.css";
import PageLoader from "../../components/PageLoader";

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
const EMPTY_FORM = {
  name: "",
  mobile: "",
  email: "",
  guests: 1,
  date: todayStr(),
  time: "",
  slotGroup: "",
  notes: "",
  source: "Phone",
  status: "pending",
};
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

  const subtotal = selectedItems.reduce((s, i) => s + (i.totalPrice || 0), 0);
  const isGroupDiscount = guestCount > 8;
  const discount = isGroupDiscount ? Math.round(subtotal * 0.1) : 0;
  const totalAmount = subtotal - discount;

  return (
    <div className="ae-dishes-split">
      <div className="ae-dishes-split-left">
        <div className="ae-dish-selector-v2">
          <CustomDropdown
            value={activeCat}
            onChange={setActiveCat}
            options={[
              { value: "", label: "All Categories" },
              ...categories.map(c => ({ value: c.id, label: c.name })),
            ]}
          />
          {filteredDishes.length === 0 ? (
            <div className="act-dish-empty">No dishes in this category</div>
          ) : (
            <div className="act-dish-grid">
              {filteredDishes.map(dish => {
                const sel = isSelected(dish.id);
                return (
                  <div key={dish.id} className={`act-dish-card${sel ? " selected" : ""}`}>
                    <div className="act-dish-info">
                      <span className="act-dish-name">{dish.name}</span>
                      {dish.category && <span className="act-dish-cat">{dish.category}</span>}
                      <span className="act-dish-price">₹{dish.price}/person × {guestCount} = <strong style={{ color: "#e74c3c" }}>₹{(dish.price * guestCount).toLocaleString()}</strong></span>
                    </div>
                    {sel ? (
                      <Button3D iconOnly onClick={() => toggle(dish)}>✓ Added</Button3D>
                    ) : (
                      <Button3D variant="cancel" iconOnly onClick={() => toggle(dish)}>+ Add</Button3D>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString()}</span>
            </div>
            {isGroupDiscount && (
              <div className="ae-dishes-right-total" style={{ color: "#065f46", fontSize: 12 }}>
                <span>Group Discount (10%)</span>
                <span>−₹{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="ae-dishes-right-total" style={{ fontWeight: 700, fontSize: 13 }}>
              <span>Total</span>
              <span>₹{totalAmount.toLocaleString()}</span>
            </div>
          </>
        )}
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
  const [tab, setTab] = useState(0);

  const [nowMinutes, setNowMinutes] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes()); }, 60_000);
    return () => clearInterval(id);
  }, []);

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
        status: form.status || "pending",
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="event-modal" onClick={e => e.stopPropagation()}>

        <div className="admin-modal-header">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <h3>Add PreBooking</h3>
            <div className="ecard">
              {["Details", "Dishes", "Preview"].map((t, i) => (
                <button key={i}
                  className={`ebutton${tab === i ? " active" : ""}${tab > i ? " done" : ""}`}
                  onClick={() => {
                    if (i > tab) {
                      if (tab === 0) {
                        const ve = validate();
                        if (Object.keys(ve).length > 0) { setErrors(ve); return; }
                      }
                      setTab(i);
                    } else {
                      setTab(i);
                    }
                  }}>
                  <span className="eevt-step-num">{tab > i ? "✓" : i + 1}</span>
                  <span className="eevt-step-label">{t}</span>
                </button>
              ))}
            </div>
          </div>
          <Button3D variant="cancel" iconOnly onClick={() => { onClose(); setErrors({}); }}><img src={closeIcon} /></Button3D>
        </div>

        <div className="event-modal-body">

          {/* TAB 0: Details */}
          {tab === 0 && (
            <>
              <div className="evt-res-form-section-label">Guest Information</div>
              <div className="evt-pre-modal-row">
                <div className="admin-form-group">
                  <div className="mat">
                    <input className={`mat-input${errors.name ? " mat-error" : ""}`} placeholder=" "
                      value={form.name} onChange={e => { setF("name", e.target.value); setErrors(p => ({ ...p, name: false })); }} />
                    <label className={`mat-label${errors.name ? " mat-label-error" : ""}`}>Name <span className="evt-pre-req">*</span></label>
                    <span className={`mat-bar${errors.name ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
                <div className="admin-form-group" style={{ flex: "0 0 130px" }}>
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
                <div className="admin-form-group">
                  <div className="mat">
                    <input className={`mat-input${errors.mobile ? " mat-error" : ""}`} placeholder=" " type="tel"
                      value={form.mobile} onChange={e => { setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10)); setErrors(p => ({ ...p, mobile: false })); }} />
                    <label className={`mat-label${errors.mobile ? " mat-label-error" : ""}`}>Mobile <span className="evt-pre-req">*</span></label>
                    <span className={`mat-bar${errors.mobile ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <div className="mat">
                    <input className={`mat-input${errors.email ? " mat-error" : ""}`} placeholder=" " type="email"
                      value={form.email} onChange={e => { setF("email", e.target.value); setErrors(p => ({ ...p, email: false })); }} />
                    <label className={`mat-label${errors.email ? " mat-label-error" : ""}`}>Email <span className="evt-pre-opt">(optional)</span></label>
                    <span className={`mat-bar${errors.email ? " mat-bar-error" : ""}`} />
                  </div>
                </div>
              </div>

              <div className="evt-res-form-section-label">Booking Details</div>
              <div className="evt-pre-modal-row">
                <div className="admin-form-group">
                  <label className={errors.date ? "mat-label-error" : ""}>Date <span className="evt-pre-req">*</span></label>
                  <CustomDatePicker value={form.date} min={todayStr()} onChange={v => { setF("date", v); setErrors(p => ({ ...p, date: false })); }} hasError={!!errors.date} />
                </div>

                <div className="admin-form-group">
                  <label>Dining Slot <span className="evt-pre-opt">(optional)</span></label>
                  <div className="evt-res-pref-grid">
                    {SLOT_GROUPS.map(sg => {
                      const slotEndH = parseInt(sg.end.split(":")[0]);
                      const slotEndM = parseInt(sg.end.split(":")[1] || "0");
                      const isPast = form.date === todayStr() && nowMinutes >= slotEndH * 60 + slotEndM;
                      return (
                        <button key={sg.key} type="button"
                          className={`evt-res-pref-card${form.slotGroup === sg.key ? " active" : ""}${isPast ? " chip-disabled" : ""}`}
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

                <div className="admin-form-group">
                  <label className={errors.time ? "mat-label-error" : ""}>Time <span className="evt-pre-req">*</span>{!form.slotGroup && <span className="evt-pre-opt"> (select slot first)</span>}</label>
                  <CustomTimePicker value={form.time} onChange={v => { setF("time", v); setErrors(p => ({ ...p, time: false })); }}
                    slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                    slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                    disabled={!form.slotGroup}
                    hasError={!!errors.time}
                    isToday={form.date === todayStr()} />
                </div>
              </div>

              <div className="evt-res-form-section-label">Source & Notes</div>
              <div className="admin-form-group">
                <label>Source</label>
                <div className="evt-res-source-chips">
                  {["pending", "confirmed"].map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`evt-res-source-chip ${form.status === s ? "active clb-status-" + s : ""}`}
                      onClick={() => setF("status", s)}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-form-group">
                <div className="mat-area">
                  <textarea className="mat-input mat-textarea" rows={2} placeholder=" "
                    value={form.notes} onChange={e => setF("notes", e.target.value)} />
                  <label className="mat-area-label">Notes (optional)</label>
                  <span className="mat-area-bar" />
                </div>
              </div>
            </>
          )}

          {/* TAB 1: Dishes */}
          {tab === 1 && (
            <div style={{ height: 380 }}>
              <PreDishPicker menuData={menuData} selectedItems={selectedItems} setSelectedItems={setSelectedItems} guests={form.guests} />
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
                  <span className={`prv-status-badge clb-status-${form.status || "pending"}`}>{form.status || "pending"}</span>
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
                    ["Status", form.status || "pending"],
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
                        <tr key={dish._id || dish.id || idx}>
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

        <div className="admin-modal-footer">
          <Button3D variant="cancel" onClick={() => { onClose(); setErrors({}); }}>Cancel</Button3D>
          {tab > 0 && (
            <button type="button" className="modal-prev-btn" onClick={() => setTab(t => t - 1)}>
              <span className="shadow"></span><span className="edge"></span>
              <span className="front">← Back</span>
            </button>
          )}
          {tab < 2 ? (
            <button type="button" className="modal-next-btn"
              onClick={() => {
                if (tab === 0) {
                  const ve = validate();
                  if (Object.keys(ve).length > 0) { setErrors(ve); return; }
                }
                setTab(t => t + 1);
              }}>
              <span className="shadow"></span><span className="edge"></span>
              <span className="front">Next →</span>
            </button>
          ) : (
            <Button3D disabled={saving} onClick={handleSave}>{saving ? "Saving..." : "Create PreBooking"}</Button3D>
          )}
        </div>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
const PreBookings = ({ adminData, setAdminData, filters, patchFilters, onResetFilters }) => {
  // ── State & Setup

  const { fromDate: filterFromDate, toDate: filterToDate, preset: filterDatePreset, slots: filterSlots, statuses: filterStatuses, search } = filters;

  // ── Helpers

  const setFilterFromDate = (v) => patchFilters({ fromDate: v });
  const setFilterToDate = (v) => patchFilters({ toDate: v });
  const setFilterDatePreset = (v) => patchFilters({ preset: v });
  const setFilterSlots = (v) => patchFilters({ slots: typeof v === "function" ? v(filterSlots) : v });
  const setFilterStatuses = (v) => patchFilters({ statuses: typeof v === "function" ? v(filterStatuses) : v });
  const setSearch = (v) => patchFilters({ search: v });
  const { toast } = useToast();
  const navigate = useNavigate();
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [callTooltipPos, setCallTooltipPos] = useState({ top: 0, left: 0 });
  const callWrapRefs = useRef({});
  const [showAddModal, setShowAddModal] = useState(false);


  const data = adminData?.preBookings || [];

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
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
    if (filterStatuses.size > 0) d = d.filter(r => filterStatuses.has(r.status || "pending"));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(r => (r.name || "").toLowerCase().includes(q) || (r.mobile || "").includes(q) || (r.id || "").toLowerCase().includes(q));
    }
    return d;
  }, [data, filterFromDate, filterToDate, filterSlots, filterStatuses, search]);

  const today = todayStr();
  const pendingCount = filteredData.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = filteredData.filter(r => r.status === "confirmed").length;
  const completedCount = filteredData.filter(r => r.status === "completed").length;
  const cancelledCount = filteredData.filter(r => r.status === "cancelled").length;

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
  if (!adminData?.preBookings?.length) return <PageLoader label="Loading pre-bookings…" />;

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

  /* modal saved callback — state update handled by socket data-change */
  const handleModalSaved = (_newRecord) => { };

  const isDefaultFilter = filterFromDate === todayStr() && filterToDate === todayStr() && filterDatePreset === "today" && filterSlots.size === 0 && filterStatuses.size === 0 && !search.trim();
  const activeFilters = !isDefaultFilter;

  const handleExport = () => {
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
    const suffix = filterFromDate && filterToDate
      ? `${filterFromDate}_to_${filterToDate}`
      : filterFromDate || filterToDate || "all";
    exportToExcel({ rows, sheetName: "PreBookings", fileName: `prebookings_${suffix}.xlsx` });
  };

  return (
    <div className="inner-page">

      {/* HEADER */}
      <div className="evt-header">
        <div>
          <h2 className="evt-title">PreBookings</h2>
          <p className="evt-subtitle">Manage pre-orders &amp; advance bookings</p>
        </div>
        {/* KPI STRIP */}
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
        <div className="header-btn-container">
          <Button3D onClick={handleExport}>Export</Button3D>
          <Button3D onClick={() => setShowAddModal(true)}>+ Add PreBooking</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="filter-groups">
          <input className="search-input" placeholder="Search name / mobile / ID..."
            value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="filter-group">
            <span className="filter-group-label">period</span>
            {/* Quick date presets */}
            {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([preset, label]) => (
              <button key={preset}
                className={`filter-pill${filterDatePreset === preset ? " active" : ""}`}
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
          <div className="filter-group">
            <span className="filter-group-label">From</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterFromDate} onChange={v => { setFilterFromDate(v); setFilterDatePreset(""); if (filterToDate && v > filterToDate) setFilterToDate(v); }} placeholder="Start date" />
            </div>

            <span className="filter-group-label">To</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterToDate} min={filterFromDate} onChange={v => { setFilterToDate(v); setFilterDatePreset(""); }} placeholder="End date" />
            </div>
            {(filterFromDate || filterToDate) && (
              <button className="filter-pill" onClick={() => { setFilterFromDate(""); setFilterToDate(""); setFilterDatePreset(""); }} title="Clear dates">✕</button>
            )}
          </div>
        </div>

        <div className="filter-groups">
          <div className="filter-group">
            <span className="filter-group-label">Slot</span>
            {SLOT_GROUPS.map(sg => (
              <button key={sg.key} title={`${sg.label} (${sg.start}–${sg.end})`}
                className={`filter-pill${filterSlots.has(sg.key) ? " active" : ""}`}
                onClick={() => toggleSet(setFilterSlots, sg.key)}>
                {sg.short}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Status</span>
            {[
              ["pending", "P", "clb-status-pending", "Pending"],
              ["confirmed", "C", "clb-status-confirmed", "Confirmed"],
              ["completed", "D", "clb-status-completed", "Done"],
              ["cancelled", "X", "clb-status-cancelled", "Cancelled"],
            ].map(([key, short, cls, title]) => (
              <button key={key} title={title}
                className={`filter-pill${filterStatuses.has(key) ? " active " + cls : ""}`}
                onClick={() => toggleSet(setFilterStatuses, key)}>
                {short}
              </button>
            ))}
          </div>

          {activeFilters && (
            <button className="evt-clb-clear-btn" onClick={onResetFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="table-wrapper" style={{ maxHeight: "calc(100vh - 300px)" }} ref={containerRef}>
        <table >
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className={sortField === "name" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Guest Name</span>
                  <span className="sort-arrow">{sortField === "name" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Contact</th>
              <th onClick={() => handleSort("date")} className={sortField === "date" ? "sorted" : ""}>
                <span className="th-content sort-th">
                  <span>Date</span>
                  <span className="sort-arrow">{sortField === "date" ? (sortDir === "asc" ? "▲" : "▼") : "▼"}</span>
                </span>
              </th>
              <th>Slot</th>
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
              <tr><td colSpan="10" className="evt-pre-empty">No preBookings found</td></tr>
            ) : (
              sortedData.slice(0, displayLimit).map(item => {
                const status = item.status || "scheduled";
                const slotKey = resolveSlotKey(item);
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";
                const history = item.callHistory || [];

                return (
                  <tr className="evt-pre-row">

                    {/* Guest name */}
                    <td>
                      <span>
                        <span className="evt-pre-name clickable"
                          key={item.id}
                          onClick={() => navigate(`/prebookings/${item.id}`, { state: { fromDetail: true } })}
                        >
                          {item.name || "—"}
                        </span>
                        <div className="evt-pre-id-small">#{(item.id || "").slice(-6)}</div>
                      </span>
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
                        {["pending", "confirmed", "completed", "cancelled"].map(s => (
                          <button key={s}
                            className={`evt-res-istatus-btn evt-res-istatus-${s}${status === s ? " active" : ""}`}
                            title={s}
                            onClick={e => updateStatus(e, item.id, s)}>
                            {s === "pending" ? "P" : s === "confirmed" ? "C" : s === "completed" ? "D" : "X"}
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
                        <Button3D variant="cancel" iconOnly onClick={e => handleCall(e, item.id)}>📞 Call{history.length > 0 ? ` (${history.length})` : ""}</Button3D>
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
