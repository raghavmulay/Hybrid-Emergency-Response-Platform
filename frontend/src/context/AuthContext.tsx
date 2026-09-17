import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api/client";

export type UserRole = "admin" | "user" | "responder" | null;

type AuthContextType = {
  isAuthenticated: boolean;
  role: UserRole;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialAuth(): { isAuthenticated: boolean; role: UserRole } {
  if (typeof window === "undefined") {
    return { isAuthenticated: false, role: null };
  }
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  const storedRole = (sessionStorage.getItem("role") || localStorage.getItem("role")) as UserRole;

  if (token) {
    if (storedRole === "admin") return { isAuthenticated: true, role: "admin" };
    if (storedRole === "responder") return { isAuthenticated: true, role: "responder" };
    return { isAuthenticated: true, role: "user" };
  }
  return { isAuthenticated: false, role: null };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const initial = getInitialAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(initial.isAuthenticated);
  const [role, setRole] = useState<UserRole>(initial.role);

  const login = async (email: string, password: string) => {
    // Regular login via API — decode role from JWT
    const { data } = await api.post("/auth/login", { email, password });
    let userRole: UserRole = "user";
    try {
      const payload = JSON.parse(atob(data.access_token.split(".")[1]));
      if (payload.role === "responder") userRole = "responder";
      else if (payload.role === "admin") userRole = "admin";
    } catch { /* ignore */ }
    sessionStorage.setItem("token", data.access_token);
    sessionStorage.setItem("role", userRole ?? "user");
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", userRole ?? "user");
    setRole(userRole);
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setRole(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
