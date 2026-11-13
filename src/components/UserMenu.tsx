"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UI } from "@/lib/i18n/labels";

export default function UserMenu() {
  const { user, isLoading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
      >
        {UI.signIn}
      </Link>
    );
  }

  const userInitial =
    user.user_metadata?.full_name?.[0] ||
    user.user_metadata?.name?.[0] ||
    user.email?.[0]?.toUpperCase() ||
    "К";

  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || user.email || UI.user;

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 sm:gap-2 rounded-lg p-1 sm:p-2 hover:bg-slate-100 transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs sm:text-sm font-medium">
            {userInitial}
          </div>
        )}
        <span className="text-xs sm:text-sm font-medium text-slate-700 max-w-[100px] sm:max-w-[120px] truncate hidden sm:block">
          {userName}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 sm:w-56 rounded-lg bg-white border border-slate-200 shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{userName}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <Link
            href="/account/password"
            onClick={() => setIsOpen(false)}
            className="block w-full text-left px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Сменить пароль
          </Link>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full text-left px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSigningOut ? UI.signingOut : UI.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
