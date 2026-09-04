(function () {
  'use strict';

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const complexitySafe = (value) => String(value || '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char]));

  function minutes(time) {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  }

  function overlap(first, second) {
    return minutes(first.start) < minutes(second.end) && minutes(second.start) < minutes(first.end);
  }

  function shared(first, second, key) {
    return (first[key] || []).filter((value) => (second[key] || []).includes(value));
  }

  function detectConflicts(events) {
    const conflicts = [];
    const seen = new Set();
    const add = (type, message, ids) => {
      const key = `${type}:${[...ids].sort().join(':')}`;
      if (seen.has(key)) return;
      seen.add(key);
      conflicts.push({ type, message, eventIds: ids });
    };

    events.forEach((event) => {
      if (event.status !== 'unavailable' && (!event.setup || !event.teardown)) {
        add('preparation', `В событии ${event.day} сентября не полностью учтены монтаж, демонтаж или подготовка.`, [event.id]);
      }
    });

    for (let i = 0; i < events.length; i += 1) {
      for (let j = i + 1; j < events.length; j += 1) {
        const first = events[i];
        const second = events[j];
        if (first.day !== second.day || first.status === 'unavailable' || second.status === 'unavailable') continue;
        const performers = shared(first, second, 'performers');
        const costumes = shared(first, second, 'costumes');
        const props = shared(first, second, 'props');
        if (overlap(first, second) && performers.length) {
          add('performer', `Артист ${performers.join(', ')} назначен на два пересекающихся события ${first.day} сентября.`, [first.id, second.id]);
        }
        if (overlap(first, second) && (costumes.length || props.length)) {
          const resources = [...costumes, ...props].join(', ');
          add('resource', `Ресурс «${resources}» нужен одновременно на двух площадках ${first.day} сентября.`, [first.id, second.id]);
        }
        if (performers.length) {
          const earlier = minutes(first.start) <= minutes(second.start) ? first : second;
          const later = earlier === first ? second : first;
          const gap = minutes(later.start) - minutes(earlier.end);
          const needed = earlier.teardown + Math.max(earlier.travel, later.travel) + later.setup;
          if (gap < needed) {
            add('travel', `Для артиста ${performers.join(', ')} между событиями ${earlier.day} сентября нужно ${needed} мин., доступно ${Math.max(0, gap)} мин.`, [first.id, second.id]);
          }
        }
      }
    }
    return conflicts;
  }

  function uniqueValues(events, filterId) {
    const map = {
      performer: 'performers', character: 'characters', costume: 'costumes', mascot: 'mascots',
      program: 'programs', props: 'props', location: 'location', manager: 'manager', status: 'status',
    };
    const key = map[filterId];
    const values = events.flatMap((event) => Array.isArray(event[key]) ? event[key] : [event[key]]).filter(Boolean);
    return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'ru'));
  }

  function init(options) {
    const root = options.root;
    const dialog = options.dialog;
    const dialogTitle = dialog.querySelector('[data-event-title]');
    const dialogBody = dialog.querySelector('[data-event-body]');
    const data = options.data;
    const conflicts = detectConflicts(data.events);
    const state = { view: 'month', audience: 'public', filters: {} };
    const conflictIds = new Set(conflicts.flatMap((conflict) => conflict.eventIds));

    const markExplored = () => {
      root.dataset.explored = 'true';
      options.onExplore?.();
    };

    function renderFilters() {
      const holder = root.querySelector('[data-calendar-filters]');
      holder.innerHTML = data.filters.map((filter) => {
        const values = uniqueValues(data.events, filter.id);
        const isPrivate = filter.id === 'manager' || filter.id === 'status';
        const optionsMarkup = values.map((value) => {
          const label = filter.id === 'status' ? data.statusLabels[value] : value;
          return `<option value="${complexitySafe(value)}">${complexitySafe(label)}</option>`;
        }).join('');
        return `<label class="calendar-filter" data-private="${isPrivate}" data-filter-wrap="${filter.id}">
          <span>${complexitySafe(filter.label)}</span>
          <select data-calendar-filter="${filter.id}" aria-label="Фильтр: ${complexitySafe(filter.label)}">
            <option value="">Все</option>${optionsMarkup}
          </select>
        </label>`;
      }).join('');
      holder.addEventListener('change', (event) => {
        const select = event.target.closest('[data-calendar-filter]');
        if (!select) return;
        state.filters[select.dataset.calendarFilter] = select.value;
        markExplored();
        render();
      });
    }

    function eventMatchesSafe(event) {
      const map = {
        performer: event.performers, character: event.characters, costume: event.costumes, mascot: event.mascots,
        program: event.programs, props: event.props, location: [event.location], manager: [event.manager], status: [event.status],
      };
      return Object.entries(state.filters).every(([key, value]) => !value || (map[key] || []).includes(value));
    }

    function publicLabel(event) {
      if (event.status === 'unavailable') return 'Недоступно';
      if (event.status === 'tentative') return 'Ограниченно';
      return 'Часть ресурсов занята';
    }

    function openEvent(event) {
      markExplored();
      if (state.audience === 'public') {
        dialogTitle.textContent = `Доступность · ${event.day} сентября`;
        dialogBody.innerHTML = `<div class="privacy-note">
          <strong>${complexitySafe(publicLabel(event))}</strong>
          <p>Публичная версия показывает только доступность. Имена клиентов, адреса, состав заказа, оплата и комментарии доступны только сотрудникам.</p>
          <p>Интервал: ${complexitySafe(event.start)}–${complexitySafe(event.end)}. Отправьте запрос даты — менеджер проверит конкретный состав.</p>
        </div>`;
      } else {
        dialogTitle.textContent = `${event.type} · ${event.day} сентября`;
        const rows = [
          ['Дата и время', `${event.day} сентября, ${event.start}–${event.end}`],
          ['Место', event.place], ['Адрес', event.address], ['Контакт клиента', event.client],
          ['Тип мероприятия', event.type], ['Артисты', event.performers.join(', ') || '—'],
          ['Персонажи', event.characters.join(', ') || '—'], ['Костюмы', event.costumes.join(', ') || '—'],
          ['Ростовые куклы', event.mascots.join(', ') || '—'], ['Реквизит', event.props.join(', ') || '—'],
          ['Шоу-программа', event.programs.join(', ') || '—'],
          ['Монтаж / демонтаж', `${event.setup} / ${event.teardown} мин.`],
          ['Логистический буфер', `${event.travel} мин.`], ['Менеджер', event.manager],
          ['Комментарий', event.comment], ['Статус оплаты', event.payment],
          ['Статус заказа', data.statusLabels[event.status]],
        ];
        dialogBody.innerHTML = `<dl class="event-details">${rows.map(([term, value]) => `<div><dt>${complexitySafe(term)}</dt><dd>${complexitySafe(value)}</dd></div>`).join('')}</dl>`;
      }
      dialog.showModal();
    }

    function eventButton(event) {
      const label = state.audience === 'public' ? publicLabel(event) : `${event.type} · ${event.place}`;
      const conflictClass = state.audience === 'admin' && conflictIds.has(event.id) ? ' has-conflict' : '';
      const buffer = state.audience === 'admin'
        ? `<span class="event-buffer">+${event.setup} подготовка · ${event.travel} дорога · ${event.teardown} завершение</span>`
        : '';
      return `<button class="calendar-event${conflictClass}" type="button" data-event-id="${event.id}" data-status="${event.status}" aria-label="${complexitySafe(label)}, ${event.day} сентября, ${event.start}–${event.end}">
        <time>${event.start}</time><span class="event-short">${complexitySafe(label)}</span>${buffer}
      </button>`;
    }

    function renderLegend() {
      const legend = root.querySelector('[data-calendar-legend]');
      if (!legend) return;
      legend.innerHTML = state.audience === 'public'
        ? '<li><span class="legend-swatch legend-free"></span>Свободно</li><li><span class="legend-swatch legend-tentative"></span>Доступность ограничена</li><li><span class="legend-swatch legend-confirmed"></span>Часть ресурсов занята</li><li><span class="legend-swatch legend-unavailable"></span>Недоступно</li>'
        : '<li><span class="legend-swatch legend-tentative"></span>Предварительно</li><li><span class="legend-swatch legend-confirmed"></span>Подтверждено</li><li><span class="legend-swatch legend-unavailable"></span>Недоступно</li><li><span class="legend-swatch legend-buffer"></span>Подготовка и дорога</li>';
    }

    function renderMonth(events) {
      const firstDay = new Date(2026, 8, 1).getDay();
      const offset = firstDay === 0 ? 6 : firstDay - 1;
      const cells = [];
      weekdays.forEach((day) => cells.push(`<div class="weekday" role="columnheader">${day}</div>`));
      for (let i = 0; i < offset; i += 1) cells.push('<div class="calendar-day is-empty" role="gridcell" aria-hidden="true"></div>');
      for (let day = 1; day <= 30; day += 1) {
        const dayEvents = events.filter((event) => event.day === day);
        cells.push(`<div class="calendar-day" role="gridcell" aria-label="${day} сентября"><span class="day-number">${day}</span>${dayEvents.map(eventButton).join('')}</div>`);
      }
      return `<div class="month-grid" role="grid" aria-label="Календарь на сентябрь 2026">${cells.join('')}</div>`;
    }

    function renderWeek(events) {
      const days = [7, 8, 9, 10, 11, 12, 13];
      const hours = [10, 12, 14, 16, 18];
      const cells = ['<div class="week-cell"></div>', ...days.map((day) => `<div class="week-cell"><strong>${day} сен</strong></div>`)];
      hours.forEach((hour) => {
        cells.push(`<div class="week-cell week-time">${String(hour).padStart(2, '0')}:00</div>`);
        days.forEach((day) => {
          const rowEvents = events.filter((event) => event.day === day && Math.floor(minutes(event.start) / 60) >= hour && Math.floor(minutes(event.start) / 60) < hour + 2);
          cells.push(`<div class="week-cell ${rowEvents.length ? 'week-event' : ''}">${rowEvents.map(eventButton).join('')}</div>`);
        });
      });
      return `<div class="week-scroll" tabindex="0" aria-label="Недельный календарь, прокручивается по горизонтали"><div class="week-grid" role="grid">${cells.join('')}</div></div>`;
    }

    function renderConflicts() {
      const panel = root.querySelector('[data-calendar-conflicts]');
      if (state.audience === 'public') {
        panel.innerHTML = `<div class="privacy-note"><strong>Публичный режим защищает данные заказа.</strong><br>Посетителю доступны только свободные и ограниченные интервалы. Конкретные клиенты, адреса, артисты и служебные комментарии скрыты.</div>
          <div class="privacy-note"><strong>Это интерактивный прототип.</strong><br>Он демонстрирует логику интерфейса на вымышленных данных и не является production-бэкендом.</div>`;
        return;
      }
      panel.innerHTML = `<div><p class="eyebrow">Автоматическая проверка</p><ul class="conflict-list">${conflicts.map((conflict) => `<li class="conflict-item"><span class="conflict-mark">!</span><span>${complexitySafe(conflict.message)}</span></li>`).join('')}</ul></div>
        <div class="privacy-note"><strong>Что проверяется</strong><br>Пересечения артиста, костюма и реквизита; логистический буфер; монтаж, демонтаж и подготовка. Предупреждение не подтверждает и не отменяет заказ — решение остаётся за сотрудником.</div>`;
    }

    function render() {
      const events = data.events.filter(eventMatchesSafe);
      root.querySelector('[data-calendar-grid]').innerHTML = state.view === 'month' ? renderMonth(events) : renderWeek(events);
      root.querySelectorAll('[data-calendar-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.calendarView === state.view)));
      root.querySelectorAll('[data-calendar-audience]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.calendarAudience === state.audience)));
      root.querySelectorAll('[data-private="true"]').forEach((field) => { field.hidden = state.audience !== 'admin'; });
      root.querySelector('[data-calendar-mode-note]').textContent = state.audience === 'public'
        ? 'Посетитель видит только доступность — без имён, адресов и внутренних статусов.'
        : 'Демонстрационный закрытый режим: полные карточки и проверки конфликтов.';
      renderConflicts();
      renderLegend();
    }

    root.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-calendar-view]');
      if (viewButton) {
        state.view = viewButton.dataset.calendarView;
        markExplored();
        render();
        return;
      }
      const audienceButton = event.target.closest('[data-calendar-audience]');
      if (audienceButton) {
        state.audience = audienceButton.dataset.calendarAudience;
        markExplored();
        render();
        return;
      }
      const eventButtonElement = event.target.closest('[data-event-id]');
      if (eventButtonElement) {
        const selected = data.events.find((calendarEvent) => calendarEvent.id === eventButtonElement.dataset.eventId);
        if (selected) openEvent(selected);
      }
    });

    dialog.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
    renderFilters();
    render();
    return { conflicts };
  }

  window.CalendarDemo = { init, detectConflicts };
})();
