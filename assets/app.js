(function () {
  'use strict';

  const data = window.PROPOSAL_DATA;
  const pricing = window.PROPOSAL_PRICING || null;
  const complexityLabels = { low: 'Низкая', medium: 'Средняя', high: 'Высокая' };
  const priorityLabels = { required: 'Обязательно', desired: 'Желательно', later: 'Обсудить позже' };
  const defaultModules = ['home-story', 'service-pages', 'program-catalog', 'program-detail', 'program-lead', 'callback', 'admin-panel'];
  const storageKey = `${data.settings.storagePrefix}-${pricing ? 'estimate' : 'scope'}`;
  const byId = new Map(data.modules.map((module) => [module.id, module]));
  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const tierById = new Map(data.tiers.map((tier) => [tier.id, tier]));
  const designById = new Map(data.designs.map((design) => [design.id, design]));
  const techniqueById = new Map(data.techniques.map((technique) => [technique.id, technique]));
  const inspirationById = new Map(data.journeyChapters.flatMap((chapter) => [
    ...chapter.designChoices.map((choice) => [choice.id, { ...choice, chapterId: chapter.id, type: 'Дизайн' }]),
    ...chapter.voiceChoices.map((choice) => [choice.id, { ...choice, chapterId: chapter.id, type: 'Подача текста' }]),
  ]));
  const categoryImages = {
    presentation: ['assets/images/feature-presentation.webp', 'assets/images/feature-presentation-map.webp', 'assets/images/feature-presentation-seasonal.webp'],
    catalogs: ['assets/images/feature-catalogs.webp', 'assets/images/feature-catalogs-costumes.webp', 'assets/images/feature-catalogs-programs.webp'],
    sales: ['assets/images/feature-sales.webp', 'assets/images/feature-sales-quiz.webp', 'assets/images/feature-sales-builder.webp'],
    booking: ['assets/images/feature-booking.webp', 'assets/images/feature-booking-status.webp', 'assets/images/feature-booking-repeat.webp'],
    calendar: ['assets/images/feature-calendar.webp', 'assets/images/feature-calendar-conflict.webp', 'assets/images/feature-calendar-logistics.webp'],
    management: ['assets/images/feature-management.webp', 'assets/images/feature-management-content.webp', 'assets/images/feature-management-leads.webp'],
    trust: ['assets/images/feature-trust.webp', 'assets/images/feature-trust-people.webp', 'assets/images/feature-trust-docs.webp'],
    marketing: ['assets/images/feature-marketing.webp', 'assets/images/feature-marketing-analytics.webp', 'assets/images/feature-marketing-content.webp'],
    integrations: ['assets/images/feature-integrations.webp', 'assets/images/feature-integrations-social.webp', 'assets/images/feature-integrations-calendar.webp'],
    growth: ['assets/images/feature-growth.webp', 'assets/images/feature-growth-content.webp', 'assets/images/feature-growth-performance.webp'],
  };
  const categoryModuleIndex = new Map();
  data.categories.forEach((category) => {
    data.modules.filter((module) => module.category === category.id)
      .forEach((module, index) => categoryModuleIndex.set(module.id, index));
  });
  const moduleImageOverrides = new Map([
    ['event-map', categoryImages.presentation[1]], ['seasonal-skins', categoryImages.presentation[2]],
    ['costume-catalog', categoryImages.catalogs[1]], ['props-catalog', categoryImages.catalogs[1]],
    ['program-catalog', categoryImages.catalogs[2]], ['program-detail', categoryImages.catalogs[2]],
    ['party-quiz', categoryImages.sales[1]], ['program-builder', categoryImages.sales[2]], ['package-builder', categoryImages.sales[2]],
    ['booking-status', categoryImages.booking[1]], ['repeat-order', categoryImages.booking[2]],
    ['conflict-engine', categoryImages.calendar[1]], ['travel-buffer', categoryImages.calendar[2]],
    ['program-management', categoryImages.management[1]], ['content-rates', categoryImages.management[1]],
    ['lead-statuses', categoryImages.management[2]], ['crm', categoryImages.management[2]], ['manager-tasks', categoryImages.management[2]],
    ['team', categoryImages.trust[1]], ['artist-profiles', categoryImages.trust[1]], ['legal-docs', categoryImages.trust[2]], ['faq', categoryImages.trust[2]],
    ['analytics', categoryImages.marketing[1]], ['goals-events', categoryImages.marketing[1]], ['blog', categoryImages.marketing[2]], ['newsletter', categoryImages.marketing[2]],
    ['vk-integration', categoryImages.integrations[1]], ['max-integration', categoryImages.integrations[1]], ['cross-posting', categoryImages.integrations[1]],
    ['google-calendar', categoryImages.integrations[2]], ['outlook-calendar', categoryImages.integrations[2]],
    ['content-migration', categoryImages.growth[1]], ['photo-direction', categoryImages.growth[1]], ['performance-budget', categoryImages.growth[2]],
  ]);

  const safe = (value) => String(value ?? '').replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char]));
  const cleanText = (value, maxLength) => typeof value === 'string' ? value.slice(0, maxLength) : '';
  const sourceForClient = (value) => String(value ?? '')
    .replaceAll('Рекомендуется для event-агентства', 'Гордей советует для event-агентства')
    .replaceAll('+ рекомендация', '+ совет Гордея');
  const plural = (count, one, few, many) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };

  function createInitialState() {
    const priorities = {};
    defaultModules.forEach((id) => { priorities[id] = 'required'; });
    return {
      version: data.version,
      design: data.settings.defaultDesign,
      inspirations: [],
      techniques: [],
      modules: [...defaultModules],
      priorities,
      comments: {},
      client: { projectNote: '' },
      visited: [],
      calendarExplored: false,
      exported: false,
      savedAt: null,
    };
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return createInitialState();
      const restored = JSON.parse(raw);
      if (restored.version !== data.version) return createInitialState();
      const base = createInitialState();
      const restoredComments = Object.fromEntries(Object.entries(restored.comments || {})
        .filter(([id]) => byId.has(id))
        .map(([id, value]) => [id, cleanText(value, 800)]));
      const restoredPriorities = Object.fromEntries(Object.entries(restored.priorities || {})
        .filter(([id, value]) => byId.has(id) && Object.hasOwn(priorityLabels, value)));
      return {
        ...base,
        design: designById.has(restored.design) ? restored.design : base.design,
        inspirations: (restored.inspirations || []).filter((id) => inspirationById.has(id)),
        techniques: (restored.techniques || []).filter((id) => techniqueById.has(id)),
        modules: (restored.modules || []).filter((id) => byId.has(id)),
        priorities: { ...base.priorities, ...restoredPriorities },
        comments: restoredComments,
        client: { projectNote: cleanText(restored.client?.projectNote, 4000) },
        visited: Array.isArray(restored.visited) ? restored.visited.filter((value) => typeof value === 'string').slice(0, 12) : [],
        calendarExplored: restored.calendarExplored === true,
        exported: restored.exported === true,
        savedAt: typeof restored.savedAt === 'string' ? restored.savedAt : null,
      };
    } catch {
      return createInitialState();
    }
  }

  let state = restoreState();
  let filterState = { search: '', category: '', tier: '' };
  let lastDrawerTrigger = null;
  let saveStatusTimer = null;
  let revealObserver = null;
  let burstCleanupTimer = null;

  function updateSaveStatus(mode) {
    const status = document.querySelector('[data-save-status]');
    if (!status) return;
    const labels = {
      ready: ['Автосохранение включено', 'Автосохранение'],
      restored: ['Продолжили с прошлого места', 'Восстановлено'],
      saving: ['Сохраняю выбор…', 'Сохраняю…'],
      saved: ['Выбор сохранён в браузере', 'Сохранено'],
      error: ['Сохранение запрещено браузером', 'Не сохранено'],
    };
    const [longLabel, shortLabel] = labels[mode] || labels.ready;
    status.dataset.state = mode;
    status.querySelector('[data-save-status-long]').textContent = longLabel;
    status.querySelector('[data-save-status-short]').textContent = shortLabel;
  }

  function saveState(announce = false) {
    state.savedAt = new Date().toISOString();
    updateSaveStatus('saving');
    window.clearTimeout(saveStatusTimer);
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      saveStatusTimer = window.setTimeout(() => updateSaveStatus('saved'), 360);
      if (announce) toast(`${data.settings.clientAddress}, выбор сохранён на этом устройстве.`);
    } catch {
      updateSaveStatus('error');
      if (announce) toast('Браузер не разрешил локальное сохранение. Попробуйте обычный режим браузера.');
    }
  }

  function toast(message) {
    const region = document.querySelector('[data-toast-region]');
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;
    region.appendChild(element);
    window.setTimeout(() => element.remove(), 4200);
  }

  function designCostMarkup(design) {
    if (!pricing) return '';
    return `<p class="direction-cost">${safe(pricing.labels.design)}: ${pricing.format(pricing.design[design.id])}</p>`;
  }

  function techniqueCostMarkup(technique) {
    if (!pricing) return '';
    return `<span>${safe(pricing.labels.technique)}: ${pricing.format(technique.days * pricing.techniqueDayRate)}</span>`;
  }

  function moduleCost(module) {
    if (!pricing) return null;
    return pricing.moduleOverrides[module.id] || module.days * pricing.moduleDayRate;
  }

  function moduleCostMarkup(module) {
    if (!pricing) return '';
    return `<p class="module-cost">${safe(pricing.labels.module)}: ${pricing.format(moduleCost(module))}</p>`;
  }

  function moduleImage(module) {
    const themed = moduleImageOverrides.get(module.id);
    if (themed) return themed;
    const images = categoryImages[module.category] || categoryImages.presentation;
    return images[(categoryModuleIndex.get(module.id) || 0) % images.length];
  }

  function miniMarkup(design) {
    return `<div class="direction-mini" data-mini="${design.preview}" aria-label="Миниатюра направления «${safe(design.title)}»">
      <img src="assets/images/feature-presentation.webp" alt="" loading="lazy" decoding="async" width="1200" height="800"><span class="mini-nav"></span><span class="mini-title">${safe(design.title)}</span><span class="mini-visual"></span><span class="mini-card"></span>
    </div>`;
  }

  function renderDesigns() {
    const holder = document.querySelector('[data-design-list]');
    holder.innerHTML = data.designs.map((design) => `<article class="direction-card" data-design-card="${design.id}">
      ${miniMarkup(design)}
      <div>
        <div>
          <input class="direction-radio" type="radio" name="design-direction" value="${design.id}" id="design-${design.id}" aria-labelledby="design-title-${design.id}" ${state.design === design.id ? 'checked' : ''}>
          <span class="direction-eyebrow">${safe(design.eyebrow)}</span>
          <h3 class="direction-name" id="design-title-${design.id}"><label for="design-${design.id}">${safe(design.title)}</label></h3>
        </div>
        <p class="direction-source">${safe(design.source)}</p>
        ${design.recommended ? '<span class="recommended-badge">Рекомендуем</span>' : ''}
        ${designCostMarkup(design)}
      </div>
      <details class="direction-details">
        <summary>Настроение, сетка и ограничения</summary>
        <div class="palette-row" aria-label="Цветовая палитра">${design.palette.map((color) => `<span class="color-dot" style="background:${safe(color)}" title="${safe(color)}"></span>`).join('')}</div>
        <div class="direction-details-grid">
          <p><strong>Настроение</strong>${safe(design.mood)}</p>
          <p><strong>Типографика</strong>${safe(design.typography)}</p>
          <p><strong>Сетка</strong>${safe(design.grid)}</p>
          <p><strong>Фотографии</strong>${safe(design.photography)}</p>
          <p><strong>Меню</strong>${safe(design.menu)}</p>
          <p><strong>Карточки</strong>${safe(design.cards)}</p>
          <p><strong>Анимации</strong>${safe(design.motion)}</p>
          <p><strong>Кому подходит</strong>${safe(design.fit)}</p>
          <p><strong>Достоинства</strong>${design.advantages.map(safe).join(' · ')}</p>
          <p><strong>Ограничения</strong>${design.limits.map(safe).join(' · ')}</p>
        </div>
      </details>
    </article>`).join('');

    holder.querySelectorAll('input[name="design-direction"]').forEach((radio) => radio.addEventListener('change', () => {
      state.design = radio.value;
      state.visited = [...new Set([...state.visited, 'designs'])];
      saveState();
      renderDesignPreview();
      renderSummary();
      updateProgress();
    }));
    holder.querySelectorAll('[data-design-card]').forEach((card) => card.addEventListener('click', (event) => {
      if (event.target.closest('input, label, summary, details, a, button')) return;
      const radio = card.querySelector('input[name="design-direction"]');
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }));
    renderDesignPreview();
  }

  function renderDesignPreview() {
    const design = designById.get(state.design) || data.designs[0];
    const preview = document.querySelector('[data-live-preview]');
    preview.dataset.theme = design.preview;
    preview.innerHTML = `<img class="preview-image" src="assets/images/celebration-hero.webp" alt="" width="1800" height="1000"><div class="preview-topbar"><span class="preview-logo">Будущий праздник</span><span class="preview-menu"><span>Программы</span><span>Артисты</span><span>Дата</span></span></div>
      <div class="preview-stage">
        <p class="preview-kicker">${safe(design.eyebrow)}</p>
        <div class="preview-heading">${safe(data.settings.clientName)}, здесь начинается БУМ!</div>
        <span class="preview-button">Собрать свой праздник</span>
        <span class="preview-art" aria-hidden="true"></span>
      </div>
      <div class="preview-cards"><div class="preview-card"><strong>Истории</strong>Выбор по возрасту, поводу и настроению</div><div class="preview-card"><strong>Дата</strong>Честная проверка доступности</div></div>`;
    document.querySelector('[data-preview-description]').textContent = design.mood;
    document.querySelector('[data-preview-facts]').innerHTML = [
      ['Сетка', design.grid], ['Фотографии', design.photography], ['Меню', design.menu], ['Карточки', design.cards], ['Анимации', design.motion],
    ].map(([label, value]) => `<li><strong>${safe(label)}:</strong> ${safe(value)}</li>`).join('');
  }

  function renderTechniques() {
    const holder = document.querySelector('[data-technique-grid]');
    holder.innerHTML = data.techniques.map((technique) => `<label class="technique-card">
      <input type="checkbox" value="${technique.id}" ${state.techniques.includes(technique.id) ? 'checked' : ''}>
      <span><strong>${safe(technique.title)}</strong><p>${safe(technique.description)}</p><span class="technique-meta"><span>${complexityLabels[technique.complexity]}</span><span>${technique.days} ${plural(technique.days, 'день', 'дня', 'дней')}</span>${techniqueCostMarkup(technique)}</span></span>
    </label>`).join('');
    holder.querySelectorAll('input').forEach((checkbox) => checkbox.addEventListener('change', () => {
      state.techniques = checkbox.checked
        ? [...new Set([...state.techniques, checkbox.value])]
        : state.techniques.filter((id) => id !== checkbox.value);
      state.visited = [...new Set([...state.visited, 'techniques'])];
      saveState();
      renderSummary();
      updateProgress();
    }));
  }

  function resolveDependencies(id, result = new Set()) {
    const module = byId.get(id);
    if (!module) return result;
    module.dependencies.forEach((dependencyId) => {
      if (!result.has(dependencyId)) {
        result.add(dependencyId);
        resolveDependencies(dependencyId, result);
      }
    });
    return result;
  }

  function selectedDependents(id) {
    return state.modules.filter((moduleId) => resolveDependencies(moduleId).has(id));
  }

  function setModuleSelected(id, selected) {
    if (selected) {
      const dependencies = [...resolveDependencies(id)].filter((dependencyId) => !state.modules.includes(dependencyId));
      state.modules = [...new Set([...state.modules, ...dependencies, id])];
      [id, ...dependencies].forEach((moduleId) => {
        if (!state.priorities[moduleId]) state.priorities[moduleId] = moduleId === id ? 'desired' : 'required';
      });
      if (dependencies.length) toast(`Добавлены зависимости: ${dependencies.map((dependencyId) => byId.get(dependencyId)?.title).filter(Boolean).join(', ')}.`);
      return true;
    }
    const dependents = selectedDependents(id);
    if (dependents.length) {
      toast(`Сначала исключите: ${dependents.map((dependentId) => byId.get(dependentId)?.title).join(', ')}.`);
      return false;
    }
    state.modules = state.modules.filter((moduleId) => moduleId !== id);
    return true;
  }

  function demoClass(module) {
    const known = ['story','profiles','characters','team','lookbook','search','filters','timeline','route','workflow','calendar','calendar-admin','date','booking','event','gallery','media','video','shotlist','chart','funnel','gauge','dashboard','document','pages','articles','editor','case','detail','checklist'];
    return known.includes(module.demo) ? module.demo : ['document','chart','profiles','timeline'][module.title.length % 4];
  }

  function moduleMatches(module) {
    if (filterState.category && module.category !== filterState.category) return false;
    if (filterState.tier && module.tier !== filterState.tier) return false;
    if (!filterState.search) return true;
    const haystack = [module.title, module.summary, module.benefit, module.scenario, module.source, ...(module.tags || [])].join(' ').toLowerCase();
    return haystack.includes(filterState.search.toLowerCase());
  }

  function renderModules() {
    const filtered = data.modules.filter(moduleMatches);
    document.querySelector('[data-filter-count]').textContent = `${filtered.length} ${plural(filtered.length, 'модуль', 'модуля', 'модулей')}`;
    const holder = document.querySelector('[data-tier-board]');
    if (!filtered.length) {
      holder.innerHTML = '<div class="empty-state"><h3>Ничего не найдено</h3><p>Измените запрос или сбросьте фильтры.</p><button class="button button-secondary" type="button" data-reset-filters>Сбросить фильтры</button></div>';
      holder.querySelector('[data-reset-filters]').addEventListener('click', resetFilters);
      return;
    }
    holder.innerHTML = data.journeyChapters.map((chapter) => {
      const modules = chapter.moduleIds.map((id) => byId.get(id)).filter(Boolean).filter(moduleMatches);
      if (!modules.length && (filterState.search || filterState.category || filterState.tier)) return '';
      const isReference = chapter.id !== 'original';
      const media = isReference
        ? `<div class="reference-media"><figure class="reference-shot reference-shot-desktop"><img src="${safe(chapter.desktopImage)}" alt="Главная страница ${safe(chapter.host)} на компьютере" loading="lazy" decoding="async" width="1200" height="760"><figcaption>Материал исследования · desktop · ${safe(chapter.host)}</figcaption></figure><figure class="reference-shot reference-shot-mobile"><img src="${safe(chapter.mobileImage)}" alt="Главная страница ${safe(chapter.host)} на телефоне" loading="lazy" decoding="async" width="500" height="900"><figcaption>Материал исследования · mobile</figcaption></figure></div>`
        : `<figure class="original-burst"><img src="${safe(chapter.generatedImage)}" alt="Оригинальный образ системы управления праздничным агентством" loading="lazy" decoding="async" width="1200" height="800"><figcaption>Оригинальная иллюстрация · сгенерировано для предложения</figcaption></figure>`;
      const checkpointText = {
        vitlusova: 'Можно сделать паузу: я предусмотрел автосохранение. Вернёшься в этот же браузер — выбор останется, и его можно изменить.',
        lobacheva: 'Полпути позади, Юль. Всё отмеченное уже сохранено на этом устройстве — можно спокойно подумать и продолжить позже.',
        original: 'Все решения на месте, Юля. Открой «Юлин проект», чтобы вернуться к любому этапу и поменять выбор перед отправкой.',
      }[chapter.id];
      const checkpoint = checkpointText ? `<aside class="chapter-checkpoint"><strong>Передышка от Гордея</strong><span>${safe(checkpointText)}</span></aside>` : '';
      return `<article class="journey-chapter accent-${chapter.accent}" id="reference-${chapter.id}" data-progress-chapter="reference-${chapter.id}" aria-labelledby="journey-title-${chapter.id}">
        <header class="journey-head"><span class="journey-number" aria-hidden="true">${chapter.index}</span><div><p class="journey-source">${isReference ? `Гордей разбирает · ${safe(chapter.host)}` : 'Моя рекомендация'}</p><h2 id="journey-title-${chapter.id}">${safe(chapter.title)}</h2><p>${safe(chapter.subtitle)}</p></div>${isReference ? `<a class="button button-ink" href="https://${chapter.host}/" target="_blank" rel="noreferrer">Открыть оригинал ↗</a>` : ''}</header>
        ${media}
        <div class="reference-insights"><div><span>Позиционирование</span><p>${safe(chapter.position)}</p></div><div><span>Путь клиента</span><p>${safe(chapter.route)}</p></div><div><span>Доверие</span><p>${safe(chapter.trust)}</p></div></div>
        <section class="take-lab" aria-labelledby="take-${chapter.id}"><div class="take-intro"><p class="scribble">Твой ход, ${safe(data.settings.clientAddress)}!</p><h3 id="take-${chapter.id}">Что забираем отсюда?</h3><p>Отметь несколько принципов — я добавлю их в итоговое ТЗ.</p></div><div class="take-columns"><fieldset><legend>По дизайну</legend>${chapter.designChoices.map((choice) => inspirationChoiceMarkup(choice, 'design')).join('')}</fieldset><fieldset><legend>По подаче текста</legend>${chapter.voiceChoices.map((choice) => inspirationChoiceMarkup(choice, 'voice')).join('')}</fieldset></div></section>
        <div class="duplicate-note"><span>Без повтора</span><p>${safe(chapter.duplicateNote)}</p></div>
        ${checkpoint}
        <section class="chapter-functions" aria-labelledby="functions-${chapter.id}"><div class="chapter-functions-head"><div><p class="eyebrow">Что я предлагаю на этом шаге</p><h3 id="functions-${chapter.id}">${isReference ? 'Берём механику — не копируем оболочку' : 'Мои дополнительные идеи для роста'}</h3></div><span>${modules.length} ${plural(modules.length, 'идея', 'идеи', 'идей')}</span></div><div class="module-grid">${modules.map(moduleCard).join('')}</div></section>
      </article>`;
    }).join('');
    window.requestAnimationFrame(observeScrollElements);
  }

  function inspirationChoiceMarkup(choice, type) {
    const selected = state.inspirations.includes(choice.id);
    return `<label class="take-card ${selected ? 'is-selected' : ''}" data-choice-type="${type}"><input type="checkbox" data-inspiration-toggle="${choice.id}" ${selected ? 'checked' : ''}><span class="take-mark" aria-hidden="true">+</span><span><strong>${safe(choice.title)}</strong><small>${safe(choice.note)}</small></span></label>`;
  }

  function moduleCard(module) {
    const selected = state.modules.includes(module.id);
    const dependencyNames = module.dependencies.map((id) => byId.get(id)?.title).filter(Boolean);
    const priority = state.priorities[module.id] || 'desired';
    return `<article class="module-card ${selected ? 'is-selected' : ''}" data-module-card="${module.id}">
      <div class="module-card-top"><span class="module-category">${safe(categoryById.get(module.category)?.title)}</span><label class="module-toggle"><input type="checkbox" data-module-toggle="${module.id}" ${selected ? 'checked' : ''}><span>${selected ? 'В проекте' : 'Включить'}</span></label></div>
      <figure class="module-visual"><img src="${moduleImage(module)}" alt="Иллюстративный образ функции «${safe(module.title)}»" loading="lazy" decoding="async" width="1200" height="800"><span class="module-visual-wash" aria-hidden="true"></span><span class="module-demo demo-${demoClass(module)}" aria-hidden="true"></span><figcaption>${safe(module.title)}</figcaption></figure>
      <div class="module-content">
        <h3>${safe(module.title)}</h3><p class="module-summary">${safe(module.summary)}</p>
        <p class="benefit-line"><strong>Польза:</strong> ${safe(module.benefit)}</p>
        <div class="module-meta"><span class="chip">${complexityLabels[module.complexity]}</span><span class="chip">${module.days} ${plural(module.days, 'день', 'дня', 'дней')}</span>${dependencyNames.length ? `<span class="chip ${selected && dependencyNames.some((_, index) => !state.modules.includes(module.dependencies[index])) ? 'chip-danger' : ''}">Зависимости: ${safe(dependencyNames.join(', '))}</span>` : '<span class="chip">Без зависимостей</span>'}</div>
        <p class="module-source">Источник идеи: ${safe(sourceForClient(module.source))}</p>
        <div class="module-controls"><label class="field"><span>Приоритет</span><select data-module-priority="${module.id}">${Object.entries(priorityLabels).map(([value, label]) => `<option value="${value}" ${priority === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="button button-secondary" type="button" data-module-preview="${module.id}">Подробнее</button></div>
        <label class="module-comment field"><span>Комментарий клиента</span><textarea data-module-comment="${module.id}" maxlength="800" placeholder="Что важно учесть">${safe(state.comments[module.id] || '')}</textarea></label>
        ${moduleCostMarkup(module)}
      </div>
    </article>`;
  }

  function resetFilters() {
    filterState = { search: '', category: '', tier: '' };
    document.querySelector('[data-function-search]').value = '';
    document.querySelector('[data-category-filter]').value = '';
    document.querySelector('[data-tier-filter]').value = '';
    renderModules();
  }

  function attachModuleEvents() {
    const holder = document.querySelector('[data-tier-board]');
    holder.addEventListener('change', (event) => {
      const inspiration = event.target.closest('[data-inspiration-toggle]');
      if (inspiration) {
        state.inspirations = inspiration.checked
          ? [...new Set([...state.inspirations, inspiration.dataset.inspirationToggle])]
          : state.inspirations.filter((id) => id !== inspiration.dataset.inspirationToggle);
        inspiration.closest('.take-card')?.classList.toggle('is-selected', inspiration.checked);
        state.visited = [...new Set([...state.visited, inspirationById.get(inspiration.dataset.inspirationToggle)?.chapterId].filter(Boolean))];
        saveState();
        renderSummary();
        updateProgress();
        return;
      }
      const toggle = event.target.closest('[data-module-toggle]');
      if (toggle) {
        const accepted = setModuleSelected(toggle.dataset.moduleToggle, toggle.checked);
        state.visited = [...new Set([...state.visited, 'functions'])];
        if (!accepted) toggle.checked = true;
        saveState();
        renderModules();
        renderSummary();
        updateProgress();
        document.querySelector(`[data-module-toggle="${toggle.dataset.moduleToggle}"]`)?.focus();
        return;
      }
      const priority = event.target.closest('[data-module-priority]');
      if (priority) {
        state.priorities[priority.dataset.modulePriority] = priority.value;
        saveState();
        renderSummary();
      }
    });
    holder.addEventListener('input', (event) => {
      const comment = event.target.closest('[data-module-comment]');
      if (!comment) return;
      state.comments[comment.dataset.moduleComment] = comment.value;
      saveState();
    });
    holder.addEventListener('click', (event) => {
      const preview = event.target.closest('[data-module-preview]');
      if (preview) openModuleDialog(preview.dataset.modulePreview);
    });
  }

  function openModuleDialog(id) {
    const module = byId.get(id);
    if (!module) return;
    const dialog = document.querySelector('[data-feature-dialog]');
    dialog.querySelector('[data-feature-title]').textContent = module.title;
    const dependencies = module.dependencies.map((dependencyId) => byId.get(dependencyId)?.title).filter(Boolean);
    dialog.querySelector('[data-feature-body]').innerHTML = `<div class="dialog-grid">
      <div class="dialog-panel"><h3>Как это работает</h3><p>${safe(module.summary)}</p></div>
      <div class="dialog-panel"><h3>Польза</h3><p>${safe(module.benefit)}</p></div>
      <div class="dialog-panel"><h3>Сценарий</h3><p>${safe(module.scenario)}</p></div>
      <div class="dialog-panel"><h3>Источник идеи</h3><p>${safe(sourceForClient(module.source))}</p></div>
      <div class="dialog-panel"><h3>Сложность и срок</h3><p>${complexityLabels[module.complexity]}, ${module.days} ${plural(module.days, 'рабочий день', 'рабочих дня', 'рабочих дней')}.</p>${moduleCostMarkup(module)}</div>
      <div class="dialog-panel"><h3>Зависимости</h3><p>${dependencies.length ? safe(dependencies.join(', ')) : 'Можно реализовать независимо от других модулей.'}</p></div>
    </div>`;
    const action = dialog.querySelector('[data-dialog-module-action]');
    action.dataset.dialogModuleAction = id;
    action.textContent = state.modules.includes(id) ? 'Исключить из проекта' : 'Включить в проект';
    dialog.showModal();
  }

  function selectedModules() {
    return state.modules.map((id) => byId.get(id)).filter(Boolean);
  }

  function estimate() {
    const design = designById.get(state.design);
    const modules = selectedModules();
    const techniques = state.techniques.map((id) => techniqueById.get(id)).filter(Boolean);
    const days = modules.reduce((sum, module) => sum + module.days, 0) + techniques.reduce((sum, technique) => sum + technique.days, 0);
    const weeks = 3 + (design?.weeks || 2) + Math.ceil(days / 7);
    const result = { days, weeks, complexity: complexityScore(modules), oneTime: null, recurring: [] };
    if (pricing) {
      const modulesTotal = modules.reduce((sum, module) => sum + moduleCost(module), 0);
      const techniquesTotal = techniques.reduce((sum, technique) => sum + technique.days * pricing.techniqueDayRate, 0);
      const designTotal = pricing.design[state.design] || 0;
      result.oneTime = pricing.baseOneTime + designTotal + modulesTotal + techniquesTotal;
      result.breakdown = { base: pricing.baseOneTime, design: designTotal, modules: modulesTotal, techniques: techniquesTotal };
      result.recurring = [...pricing.baseRecurring, ...modules.map((module) => pricing.recurring[module.id]).filter(Boolean)];
      result.recurringTotal = result.recurring.reduce((sum, item) => sum + item.amount, 0);
    }
    return result;
  }

  function complexityScore(modules) {
    if (!modules.length) return 'Не определена';
    const scores = { low: 1, medium: 2, high: 3 };
    const average = modules.reduce((sum, module) => sum + scores[module.complexity], 0) / modules.length;
    if (average < 1.6) return 'Низкая';
    if (average < 2.35) return 'Средняя';
    return 'Высокая';
  }

  function renderSummary() {
    const design = designById.get(state.design);
    const modules = selectedModules();
    const techniques = state.techniques.map((id) => techniqueById.get(id)).filter(Boolean);
    const totals = estimate();
    const priorityCounts = Object.keys(priorityLabels).reduce((result, key) => {
      result[key] = modules.filter((module) => (state.priorities[module.id] || 'desired') === key).length;
      return result;
    }, {});
    const metrics = [
      [modules.length, plural(modules.length, 'модуль', 'модуля', 'модулей')],
      [state.inspirations.length, plural(state.inspirations.length, 'выбранный принцип', 'выбранных принципа', 'выбранных принципов')],
      [totals.complexity, 'общая сложность'],
      [`${totals.weeks}–${totals.weeks + 2}`, 'ориентир в неделях'],
    ];
    document.querySelector('[data-brief-design]').textContent = design?.title || 'Не выбрано';
    document.querySelector('[data-brief-inspirations]').innerHTML = state.inspirations.length
      ? state.inspirations.map((id) => inspirationById.get(id)).filter(Boolean).map((choice) => `<li><span>${safe(choice.title)}</span><small>${safe(choice.type)}</small></li>`).join('')
      : '<li><span>Принципы из разборов пока не выбраны</span></li>';
    document.querySelector('[data-brief-modules]').innerHTML = modules.length
      ? modules.map((module) => `<li><span>${safe(module.title)}</span><small>${priorityLabels[state.priorities[module.id] || 'desired']}</small></li>`).join('')
      : '<li><span>Функции пока не выбраны</span></li>';
    document.querySelector('[data-summary-metrics]').innerHTML = metrics.map(([value, label]) => `<div class="metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`).join('');
    document.querySelector('[data-priority-summary]').textContent = `${priorityCounts.required || 0} обязательно · ${priorityCounts.desired || 0} желательно · ${priorityCounts.later || 0} позже`;
    renderCostSummary(totals);
    renderDrawer(design, modules, techniques, totals);
    document.querySelector('[data-mobile-summary-count]').textContent = modules.length;
  }

  function renderCostSummary(totals) {
    const holder = document.querySelector('[data-cost-summary]');
    if (!holder) return;
    if (!pricing) {
      holder.innerHTML = `<div class="cost-breakdown"><div class="cost-line"><span>Состав проекта</span><strong>${selectedModules().length} ${plural(selectedModules().length, 'модуль', 'модуля', 'модулей')}</strong></div><div class="cost-line"><span>Ориентировочный срок</span><strong>${totals.weeks}–${totals.weeks + 2} недель</strong></div><div class="cost-line"><span>Сложность</span><strong>${totals.complexity}</strong></div></div>`;
      return;
    }
    const recurringRows = totals.recurring.map((item) => `<div class="cost-line"><span>${safe(item.label)}<small> · ${safe(item.note)}</small></span><strong>${pricing.formatMonthly(item.amount)}</strong></div>`).join('');
    holder.innerHTML = `<div class="cost-breakdown">
      <div class="cost-line"><span>${safe(pricing.labels.base)}<small> · ${safe(pricing.labels.baseNote)}</small></span><strong>${pricing.format(totals.breakdown.base)}</strong></div>
      <div class="cost-line"><span>${safe(pricing.labels.design)}</span><strong>${pricing.format(totals.breakdown.design)}</strong></div>
      <div class="cost-line"><span>Выбранные функции</span><strong>${pricing.format(totals.breakdown.modules)}</strong></div>
      <div class="cost-line"><span>Визуальные приёмы</span><strong>${pricing.format(totals.breakdown.techniques)}</strong></div>
      <div class="cost-line cost-total"><span>${safe(pricing.labels.oneTime)}</span><strong>${pricing.format(totals.oneTime)}</strong></div>
      <p class="eyebrow">${safe(pricing.labels.recurring)}</p>${recurringRows}
      <div class="cost-line"><span>Суммарный ориентир в месяц</span><strong>${pricing.formatMonthly(totals.recurringTotal)}</strong></div>
    </div><p class="estimate-note">${safe(pricing.labels.preliminary)} ${safe(pricing.labels.dayRate)}</p>`;
  }

  function renderDrawer(design, modules, techniques, totals) {
    const holder = document.querySelector('[data-drawer-content]');
    const costLine = pricing ? `<p><strong>${safe(pricing.labels.total)}:</strong> ${pricing.format(totals.oneTime)}<br><small>${safe(pricing.labels.preliminary)}</small></p>` : '';
    holder.innerHTML = `<p><strong>Направление:</strong> ${safe(design?.title || 'не выбрано')}</p>
      <p><strong>Состав:</strong> ${modules.length} ${plural(modules.length, 'модуль', 'модуля', 'модулей')}, ${state.inspirations.length} ${plural(state.inspirations.length, 'принцип', 'принципа', 'принципов')}</p>
      <p><strong>Срок:</strong> ${totals.weeks}–${totals.weeks + 2} недель · сложность ${totals.complexity.toLowerCase()}</p>
      ${costLine}<ul class="drawer-list">${modules.slice(0, 7).map((module) => `<li>${safe(module.title)}</li>`).join('')}${modules.length > 7 ? `<li>И ещё ${modules.length - 7}</li>` : ''}</ul>`;
  }

  function buildBriefObject() {
    const design = designById.get(state.design);
    const modules = selectedModules();
    const totals = estimate();
    const result = {
      document: data.settings.title,
      generatedAt: new Date().toLocaleString('ru-RU'),
      client: { name: data.settings.clientName, ...state.client },
      referenceChoices: state.inspirations.map((id) => inspirationById.get(id)).filter(Boolean).map((choice) => ({
        site: data.journeyChapters.find((chapter) => chapter.id === choice.chapterId)?.host,
        type: choice.type, title: choice.title, note: choice.note,
      })),
      design: design ? { id: design.id, title: design.title, mood: design.mood, source: design.source } : null,
      visualTechniques: state.techniques.map((id) => techniqueById.get(id)).filter(Boolean).map((technique) => ({ title: technique.title, complexity: complexityLabels[technique.complexity], days: technique.days })),
      modules: modules.map((module) => ({
        id: module.id, group: categoryById.get(module.category)?.title, stage: tierById.get(module.tier)?.title,
        title: module.title, summary: module.summary, benefit: module.benefit, scenario: module.scenario,
        source: sourceForClient(module.source), complexity: complexityLabels[module.complexity], days: module.days,
        dependencies: module.dependencies.map((id) => byId.get(id)?.title).filter(Boolean),
        priority: priorityLabels[state.priorities[module.id] || 'desired'], comment: state.comments[module.id] || '',
      })),
      timeline: `${totals.weeks}–${totals.weeks + 2} недель`,
      complexity: totals.complexity,
      calendarPrototypeReviewed: state.calendarExplored,
      note: 'Финальный состав и технические детали фиксируются после согласования.',
    };
    if (pricing) {
      result.estimate = {
        oneTime: totals.oneTime,
        recurringMonthly: totals.recurringTotal,
        breakdown: totals.breakdown,
        recurringItems: totals.recurring,
        disclaimer: pricing.labels.preliminary,
      };
    }
    return result;
  }

  function buildBriefText() {
    const brief = buildBriefObject();
    const lines = [
      brief.document.toUpperCase(),
      `Сформировано: ${brief.generatedAt}`,
      `Клиент: ${brief.client.name}`,
      '',
      `Комментарий к проекту: ${brief.client.projectNote || 'нет'}`,
      '',
      `ДИЗАЙН-НАПРАВЛЕНИЕ: ${brief.design?.title || 'не выбрано'}`,
      brief.design?.mood || '',
      '',
      'ЧТО БЕРЁМ ИЗ РАЗБОРА РЕФЕРЕНСОВ:',
      ...(brief.referenceChoices.length ? brief.referenceChoices.map((item) => `- ${item.site} · ${item.type}: ${item.title}`) : ['- пока ничего не выбрано']),
      '',
      'ВИЗУАЛЬНЫЕ ПРИЁМЫ:',
      ...(brief.visualTechniques.length ? brief.visualTechniques.map((item) => `- ${item.title} · ${item.complexity} · ${item.days} дн.`) : ['- не выбраны']),
      '',
      'ФУНКЦИОНАЛЬНЫЕ МОДУЛИ:',
      ...brief.modules.flatMap((module, index) => [
        `${index + 1}. ${module.title} [${module.priority}]`,
        `   Группа: ${module.group} · Этап: ${module.stage} · Сложность: ${module.complexity} · Срок: ${module.days} дн.`,
        `   Польза: ${module.benefit}`,
        `   Сценарий: ${module.scenario}`,
        `   Источник: ${sourceForClient(module.source)}`,
        `   Зависимости: ${module.dependencies.join(', ') || 'нет'}`,
        `   Комментарий: ${module.comment || 'нет'}`,
      ]),
      '',
      `ОБЩАЯ СЛОЖНОСТЬ: ${brief.complexity}`,
      `ОРИЕНТИРОВОЧНЫЙ СРОК: ${brief.timeline}`,
      `ПРОТОТИП КАЛЕНДАРЯ ПРОСМОТРЕН: ${brief.calendarPrototypeReviewed ? 'да' : 'нет'}`,
    ];
    if (pricing && brief.estimate) {
      lines.push('', pricing.labels.oneTime.toUpperCase(), pricing.format(brief.estimate.oneTime));
      lines.push(pricing.labels.recurring.toUpperCase(), pricing.formatMonthly(brief.estimate.recurringMonthly));
      lines.push(pricing.labels.preliminary);
    }
    return lines.filter((line) => line !== undefined).join('\n');
  }

  async function prepareProjectSubmission(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const commentField = form.querySelector('[data-client-field="projectNote"]');
    state.client.projectNote = cleanText(commentField.value, 4000);
    form.querySelector('[data-brief-payload]').value = buildBriefText();
    state.exported = true;
    saveState();
    updateProgress();
    const submitButton = form.querySelector('[data-submit-project]');
    const submissionStatus = form.querySelector('[data-submission-status]');
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Отправляем…';
    submissionStatus.textContent = '';

    if (window.location.protocol === 'file:') {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      submissionStatus.textContent = 'Отправка работает в опубликованной версии сайта.';
      return;
    }

    try {
      const payload = new FormData(form);
      payload.set('_url', window.location.href);
      const response = await fetch(form.dataset.endpoint, {
        method: 'POST',
        body: payload,
        headers: { Accept: 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false || result.success === 'false') {
        throw new Error('Form service rejected the submission');
      }
      submitButton.textContent = 'Отправлено!';
      submissionStatus.textContent = `${data.settings.clientName}, готово — выбор отправлен.`;
      toast(`${data.settings.clientAddress}, выбор и комментарий отправлены.`);
      window.setTimeout(() => {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }, 6000);
    } catch {
      submitButton.disabled = false;
      submitButton.textContent = 'Попробовать ещё раз';
      submissionStatus.textContent = 'Не получилось отправить. Проверьте интернет и нажмите ещё раз.';
      toast('Сервис отправки не ответил. Выбор сохранён в этом браузере.');
    }
  }

  function openDrawer(trigger) {
    lastDrawerTrigger = trigger;
    const drawer = document.querySelector('[data-summary-drawer]');
    drawer.removeAttribute('inert');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-drawer-close]').focus();
  }

  function closeDrawer(restoreFocus = true) {
    const drawer = document.querySelector('[data-summary-drawer]');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    if (restoreFocus) lastDrawerTrigger?.focus();
  }

  function updateProgress() {
    const milestones = [
      data.journeyChapters.filter((chapter) => chapter.id !== 'original').every((chapter) => state.visited.includes(`reference-${chapter.id}`) || state.visited.includes(chapter.id)),
      state.inspirations.length > 0,
      Boolean(state.design),
      state.techniques.length > 0,
      state.modules.length >= 3,
      state.calendarExplored,
      Boolean(state.client.projectNote),
      state.exported,
    ];
    const percent = Math.round((milestones.filter(Boolean).length / milestones.length) * 100);
    document.querySelector('[data-progress-value]').style.width = `${percent}%`;
    document.querySelector('[data-progress-value]').parentElement.setAttribute('aria-valuenow', String(percent));
    document.querySelector('[data-progress-percent]').textContent = `${percent}%`;
  }

  function populateFilters() {
    const categorySelect = document.querySelector('[data-category-filter]');
    categorySelect.innerHTML = '<option value="">Все группы</option>' + data.categories.map((category) => `<option value="${category.id}">${safe(category.title)}</option>`).join('');
    const tierSelect = document.querySelector('[data-tier-filter]');
    tierSelect.innerHTML = '<option value="">Все этапы</option>' + data.tiers.map((tier) => `<option value="${tier.id}">${safe(tier.title)}</option>`).join('');
    document.querySelector('[data-function-search]').addEventListener('input', (event) => { filterState.search = event.target.value.trim(); });
    categorySelect.addEventListener('change', () => { filterState.category = categorySelect.value; });
    tierSelect.addEventListener('change', () => { filterState.tier = tierSelect.value; });
    document.querySelector('[data-function-finder-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      renderModules();
      const firstResult = document.querySelector('.journey-chapter:not(:empty) .module-card');
      if (firstResult) {
        firstResult.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        const heading = firstResult.querySelector('h3');
        heading?.setAttribute('tabindex', '-1');
        window.setTimeout(() => heading?.focus({ preventScroll: true }), 450);
        toast(`${data.settings.clientAddress}, подходящие функции показаны в пяти шагах выше.`);
      } else {
        toast('По этим условиям ничего не найдено.');
      }
    });
  }

  function attachGlobalEvents() {
    document.querySelectorAll('[data-project-form]').forEach((form) => form.addEventListener('submit', prepareProjectSubmission));
    document.querySelectorAll('[data-reset-filters]').forEach((button) => button.addEventListener('click', resetFilters));
    document.querySelectorAll('[data-open-summary]').forEach((button) => button.addEventListener('click', () => openDrawer(button)));
    document.querySelectorAll('[data-drawer-close]').forEach((button) => button.addEventListener('click', (event) => {
      closeDrawer(event.currentTarget.tagName !== 'A');
    }));
    document.querySelectorAll('[data-clear]').forEach((button) => button.addEventListener('click', () => {
      if (!window.confirm('Очистить выбранное направление, функции, приоритеты и комментарии?')) return;
      localStorage.removeItem(storageKey);
      state = createInitialState();
      renderAll();
      toast('Выбор очищен. Возвращён стартовый набор.');
    }));

    const featureDialog = document.querySelector('[data-feature-dialog]');
    featureDialog.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => featureDialog.close()));
    featureDialog.querySelector('[data-dialog-module-action]').addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.dialogModuleAction;
      const selected = state.modules.includes(id);
      if (setModuleSelected(id, !selected)) {
        saveState();
        renderModules();
        renderSummary();
        featureDialog.close();
      }
    });
    [featureDialog, document.querySelector('[data-event-dialog]')].forEach((dialog) => dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    }));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.querySelector('[data-summary-drawer]').classList.contains('is-open')) closeDrawer();
    });

    document.querySelectorAll('[data-client-field]').forEach((field) => {
      field.value = state.client[field.dataset.clientField] || '';
      field.addEventListener('input', () => {
        state.client[field.dataset.clientField] = field.value;
        saveState();
        updateProgress();
      });
    });
  }

  function observeChapters() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        const id = entry.target.dataset.progressChapter;
        if (!state.visited.includes(id)) {
          state.visited.push(id);
          saveState();
          updateProgress();
        }
      });
    }, { threshold: 0.05 });
    document.querySelectorAll('[data-progress-chapter]').forEach((section) => observer.observe(section));
  }

  function burstConfetti() {
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let layer = document.querySelector('.scroll-confetti-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'scroll-confetti-layer';
      layer.setAttribute('aria-hidden', 'true');
      const colors = ['#ff4538', '#ffd60a', '#20c7c7', '#1645d8', '#ff4fa3'];
      layer.innerHTML = Array.from({ length: 16 }, (_, index) => {
        const edge = index % 2 === 0;
        const x = edge ? 1 + ((index * 3) % 8) : 91 + ((index * 5) % 8);
        const color = colors[index % colors.length];
        return `<i style="--burst-x:${x}%;--burst-delay:${(index % 6) * 65}ms;--burst-spin:${240 + (index * 31)}deg;--burst-color:${color}"></i>`;
      }).join('');
      document.body.appendChild(layer);
    }
    window.clearTimeout(burstCleanupTimer);
    layer.classList.remove('is-bursting');
    void layer.offsetWidth;
    layer.classList.add('is-bursting');
    burstCleanupTimer = window.setTimeout(() => layer.classList.remove('is-bursting'), 1900);
  }

  function observeScrollElements() {
    if (!revealObserver) return;
    const selector = [
      '.journey-head', '.reference-shot', '.original-burst',
      '.reference-insights > div', '.take-lab', '.chapter-checkpoint', '.module-card',
      '.direction-card', '.live-preview-panel', '.technique-card', '.calendar-hero-image',
      '.calendar-shell', '.integration-ribbon', '.brief-panel', '.cost-panel', '.project-submit-form',
    ].join(',');
    document.querySelectorAll(`${selector}:not([data-reveal-ready])`).forEach((element, index) => {
      element.dataset.revealReady = 'true';
      element.classList.add('scroll-reveal');
      element.style.setProperty('--reveal-delay', `${(index % 5) * 55}ms`);
      revealObserver.observe(element);
    });
    document.querySelectorAll('.journey-chapter:not([data-celebration-ready])').forEach((element) => {
      element.dataset.celebrationReady = 'true';
      revealObserver.observe(element);
    });
  }

  function initScrollStory() {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.body.classList.add('motion-ready');
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        if (entry.target.matches('.journey-chapter, .calendar-shell, .cost-panel') && !entry.target.dataset.celebrated) {
          entry.target.dataset.celebrated = 'true';
          burstConfetti();
        }
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.02, rootMargin: '0px 0px -7% 0px' });
    observeScrollElements();
    window.setTimeout(burstConfetti, 16000);
    window.setInterval(burstConfetti, 45000);
  }

  function initAmbientMotion() {
    const hero = document.querySelector('.boom-hero');
    if (!hero || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = null;
    hero.addEventListener('pointermove', (event) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = hero.getBoundingClientRect();
        hero.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
        hero.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
      });
    }, { passive: true });
  }

  function renderAll() {
    renderDesigns();
    renderTechniques();
    renderModules();
    renderSummary();
    document.querySelectorAll('[data-client-field]').forEach((field) => { field.value = state.client[field.dataset.clientField] || ''; });
    updateProgress();
  }

  function init() {
    document.querySelector('a[href="#reference-original"]')?.setAttribute('aria-label', 'Рекомендации Гордея');
    renderDesigns();
    renderTechniques();
    populateFilters();
    renderModules();
    attachModuleEvents();
    attachGlobalEvents();
    renderSummary();
    updateSaveStatus(state.savedAt ? 'restored' : 'ready');
    observeChapters();
    initScrollStory();
    initAmbientMotion();
    window.CalendarDemo.init({
      root: document.querySelector('[data-calendar-root]'),
      dialog: document.querySelector('[data-event-dialog]'),
      data: data.calendar,
      onExplore() {
        if (!state.calendarExplored) {
          state.calendarExplored = true;
          state.visited = [...new Set([...state.visited, 'calendar'])];
          saveState();
          updateProgress();
        }
      },
    });
    updateProgress();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
