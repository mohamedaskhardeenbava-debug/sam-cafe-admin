import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import "./Sidebar.css";
import dashboardIcon from "../../icon/dashboard-icon.png";
import categoryIcon from "../../icon/category-icon.png";
import dishIcon from "../../icon/dish-icon.png";
import eventIcon from "../../icon/event-icon.png";
import ingredientIcon from "../../icon/ingredient-icon.png";
import stockIcon from "../../icon/stock-icon.png";
import themeIcon from "../../icon/theme-icon.png";
import orderIcon from "../../icon/order-icon.png";
import offerIcon from "../../icon/offer-icon.png";
import userIcon from "../../icon/user-icon.png";
import favouriteIcon from "../../icon/favourite-icon.png";
import staffIcon from "../../icon/staff-icon.png";
import logo from "../../icon/logo.png";
import logoShrink from "../../icon/logo-shrink.png";
import React, { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useCategoryCards } from "../../context/CategoryCardsContext";

const BASE_MENU = [
  { label: "Dashboard", path: "/", icon: dashboardIcon },
  { label: "Categories", path: "/categories", icon: categoryIcon, module: "categories" },
  { label: "Dishes", path: "/dishes", icon: dishIcon, module: "categories" },
  { label: "Ingredients", path: "/ingredients", icon: ingredientIcon, module: "ingredients" },
  { label: "Stocks", path: "/stocks", icon: stockIcon, module: "ingredients" },
  { label: "Combo", path: "/combo-offers", icon: stockIcon, module: "combo_offers", cardKey: "combo" },
  { label: "Favourites", path: "/favourites", icon: favouriteIcon, module: "favourites" },
  { label: "Orders", path: "/orders", icon: orderIcon, module: "orders" },
  { label: "To-Do", path: "/todo", icon: staffIcon },
  {
    label: "Events",
    icon: eventIcon,
    module: "events",
    cardKey: "events",
    children: [
      { label: "Events", path: "/events" },
      { label: "Reservations", path: "/reservations" },
      { label: "Celebrations", path: "/celebrations" },
      { label: "Pre Bookings", path: "/prebookings" },
      { label: "Catering", path: "/catering" },
    ],
  },
  { label: "Users", path: "/users", icon: userIcon, module: "users" },
  {
    label: "Staff",
    icon: staffIcon,
    module: "staff",
    children: [
      { label: "All Staff", path: "/staffs" },
      { label: "Attendance", path: "/staff-attendance" },
      { label: "Salary", path: "/staff-salary" },
      { label: "Career", path: "/staff-career" },
      { label: "Training", path: "/staff-training" },
    ],
  },
  {
    label: "Kitchen",
    icon: staffIcon,
    department: "kitchen",
    children: [
      { label: "Recipe", path: "/kitchen-recipe" },
      { label: "Grooming", path: "/kitchen-grooming" },
      { label: "Staff Assigning", path: "/kitchen-assign" },
      { label: "Mise & Cleaning", path: "/kitchen-mise" },
      { label: "Activity Log", path: "/kitchen-activity" },
      { label: "Schedules", path: "/kitchen-schedules" },
      { label: "Reports", path: "/kitchen-reports" },
    ],
  },
  {
    label: "Service",
    icon: staffIcon,
    department: "service",
    children: [
      { label: "Grooming", path: "/service-grooming" },
      { label: "Staff Assigning", path: "/service-assign" },
      { label: "Mise & Cleaning", path: "/service-mise" },
      { label: "Activity Log", path: "/service-activity" },
      { label: "Schedules", path: "/service-schedules" },
      { label: "Tables", path: "/tables" },
      { label: "Reports", path: "/service-reports" },
    ],
  },
  { label: "Offers", path: "/offers", icon: offerIcon, module: "offers", cardKey: "offers" },
  { label: "Venues", path: "/venues", icon: staffIcon, superAdminOnly: true },
  { label: "Roles and Responsibilities", path: "/permissions", icon: staffIcon, superAdminOnly: true },
  { label: "Category Cards", path: "/category-cards", icon: categoryIcon, superAdminOnly: true },
  { label: "Audit Logs", path: "/audit-logs", icon: staffIcon, superAdminOnly: true },
  { label: "Theme Settings", path: "/theme-settings", icon: themeIcon, superAdminOnly: true },
];

const HOVER_CLOSE_DELAY = 120; // ms grace period so moving link -> menu doesn't flicker-close

// Positions the floating submenu next to a collapsed sidebar-link, clamped
// to stay within the viewport vertically.
const computeHoverPosition = (index, rect) => {
  const dropdownHeight = 220; // approx height
  const viewportHeight = window.innerHeight;

  let top = rect.top;
  if (top + dropdownHeight > viewportHeight - 10) {
    top = viewportHeight - dropdownHeight - 10;
  }
  if (top < 10) {
    top = 10;
  }

  return { index, top, left: rect.right + 8 };
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [openMenu, setOpenMenu] = useState(null);
  const [hoverMenu, setHoverMenu] = useState(null);
  const location = useLocation();
  const closeTimerRef = React.useRef(null);
  const { admin, isSuperAdmin, hasModulePermission } = useAuth();
  const { isComboEnabled, isOffersEnabled, isEventsEnabled } = useCategoryCards();

  // Whether a card-gated item's underlying card is enabled. Combo/Offers/
  // Events are hidden from BOTH panels when their card is disabled — that
  // decision lives with the Super Admin via the Category Cards page and
  // applies here regardless of role, including Super Admin themself, so
  // the module truly disappears rather than just being hidden from staff.
  const CARD_ENABLED = {
    combo: isComboEnabled,
    offers: isOffersEnabled,
    events: isEventsEnabled,
  };

  // Build the visible menu for this admin:
  //  - Card-gated items (Combo/Offers/Events) are dropped for everyone,
  //    including Super Admin, whenever their category card is disabled.
  //  - Super Admin: sees everything else, including the admin-only screens
  //  - Everyone else: department-gated items (Kitchen/Service) only show
  //    for their own department; module-gated items only show if their
  //    roleTitle has at least read access per the permission matrix;
  //    superAdminOnly items never show.
  const menu = useMemo(() => {
    const cardFiltered = BASE_MENU.filter((item) => !item.cardKey || CARD_ENABLED[item.cardKey] !== false);
    if (isSuperAdmin) return cardFiltered;
    return cardFiltered.filter((item) => {
      if (item.superAdminOnly) return false;
      if (item.department && item.department !== admin?.department) return false;
      if (item.module && !hasModulePermission(item.module, "read")) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, admin, hasModulePermission, isComboEnabled, isOffersEnabled, isEventsEnabled]);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setHoverMenu(null);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY);
  };

  React.useEffect(() => () => cancelClose(), []);

  // Auto-open submenu if a child route is active
  React.useEffect(() => {
    menu.forEach((item, index) => {
      if (item.children) {
        const isChildActive = item.children.some(
          (child) => location.pathname === child.path || location.pathname.startsWith(child.path + "/")
        );
        if (isChildActive) setOpenMenu(index);
      }
    });
  }, [location.pathname, menu]);

  // Auto-collapse the sidebar on narrow screens (<578px)
  React.useEffect(() => {
    const AUTO_COLLAPSE_BREAKPOINT = 578;

    const handleResize = () => {
      if (window.innerWidth < AUTO_COLLAPSE_BREAKPOINT) {
        setIsOpen(false);
      }
    };

    // Check on mount in case the page already loads narrow
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setIsOpen]);

  return (
    <motion.aside
      className="sidebar"
      initial={false}
      animate={{ width: isOpen ? 248 : 72 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* ── BRAND ── */}
      <div
        className="sidebar-brand"
        onClick={() => setIsOpen((prev) => !prev)}
        title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        <div className="brand-icon-wrap">
          <img src={logoShrink} alt="Sam Cafe" className="brand-icon-img" />
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="brand-logo-wrap"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <img src={logo} alt="Sam Cafe" className="brand-logo-img" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="sidebar-toggle-icon"
          animate={{ rotate: isOpen ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>

      {/* ── NAV ── */}
      <nav className="sidebar-nav">
        <div className="sidebar-menu">
          {menu.map((item, index) => {
            if (item.children) {
              const isAnyChildActive = item.children.some(
                (child) => location.pathname === child.path || location.pathname.startsWith(child.path + "/")
              );
              const isExpanded = openMenu === index;
              const isCollapsed = !isOpen;

              return (
                <div key={index} className="sidebar-group">
                  <button
                    className={`sidebar-link ${isAnyChildActive ? "sidebar-link-active" : ""}`}
                    onClick={(e) => {
                      if (isOpen) {
                        setOpenMenu(isExpanded ? null : index);
                      } else {
                        // Stage 4: clicking the trigger toggles the
                        // floating menu open/closed in collapsed mode.
                        cancelClose();
                        setHoverMenu((prev) =>
                          prev?.index === index ? null : computeHoverPosition(index, e.currentTarget.getBoundingClientRect())
                        );
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isOpen) {
                        cancelClose();
                        setHoverMenu(computeHoverPosition(index, e.currentTarget.getBoundingClientRect()));
                      }
                    }}
                    onMouseLeave={() => {
                      if (!isOpen) {
                        // Stage 3: unhovering the trigger schedules a close;
                        // moving onto the floating menu cancels it (stage 1
                        // then governs when it actually closes).
                        scheduleClose();
                      }
                    }}
                  >
                    <span className="sidebar-icon-wrap">
                      <img src={item.icon} alt="" className="sidebar-icon-img" />
                    </span>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.span
                          className="sidebar-label"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {isOpen && (
                      <motion.span
                        className="sidebar-chevron"
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </motion.span>
                    )}
                  </button>

                  <AnimatePresence>
                    {/* NORMAL EXPAND */}
                    {isOpen && isExpanded && (
                      <motion.div
                        className="sidebar-submenu"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <div className="sidebar-submenu-inner">
                          {item.children.map((sub) => (
                            <NavLink
                              key={sub.path}
                              to={sub.path}
                              className={({ isActive }) =>
                                `sidebar-sublink ${isActive ? "sublink-active" : ""}`
                              }
                            >
                              <span className="sublink-label">{sub.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* FLOATING DROPDOWN */}
                    {!isOpen && hoverMenu?.index === index && (
                      <div
                        className="sidebar-floating-menu"
                        style={{
                          top: hoverMenu.top,
                          left: hoverMenu.left
                        }}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                      >
                        {item.children.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className={({ isActive }) =>
                              `sidebar-sublink ${isActive ? "sublink-active" : ""}`
                            }
                            onClick={() => {
                              cancelClose();
                              setHoverMenu(null);
                            }}
                          >
                            {sub.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
                }
              >
                <span className="sidebar-icon-wrap">
                  <img src={item.icon} alt="" className="sidebar-icon-img" />
                </span>

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      className="sidebar-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* ── FOOTER ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sidebar-footer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="sidebar-footer-inner">
              <div className="sidebar-footer-info">
                <span className="sidebar-footer-name">Sam Cafe</span>
                <span className="sidebar-footer-role">Admin Panel</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};

export default Sidebar;