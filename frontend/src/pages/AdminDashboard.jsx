import React, { useState, useEffect } from "react";
import { apiRequest, formatTaka } from "../api/client.js";
import {
  ShieldAlert,
  BarChart3,
  RotateCcw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCheck,
  Play,
  AlertCircle,
} from "lucide-react";

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("reconciliation"); // reconciliation, risk, freeze, reverse, audit
  const [reconciliationReport, setReconciliationReport] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [riskFlags, setRiskFlags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });

  // Freeze/Unfreeze form state
  const [targetAccountId, setTargetAccountId] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  // Reversal form state
  const [reverseEntryId, setReverseEntryId] = useState("");
  const [reverseReason, setReverseReason] = useState("");

  const loadAdminData = async () => {
    try {
      setIsLoading(true);
      const [statsData, recData, auditData, riskData] = await Promise.allSettled([
        apiRequest("/api/admin/stats"),
        apiRequest("/api/admin/reconciliation"),
        apiRequest("/api/admin/audit-logs?limit=30"),
        apiRequest("/api/risk/flags"),
      ]);

      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (recData.status === "fulfilled") setReconciliationReport(recData.value);
      if (auditData.status === "fulfilled") setAuditLogs(auditData.value || []);
      if (riskData.status === "fulfilled") setRiskFlags(riskData.value?.flags || []);
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRunReconciliation = async () => {
    try {
      setActionMessage({ type: "info", text: "Running ledger verification..." });
      const report = await apiRequest("/api/admin/reconciliation/run", { method: "POST" });
      setReconciliationReport(report);
      setActionMessage({
        type: report.status === "BALANCED" ? "success" : "error",
        text: `Reconciliation finished: ${report.status} (${report.balanced_accounts} balanced, ${report.discrepancy_accounts} discrepancies).`,
      });
      await loadAdminData();
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to run reconciliation" });
    }
  };

  const handleFreezeToggle = async (freeze) => {
    if (!targetAccountId.trim()) {
      setActionMessage({ type: "error", text: "Please enter an account ID or owner ID" });
      return;
    }
    try {
      const endpoint = `/api/admin/accounts/${targetAccountId.trim()}/${freeze ? "freeze" : "unfreeze"}`;
      await apiRequest(endpoint, {
        method: "PATCH",
        body: { reason: freezeReason.trim() || (freeze ? "Admin manual freeze" : "Admin manual unfreeze") },
      });
      setActionMessage({
        type: "success",
        text: `Account ${targetAccountId} successfully ${freeze ? "frozen" : "unfrozen"}!`,
      });
      setTargetAccountId("");
      setFreezeReason("");
      await loadAdminData();
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Operation failed" });
    }
  };

  const handleReverseTransaction = async (e) => {
    e.preventDefault();
    if (!reverseEntryId.trim()) {
      setActionMessage({ type: "error", text: "Transaction ID is required for reversal" });
      return;
    }
    try {
      const res = await apiRequest(`/api/admin/transactions/${reverseEntryId.trim()}/reverse`, {
        method: "POST",
        body: { reason: reverseReason.trim() || "Admin manual reversal" },
      });
      setActionMessage({
        type: "success",
        text: `Transaction ${reverseEntryId} reversed! Compensating entry: ${res?.reversalEntry?.id || "posted"}`,
      });
      setReverseEntryId("");
      setReverseReason("");
      await loadAdminData();
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to reverse transaction" });
    }
  };

  const handleReviewRiskFlag = async (flagId, decision) => {
    try {
      await apiRequest(`/api/risk/flags/${flagId}/review`, {
        method: "POST",
        body: { status: decision, reviewNotes: `Admin decision: ${decision}` },
      });
      setActionMessage({ type: "success", text: `Risk flag updated to ${decision}` });
      await loadAdminData();
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Failed to review risk flag" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Platform Administration</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Double-entry integrity, risk controls, freeze management & reversals
            </p>
          </div>
        </div>
      </div>

      {actionMessage.text && (
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderRadius: "8px",
            backgroundColor:
              actionMessage.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : actionMessage.type === "error"
                ? "rgba(239, 68, 68, 0.15)"
                : "rgba(6, 182, 212, 0.15)",
            color:
              actionMessage.type === "success"
                ? "#34d399"
                : actionMessage.type === "error"
                ? "#f87171"
                : "#38bdf8",
            border: `1px solid ${
              actionMessage.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : actionMessage.type === "error"
                ? "rgba(239, 68, 68, 0.3)"
                : "rgba(6, 182, 212, 0.3)"
            }`,
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid-cols-4">
        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Total Accounts</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, marginTop: "0.25rem" }}>
            {stats?.accounts?.total || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            {stats?.accounts?.active || 0} Active • {stats?.accounts?.frozen || 0} Frozen
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>24h System Volume</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#10b981", marginTop: "0.25rem" }}>
            ৳ {formatTaka(stats?.volume?.last24HoursPoisha || "0")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            Total: ৳ {formatTaka(stats?.volume?.totalPoisha || "0")}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Fee Revenue Balance</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#06b6d4", marginTop: "0.25rem" }}>
            ৳ {formatTaka(stats?.feeRevenuePoisha || "0")}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
            SYSTEM_FEE_REVENUE
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>Ledger Status</div>
          <div style={{ marginTop: "0.5rem" }}>
            <span
              className={`badge ${
                reconciliationReport?.status === "BALANCED" ? "badge-success" : "badge-danger"
              }`}
              style={{ fontSize: "0.85rem", padding: "0.4rem 0.75rem" }}
            >
              {reconciliationReport?.status || "PENDING"}
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.35rem" }}>
            {reconciliationReport?.balanced_accounts || 0} Balanced Accounts
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
        {[
          { key: "reconciliation", label: "Ledger Reconciliation", icon: FileCheck },
          { key: "risk", label: "Risk Flags", icon: AlertTriangle },
          { key: "freeze", label: "Freeze Controls", icon: Lock },
          { key: "reverse", label: "Transaction Reversal", icon: RotateCcw },
          { key: "audit", label: "Audit Trail", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                backgroundColor: isActive ? "#1e293b" : "transparent",
                color: isActive ? "#10b981" : "#94a3b8",
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Reconciliation */}
      {activeTab === "reconciliation" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Double-Entry Invariant Verification</h3>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                Verifies cached balance equals sum of ledger lines and global debits equal credits
              </p>
            </div>
            <button className="btn btn-primary" onClick={handleRunReconciliation}>
              <Play size={16} /> Run Full Reconciliation
            </button>
          </div>

          {reconciliationReport ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  backgroundColor: "#0e1526",
                  padding: "1.25rem",
                  borderRadius: "10px",
                  border: "1px solid #1e293b",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Total Ledger Debits</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "0.25rem" }}>
                    ৳ {formatTaka(reconciliationReport.total_debits)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Total Ledger Credits</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "0.25rem" }}>
                    ৳ {formatTaka(reconciliationReport.total_credits)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Discrepancies Found</div>
                  <div
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: 800,
                      color: reconciliationReport.discrepancy_accounts > 0 ? "#f87171" : "#10b981",
                      marginTop: "0.25rem",
                    }}
                  >
                    {reconciliationReport.discrepancy_accounts}
                  </div>
                </div>
              </div>

              {reconciliationReport.discrepancy_accounts > 0 && reconciliationReport.details && (
                <div>
                  <h4 style={{ color: "#f87171", marginBottom: "0.5rem" }}>Discrepant Accounts:</h4>
                  <pre
                    style={{
                      backgroundColor: "#0e1526",
                      padding: "1rem",
                      borderRadius: "8px",
                      color: "#f87171",
                      fontSize: "0.8rem",
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(reconciliationReport.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "#64748b", padding: "2rem 0", textAlign: "center" }}>
              No reconciliation report found. Run reconciliation to test invariant.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Risk Flags */}
      {activeTab === "risk" && (
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>Flagged Transactions & Reviews</h3>
          {riskFlags.length === 0 ? (
            <div style={{ color: "#64748b", padding: "2rem 0", textAlign: "center" }}>
              No open risk flags. Velocity spikes and anomalies will appear here.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>User ID</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {riskFlags.map((flag) => (
                  <tr key={flag.id}>
                    <td style={{ fontWeight: 700 }}>{flag.rule_code || flag.ruleCode}</td>
                    <td>
                      <span className={`badge ${flag.severity === "HIGH" ? "badge-danger" : "badge-warning"}`}>
                        {flag.severity}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info">{flag.status}</span>
                    </td>
                    <td className="font-mono" style={{ fontSize: "0.8rem" }}>{flag.user_id || flag.userId}</td>
                    <td style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{new Date(flag.created_at).toLocaleString()}</td>
                    <td>
                      {flag.status === "OPEN" && (
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => handleReviewRiskFlag(flag.id, "CLEARED")}
                          >
                            Clear
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => handleReviewRiskFlag(flag.id, "CONFIRMED")}
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Freeze Controls */}
      {activeTab === "freeze" && (
        <div className="card" style={{ maxWidth: "560px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>Account Freeze / Unfreeze</h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "1.25rem" }}>
            Admin freeze locks all outgoing transfers and payments immediately while recording an immutable audit log.
          </p>

          <div className="input-group">
            <label className="input-label">Account ID or Owner User UUID</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. acc-uuid or user-uuid"
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Reason for Action</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Suspicious velocity spike investigation"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "1.25rem" }}>
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={() => handleFreezeToggle(true)}
            >
              <Lock size={16} /> Freeze Account
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => handleFreezeToggle(false)}
            >
              <Unlock size={16} /> Unfreeze Account
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Transaction Reversal */}
      {activeTab === "reverse" && (
        <div className="card" style={{ maxWidth: "560px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>Compensating Reversal Tool</h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "1.25rem" }}>
            Creates a strictly balanced compensating entry swapping debits and credits. Original transaction cannot be deleted. Double reversals are strictly prevented.
          </p>

          <form onSubmit={handleReverseTransaction}>
            <div className="input-group">
              <label className="input-label">Transaction ID to Reverse (UUID)</label>
              <input
                type="text"
                className="input-field"
                placeholder="UUID of original completed transaction"
                value={reverseEntryId}
                onChange={(e) => setReverseEntryId(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Dispute / Reversal Reason</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Customer dispute upheld by banking compliance"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-danger" style={{ width: "100%", padding: "0.85rem" }}>
              <RotateCcw size={16} /> Execute Compensating Reversal
            </button>
          </form>
        </div>
      )}

      {/* Tab 5: Audit Trail */}
      {activeTab === "audit" && (
        <div className="card">
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>System Audit Trail</h3>
          {auditLogs.length === 0 ? (
            <div style={{ color: "#64748b", padding: "2rem 0", textAlign: "center" }}>No audit log entries recorded.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Target ID</th>
                  <th>Metadata</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="badge badge-info">{log.action}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.entity}</td>
                    <td className="font-mono" style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{log.entity_id}</td>
                    <td style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                      {typeof log.metadata === "object" ? JSON.stringify(log.metadata) : log.metadata}
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
