import React, { useEffect, useRef, useState } from "react";
import "./Topbar.css";
import human from "../../icon/human.png";
import notification from "../../icon/notification.png";

const Topbar = ({ setIsAuthenticated }) => {
  const [scrolled, setScrolled] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

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

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <header className={`topbar ${scrolled ? "topbar-scrolled" : ""}`}>
      {/* LEFT */}
      <div className="topbar-left">
        <h3 className="topbar-title">Sam Cafe Admin</h3>
      </div>

      {/* RIGHT */}
      <div className="topbar-right">
        {/* NOTIFICATIONS */}
        <div className="topbar-icon-wrapper" ref={notifRef}>
          <button
            className="notification-icon-btn"
            onClick={() => {
              setShowNotifications((v) => !v);
              setShowProfile(false);
            }}
            aria-label="Notifications"
          >
            <img src={notification} alt="" />
            <span className="notif-dot" />
          </button>

          {showNotifications && (
            <div className="dropdown notification-dropdown">
              <h4 className="dropdown-title">Notifications</h4>

              <ul className="notification-list">
                <li>
                  <strong>New Order</strong>
                  <span>#ORD-2391 placed</span>
                </li>
                <li>
                  <strong>Low Stock</strong>
                  <span>Mozzarella Cheese</span>
                </li>
                <li>
                  <strong>Payment Success</strong>
                  <span>₹1,240 received</span>
                </li>
              </ul>

              <button className="view-all-btn">
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
              setShowProfile((v) => !v);
              setShowNotifications(false);
            }}
          >
            <div className="profile-avatar"><img src={human} alt="" /></div>
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
