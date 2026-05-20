import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Topbar.css";
import human from "../../icon/human.png";
import notification from "../../icon/notification.png";
import bellSound from "../../assets/sounds/bell.mp3";
import socket from "../../socket";
import api from "../../api";

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === TODAY.getTime();
}

function isFuture(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= TODAY.getTime();
}

function toDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const [h = "00", m = "00"] = (timeStr || "").split(":");
  const dt = new Date(dateStr);
  dt.setHours(Number(h), Number(m), 0, 0);
  return dt;
}

function formatCountdown(ms) {
  if (ms <= 0) return "Now";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) return `${h}h ${min}m`;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const TYPE_META = {
  reservation: { label: "Reservation", short: "R", emoji: "📅", route: "/reservations", color: "#7c3aed" },
  prebooking: { label: "Pre-Booking", short: "PB", emoji: "🗓️", route: "/prebookings", color: "#0891b2" },
  catering: { label: "Catering", short: "C", emoji: "🍽️", route: "/catering", color: "#d97706" },
  celebration: { label: "Celebration", short: "CL", emoji: "🎉", route: "/celebrations", color: "#db2777" },
  event: { label: "Event", short: "E", emoji: "🎪", route: "/events", color: "#16a34a" },
};

/* ─────────────────────────────────────────────────────────────────────────────
   TOPBAR COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const Topbar = ({ setIsAuthenticated, adminData = {}, setAdminData }) => {
  const orders = adminData.orders || [];
  const ingredients = adminData.ingredients || [];
  const navigate = useNavigate();

  /* ── UI state ── */
  const [scrolled, setScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [readOrderIds, setReadOrderIds] = useState([]);

  /* ── Bell state ── */
  const [activeBells, setActiveBells] = useState({});

  /* ── Phone / scheduling data — read from adminData ── */
  const [countdown, setCountdown] = useState({});   // id → ms remaining

  /* ── Refs ── */
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const phoneRef = useRef(null);
  const bellAudioRef = useRef(new Audio(bellSound));
  const bellLoopRef = useRef(null);

  /* ─────────────────────────────────────
     Sticky shadow on scroll
  ───────────────────────────────────── */
  useEffect(() => {
    const container = document.querySelector(".main-content");
    if (!container) return;
    const onScroll = () => setScrolled(container.scrollTop > 0);
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  /* ─────────────────────────────────────
     Click-outside to close dropdowns
  ───────────────────────────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (phoneRef.current && !phoneRef.current.contains(e.target)) setShowPhone(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  /* ─────────────────────────────────────
     Sync readOrderIds when orders change
  ───────────────────────────────────── */
  useEffect(() => {
    setReadOrderIds(prev =>
      prev.filter(id =>
        orders.some(o => o.id === id && o.status?.toLowerCase() !== "completed")
      )
    );
  }, [orders]);

  /* ─────────────────────────────────────
     🔔 Bell audio helpers
  ───────────────────────────────────── */
  const startBellAudio = useCallback(() => {
    const audio = bellAudioRef.current;
    if (!audio || bellLoopRef.current) return;
    const loop = () => { audio.currentTime = 0; audio.play().catch(() => { }); };
    audio.addEventListener("ended", loop);
    bellLoopRef.current = loop;
    audio.currentTime = 0;
    audio.play().catch(() => { });
  }, []);

  const stopBellAudio = useCallback(() => {
    const audio = bellAudioRef.current;
    if (!audio) return;
    if (bellLoopRef.current) {
      audio.removeEventListener("ended", bellLoopRef.current);
      bellLoopRef.current = null;
    }
    audio.pause();
    audio.currentTime = 0;
  }, []);

  /* ─────────────────────────────────────
     🔔 Socket listeners — bell events
  ───────────────────────────────────── */
  useEffect(() => {
    const handleSync = (bells) => {
      setActiveBells(bells || {});
      if (Object.keys(bells || {}).length > 0) startBellAudio();
    };
    const handleBellRing = ({ tableNo }) => {
      setActiveBells(prev => ({ ...prev, [tableNo]: true }));
      startBellAudio();
    };
    const handleBellOff = ({ tableNo }) => {
      setActiveBells(prev => {
        const next = { ...prev };
        delete next[tableNo];
        if (Object.keys(next).length === 0) stopBellAudio();
        return next;
      });
    };

    socket.on("bell-sync", handleSync);
    socket.on("bell-ring", handleBellRing);
    socket.on("bell-off", handleBellOff);
    return () => {
      socket.off("bell-sync", handleSync);
      socket.off("bell-ring", handleBellRing);
      socket.off("bell-off", handleBellOff);
    };
  }, [startBellAudio, stopBellAudio]);

  /* ─────────────────────────────────────
     🔕 Admin dismisses bell
  ───────────────────────────────────── */
  const handleDismissBell = (tableNo) => {
    socket.emit("bell-off", { tableNo });
    setActiveBells(prev => {
      const next = { ...prev };
      delete next[tableNo];
      if (Object.keys(next).length === 0) stopBellAudio();
      return next;
    });
  };

  /* ─────────────────────────────────────
     📞 Scheduling data — derived from adminData (no separate fetch)
  ───────────────────────────────────── */
  const reservations = adminData.reservations || [];
  const prebookings = adminData.preBookings || [];
  const caterings = adminData.cateringOrders || [];
  const celebrations = adminData.celebrations || [];
  const events = adminData.events || [];
  // Collect call logs from every booking — each item stores callHistory as [isoTimestamp, ...]
  const callHistory = useMemo(() => {
    const logs = [];

    const collect = (items, type, apiKey) => {
      (items || []).forEach(item => {
        const timestamps = item.callHistory || [];
        const name = item.name || item.customerName || item.title || "—";
        const phone = item.mobile || item.phone || item.contactPhone || "—";
        timestamps.forEach(ts => {
          logs.push({
            // stable key: type + item.id + timestamp
            id: `${type}_${item.id}_${ts}`,
            type,
            apiKey,                // e.g. "reservations"
            referenceId: item.id,
            name,
            phone,
            calledAt: ts,
          });
        });
      });
    };

    collect(adminData.reservations, "reservation", "reservations");
    collect(adminData.preBookings, "prebooking", "preBookings");
    collect(adminData.cateringOrders, "catering", "cateringOrders");
    collect(adminData.celebrations, "celebration", "celebrations");
    collect(adminData.events, "event", "events");

    return logs.sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt));
  }, [
    adminData.reservations, adminData.preBookings,
    adminData.cateringOrders, adminData.celebrations, adminData.events
  ]);

  // Stable todayChips — only recomputes when the underlying data arrays change
  const todayChips = useMemo(() => {
    const chips = [];
    reservations.filter(r => isToday(r.date) && r.status !== "cancelled").forEach(r => {
      chips.push({ id: r.id, type: "reservation", label: r.name, dateStr: r.date, time: r.time, data: r });
    });
    prebookings.filter(p => isToday(p.date) && p.status !== "cancelled" && p.status !== "completed").forEach(p => {
      chips.push({ id: p.id, type: "prebooking", label: p.name || p.customerName, dateStr: p.date, time: p.time, data: p });
    });
    caterings.filter(c => isToday(c.date || c.eventDate) && c.status !== "cancelled").forEach(c => {
      chips.push({ id: c.id, type: "catering", label: c.name || c.customerName, dateStr: c.date || c.eventDate, time: c.time, data: c });
    });
    celebrations.filter(cl => isToday(cl.date) && cl.status !== "cancelled").forEach(cl => {
      chips.push({ id: cl.id, type: "celebration", label: cl.name || cl.customerName, dateStr: cl.date, time: cl.time, data: cl });
    });
    events.filter(e => isToday(e.date) && e.status !== "cancelled").forEach(e => {
      chips.push({ id: e.id, type: "event", label: e.title, dateStr: e.date, time: e.time, data: e });
    });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminData.reservations, adminData.preBookings, adminData.cateringOrders, adminData.celebrations, adminData.events]);

  /* ─────────────────────────────────────
     ⏱️ Countdown ticker (every second)
  ───────────────────────────────────── */
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const next = {};
      todayChips.forEach(chip => {
        const dt = toDateTime(chip.dateStr, chip.time);
        next[chip.id] = dt ? dt.getTime() - now : 0;
      });
      setCountdown(next);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [todayChips]);

  /* ─────────────────────────────────────
     📞 Mark a call done — append timestamp to the booking's callHistory
  ───────────────────────────────────── */
  // Map chip.type → adminData key + api endpoint
  const TYPE_TO_RESOURCE = {
    reservation: { stateKey: "reservations", endpoint: "reservations" },
    prebooking: { stateKey: "preBookings", endpoint: "preBookings" },
    catering: { stateKey: "cateringOrders", endpoint: "cateringOrders" },
    celebration: { stateKey: "celebrations", endpoint: "celebrations" },
    event: { stateKey: "events", endpoint: "events" },
  };

  const handleCallDone = async (chip) => {
    const resource = TYPE_TO_RESOURCE[chip.type];
    if (!resource) return;

    const { stateKey, endpoint } = resource;
    const booking = (adminData[stateKey] || []).find(i => i.id === chip.id);
    if (!booking) return;

    const timestamp = new Date().toISOString();
    const updated = { ...booking, callHistory: [...(booking.callHistory || []), timestamp] };

    try {
      const res = await api.put(`/${endpoint}/${chip.id}`, updated);
      const saved = res.data || updated;
      setAdminData(prev => ({
        ...prev,
        [stateKey]: (prev[stateKey] || []).map(i => i.id === chip.id ? saved : i),
      }));
    } catch (err) {
      console.error("Failed to log call:", err);
    }
  };

  /* ─────────────────────────────────────
     Notification counts
  ───────────────────────────────────── */
  const unreadOrders = orders
    .filter(o => o.status && o.status.toLowerCase() !== "completed" && !readOrderIds.includes(o.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unreadLowStock = ingredients.filter(ing => {
    const max = Number(ing.stockMax || 0);
    const remaining = Number(ing.stockRemaining || 0);
    return max > 0 && (remaining / max) * 100 < 30;
  });

  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  };

  const expiryNotifications = ingredients.map(ing => {
    const daysLeft = getDaysRemaining(ing.expiryDate);
    if (daysLeft !== null && daysLeft <= 15 && daysLeft >= 0)
      return { id: ing.id, name: ing.name, daysLeft };
    return null;
  }).filter(Boolean);

  const notificationCount = unreadOrders.length + (unreadLowStock.length > 0 ? 1 : 0) + expiryNotifications.length;
  const displayCount = notificationCount > 9 ? "9+" : notificationCount;
  const bellTableList = Object.keys(activeBells);

  /* ─────────────────────────────────────
     Phone dropdown: upcoming items grouped by type
  ───────────────────────────────────── */
  const upcomingItems = useMemo(() => {
    const items = [];
    const addUpcoming = (list, type) => {
      list
        .filter(i => isFuture(i.date || i.eventDate) && i.status !== "cancelled" && i.status !== "completed")
        .sort((a, b) => new Date(a.date || a.eventDate) - new Date(b.date || b.eventDate))
        .slice(0, 5)
        .forEach(i => items.push({ ...i, _type: type, _date: i.date || i.eventDate }));
    };
    addUpcoming(reservations, "reservation");
    addUpcoming(prebookings, "prebooking");
    addUpcoming(caterings, "catering");
    addUpcoming(celebrations, "celebration");
    addUpcoming(events.filter(e => e.eventType !== "dining"), "event");
    items.sort((a, b) => new Date(a._date || a.date) - new Date(b._date || b.date));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminData.reservations, adminData.preBookings, adminData.cateringOrders, adminData.celebrations, adminData.events]);

  /* ─────────────────────────────────────
     Phone badge count = today chips
  ───────────────────────────────────── */
  const phoneBadgeCount = todayChips.length;

  return (
    <header className={`topbar ${scrolled ? "topbar-scrolled" : ""}`}>
      {/* ── LEFT ── */}
      <div className="topbar-left">
        <h3 className="topbar-title">Admin</h3>
      </div>

      {/* ── RIGHT ── */}
      <div className="topbar-right">

        {/* ── TODAY COUNTDOWN CHIPS ── */}
        {todayChips.map(chip => {
          const meta = TYPE_META[chip.type] || {};
          const ms = countdown[chip.id] ?? 0;
          const isPast = ms <= 0;
          return (
            <button
              key={chip.id}
              type="button"
              className={`today-chip ${isPast ? "today-chip--past" : ""}`}
              style={{ "--chip-color": meta.color }}
              onClick={(e) => { e.stopPropagation(); navigate(meta.route || "/"); }}
              title={`${meta.label}: ${chip.label} at ${formatTime(chip.time)}`}
            >
              <span className="today-chip__countdown">
                {meta.short} {isPast ? "Now!" : formatCountdown(ms)}
              </span>
            </button>
          );
        })}

        {/* ── BELL CALL BUTTONS ── */}
        {bellTableList.map(tableNo => (
          <button
            key={tableNo}
            type="button"
            className="bell-call-btn blinking"
            onClick={(e) => { e.stopPropagation(); handleDismissBell(tableNo); }}
            title={`Table ${tableNo} is calling. Click to dismiss.`}
          >
            🔔 Table {tableNo}
          </button>
        ))}

        {/* ── PHONE ICON ── */}
        <div className="topbar-icon-wrapper" ref={phoneRef}>
          <button
            type="button"
            className="notification-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowPhone(v => !v);
              setShowNotifications(false);
              setShowProfile(false);
            }}
            aria-label="Calls & Reminders"
          >
            <span className="phone-icon-svg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07
                  A19.5 19.5 0 0 1 4.27 12 19.79 19.79 0 0 1 1.07 3.43
                  A2 2 0 0 1 3.04 1h3a2 2 0 0 1 2 1.72
                  c.127.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91
                  a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45
                  c.91.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            {phoneBadgeCount > 0 && (
              <span className="notification-badge">
                {phoneBadgeCount > 9 ? "9+" : phoneBadgeCount}
              </span>
            )}
          </button>

          {showPhone && (
            <div className="dropdown phone-dropdown" onClick={(e) => e.stopPropagation()}>
              <h4 className="dropdown-title">📞 Calls & Reminders</h4>

              {/* ── TODAY'S CALLS ── */}
              {todayChips.length > 0 && (
                <section className="phone-section">
                  <p className="phone-section-title">Today's Reminders</p>
                  <ul className="phone-list">
                    {todayChips.map(chip => {
                      const meta = TYPE_META[chip.type] || {};
                      const ms = countdown[chip.id] ?? 0;
                      const isPast = ms <= 0;
                      const phone = chip.data?.mobile || chip.data?.phone || chip.data?.contactPhone || "—";
                      return (
                        <li key={chip.id} className="phone-list__item">
                          <div className="phone-list__top">
                            <span
                              className="phone-list__badge"
                              style={{ background: meta.color }}
                            >
                              {meta.emoji} {meta.label}
                            </span>
                            <span className={`phone-list__timer ${isPast ? "phone-list__timer--now" : ""}`}>
                              {isPast ? "🔴 Now!" : `⏱ ${formatCountdown(ms)}`}
                            </span>
                          </div>
                          <p className="phone-list__name">{chip.label}</p>
                          <p className="phone-list__phone">📱 {phone} &nbsp;·&nbsp; {formatTime(chip.time)}</p>
                          <div className="phone-list__actions">
                            <button
                              type="button"
                              className="phone-action-btn phone-action-btn--call"
                              onClick={(e) => { e.stopPropagation(); handleCallDone(chip); navigate(meta.route); setShowPhone(false); }}
                            >
                              ✅ Mark Called
                            </button>
                            <button
                              type="button"
                              className="phone-action-btn phone-action-btn--view"
                              onClick={(e) => { e.stopPropagation(); navigate(meta.route); setShowPhone(false); }}
                            >
                              View
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* ── UPCOMING ── */}
              <section className="phone-section">
                <p className="phone-section-title">Upcoming</p>
                {upcomingItems.length === 0 ? (
                  <p className="phone-empty">No upcoming bookings</p>
                ) : (
                  <ul className="phone-list phone-list--compact">
                    {upcomingItems.slice(0, 6).map(item => {
                      const meta = TYPE_META[item._type] || {};
                      const phone = item.mobile || item.phone || item.contactPhone || "—";
                      const name = item.name || item.customerName || item.title || "—";
                      return (
                        <li
                          key={`${item._type}-${item.id}`}
                          className="phone-list__item phone-list__item--compact"
                          onClick={(e) => { e.stopPropagation(); navigate(meta.route); setShowPhone(false); }}
                        >
                          <span
                            className="phone-list__badge phone-list__badge--sm"
                            style={{ background: meta.color }}
                          >
                            {meta.emoji}
                          </span>
                          <div className="phone-list__compact-info">
                            <strong>{name}</strong>
                            <span>{formatDate(item._date || item.date)} {item.time ? `· ${formatTime(item.time)}` : ""}</span>
                          </div>
                          <span className="phone-list__phone-sm">📱 {phone}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* ── CALL HISTORY ── */}
              <section className="phone-section">
                <p className="phone-section-title">Call History</p>
                {callHistory.length === 0 ? (
                  <p className="phone-empty">No calls logged yet</p>
                ) : (
                  <ul className="phone-list phone-list--compact">
                    {callHistory.slice(0, 5).map(log => {
                      const meta = TYPE_META[log.type] || {};
                      return (
                        <li key={log.id} className="phone-list__item phone-list__item--compact phone-list__item--log">
                          <span
                            className="phone-list__badge phone-list__badge--sm"
                            style={{ background: meta.color || "#555" }}
                          >
                            {meta.emoji || "📞"}
                          </span>
                          <div className="phone-list__compact-info">
                            <strong>{log.name}</strong>
                            <span>{meta.label || log.type} · 📱 {log.phone}</span>
                          </div>
                          <span className="phone-list__phone-sm phone-list__phone-sm--time">
                            {new Date(log.calledAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short"
                            })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div className="topbar-icon-wrapper" ref={notifRef}>
          <button
            type="button"
            className="notification-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowNotifications(v => !v);
              setShowProfile(false);
              setShowPhone(false);
            }}
            aria-label="Notifications"
          >
            <img src={notification} alt="" />
            {notificationCount > 0 && (
              <span className="notification-badge">{displayCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown notification-dropdown" onClick={(e) => e.stopPropagation()}>
              <h4 className="dropdown-title">Notifications</h4>
              <ul className="notification-list">
                {unreadOrders.map(order => (
                  <li key={order.id} onClick={(e) => {
                    e.stopPropagation();
                    setReadOrderIds(prev => [...prev, order.id]);
                    setShowNotifications(false);
                    navigate("/orders", { state: { scrollToOrderId: order.id } });
                  }}>
                    <strong>New Order</strong>
                    <span>#{order.id} placed</span>
                  </li>
                ))}
                {unreadLowStock.length > 0 && (
                  <li onClick={(e) => { e.stopPropagation(); setShowNotifications(false); navigate("/stocks"); }}>
                    <strong>Low Stock</strong>
                    <span>{unreadLowStock.length} ingredients below limit</span>
                  </li>
                )}
                {expiryNotifications.map(ing => (
                  <li key={ing.id} onClick={(e) => { e.stopPropagation(); setShowNotifications(false); navigate("/stocks"); }}>
                    <strong>Expiry Alert</strong>
                    <span>{ing.name} expires in {ing.daysLeft} day{ing.daysLeft === 1 ? "" : "s"}</span>
                  </li>
                ))}
                {unreadOrders.length === 0 && unreadLowStock.length === 0 && expiryNotifications.length === 0 && (
                  <li><span>No new notifications</span></li>
                )}
              </ul>
              <button className="view-all-btn" type="button" onClick={(e) => { e.stopPropagation(); setShowNotifications(false); navigate("/orders"); }}>
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* ── PROFILE ── */}
        <div className="topbar-icon-wrapper" ref={profileRef}>
          <button
            type="button"
            className="profile-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowProfile(v => !v);
              setShowNotifications(false);
              setShowPhone(false);
            }}
          >
            <div className="profile-avatar">
              <img src={human} alt="" />
            </div>
            <span className="profile-name">Admin</span>
          </button>

          {showProfile && (
            <div className="dropdown profile-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="profile-info">
                <div className="profile-avatar large">S</div>
                <div>
                  <p className="profile-fullname">Sam Cafe Admin</p>
                  <p className="profile-role">Administrator</p>
                </div>
              </div>
              <div className="dropdown-divider" />
              <button type="button" className="logout-btn" onClick={(e) => { e.stopPropagation(); setIsAuthenticated(false); }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;