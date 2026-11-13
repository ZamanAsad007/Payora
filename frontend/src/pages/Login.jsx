import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Lock, Phone, AlertCircle, ArrowRight } from "lucide-react";

export function Login() {
  const [phone, setPhone] = useState("01700000001");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSelectDemo = (demoPhone, demoPassword) => {
    setPhone(demoPhone);
    setPassword(demoPassword);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError("");
      const cleanPhone = phone.trim().replace(/^\+88/, "");
      await login({ phone: cleanPhone, password });
      navigate("/");
    } catch (err) {
      setError(err.message || "Failed to log in. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="card" style={{ maxWidth: "420px", width: "100%", padding: "2.5rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "1.6rem",
              color: "#042f2e",
              marginBottom: "1rem",
            }}
          >
            ৳
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Welcome back</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Log in to your Payora digital wallet
          </p>

          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.75rem",
              borderRadius: "8px",
              background: "#1e293b",
              border: "1px solid #334155",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Quick Demo Accounts
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => handleSelectDemo("01700000001", "Password123!")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "4px",
                  background: phone === "01700000001" ? "#10b981" : "#0f172a",
                  color: phone === "01700000001" ? "#042f2e" : "#f1f5f9",
                  border: "1px solid #475569",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Alice (User)
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemo("01700000002", "Password123!")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "4px",
                  background: phone === "01700000002" ? "#10b981" : "#0f172a",
                  color: phone === "01700000002" ? "#042f2e" : "#f1f5f9",
                  border: "1px solid #475569",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Bob (User)
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemo("01700000003", "Password123!")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "4px",
                  background: phone === "01700000003" ? "#10b981" : "#0f172a",
                  color: phone === "01700000003" ? "#042f2e" : "#f1f5f9",
                  border: "1px solid #475569",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                SuperMart (Merchant)
              </button>
              <button
                type="button"
                onClick={() => handleSelectDemo("01700000000", "Password123!")}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "4px",
                  background: phone === "01700000000" ? "#fbbf24" : "#0f172a",
                  color: phone === "01700000000" ? "#000000" : "#f1f5f9",
                  border: "1px solid #475569",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Admin (Auditor)
              </button>
            </div>
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

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Mobile Phone Number</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2.5rem" }}
                placeholder="01700000001"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Phone
                size={16}
                color="#64748b"
                style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2.5rem" }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock
                size={16}
                color="#64748b"
                style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "0.75rem", padding: "0.85rem" }}
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in to Payora"}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.75rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "#10b981", fontWeight: 600 }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
