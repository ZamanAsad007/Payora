import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import { PinModal } from "../components/PinModal.jsx";
import { QrCode, Store, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";

export function PayMerchant() {
  const { wallet, refreshWallet } = useAuth();
  const [merchantIdOrQr, setMerchantIdOrQr] = useState("");
  const [amountTaka, setAmountTaka] = useState("");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Merchant Payment Complete</h2>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#f59e0b", margin: "0.75rem 0" }}>
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
              <span style={{ color: "#94a3b8" }}>Merchant:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>{merchantIdOrQr}</span>
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
            <RotateCcw size={16} /> Make Another Payment
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
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QrCode size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Pay Merchant</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Scan QR code or paste merchant payment token
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
            <label className="input-label">Merchant Code or QR String</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. MCH-SWAPNO-DHK or UUID"
              value={merchantIdOrQr}
              onChange={(e) => setMerchantIdOrQr(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Payment Amount (৳)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.01"
                min="1"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2rem", fontSize: "1.2rem", fontWeight: 700 }}
                placeholder="250.00"
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
              <span style={{ color: "#94a3b8" }}>Customer Fee:</span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>৳ 0.00 (Free)</span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.85rem" }}
            disabled={isSubmitting || !amountTaka || !merchantIdOrQr}
          >
            Proceed with PIN
          </button>
        </form>
      </div>

      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onConfirm={handleConfirmPayment}
        title="Confirm Merchant Payment"
        amount={formatTaka(Math.round(parseFloat(amountTaka || "0") * 100))}
        recipient={merchantIdOrQr}
      />
    </div>
  );
}
