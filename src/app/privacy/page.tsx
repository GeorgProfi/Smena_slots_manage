import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
          >
            ← На главную
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Политика конфиденциальности</h1>
          <p className="text-sm text-slate-500 mb-8">Обновлено: 23 декабря 2025 г.</p>

          <div className="prose prose-slate max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Введение</h2>
              <p className="text-slate-600">
                VolunTy («мы») защищает вашу конфиденциальность. Эта политика объясняет, какие данные мы собираем,
                как используем и храним их при работе с приложением для планирования смен курьеров.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Какие данные собираем</h2>
              <p className="text-slate-600 mb-2">При регистрации и входе:</p>
              <ul className="list-disc list-inside text-slate-600 space-y-1 ml-4">
                <li>Email и указанное имя</li>
                <li>Данные профиля Google при входе через Google (имя, аватар), если включено</li>
                <li>Идентификаторы аутентификации в нашей системе</li>
              </ul>
              <p className="text-slate-600 mt-3">Также сохраняем сведения о ваших сменах и действиях в приложении.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Как используем данные</h2>
              <ul className="list-disc list-inside text-slate-600 space-y-1 ml-4">
                <li>Вход и идентификация в системе</li>
                <li>Управление сменами и расписанием</li>
                <li>Показ доступных смен и уведомления</li>
                <li>Улучшение сервиса</li>
                <li>Связь по вопросам смен и событий</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Передача данных</h2>
              <p className="text-slate-600">
                Мы не продаём персональные данные. Данные могут передаваться поставщикам инфраструктуры (хостинг, БД,
                почта) и администраторам вашей организации — только в объёме, нужном для координации смен.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Безопасность</h2>
              <p className="text-slate-600">
                Применяем разумные меры защиты. Передача данных через интернет не может быть полностью безопасной.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Ваши права</h2>
              <ul className="list-disc list-inside text-slate-600 space-y-1 ml-4">
                <li>Доступ к данным и исправление</li>
                <li>Удаление данных</li>
                <li>Отзыв согласия</li>
                <li>Экспорт данных (по запросу)</li>
              </ul>
              <p className="text-slate-600 mt-3">
                Запрос на удаление — на странице{" "}
                <Link href="/data-deletion" className="text-blue-600 hover:underline">
                  удаления данных
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Хранение</h2>
              <p className="text-slate-600">
                Данные хранятся, пока нужны для работы сервиса. После удаления аккаунта персональные данные удаляются
                или обезличиваются в течение 30 дней.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Сторонние сервисы</h2>
              <p className="text-slate-600">
                При входе через Google действует политика Google. Остальная обработка выполняется на инфраструктуре,
                настроенной администратором организации.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Дети</h2>
              <p className="text-slate-600">
                Сервис не предназначен для лиц младше 13 лет; мы сознательно не собираем их данные.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Изменения</h2>
              <p className="text-slate-600">
                Политика может обновляться; актуальная версия всегда на этой странице с датой обновления.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-900 mb-3">11. Контакты</h2>
              <p className="text-slate-600">Вопросы: privacy@volunty.app</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
