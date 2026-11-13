"use client";

import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AccountPasswordPage() {
  const { user, isLoading, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login?redirectTo=/account/password");
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setError(null);
      setIsSubmitting(true);
      await updatePassword(password);
      setSuccess(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError("Could not update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white" />
      </div>
    );
  }

  return (
    <AuthShell title="Change password" subtitle="Set or update your email sign-in password">
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
        Signed in as {user.email}. If you used Google before, set a password here or use{" "}
        <Link href="/forgot-password" className="underline">
          forgot password
        </Link>
        .
      </p>

      {success && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg p-4 text-sm text-green-800 dark:text-green-200">
          Password saved.
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg p-4 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 dark:bg-white px-4 py-3 text-sm font-medium text-white dark:text-slate-900 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
