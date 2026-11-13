"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import AuthShell from "@/components/auth/AuthShell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export default function SignupPage() {
  const { user, isLoading, signUpWithEmail } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupAllowed, setSignupAllowed] = useState<boolean | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSignupAllowed((data.allow_self_signup ?? "true") === "true");
        } else {
          setSignupAllowed(true);
        }
      })
      .catch(() => setSignupAllowed(true));
  }, []);

  useEffect(() => {
    if (user && !isLoading) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("Примите условия использования и политику конфиденциальности.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов.`);
      return;
    }
    try {
      setError(null);
      setInfo(null);
      setIsSubmitting(true);
      const result = await signUpWithEmail({
        email,
        password,
        fullName: fullName.trim() || undefined,
      });
      if (result.status === "confirm_email") {
        setInfo("Проверьте почту — там ссылка для подтверждения. Затем войдите.");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || signupAllowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <AuthShell title="Регистрация" subtitle="Присоединяйтесь к организации как курьер">
      {!signupAllowed && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
          Самостоятельная регистрация отключена. Попросите администратора о приглашении или{" "}
          <Link href="/login" className="font-medium underline">
            войдите
          </Link>
          , если аккаунт уже есть.
        </div>
      )}

      {info && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-800 dark:text-green-200">
          {info}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Имя <span className="text-slate-400 font-normal">(необязательно)</span>
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!signupAllowed || isSubmitting}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!signupAllowed || isSubmitting}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!signupAllowed || isSubmitting}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-slate-500">Минимум {MIN_PASSWORD_LENGTH} символов.</p>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            disabled={!signupAllowed}
            className="mt-1"
          />
          <span>
            Я согласен с{" "}
            <Link href="/terms" className="underline">
              условиями использования
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="underline">
              политикой конфиденциальности
            </Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={!signupAllowed || isSubmitting}
          className="w-full rounded-lg bg-slate-900 dark:bg-white px-4 py-3 text-sm font-medium text-white dark:text-slate-900 disabled:opacity-50"
        >
          {isSubmitting ? "Создание аккаунта…" : "Создать аккаунт"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium hover:underline">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
