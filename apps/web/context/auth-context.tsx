"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  accessToken: string | null;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Attempt to restore session via refresh token on mount
    refreshSession();
  }, []);

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
        if (data.user) {
          setUser(data.user);
        }
      } else {
        setUser(null);
        setAccessToken(null);
      }
    } catch (error) {
      console.error(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: any) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Login failed");
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    router.push("/"); // Redirect to dashboard
  };

  const register = async (credentials: any) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Registration failed");
    }
    
    // Auto login after register? Or redirect to login.
    router.push("/login"); 
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAccessToken(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, accessToken, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
