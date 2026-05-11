import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Topbar.css";
import human from "../../icon/human.png";
import notification from "../../icon/notification.png";
import bellSound from "../../assets/sounds/bell.mp3"; // same bell asset as user panel
import socket from "../../socket";

const Topbar = ({ setIsAuthenticated, orders = [], ingredients = [] }) => {
  const [scrolled, setScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [readOrderIds, setReadOrderIds] = useState([]);

  // Map of tableNo → true for every active bell call
  const [activeBells, setActiveBells] = useState({});

  const navigate = useNavigate();

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const bellAudioRef = useRef(new Audio(bellSound));
  const bellLoopRef = useRef(null);

  /*Sticky shadow on scroll*/
  useEffect(() => {
    const container = document.querySelector(".main-content");
    if (!container) return;

    const onScroll = () => setScrolled(container.scrollTop > 0);
    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  /*  Click outside close*/
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setReadOrderIds(prev =>
      prev.filter(id =>
        orders.some(
          o => o.id === id && o.status?.toLowerCase() !== "completed"
        )
      )
    );
  }, [orders]);

  /* ──────────────────────────────────────────────────────────────────
     🔔 Bell audio helpers
  ────────────────────────────────────────────────────────────────── */
  const startBellAudio = () => {
    const audio = bellAudioRef.current;
    if (!audio || bellLoopRef.current) return; // already looping

    const loop = () => {
      audio.currentTime = 0;
      audio.play().catch(() => { });
    };

    audio.addEventListener("ended", loop);
    bellLoopRef.current = loop;

    audio.currentTime = 0;
    audio.play().catch(() => { });
  };

  const stopBellAudio = () => {
    const audio = bellAudioRef.current;
    if (!audio) return;

    if (bellLoopRef.current) {
      audio.removeEventListener("ended", bellLoopRef.current);
      bellLoopRef.current = null;
    }

    audio.pause();
    audio.currentTime = 0;
  };

  /* ──────────────────────────────────────────────────────────────────
     🔔 Socket listeners — bell events
  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    // Server syncs active bells when admin panel first connects
    const handleSync = (bells) => {
      setActiveBells(bells || {});
      if (Object.keys(bells || {}).length > 0) startBellAudio();
    };

    // A user rang the bell
    const handleBellRing = ({ tableNo }) => {
      setActiveBells(prev => {
        const next = { ...prev, [tableNo]: true };
        return next;
      });
      startBellAudio();
    };

    // Admin (or server) turned off a bell
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ──────────────────────────────────────────────────────────────────
     🔕 Admin dismisses a bell call
  ────────────────────────────────────────────────────────────────── */
  const handleDismissBell = (tableNo) => {
    socket.emit("bell-off", { tableNo });
    // Optimistic local update
    setActiveBells(prev => {
      const next = { ...prev };
      delete next[tableNo];
      if (Object.keys(next).length === 0) stopBellAudio();
      return next;
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const unreadOrders = orders
    .filter(
      o =>
        o.status &&
        o.status.toLowerCase() !== "completed" &&
        !readOrderIds.includes(o.id)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

  const unreadLowStock = ingredients.filter(ing => {
    const max = Number(ing.stockMax || 0);
    const remaining = Number(ing.stockRemaining || 0);
    return max > 0 && (remaining / max) * 100 < 30;
  });

  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diff = expiry - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const expiryNotifications = ingredients
    .map(ing => {
      const daysLeft = getDaysRemaining(ing.expiryDate);

      if (daysLeft !== null && daysLeft <= 15 && daysLeft >= 0) {
        return {
          id: ing.id,
          name: ing.name,
          daysLeft
        };
      }
      return null;
    })
    .filter(Boolean);

  const notificationCount =
    unreadOrders.length +
    (unreadLowStock.length > 0 ? 1 : 0) +
    expiryNotifications.length;

  const displayCount =
    notificationCount > 9 ? "9+" : notificationCount;

  const bellTableList = Object.keys(activeBells);

  return (
    <header className={`topbar ${scrolled ? "topbar-scrolled" : ""}`}>
      {/* LEFT */}
      <div className="topbar-left">
        <h3 className="topbar-title">Admin</h3>
      </div>

      {/* RIGHT */}
      <div className="topbar-right">

        {/* ── BELL CALL BUTTONS (one per active ringing table) ── */}
        {bellTableList.map(tableNo => (
          <button
            key={tableNo}
            className="bell-call-btn blinking"
            onClick={() => handleDismissBell(tableNo)}
            title={`Table ${tableNo} is calling. Click to dismiss.`}
          >
            🔔 Table {tableNo}
          </button>
        ))}

        {/* NOTIFICATIONS */}
        <div className="topbar-icon-wrapper" ref={notifRef}>
          <button
            className="notification-icon-btn"
            onClick={() => {
              setShowNotifications(v => !v);
              setShowProfile(false);
            }}
            aria-label="Notifications"
          >
            <img src={notification} alt="" />

            {notificationCount > 0 && (
              <span className="notification-badge">
                {displayCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown notification-dropdown">
              <h4 className="dropdown-title">Notifications</h4>

              <ul className="notification-list">
                {/* NEW ORDERS */}
                {unreadOrders.map(order => (
                  <li
                    key={order.id}
                    onClick={() => {
                      setReadOrderIds(prev => [...prev, order.id]);
                      setShowNotifications(false);
                      navigate("/orders", {
                        state: { scrollToOrderId: order.id }
                      });
                    }}
                  >
                    <strong>New Order</strong>
                    <span>#{order.id} placed</span>
                  </li>
                ))}

                {/* LOW STOCK (single group notification) */}
                {unreadLowStock.length > 0 && (
                  <li
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/stocks");
                    }}
                  >
                    <strong>Low Stock</strong>
                    <span>
                      {unreadLowStock.length} ingredients below limit
                    </span>
                  </li>
                )}

                {/* EXPIRY ALERTS */}
                {expiryNotifications.map(ing => (
                  <li
                    key={ing.id}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/stocks");
                    }}
                  >
                    <strong>Expiry Alert</strong>
                    <span>
                      {ing.name} expires in {ing.daysLeft} day
                      {ing.daysLeft === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}

                {/* EMPTY STATE */}
                {unreadOrders.length === 0 &&
                  unreadLowStock.length === 0 &&
                  expiryNotifications.length === 0 && (
                    <li>
                      <span>No new notifications</span>
                    </li>
                  )}
              </ul>

              <button
                className="view-all-btn"
                onClick={() => {
                  setShowNotifications(false);
                  navigate("/orders");
                }}
              >
                View all notifications
              </button>
            </div>
          )}
        </div>

        {/* PROFILE */}
        <div className="topbar-icon-wrapper" ref={profileRef}>
          <button
            className="profile-btn"
            onClick={() => {
              setShowProfile(v => !v);
              setShowNotifications(false);
            }}
          >
            <div className="profile-avatar">
              <img src={human} alt="" />
            </div>
            <span className="profile-name">Admin</span>
          </button>

          {showProfile && (
            <div className="dropdown profile-dropdown">
              <div className="profile-info">
                <div className="profile-avatar large">S</div>
                <div>
                  <p className="profile-fullname">Sam Cafe Admin</p>
                  <p className="profile-role">Administrator</p>
                </div>
              </div>

              <div className="dropdown-divider" />

              <button
                className="logout-btn"
                onClick={handleLogout}
              >
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