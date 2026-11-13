import Link from "next/link";

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6">
            ← На главную
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Условия использования</h1>
          <p className="text-sm text-slate-500 mb-8">Обновлено: 23 декабря 2025 г.</p>
          <div className="prose prose-slate max-w-none space-y-6">
            <section>
              <h2>1. Соглашение</h2>
              <p>
                Используя VolunTy, вы соглашаетесь с этими условиями. Если вы не согласны, пожалуйста, не пользуйтесь
                приложением.
              </p>
            </section>
            <section>
              <h2>2. Использование сервиса</h2>
              <p>
                Сервис предназначен для управления событиями и сменами курьеров. Вы несёте ответственность за
                размещаемую информацию и соблюдение применимого законодательства.
              </p>
            </section>
            <section>
              <h2>3. Учётные записи</h2>
              <p>
                Вход выполняется по email и паролю. При включении организацией доступен вход через Google. Вы обязаны
                обеспечивать сохранность пароля.
              </p>
            </section>
            <section>
              <h2>4. Данные</h2>
              <p>
                Мы обрабатываем данные в соответствии с{" "}
                <Link href="/privacy">политикой конфиденциальности</Link>. Запрос на удаление — на странице{" "}
                <Link href="/data-deletion">удаления данных</Link>.
              </p>
            </section>
            <section>
              <h2>5. Прекращение доступа</h2>
              <p>Мы можем ограничить или закрыть доступ при нарушении условий или злоупотреблении сервисом.</p>
            </section>
            <section>
              <h2>6. Отказ от гарантий</h2>
              <p>Сервис предоставляется «как есть». Мы не несём ответственности за ущерб от использования сервиса.</p>
            </section>
            <section>
              <h2>7. Контакты</h2>
              <p>Вопросы по условиям: legal@volunty.app</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
