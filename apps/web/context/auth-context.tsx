"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { logoutAction, getCurrentUserAction } from "@/app/actions/auth";

export interface User {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ 
    children, 
    initialUser = null 
}: { 
    children: React.ReactNode; 
    initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state with server-provided prop on navigation/redirects
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const refreshUser = async () => {
      // Background update - silent fallback
      try {
          const freshUser = await getCurrentUserAction();
          setUser(freshUser);
      } catch (e) {
          console.error("Failed to refresh user", e);
      }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutAction(); // Handles redirect
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Alias for NextAuth migration ease
// Alias Removed: Use AuthProvider for Client Context, or SessionProvider from @/context/session-provider for Server Component.

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// NextAuth v5 Mimic
export const useSession = () => {
  const context = useAuth();
  
  return {
    data: context.user ? { user: context.user } : null,
    status: context.isLoading ? "loading" : (context.user ? "authenticated" : "unauthenticated"),
    update: context.refreshUser, 
  };
};
