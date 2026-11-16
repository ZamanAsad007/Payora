import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  History,
  Users,
  FileText,
  Bell,
  ShieldAlert,
  LogOut,
  Lock,
  ChevronDown,
} from "lucide-react";

export function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  // Close dropdown on click outside or escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate("/login");
  };

  // Primary navigation links shown directly in the top navbar
  const primaryNavItems = [
    { name: "Home", path: "/", icon: Wallet },
    { name: "Send", path: "/send", icon: ArrowUpRight },
    { name: "Add Money", path: "/add-money", icon: ArrowDownLeft },
    { name: "History", path: "/transactions", icon: History },
  ];

  // Secondary services moved into the right-side profile dropdown
  const walletServices = [
    { name: "Pay Merchant", path: "/pay", icon: QrCode },
    { name: "Cash Out", path: "/cash-out", icon: ArrowUpRight },
    { name: "Saved Payees", path: "/payees", icon: Users },
    { name: "Statements", path: "/statements", icon: FileText },
  ];

  const userInitial = user?.name ? user.name.trim().charAt(0).toUpperCase() : "U";
  const userRole = (user?.role || "USER").toUpperCase();

  return (
    <header style={{ backgroundColor: "#0e1526", borderBottom: "1px solid #1e293b", position: "relative", zIndex: 100 }}>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0.75rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        {/* Left: Brand + Primary Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "1.1rem",
                color: "#042f2e",
              }}
            >
              ৳
            </div>
            <span style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.03em", color: "#f8fafc" }}>
              Payora
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "0.15rem 0.4rem",
                borderRadius: "4px",
                fontWeight: 700,
              }}
            >
              v1.0
            </span>
          </Link>

          {/* Desktop Primary Nav: Only the essential items */}
          <nav className="desktop-nav-items" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`nav-link ${isActive ? "active" : ""}`}
                >
                  <Icon size={16} color={isActive ? "#10b981" : "#94a3b8"} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick Notification + Profile Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {/* Quick Notifications Button */}
          <Link
            to="/notifications"
            className="nav-icon-btn"
            title="Notifications"
            style={{
              width: "38px",
              height: "38px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              backgroundColor: location.pathname === "/notifications" ? "#1e293b" : "transparent",
              color: location.pathname === "/notifications" ? "#10b981" : "#94a3b8",
              border: location.pathname === "/notifications" ? "1px solid #334155" : "1px solid transparent",
              transition: "all 0.15s ease",
            }}
          >
            <Bell size={18} />
          </Link>

          {/* Profile Dropdown */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="profile-trigger-btn"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.35rem 0.65rem",
                borderRadius: "8px",
                backgroundColor: profileOpen ? "#1e293b" : "#131b2e",
                border: profileOpen ? "1px solid #334155" : "1px solid #1e293b",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {/* User Avatar */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "#042f2e",
                  flexShrink: 0,
                }}
              >
                {userInitial}
              </div>

              {/* User Name & Role */}
              <div style={{ textAlign: "left", lineHeight: "1.2" }} className="profile-trigger-text">
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "#f8fafc",
                    maxWidth: "110px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.name || "User"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  {userRole}
                </div>
              </div>

              <ChevronDown
                size={15}
                color="#94a3b8"
                style={{
                  transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div
                className="dropdown-menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  width: "280px",
                  backgroundColor: "#131b2e",
                  border: "1px solid #1e293b",
                  borderRadius: "12px",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
                  padding: "0.5rem 0",
                  zIndex: 1000,
                }}
              >
                {/* User Identity Header */}
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #1e293b" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "1rem",
                        color: "#042f2e",
                        flexShrink: 0,
                      }}
                    >
                      {userInitial}
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: "#f8fafc",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user?.name || "User"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                        {user?.phone}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        backgroundColor:
                          userRole === "ADMIN"
                            ? "rgba(245, 158, 11, 0.15)"
                            : userRole === "MERCHANT"
                            ? "rgba(6, 182, 212, 0.15)"
                            : "rgba(16, 185, 129, 0.15)",
                        color:
                          userRole === "ADMIN"
                            ? "#fbbf24"
                            : userRole === "MERCHANT"
                            ? "#38bdf8"
                            : "#34d399",
                        border:
                          userRole === "ADMIN"
                            ? "1px solid rgba(245, 158, 11, 0.3)"
                            : userRole === "MERCHANT"
                            ? "1px solid rgba(6, 182, 212, 0.3)"
                            : "1px solid rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      {userRole}
                    </span>

                    {!user?.hasPin && (
                      <Link
                        to="/pin-setup"
                        onClick={() => setProfileOpen(false)}
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <Lock size={10} />
                        Set PIN
                      </Link>
                    )}
                  </div>
                </div>

                {/* Mobile-only Navigation Links */}
                <div className="mobile-nav-items" style={{ borderBottom: "1px solid #1e293b", padding: "0.25rem 0" }}>
                  <div className="dropdown-section-title">Navigation</div>
                  {primaryNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`dropdown-item ${isActive ? "active" : ""}`}
                        onClick={() => setProfileOpen(false)}
                      >
                        <Icon size={16} color={isActive ? "#10b981" : "#94a3b8"} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Wallet Services */}
                <div style={{ padding: "0.25rem 0", borderBottom: "1px solid #1e293b" }}>
                  <div className="dropdown-section-title">Wallet Services</div>
                  {walletServices.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        className={`dropdown-item ${isActive ? "active" : ""}`}
                        onClick={() => setProfileOpen(false)}
                      >
                        <Icon size={16} color={isActive ? "#10b981" : "#94a3b8"} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Account & Administration */}
                <div style={{ padding: "0.25rem 0", borderBottom: "1px solid #1e293b" }}>
                  <div className="dropdown-section-title">Account & Security</div>

                  <Link
                    to="/notifications"
                    className={`dropdown-item ${location.pathname === "/notifications" ? "active" : ""}`}
                    onClick={() => setProfileOpen(false)}
                  >
                    <Bell size={16} color={location.pathname === "/notifications" ? "#10b981" : "#94a3b8"} />
                    <span>Notification Inbox</span>
                  </Link>

                  <Link
                    to="/pin-setup"
                    className={`dropdown-item ${location.pathname === "/pin-setup" ? "active" : ""}`}
                    onClick={() => setProfileOpen(false)}
                  >
                    <Lock size={16} color={location.pathname === "/pin-setup" ? "#10b981" : "#94a3b8"} />
                    <span>{user?.hasPin ? "Change Transaction PIN" : "Setup PIN"}</span>
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/admin"
                      className={`dropdown-item ${location.pathname === "/admin" ? "active" : ""}`}
                      onClick={() => setProfileOpen(false)}
                      style={{ color: "#fbbf24" }}
                    >
                      <ShieldAlert size={16} color="#fbbf24" />
                      <span style={{ fontWeight: 600 }}>Admin Dashboard</span>
                    </Link>
                  )}
                </div>

                {/* Sign Out */}
                <div style={{ padding: "0.25rem 0" }}>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="dropdown-item danger"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
