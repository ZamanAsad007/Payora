import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import { PinModal } from "../components/PinModal.jsx";
import {
  QrCode,
  Store,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Star,
  Copy,
  Check,
  ArrowLeft,
  Scan,
  Flashlight,
  Image as ImageIcon,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

export function PayMerchant() {
  const { wallet, refreshWallet } = useAuth();
  const [merchantIdOrQr, setMerchantIdOrQr] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amountTaka, setAmountTaka] = useState("");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  // Popular demo merchants matching Stitch specifications
  const popularMerchants = [
    { name: "Shwapno Superstore", location: "Gulshan-2", code: "01700000003", icon: ShoppingBag },
    { name: "Green Mart", location: "Banani Node", code: "01700000003", icon: Store },
    { name: "Daily Shopping", location: "Dhanmondi Branch", code: "01700000003", icon: Store },
  ];

  const handleSelectMerchant = (m) => {
    setMerchantIdOrQr(m.code);
    setMerchantName(m.name);
  };

  const handleOpenPin = (e) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(amountTaka);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid payment amount");
      return;
    }
    if (!merchantIdOrQr.trim()) {
      setError("Please enter a valid Merchant Code or QR payload");
      return;
    }

    const amountPoisha = BigInt(Math.round(amt * 100));
    const balancePoisha = BigInt(wallet?.balance || "0");
    if (amountPoisha > balancePoisha) {
      setError("Insufficient wallet balance to pay merchant");
      return;
    }

    setIsPinModalOpen(true);
  };

  const handleConfirmPayment = async (pin) => {
    setIsSubmitting(true);
    try {
      const amountPoisha = Math.round(parseFloat(amountTaka) * 100);

      const response = await apiRequest("/api/payments/merchant", {
        method: "POST",
        requiresIdempotency: true,
        body: {
          merchantId: merchantIdOrQr.trim(),
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
    setMerchantIdOrQr("");
    setMerchantName("");
    setError("");
  };

  const quickAmounts = [100, 340, 500, 1000, 2500];

  // Success Receipt View
  if (receipt) {
    const txId = receipt.transactionId || receipt.reference || "POS-98371";
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
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              filter: "blur(20px)",
              pointerEvents: "none",
            }}
          ></div>

          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "9999px",
              backgroundColor: "rgba(245, 158, 11, 0.18)",
              color: "#fbbf24",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
              border: "1.5px solid rgba(245, 158, 11, 0.3)",
              boxShadow: "0 0 20px rgba(245, 158, 11, 0.25)",
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <span
            style={{
              display: "inline-block",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#fbbf24",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "0.25rem",
            }}
          >
            Bangla QR Cleared
          </span>

          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#f8fafc" }}>
            Paid {merchantName || merchantIdOrQr}
          </h2>

          <div
            className="tnum"
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              color: "#fbbf24",
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
              <span>+15 Pts Earned</span>
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
              <span style={{ color: "#94a3b8" }}>Merchant POS:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>
                {merchantName ? `${merchantName} (${merchantIdOrQr})` : merchantIdOrQr}
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
                  title="Copy Reference"
                >
                  {copiedTx ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Processing Status:</span>
              <span className="badge badge-success">COMPLETED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Payment Method:</span>
              <span style={{ color: "#85f8c4", fontSize: "0.78rem" }}>Bangla QR POS Direct</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            <button className="btn btn-primary" onClick={resetForm} style={{ width: "100%", padding: "0.85rem" }}>
              <RotateCcw size={16} /> Make Another Payment
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
        {/* Step Progress Tracker */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Bangla QR
            </span>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Merchant POS Checkout
            </span>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              padding: "0.2rem 0.6rem",
              borderRadius: "9999px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "9999px", backgroundColor: "#f59e0b" }}></span>
            <span style={{ fontSize: "0.7rem", color: "#fbbf24", fontWeight: 700 }}>Scan &amp; Pay</span>
          </div>
        </div>

        {/* Simulated Camera Viewport Section (Stitch Style) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "180px",
            borderRadius: "14px",
            backgroundColor: "#070c18",
            border: "1px solid #1e293b",
            overflow: "hidden",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Subtle grid pattern */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "radial-gradient(#1e293b 1px, transparent 1px)",
              backgroundSize: "16px 16px",
              opacity: 0.6,
            }}
          ></div>

          {/* Viewfinder Target Frame */}
          <div
            style={{
              position: "relative",
              width: "120px",
              height: "120px",
              border: "2px solid #10b981",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)",
            }}
          >
            {/* Animated Laser Scan line */}
            <div
              style={{
                position: "absolute",
                left: "4px",
                right: "4px",
                height: "2px",
                backgroundColor: "#34d399",
                boxShadow: "0 0 8px #34d399",
                animation: "pulse 1.8s infinite",
              }}
            ></div>
            <Scan size={36} color="#34d399" style={{ opacity: 0.8 }} />
          </div>

          {/* Viewfinder Controls */}
          <div
            style={{
              position: "absolute",
              bottom: "0.6rem",
              right: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => setIsFlashlightOn(!isFlashlightOn)}
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                border: "1px solid #334155",
                borderRadius: "9999px",
                padding: "0.35rem 0.6rem",
                color: isFlashlightOn ? "#fbbf24" : "#94a3b8",
                fontSize: "0.72rem",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                cursor: "pointer",
              }}
            >
              <Flashlight size={13} />
              <span>{isFlashlightOn ? "Torch On" : "Torch"}</span>
            </button>
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

        {/* Demo Merchant Quick-Select Strip */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 600, marginBottom: "0.5rem" }}>
            Or 1-Tap Select Merchant:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
            {popularMerchants.map((m) => {
              const isSelected = merchantName === m.name;
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => handleSelectMerchant(m)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.25rem",
                    padding: "0.6rem 0.4rem",
                    borderRadius: "10px",
                    backgroundColor: isSelected ? "rgba(245, 158, 11, 0.15)" : "#0e1526",
                    border: `1.5px solid ${isSelected ? "#fbbf24" : "#1e293b"}`,
                    color: isSelected ? "#fbbf24" : "#f8fafc",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <m.icon size={18} />
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "#64748b" }}>
                    {m.location}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleOpenPin}>
          <div className="input-group">
            <label className="input-label">Merchant Code or Bangla QR Payload</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 01700000003 or MCH-SWAPNO-DHK"
              value={merchantIdOrQr}
              onChange={(e) => {
                setMerchantIdOrQr(e.target.value);
                setMerchantName("");
              }}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Payment Amount in Taka (৳)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.01"
                min="1"
                className="input-field tnum"
                style={{ width: "100%", paddingLeft: "2.2rem", fontSize: "1.3rem", fontWeight: 800 }}
                placeholder="340.00"
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
                  color: "#fbbf24",
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
                  ৳ {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Loyalty Reward Preview */}
          {amountTaka && parseFloat(amountTaka) > 0 && (
            <div
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                borderRadius: "10px",
                padding: "0.65rem 0.85rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.25rem",
                fontSize: "0.82rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#fbbf24" }}>
                <Star size={14} fill="#febb14" />
                <span style={{ fontWeight: 600 }}>Taka Rewards</span>
              </div>
              <span style={{ color: "#febb14", fontWeight: 700 }}>
                +{Math.max(5, Math.round(parseFloat(amountTaka) * 0.05))} Pts on this transaction
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem" }}
            disabled={isSubmitting || !amountTaka || !merchantIdOrQr}
          >
            Enter PIN to Confirm Payment
          </button>
        </form>
      </div>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onConfirm={handleConfirmPayment}
        title="Confirm Merchant Payment"
        amount={formatTaka(Math.round(parseFloat(amountTaka || "0") * 100))}
        recipient={merchantName ? `${merchantName} (${merchantIdOrQr})` : merchantIdOrQr}
      />
    </div>
  );
}

export default PayMerchant;
