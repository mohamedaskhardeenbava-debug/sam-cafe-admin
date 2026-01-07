import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";
import dashboardIcon from "../../icon/dashboard-icon.png";
import categoryIcon from "../../icon/category-icon.png";
import dishIcon from "../../icon/dish-icon.png";
import ingredientIcon from "../../icon/ingredient-icon.png";
import stockIcon from "../../icon/stock-icon.png";
import logo from "../../icon/logo.png";
import logoShrink from "../../icon/logo-shrink.png";
import React, { useState, useEffect } from "react";

const menu = [
  { label: "Dashboard", path: "/", icon: dashboardIcon },
  { label: "Categories", path: "/categories", icon: categoryIcon },
  { label: "Dishes", path: "/dishes", icon: dishIcon },
  { label: "Ingredients", path: "/ingredients", icon: ingredientIcon },
  { label: "Stocks", path: "/stocks", icon: stockIcon },
  { label: "Favourites", path: "/favourites", icon: dishIcon }
];

const Sidebar = ({ isOpen, setIsOpen }) => {
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
        {!isOpen && (
          <span className="brand-icon">
            <img src={logoShrink} alt="Sam Cafe" />
          </span>
        )}

        {isOpen && (
          <span className="brand-logo">
            <img src={logo} alt="Sam Cafe" />
          </span>
        )}
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
            {isOpen && <span className="sidebar-text">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
};


export default Sidebar;
