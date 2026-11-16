import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import {
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  Eye,
  EyeOff,
  Copy,
  Check,
  Star,
  Users,
  Plus,
  Store,
  Building2,
  Receipt,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowDown,
  ArrowUp,
  CreditCard,
  Landmark,
  ShieldAlert,
} from "lucide-react";

export function Home() {
  const { user, wallet, refreshWallet } = useAuth();
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [payees, setPayees] = useState([]);
  const [limits, setLimits] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Default demo payees matching Stitch UI if none in API yet
  const defaultPayees = [
    { id: "p1", name: "Ayesha", phone: "01700000002", relation: "Sister", initials: "AY", bg: "#d1e5f5", color: "#091e29" },
    { id: "p2", name: "Tanvir", phone: "01700000003", relation: "City Bank", initials: "TA", bg: "#ffdea5", color: "#271900" },
    { id: "p3", name: "Mitu", phone: "01700000004", relation: "Coworker", initials: "MI", bg: "#ffdad6", color: "#93000a" },
    { id: "p4", name: "Hasan", phone: "01700000005", relation: "Landlord", initials: "HA", bg: "#d4e7de", color: "#0f1f1a" },
    { id: "p5", name: "Fahim", phone: "01700000006", relation: "Developer", initials: "FA", bg: "#85f8c4", color: "#002114" },
  ];

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        await refreshWallet();
        const [txData, limitData, payeeData] = await Promise.allSettled([
          apiRequest("/api/wallet/transactions?limit=6"),
          apiRequest("/api/wallet/limits"),
          apiRequest("/api/payees"),
        ]);
        if (txData.status === "fulfilled") setTransactions(txData.value?.transactions || []);
        if (limitData.status === "fulfilled") setLimits(limitData.value);
        if (payeeData.status === "fulfilled" && payeeData.value?.payees?.length > 0) {
          setPayees(payeeData.value.payees);
        } else {
          setPayees(defaultPayees);
        }
      } catch {
        setPayees(defaultPayees);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const balancePoisha = wallet?.balance || "0";
  const status = wallet?.status || "ACTIVE";
  const phoneNumber = user?.phone || "01700-000001";

  const handleCopyPhone = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(phoneNumber).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickActions = [
    { title: "Send", subtitle: "Wallet or NPSB", path: "/send", icon: ArrowUpRight, color: "#34d399" },
    { title: "Add Money", subtitle: "Card or Bank", path: "/add-money", icon: ArrowDownLeft, color: "#38bdf8" },
    { title: "Pay", subtitle: "Scan Bangla QR", path: "/pay", icon: Store, color: "#fbbf24" },
    { title: "Cash Out", subtitle: "Agent / ATM", path: "/cash-out", icon: Building2, color: "#f472b6" },
  ];

  // Helper for transaction styling
  const getTxDetails = (tx) => {
    const isCredit = tx.direction === "CREDIT" || tx.type === "TOP_UP";
    let icon = isCredit ? ArrowDown : ArrowUp;
    let label = tx.type;
    let category = "Wallet Settlement";
    let iconBg = isCredit ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.15)";
    let iconColor = isCredit ? "#34d399" : "#94a3b8";

    if (tx.type === "TOP_UP") {
      label = "Deposit / Add Money";
      category = "City Bank Top-up";
      icon = ArrowDownLeft;
      iconBg = "rgba(16, 185, 129, 0.25)";
      iconColor = "#34d399";
    } else if (tx.type === "MERCHANT_PAYMENT") {
      label = "Paid SuperMart / POS";
      category = "Bangla QR · Groceries";
      icon = Store;
      iconBg = "rgba(245, 158, 11, 0.2)";
      iconColor = "#fbbf24";
    } else if (tx.type === "TRANSFER") {
      label = isCredit ? "Received from Friend" : "Sent to Recipient";
      category = isCredit ? "Peer Transfer In" : "Send Money · P2P";
      icon = isCredit ? ArrowDownLeft : ArrowUpRight;
    } else if (tx.type === "CASH_OUT") {
      label = "ATM Cash Out";
      category = "Agent / Bank Withdrawal";
      icon = Building2;
      iconBg = "rgba(244, 114, 182, 0.2)";
      iconColor = "#f472b6";
    }

    return { isCredit, icon, label, category, iconBg, iconColor };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Account Frozen Alert Banner if applicable */}
      {status === "FROZEN" && (
        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            padding: "1rem 1.25rem",
            borderRadius: "14px",
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

      {/* Top Welcome & Sub-Header Band (Stitch Portal Header) */}
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <span>BANGLADESH FINANCIAL INTERFACE</span>
            <span style={{ width: "4px", height: "4px", borderRadius: "9999px", backgroundColor: "#10b981" }}></span>
            <span style={{ color: "#34d399" }}>DHAKA METRO NODE</span>
          </div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em", marginTop: "0.2rem" }}>
            Good day, {user?.name || "Rafi"}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#94a3b8", marginTop: "0.15rem" }}>
            Real-time double-entry settlement and financial ledger for today.
          </p>
        </div>

        {/* Live Gateway Indicator Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            backgroundColor: "#131b2e",
            border: "1px solid #1e293b",
            padding: "0.45rem 0.85rem",
            borderRadius: "14px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "9999px",
                backgroundColor: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
            ></span>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Live Gateway
            </span>
          </div>
          <span style={{ height: "14px", width: "1px", backgroundColor: "#334155" }}></span>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#34d399" }}>
            &lt; 1.4s NPSB Instant
          </span>
        </div>
      </section>

      {/* 2-Column Master Layout: Left 8-col Flow + Right 4-col Widget Intelligence */}
      <div className="taka-grid-container" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column (8 cols on lg, 12 on mobile/tablet) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="taka-col-main">
          {/* Signature Taka Hero Balance Card */}
          <div className="taka-hero-card">
            {/* Background geometric blur glow orbs */}
            <div className="taka-hero-glow-1"></div>
            <div className="taka-hero-glow-2"></div>

            <div style={{ position: "relative", zIndex: 10 }}>
              {/* Card Header row: Balance title + BDIX tag + Eye Toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#e2f5ec", opacity: 0.9 }}>
                    Available Balance
                  </span>
                  <span className="taka-tag-bdix">BDIX</span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                  title={showBalance ? "Hide balance" : "Show balance"}
                  aria-label="Toggle balance visibility"
                >
                  {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>

              {/* Balance Figure */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.45rem", margin: "0.85rem 0 1rem" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "#85f8c4", userSelect: "none" }}>
                  ৳
                </span>
                <span
                  className="tnum"
                  style={{
                    fontSize: "2.5rem",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    color: "#ffffff",
                    lineHeight: 1.1,
                  }}
                >
                  {showBalance ? formatTaka(balancePoisha) : "••••••••"}
                </span>
              </div>

              {/* Wallet Phone Pill + Reward Badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="taka-wallet-pill"
                  title="Click to copy wallet number"
                >
                  <span>{phoneNumber}</span>
                  {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} style={{ opacity: 0.8 }} />}
                </button>

                <div className="taka-pts-badge">
                  <Star size={14} fill="#febb14" stroke="#febb14" />
                  <span>480 Pts</span>
                </div>
              </div>

              {/* Limit Bar Section */}
              <div style={{ marginTop: "1.25rem", paddingTop: "0.85rem", borderTop: "1px solid rgba(255, 255, 255, 0.18)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem", color: "#e2f5ec", marginBottom: "0.45rem" }}>
                  <span style={{ fontWeight: 600 }}>
                    Daily limit: ৳ {formatTaka(limits?.dailySendLimit ? String(BigInt(limits.dailySendLimit) * 13n / 100n) : "650000")} / ৳ {formatTaka(limits?.dailySendLimit || "2500000")}
                  </span>
                  <span style={{ color: "#febb14", fontWeight: 600 }}>
                    Resets midnight (00:00 BST)
                  </span>
                </div>

                {/* Progress Meter Bar */}
                <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(0, 0, 0, 0.28)", borderRadius: "9999px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: "26%",
                      height: "100%",
                      borderRadius: "9999px",
                      background: "linear-gradient(90deg, #85f8c4 0%, #febb14 100%)",
                      transition: "width 0.4s ease",
                    }}
                  ></div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "rgba(226, 245, 236, 0.75)", marginTop: "0.35rem" }}>
                  <span>26% utilized today</span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <ShieldCheck size={12} color="#85f8c4" />
                    Tier 2 Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Cluster (4 Circular Buttons) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "0.75rem",
              backgroundColor: "#131b2e",
              border: "1px solid #1e293b",
              borderRadius: "1.25rem",
              padding: "1.25rem 0.75rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  to={action.path}
                  className="taka-action-btn"
                  title={action.subtitle}
                >
                  <div className="taka-action-icon-circle">
                    <Icon size={24} color={action.color} />
                  </div>
                  <span className="taka-action-label">{action.title}</span>
                  <span style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "-0.25rem" }}>
                    {action.subtitle}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Saved Payees Horizontal Carousel Strip */}
          <div
            style={{
              backgroundColor: "#131b2e",
              border: "1px solid #1e293b",
              borderRadius: "1.25rem",
              padding: "1.25rem 1.25rem 0.85rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Users size={18} color="#34d399" />
                <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "#f8fafc" }}>Saved Payees</h3>
                <span
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                  }}
                >
                  {payees.length} Active
                </span>
              </div>
              <Link
                to="/payees"
                style={{
                  fontSize: "0.8rem",
                  color: "#34d399",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  transition: "color 0.15s ease",
                }}
              >
                <span>Manage All</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {/* Scrolling Avatar Strip */}
            <div className="taka-payees-strip no-scrollbar">
              {/* + Add New Payee Button */}
              <Link to="/payees" className="taka-payee-item" title="Add a new payee">
                <div className="taka-payee-avatar taka-payee-avatar-add">
                  <Plus size={22} />
                </div>
                <span className="taka-payee-label" style={{ color: "#34d399" }}>Add New</span>
              </Link>

              {/* Dynamic / Demo Payees */}
              {payees.map((payee, idx) => {
                const initials = payee.initials || (payee.name ? payee.name.slice(0, 2).toUpperCase() : "PA");
                const bgColors = ["#d1e5f5", "#ffdea5", "#ffdad6", "#d4e7de", "#85f8c4", "#e2d9f3"];
                const textColors = ["#091e29", "#271900", "#93000a", "#0f1f1a", "#002114", "#2c154f"];
                const colorIdx = idx % bgColors.length;

                return (
                  <button
                    key={payee.id || payee.phone || idx}
                    type="button"
                    className="taka-payee-item"
                    onClick={() => navigate(`/send?to=${encodeURIComponent(payee.phone)}&name=${encodeURIComponent(payee.name)}`)}
                    title={`Send to ${payee.name} (${payee.phone})`}
                  >
                    <div
                      className="taka-payee-avatar"
                      style={{
                        backgroundColor: payee.bg || bgColors[colorIdx],
                        color: payee.color || textColors[colorIdx],
                      }}
                    >
                      {initials}
                    </div>
                    <span className="taka-payee-label">{payee.name}</span>
                    <span style={{ fontSize: "0.65rem", color: "#64748b", marginTop: "-0.2rem" }}>
                      {payee.relation || "Contact"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Stack (Rich Row Ledger) */}
          <div
            style={{
              backgroundColor: "#131b2e",
              border: "1px solid #1e293b",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Receipt size={20} color="#34d399" />
                  <h2 style={{ fontSize: "1.08rem", fontWeight: 700, color: "#f8fafc" }}>
                    Recent Activity
                  </h2>
                </div>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  Cleared settlements, point-of-sale debits, and peer transfers
                </p>
              </div>

              <Link
                to="/transactions"
                style={{
                  fontSize: "0.82rem",
                  color: "#34d399",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "9999px",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                }}
              >
                <span>View Ledger</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b" }}>
                <Receipt size={36} style={{ margin: "0 auto 0.75rem", opacity: 0.4 }} />
                <p style={{ fontWeight: 600 }}>No transactions yet today</p>
                <p style={{ fontSize: "0.82rem", marginTop: "0.25rem" }}>
                  Start by adding money or sending to a friend via NPSB.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {transactions.map((tx) => {
                  const { isCredit, icon: TxIcon, label, category, iconBg, iconColor } = getTxDetails(tx);
                  const formattedDate = new Date(tx.createdAt || tx.created_at || Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={tx.id || tx.reference}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.85rem 1rem",
                        backgroundColor: "#0e1526",
                        border: "1px solid #1e293b",
                        borderRadius: "12px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Left: Icon + Description */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 }}>
                        <div
                          style={{
                            width: "2.6rem",
                            height: "2.6rem",
                            borderRadius: "12px",
                            backgroundColor: iconBg,
                            color: iconColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <TxIcon size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "0.92rem", color: "#f8fafc", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {label}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {category}
                            </span>
                            <span>•</span>
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount + Status */}
                      <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "0.75rem" }}>
                        <div
                          className="tnum"
                          style={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            color: isCredit ? "#34d399" : "#f8fafc",
                          }}
                        >
                          {isCredit ? "+ " : "- "}৳ {formatTaka(tx.amount)}
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "9999px",
                            marginTop: "0.2rem",
                            backgroundColor:
                              tx.status === "COMPLETED"
                                ? "rgba(16, 185, 129, 0.15)"
                                : tx.status === "PENDING"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                            color:
                              tx.status === "COMPLETED"
                                ? "#34d399"
                                : tx.status === "PENDING"
                                ? "#fbbf24"
                                : "#f87171",
                          }}
                        >
                          <span
                            style={{
                              width: "5px",
                              height: "5px",
                              borderRadius: "9999px",
                              backgroundColor:
                                tx.status === "COMPLETED"
                                  ? "#10b981"
                                  : tx.status === "PENDING"
                                  ? "#f59e0b"
                                  : "#ef4444",
                            }}
                          ></span>
                          {tx.status || "COMPLETED"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Intelligence & Security Widgets (visible on desktop) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="taka-col-side">
          {/* Widget 1: Daily Limits Radial Visualizer */}
          <div
            style={{
              backgroundColor: "#131b2e",
              border: "1px solid #1e293b",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Clock size={18} color="#34d399" />
                <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "#f8fafc" }}>
                  Daily Clearing Limits
                </h3>
              </div>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
                Tier 2 KYC
              </span>
            </div>

            {/* Radial Meters Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.5rem",
                backgroundColor: "#0e1526",
                borderRadius: "14px",
                padding: "1rem 0.5rem",
                textAlign: "center",
                border: "1px solid #1e293b",
              }}
            >
              {/* Radial 1: Send */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeDasharray="28, 100"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="tnum" style={{ position: "absolute", fontSize: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                    28%
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f8fafc", marginTop: "0.4rem" }}>Send</span>
                <span style={{ fontSize: "0.65rem", color: "#64748b" }}>৳ 7k / 25k</span>
              </div>

              {/* Radial 2: Cash Out */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.5"
                      strokeDasharray="10, 100"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="tnum" style={{ position: "absolute", fontSize: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                    10%
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f8fafc", marginTop: "0.4rem" }}>Cash Out</span>
                <span style={{ fontSize: "0.65rem", color: "#64748b" }}>৳ 2k / 20k</span>
              </div>

              {/* Radial 3: Add Fund */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: "52px", height: "52px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#1e293b" strokeWidth="3.5" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3.5"
                      strokeDasharray="50, 100"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="tnum" style={{ position: "absolute", fontSize: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                    50%
                  </span>
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f8fafc", marginTop: "0.4rem" }}>Add Fund</span>
                <span style={{ fontSize: "0.65rem", color: "#64748b" }}>৳ 15k / 30k</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.85rem", fontSize: "0.78rem", color: "#94a3b8" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <ShieldCheck size={14} color="#34d399" />
                Biometric verification active
              </span>
              <Link to="/pin-setup" style={{ color: "#34d399", fontWeight: 600 }}>Adjust</Link>
            </div>
          </div>

          {/* Widget 2: Linked Payment Methods */}
          <div
            style={{
              backgroundColor: "#131b2e",
              border: "1px solid #1e293b",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CreditCard size={18} color="#38bdf8" />
                <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "#f8fafc" }}>
                  Linked Methods
                </h3>
              </div>
              <Link to="/add-money" style={{ color: "#34d399", fontSize: "0.8rem", fontWeight: 600 }}>
                + Add
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {/* Bank Item */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 0.85rem",
                  backgroundColor: "#0e1526",
                  borderRadius: "12px",
                  border: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <div style={{ width: "2.2rem", height: "2.2rem", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Landmark size={18} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#f8fafc", margin: 0 }}>City Bank Ltd.</p>
                    <p style={{ fontSize: "0.72rem", color: "#64748b", margin: 0 }}>A/C •••• 4481 · Connected</p>
                  </div>
                </div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "9999px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                  Primary
                </span>
              </div>

              {/* Visa Debit Card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 0.85rem",
                  backgroundColor: "#0e1526",
                  borderRadius: "12px",
                  border: "1px solid #1e293b",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <div style={{ width: "2.2rem", height: "2.2rem", borderRadius: "8px", backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: "0.85rem", color: "#f8fafc", margin: 0 }}>Visa Debit Card</p>
                    <p style={{ fontSize: "0.72rem", color: "#64748b", margin: 0 }}>Card •••• 9012 · Exp 08/28</p>
                  </div>
                </div>
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                  Instant
                </span>
              </div>
            </div>

            <Link
              to="/add-money"
              className="btn btn-secondary"
              style={{
                width: "100%",
                marginTop: "0.85rem",
                padding: "0.65rem",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
              }}
            >
              <Plus size={16} />
              <span>Add Bank or Card</span>
            </Link>
          </div>

          {/* Widget 3: Fintech Security & Bangladesh Bank Shield */}
          <div
            style={{
              backgroundColor: "#131b2e",
              border: "1px solid #1e293b",
              borderRadius: "1.25rem",
              padding: "1.5rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div style={{ width: "1.8rem", height: "1.8rem", borderRadius: "8px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={16} />
              </div>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: "#f8fafc" }}>
                Security Advisory
              </h3>
            </div>

            <div
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "12px",
                padding: "0.85rem",
                marginBottom: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#34d399", fontSize: "0.8rem", fontWeight: 700 }}>
                <CheckCircle2 size={14} />
                <span>Bangladesh Bank Shield Active</span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5, marginTop: "0.35rem" }}>
                Never share your 5-digit Taka Wallet PIN, OTP, or SMS verification codes. Staff will never ask for credentials.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.78rem", color: "#94a3b8" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Lock size={14} color="#34d399" />
                2FA Active via SMS
              </span>
              <Link to="/pin-setup" style={{ color: "#34d399", fontWeight: 600 }}>
                Security Center
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
