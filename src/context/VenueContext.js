/**
 * VenueContext — Phase-4 multi-venue (branch) state for the admin panel.
 *
 * Every non-Super-Admin admin is pinned to their own venue on the
 * backend regardless of what the frontend sends, so for them this
 * context is mostly informational (their venue name/address for
 * display). For Super Admin, `selectedVenueId` drives a venue
 * switcher: there is no "all venues" choice — exactly one real venue
 * is always selected, defaulting to the first venue in the list.
 *
 * `venueId` is the single source of truth other parts of the app use
 * when building requests: it's the admin's own venueId for everyone
 * except Super Admin, where it mirrors selectedVenueId.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "./AuthContext";
import { setVenueStoreState } from "../venueStore";

const VenueContext = createContext(null);

const SELECTED_VENUE_STORAGE_KEY = "samcafe_selected_venue";

export function VenueProvider({ children }) {
  const { admin, isAuthenticated } = useAuth();
  const [venues, setVenues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // Super Admin only — persisted so the switcher choice survives a
  // reload. Falls back to the first real venue once venues load (see
  // the effect below) — there is no "all venues" state anymore.
  const [selectedVenueId, setSelectedVenueIdState] = useState(
    () => localStorage.getItem(SELECTED_VENUE_STORAGE_KEY) || null
  );

  const setSelectedVenueId = useCallback((id) => {
    setSelectedVenueIdState(id);
    if (id) localStorage.setItem(SELECTED_VENUE_STORAGE_KEY, id);
    else localStorage.removeItem(SELECTED_VENUE_STORAGE_KEY);
  }, []);

  const refreshVenues = useCallback(async () => {
    try {
      const res = await api.get("/venues");
      setVenues(res.data || []);
      return res.data;
    } catch {
      setVenues([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setVenues([]);
      setIsLoading(false);
      return;
    }
    (async () => {
      setIsLoading(true);
      await refreshVenues();
      setIsLoading(false);
    })();
  }, [isAuthenticated, refreshVenues]);

  // Super Admin no longer has an "all venues" choice — once venues have
  // loaded, make sure exactly one real venue is always selected: fall
  // back to the first venue if nothing is selected yet, or if the
  // persisted selection no longer refers to a real venue (e.g. it was
  // deleted).
  useEffect(() => {
    if (isLoading || venues.length === 0) return;
    const stillValid = venues.some((v) => v.id === selectedVenueId);
    if (!stillValid) {
      setSelectedVenueId(venues[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, venues]);

  const isSuperAdmin = admin?.roleGroup === "Super Admin";

  // The venueId every non-admin-management request should carry:
  //  - Super Admin: their switcher choice (always a real venue, once loaded)
  //  - everyone else: their own pinned venue (server enforces this too)
  const venueId = isSuperAdmin ? selectedVenueId : admin?.venueId || null;

  const currentVenue = useMemo(
    () => venues.find((v) => v.id === venueId) || null,
    [venues, venueId]
  );

  // Helper for building query params on GET requests: returns {} only
  // during the brief window before venues have loaded and the default
  // selection effect has run; once loaded, Super Admin always has a
  // real venueId selected.
  const venueParam = useCallback(
    () => (isSuperAdmin && venueId ? { venueId } : {}),
    [isSuperAdmin, venueId]
  );

  // Keep the non-React store (read by api.js's request interceptor) in
  // sync on every render where venueId/role actually changed, so every
  // write call anywhere in the app automatically carries the right
  // venueId without each page needing to pass it explicitly.
  useEffect(() => {
    setVenueStoreState({ venueId, isSuperAdmin });
  }, [venueId, isSuperAdmin]);

  const value = {
    venues,
    isLoading,
    isSuperAdmin,
    selectedVenueId,
    setSelectedVenueId,
    venueId,
    currentVenue,
    venueParam,
    refreshVenues,
  };

  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

export function useVenue() {
  const ctx = useContext(VenueContext);
  if (!ctx) throw new Error("useVenue must be used within a VenueProvider");
  return ctx;
}
