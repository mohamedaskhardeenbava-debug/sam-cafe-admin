import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Topbar.css";
import human from "../../icon/human.png";
import notification from "../../icon/notification.png";

const Topbar = ({ setIsAuthenticated, orders = [], ingredients = [] }) => {
  const [scrolled, setScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [readOrderIds, setReadOrderIds] = useState([]);
  const navigate = useNavigate();

  const notifRef = useRef(null);
  const profileRef = useRef(null);

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
      if (
        notifRef.current &&
        !notifRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target)
      ) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <header className={`topbar ${scrolled ? "topbar-scrolled" : ""}`}>
      {/* LEFT */}
      <div className="topbar-left">
        <h3 className="topbar-title">Admin</h3>
      </div>

      {/* RIGHT */}
      <div className="topbar-right">

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
