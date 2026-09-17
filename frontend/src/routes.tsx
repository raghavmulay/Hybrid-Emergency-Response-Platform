import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import type { ReactNode } from "react";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import ConversationDetail from "./pages/ConversationDetail";
import AdminPanel from "./pages/AdminPanel";
import ProfilePage from "./pages/ProfilePage";
import ReportIncident from "./pages/ReportIncident";
import MyIncidents from "./pages/MyIncidents";
import IncidentDetail from "./pages/IncidentDetail";
import ResponderDashboard from "./pages/ResponderDashboard";
import ResponderIncidentDetail from "./pages/ResponderIncidentDetail";

/** Requires citizen (user) role only */
const RequireUser = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "responder") return <Navigate to="/responder" replace />;
  return <>{children}</>;
};

/** Requires admin role */
const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Requires responder role */
const RequireResponder = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== "responder") return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Any authenticated user */
const RequireAnyAuth = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const AppRoutes = () => {
  const { isAuthenticated, role } = useAuth();

  const defaultHome =
    role === "admin" ? "/admin" : role === "responder" ? "/responder" : "/";

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={defaultHome} replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to={defaultHome} replace /> : <RegisterPage />}
      />

      {/* Citizen routes */}
      <Route path="/" element={<RequireUser><Dashboard /></RequireUser>} />
      <Route path="/profile" element={<RequireUser><ProfilePage /></RequireUser>} />
      <Route path="/report" element={<RequireUser><ReportIncident /></RequireUser>} />
      <Route path="/my-incidents" element={<RequireUser><MyIncidents /></RequireUser>} />

      {/* Shared routes */}
      <Route path="/incident/:id" element={<RequireAnyAuth><IncidentDetail /></RequireAnyAuth>} />
      <Route path="/conversations/:id" element={<RequireAnyAuth><ConversationDetail /></RequireAnyAuth>} />

      {/* Admin routes */}
      <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />

      {/* Responder routes */}
      <Route path="/responder" element={<RequireResponder><ResponderDashboard /></RequireResponder>} />
      <Route
        path="/responder/incidents/:id"
        element={<RequireResponder><ResponderIncidentDetail /></RequireResponder>}
      />

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? defaultHome : "/login"} replace />}
      />
    </Routes>
  );
};
