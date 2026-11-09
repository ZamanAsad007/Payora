import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { Navbar } from "./components/Navbar.jsx";
import { Login } from "./pages/Login.jsx";
import { Register } from "./pages/Register.jsx";
import { PinSetup } from "./pages/PinSetup.jsx";
import { Home } from "./pages/Home.jsx";
import { SendMoney } from "./pages/SendMoney.jsx";
import { AddMoney } from "./pages/AddMoney.jsx";
import { PayMerchant } from "./pages/PayMerchant.jsx";
import { CashOut } from "./pages/CashOut.jsx";
import { Transactions } from "./pages/Transactions.jsx";
import { Payees } from "./pages/Payees.jsx";
import { Statements } from "./pages/Statements.jsx";
import { Notifications } from "./pages/Notifications.jsx";
import { AdminDashboard } from "./pages/AdminDashboard.jsx";

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div style={{ color: "#10b981", fontWeight: 700 }}>Loading Payora...</div>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected User Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pin-setup"
                element={
                  <ProtectedRoute>
                    <PinSetup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/send"
                element={
                  <ProtectedRoute>
                    <SendMoney />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-money"
                element={
                  <ProtectedRoute>
                    <AddMoney />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pay"
                element={
                  <ProtectedRoute>
                    <PayMerchant />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cash-out"
                element={
                  <ProtectedRoute>
                    <CashOut />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <Transactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payees"
                element={
                  <ProtectedRoute>
                    <Payees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statements"
                element={
                  <ProtectedRoute>
                    <Statements />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
