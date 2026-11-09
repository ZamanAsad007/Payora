import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { User, Phone, Mail, Lock, AlertCircle, ArrowRight } from "lucide-react";

export function Register() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError("");
      await register({ name, phone, email, password });
      navigate("/pin-setup");
    } catch (err) {
      setError(err.message || "Failed to register account.");
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
      <div className="card" style={{ maxWidth: "460px", width: "100%", padding: "2.5rem 2rem" }}>
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
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Create Payora Account</h2>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Open your secure digital wallet with double-entry ledger
          </p>
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
            <label className="input-label">Full Name</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2.5rem" }}
                placeholder="e.g. Asif Zaman"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <User
                size={16}
                color="#64748b"
                style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Phone Number (Bangladeshi Format)</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2.5rem" }}
                placeholder="+88017XXXXXXXX"
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
            <label className="input-label">Email Address</label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                className="input-field"
                style={{ width: "100%", paddingLeft: "2.5rem" }}
                placeholder="asif@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Mail
                size={16}
                color="#64748b"
                style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password (Min 8 chars, 1 uppercase, 1 symbol)</label>
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
            {isLoading ? "Creating Wallet..." : "Create Account"}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.75rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Already registered?{" "}
          <Link to="/login" style={{ color: "#10b981", fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
