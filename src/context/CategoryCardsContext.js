/**
 * CategoryCardsContext — admin-panel state for the Super-Admin-configured
 * "special cards" (My Favourites, Crowd Picks, My Orders, Combos, Offers,
 * Events & Booking) that show at the top of the user-panel Food Category
 * page.
 *
 * Any logged-in admin can read this (GET /categoryCards is open to any
 * admin session, same as Theme) so the Sidebar can hide the Combo/Offers/
 * Events menu entries — and App.js can redirect away from their routes —
 * whenever a Super Admin has disabled the corresponding card. Only Super
 * Admin can write it (enforced server-side; the CategoryCards settings
 * page is also gated client-side via isSuperAdmin).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "./AuthContext";

const CategoryCardsContext = createContext(null);

/** id -> true means "no config saved yet, so it defaults to enabled". */
const isEnabled = (cardsById, id) => cardsById[id] ? cardsById[id].enabled !== false : true;

export function CategoryCardsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cardsById, setCardsById] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const refreshCategoryCards = useCallback(async () => {
    try {
      const res = await api.get("/categoryCards");
      const list = Array.isArray(res.data?.cards) ? res.data.cards : [];
      setCardsById(Object.fromEntries(list.map((c) => [c.id, c])));
      return list;
    } catch {
      setCardsById({});
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCardsById({});
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      await refreshCategoryCards();
      setIsLoading(false);
    })();
  }, [isAuthenticated, refreshCategoryCards]);

  const value = {
    isLoading,
    // Booleans the Sidebar/App routes actually care about — a missing
    // config (fresh install, nothing saved yet) defaults every card to
    // enabled, matching the user panel's own fallback behavior.
    isMyFavouritesEnabled: isEnabled(cardsById, "my"),
    isCrowdPicksEnabled: isEnabled(cardsById, "others"),
    isMyOrdersEnabled: isEnabled(cardsById, "my-orders"),
    isComboEnabled: isEnabled(cardsById, "combo"),
    isOffersEnabled: isEnabled(cardsById, "offers"),
    isEventsEnabled: isEnabled(cardsById, "events"),
    refreshCategoryCards,
  };

  return <CategoryCardsContext.Provider value={value}>{children}</CategoryCardsContext.Provider>;
}

export function useCategoryCards() {
  const ctx = useContext(CategoryCardsContext);
  if (!ctx) throw new Error("useCategoryCards must be used within a CategoryCardsProvider");
  return ctx;
}
