import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import {
  ArrowDownLeft,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Landmark,
  Smartphone,
  Star,
  Copy,
  Check,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

export function AddMoney() {
  const { wallet, refreshWallet } = useAuth();
  const [amountTaka, setAmountTaka] = useState("");
  const [source, setSource] = useState("BANK"); // BANK, CARD, MFS
  const [status, setStatus] = useState("IDLE"); // IDLE, PROCESSING, SUCCESS, FAILED
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copiedTx, setCopiedTx] = useState(false);

  const handleTopUp = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amountTaka);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    try {
      setStatus("PROCESSING");
      setError("");
      const amountPoisha = Math.round(amt * 100);

      // Start top-up request with idempotency
      const initRes = await apiRequest("/api/wallet/top-up", {
        method: "POST",
        requiresIdempotency: true,
        body: {
          amount: amountPoisha.toString(),
          provider: source,
        },
      });

      setResult(initRes);
      setStatus("SUCCESS");
      await refreshWallet();
    } catch (err) {
      setError(err.message || "Failed to process top-up via provider");
      setStatus("FAILED");
    }
  };

  const resetForm = () => {
    setStatus("IDLE");
    setAmountTaka("");
    setError("");
    setResult(null);
  };

  const quickAmounts = [500, 1000, 2000, 5000, 10000];

  // Success Receipt View
  if (status === "SUCCESS" && result) {
    const txId = result.topUpId || result.id || "TOPUP-" + Date.now().toString(36).toUpperCase();
    const sourceLabel =
      source === "BANK"
        ? "City Bank Ltd. (A/C •••• 4481)"
        : source === "CARD"
        ? "Visa Debit Card (•••• 9012)"
        : "bKash / Nagad MFS";

    return (
      <div style={{ maxWidth: "480px", margin: "1.5rem auto" }}>
        <div
          className="card"
          style={{
            padding: "2.25rem 2rem",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            borderRadius: "1.25rem",
          }}
        >
          {/* Subtle background glow */}
          <div
            style={{
              position: "absolute",
              top: "-2rem",
              right: "-2rem",
              width: "8rem",
              height: "8rem",
              borderRadius: "9999px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          ></div>

          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "9999px",
              backgroundColor: "rgba(16, 185, 129, 0.18)",
              color: "#34d399",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
              border: "1.5px solid rgba(16, 185, 129, 0.3)",
              boxShadow: "0 0 20px rgba(16, 185, 129, 0.25)",
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <span
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#34d399",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.25rem",
            }}
          >
            Deposit Settled
          </span>

          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#f8fafc" }}>
            Money Added Successfully
          </h2>

          <div
            className="tnum"
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              color: "#34d399",
              margin: "0.65rem 0 1rem",
              letterSpacing: "-0.02em",
            }}
          >
            +৳ {formatTaka(Math.round(parseFloat(amountTaka) * 100))}
          </div>

          {/* Reward Points Pill */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
            <span className="taka-pts-badge">
              <Star size={13} fill="#febb14" stroke="#febb14" />
              <span>+25 Pts Deposit Bonus</span>
            </span>
          </div>

          {/* Ledger Breakdown Card */}
          <div
            style={{
              backgroundColor: "#0e1526",
              borderRadius: "12px",
              padding: "1.25rem",
              margin: "1rem 0 1.5rem",
              textAlign: "left",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Funding Source:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>{sourceLabel}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Top-Up Reference:</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span className="font-mono" style={{ fontSize: "0.75rem", color: "#f8fafc" }}>
                  {txId}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(txId).catch(() => {});
                    setCopiedTx(true);
                    setTimeout(() => setCopiedTx(false), 2000);
                  }}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex" }}
                  title="Copy Reference"
                >
                  {copiedTx ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Gateway Status:</span>
              <span className="badge badge-success">COMPLETED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Clearing Speed:</span>
              <span style={{ color: "#85f8c4", fontSize: "0.78rem" }}>Instant NPSB Settlement</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <button className="btn btn-primary" onClick={resetForm} style={{ width: "100%", padding: "0.85rem" }}>
              <RotateCcw size={16} /> Add More Money
            </button>
            <Link to="/" className="btn btn-secondary" style={{ width: "100%", padding: "0.85rem" }}>
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "520px", margin: "1rem auto" }}>
      <div className="card" style={{ borderRadius: "1.25rem", padding: "1.75rem 1.5rem" }}>
        {/* Step Indicator & Context Pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Step 1 of 2
            </span>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Select &amp; Amount
            </span>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "9999px", backgroundColor: "#10b981" }}></span>
            <span style={{ fontSize: "0.7rem", color: "#34d399", fontWeight: 700 }}>Demo · fake money</span>
          </div>
        </div>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>Add Money (Top-up)</h2>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
              Instant funding from linked banks or debit cards
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "#f87171",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleTopUp}>
          {/* Linked Source Provider Selection Cards */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="input-label" style={{ display: "block", marginBottom: "0.5rem" }}>
              Select Linked Source
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* Option 1: City Bank Ltd. */}
              <button
                type="button"
                onClick={() => setSource("BANK")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  backgroundColor: source === "BANK" ? "rgba(16, 185, 129, 0.12)" : "#0e1526",
                  border: `1.5px solid ${source === "BANK" ? "#10b981" : "#1e293b"}`,
                  color: "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: "2.4rem",
                      height: "2.4rem",
                      borderRadius: "10px",
                      backgroundColor: source === "BANK" ? "#006948" : "#131b2e",
                      color: source === "BANK" ? "#85f8c4" : "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Landmark size={20} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>City Bank Ltd.</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>A/C: •••• 4481 · Connected</div>
                  </div>
                </div>
                <span className="taka-tag-bdix">Primary</span>
              </button>

              {/* Option 2: Visa Debit Card */}
              <button
                type="button"
                onClick={() => setSource("CARD")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1rem",
                  borderRadius: "12px",
                  backgroundColor: source === "CARD" ? "rgba(56, 189, 248, 0.12)" : "#0e1526",
                  border: `1.5px solid ${source === "CARD" ? "#38bdf8" : "#1e293b"}`,
                  color: "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: "2.4rem",
                      height: "2.4rem",
                      borderRadius: "10px",
                      backgroundColor: source === "CARD" ? "rgba(56, 189, 248, 0.25)" : "#131b2e",
                      color: source === "CARD" ? "#38bdf8" : "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CreditCard size={20} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Visa Debit Card</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Card: •••• 9012 · Exp 08/28</div>
                  </div>
                </div>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Instant</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="input-group">
            <label className="input-label">Amount in Taka (৳)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.01"
                min="10"
                className="input-field tnum"
                style={{ width: "100%", paddingLeft: "2.2rem", fontSize: "1.3rem", fontWeight: 800 }}
                placeholder="1000.00"
                value={amountTaka}
                onChange={(e) => setAmountTaka(e.target.value)}
                required
              />
              <span
                style={{
                  position: "absolute",
                  left: "0.85rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontWeight: 800,
                  fontSize: "1.2rem",
                  color: "#34d399",
                }}
              >
                ৳
              </span>
            </div>

            {/* Quick Amount Chips */}
            <div className="taka-amount-chips">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`amount-chip-btn ${amountTaka === amt.toString() ? "active" : ""}`}
                  onClick={() => setAmountTaka(amt.toString())}
                >
                  +৳ {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Box */}
          <div
            style={{
              backgroundColor: "#0e1526",
              padding: "1rem",
              borderRadius: "12px",
              border: "1px solid #1e293b",
              margin: "1.25rem 0",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Current Balance:</span>
              <span className="tnum" style={{ fontWeight: 600, color: "#f8fafc" }}>
                ৳ {formatTaka(wallet?.balance)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Deposit Fee:</span>
              <span style={{ color: "#34d399", fontWeight: 600 }}>0.00 (Free)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: "0.5rem", marginTop: "0.2rem" }}>
              <span style={{ fontWeight: 700, color: "#f8fafc" }}>New Wallet Balance:</span>
              <span className="tnum" style={{ fontWeight: 800, color: "#34d399", fontSize: "1.05rem" }}>
                ৳ {formatTaka(
                  BigInt(wallet?.balance || "0") +
                    BigInt(Math.round(parseFloat(amountTaka || "0") * 100))
                )}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem" }}
            disabled={status === "PROCESSING" || !amountTaka}
          >
            {status === "PROCESSING" ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Clearing via NPSB Node...</span>
              </>
            ) : (
              "Confirm & Add Money"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddMoney;
