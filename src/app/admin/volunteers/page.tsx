import AdminLayout from "@/components/AdminLayout";
import AdminVolunteersList from "@/components/AdminVolunteersList";

export default function AdminVolunteersPage() {
  return (
    <AdminLayout>
      <div className="p-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Курьеры</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Профили курьеров, назначения на смены и роли.
            </p>
          </div>

          <AdminVolunteersList />
        </div>
      </div>
    </AdminLayout>
  );
}
