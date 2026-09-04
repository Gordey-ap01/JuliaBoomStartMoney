(function () {
  'use strict';

  window.PROPOSAL_PRICING = {
    version: 1,
    currency: 'RUB',
    baseOneTime: 96000,
    moduleDayRate: 11500,
    techniqueDayRate: 10500,
    design: {
      'clear-celebration': 78000,
      'enchanted-backstage': 108000,
      'editorial-premiere': 116000,
      'family-showcase': 86000,
      'directors-magic': 128000,
    },
    moduleOverrides: {
      'home-story': 69000,
      'program-catalog': 98000,
      'admin-panel': 124000,
      'admin-calendar': 168000,
      'conflict-engine': 126000,
      'program-builder': 138000,
      'inventory-management': 132000,
    },
    recurring: {
      'analytics': { amount: 0, label: 'Базовая веб-аналитика', note: 'При использовании бесплатного тарифа сервиса' },
      'call-tracking': { amount: 3900, label: 'Call tracking', note: 'Ориентир внешнего сервиса, зависит от минут и номеров' },
      'newsletter': { amount: 1900, label: 'Сервис рассылок', note: 'Ориентир до роста базы подписчиков' },
      'crm-sync': { amount: 4900, label: 'Лицензии CRM', note: 'Ориентир для небольшой команды; тариф уточняется у поставщика' },
      'google-calendar': { amount: 0, label: 'Google Calendar', note: 'Отдельная подписка не заложена' },
      'outlook-calendar': { amount: 0, label: 'Outlook Calendar', note: 'Лицензия Microsoft 365 не включена' },
      'telegram-alerts': { amount: 0, label: 'Telegram-уведомления', note: 'Без отдельной абонентской платы платформе' },
    },
    baseRecurring: [
      { id: 'hosting', amount: 1800, label: 'Хостинг и резервное копирование', note: 'Предварительный ориентир для первого этапа' },
    ],
    labels: {
      design: 'Дизайн-направление',
      module: 'Ориентир разработки',
      technique: 'Ориентир приёма',
      base: 'Базовый контур проекта',
      baseNote: 'Архитектура, адаптивная вёрстка, доступность, формы, базовая техническая настройка и проверка.',
      oneTime: 'Единовременная разработка',
      recurring: 'Возможные регулярные расходы в месяц',
      total: 'Предварительный итог',
      preliminary: 'Расчёт предварительный. Финальная смета фиксируется после согласования технического задания, контента и интеграций.',
      dayRate: 'Модули оцениваются по видимому объёму работ; индивидуальные исключения перечислены в этом же файле конфигурации.',
      included: 'Включено в расчёт',
      noRecurring: 'Выбранные модули не добавляют регулярных расходов, кроме базового размещения.',
    },
    format(value) {
      return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
    },
    formatMonthly(value) {
      return `${new Intl.NumberFormat('ru-RU').format(value)} ₽ / мес.`;
    },
  };
})();
