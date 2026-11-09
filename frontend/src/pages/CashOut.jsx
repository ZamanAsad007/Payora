import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import { PinModal } from "../components/PinModal.jsx";
import { ArrowUpRight, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";

export function CashOut() {
  const { wallet, refreshWallet } = useAuth();
  const [agentPhone, setAgentPhone] = useState("");
  const [amountTaka, setAmountTaka] = useState("");
  const [feeTaka, setFeeTaka] = useState("0.00");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cash out fee: 1.85% (185 bps)
  useEffect(() => {
    const amt = parseFloat(amountTaka);
    if (!isNaN(amt) && amt > 0) {
      const calculatedFee = (amt * 0.0185).toFixed(2);
      setFeeTaka(calculatedFee);
    } else {
      setFeeTaka("0.00");
    }
  }, [amountTaka]);

  const handleOpenPin = (e) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(amountTaka);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid cash out amount");
      return;
    }
    if (!agentPhone.trim()) {
      setError("Please enter an agent phone number");
      return;
    }

    const totalPoisha = BigInt(Math.round(amt * 100)) + BigInt(Math.round(parseFloat(feeTaka) * 100));
    const balancePoisha = BigInt(wallet?.balance || "0");
    if (totalPoisha > balancePoisha) {
      setError("Insufficient wallet balance for cash-out amount and 1.85% agent fee");
      return;
    }

    setIsPinModalOpen(true);
  };

  const handleConfirmCashOut = async (pin) => {
    setIsSubmitting(true);
    try {
      const amountPoisha = Math.round(parseFloat(amountTaka) * 100);

      const response = await apiRequest("/api/cash-out", {
        method: "POST",
        requiresIdempotency: true,
        body: {
          agentPhone: agentPhone.trim(),
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
    setAgentPhone("");
    setError("");
  };

  if (receipt) {
    return (
      <div style={{ maxWidth: "480px", margin: "2rem auto" }}>
        <div className="card" style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "rgba(236, 72, 153, 0.15)",
              color: "#ec4899",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Cash Out Complete</h2>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#ec4899", margin: "0.75rem 0" }}>
            ৳ {formatTaka(receipt.amount)}
          </div>

          <div
            style={{
              backgroundColor: "#0e1526",
              borderRadius: "10px",
              padding: "1.25rem",
              margin: "1.5rem 0",
              textAlign: "left",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Agent:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>{agentPhone}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Agent Fee (1.85%):</span>
              <span style={{ color: "#f8fafc" }}>৳ {formatTaka(receipt.fee || "0")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Transaction ID:</span>
              <span className="font-mono" style={{ fontSize: "0.75rem", color: "#f8fafc" }}>
                {receipt.transactionId || receipt.reference}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Status:</span>
              <span className="badge badge-success">COMPLETED</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={resetForm} style={{ width: "100%" }}>
            <RotateCcw size={16} /> Cash Out Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "520px", margin: "1rem auto" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "rgba(236, 72, 153, 0.15)",
              color: "#ec4899",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowUpRight size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Cash Out</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Withdraw funds via authorized Payora agent
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
              borderRadius: "6px",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleOpenPin}>
          <div className="input-group">
            <label className="input-label">Agent Phone Number</label>
            <input
              type="text"
              className="input-field"
              placeholder="+88018XXXXXXXX"
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Cash-Out Amount (৳)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.01"
                min="50"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2rem", fontSize: "1.2rem", fontWeight: 700 }}
                placeholder="1000.00"
                value={amountTaka}
                onChange={(e) => setAmountTaka(e.target.value)}
                required
              />
              <span
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontWeight: 800,
                  color: "#94a3b8",
                }}
              >
                ৳
              </span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#0e1526",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid #1e293b",
              margin: "1.25rem 0",
              fontSize: "0.85rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Agent Settlement Fee (1.85%):</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>৳ {feeTaka}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: "0.4rem" }}>
              <span style={{ fontWeight: 700, color: "#f8fafc" }}>Total Wallet Debit:</span>
              <span style={{ fontWeight: 800, color: "#ec4899", fontSize: "0.95rem" }}>
                ৳ {formatTaka(Math.round((parseFloat(amountTaka || "0") + parseFloat(feeTaka)) * 100))}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.85rem" }}
            disabled={isSubmitting || !amountTaka || !agentPhone}
          >
            Confirm with PIN
          </button>
        </form>
      </div>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onConfirm={handleConfirmCashOut}
        title="Confirm Cash Out"
        amount={formatTaka(Math.round((parseFloat(amountTaka || "0") + parseFloat(feeTaka)) * 100))}
        recipient={`Agent: ${agentPhone}`}
      />
    </div>
  );
}
