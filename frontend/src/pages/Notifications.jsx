import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client.js";
import { Bell, Check, Mail, MessageSquare, ShieldAlert, CheckCircle2 } from "lucide-react";

export function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest("/api/notifications");
      setNotifications(res?.notifications || []);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ", read_at: new Date().toISOString() } : n))
      );
    } catch {
      // Handle error
    }
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case "EMAIL":
        return <Mail size={16} color="#06b6d4" />;
      case "SMS":
        return <MessageSquare size={16} color="#f59e0b" />;
      default:
        return <Bell size={16} color="#10b981" />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Bell size={20} color="#10b981" />
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Notification Inbox</h2>
          </div>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            {notifications.filter((n) => n.status !== "READ").length} Unread
          </span>
        </div>

        {isLoading ? (
          <div style={{ color: "#64748b", padding: "3rem 0", textAlign: "center" }}>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div style={{ color: "#64748b", padding: "3rem 0", textAlign: "center" }}>
            <CheckCircle2 size={32} color="#10b981" style={{ margin: "0 auto 0.75rem", display: "block" }} />
            No notifications in your inbox.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {notifications.map((n) => {
              const isUnread = n.status !== "READ";
              const payload = n.payload || {};

              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "1rem 1.25rem",
                    backgroundColor: isUnread ? "#131b2e" : "#0e1526",
                    border: `1px solid ${isUnread ? "#1e3a8a" : "#1e293b"}`,
                    borderRadius: "10px",
                    gap: "1rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                    <div style={{ marginTop: "0.2rem" }}>{getChannelIcon(n.channel)}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8fafc" }}>
                          {n.type?.replace(/_/g, " ")}
                        </span>
                        <span className={`badge ${isUnread ? "badge-info" : "badge-secondary"}`} style={{ fontSize: "0.65rem" }}>
                          {n.channel}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5 }}>
                        {payload.message || JSON.stringify(payload)}
                      </p>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.4rem" }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                      onClick={() => handleMarkAsRead(n.id)}
                    >
                      <Check size={13} /> Mark read
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
