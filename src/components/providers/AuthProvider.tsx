"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const googleAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH !== "false";

type AuthProviderProps = {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialRole?: string | null;
};

export type SignUpResult =
  | { status: "signed_in" }
  | { status: "confirm_email" };

type AuthContextType = {
  user: User | null;
  session: Session | null;
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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialSession = null,
  initialRole = undefined,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState(!initialSession || initialRole === undefined);
  const [role, setRole] = useState<string | null>(initialRole ?? null);
  const supabase = useMemo(() => createClient(), []);

  const loadRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (error) {
        console.error("Error loading role:", error.message);
        setRole(null);
        return;
      }
      setRole(data?.role ?? null);
    } catch (e: unknown) {
      console.error("Exception loading role:", e);
      setRole(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        let activeSession = session;

        if (!activeSession) {
          const { data: fetchedData } = await supabase.auth.getUser();

          if (!isMounted) return;

          activeSession = fetchedData.user ? ({ user: fetchedData.user } as Session) : null;
          setSession(activeSession);
          setUser(fetchedData.user ?? null);
        }

        if (activeSession?.user && initialRole === undefined) {
          await loadRole(activeSession.user.id);
        }

        if (!activeSession?.user) {
          setRole(null);
        }

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (e: unknown) {
        console.error("AuthProvider initialization error:", e);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await loadRole(nextSession.user.id);
      } else {
        setRole(null);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, initialRole]);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      console.error("Error signing in with email:", error.message);
      throw error;
    }
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
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", "/reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectTo.toString(),
    });
    if (error) {
      console.error("Error sending reset email:", error.message);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error("Error updating password:", error.message);
      throw error;
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    if (!googleAuthEnabled) {
      throw new Error("Google sign-in is disabled");
    }
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectTo) {
      callbackUrl.searchParams.set("next", redirectTo);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
    if (error) {
      console.error("Error signing in with Google:", error.message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setSession(null);
      setRole(null);

      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("Error signing out:", error.message);
        throw error;
      }
    } catch (error) {
      console.error("Sign out failed:", error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    isLoading,
    role,
    googleAuthEnabled,
    signInWithEmail,
    signUpWithEmail,
    resetPasswordForEmail,
    updatePassword,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
