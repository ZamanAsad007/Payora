import React, { useState } from "react";
import { apiRequest, formatTaka } from "../api/client.js";
import { FileText, Download, Calendar, AlertCircle } from "lucide-react";

export function Statements() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [format, setFormat] = useState("pdf");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  const handlePreview = async () => {
    try {
      setError("");
      const data = await apiRequest(`/api/statements?from=${fromDate}T00:00:00Z&to=${toDate}T23:59:59Z&format=json`);
      setSummary(data);
    } catch (err) {
      setError(err.message || "Failed to load statement preview");
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setError("");
      const token = localStorage.getItem("payora_access_token");
      const url = `/api/statements?from=${fromDate}T00:00:00Z&to=${toDate}T23:59:59Z&format=${format}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error("Failed to export statement file");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `statement_${fromDate}_${toDate}.${format === "csv" ? "csv" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || "Failed to download statement");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <FileText size={22} color="#10b981" />
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Account Statement Export</h2>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              Download official PDF or CSV financial statements with running balances
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Start Date</label>
            <input
              type="date"
              className="input-field"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">End Date</label>
            <input
              type="date"
              className="input-field"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Format</label>
            <select
              className="input-field"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="pdf">PDF Statement (.pdf)</option>
              <option value="csv">CSV Spreadsheet (.csv)</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePreview}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download size={16} />
              {isDownloading ? "Generating..." : "Download"}
            </button>
          </div>
        </div>

        {/* Statement Summary Card */}
        {summary && (
          <div
            style={{
              backgroundColor: "#0e1526",
              borderRadius: "10px",
              padding: "1.5rem",
              marginTop: "1.75rem",
              border: "1px solid #1e293b",
            }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>
              Period Summary ({fromDate} to {toDate})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", textAlign: "center" }}>
              <div style={{ padding: "0.75rem", backgroundColor: "#131b2e", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Opening Balance</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, marginTop: "0.25rem" }}>
                  ৳ {formatTaka(summary.openingBalance)}
                </div>
              </div>
              <div style={{ padding: "0.75rem", backgroundColor: "#131b2e", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Total Credits (In)</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#10b981", marginTop: "0.25rem" }}>
                  + ৳ {formatTaka(summary.totalCredits)}
                </div>
              </div>
              <div style={{ padding: "0.75rem", backgroundColor: "#131b2e", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Total Debits (Out)</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f87171", marginTop: "0.25rem" }}>
                  - ৳ {formatTaka(summary.totalDebits)}
                </div>
              </div>
              <div style={{ padding: "0.75rem", backgroundColor: "#131b2e", borderRadius: "8px" }}>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Closing Balance</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#06b6d4", marginTop: "0.25rem" }}>
                  ৳ {formatTaka(summary.closingBalance)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
