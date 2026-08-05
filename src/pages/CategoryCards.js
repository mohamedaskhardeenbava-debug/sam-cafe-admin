/**
 * CategoryCards.js  —  Sam Cafe Admin Panel
 * Controls the "special cards" row at the top of the user-panel Food
 * Category page (My Favourites, Crowd Picks, My Orders, Combos,
 * Offers, Events & Booking) — Super Admin only.
 *
 * A Super Admin can rename each card, replace its image, and — from
 * inside the edit modal, behind a confirmation step — enable or
 * disable it. Disabling a card is a front-end-only change: the card
 * (and, for My Favourites / Crowd Picks, the wishlist button on the
 * dish page; for Combos / Offers / Events & Booking, the
 * corresponding module in both panels) is hidden from view, but the
 * underlying data is never touched — re-enabling brings everything
 * straight back.
 *
 * Stored as a single global config document (GET/PUT /categoryCards),
 * same singleton shape as Theme Settings.
 */

import React, { useState, useEffect } from "react";

import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import PageLoader from "../components/PageLoader";
import { allowTextInput } from "../App";

import "../Common.css"; // shared page shell (.inner-page/.header/.table-wrapper) — Offers.css depends on this
import "./Offers.css"; // reuses the shared admin list/modal + status-badge styling
import "./ModalCSS.css"; // shared modal shell + form-field styling (.modal-overlay/.admin-modal/.mat)
import "./staffs/StaffModules.css"; // shared file-upload styling (.file-wrap/.file-input/.file-label)
import "./Permissions.css"; // shared confirmation-overlay styling (.perm-confirm-*)

/**
 * DEFAULT_CARDS — the card set as it exists today, before any Super
 * Admin customization. Mirrors the hardcoded entries the user panel
 * (FoodCategory.js) used to render unconditionally. `hideWhenGuest`
 * cards (My Favourites) only ever show for logged-in customers
 * regardless of this config; that logic stays in the user panel.
 */
const DEFAULT_CARDS = [
  { id: "my", name: "My Favourites", image: "/assets/category-assets/pizza.png", enabled: true },
  { id: "others", name: "Crowd Picks", image: "/assets/category-assets/crowd.png", enabled: true },
  { id: "my-orders", name: "My Orders", image: "/assets/category-assets/offers.png", enabled: true },
  { id: "combo", name: "Combos", image: "/assets/category-assets/combo.png", enabled: true },
  { id: "offers", name: "Offers", image: "/assets/category-assets/offers.png", enabled: true },
  { id: "events", name: "Events & Booking", image: "/assets/category-assets/events.png", enabled: true },
];

/**
 * Default card images (DEFAULT_CARDS below) point at paths under the
 * *user panel's* public/assets folder — that's where the user panel's
 * original hardcoded card icons lived, and the user panel can resolve
 * them fine since it's served from that same origin. The admin panel
 * is a separate app/origin with no such folder, so those same paths
 * 404 here. Real card images (anything a Super Admin actually uploads
 * via the edit modal) are stored as base64 data URLs, like every other
 * image field in this app, and always display correctly regardless of
 * origin — this only affects a card that still has its original,
 * never-customized default path.
 */
const isBuiltInDefaultPath = (src) => typeof src === "string" && src.startsWith("/assets/category-assets/");

/** Small inline placeholder — no origin dependency, so it always renders. */
const ImageFallback = ({ label }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f1f1f1",
      color: "#aaa",
      fontSize: 18,
    }}
    title={label}
  >
    🖼️
  </div>
);

/**
 * CardImage — renders a card's image, falling back to a placeholder if
 * it 404s (covers the built-in default paths above) instead of showing
 * a broken-image icon.
 */
const CardImage = ({ src, alt }) => {
  const [failed, setFailed] = useState(isBuiltInDefaultPath(src));
  useEffect(() => setFailed(isBuiltInDefaultPath(src)), [src]);
  if (failed || !src) return <ImageFallback label="No image uploaded yet — edit this card to add one" />;
  return <img src={src} alt={alt} onError={() => setFailed(true)} />;
};

const CategoryCards = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();

  const [cards, setCards] = useState(DEFAULT_CARDS);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // card id currently open in the edit modal
  const [form, setForm] = useState({ name: "", image: "", enabled: true });
  // Pending enable/disable awaiting confirmation via the overlay, rather
  // than applying instantly — same pattern as the Permissions page.
  const [pendingToggle, setPendingToggle] = useState(null); // { cardId, cardName, nextValue }

  const load = async () => {
    try {
      const res = await api.get("/categoryCards");
      const saved = res.data?.cards;
      if (Array.isArray(saved) && saved.length) {
        // Merge saved overrides onto the default set so a card added to
        // DEFAULT_CARDS after a Super Admin's last save still shows up.
        const byId = Object.fromEntries(saved.map((c) => [c.id, c]));
        setCards(DEFAULT_CARDS.map((d) => ({ ...d, ...byId[d.id] })));
      } else {
        setCards(DEFAULT_CARDS);
      }
    } catch (err) {
      console.error("Failed to load category cards:", err);
      toast.error("Failed to load category cards");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (nextCards) => {
    setSaving(true);
    try {
      await api.put("/categoryCards", { cards: nextCards });
      setCards(nextCards);
      toast.success("Category cards updated.");
    } catch (err) {
      console.error("Failed to save category cards:", err);
      toast.error(err.response?.data?.error || "Failed to save category cards");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (card) => {
    setEditingId(card.id);
    setForm({ name: card.name, image: card.image, enabled: card.enabled !== false });
  };

  const closeEditModal = () => {
    setEditingId(null);
    setForm({ name: "", image: "", enabled: true });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setForm((prev) => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = () => {
    if (!form.name.trim() || !form.image) return;
    const next = cards.map((c) =>
      c.id === editingId ? { ...c, name: form.name.trim(), image: form.image, enabled: form.enabled } : c
    );
    persist(next);
    closeEditModal();
  };

  // Yes/No buttons live inside the edit modal; clicking either one
  // doesn't apply immediately — it opens the confirmation overlay
  // first, same interaction as the Permissions page's toggles.
  const requestToggle = (nextValue) => {
    const card = cards.find((c) => c.id === editingId);
    if (!card) return;
    setPendingToggle({ cardId: editingId, cardName: form.name || card.name, nextValue });
  };

  const confirmToggle = () => {
    if (!pendingToggle) return;
    setForm((prev) => ({ ...prev, enabled: pendingToggle.nextValue }));
    setPendingToggle(null);
  };

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can manage category cards.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading category cards…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Category Cards</h2>
              <span className="result-count">{cards.length} card(s)</span>
            </div>
          </div>
        </div>
      </div>

      <p style={{ padding: "0 4px 16px", color: "#777", fontSize: 14 }}>
        These are the special cards shown at the top of the customer-facing Food
        Category page. Disabling a card hides it from the user panel — its
        underlying data (favourites, combos, offers, events) is kept untouched
        and reappears as soon as it's re-enabled. Disabling My Favourites or
        Crowd Picks also hides the wishlist (♥) button on dish pages. Disabling
        Combos, Offers, or Events &amp; Booking hides those sections in the
        admin panel too.
      </p>

      <div className="table-wrapper" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <table>
          <thead>
            <tr>
              <th className="icon-width">Image</th>
              <th>Card Name</th>
              <th>Card Key</th>
              <th>Status</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td className="icon-width">
                  <div className="table-image">
                    <CardImage src={card.image} alt="" />
                  </div>
                </td>
                <td>
                  <strong>{card.name}</strong>
                </td>
                <td style={{ color: "#999" }}>{card.id}</td>
                <td>
                  <span className={`offer-status-badge ${card.enabled ? "offer-active" : "offer-inactive"}`}>
                    {card.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td>
                  <Button3D onClick={() => openEditModal(card)}>Edit</Button3D>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {editingId && (
        <div className="modal-overlay">
          <form
            className="admin-modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit();
            }}
          >
            <div className="admin-modal-header">
              <h3>Edit Card</h3>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: allowTextInput(prev.name, e.target.value, 40, 2) }))
                    }
                  />
                  <label className="mat-label">
                    Card Name<span className="rf-req">*</span>
                  </label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="file-wrap">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="file-input" />
                <div className="file-label">
                  {form.image && !isBuiltInDefaultPath(form.image) ? "✔ Image selected" : "Choose Card Image"}
                </div>
              </div>
              {form.image && (
                isBuiltInDefaultPath(form.image) ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <div className="table-image" style={{ width: 48, height: 48 }}>
                      <ImageFallback label="Default image — not viewable from the admin panel" />
                    </div>
                    <span style={{ fontSize: 13, color: "#888" }}>
                      This card is still using its original default image, which only the user panel can
                      display. Upload an image above to set one that shows correctly here too.
                    </span>
                  </div>
                ) : (
                  <img src={form.image} alt="Preview" className="staff-image-preview" />
                )
              )}

              <div className="admin-form-group" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Visible on the user panel</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button3D
                      type="button"
                      variant={form.enabled ? undefined : "cancel"}
                      onClick={() => !form.enabled && requestToggle(true)}
                    >
                      Yes
                    </Button3D>
                    <Button3D
                      type="button"
                      variant={!form.enabled ? undefined : "cancel"}
                      onClick={() => form.enabled && requestToggle(false)}
                    >
                      No
                    </Button3D>
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeEditModal}>
                Cancel
              </Button3D>
              <Button3D type="submit" disabled={saving}>
                Save Changes
              </Button3D>
            </div>
          </form>
        </div>
      )}

      {pendingToggle && (
        <div className="perm-confirm-overlay" onClick={() => setPendingToggle(null)}>
          <div className="perm-confirm-card" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm card visibility change</h4>
            <p>
              {pendingToggle.nextValue ? "Enable" : "Disable"} the{" "}
              <strong>{pendingToggle.cardName}</strong> card on the user panel?
              {!pendingToggle.nextValue && (
                <>
                  {" "}Its data won't be deleted — it'll reappear as soon as you re-enable it.
                </>
              )}
            </p>
            <div className="perm-confirm-actions">
              <Button3D variant="cancel" onClick={() => setPendingToggle(null)}>
                Cancel
              </Button3D>
              <Button3D onClick={confirmToggle}>Confirm</Button3D>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryCards;
