import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Home, History, QrCode, Users, User } from "lucide-react";

export function BottomNav() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const currentPath = location.pathname;

  return (
    <nav className="taka-mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="taka-bottom-nav-inner">
        {/* 1. Home */}
        <Link
          to="/"
          className={`taka-bottom-nav-item ${currentPath === "/" ? "active" : ""}`}
        >
          <Home size={22} strokeWidth={currentPath === "/" ? 2.5 : 2} />
          <span>Home</span>
        </Link>

        {/* 2. Activity / History */}
        <Link
          to="/transactions"
          className={`taka-bottom-nav-item ${currentPath === "/transactions" ? "active" : ""}`}
        >
          <History size={22} strokeWidth={currentPath === "/transactions" ? 2.5 : 2} />
          <span>Activity</span>
        </Link>

        {/* 3. Center Elevated Scan QR FAB */}
        <div className="taka-qr-fab-wrapper">
          <Link
            to="/pay"
            className="taka-qr-fab"
            title="Scan Bangla QR"
            aria-label="Scan Bangla QR to Pay Merchant"
          >
            <QrCode size={28} />
          </Link>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: currentPath === "/pay" ? "#34d399" : "var(--text-secondary)",
              marginTop: "0.25rem",
            }}
          >
            Scan
          </span>
        </div>

        {/* 4. Saved Payees */}
        <Link
          to="/payees"
          className={`taka-bottom-nav-item ${currentPath === "/payees" ? "active" : ""}`}
        >
          <Users size={22} strokeWidth={currentPath === "/payees" ? 2.5 : 2} />
          <span>Payees</span>
        </Link>

        {/* 5. Statements / Profile */}
        <Link
          to="/statements"
          className={`taka-bottom-nav-item ${currentPath === "/statements" ? "active" : ""}`}
        >
          <User size={22} strokeWidth={currentPath === "/statements" ? 2.5 : 2} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  );
}

export default BottomNav;
