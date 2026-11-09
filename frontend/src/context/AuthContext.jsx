import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("payora_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWallet = async () => {
    try {
      const data = await apiRequest("/api/wallet");
      setWallet(data);
    } catch {
      // Ignore wallet fetch errors if unauthenticated or new
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("payora_access_token");
    if (token) {
      fetchWallet().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async ({ phone, password }) => {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { phone, password },
    });

    localStorage.setItem("payora_access_token", data.accessToken);
    localStorage.setItem("payora_refresh_token", data.refreshToken);
    localStorage.setItem("payora_user", JSON.stringify(data.user));
    setUser(data.user);

    await fetchWallet();
    return data;
  };

  const register = async ({ name, phone, email, password }) => {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: { name, phone, email, password },
    });

    localStorage.setItem("payora_access_token", data.accessToken);
    localStorage.setItem("payora_refresh_token", data.refreshToken);
    localStorage.setItem("payora_user", JSON.stringify(data.user));
    setUser(data.user);

    await fetchWallet();
    return data;
  };

  const setTransactionPin = async (pin) => {
    const data = await apiRequest("/api/auth/pin", {
      method: "POST",
      body: { pin },
    });
    // Update user state indicating PIN is configured
    const updatedUser = { ...user, hasPin: true };
    localStorage.setItem("payora_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    return data;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("payora_refresh_token");
      if (refreshToken) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          body: { refreshToken },
        });
      }
    } catch {
      // Cleanup locally regardless of network
    } finally {
      localStorage.removeItem("payora_access_token");
      localStorage.removeItem("payora_refresh_token");
      localStorage.removeItem("payora_user");
      setUser(null);
      setWallet(null);
    }
  };

  const value = {
    user,
    wallet,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin" || user?.role === "ADMIN",
    login,
    register,
    logout,
    setTransactionPin,
    refreshWallet: fetchWallet,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
