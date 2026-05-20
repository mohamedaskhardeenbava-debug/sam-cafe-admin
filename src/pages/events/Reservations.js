import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./Reservations.css";
import "./PreviewModal.css";
import { useToast } from "../../useToast";
import { CustomTimePicker } from "../../components/CustomTimePicker";
import { CustomDatePicker } from "../../components/CustomDatePicker";
import useInfiniteScroll from "../../components/useInfiniteScroll";
import InfiniteScrollLoader from "../../components/InfiniteScrollLoader";
/* admin panel */

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

/* ─── All 5 slot groups (matches ReservationForm.js) ─── */
const SLOT_GROUPS = [
  { label: "Breakfast", key: "BF", short: "BF", start: "07:00", end: "10:00" },
  { label: "Brunch", key: "BR", short: "Br", start: "10:00", end: "12:00" },
  { label: "Lunch", key: "LU", short: "Lu", start: "12:00", end: "15:00" },
  { label: "Hi-Tea", key: "HT", short: "HT", start: "15:00", end: "18:00" },
  { label: "Dinner", key: "DI", short: "Di", start: "18:30", end: "22:00" },
];

/* Map a 24-h time string → slot key */
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

/* Also accept legacy slotGroup field */
const resolveSlotKey = (r) => r.slotGroup || timeToSlotKey(r.time);

const fmtTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};

const fmtDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const SOURCE_OPTIONS = [
  { label: "User App", icon: "App" },
  { label: "WhatsApp", icon: "WA" },
  { label: "Phone", icon: "Ph" },
  { label: "In Person", icon: "IP" },
];

/* ─── Default table preferences ─── */
const DEFAULT_PREF_OPTIONS = [
  {
    label: "Any",
    desc: "No preference",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="14" width="40" height="22" rx="4" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.5" />
        <rect x="18" y="8" width="6" height="10" rx="2" fill="#9ca3af" />
        <rect x="36" y="8" width="6" height="10" rx="2" fill="#9ca3af" />
        <rect x="18" y="32" width="6" height="10" rx="2" fill="#9ca3af" />
        <rect x="36" y="32" width="6" height="10" rx="2" fill="#9ca3af" />
        <circle cx="30" cy="25" r="5" fill="#d1d5db" />
      </svg>
    ),
  },
  {
    label: "Window",
    desc: "Street view, natural light",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="56" height="40" rx="3" fill="#bfdbfe" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="30" y1="2" x2="30" y2="42" stroke="#60a5fa" strokeWidth="1.5" />
        <line x1="2" y1="22" x2="58" y2="22" stroke="#60a5fa" strokeWidth="1.5" />
        <rect x="10" y="28" width="16" height="10" rx="2" fill="#93c5fd" opacity=".6" />
        <rect x="34" y="28" width="16" height="10" rx="2" fill="#93c5fd" opacity=".6" />
        <path d="M8 6 L14 14 M18 6 L24 14" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Booth",
    desc: "Cozy enclosed seating",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="52" height="36" rx="6" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="4" y="4" width="12" height="36" rx="4" fill="#fbbf24" />
        <rect x="44" y="4" width="12" height="36" rx="4" fill="#fbbf24" />
        <rect x="16" y="16" width="28" height="12" rx="3" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.2" />
        <circle cx="30" cy="22" r="4" fill="#fcd34d" />
      </svg>
    ),
  },
  {
    label: "Hitter",
    desc: "High-top bar seating",
    svg: (
      <svg viewBox="0 0 60 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="6" width="28" height="6" rx="2" fill="#6b7280" stroke="#4b5563" strokeWidth="1.2" />
        <line x1="30" y1="12" x2="30" y2="38" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round" />
        <circle cx="14" cy="18" r="5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2" />
        <line x1="14" y1="23" x2="14" y2="38" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        <circle cx="46" cy="18" r="5" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2" />
        <line x1="46" y1="23" x2="46" y2="38" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const EMPTY_FORM = {
  name: "", mobile: "", email: "",
  guests: 2,
  date: todayStr(),
  time: "",
  slotGroup: "",
  tableNo: "", tablePref: "Any",
  source: "Phone", inchargePerson: "",
  notes: "", status: "pending",
  bookedDate: todayStr(),
  reservedDate: todayStr(),
};

/* ══════════════════════════════════════════════
   Sort config
══════════════════════════════════════════════ */
const SORT_FIELDS = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "guests", label: "Guests" },
  { key: "status", label: "Status" },
];

/* ══════════════════════════════════════════════
   Image Upload helper (returns base64 data-URL)
══════════════════════════════════════════════ */
const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("File read failed"));
    r.readAsDataURL(file);
  });

/* ══════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════ */
const Reservations = ({ adminData, setAdminData }) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Filter state ──
  const [filterDate, setFilterDate] = useState("");
  const [filterFromDate, setFilterFromDate] = useState(todayStr());
  const [filterToDate, setFilterToDate] = useState(todayStr());
  const [filterDatePreset, setFilterDatePreset] = useState("today");
  const [filterSlots, setFilterSlots] = useState(new Set());
  const [filterStatuses, setFilterStatuses] = useState(new Set());
  const [filterSources, setFilterSources] = useState(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("asc");

  // ── Call history ──
  const [callTooltipId, setCallTooltipId] = useState(null);
  const [callTooltipPos, setCallTooltipPos] = useState({ top: 0, left: 0 });
  const callWrapRefs = useRef({});

  // ── Table preference management ──
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefList, setPrefList] = useState(DEFAULT_PREF_OPTIONS.map(p => p.label));
  const [prefImages, setPrefImages] = useState({}); // { label: base64DataURL }
  const [prefDescs, setPrefDescs] = useState({}); // { label: description string }
  const [prefDbRecords, setPrefDbRecords] = useState([]); // raw records from /tablePreferences
  const [newPrefInput, setNewPrefInput] = useState("");
  const [newPrefDesc, setNewPrefDesc] = useState("");
  const [newPrefImage, setNewPrefImage] = useState(null); // base64 for the new pref
  const [prefSaving, setPrefSaving] = useState(false);
  const newPrefImgRef = useRef(null);
  const editImgRefs = useRef({});       // refs for existing pref image inputs

  /* ── Fetch tablePreferences from db.json on mount ── */
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const res = await api.get("/tablePreferences");
        const records = res.data || [];
        if (records.length > 0) {
          const sorted = [...records].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          setPrefDbRecords(sorted);
          setPrefList(sorted.map(r => r.label));
          const imgs = {};
          const descs = {};
          sorted.forEach(r => {
            if (r.image) imgs[r.label] = r.image;
            if (r.desc) descs[r.label] = r.desc;
          });
          setPrefImages(imgs);
          setPrefDescs(descs);
        }
      } catch {
        // Fallback to defaults if endpoint not available
      }
    };
    loadPrefs();
  }, []);

  // ── Create modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [createTab, setCreateTab] = useState(0);

  const CREATE_TABS = ["All Details", "Preview"];

  // ── Table pref image upload inside create form ──
  const [tablePrefImageFile, setTablePrefImageFile] = useState(null); // { label, dataURL }
  const createImgRef = useRef(null);

  const data = adminData?.reservations || [];
  const tables = (adminData?.tables?.[0]?.list || []).map(Number).sort((a, b) => a - b);
  const staff = adminData?.staff || [];

  /* Build full PREF_OPTIONS with custom images and descriptions */
  const PREF_OPTIONS = prefList.map(label => {
    const found = DEFAULT_PREF_OPTIONS.find(p => p.label === label);
    const img = prefImages[label];
    const desc = prefDescs[label] || found?.desc || "";
    if (img) {
      return {
        label,
        desc,
        svg: <img src={img} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />,
      };
    }
    return found ? { ...found, desc } : { label, desc, svg: <span style={{ fontSize: 22 }}>🪑</span> };
  });

  const toggleSet = (setter, val) =>
    setter(prev => { const next = new Set(prev); next.has(val) ? next.delete(val) : next.add(val); return next; });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const assignedTables = useMemo(() => {
    const targetDate = form.date || todayStr();
    return new Set(data.filter(r => r.date === targetDate && r.tableNo).map(r => String(r.tableNo)));
  }, [data, form.date]);

  /* ── Filter data (all 5 slots) ── */
  const filteredData = useMemo(() => {
    let d = [...data];
    if (filterDate) {
      d = d.filter(r => r.date === filterDate);
    } else {
      if (filterFromDate) d = d.filter(r => (r.date || "") >= filterFromDate);
      if (filterToDate) d = d.filter(r => (r.date || "") <= filterToDate);
    }
    if (filterSlots.size > 0) {
      d = d.filter(r => {
        const key = resolveSlotKey(r);
        return key && filterSlots.has(key);
      });
    }
    if (filterStatuses.size > 0) d = d.filter(r => filterStatuses.has(r.status || "pending"));
    if (filterSources.size > 0) d = d.filter(r => filterSources.has(r.source));
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(r =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.mobile || "").includes(q) ||
        (r.id || "").toLowerCase().includes(q)
      );
    }
    return d;
  }, [data, filterDate, filterFromDate, filterToDate, filterSlots, filterStatuses, filterSources, search]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let va, vb;
      if (sortField === "date") {
        va = new Date(`${a.date}T${a.time || "00:00"}`);
        vb = new Date(`${b.date}T${b.time || "00:00"}`);
      } else if (sortField === "guests") {
        va = Number(a.guests || 0); vb = Number(b.guests || 0);
      } else {
        va = (a[sortField] || "").toString().toLowerCase();
        vb = (b[sortField] || "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDir]);

  const { displayLimit, sentinelRef, containerRef, hasMore } =
    useInfiniteScroll(sortedData.length, 30);

  const today = todayStr();
  const todayCount = data.filter(r => r.date === today).length;
  const pendingCount = data.filter(r => (r.status || "pending") === "pending").length;
  const confirmedCount = data.filter(r => r.status === "confirmed").length;

  /* ── Status / table update ── */
  const updateStatus = async (e, id, status) => {
    e.stopPropagation();
    const prev = (adminData.reservations || []).find(r => r.id === id);
    if (!prev) return;
    setAdminData(p => ({ ...p, reservations: p.reservations.map(r => r.id === id ? { ...r, status } : r) }));
    try {
      try { await api.patch(`/reservations/${id}`, { status }); }
      catch { await api.put(`/reservations/${id}`, { ...prev, status }); }
      toast.success(`Status updated to ${status}`);
    } catch {
      setAdminData(p => ({ ...p, reservations: p.reservations.map(r => r.id === id ? prev : r) }));
      toast.error("Failed to update status");
    }
  };

  const updateTable = async (e, id, tableNo) => {
    e.stopPropagation();
    const prev = (adminData.reservations || []).find(r => r.id === id);
    if (!prev) return;
    setAdminData(p => ({ ...p, reservations: (p.reservations || []).map(r => r.id === id ? { ...r, tableNo } : r) }));
    try {
      try { await api.patch(`/reservations/${id}`, { tableNo }); }
      catch { await api.put(`/reservations/${id}`, { ...prev, tableNo }); }
      toast.success(tableNo ? `Table T-${tableNo} assigned.` : "Table unassigned.");
    } catch {
      setAdminData(p => ({ ...p, reservations: (p.reservations || []).map(r => r.id === id ? prev : r) }));
      toast.error("Failed to assign table.");
    }
  };

  /* call logging — persisted to JSON */
  const handleCall = async (e, id) => {
    e.stopPropagation();
    const prev = (adminData?.reservations || []).find(r => r.id === id);
    if (!prev) return;
    const newEntry = new Date().toISOString();
    const updatedHistory = [...(prev.callHistory || []), newEntry];
    /* optimistic update */
    if (typeof setAdminData === "function") {
      setAdminData(p => ({
        ...p,
        reservations: (p.reservations || []).map(r =>
          r.id === id ? { ...r, callHistory: updatedHistory } : r
        ),
      }));
    }
    try {
      try { await api.patch(`/reservations/${id}`, { callHistory: updatedHistory }); }
      catch { await api.put(`/reservations/${id}`, { ...prev, callHistory: updatedHistory }); }
      toast.success("Call logged!");
    } catch {
      if (typeof setAdminData === "function") {
        setAdminData(p => ({
          ...p,
          reservations: (p.reservations || []).map(r => r.id === id ? prev : r),
        }));
      }
      toast.error("Failed to log call");
    }
  };

  const setF = (key, val) => { setForm(p => ({ ...p, [key]: val })); setFormErrors(e => ({ ...e, [key]: "" })); };

  const validateResTab = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Enter a valid name";
    const cleanMobile = form.mobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length !== 10) e.mobile = "Enter a valid 10-digit number";
    if (!form.date) e.date = "Pick a date";
    if (!form.time) e.time = "Pick a time";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleResNext = () => {
    if (!validateResTab()) return;
    setCreateTab(1);
  };

  const validateForm = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Enter a valid name";
    const cleanMobile = form.mobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length !== 10) e.mobile = "Enter a valid 10-digit number";
    if (!form.date) e.date = "Pick a date";
    if (!form.time) e.time = "Pick a time";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Create reservation (includes tablePrefImage in payload) ── */
  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const id = `res_${Date.now()}`;
      const payload = {
        id,
        ...form,
        status: form.status || "pending",
        createdAt: new Date().toISOString(),
        // store uploaded image (base64) so it persists in db.json
        tablePrefImage: tablePrefImageFile || null,
      };
      await api.post("/reservations", payload);
      if (typeof setAdminData === "function") {
        setAdminData(p => ({ ...p, reservations: [...(p.reservations || []), payload] }));
      }
      toast.success("Reservation created successfully.");
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      setTablePrefImageFile(null);
    } catch {
      toast.error("Failed to create reservation.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Table preference image handlers ── */
  const handlePrefImageUpload = async (label, file) => {
    if (!file) return;
    try {
      const dataURL = await readFileAsDataURL(file);
      setPrefImages(p => ({ ...p, [label]: dataURL }));
      // Also update in-memory db record so Save will persist it
      setPrefDbRecords(prev => prev.map(r => r.label === label ? { ...r, image: dataURL } : r));
      toast.success(`Image updated for "${label}" — click Save to persist`);
    } catch {
      toast.error("Failed to read image");
    }
  };

  const handleAddPref = async () => {
    const v = newPrefInput.trim();
    if (!v || prefList.includes(v)) return;
    const newRecord = {
      id: `pref_${Date.now()}`,
      label: v,
      desc: newPrefDesc.trim(),
      order: prefList.length,
      image: newPrefImage || null,
      isDefault: false,
    };
    if (newPrefImage) setPrefImages(p => ({ ...p, [v]: newPrefImage }));
    if (newPrefDesc.trim()) setPrefDescs(p => ({ ...p, [v]: newPrefDesc.trim() }));
    setPrefList(p => [...p, v]);
    setPrefDbRecords(p => [...p, newRecord]);
    setNewPrefInput("");
    setNewPrefDesc("");
    setNewPrefImage(null);
  };

  const handleRemovePref = (label) => {
    if (label === "Any") return;
    setPrefList(p => p.filter(l => l !== label));
    setPrefImages(p => { const n = { ...p }; delete n[label]; return n; });
    setPrefDescs(p => { const n = { ...p }; delete n[label]; return n; });
    setPrefDbRecords(p => p.filter(r => r.label !== label));
  };

  /* ── Save all preferences to /tablePreferences in db.json ── */
  const handleSavePrefs = async () => {
    setPrefSaving(true);
    try {
      // Build the final records list (merge UI state into records)
      const finalRecords = prefList.map((label, idx) => {
        const existing = prefDbRecords.find(r => r.label === label);
        return {
          id: existing?.id || `pref_${Date.now()}_${idx}`,
          label,
          desc: prefDescs[label] || existing?.desc || DEFAULT_PREF_OPTIONS.find(p => p.label === label)?.desc || "",
          order: idx,
          image: prefImages[label] || existing?.image || null,
          isDefault: existing?.isDefault ?? false,
        };
      });

      // Fetch current records to know which exist vs which are new
      let existingIds = new Set();
      try {
        const cur = await api.get("/tablePreferences");
        (cur.data || []).forEach(r => existingIds.add(r.id));
      } catch { }

      for (const rec of finalRecords) {
        if (existingIds.has(rec.id)) {
          try { await api.put(`/tablePreferences/${rec.id}`, rec); } catch { }
        } else {
          try { await api.post("/tablePreferences", rec); } catch { }
        }
      }

      // Delete removed records
      for (const id of existingIds) {
        if (!finalRecords.find(r => r.id === id)) {
          try { await api.delete(`/tablePreferences/${id}`); } catch { }
        }
      }

      setPrefDbRecords(finalRecords);
      toast.success("Table preferences saved!");
      setShowPrefModal(false);
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setPrefSaving(false);
    }
  };

  /* ── Create form table pref image ── */
  const handleCreateTablePrefImage = async (file) => {
    if (!file) return;
    try {
      const dataURL = await readFileAsDataURL(file);
      setTablePrefImageFile(dataURL);
      toast.success("Image ready to upload with reservation");
    } catch {
      toast.error("Failed to read image");
    }
  };

  const activeFilters = filterDate || filterFromDate || filterToDate || filterSlots.size > 0 || filterStatuses.size > 0 || filterSources.size > 0 || search.trim();

  const exportToExcel = () => {
    if (!sortedData.length) { alert("No reservations to export"); return; }
    const rows = sortedData.map(r => ({
      Name: r.name || "—",
      Mobile: r.mobile || "—",
      Email: r.email || "—",
      "Reserved Date": r.date || "—",
      "Booked On": r.bookedDate || r.reservedDate || "—",
      Slot: r.slotGroup || "—",
      Time: r.time || "—",
      Guests: r.guests ?? "—",
      Table: r.tableNo || "—",
      "Table Pref": r.tablePref || "—",
      Incharge: r.inchargePerson || "—",
      Source: r.source || "—",
      Status: r.status || "—",
      Notes: r.notes || "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(k => ({
      wch: Math.max(k.length, ...rows.map(r => String(r[k] ?? "").length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Reservations");
    const suffix = filterDate || (filterFromDate && filterToDate
      ? `${filterFromDate}_to_${filterToDate}`
      : filterFromDate || filterToDate || "all");
    XLSX.writeFile(wb, `reservations_${suffix}.xlsx`);
  };

  const SortTh = ({ field, children }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
      {children}
      <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
        {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );

  const availableTablesForForm = tables.filter(t => {
    const tStr = String(t);
    if (form.tableNo && String(form.tableNo) === tStr) return true;
    return !assignedTables.has(tStr);
  });

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div className="evt-res-page">

      {/* HEADER */}
      <div className="evt-res-header">
        <div>
          <h2 className="evt-res-title">Reservations</h2>
          <p className="evt-res-subtitle">Manage table bookings</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="orders-export-btn" onClick={exportToExcel}>Export</button>
          <button className="evt-res-pref-manage-btn" onClick={() => setShowPrefModal(true)}>
            🪑 Table Preferences
          </button>
          <button className="evt-res-create-btn"
            onClick={() => { setShowCreate(true); setForm({ ...EMPTY_FORM }); setTablePrefImageFile(null); setCreateTab(0); }}>
            + Add Reservation
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="evt-res-kpi-row">
        {[
          { label: "Total", val: data.length, color: "#111" },
          { label: "Today", val: todayCount, color: "#2980b9" },
          { label: "Pending", val: pendingCount, color: "#ca8a04" },
          { label: "Confirmed", val: confirmedCount, color: "#16a34a" },
        ].map((k, i) => (
          <div key={i} className="evt-res-kpi" style={{ borderTopColor: k.color }}>
            <div className="evt-res-kpi-val" style={{ color: k.color }}>{k.val}</div>
            <div className="evt-res-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="evt-res-filter-bar">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input className="evt-res-search" placeholder="Search name / mobile / ID..."
            value={search} onChange={e => setSearch(e.target.value)} />

          {/* Quick date presets */}
          {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([preset, label]) => (
            <button key={preset}
              className={`evt-res-filter-btn${filterDatePreset === preset ? " active" : ""}`}
              onClick={() => {
                if (filterDatePreset === preset) {
                  setFilterDatePreset(""); setFilterDate(""); setFilterFromDate(""); setFilterToDate("");
                } else {
                  setFilterDatePreset(preset); setFilterDate("");
                  if (preset === "today") { const t = todayStr(); setFilterFromDate(t); setFilterToDate(t); }
                  else if (preset === "week") { const [f, t] = getWeekRange(); setFilterFromDate(f); setFilterToDate(t); }
                  else { const [f, t] = getMonthRange(); setFilterFromDate(f); setFilterToDate(t); }
                }
              }}>
              {label}
            </button>
          ))}

          {/* From / To date pickers */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">From</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterFromDate} onChange={v => { setFilterFromDate(v); setFilterDate(""); setFilterDatePreset(""); if (filterToDate && v > filterToDate) setFilterToDate(v); }} placeholder="Start date" />
            </div>
          </div>
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">To</span>
            <div style={{ minWidth: 148 }}>
              <CustomDatePicker value={filterToDate} min={filterFromDate} onChange={v => { setFilterToDate(v); setFilterDate(""); setFilterDatePreset(""); }} placeholder="End date" />
            </div>
            {(filterFromDate || filterToDate) && (
              <button className="evt-res-filter-btn" onClick={() => { setFilterFromDate(""); setFilterToDate(""); setFilterDatePreset(""); setFilterDate(""); }} title="Clear dates">✕</button>
            )}
          </div>
        </div>

        <div className="evt-res-filter-groups">

          {/* ── All 5 Slots ── */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Slot</span>
            {SLOT_GROUPS.map(sg => (
              <button key={sg.key} title={`${sg.label} (${sg.start}–${sg.end})`}
                className={`evt-res-filter-btn ${filterSlots.has(sg.key) ? "active" : ""}`}
                onClick={() => toggleSet(setFilterSlots, sg.key)}>
                {sg.short}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Status</span>
            {[
              ["pending", "P", "status-pending", "Pending"],
              ["confirmed", "C", "status-confirmed", "Confirmed"],
              ["completed", "D", "status-completed", "Done"],
              ["cancelled", "X", "status-cancelled", "Cancelled"],
            ].map(([key, short, cls, title]) => (
              <button key={key} title={title}
                className={`evt-res-filter-btn ${filterStatuses.has(key) ? "active " + cls : ""}`}
                onClick={() => toggleSet(setFilterStatuses, key)}>{short}</button>
            ))}
          </div>

          {/* Source */}
          <div className="evt-res-filter-group">
            <span className="evt-res-filter-group-label">Source</span>
            {SOURCE_OPTIONS.map(s => (
              <button key={s.label} title={s.label}
                className={`evt-res-filter-btn ${filterSources.has(s.label) ? "active" : ""}`}
                onClick={() => toggleSet(setFilterSources, s.label)}>{s.icon}</button>
            ))}
          </div>

          {activeFilters && (
            <button className="evt-res-clear-all" onClick={() => {
              setSearch(""); setFilterDate(""); setFilterFromDate(todayStr()); setFilterToDate(todayStr()); setFilterDatePreset("today");
              setFilterSlots(new Set()); setFilterStatuses(new Set()); setFilterSources(new Set());
            }}>Clear</button>
          )}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="evt-res-table-wrapper" ref={containerRef}>
        <table className="evt-res-table">
          <thead>
            <tr>
              <SortTh field="name">Guest Name</SortTh>
              <th>Contact</th>
              <SortTh field="date">Reserved Date</SortTh>
              <th>Booked On</th>
              <th>Slot</th>
              <th>Time</th>
              <SortTh field="guests">Guests</SortTh>
              <th>Table Pref</th>
              <th>Table</th>
              <th>Incharge</th>
              <SortTh field="status">Status</SortTh>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr><td colSpan="13" className="evt-res-empty">No reservations found</td></tr>
            ) : (
              sortedData.slice(0, displayLimit).map(item => {
                const status = item.status || "pending";
                const rowDate = item.date || todayStr();
                const slotKey = resolveSlotKey(item);
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";

                const assignedForDate = new Set(
                  data.filter(r => r.date === rowDate && r.tableNo && r.id !== item.id).map(r => String(r.tableNo))
                );
                const rowAvailTables = tables.filter(t => {
                  const tStr = String(t);
                  if (item.tableNo && String(item.tableNo) === tStr) return true;
                  return !assignedForDate.has(tStr);
                });
                const history = item.callHistory || [];

                return (
                  <tr key={item.id} className="evt-res-row clickable"
                    onClick={() => navigate(`/reservations/${item.id}`)}>

                    {/* Guest name */}
                    <td>
                      <div className="evt-res-name-cell">
                        {item.tablePrefImage
                          ? <img src={item.tablePrefImage} alt="pref" className="evt-res-avatar-img" />
                          : <div className="evt-res-avatar">{(item.name || "?").charAt(0).toUpperCase()}</div>
                        }
                        <div>
                          <div className="evt-res-name">{item.name || "—"}</div>
                          <div className="evt-res-id-small">#{(item.id || "").slice(-6)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td>
                      <div className="evt-res-contact">
                        <span>{item.mobile || "—"}</span>
                        {item.email && <span className="evt-res-email">{item.email}</span>}
                      </div>
                    </td>

                    {/* Reserved date */}
                    <td style={{ fontWeight: 600 }}>{item.reservedDate || item.date || "—"}</td>

                    {/* Booked on */}
                    <td style={{ fontSize: 12, color: "#666" }}>{item.bookedDate || "—"}</td>

                    {/* Slot */}
                    <td>
                      <span className={`evt-res-slot-badge slot-${slotKey?.toLowerCase() || "any"}`}>
                        {slotLabel}
                      </span>
                    </td>

                    {/* Time */}
                    <td>{fmtTime(item.time)}</td>

                    {/* Guests */}
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{item.guests || 1}</td>

                    {/* Table Preference (with image thumbnail if set) */}
                    <td>
                      <div className="evt-res-tpref-cell">
                        {item.tablePrefImage
                          ? <img src={item.tablePrefImage} alt={item.tablePref} className="evt-res-tpref-thumb" />
                          : null}
                        <span>{item.tablePref || "—"}</span>
                      </div>
                    </td>

                    {/* Table assign */}
                    <td onClick={e => e.stopPropagation()}>
                      <select className="evt-res-table-select" value={item.tableNo || ""}
                        onChange={e => updateTable(e, item.id, e.target.value)}>
                        <option value="">— Table —</option>
                        {rowAvailTables.map(t => <option key={t} value={t}>T-{t}</option>)}
                      </select>
                    </td>

                    {/* Incharge */}
                    <td style={{ fontSize: 12, color: "#666" }}>{item.inchargePerson || "—"}</td>

                    {/* Status */}
                    <td onClick={e => e.stopPropagation()}>
                      <div className="evt-res-inline-status">
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
                      <div className="evt-res-call-wrap"
                        ref={el => { callWrapRefs.current[item.id] = el; }}
                        onMouseEnter={() => {
                          if (history.length > 0) {
                            const el = callWrapRefs.current[item.id];
                            if (el) {
                              const r = el.getBoundingClientRect();
                              setCallTooltipPos({ top: r.top, left: r.left });
                            }
                            setCallTooltipId(item.id);
                          }
                        }}
                        onMouseLeave={() => setCallTooltipId(null)}>
                        <button className="evt-res-act-btn evt-res-act-remind"
                          onClick={e => handleCall(e, item.id)} title="Log a call">
                          📞 Call{history.length > 0 ? ` (${history.length})` : ""}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            <InfiniteScrollLoader
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              colSpan={13}
            />
          </tbody>
        </table>
      </div>

      {/* ══ Call History Tooltip — rendered via portal to escape overflow clipping ══ */}
      {callTooltipId && createPortal(
        (() => {
          const histItem = (adminData?.reservations || []).find(x => x.id === callTooltipId);
          const hist = histItem?.callHistory || [];
          if (!hist.length) return null;
          return (
            <div
              className="evt-res-call-tooltip evt-res-call-tooltip--portal"
              style={{
                position: "fixed",
                top: callTooltipPos.top,
                left: callTooltipPos.left - 20,
                transform: "translate(-50%, calc(-100% - 10px))",
                zIndex: 99999,
                pointerEvents: "none",
              }}
            >
              <div className="evt-res-call-tooltip-title">📞 Call History</div>
              {hist.map((ts, i) => (
                <div key={i} className="evt-res-call-tooltip-row">{fmtDateTime(ts)}</div>
              ))}
            </div>
          );
        })(),
        document.body
      )}

      {/* ══ Table Preference Manager Modal ══ */}
      {showPrefModal && (
        <div className="event-modal-overlay" onClick={() => setShowPrefModal(false)}>
          <div className="event-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="event-modal-header">
              <h3>Table Preferences</h3>
              <button className="ingredient-close-btn" onClick={() => setShowPrefModal(false)} />
            </div>
            <div className="event-modal-body" style={{ padding: "16px 0" }}>
              <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
                Manage seating preference options shown in the reservation form. Changes are saved to the database when you click <strong>Save &amp; Close</strong>.
              </p>

              {/* Existing preferences */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {prefList.map(label => (
                  <div key={label} className="evt-res-pref-manage-row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {/* Preview thumbnail */}
                    <div className="evt-res-pref-manage-preview">
                      {prefImages[label]
                        ? <img src={prefImages[label]} alt={label} className="evt-res-pref-thumb-sm" />
                        : <div className="evt-res-pref-thumb-sm evt-res-pref-thumb-empty">
                          {DEFAULT_PREF_OPTIONS.find(p => p.label === label)?.svg || "🪑"}
                        </div>
                      }
                    </div>

                    {/* Label + editable description */}
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>🪑 {label}</div>
                      <input
                        className="evt-res-form-input"
                        style={{ marginTop: 4, fontSize: 12, padding: "3px 8px" }}
                        placeholder="Short description (shown to users)"
                        value={prefDescs[label] || ""}
                        onChange={e => {
                          const v = e.target.value;
                          setPrefDescs(p => ({ ...p, [label]: v }));
                          setPrefDbRecords(prev => prev.map(r => r.label === label ? { ...r, desc: v } : r));
                        }}
                      />
                    </div>

                    {/* Upload image button */}
                    <input
                      type="file" accept="image/*"
                      ref={el => editImgRefs.current[label] = el}
                      style={{ display: "none" }}
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (f) await handlePrefImageUpload(label, f);
                      }}
                    />
                    <button className="evt-res-upload-img-btn"
                      onClick={() => editImgRefs.current[label]?.click()}>
                      📷 {prefImages[label] ? "Change" : "Add Image"}
                    </button>
                    {prefImages[label] && (
                      <button className="evt-res-pref-remove-btn" title="Remove image"
                        onClick={() => {
                          setPrefImages(p => { const n = { ...p }; delete n[label]; return n; });
                          setPrefDbRecords(prev => prev.map(r => r.label === label ? { ...r, image: null } : r));
                        }}>🗑</button>
                    )}
                    {label !== "Any" && (
                      <button className="evt-res-pref-remove-btn" title="Remove preference" onClick={() => handleRemovePref(label)}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add new preference */}
              <div style={{ marginTop: 18, borderTop: "1px dashed #e5e7eb", paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Add New Preference</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    className="evt-res-form-input" style={{ flex: 1, minWidth: 120 }}
                    placeholder="Label e.g. Outdoor, Rooftop"
                    value={newPrefInput}
                    onChange={e => setNewPrefInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddPref()}
                  />
                  <input
                    className="evt-res-form-input" style={{ flex: 1.5, minWidth: 140 }}
                    placeholder="Description (optional)"
                    value={newPrefDesc}
                    onChange={e => setNewPrefDesc(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddPref()}
                  />
                  {/* New pref image */}
                  <input type="file" accept="image/*" ref={newPrefImgRef} style={{ display: "none" }}
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) { const d = await readFileAsDataURL(f); setNewPrefImage(d); }
                    }} />
                  <button className="evt-res-upload-img-btn" onClick={() => newPrefImgRef.current?.click()}>
                    📷 {newPrefImage ? "✓ Image" : "Image"}
                  </button>
                  <button className="evt-res-create-btn" style={{ whiteSpace: "nowrap" }} onClick={handleAddPref}>
                    + Add
                  </button>
                </div>
                {newPrefImage && (
                  <img src={newPrefImage} alt="preview" style={{ marginTop: 8, height: 48, borderRadius: 6, objectFit: "cover" }} />
                )}
              </div>
            </div>
            <div className="event-modal-footer">
              <div className="form-actions">
                <button onClick={handleSavePrefs} disabled={prefSaving} style={{ background: "#1dd1a1", color: "#fff", fontWeight: 700 }}>
                  {prefSaving ? "Saving..." : "💾 Save & Close"}
                </button>
                <button onClick={() => setShowPrefModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="event-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="event-modal" style={{ width: 620 }} onClick={e => e.stopPropagation()}>
            <div className="event-modal-header">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h3>Add Reservation</h3>
                <div className="ae-spec-steps">
                  {CREATE_TABS.map((t, i) => (
                    <button key={i}
                      className={`ae-spec-step${createTab === i ? " active" : ""}${createTab > i ? " done" : ""}`}
                      onClick={() => setCreateTab(i)}>
                      <span className="ae-step-num">{createTab > i ? "✓" : i + 1}</span>
                      <span className="ae-step-label">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className="ingredient-close-btn" onClick={() => setShowCreate(false)} />
            </div>

            <div className="event-modal-body" style={{ padding: "8px 0" }}>

              {/* ── TAB 0: Guest Information ── */}
              {createTab === 0 && (
                <>
                  <div className="evt-res-form-section-label">Guest Information</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1.4 }}>
                      <label>Name <span className="evt-res-req">*</span></label>
                      <input className={formErrors.name ? "error" : ""}
                        placeholder="Guest name" value={form.name}
                        onChange={e => setF("name", e.target.value)} />
                      {formErrors.name && <span className="evt-res-form-error">{formErrors.name}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Guests</label>
                      <div className="evt-res-stepper">
                        <button type="button" onClick={() => setF("guests", Math.max(1, form.guests - 1))}>−</button>
                        <span>{form.guests}</span>
                        <button type="button" onClick={() => setF("guests", Math.min(30, form.guests + 1))}>+</button>
                      </div>
                    </div>
                  </div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Mobile <span className="evt-res-req">*</span></label>
                      <input className={formErrors.mobile ? "error" : ""}
                        placeholder="10-digit number" type="tel"
                        value={form.mobile}
                        onChange={e => setF("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                      {formErrors.mobile && <span className="evt-res-form-error">{formErrors.mobile}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Email</label>
                      <input placeholder="email@example.com"
                        value={form.email} onChange={e => setF("email", e.target.value)} />
                    </div>
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Staff & Source</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Source</label>
                      <div className="evt-res-source-chips">
                        {SOURCE_OPTIONS.map(s => (
                          <button key={s.label} type="button"
                            className={`evt-res-source-chip ${form.source === s.label ? "active" : ""}`}
                            onClick={() => setF("source", s.label)}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Status</label>
                      <div className="evt-res-source-chips">
                        {["pending", "confirmed"].map(s => (
                          <button key={s} type="button"
                            className={`evt-res-source-chip ${form.status === s ? "active status-" + s : ""}`}
                            onClick={() => setF("status", s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Staff Incharge</label>
                    {staff.length > 0 ? (
                      <select value={form.inchargePerson} onChange={e => setF("inchargePerson", e.target.value)}>
                        <option value="">— Assign staff —</option>
                        {staff.map(s => <option key={s.id || s.name} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ""}</option>)}
                      </select>
                    ) : (
                      <input placeholder="Staff name" value={form.inchargePerson}
                        onChange={e => setF("inchargePerson", e.target.value)} />
                    )}
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea rows={2} placeholder="Special requests, dietary restrictions..."
                      value={form.notes} onChange={e => setF("notes", e.target.value)} />
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 8 }}>Booking Dates</div>
                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Booked On <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginLeft: 4 }}>(date reservation was made)</span></label>
                      <CustomDatePicker value={form.bookedDate} onChange={v => setF("bookedDate", v)} placeholder="Booking date" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Reserved For <span className="evt-res-req">*</span> <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginLeft: 4 }}>(table reservation date)</span></label>
                      <CustomDatePicker value={form.reservedDate} min={todayStr()} onChange={v => { setF("reservedDate", v); setF("date", v); }} placeholder="Reserved date" />
                      {formErrors.date && <span className="evt-res-form-error">{formErrors.date}</span>}
                    </div>
                  </div>

                  <div className="evt-res-form-section-label" style={{ marginTop: 4 }}>Booking Details</div>
                  <div className="form-group">
                    <label>Dining Slot <span style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>(select to restrict time picker)</span></label>
                    <div className="evt-res-slot-grid">
                      {SLOT_GROUPS.map(sg => (
                        <button key={sg.key} type="button"
                          className={`evt-res-slot-chip ${form.slotGroup === sg.key ? "active" : ""}`}
                          onClick={() => { setF("slotGroup", sg.key); setF("time", ""); }}>
                          <span className="evt-res-slot-chip-label">{sg.label}</span>
                          <span className="evt-res-slot-chip-time">{sg.start}–{sg.end}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="horizontal-form-group">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Time <span className="evt-res-req">*</span>
                        {form.slotGroup && (() => { const sg = SLOT_GROUPS.find(s => s.key === form.slotGroup); return sg ? <span style={{ fontSize: 11, color: "#2980b9", fontWeight: 500, marginLeft: 6 }}>({sg.start}–{sg.end})</span> : null; })()}
                      </label>
                      <CustomTimePicker value={form.time} onChange={v => setF("time", v)}
                        slotStart={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.start}
                        slotEnd={SLOT_GROUPS.find(s => s.key === form.slotGroup)?.end}
                        isToday={form.reservedDate === todayStr()} />
                      {formErrors.time && <span className="evt-res-form-error">{formErrors.time}</span>}
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Table No. <span style={{ fontSize: 10, color: "#aaa", fontWeight: 400, marginLeft: 4 }}>(available)</span></label>
                      <select value={form.tableNo} onChange={e => setF("tableNo", e.target.value)}>
                        <option value="">— No table —</option>
                        {availableTablesForForm.map(t => <option key={t} value={t}>Table {t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Table Preference</label>
                    <div className="evt-res-pref-grid">
                      {PREF_OPTIONS.map(p => (
                        <button key={p.label} type="button"
                          className={`evt-res-pref-card ${form.tablePref === p.label ? "active" : ""}`}
                          onClick={() => setF("tablePref", p.label)}>
                          <div className="evt-res-pref-visual">{p.svg}</div>
                          <span className="evt-res-pref-label">{p.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="evt-res-pref-img-upload-row">
                      <span style={{ fontSize: 12, color: "#555" }}>Attach table preference photo:</span>
                      <input type="file" accept="image/*" ref={createImgRef} style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleCreateTablePrefImage(f); }} />
                      <button type="button" className="evt-res-upload-img-btn"
                        onClick={() => createImgRef.current?.click()}>
                        📷 {tablePrefImageFile ? "✓ Image attached" : "Upload Image"}
                      </button>
                      {tablePrefImageFile && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <img src={tablePrefImageFile} alt="preview"
                            style={{ height: 40, borderRadius: 6, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                          <button type="button" className="evt-res-pref-remove-btn"
                            onClick={() => setTablePrefImageFile(null)}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ── TAB 1: Preview ── */}
              {createTab === 1 && (() => {
                const slotKey = form.slotGroup;
                const slotLabel = SLOT_GROUPS.find(s => s.key === slotKey)?.label || "—";
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Summary header */}
                    <div style={{ background: "linear-gradient(135deg,#f8fafc,#eef2ff)", borderRadius: 12, padding: "12px 16px", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                      {tablePrefImageFile
                        ? <img src={tablePrefImageFile} alt="pref" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#667eea,#764ba2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>
                          {(form.name || "?").charAt(0).toUpperCase()}
                        </div>
                      }
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>{form.name || "—"}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{form.mobile || "—"} {form.email ? `· ${form.email}` : ""}</div>
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {slotKey && <span className={`evt-res-slot-badge slot-${slotKey.toLowerCase()}`} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 999, fontWeight: 600 }}>{slotLabel}</span>}
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: form.status === "confirmed" ? "#d1fae5" : "#fef3c7", color: form.status === "confirmed" ? "#065f46" : "#92400e" }}>{form.status}</span>
                      </div>
                    </div>

                    <div className="prv-section">
                      <div className="prv-section-title">Reservation Details</div>
                      <div className="prv-grid">
                        {[
                          ["Reserved For", form.reservedDate || form.date || "—"],
                          ["Booked On", form.bookedDate || "—"],
                          ["Time", fmtTime(form.time)],
                          ["Slot", slotLabel],
                          ["Guests", form.guests ?? "—"],
                          ["Table", form.tableNo ? `T-${form.tableNo}` : "Not assigned"],
                          ["Table Pref", form.tablePref || "—"],
                          ["Incharge", form.inchargePerson || "—"],
                          ["Source", form.source || "—"],
                        ].map(([l, v]) => (
                          <div key={l} className="prv-cell"><div className="prv-cell-label">{l}</div><div className="prv-cell-val">{v}</div></div>
                        ))}
                      </div>
                    </div>

                    {form.notes && (
                      <div className="prv-section">
                        <div className="prv-section-title">Notes</div>
                        <div className="prv-notes">{form.notes}</div>
                      </div>
                    )}

                    {(!form.name.trim() || !form.mobile || !form.date || !form.time) && (
                      <div style={{ padding: "10px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fcd34d", fontSize: 13, color: "#92400e" }}>
                        ⚠️ Required fields missing:{" "}
                        {!form.name.trim() && "Name, "}
                        {(!form.mobile || form.mobile.replace(/\D/g, "").length !== 10) && "Mobile, "}
                        {!form.date && "Reserved Date, "}
                        {!form.time && "Time "}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="event-modal-footer">
              <div className="form-actions ae-spec-footer">
                {createTab === 0 ? (
                  <button type="button" className="btn-primary" onClick={handleResNext}>Preview →</button>
                ) : (
                  <>
                    <button type="button" className="ae-step-prev-btn" onClick={() => setCreateTab(0)}>← Edit</button>
                    <button onClick={handleCreate} disabled={saving}>
                      {saving ? "Saving..." : "Create Reservation"}
                    </button>
                  </>
                )}
                <button onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;