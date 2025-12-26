import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import './Sidebar.css';

const menu = [
  { label: "Dashboard", path: "/", icon: "📊" },
  { label: "Categories", path: "/categories", icon: "C" },
  { label: "Dishes", path: "/dishes", icon: "D" },
  { label: "Ingredients", path: "/ingredients", icon: "I" }
];

const Sidebar = ({ isOpen }) => {
  return (
    <motion.aside
      className="sidebar"
      initial={false}
      animate={{ width: isOpen ? 240 : 80 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >

      <div className="sidebar-brand">
        <span className="brand-icon" style={{margin: isOpen ? '0' : '0 auto'}}>S</span>
        {isOpen && <span className="brand-text">Sam Cafe</span>}
      </div>

      <nav className="sidebar-menu">
        {menu.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className="sidebar-link"
          >
            <span className="sidebar-icon" style={{margin: isOpen ? '0' : '0 auto'}}>{item.icon}</span>
            {isOpen && <span className="sidebar-text">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {isOpen ? "Admin Panel v1.0" : "v1"}
      </div>
    </motion.aside>
  );
}

export default Sidebar;