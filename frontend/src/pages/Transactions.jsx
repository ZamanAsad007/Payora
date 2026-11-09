import React, { useState, useEffect } from "react";
import { apiRequest, formatTaka } from "../api/client.js";
import { History, Filter, ChevronLeft, ChevronRight, X, FileText } from "lucide-react";

export function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedTx, setSelectedTx] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setIsLoading(true);
        const url = typeFilter === "ALL" ? "/api/wallet/transactions?limit=25" : `/api/wallet/transactions?limit=25&type=${typeFilter}`;
        const data = await apiRequest(url);
        setTransactions(data?.transactions || []);
      } catch {
        // Handle error
      } finally {
        setIsLoading(false);
      }
    }
    fetchTransactions();
  }, [typeFilter]);

  const txTypes = ["ALL", "TOP_UP", "P2P", "MERCHANT_PAYMENT", "CASH_OUT", "REVERSAL"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <History size={20} color="#10b981" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Transaction History</h2>
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", maxWidth: "100%", paddingBottom: "0.25rem" }}>
            {txTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  border: `1px solid ${typeFilter === t ? "#10b981" : "#1e293b"}`,
                  backgroundColor: typeFilter === t ? "rgba(16, 185, 129, 0.15)" : "#0e1526",
                  color: typeFilter === t ? "#10b981" : "#94a3b8",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>No transactions match this filter.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount (৳)</th>
                  <th>Direction</th>
                  <th>Status</th>
                  <th>Date & Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id || tx.reference} style={{ cursor: "pointer" }} onClick={() => setSelectedTx(tx)}>
                    <td style={{ fontWeight: 700 }}>{tx.type}</td>
                    <td className="font-mono" style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{tx.reference}</td>
                    <td
                      style={{
                        fontWeight: 800,
                        color: tx.direction === "CREDIT" || tx.type === "TOP_UP" ? "#10b981" : "#f8fafc",
                      }}
                    >
                      {tx.direction === "CREDIT" || tx.type === "TOP_UP" ? "+ " : "- "}
                      ৳ {formatTaka(tx.amount)}
                    </td>
                    <td>
                      <span className={`badge ${tx.direction === "CREDIT" ? "badge-success" : "badge-info"}`}>
                        {tx.direction || "DEBIT"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${tx.status === "COMPLETED" ? "badge-success" : tx.status === "REVERSED" ? "badge-warning" : "badge-danger"}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
                      {new Date(tx.createdAt || tx.created_at).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTx(tx);
                        }}
                      >
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Receipt Modal */}
      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileText size={20} color="#10b981" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Transaction Details</h3>
              </div>
              <button onClick={() => setSelectedTx(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{selectedTx.type}</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#10b981", margin: "0.25rem 0" }}>
                ৳ {formatTaka(selectedTx.amount)}
              </div>
              <span className={`badge ${selectedTx.status === "COMPLETED" ? "badge-success" : "badge-warning"}`}>
                {selectedTx.status}
              </span>
            </div>

            <div
              style={{
                backgroundColor: "#0e1526",
                borderRadius: "8px",
                padding: "1rem",
                marginTop: "1rem",
                fontSize: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                border: "1px solid #1e293b",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Reference:</span>
                <span className="font-mono" style={{ color: "#f8fafc" }}>{selectedTx.reference}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Transaction ID:</span>
                <span className="font-mono" style={{ fontSize: "0.75rem", color: "#f8fafc" }}>{selectedTx.id || selectedTx.transactionId}</span>
              </div>
              {selectedTx.fee && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Fee:</span>
                  <span style={{ color: "#f8fafc" }}>৳ {formatTaka(selectedTx.fee)}</span>
                </div>
              )}
              {selectedTx.description && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Description:</span>
                  <span style={{ color: "#f8fafc" }}>{selectedTx.description}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Timestamp:</span>
                <span style={{ color: "#f8fafc" }}>{new Date(selectedTx.createdAt || selectedTx.created_at).toLocaleString()}</span>
              </div>
            </div>

            <button className="btn btn-secondary" onClick={() => setSelectedTx(null)} style={{ width: "100%", marginTop: "1.25rem" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
