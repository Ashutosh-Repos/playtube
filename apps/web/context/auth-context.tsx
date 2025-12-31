"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

// ... imports

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  accessToken: string | null;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
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
  const [accessToken, setAccessToken] = useState<string | null>(null); // We don't expose AT to client easily via server props unless we leak it.
  // Actually, for client-side API calls, we might need AT. 
  // But HttpOnly cookie handles it for Next.js API Routes.
  // If we call external services directly from client, we need AT.
  // Assuming we use API Routes as proxy, we don't need AT in memory.
  // But the original context had specific logic for it.
  // Let's keep it null for now, assuming cookies handle the auth.
  
  const [isLoading, setIsLoading] = useState(false); // No longer loading initially!
  const router = useRouter();

  // We can still try to refresh if initialUser is null, to be safe? 
  // No, if server says null, it's null.
  
  // Keep refreshSession for manual invocation if needed, but not on mount.
  // No-op for now as we hydrate from server.
  const refreshSession = async () => {};

  const login = async (credentials: any) => {
    // Server Action
    const { loginAction } = await import("@/app/actions/auth");
    const result = await loginAction({
        email: credentials.email, 
        password: credentials.password 
    });

    if (result?.error) {
      throw new Error(result.error);
    }
    // Action handles redirect.
  };

  const register = async (credentials: any) => {
    const formData = new FormData();
    formData.append("email", credentials.email);
    formData.append("password", credentials.password);
    formData.append("name", credentials.name || "");

    const { registerAction } = await import("@/app/actions/auth");
    const result = await registerAction({}, formData);

    if (result?.error) {
      throw new Error(result.error);
    }
    // Action return success, likely we should redirect manually if action didn't
    if (result?.success) {
         router.push(`/verify-email?email=${encodeURIComponent(credentials.email)}`);
    }
  };

  const logout = async () => {
    const { logoutAction } = await import("@/app/actions/auth");
    await logoutAction(); // Handles redirect
    setUser(null);
    setAccessToken(null);
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
