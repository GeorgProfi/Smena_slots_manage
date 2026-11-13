import Link from "next/link";
import type { ReactNode } from "react";
import { UI } from "@/lib/i18n/labels";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">{UI.appName}</h1>
          </Link>
          <p className="mt-3 text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          </div>
          {children}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="text-slate-700 dark:text-slate-300 hover:underline">
            ← На главную
          </Link>
        </p>
      </div>
    </main>
  );
}
