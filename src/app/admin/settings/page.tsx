"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import SuperadminTransfer from "@/components/SuperadminTransfer";
import { Save, Loader2 } from "lucide-react";

const timezones = [
  { value: "Europe/Brussels", label: "Europe/Brussels (Belgium)" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (Netherlands)" },
  { value: "Europe/Paris", label: "Europe/Paris (France)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (Germany)" },
  { value: "Europe/London", label: "Europe/London (UK)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "UTC", label: "UTC" },
];

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState("Europe/Brussels");

  // Organization settings
  const [orgName, setOrgName] = useState<string>("");
  const [orgLogoUrl, setOrgLogoUrl] = useState<string>("");
  const [allowSelfSignup, setAllowSelfSignup] = useState<boolean>(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [reminderHours, setReminderHours] = useState<number>(24);

  // User preferences
  const [prefLoading, setPrefLoading] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);
  const [darkModePref, setDarkModePref] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadUserPreferences();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setTimezone(data.timezone || "Europe/Brussels");
        setOrgName(data.organization_name || "");
        setOrgLogoUrl(data.organization_logo_url || "");
        setAllowSelfSignup((data.allow_self_signup ?? "true") === "true");
        setNotificationsEnabled((data.notifications_enabled ?? "true") === "true");
        const hours = parseInt(data.reminder_hours_before_shift ?? "24", 10);
        setReminderHours(Number.isNaN(hours) ? 24 : hours);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateTimezone = async (value: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "timezone", value }),
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      setTimezone(value);
    } catch (error) {
      console.error("Failed to save setting:", error);
      alert("Не удалось сохранить настройку");
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMessage(null);
    setInviteError(null);
    setInviting(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          fullName: inviteName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setInviteMessage(`Приглашение отправлено на ${inviteEmail.trim()}.`);
      setInviteEmail("");
      setInviteName("");
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Не удалось отправить приглашение");
    } finally {
      setInviting(false);
    }
  };

  const saveSetting = async (key: string, value: string | boolean | number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: String(value) }),
      });
      if (!res.ok) throw new Error("Failed to save setting");
    } catch (e) {
      console.error("Failed to save setting:", e);
      alert("Не удалось сохранить настройку");
    } finally {
      setSaving(false);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const res = await fetch("/api/user/preferences");
      if (!res.ok) {
        setPrefLoading(false);
        return;
      }
      const data = await res.json();
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const me = await meRes.json();
        setUserId(me.user?.id ?? null);
      }
      setDarkModePref(Boolean(data?.dark_mode ?? false));
      setEmailNotifications(Boolean(data?.email_notifications ?? true));
    } catch (e) {
      console.error("Exception loading preferences:", e);
    } finally {
      setPrefLoading(false);
    }
  };

  const saveUserPreferences = async (prefs: { dark_mode?: boolean; email_notifications?: boolean }) => {
    if (!userId) return;
    setPrefLoading(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dark_mode: prefs.dark_mode ?? darkModePref,
          email_notifications: prefs.email_notifications ?? emailNotifications,
        }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      if (prefs.dark_mode !== undefined) setDarkModePref(prefs.dark_mode);
      if (prefs.email_notifications !== undefined) setEmailNotifications(prefs.email_notifications);
    } catch (e: any) {
      console.error("Failed to save preferences:", e.message ?? e);
      alert("Не удалось сохранить настройки");
    } finally {
      setPrefLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 bg-slate-50 min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">Настройки</h1>
            <p className="text-slate-500">Параметры организации и личные предпочтения.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Часовой пояс</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Часовой пояс по умолчанию для событий и отображения дат в приложении.
                  </p>
                </div>
                <div className="w-72">
                  <select
                    value={timezone}
                    onChange={(e) => updateTimezone(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-slate-900 disabled:opacity-50"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Organization Name */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Название организации</h3>
                  <p className="text-sm text-slate-500 mt-1">Отображается в приложении и в письмах.</p>
                </div>
                <div className="w-72">
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    onBlur={() => saveSetting("organization_name", orgName)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 disabled:opacity-50"
                    placeholder="Смена слоты"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Organization Logo URL */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">URL логотипа</h3>
                  <p className="text-sm text-slate-500 mt-1">Публичная ссылка на логотип организации.</p>
                </div>
                <div className="w-72">
                  <input
                    type="url"
                    value={orgLogoUrl}
                    onChange={(e) => setOrgLogoUrl(e.target.value)}
                    onBlur={() => saveSetting("organization_logo_url", orgLogoUrl)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 disabled:opacity-50"
                    placeholder="https://.../logo.png"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Allow Self Signup */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Самостоятельная регистрация</h3>
                  <p className="text-sm text-slate-500 mt-1">Разрешить курьерам регистрироваться без приглашения.</p>
                </div>
                <div className="w-72">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowSelfSignup}
                      onChange={(e) => {
                        setAllowSelfSignup(e.target.checked);
                        saveSetting("allow_self_signup", e.target.checked);
                      }}
                      disabled={saving}
                    />
                    <span className="text-sm text-slate-700">Включено</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Invite volunteer */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Пригласить курьера</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Отправить приглашение на email, если саморегистрация отключена.
                </p>
              </div>
              {inviteMessage && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  {inviteMessage}
                </p>
              )}
              {inviteError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{inviteError}</p>
              )}
              <form onSubmit={sendInvite} className="grid gap-3 sm:grid-cols-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="kuryer@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Имя (необязательно)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={inviting}
                  className="sm:col-span-2 inline-flex justify-center items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {inviting ? "Отправка…" : "Отправить приглашение"}
                </button>
              </form>
            </div>
          </div>

          {/* Notifications Enabled */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Email-уведомления</h3>
                  <p className="text-sm text-slate-500 mt-1">Общие письма: напоминания и оповещения.</p>
                </div>
                <div className="w-72">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={notificationsEnabled}
                      onChange={(e) => {
                        setNotificationsEnabled(e.target.checked);
                        saveSetting("notifications_enabled", e.target.checked);
                      }}
                      disabled={saving}
                    />
                    <span className="text-sm text-slate-700">Включено</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Reminder Hours Before Shift */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Напоминания</h3>
                  <p className="text-sm text-slate-500 mt-1">За сколько часов до смены отправлять напоминание.</p>
                </div>
                <div className="w-72">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={reminderHours}
                    onChange={(e) => setReminderHours(parseInt(e.target.value || "24", 10))}
                    onBlur={() => saveSetting("reminder_hours_before_shift", reminderHours)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* User Preferences */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">Ваши настройки</h3>
                  <p className="text-sm text-slate-500 mt-1">Личные уведомления и тема оформления.</p>
                </div>
                <div className="w-72 space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Email-уведомления</span>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => saveUserPreferences({ email_notifications: e.target.checked })}
                      disabled={prefLoading}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">Тёмная тема</span>
                    <input
                      type="checkbox"
                      checked={darkModePref}
                      onChange={(e) => saveUserPreferences({ dark_mode: e.target.checked })}
                      disabled={prefLoading}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {saving && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Сохранение…
            </div>
          )}
        </div>
      </div>
      {/* Superadmin-only floating control; component self-gates by role */}
      <SuperadminTransfer />
    </AdminLayout>
  );
}
