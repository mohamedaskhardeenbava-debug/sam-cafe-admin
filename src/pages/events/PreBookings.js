import React, { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./PreBookings.css";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => new Date().toISOString().split("T")[0];

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

const AddPreBookingModal = ({ onClose, onSaved, toast }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setF = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: "" })); };

  const validate = () => {
    const err = {};
    if (!form.name.trim() || form.name.trim().length < 2) err.name = true;
    const mob = form.mobile.replace(/\D/g, "");
    if (!mob || mob.length !== 10) err.mobile = true;
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = true;
    if (!form.guests || parseInt(form.guests, 10) < 1) err.guests = true;
    if (!form.date) err.date = true;
    if (!form.time) err.time = true;
    return err;
  };

  const handleSave = async () => {
    const ve = validate();
    if (Object.keys(ve).length > 0) { setErrors(ve); return; }
    setSaving(true);
    try {
      const newId = `pre_${Date.now()}`;
      const body = {
        id: newId,
        name: form.name,
        mobile: form.mobile,
        email: form.email || "",
        guests: parseInt(form.guests, 10) || 1,
        date: form.date,
        time: form.time,
        slotGroup: form.slotGroup || "",
        notes: form.notes || "",
        source: form.source || "Phone",
        items: [],
        subtotal: 0,
        discount: 0,
        totalAmount: 0,
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

  return (
    <div className="ingredient-modal-overlay" onClick={onClose}>
      <div className="ingredient-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ingredient-modal-header">
          <h3>Add PreBooking</h3>
          <button className="ingredient-close-btn" onClick={onClose}></button>
        </div>

        <div className="ingredient-modal-body">

          {/* Name + Guests */}
          <div className="evt-pre-modal-row">
            <div className="evt-pre-modal-group">
              <label>Name <span className="evt-pre-req">*</span></label>
              <input
                className={`evt-pre-modal-input${errors.name ? " error" : ""}`}
                placeholder="Guest name"
                value={form.name}
                onChange={e => setF("name", e.target.value)}
              />
            </div>
            <div className="evt-pre-modal-group" style={{ flex: "0 0 130px" }}>
              <label>Guests <span className="evt-pre-req">*</span></label>
              <div className={`evt-pre-modal-stepper${errors.guests ? " error" : ""}`}>
                <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                <span>{form.guests}</span>
                <button type="button" onClick={() => setF("guests", Math.min(50, form.guests + 1))}>+</button>
              </div>
            </div>
          </div>

          {/* Mobile + Email */}
          <div className="evt-pre-modal-row">
            <div className="evt-pre-modal-group">
              <label>Mobile <span className="evt-pre-req">*</span></label>
              <input
                className={`evt-pre-modal-input${errors.mobile ? " error" : ""}`}
                placeholder="10-digit number"
                type="tel"
                value={form.mobile}
                onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </div>
            <div className="evt-pre-modal-group">
              <label>Email <span className="evt-pre-opt">(optional)</span></label>
              <input
                className={`evt-pre-modal-input${errors.email ? " error" : ""}`}
                placeholder="email@example.com"
                type="email"
                value={form.email}
                onChange={e => setF("email", e.target.value)}
              />
            </div>
          </div>

          {/* Slot chips */}
          <div className="evt-pre-modal-group">
            <label>Dining Slot <span className="evt-pre-opt">(optional)</span></label>
            <div className="evt-pre-modal-slots">
              {SLOT_GROUPS.map(sg => (
                <button key={sg.key} type="button"
                  className={`evt-pre-modal-slot-chip${form.slotGroup === sg.key ? " active" : ""}`}
                  onClick={() => { const next = form.slotGroup === sg.key ? "" : sg.key; setF("slotGroup", next); setF("time", ""); }}>
                  {sg.label}
                  <span className="evt-pre-modal-slot-time">{sg.start}–{sg.end}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time */}
          <div className="evt-pre-modal-row">
            <div className="evt-pre-modal-group">
              <label>Date <span className="evt-pre-req">*</span></label>
              <CustomDatePicker
                value={form.date}
                min={todayStr()}
                onChange={v => setF("date", v)}
                hasError={!!errors.date}
              />
            </div>
            <div className="evt-pre-modal-group">
              <label>
                Time <span className="evt-pre-req">*</span>
                {!form.slotGroup && <span className="evt-pre-opt"> (select slot first)</span>}
              </label>
              <CustomTimePicker
                value={form.time}
                onChange={v => setF("time", v)}
                slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                disabled={!form.slotGroup}
              />
            </div>
          </div>

          {/* Source */}
          <div className="evt-pre-modal-group">
            <label>Source</label>
            <div className="evt-pre-modal-source-row">
              {SOURCE_OPTIONS.map(s => (
                <button key={s} type="button"
                  className={`evt-pre-modal-source-btn${form.source === s ? " active" : ""}`}
                  onClick={() => setF("source", s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="evt-pre-modal-group">
            <label>Notes <span className="evt-pre-opt">(optional)</span></label>
            <textarea
              className="evt-pre-modal-textarea"
              rows={2}
              placeholder="Special requests..."
              value={form.notes}
              onChange={e => setF("notes", e.target.value)}
            />
          </div>

        </div>

        {/* Footer */}
        <div className="ingredient-modal-footer form-actions">
          <button type="button" onClick={handleSave} disabled={saving}>
            Add PreBooking
          </button>
          <button type="button" onClick={onClose}>Cancel</button>

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

  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterSlots, setFilterSlots] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [callHistory, setCallHistory] = useState({});
  const [callTooltipId, setCallTooltipId] = useState(null);
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
    if (filterDate) d = d.filter(r => r.date === filterDate);
    if (filterSlots.size > 0) d = d.filter(r => { const k = resolveSlotKey(r); return k && filterSlots.has(k); });
    if (filterStatuses.size > 0) d = d.filter(r => filterStatuses.has(r.status || "scheduled"));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(r => (r.name || "").toLowerCase().includes(q) || (r.mobile || "").includes(q) || (r.id || "").toLowerCase().includes(q));
    }
    return d;
  }, [data, filterDate, filterSlots, filterStatuses, search]);

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

  /* KPIs */
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

  /* call logging */
  const handleCall = (e, id) => {
    e.stopPropagation();
    setCallHistory(prev => ({ ...prev, [id]: [...(prev[id] || []), new Date().toISOString()] }));
    toast.success("Call logged!");
  };

  /* modal saved callback */
  const handleModalSaved = (newRecord) => {
    if (typeof setAdminData === "function") {
      setAdminData(p => ({ ...p, preBookings: [newRecord, ...(p.preBookings || [])] }));
    }
  };

  const activeFilters = filterDate || filterSlots.size > 0 || filterStatuses.size > 0 || search.trim();

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
        <button className="evt-pre-add-btn" onClick={() => setShowAddModal(true)}>
          + Add PreBooking
        </button>
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
          <div className="evt-pre-filter-group">
            <span className="evt-pre-filter-group-label">Date</span>
            <div style={{ minWidth: 155 }}>
              <CustomDatePicker value={filterDate} onChange={setFilterDate} placeholder="All dates" />
            </div>
            {filterDate && (
              <button className="evt-pre-filter-btn" onClick={() => setFilterDate("")} title="Clear date">✕</button>
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
            <button className="evt-pre-clear-all" onClick={() => { setSearch(""); setFilterDate(todayStr()); setFilterSlots(new Set()); setFilterStatuses(new Set()); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="evt-pre-table-wrapper">
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
              sortedData.map(item => {
                const status = item.status || "scheduled";
                const slotKey = resolveSlotKey(item);
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";
                const history = callHistory[item.id] || [];

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
                        onMouseEnter={() => history.length > 0 && setCallTooltipId(item.id)}
                        onMouseLeave={() => setCallTooltipId(null)}>
                        <button className="evt-pre-act-btn" onClick={e => handleCall(e, item.id)}>
                          📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                        </button>
                        {callTooltipId === item.id && history.length > 0 && (
                          <div className="evt-pre-call-tooltip">
                            <div className="evt-pre-call-tooltip-title">📞 Call History</div>
                            {history.map((ts, i) => (
                              <div key={i} className="evt-pre-call-tooltip-row">{fmtDateTime(ts)}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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