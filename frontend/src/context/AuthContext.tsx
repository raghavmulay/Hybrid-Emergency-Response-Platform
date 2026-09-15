import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "../api/client";

type AuthContextType = {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem("token"));

  const login = async (email: string, password: string) => {
    // Hard‑coded admin credentials bypass backend
    if (email === "admin@gmail.com" && password === "admin@123") {
      localStorage.setItem("token", "admin-token");
      setIsAuthenticated(true);
      return;
    }
    // Regular user login via API
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.access_token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
