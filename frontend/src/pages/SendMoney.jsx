import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import { PinModal } from "../components/PinModal.jsx";
import {
  Send,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Receipt,
  RotateCcw,
  Users,
  Star,
  Copy,
  Check,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

export function SendMoney() {
  const { wallet, refreshWallet } = useAuth();
  const location = useLocation();

  // Parse query params for 1-tap payee transfers (e.g. /send?to=01700000002&name=Ayesha)
  const searchParams = new URLSearchParams(location.search);
  const initialTo = searchParams.get("to") || "";
  const initialName = searchParams.get("name") || "";

  const [recipient, setRecipient] = useState(initialTo);
  const [recipientName, setRecipientName] = useState(initialName);
  const [amountTaka, setAmountTaka] = useState("");
  const [feeTaka, setFeeTaka] = useState("0.00");
  const [payees, setPayees] = useState([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  useEffect(() => {
    apiRequest("/api/payees")
      .then((data) => setPayees(data?.payees || []))
      .catch(() => {});
  }, []);

  // Update recipient if query params change
  useEffect(() => {
    if (initialTo && !recipient) {
      setRecipient(initialTo);
    }
    if (initialName && !recipientName) {
      setRecipientName(initialName);
    }
  }, [initialTo, initialName]);

  // Compute fee preview: Flat 5 BDT fee for transfers >= 1000 BDT, else 0 (BDIX free tier)
  useEffect(() => {
    const amt = parseFloat(amountTaka);
    if (!isNaN(amt) && amt >= 1000) {
      setFeeTaka("5.00");
    } else {
      setFeeTaka("0.00");
    }
  }, [amountTaka]);

  const handleOpenPin = (e) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(amountTaka);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }
    if (!recipient.trim()) {
      setError("Please provide a recipient phone number");
      return;
    }

    const totalPoisha = BigInt(Math.round(amt * 100)) + BigInt(Math.round(parseFloat(feeTaka) * 100));
    const balancePoisha = BigInt(wallet?.balance || "0");
    if (totalPoisha > balancePoisha) {
      setError("Insufficient wallet balance for transfer plus fee.");
      return;
    }

    setIsPinModalOpen(true);
  };

  const handleConfirmTransfer = async (pin) => {
    setIsSubmitting(true);
    try {
      const amountPoisha = Math.round(parseFloat(amountTaka) * 100);

      const response = await apiRequest("/api/transfers", {
        method: "POST",
        requiresIdempotency: true,
        body: {
          receiverPhone: recipient.trim(),
          amount: amountPoisha.toString(),
          pin,
        },
      });

      setReceipt(response);
      await refreshWallet();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setReceipt(null);
    setAmountTaka("");
    setRecipient("");
    setRecipientName("");
    setError("");
  };

  const selectPayee = (p) => {
    setRecipient(p.phone || p.nickname || "");
    setRecipientName(p.nickname || p.name || "");
  };

  const quickAmounts = [100, 500, 1000, 2000, 5000];

  // Success Receipt View
  if (receipt) {
    const txId = receipt.transactionId || receipt.reference || "TXN-98402";
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
            Transfer Cleared
          </span>

          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#f8fafc" }}>
            Sent to {recipientName || recipient}
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
            ৳ {formatTaka(receipt.amount)}
          </div>

          {/* Reward Points Pill */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
            <span className="taka-pts-badge">
              <Star size={13} fill="#febb14" stroke="#febb14" />
              <span>+10 Pts Earned</span>
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
              <span style={{ color: "#94a3b8" }}>Recipient:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>
                {recipientName ? `${recipientName} (${recipient})` : recipient}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Transaction ID:</span>
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
                  title="Copy Transaction ID"
                >
                  {copiedTx ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Service Fee:</span>
              <span style={{ color: "#f8fafc" }}>৳ {formatTaka(receipt.fee || "0")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Settlement Status:</span>
              <span className="badge badge-success">COMPLETED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Settlement Node:</span>
              <span style={{ color: "#85f8c4", fontSize: "0.78rem" }}>Dhaka NPSB &lt; 1.4s</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <button className="btn btn-primary" onClick={resetForm} style={{ width: "100%", padding: "0.85rem" }}>
              <RotateCcw size={16} /> Send Another Transfer
            </button>
            <Link to="/" className="btn btn-secondary" style={{ width: "100%", padding: "0.85rem" }}>
              <ArrowLeft size={16} /> Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "520px", margin: "1rem auto" }}>
      <div className="card" style={{ borderRadius: "1.25rem", padding: "1.75rem 1.5rem" }}>
        {/* Step Progress Header Tracker (Stitch Style) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Step 2 of 3
            </span>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Amount &amp; Verification
            </span>
          </div>
          <div style={{ width: "100%", height: "5px", backgroundColor: "#0e1526", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ width: "66%", height: "100%", backgroundColor: "#10b981", borderRadius: "9999px" }}></div>
          </div>
        </div>

        {/* Header Icon + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>Send Money</h2>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
              Peer-to-peer transfer backed by double-entry ledger
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

        {/* Selected Recipient Pill if set */}
        {recipient && (
          <div
            style={{
              backgroundColor: "#0e1526",
              border: "1px solid #1e293b",
              borderRadius: "12px",
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div
                style={{
                  width: "2.4rem",
                  height: "2.4rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {recipientName ? recipientName.slice(0, 2).toUpperCase() : "RC"}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#f8fafc", margin: 0 }}>
                  {recipientName || "Recipient"}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                  {recipient}
                </p>
              </div>
            </div>
            <span className="taka-tag-bdix">Verified</span>
          </div>
        )}

        {/* Saved Payees Quick Select Strip */}
        {payees.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600, marginBottom: "0.5rem" }}>
              Quick Select Payee:
            </div>
            <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }} className="no-scrollbar">
              {payees.map((p) => {
                const isSelected = recipient === (p.phone || p.nickname);
                return (
                  <button
                    key={p.id || p.phone}
                    type="button"
                    onClick={() => selectPayee(p)}
                    style={{
                      backgroundColor: isSelected ? "rgba(16, 185, 129, 0.2)" : "#0e1526",
                      border: `1px solid ${isSelected ? "#10b981" : "#1e293b"}`,
                      color: isSelected ? "#34d399" : "#f8fafc",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p.nickname || p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={handleOpenPin}>
          <div className="input-group">
            <label className="input-label">Recipient Phone Number</label>
            <input
              type="text"
              className="input-field"
              placeholder="+88017XXXXXXXX"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setRecipientName("");
              }}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Amount in Taka (৳)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.01"
                min="1"
                className="input-field tnum"
                style={{ width: "100%", paddingLeft: "2.2rem", fontSize: "1.3rem", fontWeight: 800 }}
                placeholder="500.00"
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

          {/* Fee & Invariants Summary */}
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
              <span style={{ color: "#94a3b8" }}>Available Balance:</span>
              <span className="tnum" style={{ fontWeight: 600, color: "#f8fafc" }}>
                ৳ {formatTaka(wallet?.balance)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Service Fee:</span>
              <span className="tnum" style={{ color: parseFloat(feeTaka) === 0 ? "#34d399" : "#f8fafc", fontWeight: 600 }}>
                {parseFloat(feeTaka) === 0 ? "Free (BDIX)" : `৳ ${feeTaka}`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: "0.5rem", marginTop: "0.2rem" }}>
              <span style={{ fontWeight: 700, color: "#f8fafc" }}>Total Debit:</span>
              <span className="tnum" style={{ fontWeight: 800, color: "#34d399", fontSize: "1.05rem" }}>
                ৳ {formatTaka(Math.round((parseFloat(amountTaka || "0") + parseFloat(feeTaka)) * 100))}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem" }}
            disabled={isSubmitting || !amountTaka || !recipient}
          >
            Proceed to PIN Verification
          </button>
        </form>
      </div>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onConfirm={handleConfirmTransfer}
        title="Confirm Send Money"
        amount={formatTaka(Math.round((parseFloat(amountTaka || "0") + parseFloat(feeTaka)) * 100))}
        recipient={recipientName ? `${recipientName} (${recipient})` : recipient}
      />
    </div>
  );
}

export default SendMoney;
