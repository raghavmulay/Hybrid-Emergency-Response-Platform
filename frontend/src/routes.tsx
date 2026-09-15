import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import type { ReactNode } from "react";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import ConversationDetail from "./pages/ConversationDetail";
import AdminPanel from "./pages/AdminPanel";

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    {/* Protected routes */}
    <Route
      path="/"
      element={
        <RequireAuth>
          <Dashboard />
        </RequireAuth>
      }
    />
    <Route
      path="/conversations/:id"
      element={
        <RequireAuth>
          <ConversationDetail />
        </RequireAuth>
      }
    />
    <Route
      path="/admin"
      element={
        <RequireAuth>
          <AdminPanel />
        </RequireAuth>
      }
    />
    {/* Catch‑all redirect */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
