import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import {
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export function Home() {
  const { user, wallet, refreshWallet } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [limits, setLimits] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        await refreshWallet();
        const [txData, limitData] = await Promise.allSettled([
          apiRequest("/api/wallet/transactions?limit=5"),
          apiRequest("/api/wallet/limits"),
        ]);
        if (txData.status === "fulfilled") setTransactions(txData.value?.transactions || []);
        if (limitData.status === "fulfilled") setLimits(limitData.value);
      } catch {
        // Fallback gracefully
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const balancePoisha = wallet?.balance || "0";
  const status = wallet?.status || "ACTIVE";

  const quickActions = [
    { title: "Send Money", path: "/send", icon: ArrowUpRight, color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
    { title: "Add Money", path: "/add-money", icon: ArrowDownLeft, color: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)" },
    { title: "Pay Merchant", path: "/pay", icon: QrCode, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
    { title: "Cash Out", path: "/cash-out", icon: ArrowUpRight, color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Account Frozen Alert Banner if applicable */}
      {status === "FROZEN" && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            color: "#f87171",
          }}
        >
          <AlertTriangle size={24} />
          <div>
            <div style={{ fontWeight: 700 }}>Account Temporarily Frozen</div>
            <div style={{ fontSize: "0.85rem", color: "#fca5a5" }}>
              Your account has been placed on security hold. Outgoing transfers and payments are paused. Contact support.
            </div>
          </div>
        </div>
      )}

      {/* Hero Balance Card */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #131b2e 0%, #172554 100%)",
          border: "1px solid #1e3a8a",
          padding: "2rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8" }}>Payora Wallet Balance</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
                title={showBalance ? "Hide balance" : "Show balance"}
              >
                {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div style={{ fontSize: "2.75rem", fontWeight: 800, color: "#f8fafc", margin: "0.5rem 0", letterSpacing: "-0.03em" }}>
              {showBalance ? `৳ ${formatTaka(balancePoisha)}` : "৳ •••••••"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className={`badge ${status === "ACTIVE" ? "badge-success" : "badge-danger"}`}>
                {status}
              </span>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                BDT • Double-Entry Backed
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right", alignSelf: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Account Owner</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#f8fafc" }}>{user?.name}</div>
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>{user?.phone}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              to={action.path}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "1.25rem",
                gap: "0.75rem",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  backgroundColor: action.bg,
                  color: action.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={24} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8fafc" }}>{action.title}</span>
            </Link>
          );
        })}
      </div>

      {/* Spending Limits & Safety Overview */}
      <div className="grid-cols-2">
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <TrendingUp size={18} color="#10b981" />
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Daily Spending Limit</h3>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
            <span style={{ color: "#94a3b8" }}>Daily Allowance:</span>
            <span style={{ fontWeight: 700, color: "#f8fafc" }}>৳ {formatTaka(limits?.dailySendLimit || "5000000")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
            <span style={{ color: "#94a3b8" }}>Per-Transaction Max:</span>
            <span style={{ fontWeight: 700, color: "#f8fafc" }}>৳ {formatTaka(limits?.perTxnLimit || "2500000")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span style={{ color: "#94a3b8" }}>Monthly Cap:</span>
            <span style={{ fontWeight: 700, color: "#f8fafc" }}>৳ {formatTaka(limits?.monthlyLimit || "20000000")}</span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <ShieldCheck size={18} color="#06b6d4" />
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Security & Invariants</h3>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.6 }}>
            Every taka is strictly conserved via double-entry journal records. All outgoing transfers require your 5-digit PIN and are protected by row locks and transactional idempotency.
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={18} color="#94a3b8" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Recent Transactions</h3>
          </div>
          <Link to="/transactions" style={{ fontSize: "0.85rem", color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center" }}>
            View all <ChevronRight size={14} />
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
            No transactions yet. Start by adding money or sending to a friend.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {transactions.map((tx) => (
              <div
                key={tx.id || tx.reference}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.85rem 1rem",
                  backgroundColor: "#0e1526",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{tx.type}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {tx.reference} • {new Date(tx.createdAt || tx.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: tx.direction === "CREDIT" || tx.type === "TOP_UP" ? "#10b981" : "#f8fafc",
                    }}
                  >
                    {tx.direction === "CREDIT" || tx.type === "TOP_UP" ? "+ " : "- "}
                    ৳ {formatTaka(tx.amount)}
                  </div>
                  <span className={`badge ${tx.status === "COMPLETED" ? "badge-success" : "badge-warning"}`} style={{ fontSize: "0.65rem" }}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
