import React from "react";
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
} from "lucide-react";

export function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Home", path: "/", icon: Wallet },
    { name: "Send", path: "/send", icon: ArrowUpRight },
    { name: "Add Money", path: "/add-money", icon: ArrowDownLeft },
    { name: "Pay Merchant", path: "/pay", icon: QrCode },
    { name: "Cash Out", path: "/cash-out", icon: ArrowUpRight },
    { name: "History", path: "/transactions", icon: History },
    { name: "Payees", path: "/payees", icon: Users },
    { name: "Statements", path: "/statements", icon: FileText },
    { name: "Notifications", path: "/notifications", icon: Bell },
  ];

  return (
    <header style={{ backgroundColor: "#0e1526", borderBottom: "1px solid #1e293b" }}>
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0.85rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
            <span style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.03em" }}>
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

          <nav style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: isActive ? "#ffffff" : "#94a3b8",
                    backgroundColor: isActive ? "#1e293b" : "transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={15} color={isActive ? "#10b981" : "#94a3b8"} />
                  {item.name}
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                to="/admin"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#fbbf24",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                }}
              >
                <ShieldAlert size={15} />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {!user?.hasPin && (
            <Link
              to="/pin-setup"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.8rem",
                padding: "0.35rem 0.65rem",
                borderRadius: "6px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontWeight: 600,
              }}
            >
              <Lock size={13} />
              Set PIN
            </Link>
          )}

          <div style={{ textAlign: "right", fontSize: "0.8rem" }}>
            <div style={{ fontWeight: 600, color: "#f8fafc" }}>{user?.name || "User"}</div>
            <div style={{ color: "#64748b" }}>{user?.phone}</div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#94a3b8",
              padding: "0.5rem",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
