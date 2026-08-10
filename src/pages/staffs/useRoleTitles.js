/**
 * useRoleTitles.js — Sam Cafe Admin Panel
 *
 * Single hook every page that renders a "role" dropdown/filter/pill list
 * should use, so adding, renaming, or deleting a role on the Roles and
 * Responsibilities page (GET/POST/PATCH/DELETE /roles) reflects
 * everywhere immediately instead of each page keeping its own hardcoded
 * list. Falls back to a small static list only for the brief window
 * before the fetch resolves, or if it fails outright, so a dropdown is
 * never left empty.
 */
import { useEffect, useState } from "react";
import api from "../../api";

const FALLBACK_TITLES = ["Chef", "Waiter", "Supervisor", "Manager", "Cleaner"];

export default function useRoleTitles() {
  const [titles, setTitles] = useState(FALLBACK_TITLES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/roles")
      .then((res) => {
        if (cancelled) return;
        const list = (res.data || []).map((r) => r.title).filter(Boolean);
        if (list.length > 0) setTitles(list);
      })
      .catch(() => {
        // keep FALLBACK_TITLES on failure
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { roleTitles: titles, isLoadingRoleTitles: isLoading };
}
