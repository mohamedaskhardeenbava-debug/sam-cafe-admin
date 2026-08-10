/**
 * AuthContext — Phase-4 role-based auth state for the admin panel.
 *
 * On mount, calls GET /staff-auth/me. The server checks the httpOnly
 * session cookie against the `sessions` collection in Mongo — if it's
 * still valid, the admin comes back logged in with no re-entry of
 * credentials required. That's what makes login survive a page reload
 * (or the tab being closed and reopened) instead of resetting on every
 * refresh like the old `useState(true)` stub did.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

// Role hierarchy — mirrors auth.js ROLE_TREE on the backend.
export const ROLE_TREE = {
  Supervisor: ["Sous Chef", "Captain"],
  Manager: ["Service Manager", "Chef"],
  "Super Admin": ["General Manager", "Proprietor"],
};
const ROLE_RANK = { Supervisor: 1, Manager: 2, "Super Admin": 3 };

// Mirrors auth.js CREATABLE_TITLES on the backend — who can create/delete
// a login account for whom, from the Staffs page. Super Admin bypasses
// this (can create/delete any role) and isn't listed as a key.
export const CREATABLE_TITLES = {
  Chef: ["Sous Chef"],
  "Service Manager": ["Captain", "Sous Chef"],
  Captain: ["Sous Chef", "Captain"],
};

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true until /me resolves once
  // Permission matrix rows for the logged-in admin's own roleTitle only —
  // fetched once per session so the sidebar/pages can gate UI without a
  // round-trip per module. Super Admin never needs this (always allowed).
  const [permissions, setPermissions] = useState(null); // { [module]: { canRead, canWrite } }

  const refreshSession = useCallback(async () => {
    try {
      const res = await api.get("/staff-auth/me");
      setAdmin(res.data.admin);
      if (res.data.admin?.roleGroup !== "Super Admin") {
        try {
          const permRes = await api.get("/staff-auth/my-permissions");
          setPermissions(permRes.data || {});
        } catch {
          setPermissions({});
        }
      } else {
        setPermissions(null);
      }
      return res.data.admin;
    } catch {
      setAdmin(null);
      setPermissions(null);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refreshSession();
      setIsLoading(false);
    })();
  }, [refreshSession]);

  // Super Admin sees the full matrix editor elsewhere; everyone else just
  // needs their own row set for UI gating (sidebar, buttons). The
  // /permissions endpoint itself is Super-Admin-only, so non-Super-Admin
  // roles derive their allowed modules from a 403-tolerant per-module
  // check instead — see hasModulePermission below, which asks the server
  // lazily rather than requiring a client-side copy of the whole matrix.
  const isSuperAdmin = admin?.roleGroup === "Super Admin";

  const hasModulePermission = useCallback(
    (moduleName, action = "read") => {
      if (!admin) return false;
      if (isSuperAdmin) return true;
      if (!permissions) return false; // not loaded yet — fail closed until it is
      const row = permissions[moduleName];
      if (!row) return false;
      return action === "write" ? !!row.canWrite : !!row.canRead;
    },
    [admin, isSuperAdmin, permissions]
  );

  const loadPermissionsFor = async (adminDoc) => {
    if (!adminDoc || adminDoc.roleGroup === "Super Admin") {
      setPermissions(null);
      return;
    }
    try {
      const permRes = await api.get("/staff-auth/my-permissions");
      setPermissions(permRes.data || {});
    } catch {
      setPermissions({});
    }
  };

  const login = async (email, password) => {
    const res = await api.post("/staff-auth/login", { email, password });
    setAdmin(res.data.admin);
    await loadPermissionsFor(res.data.admin);
    return res.data.admin;
  };

  const logout = async () => {
    try {
      await api.post("/staff-auth/logout");
    } finally {
      setAdmin(null);
      setPermissions(null);
    }
  };

  const updateProfile = async (payload) => {
    const res = await api.patch("/staff-auth/me", payload);
    setAdmin(res.data.admin);
    return res.data.admin;
  };

  const hasMinRank = (minGroup) =>
    !!admin && (ROLE_RANK[admin.roleGroup] || 0) >= (ROLE_RANK[minGroup] || 0);

  const hasRole = (...groups) => !!admin && groups.includes(admin.roleGroup);

  // Which roleTitles the logged-in admin is allowed to create/delete
  // login accounts for, on the Staffs page. Super Admin can create any
  // valid roleTitle (resolved by the caller from ROLE_TREE); everyone
  // else gets their fixed slice of CREATABLE_TITLES, or none at all.
  const creatableRoleTitles = isSuperAdmin
    ? Object.values(ROLE_TREE).flat()
    : CREATABLE_TITLES[admin?.roleTitle] || [];
  const canManageStaffAccounts = isSuperAdmin || creatableRoleTitles.length > 0;

  const value = {
    admin,
    isAuthenticated: !!admin,
    isLoading,
    login,
    logout,
    updateProfile,
    refreshSession,
    hasMinRank,
    hasRole,
    isSuperAdmin,
    hasModulePermission,
    setPermissions,
    creatableRoleTitles,
    canManageStaffAccounts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
