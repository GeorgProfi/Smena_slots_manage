import { format } from "date-fns";
import { ru } from "date-fns/locale";

/** Подписи ролей и общие UI-строки (интерфейс на русском). */
export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "Супер-администратор";
    case "admin":
      return "Администратор";
    case "volunteer":
      return "Курьер";
    default:
      return role ?? "—";
  }
}

export const UI = {
  appName: "Смена слоты",
  couriers: "Курьеры",
  courier: "Курьер",
  courierPortal: "Кабинет курьера",
  adminPanel: "Панель администратора",
  signIn: "Войти",
  signOut: "Выйти",
  signingOut: "Выход…",
  loading: "Загрузка…",
  save: "Сохранить",
  cancel: "Отмена",
  backHome: "← На главную",
  user: "Пользователь",
} as const;

/** Например: «Ноябрь 2026». */
export function formatMonthYearRu(date: Date): string {
  const raw = format(date, "LLLL yyyy", { locale: ru });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
