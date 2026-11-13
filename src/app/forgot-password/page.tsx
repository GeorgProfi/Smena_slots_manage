"use client";

import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setIsSubmitting(true);
      await resetPasswordForEmail(email);
      setSent(true);
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure reset link">
      {sent ? (
        <div className="space-y-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>
            If an account exists for <strong className="text-slate-900 dark:text-white">{email}</strong>, you
            will receive an email shortly.
          </p>
          <Link href="/login" className="inline-block font-medium text-slate-900 dark:text-white hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 dark:bg-white px-4 py-3 text-sm font-medium text-white dark:text-slate-900 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="text-center text-sm">
            <Link href="/login" className="text-slate-600 dark:text-slate-400 hover:underline">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
