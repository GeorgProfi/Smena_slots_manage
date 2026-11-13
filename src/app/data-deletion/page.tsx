"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function DataDeletion() {
  const { user, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // If the user is logged in, perform immediate deletion
    if (user) {
      if (confirmText.trim().toUpperCase() !== "DELETE") {
        setError('Введите DELETE для подтверждения.');
        return;
      }
      // Show final confirmation modal before proceeding
      setShowConfirm(true);
    } else {
      // Not logged in: submit a request only (informational)
      console.log("Deletion request submitted (not authenticated)", { email, reason });
      setSubmitted(true);
    }
  };

  const confirmDeletion = async () => {
    try {
      setDeleting(true);
      setError(null);
      const res = await fetch("/api/data-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Не удалось удалить" }));
        throw new Error(data.error || "Не удалось удалить");
      }
      await signOut();
      setShowConfirm(false);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Ошибка при удалении данных.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
          >
            ← На главную
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Удаление данных</h1>
          <p className="text-sm text-slate-500 mb-8">Запрос на удаление персональных данных из «Смена слоты»</p>

          {!submitted ? (
            <>
              {user && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-red-900 mb-2">Немедленное удаление аккаунта</h3>
                  <p className="text-sm text-red-800 mb-3">
                    Вы вошли в систему. Отправка формы безвозвратно удалит аккаунт и все связанные данные.
                  </p>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-red-900">
                      Введите <span className="font-bold">DELETE</span> для подтверждения
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      placeholder="DELETE"
                    />
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Что будет удалено?
                </h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Аккаунт и профиль</li>
                  <li>История смен</li>
                  <li>Персональные данные, связанные с аккаунтом</li>
                  <li>Учётные данные для входа</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-amber-900 mb-2">
                  Важно
                </h3>
                <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                  <li>После обработки (до 30 дней) восстановление невозможно</li>
                  <li>Доступ к расписанию и истории будет потерян</li>
                  <li>Организация может хранить обезличенные данные для отчётности</li>
                </ul>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    Email
                  </label>
                  <input
                    type="text"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Укажите email, с которым регистрировались
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reason"
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    Причина (необязательно)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    placeholder="Расскажите, почему уходите…"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deleting}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  {deleting ? "Удаление…" : user ? "Удалить мой аккаунт и данные" : "Отправить запрос"}
                </button>
              </form>

              {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-slate-900">Вы уверены?</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Ваш аккаунт в «Смена слоты» и все данные будут удалены безвозвратно.
                      </p>
                      <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setShowConfirm(false)}
                          className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={confirmDeletion}
                          disabled={deleting}
                          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting ? "Удаление…" : "Да, удалить аккаунт"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="font-semibold text-slate-900 mb-3">
                  Другие варианты
                </h3>
                <div className="space-y-2 text-sm text-slate-600">
                  <p>Вместо удаления можно:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Выйти из аккаунта и перестать пользоваться сервисом</li>
                    <li>Сменить пароль на /account/password</li>
                    <li>Написать на privacy@volunty.app</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                Запрос отправлен
              </h2>
              <p className="text-slate-600 mb-6">
                Запрос получен. Обработаем в течение 30 дней и отправим подтверждение на указанный email.
              </p>
              <p className="text-sm text-slate-500 mb-6">Вопросы: privacy@volunty.app</p>
              <Link
                href="/"
                className="inline-block bg-slate-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                На главную
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Вход через Google</h2>
          <p className="text-sm text-slate-600">
            Если раньше входили через Google, задайте пароль через{" "}
            <Link href="/forgot-password" className="text-blue-600 hover:underline">
              сброс пароля
            </Link>{" "}
            на том же email.
          </p>
        </div>
      </div>
    </main>
  );
}
