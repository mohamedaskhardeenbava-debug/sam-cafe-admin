import './Topbar.css'
import { useState, useEffect } from 'react';

const Topbar = ({ isSidebarOpen, setIsSidebarOpen }) => {

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector(".app-main");

    if (!scrollContainer) return;

    const handleScroll = () => {
      setScrolled(scrollContainer.scrollTop > 0);
    };

    scrollContainer.addEventListener("scroll", handleScroll);

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);


  return (
    <div className={`topbar ${scrolled ? "topbar-scrolled" : ""}`}>
      <div className="topbar-left">
        <button
          className="sidebar-toggle"
          onClick={() => setIsSidebarOpen(prev => !prev)}
          aria-label="Toggle Sidebar"
        >
          ☰
        </button>

        <h3 className="topbar-title">Sam Cafe Admin</h3>
      </div>

      <div className="topbar-right">
        <span className="admin-name">Admin</span>
        <div className="admin-avatar">S</div>
      </div>
    </div>
  );
}

export default Topbar;