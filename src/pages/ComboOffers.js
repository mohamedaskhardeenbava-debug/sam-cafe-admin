/**
 * ComboOffers.js  —  Sam Cafe Admin Panel
 * Combo offers management page
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

import api from "../api";

import closeIcon from "../icon/close-icon.png";
import deleteIcon from "../icon/delete-icon.png";
import editIcon from "../icon/edit-icon.png";
import doubleArrowIcon from "../icon/double-arrow-icon.png";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import { useVenue } from "../context/VenueContext";
import { EmptyRow } from "../App";

import "./ComboOffers.css";
import PageLoader from "../components/PageLoader";

/* ─── helpers ─────────────────────────────────────────────── */
const uid = () => `offer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const calcFinal = (price, type, value) => {
  if (!value || isNaN(value)) return price;
  if (type === "FLAT") return Math.max(price - value, 0);
  return Math.round(price * (1 - value / 100));
};

/* default combo section layout — overridden by /comboSectionConfig once loaded */
const DEFAULT_SECTIONS = [
  { key: "dishes", label: "Dishes", categoryIds: ["pizza", "burger", "sandwichs"] },
  { key: "desserts", label: "Desserts", categoryIds: ["desserts"] },
  { key: "beverages", label: "Beverages", categoryIds: ["beverages"] },
];

/* ═══════════════════════════════════════════════════════════ */
/* ─── DishList — isolated component so key= forces full remount on tab switch ── */
const DishList = ({ items, sectionKey, usedDishNames, selectedId, onSelect }) => {
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
        const isSelected = !isUsed && selectedId === dish.id;
        return (
          <div
            key={`${sectionKey}__${dish.id}__${idx}`}
            className={`co-dish-row ${isUsed ? "co-dish-row--used" : ""} ${isSelected ? "co-dish-row--selected" : ""}`}
            onClick={!isUsed ? () => onSelect(dish) : undefined}
            {...(isUsed ? { "data-bs-toggle": "tooltip", "data-bs-placement": "top", "data-bs-title": "Already used in another combo offer" } : {})}
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

/* ─── MapSectionNameField — shows label as text with an Edit button;
     clicking Edit turns it into an input for just that section ── */
const MapSectionNameField = ({ label, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) onSave(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(label);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="co-map-name-view">
        <span className="co-map-name-text">{label}</span>
        <button
          type="button"
          className="co-map-name-edit-btn"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          data-bs-title="Rename this category"
          onClick={() => setEditing(true)}
        >
          <img src={editIcon} alt="Edit" />
        </button>
      </div>
    );
  }

  return (
    <div className="co-map-name-edit">
      <input
        ref={inputRef}
        className="co-map-name-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
      />
      <button type="button" className="co-map-name-save-btn" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Save name" onClick={commit}>✓</button>
      <button type="button" className="co-map-name-cancel-btn" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="Cancel" onClick={cancel}>✕</button>
    </div>
  );
};

const ComboOffers = () => {
  /* ── top-level data ── */

  // ── Hooks

  const { venueParam, venueId: activeVenueId } = useVenue();
  const [allCategories, setAllCategories] = useState([]);
  const [sectionConfig, setSectionConfig] = useState(DEFAULT_SECTIONS);
  const [comboSections, setComboSections] = useState({ dishes: [], desserts: [], beverages: [] });
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── offer modal state ── */
  const [modalOpen, setModalOpen] = useState(false);
  const offerModal = useAnimatedModal("comboOffers-addEdit");
  const [editOffer, setEditOffer] = useState(null);
  const [saving, setSaving] = useState(false);

  /* modal fields */
  const [slots, setSlots] = useState(() => Object.fromEntries(DEFAULT_SECTIONS.map(s => [s.key, null])));
  const [activeTab, setActiveTab] = useState(DEFAULT_SECTIONS[0]?.key || "dishes");
  const [discountVal, setDiscountVal] = useState("");
  const [offerType, setOfferType] = useState("PERCENT");
  const [offerLabel, setOfferLabel] = useState("");
  const [selectedListDishId, setSelectedListDishId] = useState(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);
  const [errors, setErrors] = useState({});
  const { toast } = useToast();

  /* ── category-mapping modal state ── */
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const mapModal = useAnimatedModal("comboOffers-categoryMap");
  const [mapDraft, setMapDraft] = useState([]);
  const [mapSaving, setMapSaving] = useState(false);

  /* ── sort ── */
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  // ── Helpers

  const sectionLabel = (key) => sectionConfig.find(s => s.key === key)?.label || key;

  const getActual = (o) =>
    sectionConfig.reduce((sum, s) => sum + (o.condition?.[`${s.key}Price`] || 0), 0);
  const sortedOffers = useMemo(() => {
    if (!sortConfig.key) return offers;
    return [...offers].sort((a, b) => {
      let aVal, bVal;
      if (sortConfig.key === "dishes") { aVal = a.condition?.dishes || ""; bVal = b.condition?.dishes || ""; }
      else if (sortConfig.key === "desserts") { aVal = a.condition?.desserts || ""; bVal = b.condition?.desserts || ""; }
      else if (sortConfig.key === "bev") { aVal = a.condition?.beverages || ""; bVal = b.condition?.beverages || ""; }
      else if (sortConfig.key === "discount") { aVal = a.value; bVal = b.value; }
      else if (sortConfig.key === "actual") { aVal = getActual(a); bVal = getActual(b); }
      else if (sortConfig.key === "final") { aVal = calcFinal(getActual(a), a.type, a.value); bVal = calcFinal(getActual(b), b.type, b.value); }
      if (typeof aVal === "string") return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [offers, sortConfig]);

  /* ── build dish pools from categories + section config, filtered to
     eventField === "yes" (combo/event-eligible dishes) ── */
  const buildComboSections = (categories, sections) => {
    const collectDishes = (catIds) => {
      const items = [];
      categories
        .filter(c => catIds.includes(c.id))
        .forEach(cat => {
          const directDishes = cat.dishes || [];
          const subDishes = (cat.subCategories || []).flatMap(s => s.dishes || []);
          [...directDishes, ...subDishes].forEach(d => {
            if (d.eventField !== "yes") return; // only event/combo-eligible dishes
            items.push({
              id: d.id,
              name: d.name,
              price: d.basePrice ?? d.price ?? 0,
              image: d.image || "",
            });
          });
        });
      return items;
    };
    const map = {};
    sections.forEach(s => { map[s.key] = collectDishes(s.categoryIds); });
    return map;
  };

  /* ── load on mount ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [categoriesRes, offersRes, configRes] = await Promise.all([
          api.get("/categories", { params: venueParam() }),
          api.get("/combo_offers", { params: venueParam() }),
          api.get("/comboSectionConfig", { params: venueParam() }).catch(() => null),
        ]);
        const categories = categoriesRes.data || [];
        const sections = configRes?.data?.sections?.length ? configRes.data.sections : DEFAULT_SECTIONS;

        setAllCategories(categories);
        setSectionConfig(sections);
        setComboSections(buildComboSections(categories, sections));
        setOffers(offersRes.data || []);
      } catch {
        toast.error("Failed to load data", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
    // Re-fetch when the Super Admin switches branches via the venue
    // switcher — this page fetches its own data independently of
    // App.js's shared adminData, so it needs its own venue-change trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVenueId]);

  /* ── open modal (new) ── */
  const openNew = () => {
    setEditOffer(null);
    setSlots(Object.fromEntries(sectionConfig.map(s => [s.key, null])));
    setActiveTab(sectionConfig[0]?.key || "dishes");
    setDiscountVal("");
    setOfferType("PERCENT");
    setOfferLabel("");
    setSelectedListDishId(null);
    setSelectedSlotKey(null);
    setErrors({});
    setModalOpen(true);
    offerModal.open();
  };

  /* ── open modal (edit) ──
     Slots are built per the CURRENT sectionConfig (not a hardcoded
     dishes/desserts/beverages triple) since admins can rename, add,
     or remove sections. For each configured section key, we try to
     resolve the offer's saved dish name against the live
     comboSections pool first (picks up the dish's current price/id/
     image). If that lookup misses — the dish's eventField flipped to
     "no", it was renamed, or moved to a different section — we fall
     back to the name+price the offer itself saved at creation time,
     so the slot still shows the original selection instead of going
     blank. That fallback has no real `id`, so re-selecting a live
     dish into the same slot always overwrites it cleanly. ── */
  const openEdit = (offer) => {
    setEditOffer(offer);

    const nextSlots = {};
    sectionConfig.forEach(s => {
      const key = s.key;
      const savedName = offer.condition?.[key];
      if (!savedName) { nextSlots[key] = null; return; }

      const live = (comboSections[key] || []).find(i => i.name === savedName);
      if (live) {
        nextSlots[key] = live;
      } else {
        const savedPrice = offer.condition?.[`${key}Price`] ?? 0;
        nextSlots[key] = { id: null, name: savedName, price: savedPrice };
      }
    });
    setSlots(nextSlots);

    setActiveTab(sectionConfig[0]?.key || "dishes");
    setOfferType(offer.type || "PERCENT");
    setDiscountVal(String(offer.value || ""));
    setOfferLabel(offer.label || "");
    setSelectedListDishId(null);
    setSelectedSlotKey(null);
    setErrors({});
    setModalOpen(true);
    offerModal.open();
  };

  /* ── pricing ── */
  const filledSlotCount = Object.values(slots).filter(Boolean).length;
  const totalActual = Object.values(slots).reduce((a, d) => a + (d?.price || 0), 0);
  const totalFinal = calcFinal(totalActual, offerType, parseFloat(discountVal));
  const savings = totalActual - totalFinal;
  const autoLabel = () => offerType === "PERCENT" && discountVal ? `${discountVal}% OFF`
    : offerType === "FLAT" && discountVal ? `Flat ₹${discountVal} OFF` : "";

  /* ── validate ──
     Exactly 2 dishes required — any pair of the configured sections. ── */
  const validate = () => {
    const e = {};
    const filled = Object.values(slots).filter(Boolean).length;
    if (filled !== 2)
      e.slots = `Pick exactly 2 dishes — any combination of ${sectionConfig.map(s => s.label).join(", ")}`;
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
    sectionConfig.forEach(s => {
      const key = s.key;
      if (slots[key]) {
        condition[key] = slots[key].name;
        condition[`${key}Price`] = slots[key].price;
      }
    });

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
      offerModal.close(() => setModalOpen(false));
    } catch {
      toast.error("Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ── */
  const handleDelete = (id, label) => {
    toast.confirm(`Delete "${label}"?`, async () => {
      try {
        await api.delete(`/combo_offers/${id}`);
        setOffers(prev => prev.filter(o => o.id !== id));
        toast.success("Offer deleted");
      } catch {
        toast.error("Delete failed", "error");
      }
    });
  };

  /* ── click-to-add / click-to-remove ──
     Offers are strictly 2-dish combos — any pair of the configured
     sections (Dishes+Beverages, Beverages+Desserts, Dishes+Desserts).
     Once 2 slots are filled, adding a 3rd is blocked outright rather
     than allowed and only caught at save time. ── */
  const addSelectedToSlot = () => {
    if (!selectedListDishId) return;
    const filledCount = Object.values(slots).filter(Boolean).length;
    const alreadyFilledInTab = !!slots[activeTab];
    if (filledCount >= 2 && !alreadyFilledInTab) {
      toast.warning("A combo offer can only have 2 dishes. Remove one to add another.");
      return;
    }
    const dish = (comboSections[activeTab] || []).find(d => d.id === selectedListDishId);
    if (!dish) return;
    setSlots(prev => ({ ...prev, [activeTab]: dish }));
    setErrors(prev => { const n = { ...prev }; delete n.slots; return n; });
    setSelectedListDishId(null);
  };

  const removeSelectedFromSlot = () => {
    if (!selectedSlotKey) return;
    setSlots(prev => ({ ...prev, [selectedSlotKey]: null }));
    setSelectedSlotKey(null);
  };

  const clearSlot = (key) => {
    setSlots(prev => ({ ...prev, [key]: null }));
    if (selectedSlotKey === key) setSelectedSlotKey(null);
  };

  /* ── dishes already assigned in OTHER offers (exclude current edit) ── */
  const usedDishNames = React.useMemo(() => {
    const used = new Set();
    offers.forEach(o => {
      if (editOffer && o.id === editOffer.id) return; // skip self when editing
      if (o.condition?.dishes) used.add(o.condition.dishes);
      if (o.condition?.desserts) used.add(o.condition.desserts);
      if (o.condition?.beverages) used.add(o.condition.beverages);
    });
    return used;
  }, [offers, editOffer]);

  /* ── category-mapping modal ── */
  const openMapModal = () => {
    // deep-clone current config so edits are a draft until saved
    setMapDraft(sectionConfig.map(s => ({ ...s, categoryIds: [...s.categoryIds] })));
    setMapModalOpen(true);
    mapModal.open();
  };

  /* which section (if any) currently claims this category — used to block duplicates */
  const mapOwnerOf = (catId) => mapDraft.find(s => s.categoryIds.includes(catId));

  const mapToggleCategory = (sectionKey, catId) => {
    const owner = mapOwnerOf(catId);
    if (owner && owner.key !== sectionKey) {
      toast.error(`"${allCategories.find(c => c.id === catId)?.name || catId}" is already mapped to "${owner.label}". Remove it there first.`, "error");
      return;
    }
    setMapDraft(prev => prev.map(s => {
      if (s.key !== sectionKey) return s;
      const has = s.categoryIds.includes(catId);
      return { ...s, categoryIds: has ? s.categoryIds.filter(c => c !== catId) : [...s.categoryIds, catId] };
    }));
  };

  const mapRenameSection = (sectionKey, newLabel) => {
    setMapDraft(prev => prev.map(s => s.key === sectionKey ? { ...s, label: newLabel } : s));
  };

  /* ── add / remove a combo category (section) — a section is just a
     named bucket of menu categories, so "adding a category" here means
     adding a new empty bucket the admin can then map menu categories
     into via the chip grid above. Every admin-created menu category can
     end up as (or feed into) its own combo section this way, instead of
     being locked to the original Dishes/Desserts/Beverages triple. ── */
  const mapAddSection = () => {
    let n = mapDraft.length + 1;
    let key = `section_${Date.now()}`;
    let label = `New Category ${n}`;
    while (mapDraft.some(s => s.label.toLowerCase() === label.toLowerCase())) {
      n += 1;
      label = `New Category ${n}`;
    }
    setMapDraft(prev => [...prev, { key, label, categoryIds: [] }]);
  };

  const mapRemoveSection = (sectionKey) => {
    if (mapDraft.length <= 1) {
      toast.error("At least one combo category is required.", "error");
      return;
    }
    setMapDraft(prev => prev.filter(s => s.key !== sectionKey));
  };

  const handleSaveMapping = async () => {
    setMapSaving(true);
    try {
      const payload = { id: 1, sections: mapDraft };
      await api.put("/comboSectionConfig/1", payload).catch(() => api.put("/comboSectionConfig", payload));
      setSectionConfig(mapDraft);
      setComboSections(buildComboSections(allCategories, mapDraft));
      setSlots(prevSlots => {
        const next = {};
        mapDraft.forEach(s => { next[s.key] = prevSlots[s.key] || null; });
        return next;
      });
      setActiveTab(mapDraft[0]?.key || "dishes");
      toast.success("Combo categories updated!");
      mapModal.close(() => setMapModalOpen(false));
    } catch {
      toast.error("Failed to save category mapping", "error");
    } finally {
      setMapSaving(false);
    }
  };

  if (loading) return (
    <div className="dishes-page">
      <PageLoader fill label="Loading combo offers…" />
    </div>
  );

  return (
    <div className="inner-page">

      {/* ── header ── */}
      <div className="header">
        <div className="header-title-with-count">
          <h2 className="title">Combo Offers</h2>
          <span className="result-count">{sortedOffers.length} combo(s)</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button3D variant="cancel" onClick={openMapModal}>Manage Categories</Button3D>
          <Button3D onClick={openNew}>+ Add Combo</Button3D>
        </div>
      </div>

      <div className="table-wrapper">
        <table >
          <thead>
            <tr>
              {[
                { label: sectionLabel("dishes"), key: "dishes" },
                { label: sectionLabel("desserts"), key: "desserts" },
                { label: sectionLabel("beverages"), key: "bev" },
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
              <th className="icon-width">Edit</th>
              <th className="icon-width">Delete</th>
            </tr>
          </thead>
          <tbody>
            {offers.length === 0 && (
              <EmptyRow colSpan={8} message='No combo offers yet. Click "+ Add Combo" to create one.' />
            )}
            {sortedOffers.map((o, i) => (
              <tr key={o.id}>
                <td>
                  <span className="">{o.condition?.dishes || "—"}</span>
                </td>
                <td>
                  <span className="">{o.condition?.desserts || "—"}</span>
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
                    const actual = getActual(o);
                    return actual > 0
                      ? <span className="co-actual-price">₹{actual}</span>
                      : <span style={{ color: "#ccc" }}>—</span>;
                  })()}
                </td>
                <td>
                  {(() => {
                    const actual = getActual(o);
                    if (!actual) return <span style={{ color: "#ccc" }}>—</span>;
                    const final = calcFinal(actual, o.type, o.value);
                    return <span className="co-final-price">₹{final}</span>;
                  })()}
                </td>
                <td className="icon-width">
                  <Button3D variant="cancel" iconOnly onClick={() => openEdit(o)}><img src={editIcon} /></Button3D>
                </td>
                <td className="icon-width">
                  <Button3D variant="cancel" iconOnly onClick={() => handleDelete(o.id, o.label)}><img src={deleteIcon} /></Button3D>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ OFFER MODAL ══════════════════════════════════════════ */}
      {offerModal.shouldRender && (
        <div className={`modal-overlay ${offerModal.overlayClass}`}>
          <div className={`admin-modal co-modal-wide ${offerModal.modalClass}`}>

            {/* header */}
            <div className="admin-modal-header">
              <h3>{editOffer ? "Edit Combo Offer" : "Add Combo Offer"}</h3>
              <Button3D variant="cancel" iconOnly onClick={() => offerModal.close(() => setModalOpen(false))}><img src={closeIcon} /></Button3D>
            </div>

            {/* two-column body */}
            <div className="admin-modal-body co-modal-body">

              {/* ── LEFT: category tabs + dish list ── */}
              <div className="co-modal-left">
                <p className="co-section-label">Pick a category</p>
                <div className="dish-category-buttons" style={{ marginBottom: 14 }}>
                  {sectionConfig.map(s => (
                    <button
                      key={s.key}
                      className={`filter-pill ${activeTab === s.key ? "active" : ""}`}
                      onClick={() => { setActiveTab(s.key); setSelectedListDishId(null); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <p className="co-section-label">
                  {filledSlotCount >= 2 && !slots[activeTab]
                    ? "Combo is full (2/2) — remove a dish to add a different one"
                    : <>Select a {sectionLabel(activeTab)} dish, then use → to add it to the {sectionLabel(activeTab)} slot</>}
                </p>

                <DishList
                  key={activeTab}
                  items={comboSections[activeTab] || []}
                  sectionKey={activeTab}
                  usedDishNames={usedDishNames}
                  selectedId={selectedListDishId}
                  onSelect={(dish) => setSelectedListDishId(prev => prev === dish.id ? null : dish.id)}
                />
              </div>

              {/* ── CENTER: add / remove arrows ── */}
              <div className="co-modal-arrows">
                <button
                  type="button"
                  className="co-arrow-btn co-arrow-btn--add"
                  disabled={!selectedListDishId || (filledSlotCount >= 2 && !slots[activeTab])}
                  onClick={addSelectedToSlot}
                >
                  <img src={doubleArrowIcon} alt="Add" className="co-arrow-icon" />
                </button>
                <button
                  type="button"
                  className="co-arrow-btn co-arrow-btn--remove"
                  disabled={!selectedSlotKey}
                  onClick={removeSelectedFromSlot}
                >
                  <img src={doubleArrowIcon} alt="Remove" className="co-arrow-icon co-arrow-icon--flip" />
                </button>
              </div>

              {/* ── RIGHT: slots + pricing ── */}
              <div className="co-modal-right">
                <p className="co-section-label">Selected combo dishes</p>

                {errors.slots && (
                  <div className="co-error-banner">{errors.slots}</div>
                )}

                <div className="co-slots">
                  {sectionConfig.map(s => {
                    const key = s.key;
                    const isFilled = !!slots[key];
                    const isSelected = selectedSlotKey === key;
                    return (
                      <div
                        key={key}
                        className={[
                          "co-slot",
                          isFilled ? "filled" : "",
                          isSelected ? "selected" : "",
                        ].filter(Boolean).join(" ")}
                        onClick={isFilled ? () => setSelectedSlotKey(prev => prev === key ? null : key) : undefined}
                      >
                        <div className="co-slot-header">
                          <span className="co-slot-label">{s.label.toUpperCase()}</span>
                          {isFilled && (
                            <button className="co-slot-clear" onClick={(e) => { e.stopPropagation(); clearSlot(key); }}>✕</button>
                          )}
                        </div>
                        {isFilled ? (
                          <div className="co-slot-dish">
                            <span className="co-slot-dish-name">{slots[key].name}</span>
                            <span className="co-slot-dish-price">₹{slots[key].price}</span>
                          </div>
                        ) : (
                          <div className="co-slot-empty">
                            {`No ${s.label} dish selected`}
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
                    <div className="admin-form-group">
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
                          {offerType === "PERCENT" ? "Discount %" : "Flat Discount ₹"}<span className="rf-req">*</span>
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
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => offerModal.close(() => setModalOpen(false))}>Cancel</Button3D>
              <Button3D onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editOffer ? "Update Offer" : "Create Offer"}
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CATEGORY-MAPPING MODAL ═══════════════════════════════ */}
      {mapModal.shouldRender && (
        <div className={`modal-overlay ${mapModal.overlayClass}`}>
          <div className={`admin-modal co-modal-wide ${mapModal.modalClass}`}>

            {/* header */}
            <div className="admin-modal-header">
              <h3>Manage Combo Categories</h3>
              <Button3D variant="cancel" iconOnly onClick={() => mapModal.close(() => setMapModalOpen(false))}><img src={closeIcon} /></Button3D>
            </div>

            <div className="admin-modal-body co-map-body">
              <p className="co-section-label" style={{ marginBottom: 10 }}>
                Click the edit icon to rename a combo category, and choose which menu categories feed dishes into it.
                A menu category can only belong to one combo category at a time.
              </p>

              <div className="co-map-sections">
                {mapDraft.map(s => (
                  <div className="co-map-section" key={s.key}>
                    <div className="co-map-section-head">
                      <MapSectionNameField
                        label={s.label}
                        onSave={(newLabel) => mapRenameSection(s.key, newLabel)}
                      />
                      <Button3D
                        variant="cancel"
                        iconOnly
                        title="Remove this combo category"
                        onClick={() => mapRemoveSection(s.key)}
                      >
                        <img src={deleteIcon} alt="Remove" />
                      </Button3D>
                    </div>

                    <p className="co-map-hint">Mapped menu categories for "{s.label}"</p>
                    <div className="co-map-chip-grid">
                      {allCategories.map(cat => {
                        const checked = s.categoryIds.includes(cat.id);
                        const owner = mapOwnerOf(cat.id);
                        const takenElsewhere = owner && owner.key !== s.key;
                        return (
                          <button
                            type="button"
                            key={cat.id}
                            className={`co-map-chip ${checked ? "active" : ""} ${takenElsewhere ? "disabled" : ""}`}
                            onClick={() => mapToggleCategory(s.key, cat.id)}
                            {...(takenElsewhere ? { "data-bs-toggle": "tooltip", "data-bs-placement": "top", "data-bs-title": `Already mapped to "${owner.label}"` } : {})}
                          >
                            {cat.name}
                            {takenElsewhere && <span className="co-map-chip-owner"> · {owner.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <Button3D onClick={mapAddSection} className="co-map-add-btn">
                + Add Combo Category
              </Button3D>
            </div>

            {/* footer */}
            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={() => mapModal.close(() => setMapModalOpen(false))}>Cancel</Button3D>
              <Button3D onClick={handleSaveMapping} disabled={mapSaving}>
                {mapSaving ? "Saving…" : "Save Mapping"}
              </Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComboOffers;