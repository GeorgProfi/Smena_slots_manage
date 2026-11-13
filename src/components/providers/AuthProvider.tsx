"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type AuthUser = {
  id: string;
  email: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string };
};

type AuthProviderProps = {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
  initialRole?: string | null;
};

export type SignUpResult =
  | { status: "signed_in" }
  | { status: "confirm_email" };

type AuthContextType = {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  isLoading: boolean;
  role: string | null;
  googleAuthEnabled: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (input: {
    email: string;
    password: string;
    fullName?: string;
  }) => Promise<SignUpResult>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialUser = null,
  initialRole = undefined,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [role, setRole] = useState<string | null>(initialRole ?? null);
  const [isLoading, setIsLoading] = useState(initialRole === undefined);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        setUser(null);
        setRole(null);
        return;
      }
      const data = await res.json();
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          user_metadata: { full_name: data.user.full_name },
        });
        setRole(data.user.role ?? null);
      } else {
        setUser(null);
        setRole(null);
      }
    } catch {
      setUser(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRole === undefined) {
      refreshAuth();
    } else {
      setIsLoading(false);
    }
  }, [initialRole, refreshAuth]);

  const signInWithEmail = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Не удалось войти");
    }
    await refreshAuth();
  };

  const signUpWithEmail = async (input: {
    email: string;
    password: string;
    fullName?: string;
  }) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Registration failed");
    }
    if (data.needsEmailConfirmation) {
      return { status: "confirm_email" as const };
    }
    await signInWithEmail(input.email, input.password);
    return { status: "signed_in" as const };
  };

  const resetPasswordForEmail = async (email: string) => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Could not send reset email");
    }
  };

  const updatePassword = async (newPassword: string) => {
    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Could not update password");
    }
  };

  const signInWithGoogle = async () => {
    throw new Error("Google sign-in is not available with Docker Postgres");
  };

  const signOut = async () => {
    await fetch("/auth/signout", { method: "POST" });
    setUser(null);
    setRole(null);
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        role,
        googleAuthEnabled: false,
        signInWithEmail,
        signUpWithEmail,
        resetPasswordForEmail,
        updatePassword,
        signInWithGoogle,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
