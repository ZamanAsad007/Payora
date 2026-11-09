import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest, formatTaka } from "../api/client.js";
import { ArrowDownLeft, CreditCard, Building2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function AddMoney() {
  const { refreshWallet } = useAuth();
  const [amountTaka, setAmountTaka] = useState("");
  const [source, setSource] = useState("BANK");
  const [status, setStatus] = useState("IDLE"); // IDLE, PROCESSING, SUCCESS, FAILED
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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

  if (status === "SUCCESS" && result) {
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

          <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Money Added Successfully</h2>
          <div style={{ fontSize: "2.25rem", fontWeight: 800, color: "#10b981", margin: "0.75rem 0" }}>
            ৳ {formatTaka(Math.round(parseFloat(amountTaka) * 100))}
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
              <span style={{ color: "#94a3b8" }}>Source:</span>
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>{source === "BANK" ? "Mock Bank Clearing" : "Mock Debit/Credit Card"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Top-Up ID:</span>
              <span className="font-mono" style={{ fontSize: "0.75rem", color: "#f8fafc" }}>
                {result.topUpId || result.id || "TOPUP-" + Date.now().toString(36)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Status:</span>
              <span className="badge badge-success">COMPLETED</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={resetForm} style={{ width: "100%" }}>
            Add More Money
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
              backgroundColor: "rgba(6, 182, 212, 0.15)",
              color: "#06b6d4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Add Money</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Top up via mock bank clearing or simulated card
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

        <form onSubmit={handleTopUp}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="input-label" style={{ display: "block", marginBottom: "0.5rem" }}>
              Select Source Provider
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setSource("BANK")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.85rem",
                  borderRadius: "8px",
                  backgroundColor: source === "BANK" ? "rgba(6, 182, 212, 0.15)" : "#0e1526",
                  border: `1px solid ${source === "BANK" ? "#06b6d4" : "#1e293b"}`,
                  color: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                <Building2 size={20} color={source === "BANK" ? "#06b6d4" : "#94a3b8"} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Bank Clearing</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Direct clearing</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSource("CARD")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.85rem",
                  borderRadius: "8px",
                  backgroundColor: source === "CARD" ? "rgba(6, 182, 212, 0.15)" : "#0e1526",
                  border: `1px solid ${source === "CARD" ? "#06b6d4" : "#1e293b"}`,
                  color: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                <CreditCard size={20} color={source === "CARD" ? "#06b6d4" : "#94a3b8"} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Debit Card</div>
                  <div style={{ fontSize: "0.7rem", color: "#64748b" }}>Instant load</div>
                </div>
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Amount in Taka (৳)</label>
            <div style={{ position: "relative" }}>
              <input
                type="number"
                step="0.01"
                min="10"
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

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {[500, 1000, 2000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountTaka(preset.toString())}
                style={{
                  flex: 1,
                  backgroundColor: "#0e1526",
                  border: "1px solid #1e293b",
                  color: "#94a3b8",
                  padding: "0.4rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + ৳{preset}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.85rem" }}
            disabled={status === "PROCESSING" || !amountTaka}
          >
            {status === "PROCESSING" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Simulating Provider Clearing...
              </>
            ) : (
              "Add Money to Wallet"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
