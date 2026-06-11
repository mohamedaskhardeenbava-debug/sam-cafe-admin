import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../api";
import "./ComboOffers.css";
import closeIcon from "../icon/close-icon.png";
import deleteIcon from "../icon/delete-icon.png";
import editIcon from "../icon/edit-icon.png";
import { useToast } from "../useToast";

/* ─── helpers ─────────────────────────────────────────────── */
const uid = () => `offer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const calcFinal = (price, type, value) => {
  if (!value || isNaN(value)) return price;
  if (type === "FLAT") return Math.max(price - value, 0);
  return Math.round(price * (1 - value / 100));
};

const SECTION_KEYS = ["starters", "mainCourse", "beverages"];
const SECTION_LABELS = { starters: "Starter", mainCourse: "Main Course", beverages: "Beverages" };
/* map slot key → condition field (for saving) */
const SLOT_TO_CONDITION = { starters: "starter", mainCourse: "main", beverages: "beverages" };

let dragPayload = null; // simple module-level drag carrier

/* ═══════════════════════════════════════════════════════════ */
/* ─── DishList — isolated component so key= forces full remount on tab switch ── */
const DishList = ({ items, sectionKey, usedDishNames, onDragStart }) => {
  const sorted = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const aUsed = usedDishNames.has(a.name) ? 1 : 0;
      const bUsed = usedDishNames.has(b.name) ? 1 : 0;
      return aUsed - bUsed;
    });
  }, [items, usedDishNames]);

  return (
    <div className="co-dish-list">
      {sorted.length === 0 && (
        <p style={{ color: "#bbb", fontStyle: "italic", fontSize: 13 }}>No dishes</p>
      )}
      {sorted.map((dish, idx) => {
        const isUsed = usedDishNames.has(dish.name);
        return (
          <div
            key={`${sectionKey}__${dish.id}__${idx}`}
            className={`co-dish-row ${isUsed ? "co-dish-row--used" : ""}`}
            draggable={!isUsed}
            onDragStart={!isUsed ? () => onDragStart(dish, sectionKey) : undefined}
            title={isUsed ? "Already used in another combo offer" : undefined}
          >
            <div className="co-dish-row-left">
              <span className="co-dish-row-name">{dish.name}</span>
              {isUsed && <span className="co-dish-row-tag">Has offer</span>}
            </div>
            <span className="co-dish-row-price">₹{dish.price}</span>
          </div>
        );
      })}
    </div>
  );
};

const ComboOffers = () => {
  /* ── top-level data ── */
  const [comboSections, setComboSections] = useState({ starters: [], mainCourse: [], beverages: [] });
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── modal state ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editOffer, setEditOffer] = useState(null);
  const [saving, setSaving] = useState(false);

  /* modal fields */
  const [slots, setSlots] = useState({ starters: null, mainCourse: null, beverages: null });
  const [activeTab, setActiveTab] = useState("starters");
  const [discountVal, setDiscountVal] = useState("");
  const [offerType, setOfferType] = useState("PERCENT");
  const [offerLabel, setOfferLabel] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [errors, setErrors] = useState({});
  const { toast } = useToast();

  /* ── sort ── */
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };
  const getActual = (o) =>
    (o.condition?.starterPrice || 0) + (o.condition?.mainPrice || 0) + (o.condition?.beveragesPrice || 0);
  const sortedOffers = useMemo(() => {
    if (!sortConfig.key) return offers;
    return [...offers].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === "starter") { aVal = a.condition?.starter || ""; bVal = b.condition?.starter || ""; }
      else if (sortConfig.key === "main") { aVal = a.condition?.main || ""; bVal = b.condition?.main || ""; }
      else if (sortConfig.key === "bev") { aVal = a.condition?.beverages || ""; bVal = b.condition?.beverages || ""; }
      else if (sortConfig.key === "discount") { aVal = a.value; bVal = b.value; }
      else if (sortConfig.key === "actual") { aVal = getActual(a); bVal = getActual(b); }
      else if (sortConfig.key === "final") { aVal = calcFinal(getActual(a), a.type, a.value); bVal = calcFinal(getActual(b), b.type, b.value); }
      if (typeof aVal === "string") return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [offers, sortConfig]);

  /* ── load on mount ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [comboRes, offersRes] = await Promise.all([
          api.get("/combo"),
          api.get("/combo_offers"),
        ]);
        const comboData = comboRes.data || [];
        const sectionMap = { starters: [], mainCourse: [], beverages: [] };
        comboData.forEach(section => {
          if (sectionMap[section.type] !== undefined) {
            const items = (section.groups || []).flatMap(g =>
              (g.items || []).map(i => ({
                id: i.id,
                name: i.name,
                price: i.price ?? i.basePrice ?? 0,
                image: i.image || "",
              }))
            );
            sectionMap[section.type] = items;
          }
        });
        setComboSections(sectionMap);
        setOffers(offersRes.data || []);
      } catch {
        toast.error("Failed to load data", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ── open modal (new) ── */
  const openNew = () => {
    setEditOffer(null);
    setSlots({ starters: null, mainCourse: null, beverages: null });
    setActiveTab("starters");
    setDiscountVal("");
    setOfferType("PERCENT");
    setOfferLabel("");
    setErrors({});
    setModalOpen(true);
  };

  /* ── open modal (edit) ── */
  const openEdit = (offer) => {
    setEditOffer(offer);
    const s = comboSections.starters.find(i => i.name === offer.condition?.starter) || null;
    const m = comboSections.mainCourse.find(i => i.name === offer.condition?.main) || null;
    const b = comboSections.beverages.find(i => i.name === offer.condition?.beverages) || null;
    setSlots({ starters: s, mainCourse: m, beverages: b });
    setActiveTab("starters");
    setOfferType(offer.type || "PERCENT");
    setDiscountVal(String(offer.value || ""));
    setOfferLabel(offer.label || "");
    setErrors({});
    setModalOpen(true);
  };

  /* ── pricing ── */
  const totalActual = Object.values(slots).reduce((a, d) => a + (d?.price || 0), 0);
  const totalFinal = calcFinal(totalActual, offerType, parseFloat(discountVal));
  const savings = totalActual - totalFinal;
  const autoLabel = () => offerType === "PERCENT" && discountVal ? `${discountVal}% OFF`
    : offerType === "FLAT" && discountVal ? `Flat ₹${discountVal} OFF` : "";

  /* ── validate ── */
  const validate = () => {
    const e = {};
    const filled = [slots.starters, slots.mainCourse, slots.beverages].filter(Boolean).length;
    if (filled < 2)
      e.slots = "Add at least 2 dishes — any combination of Starter, Main Course, or Beverages";
    if (!discountVal || isNaN(parseFloat(discountVal)) || parseFloat(discountVal) <= 0)
      e.discount = "Enter a valid discount value";
    return e;
  };

  /* ── save ── */
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const label = offerLabel.trim() || autoLabel();
    const condition = {};
    if (slots.starters) { condition.starter = slots.starters.name; condition.starterPrice = slots.starters.price; }
    if (slots.mainCourse) { condition.main = slots.mainCourse.name; condition.mainPrice = slots.mainCourse.price; }
    if (slots.beverages) { condition.beverages = slots.beverages.name; condition.beveragesPrice = slots.beverages.price; }

    const payload = { id: editOffer?.id || uid(), label, type: offerType, value: parseFloat(discountVal), condition };
    setSaving(true);
    try {
      if (editOffer) {
        await api.put(`/combo_offers/${editOffer.id}`, payload);
        setOffers(prev => prev.map(o => o.id === editOffer.id ? payload : o));
        toast.success("Offer updated!");
      } else {
        const res = await api.post("/combo_offers", payload);
        setOffers(prev => [...prev, res.data]);
        toast.success("Offer created!");
      }
      setModalOpen(false);
    } catch {
      toast.error("Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ── */
  const handleDelete = async (id, label) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    try {
      await api.delete(`/combo_offers/${id}`);
      setOffers(prev => prev.filter(o => o.id !== id));
      toast.success("Offer deleted");
    } catch {
      toast.error("Delete failed", "error");
    }
  };

  /* ── drag ── */
  const onDragStart = (item, fromSection) => {
    dragPayload = { item, fromSection };
  };

  const onDrop = (slotKey) => {
    if (!dragPayload) return;
    if (dragPayload.fromSection !== slotKey) {
      // Wrong slot — highlight error briefly then ignore
      setErrors(prev => ({ ...prev, wrongSlot: slotKey }));
      setTimeout(() => setErrors(prev => { const n = { ...prev }; delete n.wrongSlot; return n; }), 800);
      setDragOver(null);
      dragPayload = null;
      return;
    }
    setSlots(prev => ({ ...prev, [slotKey]: dragPayload.item }));
    setErrors(prev => { const n = { ...prev }; delete n.slots; return n; });
    setDragOver(null);
    dragPayload = null;
  };

  const clearSlot = (key) => setSlots(prev => ({ ...prev, [key]: null }));

  /* ── dishes already assigned in OTHER offers (exclude current edit) ── */
  const usedDishNames = React.useMemo(() => {
    const used = new Set();
    offers.forEach(o => {
      if (editOffer && o.id === editOffer.id) return; // skip self when editing
      if (o.condition?.starter) used.add(o.condition.starter);
      if (o.condition?.main) used.add(o.condition.main);
      if (o.condition?.beverages) used.add(o.condition.beverages);
    });
    return used;
  }, [offers, editOffer]);

  if (loading) return (
    <div className="dishes-page">
      <div className="co-loading"><span className="co-spinner" /> Loading combo offers…</div>
    </div>
  );

  return (
    <div className="dishes-page">

      {/* ── header ── */}
      <div className="dish-header">
        <h2 className="dish-title">Combo Offers</h2>
        <button className="modal-save-btn" onClick={openNew}>
          <span className="shadow" /><span className="edge" />
          <span className="front">+ Add Combo</span>
        </button>
      </div>

      {/* ── table ── */}
      <div className="dish-block">
        <div className="combo-table-wrapper">
          <table className="combo-table">
            <thead>
              <tr>
                {[
                  { label: "Starter", key: "starter" },
                  { label: "Main Course", key: "main" },
                  { label: "Beverages", key: "bev" },
                  { label: "Discount", key: "discount" },
                  { label: "Actual Price", key: "actual" },
                  { label: "Discounted Price", key: "final" },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={sortConfig.key === col.key ? "sorted" : ""}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="th-content sort-th">
                      <span>{col.label}</span>
                      <span className="sort-arrow">
                        {sortConfig.key === col.key
                          ? sortConfig.direction === "asc" ? "▲" : "▼"
                          : "⇅"}
                      </span>
                    </span>
                  </th>
                ))}
                <th>Edit</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {offers.length === 0 && (
                <tr>
                  <td colSpan={7} className="co-empty-row">No combo offers yet. Click "+ Add Combo" to create one.</td>
                </tr>
              )}
              {sortedOffers.map((o, i) => (
                <tr key={o.id}>
                  <td>
                    <span className="">{o.condition?.starter || "—"}</span>
                  </td>
                  <td>
                    <span className="">{o.condition?.main || "—"}</span>
                  </td>
                  <td>
                    <span className="">{o.condition?.beverages || "—"}</span>
                  </td>
                  <td>
                    <span className={`co-discount-badge ${o.type === "FLAT" ? "flat" : "pct"}`}>
                      {o.type === "FLAT" ? `₹${o.value}` : `${o.value}%`}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const actual = (o.condition?.starterPrice || 0) + (o.condition?.mainPrice || 0) + (o.condition?.beveragesPrice || 0);
                      return actual > 0
                        ? <span className="co-actual-price">₹{actual}</span>
                        : <span style={{ color: "#ccc" }}>—</span>;
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const actual = (o.condition?.starterPrice || 0) + (o.condition?.mainPrice || 0) + (o.condition?.beveragesPrice || 0);
                      if (!actual) return <span style={{ color: "#ccc" }}>—</span>;
                      const final = calcFinal(actual, o.type, o.value);
                      return <span className="co-final-price">₹{final}</span>;
                    })()}
                  </td>
                  <td>
                    <button className="modal-cancel-btn" onClick={() => openEdit(o)}>
                      <span className="shadow" /><span className="edge" />
                      <span className="front close-padding"><img src={editIcon} /></span>
                    </button>
                  </td>
                  <td>
                    <button className="modal-cancel-btn" onClick={() => handleDelete(o.id, o.label)}>
                      <span className="shadow" /><span className="edge" />
                      <span className="front close-padding"><img src={deleteIcon} /></span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MODAL ══════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal co-modal-wide">

            {/* header */}
            <div className="modal-header">
              <h3>{editOffer ? "Edit Combo Offer" : "Add Combo Offer"}</h3>
              <button type="button" className="modal-cancel-btn" onClick={() => setModalOpen(false)}>
                <span className="shadow" /><span className="edge" />
                <span className="front close-padding"><img src={closeIcon} /></span>
              </button>
            </div>

            {/* two-column body */}
            <div className="modal-body co-modal-body">

              {/* ── LEFT: category tabs + dish list ── */}
              <div className="co-modal-left">
                <p className="co-section-label">Pick a category</p>
                <div className="dish-category-buttons" style={{ marginBottom: 14 }}>
                  {SECTION_KEYS.map(key => (
                    <button
                      key={key}
                      className={`filter-pill ${activeTab === key ? "active" : ""}`}
                      onClick={() => setActiveTab(key)}
                    >
                      {SECTION_LABELS[key]}
                    </button>
                  ))}
                </div>

                <p className="co-section-label">
                  Drag a {SECTION_LABELS[activeTab]} dish into the {SECTION_LABELS[activeTab]} slot →
                </p>

                <DishList
                  key={activeTab}
                  items={comboSections[activeTab] || []}
                  sectionKey={activeTab}
                  usedDishNames={usedDishNames}
                  onDragStart={onDragStart}
                />
              </div>

              {/* ── RIGHT: slots + pricing ── */}
              <div className="co-modal-right">
                <p className="co-section-label">Drop dishes into slots</p>

                {errors.slots && (
                  <div className="co-error-banner">{errors.slots}</div>
                )}

                <div className="co-slots">
                  {SECTION_KEYS.map(key => {
                    const isWrong = errors.wrongSlot === key;
                    const isFilled = !!slots[key];
                    const isOver = dragOver === key;
                    return (
                      <div
                        key={key}
                        className={[
                          "co-slot",
                          isFilled ? "filled" : "",
                          isOver ? "drag-over" : "",
                          isWrong ? "wrong-slot" : "",
                        ].filter(Boolean).join(" ")}
                        onDragOver={e => { e.preventDefault(); setDragOver(key); }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => onDrop(key)}
                      >
                        <div className="co-slot-header">
                          <span className="co-slot-label">{SECTION_LABELS[key].toUpperCase()}</span>
                          {isFilled && (
                            <button className="co-slot-clear" onClick={() => clearSlot(key)}>✕</button>
                          )}
                        </div>
                        {isFilled ? (
                          <div className="co-slot-dish">
                            <span className="co-slot-dish-name">{slots[key].name}</span>
                            <span className="co-slot-dish-price">₹{slots[key].price}</span>
                          </div>
                        ) : (
                          <div className="co-slot-empty">
                            {isWrong
                              ? `⚠ Only ${SECTION_LABELS[key]} dishes allowed here`
                              : `Drop a ${SECTION_LABELS[key]} dish here`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── pricing block ── */}
                <div className="co-pricing">
                  <div className="co-pricing-row">
                    <span>Actual Total</span>
                    <span className="co-price-actual">
                      {totalActual > 0 ? `₹${totalActual}` : "—"}
                    </span>
                  </div>

                  <div className="co-offer-row">
                    <div className="co-type-toggle">
                      <button
                        type="button"
                        className={`co-type-btn ${offerType === "PERCENT" ? "active" : ""}`}
                        onClick={() => setOfferType("PERCENT")}
                      >% OFF</button>
                      <button
                        type="button"
                        className={`co-type-btn ${offerType === "FLAT" ? "active" : ""}`}
                        onClick={() => setOfferType("FLAT")}
                      >₹ FLAT</button>
                    </div>
                    <div className="form-group">
                    <div className="mat" style={{ flex: 1 }}>
                      <input
                        className={`mat-input${errors.discount ? " mat-error" : ""}`}
                        type="number"
                        min={0}
                        placeholder=" "
                        value={discountVal}
                        onChange={e => {
                          setDiscountVal(e.target.value);
                          setErrors(prev => { const n = { ...prev }; delete n.discount; return n; });
                        }}
                      />
                      <label className={`mat-label${errors.discount ? " mat-label-error" : ""}`}>
                        {offerType === "PERCENT" ? "Discount %" : "Flat Discount ₹"}
                      </label>
                      <span className={`mat-bar${errors.discount ? " mat-bar-error" : ""}`} />
                    </div>
                    </div>
                  </div>
                  {errors.discount && <div className="co-field-error">{errors.discount}</div>}

                  <div className="co-pricing-row co-pricing-row--final">
                    <span>After Offer</span>
                    <span className="co-price-final">
                      {totalActual > 0 && discountVal ? `₹${totalFinal}` : "—"}
                    </span>
                  </div>

                  {totalActual > 0 && discountVal && savings > 0 && (
                    <div className="co-savings">
                      Customer saves ₹{savings} ({offerType === "PERCENT" ? `${discountVal}%` : `₹${discountVal} flat`})
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="modal-footer">
              <button type="button" className="modal-cancel-btn" onClick={() => setModalOpen(false)}>
                <span className="shadow" /><span className="edge" />
                <span className="front">Cancel</span>
              </button>
              <button type="button" className="modal-save-btn" onClick={handleSave} disabled={saving}>
                <span className="shadow" /><span className="edge" />
                <span className="front">{saving ? "Saving…" : editOffer ? "Update Offer" : "Create Offer"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboOffers;