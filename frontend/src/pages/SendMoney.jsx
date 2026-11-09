import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export function SendMoney() {
  const { wallet, refreshWallet } = useAuth();
  const [recipient, setRecipient] = useState("");
  const [amountTaka, setAmountTaka] = useState("");
  const [feeTaka, setFeeTaka] = useState("0.00");
  const [payees, setPayees] = useState([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiRequest("/api/payees")
      .then((data) => setPayees(data?.payees || []))
      .catch(() => {});
  }, []);

  // Compute fee preview: Flat 5 BDT fee for transfers >= 1000 BDT, else 0
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
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f8fafc" }}>Transfer Successful</h2>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#10b981", margin: "0.75rem 0" }}>
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
              <span style={{ color: "#94a3b8" }}>Recipient:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>{recipient}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Transaction ID:</span>
              <span className="font-mono" style={{ fontSize: "0.75rem", color: "#f8fafc" }}>
                {receipt.transactionId || receipt.reference}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Fee Collected:</span>
              <span style={{ color: "#f8fafc" }}>৳ {formatTaka(receipt.fee || "0")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Status:</span>
              <span className="badge badge-success">COMPLETED</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Time:</span>
              <span style={{ color: "#f8fafc" }}>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={resetForm} style={{ width: "100%" }}>
            <RotateCcw size={16} /> Send Another Transfer
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
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Send Money (P2P)</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Instant transfer backed by double-entry ledger
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

        {/* Quick Payee Select */}
        {payees.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600, marginBottom: "0.5rem" }}>
              Saved Payees:
            </div>
            <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
              {payees.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRecipient(p.phone || p.nickname)}
                  style={{
                    backgroundColor: recipient === (p.phone || p.nickname) ? "rgba(16, 185, 129, 0.2)" : "#0e1526",
                    border: `1px solid ${recipient === (p.phone || p.nickname) ? "#10b981" : "#1e293b"}`,
                    color: "#f8fafc",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.nickname}
                </button>
              ))}
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
              onChange={(e) => setRecipient(e.target.value)}
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
                className="input-field"
                style={{ width: "100%", paddingLeft: "2rem", fontSize: "1.2rem", fontWeight: 700 }}
                placeholder="500.00"
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
              <span style={{ color: "#94a3b8" }}>Available Balance:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>৳ {formatTaka(wallet?.balance)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Service Fee:</span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>৳ {feeTaka}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1e293b", paddingTop: "0.4rem", marginTop: "0.2rem" }}>
              <span style={{ fontWeight: 700, color: "#f8fafc" }}>Total Debit:</span>
              <span style={{ fontWeight: 800, color: "#10b981", fontSize: "0.95rem" }}>
                ৳ {formatTaka(Math.round((parseFloat(amountTaka || "0") + parseFloat(feeTaka)) * 100))}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.85rem" }}
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
        recipient={recipient}
      />
    </div>
  );
}
