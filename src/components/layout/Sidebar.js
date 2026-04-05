import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";
import dashboardIcon from "../../icon/dashboard-icon.png";
import categoryIcon from "../../icon/category-icon.png";
import dishIcon from "../../icon/dish-icon.png";
import ingredientIcon from "../../icon/ingredient-icon.png";
import stockIcon from "../../icon/stock-icon.png";
import orderIcon from "../../icon/order-icon.png";
import userIcon from "../../icon/user-icon.png";
import favouriteIcon from "../../icon/favourite-icon.png"
import staffIcon from "../../icon/staff-icon.png";
import logo from "../../icon/logo.png";
import logoShrink from "../../icon/logo-shrink.png";
import React, { useState, useRef } from "react";

const menu = [
  { label: "Dashboard", path: "/", icon: dashboardIcon },
  { label: "Categories", path: "/categories", icon: categoryIcon },
  { label: "Dishes", path: "/dishes", icon: dishIcon },
  { label: "Ingredients", path: "/ingredients", icon: ingredientIcon },
  { label: "Stocks", path: "/stocks", icon: stockIcon },
  { label: "Favourites", path: "/favourites", icon: favouriteIcon },
  { label: "Orders", path: "/orders", icon: orderIcon },
  {
    label: "Events",
    icon: orderIcon,
    children: [
      { label: "Reservations", path: "/events/reservations" },
      { label: "Celebrations", path: "/events/celebrations" },
      { label: "PreBookings", path: "/events/prebookings" },
      { label: "Catering", path: "/events/catering" }
    ]
  },
  { label: "Users", path: "/users", icon: userIcon },
  {
    label: "Staff",
    icon: staffIcon,
    children: [
      { label: "All Staff", path: "/staffs" },
      { label: "Attendance", path: "/staff-attendance" },
      { label: "Salary", path: "/staff-salary" },
      { label: "Career", path: "/staff-career" },
      { label: "Training", path: "/staff-training" }
    ]
  },
  {
    label: "Kitchen",
    icon: staffIcon,
    children: [
      { label: "Recipe", path: "/kitchen-recipe" },
      { label: "Grooming", path: "/kitchen-grooming" },
      { label: "Staff Assigning", path: "/kitchen-assign" },
      { label: "Mise & Cleaning", path: "/kitchen-mise" },
      { label: "Reports", path: "/kitchen-reports" }
    ]
  },
  {
    label: "Service",
    icon: staffIcon,
    children: [
      { label: "Grooming", path: "/service-grooming" },
      { label: "Staff Assigning", path: "/service-assign" },
      { label: "Mise & Cleaning", path: "/service-mise" },
      { label: "Tables", path: "/tables" },
      { label: "Reports", path: "/service-reports" }
    ]
  },
  { label: "Offers", path: "/offers", icon: dishIcon }
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  const [openMenu, setOpenMenu] = useState(null);
  const itemRefs = useRef({});

  return (
    <motion.aside
      className="sidebar"
      initial={false}
      animate={{ width: isOpen ? 240 : 80 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* BRAND */}
      <div
        className="sidebar-brand"
        onClick={() => setIsOpen(prev => !prev)}
        style={{ cursor: "pointer" }}
      >
        <span className="brand-icon">
          <img
            src={logoShrink}
            alt="Sam Cafe"
            className={`logo ${isOpen ? "hidden" : "visible"}`}
            loading="lazy"
            decoding="async"
          />
        </span>

        <span className="brand-logo">
          <img
            src={logo}
            alt="Sam Cafe"
            className={`logo ${isOpen ? "visible" : "hidden"}`}
            loading="lazy"
            decoding="async"
          />
        </span>
      </div>

      <nav className="sidebar-menu">
        {menu.map((item, index) => {

          if (item.children) {
            return (
              <div
                key={index}
                ref={(el) => (itemRefs.current[index] = el)}
              >
                <div
                  className="sidebar-link"
                  onClick={() =>
                    setOpenMenu(openMenu === index ? null : index)
                  }
                >
                  <span className="sidebar-icon">
                    <img src={item.icon} alt="" />
                  </span>

                  <span className={`sidebar-text ${isOpen ? "show" : "hide"}`}>
                    {item.label}
                  </span>

                  {/* ✅ Arrow */}
                  <span
                    className={`sidebar-arrow ${openMenu === index ? "open" : ""
                      }`}
                  >

                  </span>
                </div>

                <AnimatePresence>
                  {openMenu === index && (
                    <motion.div
                      className="sidebar-submenu"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      {item.children.map(sub => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          className="sidebar-sublink"
                        >
                          {sub.label}
                        </NavLink>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <NavLink key={item.path} to={item.path} className="sidebar-link">
              <span className="sidebar-icon">
                <img src={item.icon} alt="" />
              </span>
              <span className={`sidebar-text ${isOpen ? "show" : "hide"}`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </motion.aside>
  );
};

export default Sidebar;


/*
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";
import dashboardIcon from "../../icon/dashboard-icon.png";
import categoryIcon from "../../icon/category-icon.png";
import dishIcon from "../../icon/dish-icon.png";
import ingredientIcon from "../../icon/ingredient-icon.png";
import stockIcon from "../../icon/stock-icon.png";
import orderIcon from "../../icon/order-icon.png";
import userIcon from "../../icon/user-icon.png";
import favouriteIcon from "../../icon/favourite-icon.png"
import staffIcon from "../../icon/staff-icon.png";
import logo from "../../icon/logo.png";
import logoShrink from "../../icon/logo-shrink.png";
import React, { useState, useEffect } from "react";

const menu = [
  { label: "Dashboard", path: "/", icon: dashboardIcon },
  { label: "Categories", path: "/categories", icon: categoryIcon },
  { label: "Dishes", path: "/dishes", icon: dishIcon },
  { label: "Ingredients", path: "/ingredients", icon: ingredientIcon },
  { label: "Stocks", path: "/stocks", icon: stockIcon },
  { label: "Favourites", path: "/favourites", icon: favouriteIcon },
  { label: "Orders", path: "/orders", icon: orderIcon },
  { label: "Users", path: "/users", icon: userIcon },
  { label: "Staffs", path: "/staffs", icon: staffIcon },
];

const Sidebar = ({ isOpen, setIsOpen }) => {
  return (
    <motion.aside
      className="sidebar"
      initial={false}
      animate={{ width: isOpen ? 240 : 80 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      
      <div
        className="sidebar-brand"
        onClick={() => setIsOpen(prev => !prev)}
        style={{ cursor: "pointer" }}
      >
        <span className="brand-icon">
          <img
            src={logoShrink}
            alt="Sam Cafe"
            className={`logo ${isOpen ? "hidden" : "visible"}`}
            loading="lazy"
            decoding="async"
          />
        </span>

        <span className="brand-logo">
          <img
            src={logo}
            alt="Sam Cafe"
            className={`logo ${isOpen ? "visible" : "hidden"}`}
            loading="lazy"
            decoding="async"
          />
        </span>
      </div>

      <nav className="sidebar-menu">
        {menu.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <span className="sidebar-icon">
              <img src={item.icon} alt={item.label} />
            </span>
            <span className={`sidebar-text ${isOpen ? "show" : "hide"}`}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
};


export default Sidebar;

*/