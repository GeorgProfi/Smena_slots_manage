"use client";

import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordContent() {
  const { updatePassword, refreshAuth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают.");
      return;
    }
    try {
      setError(null);
      setIsSubmitting(true);
      if (token) {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Не удалось сбросить пароль");
        await refreshAuth();
      } else {
        await updatePassword(password);
      }
      setDone(true);
      setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось обновить пароль.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Новый пароль" subtitle="Придумайте надёжный пароль для аккаунта">
      {!token && (
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          Уже вошли? Сохраните новый пароль ниже. Иначе перейдите по ссылке из письма (
          <code className="text-xs">?token=...</code>).
        </p>
      )}
      {done ? (
        <p className="text-center text-sm text-green-700 dark:text-green-300">Пароль обновлён. Перенаправление…</p>
      ) : (
        <>
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Новый пароль
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
                Подтверждение пароля
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
              {isSubmitting ? "Сохранение…" : "Обновить пароль"}
            </button>
          </form>
          {!token && (
            <p className="text-center text-sm">
              <Link href="/forgot-password" className="hover:underline">
                Запросить ссылку для сброса
              </Link>
            </p>
          )}
        </>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
