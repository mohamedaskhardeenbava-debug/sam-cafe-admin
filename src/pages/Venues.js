/**
 * Venues.js  —  Sam Cafe Admin Panel
 * Venue (branch) management — Super Admin only.
 *
 * A venue is a physical branch: name, address, and a generalized
 * location/area. Every other module (staff, KMS, SMS, orders,
 * bookings, etc.) is scoped to a venue on the backend — this page is
 * where Super Admin creates and edits those branches.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useVenue } from "../context/VenueContext";
import { useToast } from "../useToast";
import Button3D from "../components/Button3D";
import ConfirmDialog from "../components/ConfirmDialog";
import CollapseChevron from "../components/CollapseChevron";
import PageLoader from "../components/PageLoader";
import closeIcon from "../icon/close-icon.png";
import { EmptyRow, allowTextInput } from "../App";

import "./Offers.css"; // reuses the shared admin list/modal styling
import "./Venues.css"; // main-branch badge

const EMPTY_VENUE = { name: "", address: "", area: "" };

const Venues = () => {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const { refreshVenues } = useVenue();
  const navigate = useNavigate();

  const [venues, setVenues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_VENUE);
  const [formErrors, setFormErrors] = useState({});
  const [staffCounts, setStaffCounts] = useState({}); // venueId -> count, for the delete-guard hint

  const loadVenues = async () => {
    try {
      const res = await api.get("/venues");
      setVenues(res.data || []);
    } catch (err) {
      console.error("Failed to load venues:", err);
      toast.error("Failed to load venues");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStaffCounts = async () => {
    try {
      const res = await api.get("/staff-auth/admins");
      const counts = {};
      for (const a of res.data || []) {
        if (!a.venueId) continue;
        counts[a.venueId] = (counts[a.venueId] || 0) + 1;
      }
      setStaffCounts(counts);
    } catch {
      // Non-fatal — just skip the "N staff" hint if this fails.
    }
  };

  useEffect(() => {
    loadVenues();
    loadStaffCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredVenues = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return venues;
    return venues.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q) ||
        v.area?.toLowerCase().includes(q)
    );
  }, [venues, search]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_VENUE);
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (venue) => {
    setEditingId(venue.id);
    setForm({ name: venue.name, address: venue.address, area: venue.area });
    setFormErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.address.trim()) errs.address = true;
    if (!form.area.trim()) errs.area = true;
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (editingId) {
        const res = await api.patch(`/venues/${editingId}`, form);
        setVenues((prev) => prev.map((v) => (v.id === editingId ? res.data : v)));
        toast.success("Venue updated successfully.");
      } else {
        const res = await api.post("/venues", form);
        setVenues((prev) => [...prev, res.data]);
        toast.success("Venue added successfully.");
      }
      await refreshVenues(); // keep the switcher/context in sync
      setShowModal(false);
      setForm(EMPTY_VENUE);
      setEditingId(null);
    } catch (err) {
      console.error("Failed to save venue:", err);
      toast.error(err.response?.data?.error || "Failed to save venue");
    }
  };

  const handleToggleStatus = async (venue) => {
    try {
      const nextStatus = venue.status === "active" ? "inactive" : "active";
      const res = await api.patch(`/venues/${venue.id}`, { status: nextStatus });
      setVenues((prev) => prev.map((v) => (v.id === venue.id ? res.data : v)));
      toast.success(`Venue marked ${nextStatus}.`);
    } catch (err) {
      toast.error("Failed to update venue status");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [setMainTarget, setSetMainTarget] = useState(null);

  const handleDelete = (venue) => setDeleteTarget(venue);

  const confirmDelete = async () => {
    const venue = deleteTarget;
    if (!venue) return;
    setDeleteTarget(null);
    try {
      await api.delete(`/venues/${venue.id}`);
      setVenues((prev) => prev.filter((v) => v.id !== venue.id));
      await refreshVenues();
      toast.success("Venue deleted.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete venue");
    }
  };

  const mainBranch = useMemo(() => venues.find((v) => v.isMainBranch) || null, [venues]);

  // Display name per the spec: the main branch shows its own name only;
  // every other branch shows "<Branch Name> (<Main Branch Name>)" with
  // the parenthetical part rendered at lower opacity via a wrapping span.
  const displayName = (venue) => {
    if (venue.isMainBranch || !mainBranch || mainBranch.id === venue.id) return venue.name;
    return { primary: venue.name, suffix: mainBranch.name };
  };

  const handleSetMain = (venue) => {
    if (venue.isMainBranch) return;
    setSetMainTarget(venue);
  };

  const confirmSetMain = async () => {
    const venue = setMainTarget;
    if (!venue) return;
    setSetMainTarget(null);
    try {
      const res = await api.patch(`/venues/${venue.id}/set-main`);
      setVenues(res.data || []);
      toast.success(`${venue.name} is now the main branch.`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to set main branch");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="inner-page">
        <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
          Only Super Admin can manage venues.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="inner-page">
        <PageLoader fill label="Loading venues…" />
      </div>
    );
  }

  return (
    <div className="inner-page">
      {/* HEADER */}
      <div className="header">
        <div className="header-title-row">
          <div className="header-collapse-col">
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setHeaderCollapsed((prev) => !prev)}
              title={headerCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!headerCollapsed}
            >
              <CollapseChevron collapsed={headerCollapsed} />
            </button>
          </div>
          <div className="header-title-col">
            <div className="header-title-with-count">
              <h2 className="title">Venues</h2>
              <span className="result-count">{filteredVenues.length} venue(s)</span>
            </div>
          </div>
        </div>

        <div className="header-btn-container">
          <Button3D onClick={openCreateModal}>+ Add Venue</Button3D>
        </div>
      </div>

      {/* FILTER BAR */}
      {!headerCollapsed && (
        <div className="filter-bar">
          <div className="filter-groups">
            <input
              className="search-input"
              placeholder=" Search name, address, or area…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ae-clear-filter" onClick={() => setSearch("")}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="table-wrapper"
      >
        <table>
          <thead>
            <tr>
              <th>Branch Name</th>
              <th>Address</th>
              <th>Area</th>
              <th>Staff</th>
              <th>Status</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVenues.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message={venues.length === 0 ? "No venues yet — add your first branch." : "No venues match your search"}
              />
            ) : (
              filteredVenues.map((v) => {
                const dn = displayName(v);
                return (
                <tr key={v.id}>
                  <td>
                    <strong>
                      {typeof dn === "string" ? (
                        dn
                      ) : (
                        <>
                          {dn.primary}{" "}
                          <span style={{ opacity: 0.45, fontWeight: 500 }}>({dn.suffix})</span>
                        </>
                      )}
                    </strong>
                    {v.isMainBranch && <span className="venue-main-badge">Main Branch</span>}
                  </td>
                  <td>{v.address}</td>
                  <td>{v.area}</td>
                  <td>
                    <span
                      className="venue-staff-count-link"
                      style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
                      onClick={() => navigate("/staffs", { state: { venueId: v.id } })}
                      title={`View staff at ${v.name}`}
                    >
                      {staffCounts[v.id] || 0}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`offer-status-badge ${v.status === "active" ? "offer-active" : "offer-inactive"}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleToggleStatus(v)}
                      title="Click to toggle status"
                    >
                      {v.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button3D onClick={() => openEditModal(v)}>Edit</Button3D>
                      <Button3D variant="cancel" onClick={() => handleDelete(v)}>
                        Delete
                      </Button3D>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <form
            className="admin-modal"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="admin-modal-header">
              <h3>{editingId ? "Edit Venue" : "Add Venue"}</h3>
              <Button3D
                variant="cancel"
                iconOnly
                onClick={() => {
                  setShowModal(false);
                  setFormErrors({});
                }}
              >
                <img src={closeIcon} alt="Close" />
              </Button3D>
            </div>

            <div className="admin-modal-body">
              <div className={`admin-form-group${formErrors.name ? " mat-select-error" : ""}`}>
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.name ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: allowTextInput(form.name, e.target.value, 100, 5) });
                      setFormErrors((p) => ({ ...p, name: false }));
                    }}
                  />
                  <label className={`mat-label${formErrors.name ? " mat-label-error" : ""}`}>
                    Branch Name<span className="rf-req">*</span>
                  </label>
                  <span className={`mat-bar${formErrors.name ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className={`admin-form-group${formErrors.address ? " mat-select-error" : ""}`}>
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.address ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.address}
                    onChange={(e) => {
                      setForm({ ...form, address: allowTextInput(form.address, e.target.value, 100, 5) });
                      setFormErrors((p) => ({ ...p, address: false }));
                    }}
                  />
                  <label className={`mat-label${formErrors.address ? " mat-label-error" : ""}`}>
                    Branch Address<span className="rf-req">*</span>
                  </label>
                  <span className={`mat-bar${formErrors.address ? " mat-bar-error" : ""}`} />
                </div>
              </div>

              <div className={`admin-form-group${formErrors.area ? " mat-select-error" : ""}`}>
                <div className="mat">
                  <input
                    className={`mat-input${formErrors.area ? " mat-error" : ""}`}
                    placeholder=" "
                    value={form.area}
                    onChange={(e) => {
                      setForm({ ...form, area: allowTextInput(form.area, e.target.value, 100, 5) });
                      setFormErrors((p) => ({ ...p, area: false }));
                    }}
                  />
                  <label className={`mat-label${formErrors.area ? " mat-label-error" : ""}`}>
                    Branch Area (generalized location)<span className="rf-req">*</span>
                  </label>
                  <span className={`mat-bar${formErrors.area ? " mat-bar-error" : ""}`} />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              {editingId && !venues.find((v) => v.id === editingId)?.isMainBranch && (
                <Button3D
                  type="button"
                  onClick={() => handleSetMain(venues.find((v) => v.id === editingId))}
                >
                  Set as Main
                </Button3D>
              )}
              <Button3D
                variant="cancel"
                onClick={() => {
                  setShowModal(false);
                  setFormErrors({});
                }}
              >
                Cancel
              </Button3D>
              <Button3D type="submit">{editingId ? "Save Changes" : "Add Venue"}</Button3D>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete venue"
        message={<>Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</>}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={!!setMainTarget}
        title="Set main branch"
        message={<>Set <strong>{setMainTarget?.name}</strong> as the main branch? Every other branch will be shown relative to it.</>}
        confirmLabel="Set as Main"
        onCancel={() => setSetMainTarget(null)}
        onConfirm={confirmSetMain}
      />
    </div>
  );
};

export default Venues;
