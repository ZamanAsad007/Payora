import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { Users, UserPlus, Trash2, ArrowUpRight, AlertCircle } from "lucide-react";

export function Payees() {
  const [payees, setPayees] = useState([]);
  const [nickname, setNickname] = useState("");
  const [payeeAccountId, setPayeeAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayees = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest("/api/payees");
      setPayees(res?.payees || []);
    } catch (err) {
      setError(err.message || "Failed to load saved payees");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayees();
  }, []);

  const handleAddPayee = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || !payeeAccountId.trim()) {
      setError("Nickname and Payee Account / Phone required");
      return;
    }
    try {
      setError("");
      await apiRequest("/api/payees", {
        method: "POST",
        body: {
          nickname: nickname.trim(),
          payeeAccountId: payeeAccountId.trim(),
        },
      });
      setNickname("");
      setPayeeAccountId("");
      await loadPayees();
    } catch (err) {
      setError(err.message || "Failed to add payee");
    }
  };

  const handleDeletePayee = async (id) => {
    try {
      await apiRequest(`/api/payees/${id}`, { method: "DELETE" });
      await loadPayees();
    } catch (err) {
      setError(err.message || "Failed to remove payee");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="grid-cols-2">
        {/* Payees List */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <Users size={20} color="#10b981" />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Saved Payees & Contacts</h2>
          </div>

          {isLoading ? (
            <div style={{ color: "#64748b", padding: "2rem 0", textAlign: "center" }}>Loading payees...</div>
          ) : payees.length === 0 ? (
            <div style={{ color: "#64748b", padding: "2rem 0", textAlign: "center" }}>
              No saved payees yet. Add one using the form on the right.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {payees.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#0e1526",
                    padding: "0.85rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid #1e293b",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.nickname}</div>
                    <div className="font-mono" style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {p.payee_account_id || p.payeeAccountId}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Link
                      to="/send"
                      className="btn btn-primary"
                      style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                    >
                      <ArrowUpRight size={14} /> Send
                    </Link>
                    <button
                      className="btn btn-danger"
                      style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => handleDeletePayee(p.id)}
                      title="Remove contact"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Payee Form */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <UserPlus size={20} color="#06b6d4" />
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Save New Payee</h2>
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
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAddPayee}>
            <div className="input-group">
              <label className="input-label">Nickname (e.g. Mom, Landlord, Rahim)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Rahim Bhai"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Payee Wallet Account ID or UUID</label>
              <input
                type="text"
                className="input-field"
                placeholder="UUID of wallet account"
                value={payeeAccountId}
                onChange={(e) => setPayeeAccountId(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "0.85rem" }}>
              Save Contact
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
