const STORAGE_KEY =
  'buildmind-procurement-data-v2-clean';

const MATERIAL_ARCHIVE_STORAGE_KEY =
  'buildmind-material-archive-v1';

const MATERIAL_HISTORY_STORAGE_KEY =
  'buildmind-material-history-v1';

const MATERIAL_HISTORY_LIMIT = 1000;

let materials =
  loadMaterials().map(
    function (material) {
      return normalizeMaterialRecord(
        material,
        'active'
      );
    }
  );

let archivedMaterials =
  loadStoredArray(
    MATERIAL_ARCHIVE_STORAGE_KEY,
    'архив материалов'
  ).map(
    function (material) {
      return normalizeMaterialRecord(
        material,
        'archived'
      );
    }
  );

let materialHistory =
  loadStoredArray(
    MATERIAL_HISTORY_STORAGE_KEY,
    'историю материалов'
  );

let editingMaterialId = '';


function createMaterialRecordId(
  prefix = 'material'
) {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return (
      `${prefix}-` +
      window.crypto.randomUUID()
    );
  }

  return (
    `${prefix}-` +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  );
}


function cloneMaterialValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value)
  );
}


function normalizeMaterialRecord(
  material,
  status
) {
  const now =
    new Date().toISOString();

  const source =
    material &&
    typeof material === 'object'
      ? material
      : {};

  return {
    ...source,

    id:
      source.id ||
      createMaterialRecordId(),

    status:
      status === 'archived'
        ? 'archived'
        : 'active',

    revision:
      Math.max(
        Number(source.revision) || 1,
        1
      ),

    createdAt:
      source.createdAt ||
      now,

    updatedAt:
      source.updatedAt ||
      now
  };
}


function loadStoredArray(
  storageKey,
  label
) {
  const saved =
    localStorage.getItem(
      storageKey
    );

  if (!saved) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(saved);

    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn(
      `Не удалось прочитать ${label}:`,
      error
    );
  }

  return [];
}

function loadMaterials() {
  const saved =
    localStorage.getItem(
      STORAGE_KEY
    );

  if (!saved) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(saved);

    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn(
      'Не удалось прочитать сохранённые данные BuildMind:',
      error
    );
  }

  return [];
}
function saveMaterials() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(materials)
  );

  localStorage.setItem(
    MATERIAL_ARCHIVE_STORAGE_KEY,
    JSON.stringify(
      archivedMaterials
    )
  );

  localStorage.setItem(
    MATERIAL_HISTORY_STORAGE_KEY,
    JSON.stringify(
      materialHistory
    )
  );
}


function recordMaterialHistory(
  action,
  before,
  after,
  reason
) {
  const material =
    after ||
    before ||
    {};

  materialHistory.push({
    id:
      createMaterialRecordId(
        'material-event'
      ),

    materialId:
      material.id ||
      '',

    materialName:
      material.name ||
      'Без названия',

    action:
      action ||
      'updated',

    occurredAt:
      new Date().toISOString(),

    actorRole:
      'engineer',

    reason:
      String(reason || '').trim(),

    before:
      cloneMaterialValue(before),

    after:
      cloneMaterialValue(after)
  });

  if (
    materialHistory.length >
    MATERIAL_HISTORY_LIMIT
  ) {
    materialHistory =
      materialHistory.slice(
        -MATERIAL_HISTORY_LIMIT
      );
  }
}


function notifyMaterialsChanged(
  action,
  materialIds
) {
  window.dispatchEvent(
    new CustomEvent(
      'buildmind:materials-changed',
      {
        detail: {
          action:
            action ||
            'updated',

          materialIds:
            Array.isArray(
              materialIds
            )
              ? [...materialIds]
              : [],

          activeCount:
            materials.length,

          archivedCount:
            archivedMaterials.length
        }
      }
    )
  );
}


/*
  Миграция прежних строк материалов:
  добавляем постоянные ID и метаданные,
  не создавая ложных событий истории.
*/

saveMaterials();

function parseDate(value) {
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) {
    return '—';
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function riskFor(row, needDate, today) {
  const stock =
    Number(row.stock) || 0;

  const reserved =
    Number(row.reserved) || 0;

  const confirmed =
    Number(row.confirmed) || 0;

  const need =
    Number(row.need) || 0;

  const leadDays =
    Number(row.leadDays) || 0;

  const free =
    Math.max(stock - reserved, 0);

  const available =
    free + confirmed;

  const deficit =
    Math.max(need - available, 0);

  const orderDeadline =
    needDate
      ? addDays(
          needDate,
          -leadDays
        )
      : null;

  const delivery =
    parseDate(row.deliveryDate);

  if (!needDate) {
    return {
      level: 'critical',
      text: 'Критический',
      action:
        'Для материала не найден контекст работы. ' +
        'Проверьте проект, объект, название работы ' +
        'и дату начала по ГПР.'
    };
  }

  if (deficit > 0) {
    return {
      level: 'critical',
      text: 'Критический',
      action:
        `Рекомендуется проверить дополнительную потребность: ` +
        `${deficit} ${row.unit}. ` +
        `Расчётная крайняя дата заказа: ` +
        `${formatDate(orderDeadline)}.`
    };
  }

  if (
    delivery &&
    delivery > needDate
  ) {
    return {
      level: 'critical',
      text: 'Критический',
      action:
        'Поставка позже даты потребности. ' +
        'Рекомендуется рассмотреть ускорение поставки ' +
        'или резервный источник.'
    };
  }

  if (
    orderDeadline &&
    today > orderDeadline &&
    confirmed === 0
  ) {
    return {
      level: 'warning',
      text: 'Предупреждение',
      action:
        'Крайняя дата заказа уже прошла. ' +
        'Проверьте наличие резерва или ' +
        'альтернативного поставщика.'
    };
  }

  return {
    level: 'ok',
    text: 'ОК',
    action:
      'Материал обеспечен при условии ' +
      'подтверждения статуса поставки.'
  };
}
let activeControlFilter = 'all';

const CONTROL_STATUS_LABELS = {
  critical: 'Критический риск',
  order: 'Нужно заказать',
  'low-stock': 'Заканчивается',
  expected: 'Ожидаемая поставка',
  delayed: 'Поставка задерживается',
  ok: 'Обеспечено'
};

function normalizeControlValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

const CONTROL_WORK_CONTEXTS_STORAGE_KEY =
  'buildmindWorkContexts-v2-clean';

function getSavedWorkContextsForControl() {
  const savedContexts =
    localStorage.getItem(
      CONTROL_WORK_CONTEXTS_STORAGE_KEY
    );

  if (!savedContexts) {
    return [];
  }

  try {
    const parsedContexts =
      JSON.parse(savedContexts);

    return Array.isArray(
      parsedContexts
    )
      ? parsedContexts
      : [];
  } catch (error) {
    console.warn(
      'Не удалось прочитать контексты работ:',
      error
    );

    return [];
  }
}

function getMaterialScheduleForControl(row) {
  const contexts =
    getSavedWorkContextsForControl();

  const materialProject =
    normalizeControlValue(row.project);

  const materialObject =
    normalizeControlValue(row.object);

  const materialWork =
    normalizeControlValue(row.work);

  const matchedContext =
    contexts.find(function (context) {
      return (
        normalizeControlValue(context.project) ===
          materialProject &&
        normalizeControlValue(context.object) ===
          materialObject &&
        normalizeControlValue(context.work) ===
          materialWork
      );
    });

 const startDateValue =
  matchedContext &&
  matchedContext.startDate
    ? matchedContext.startDate
    : '';

const safetyDays =
  matchedContext
    ? Number(
        matchedContext.safetyDays || 0
      )
    : 0;

  const startDate =
    parseDate(startDateValue);

  const needDate =
    startDate
      ? addDays(startDate, -safetyDays)
      : null;

  return {
    startDate,
    safetyDays,
    needDate
  };
}

function getControlPrimaryStatus(categories) {
  const priority = [
    'delayed',
    'critical',
    'order',
    'low-stock',
    'expected',
    'ok'
  ];

  return (
    priority.find(function (status) {
      return categories.includes(status);
    }) || 'ok'
  );
}

function buildControlEvent(row, index, today) {
  const need =
    Number(row.need) || 0;

  const stock =
    Number(row.stock) || 0;

  const reserved =
    Number(row.reserved) || 0;

  const confirmed =
    Number(row.confirmed) || 0;

  const leadDays =
    Number(row.leadDays) || 0;

  const free =
    Math.max(stock - reserved, 0);

  const available =
    free + confirmed;

  const deficit =
    Math.max(need - available, 0);

  const schedule =
    getMaterialScheduleForControl(row);

  const needDate =
    schedule.needDate;

  const orderDeadline =
    needDate
      ? addDays(needDate, -leadDays)
      : null;

  const deliveryDate =
    parseDate(row.deliveryDate);

  const deliveryAfterNeed =
    Boolean(
      deliveryDate &&
      needDate &&
      deliveryDate > needDate
    );

  const categories = [];

  if (
    !needDate ||
    deficit > 0 ||
    deliveryAfterNeed
  ) {
    categories.push('critical');
  }

  if (deficit > 0) {
    categories.push('order');
  }

  if (free < need) {
    categories.push('low-stock');
  }

  if (
    confirmed > 0 &&
    deliveryDate &&
    deliveryDate >= today
  ) {
    categories.push('expected');
  }

  if (
    confirmed > 0 &&
    deliveryDate &&
    deliveryDate < today &&
    free < need
  ) {
    categories.push('delayed');
  }

  if (free >= need) {
    categories.push('ok');
  }

  const primary =
    getControlPrimaryStatus(categories);

  let reason = '';
  let recommendation = '';

  if (primary === 'delayed') {
    reason =
      'Ожидаемая дата поставки уже прошла, а свободного остатка недостаточно.';

    recommendation =
      'Рекомендуется уточнить фактический статус у поставщика и подтвердить новую дату доставки.';
  } else if (primary === 'critical') {
    if (!needDate) {
      reason =
        'Для материала не найдена подтверждённая дата потребности.';

      recommendation =
        'Рекомендуется проверить привязку материала к контексту работы и графику.';
    } else if (deliveryAfterNeed) {
      reason =
        'Поставка запланирована позже даты потребности материала.';

      recommendation =
        'Рекомендуется рассмотреть ускорение поставки, резервный источник или допустимый аналог.';
    } else {
      reason =
        `После учёта склада и подтверждённых поставок не хватает ${deficit} ${row.unit || ''}.`;

      recommendation =
        'Рекомендуется безотлагательно проверить закупку и дополнительную потребность.';
    }
  } else if (primary === 'order') {
    reason =
      `Предварительный расчёт показывает дефицит ${deficit} ${row.unit || ''}.`;

    recommendation =
      'Рекомендуется подготовить заявку до расчётной крайней даты заказа.';
  } else if (primary === 'low-stock') {
    reason =
      'Свободный складской остаток меньше потребности работы.';

    recommendation =
      'Рекомендуется проверить подтверждённые поставки и доступные складские резервы.';
  } else if (primary === 'expected') {
    reason =
      'Поставка подтверждена поставщиком и ожидается.';

    recommendation =
      'Рекомендуется контролировать дату отгрузки и фактическое поступление.';
  } else {
    reason =
      'Свободного складского остатка достаточно для текущей потребности.';

    recommendation =
      'Рекомендуется поддерживать актуальность складских данных.';
  }

  return {
    index,
    project: row.project || 'Без проекта',
    object: row.object || 'Без объекта',
    work: row.work || 'Без работы',
    name: row.name || 'Без названия',
    responsible:
      row.responsible || 'Не назначен',
    unit: row.unit || '',
    need,
    stock,
    reserved,
    free,
    confirmed,
    available,
    deficit,
    leadDays,
    needDate,
    orderDeadline,
    deliveryDate,
    categories,
    primary,
    reason,
    recommendation
  };
}

function escapeControlHtml(value) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(value ?? '').replace(
    /[&<>"']/g,
    function (symbol) {
      return symbols[symbol];
    }
  );
}

function formatControlNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString('ru-RU')
    : '0';
}

function formatControlDate(date) {
  if (!date) {
    return '—';
  }

  return date.toLocaleDateString('ru-RU');
}

function setControlCount(elementId, value) {
  const element =
    document.getElementById(elementId);

  if (element) {
    element.textContent = value;
  }
}

function fillControlSelect(
  selectElement,
  values,
  allLabel
) {
  if (!selectElement) {
    return;
  }

  const previousValue =
    selectElement.value || 'all';

  const sortedValues =
    [...values].sort(function (first, second) {
      return first.localeCompare(
        second,
        'ru'
      );
    });

  selectElement.innerHTML = '';

  const allOption =
    document.createElement('option');

  allOption.value = 'all';
  allOption.textContent = allLabel;

  selectElement.appendChild(allOption);

  sortedValues.forEach(function (value) {
    const option =
      document.createElement('option');

    option.value = value;
    option.textContent = value;

    selectElement.appendChild(option);
  });

  selectElement.value =
    sortedValues.includes(previousValue)
      ? previousValue
      : 'all';
}

function updateControlButtonsState() {
  const buttons =
    document.querySelectorAll(
      '[data-control-filter]'
    );

  buttons.forEach(function (button) {
    const selected =
      button.dataset.controlFilter ===
      activeControlFilter;

    button.classList.toggle(
      'active',
      selected
    );

    button.setAttribute(
      'aria-pressed',
      selected ? 'true' : 'false'
    );
  });
}

function renderOperationalControlCenter() {
  const eventsList =
    document.getElementById(
      'controlEventsList'
    );

  if (!eventsList) {
    return;
  }

  const todayInput =
    document.getElementById('todayDate');

  const today =
    parseDate(
      todayInput ? todayInput.value : ''
    ) || new Date();

  const events =
    materials.map(function (row, index) {
      return buildControlEvent(
        row,
        index,
        today
      );
    });

  const countByStatus =
    function (status) {
      return events.filter(function (event) {
        return event.categories.includes(status);
      }).length;
    };

  setControlCount(
    'criticalCount',
    countByStatus('critical')
  );

  setControlCount(
    'warningCount',
    countByStatus('order')
  );

  setControlCount(
    'lowStockCount',
    countByStatus('low-stock')
  );

  setControlCount(
    'expectedDeliveryCount',
    countByStatus('expected')
  );

  setControlCount(
    'delayedDeliveryCount',
    countByStatus('delayed')
  );

  setControlCount(
    'okCount',
    countByStatus('ok')
  );

  const analysisDate =
    document.getElementById(
      'controlAnalysisDate'
    );

  if (analysisDate) {
    analysisDate.textContent =
      formatControlDate(today);
  }

  const projectFilter =
    document.getElementById(
      'controlProjectFilter'
    );

  const objectFilter =
    document.getElementById(
      'controlObjectFilter'
    );

  const statusFilter =
    document.getElementById(
      'controlStatusFilter'
    );

  const projects =
    Array.from(
      new Set(
        events.map(function (event) {
          return event.project;
        })
      )
    );

  fillControlSelect(
    projectFilter,
    projects,
    'Все проекты'
  );

  const selectedProject =
    projectFilter
      ? projectFilter.value
      : 'all';

  const objects =
    Array.from(
      new Set(
        events
          .filter(function (event) {
            return (
              selectedProject === 'all' ||
              event.project ===
                selectedProject
            );
          })
          .map(function (event) {
            return event.object;
          })
      )
    );

  fillControlSelect(
    objectFilter,
    objects,
    'Все объекты'
  );

  const selectedObject =
    objectFilter
      ? objectFilter.value
      : 'all';

  if (statusFilter) {
    statusFilter.value =
      activeControlFilter;
  }

  const filteredEvents =
    events.filter(function (event) {
      const statusMatches =
        activeControlFilter === 'all' ||
        event.categories.includes(
          activeControlFilter
        );

      const projectMatches =
        selectedProject === 'all' ||
        event.project === selectedProject;

      const objectMatches =
        selectedObject === 'all' ||
        event.object === selectedObject;

      return (
        statusMatches &&
        projectMatches &&
        objectMatches
      );
    });

  const totalElement =
    document.getElementById(
      'controlEventsTotal'
    );

  if (totalElement) {
    totalElement.textContent =
      `Найдено событий: ${filteredEvents.length}`;
  }

  eventsList.innerHTML = '';

  if (filteredEvents.length === 0) {
    const emptyState =
      document.createElement('div');

    emptyState.className =
      'control-empty-state';

    emptyState.textContent =
      'По выбранным фильтрам событий не найдено.';

    eventsList.appendChild(emptyState);
    updateControlButtonsState();
    return;
  }

  filteredEvents.forEach(function (event) {
    const card =
      document.createElement('article');

    card.className =
      'control-event-card ' +
      `control-event-card-${event.primary}`;

    const categoryNames =
      event.categories
        .map(function (status) {
          return CONTROL_STATUS_LABELS[status];
        })
        .join(', ');

    card.innerHTML = `
      <h4>${escapeControlHtml(event.name)}</h4>

      <p>
        <strong>Основной статус:</strong>
        ${escapeControlHtml(
          CONTROL_STATUS_LABELS[event.primary]
        )}
      </p>

      <p>
        <strong>Категории контроля:</strong>
        ${escapeControlHtml(categoryNames)}
      </p>

      <p>
        <strong>Проект / объект / работа:</strong>
        ${escapeControlHtml(event.project)}
        /
        ${escapeControlHtml(event.object)}
        /
        ${escapeControlHtml(event.work)}
      </p>

      <p>
        <strong>Ответственный:</strong>
        ${escapeControlHtml(event.responsible)}
      </p>

      <p>
        <strong>Нужно:</strong>
        ${formatControlNumber(event.need)}
        ${escapeControlHtml(event.unit)}

        · <strong>Свободно:</strong>
        ${formatControlNumber(event.free)}
        ${escapeControlHtml(event.unit)}

        · <strong>Подтверждено:</strong>
        ${formatControlNumber(event.confirmed)}
        ${escapeControlHtml(event.unit)}

        · <strong>Дефицит:</strong>
        ${formatControlNumber(event.deficit)}
        ${escapeControlHtml(event.unit)}
      </p>

      <p>
        <strong>Дата потребности:</strong>
        ${formatControlDate(event.needDate)}

        · <strong>Крайняя дата заказа:</strong>
        ${formatControlDate(
          event.orderDeadline
        )}

        · <strong>Дата поставки:</strong>
        ${formatControlDate(
          event.deliveryDate
        )}
      </p>

      <p>
        <strong>Причина:</strong>
        ${escapeControlHtml(event.reason)}
      </p>

      <p>
        <strong>Рекомендация:</strong>
        ${escapeControlHtml(
          event.recommendation
        )}
      </p>
    `;

    eventsList.appendChild(card);
  });

  updateControlButtonsState();
}

function initializeOperationalControlCenter() {
  const buttons =
    document.querySelectorAll(
      '[data-control-filter]'
    );

  const statusFilter =
    document.getElementById(
      'controlStatusFilter'
    );

  const projectFilter =
    document.getElementById(
      'controlProjectFilter'
    );

  const objectFilter =
    document.getElementById(
      'controlObjectFilter'
    );

  buttons.forEach(function (button) {
    button.addEventListener(
      'click',
      function () {
        activeControlFilter =
          button.dataset.controlFilter ||
          'all';

        if (statusFilter) {
          statusFilter.value =
            activeControlFilter;
        }

        renderOperationalControlCenter();
      }
    );
  });

  if (statusFilter) {
    statusFilter.addEventListener(
      'change',
      function () {
        activeControlFilter =
          statusFilter.value || 'all';

        renderOperationalControlCenter();
      }
    );
  }

  if (projectFilter) {
    projectFilter.addEventListener(
      'change',
      renderOperationalControlCenter
    );
  }

  if (objectFilter) {
    objectFilter.addEventListener(
      'change',
      renderOperationalControlCenter
    );
  }

  updateControlButtonsState();
}


const MATERIAL_HISTORY_FIELD_LABELS = {
  project: 'Проект',
  object: 'Объект',
  work: 'Работа',
  name: 'Материал',
  responsible: 'Ответственный',
  need: 'Потребность',
  unit: 'Единица',
  stock: 'Общий остаток',
  reserved: 'Резерв',
  confirmed: 'Подтверждено',
  deliveryDate: 'Дата поставки',
  leadDays: 'Срок поставки'
};


function formatMaterialHistoryDate(
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '—';
  }

  return date.toLocaleString(
    'ru-RU',
    {
      dateStyle: 'short',
      timeStyle: 'medium'
    }
  );
}


function formatMaterialHistoryValue(
  value
) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  return String(value);
}


function describeMaterialHistoryEvent(
  event
) {
  const before =
    event.before ||
    {};

  const after =
    event.after ||
    {};

  if (
    event.action === 'created'
  ) {
    return (
      'Создана позиция: ' +
      formatMaterialHistoryValue(
        after.need
      ) +
      ' ' +
      formatMaterialHistoryValue(
        after.unit
      ) +
      '.'
    );
  }

  if (
    event.action === 'archived'
  ) {
    return (
      'Позиция исключена из активного расчёта. ' +
      'Предыдущие данные сохранены.'
    );
  }

  if (
    event.action === 'restored'
  ) {
    return (
      'Позиция восстановлена в активный расчёт.'
    );
  }

  const changes = [];

  Object.keys(
    MATERIAL_HISTORY_FIELD_LABELS
  ).forEach(
    function (field) {
      const beforeValue =
        formatMaterialHistoryValue(
          before[field]
        );

      const afterValue =
        formatMaterialHistoryValue(
          after[field]
        );

      if (
        beforeValue !==
        afterValue
      ) {
        changes.push(
          MATERIAL_HISTORY_FIELD_LABELS[
            field
          ] +
          ': ' +
          beforeValue +
          ' → ' +
          afterValue
        );
      }
    }
  );

  return changes.length > 0
    ? changes.join('; ')
    : 'Сохранение без изменения контролируемых полей.';
}


function materialHistoryActionLabel(
  action
) {
  const labels = {
    created: 'Добавлено',
    updated: 'Изменено',
    archived: 'Исключено',
    restored: 'Восстановлено'
  };

  return (
    labels[action] ||
    'Изменено'
  );
}


function renderMaterialArchive() {
  const tbody =
    document.querySelector(
      '#materialArchiveTable tbody'
    );

  const empty =
    document.getElementById(
      'materialArchiveEmpty'
    );

  const count =
    document.getElementById(
      'materialArchiveCount'
    );

  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  if (count) {
    count.textContent =
      String(
        archivedMaterials.length
      );
  }

  if (empty) {
    empty.classList.toggle(
      'hidden',
      archivedMaterials.length > 0
    );
  }

  archivedMaterials
    .slice()
    .reverse()
    .forEach(
      function (material) {
        const tr =
          document.createElement(
            'tr'
          );

        tr.innerHTML = `
          <td>${escapeControlHtml(material.project || '—')}</td>
          <td>${escapeControlHtml(material.work || '—')}</td>
          <td>${escapeControlHtml(material.name || '—')}</td>
          <td>${escapeControlHtml(formatControlNumber(material.need))}</td>
          <td>${escapeControlHtml(material.unit || '—')}</td>
          <td>${escapeControlHtml(formatMaterialHistoryDate(material.archivedAt))}</td>
          <td>${escapeControlHtml(material.archiveReason || 'Без пояснения')}</td>
          <td><button type="button" class="small-btn material-restore-btn">Восстановить</button></td>
        `;

        const restoreButton =
          tr.querySelector(
            '.material-restore-btn'
          );

        if (restoreButton) {
          restoreButton.addEventListener(
            'click',
            function () {
              restoreArchivedMaterial(
                material.id
              );
            }
          );
        }

        tbody.appendChild(tr);
      }
    );
}


function renderMaterialHistory() {
  const tbody =
    document.querySelector(
      '#materialHistoryTable tbody'
    );

  const empty =
    document.getElementById(
      'materialHistoryEmpty'
    );

  const count =
    document.getElementById(
      'materialHistoryCount'
    );

  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  if (count) {
    count.textContent =
      String(
        materialHistory.length
      );
  }

  if (empty) {
    empty.classList.toggle(
      'hidden',
      materialHistory.length > 0
    );
  }

  materialHistory
    .slice()
    .reverse()
    .slice(0, 100)
    .forEach(
      function (event) {
        const tr =
          document.createElement(
            'tr'
          );

        tr.innerHTML = `
          <td>${escapeControlHtml(formatMaterialHistoryDate(event.occurredAt))}</td>
          <td><span class="badge ${escapeControlHtml(event.action || 'updated')}">${escapeControlHtml(materialHistoryActionLabel(event.action))}</span></td>
          <td>${escapeControlHtml(event.materialName || '—')}</td>
          <td>${escapeControlHtml(describeMaterialHistoryEvent(event))}</td>
          <td>${escapeControlHtml(event.reason || '—')}</td>
          <td>${escapeControlHtml(event.actorRole === 'engineer' ? 'Инженер' : event.actorRole || '—')}</td>
        `;

        tbody.appendChild(tr);
      }
    );
}


function render() {
  const tbody = document.querySelector('#materialsTable tbody');
  tbody.innerHTML = '';

 const today =
  parseDate(
    document.getElementById(
      'todayDate'
    ).value
  ) || new Date();

  let critical = 0;
  let warning = 0;
  let ok = 0;

  materials.forEach((row, index) => {
  const schedule =
    getMaterialScheduleForControl(row);

  const needDate =
    schedule.needDate;

  const free =
    Math.max(
      Number(row.stock || 0) -
      Number(row.reserved || 0),
      0
    );
    const available =
  free + Number(row.confirmed || 0);

const deficit =
  Math.max(
    Number(row.need || 0) -
    available,
    0
  );

const orderDeadline =
  needDate
    ? addDays(
        needDate,
        -Number(row.leadDays || 0)
      )
    : null;

const risk =
  riskFor(
    row,
    needDate,
    today
  );

    if (risk.level === 'critical') critical++;
    if (risk.level === 'warning') warning++;
    if (risk.level === 'ok') ok++;

const sourceNote =
  row.sourceDocument
    ? (
        '<div class="material-source-note">' +
        'Источник: ' +
        escapeControlHtml(
          row.sourceDocument
        ) +
        ', стр. ' +
        escapeControlHtml(
          row.sourcePage || '—'
        ) +
        '</div>'
      )
    : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeControlHtml(row.project || '—')}</td>
      <td>${escapeControlHtml(row.object || '—')}</td>
      <td>${escapeControlHtml(row.work || '—')}</td>
      <td>
      ${escapeControlHtml(row.name)}
      ${sourceNote}
      </td>
      <td>${escapeControlHtml(row.responsible || '—')}</td>
      <td>${formatControlNumber(row.need)}</td>
      <td>${escapeControlHtml(row.unit)}</td>
      <td>${formatControlNumber(row.stock)}</td>
      <td>${formatControlNumber(row.reserved)}</td>
      <td>${formatControlNumber(free)}</td>
      <td>${formatControlNumber(row.confirmed)}</td>
      <td>${escapeControlHtml(row.deliveryDate || '—')}</td>
      <td>${formatControlNumber(row.leadDays)}</td>
      <td>${formatControlNumber(deficit)}</td>
      <td>${escapeControlHtml(formatDate(needDate))}</td>
      <td>${escapeControlHtml(formatDate(orderDeadline))}</td>
      <td><span class="badge ${escapeControlHtml(risk.level)}">${escapeControlHtml(risk.text)}</span></td>
      <td>${escapeControlHtml(risk.action)}</td>
      <td>
        <div class="material-row-actions">
          <button type="button" class="small-btn" onclick="startMaterialEdit(${index})">Изменить</button>
          <button type="button" class="small-btn material-archive-btn" onclick="deleteMaterial(${index})">Исключить</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('warningCount').textContent = warning;
  document.getElementById('okCount').textContent = ok;

  renderOperationalControlCenter();
  renderMaterialArchive();
  renderMaterialHistory();
}

function addMaterial() {
  const project =
    document.getElementById(
      'newProject'
    ).value.trim() ||
    'Без проекта';

  const object =
    document.getElementById(
      'newObject'
    ).value.trim() ||
    'Без объекта';

  const work =
    document.getElementById(
      'newWork'
    ).value.trim() ||
    'Без работы';

  const name =
    document.getElementById(
      'newName'
    ).value.trim();

  const responsible =
    document.getElementById(
      'newResponsible'
    ).value.trim() ||
    'Не назначен';

  const need =
    Number(
      document.getElementById(
        'newNeed'
      ).value
    );

  const unit =
    document.getElementById(
      'newUnit'
    ).value.trim() ||
    'шт';

  const reasonInput =
    document.getElementById(
      'materialChangeReason'
    );

  const changeReason =
    (
      reasonInput
        ? reasonInput.value
        : ''
    ).trim();

  if (!name || !need) {
    alert('Введите материал и нужное количество.');
    return;
  }

  const importSource =
  pendingMaterialCandidateImport;

  const materialValues = {
    project,
    object,
    work,
    name,
    responsible,
    unit,
    need,
    stock: Number(document.getElementById('newStock').value || 0),
    reserved: Number(document.getElementById('newReserved').value || 0),
    confirmed: Number(document.getElementById('newConfirmed').value || 0),
    deliveryDate:
  document.getElementById(
    'newDelivery'
  ).value,

leadDays:
  Number(
    document.getElementById(
      'newLead'
    ).value || 1
  ),

sourceType:
  importSource
    ? 'pdf-candidate'
    : 'manual',

sourceDocument:
  importSource
    ? importSource.fileName
    : '',

sourcePage:
  importSource
    ? importSource.candidate.pageNumber
    : null,

sourceReviewStatus:
  importSource
    ? 'confirmed-by-engineer'
    : ''
  };

  let changedMaterial =
    null;

  let action =
    'created';

  if (editingMaterialId) {
    const materialIndex =
      materials.findIndex(
        function (material) {
          return (
            material.id ===
            editingMaterialId
          );
        }
      );

    if (materialIndex < 0) {
      alert(
        'Редактируемая позиция не найдена. Обновите страницу и повторите попытку.'
      );

      cancelMaterialEdit();
      return;
    }

    const before =
      cloneMaterialValue(
        materials[materialIndex]
      );

    changedMaterial = {
      ...materials[materialIndex],
      ...materialValues,

      sourceType:
        materials[materialIndex]
          .sourceType ||
        'manual',

      sourceDocument:
        materials[materialIndex]
          .sourceDocument ||
        '',

      sourcePage:
        materials[materialIndex]
          .sourcePage ||
        null,

      sourceReviewStatus:
        materials[materialIndex]
          .sourceReviewStatus ||
        '',

      revision:
        Number(
          materials[materialIndex]
            .revision
        ) + 1,

      updatedAt:
        new Date().toISOString()
    };

    materials[materialIndex] =
      changedMaterial;

    recordMaterialHistory(
      'updated',
      before,
      changedMaterial,
      changeReason ||
        'Ручная корректировка материала'
    );

    action =
      'updated';
  } else {
    changedMaterial =
      normalizeMaterialRecord(
        materialValues,
        'active'
      );

    materials.push(
      changedMaterial
    );

    recordMaterialHistory(
      'created',
      null,
      changedMaterial,
      changeReason ||
        (
          importSource
            ? 'Подтверждено из документа инженером'
            : 'Добавлено вручную'
        )
    );
  }

  if (
    importSource &&
    action === 'created'
  ) {
  importSource.candidate.transferStatus =
    'transferred';

  importSource.candidate.status =
    'Перенесено в материалы';

  rememberMaterialCandidateReview(
    importSource.documentItem,
    importSource.candidate
  );

  pendingMaterialCandidateImport =
    null;
}

  const changedMaterialId =
    changedMaterial.id;

  saveMaterials();
  clearAddForm();
  finishMaterialEditMode();
  restoreActiveMaterialContext();
  render();
  renderProjectDocuments();

  notifyMaterialsChanged(
    action,
    [changedMaterialId]
  );
}

function deleteMaterial(index) {
  const material =
    materials[index];

  if (!material) {
    return;
  }

  const confirmed =
    confirm(
      'Исключить материал из активного расчёта?\n\n' +
      `${material.name} — ${material.need} ${material.unit}\n\n` +
      'Запись и история сохранятся, материал можно будет восстановить.'
    );

  if (!confirmed) {
    return;
  }

  const reason =
    prompt(
      'Укажите причину исключения:',
      'Исключено пользователем'
    );

  if (reason === null) {
    return;
  }

  const before =
    cloneMaterialValue(
      material
    );

  const archivedMaterial = {
    ...material,
    status: 'archived',
    archiveReason:
      reason.trim() ||
      'Причина не указана',
    archivedAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString(),
    revision:
      Number(material.revision) + 1
  };

  materials.splice(index, 1);

  archivedMaterials.push(
    archivedMaterial
  );

  recordMaterialHistory(
    'archived',
    before,
    archivedMaterial,
    archivedMaterial.archiveReason
  );

  if (
    editingMaterialId ===
    material.id
  ) {
    cancelMaterialEdit();
  }

  saveMaterials();
  render();

  notifyMaterialsChanged(
    'archived',
    [material.id]
  );
}


function restoreArchivedMaterial(
  materialId
) {
  const archiveIndex =
    archivedMaterials.findIndex(
      function (material) {
        return (
          material.id ===
          materialId
        );
      }
    );

  if (archiveIndex < 0) {
    return;
  }

  const archivedMaterial =
    archivedMaterials[
      archiveIndex
    ];

  const confirmed =
    confirm(
      'Восстановить материал в активный расчёт?\n\n' +
      `${archivedMaterial.name} — ${archivedMaterial.need} ${archivedMaterial.unit}`
    );

  if (!confirmed) {
    return;
  }

  const before =
    cloneMaterialValue(
      archivedMaterial
    );

  const restoredMaterial = {
    ...archivedMaterial,
    status: 'active',
    archiveReason: '',
    archivedAt: null,
    restoredAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString(),
    revision:
      Number(
        archivedMaterial.revision
      ) + 1
  };

  archivedMaterials.splice(
    archiveIndex,
    1
  );

  materials.push(
    restoredMaterial
  );

  recordMaterialHistory(
    'restored',
    before,
    restoredMaterial,
    'Восстановлено пользователем'
  );

  saveMaterials();
  render();

  notifyMaterialsChanged(
    'restored',
    [materialId]
  );
}


function setMaterialInputValue(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.value =
      value === null ||
      value === undefined
        ? ''
        : String(value);
  }
}


function startMaterialEdit(index) {
  const material =
    materials[index];

  if (!material) {
    return;
  }

  pendingMaterialCandidateImport =
    null;

  editingMaterialId =
    material.id;

  setMaterialInputValue(
    'newProject',
    material.project
  );

  setMaterialInputValue(
    'newObject',
    material.object
  );

  setMaterialInputValue(
    'newWork',
    material.work
  );

  setMaterialInputValue(
    'newName',
    material.name
  );

  setMaterialInputValue(
    'newResponsible',
    material.responsible
  );

  setMaterialInputValue(
    'newNeed',
    material.need
  );

  setMaterialInputValue(
    'newUnit',
    material.unit
  );

  setMaterialInputValue(
    'newStock',
    material.stock
  );

  setMaterialInputValue(
    'newReserved',
    material.reserved
  );

  setMaterialInputValue(
    'newConfirmed',
    material.confirmed
  );

  setMaterialInputValue(
    'newDelivery',
    material.deliveryDate
  );

  setMaterialInputValue(
    'newLead',
    material.leadDays
  );

  setMaterialInputValue(
    'materialChangeReason',
    ''
  );

  const title =
    document.getElementById(
      'materialFormTitle'
    );

  const addButton =
    document.getElementById(
      'addBtn'
    );

  const cancelButton =
    document.getElementById(
      'cancelMaterialEditBtn'
    );

  const message =
    document.getElementById(
      'materialFormMessage'
    );

  if (title) {
    title.textContent =
      'Изменить материал';
  }

  if (addButton) {
    addButton.textContent =
      'Сохранить изменения';
  }

  if (cancelButton) {
    cancelButton.classList.remove(
      'hidden'
    );
  }

  if (message) {
    message.textContent =
      'Изменения будут сохранены новой редакцией. Предыдущее значение останется в истории.';
  }

  if (
    title &&
    typeof title.scrollIntoView ===
      'function'
  ) {
    title.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}


function finishMaterialEditMode() {
  editingMaterialId = '';

  const title =
    document.getElementById(
      'materialFormTitle'
    );

  const addButton =
    document.getElementById(
      'addBtn'
    );

  const cancelButton =
    document.getElementById(
      'cancelMaterialEditBtn'
    );

  const message =
    document.getElementById(
      'materialFormMessage'
    );

  if (title) {
    title.textContent =
      'Добавить материал';
  }

  if (addButton) {
    addButton.textContent =
      'Добавить и пересчитать';
  }

  if (cancelButton) {
    cancelButton.classList.add(
      'hidden'
    );
  }

  if (message) {
    message.textContent =
      'Новая позиция получит постоянный ID. Все дальнейшие изменения будут сохранены в истории.';
  }
}


function restoreActiveMaterialContext() {
  if (
    !window.BuildMindWorkContexts ||
    typeof window.BuildMindWorkContexts
      .getActive !== 'function'
  ) {
    return;
  }

  const context =
    window.BuildMindWorkContexts
      .getActive();

  if (!context) {
    return;
  }

  setMaterialInputValue(
    'newProject',
    context.project
  );

  setMaterialInputValue(
    'newObject',
    context.object
  );

  setMaterialInputValue(
    'newWork',
    context.work
  );
}


function cancelMaterialEdit() {
  pendingMaterialCandidateImport =
    null;

  clearAddForm();
  finishMaterialEditMode();
  restoreActiveMaterialContext();
}

function clearAddForm() {
  document.getElementById('newName').value = '';
  document.getElementById('newResponsible').value = '';
  document.getElementById('newNeed').value = '';
  document.getElementById('newUnit').value = 'шт';
  document.getElementById('newStock').value = '0';
  document.getElementById('newReserved').value = '0';
  document.getElementById('newConfirmed').value = '0';
  document.getElementById('newDelivery').value = '';
  document.getElementById('newLead').value = '1';

  const reasonInput =
    document.getElementById(
      'materialChangeReason'
    );

  if (reasonInput) {
    reasonInput.value = '';
  }
}

function resetMaterials() {
  const confirmed = confirm(
    'Исключить все активные материалы?\n\n' +
    'Записи не будут уничтожены: они перейдут в архив и останутся в истории.'
  );

  if (!confirmed) {
    return;
  }

  const reason =
    prompt(
      'Укажите причину массового исключения:',
      'Массовое исключение пользователем'
    );

  if (reason === null) {
    return;
  }

  const now =
    new Date().toISOString();

  const archivedIds = [];

  materials.forEach(
    function (material) {
      const before =
        cloneMaterialValue(
          material
        );

      const archivedMaterial = {
        ...material,
        status: 'archived',
        archiveReason:
          reason.trim() ||
          'Причина не указана',
        archivedAt: now,
        updatedAt: now,
        revision:
          Number(material.revision) + 1
      };

      archivedMaterials.push(
        archivedMaterial
      );

      archivedIds.push(
        material.id
      );

      recordMaterialHistory(
        'archived',
        before,
        archivedMaterial,
        archivedMaterial.archiveReason
      );
    }
  );

  materials = [];

  saveMaterials();
  cancelMaterialEdit();
  render();

  notifyMaterialsChanged(
    'archived-batch',
    archivedIds
  );
}


function startCleanProject() {
    const confirmed = confirm(
    'Начать новый чистый проект?\n\n' +
    'Будут очищены материалы, контексты работ, ' +
    'структура проекта, реестр редакций, ' +
    'решения по кандидатам, архив и история ' +
    'текущего проекта, а также текущий список документов.'
  );

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(
    STORAGE_KEY
  );

  localStorage.removeItem(
    MATERIAL_ARCHIVE_STORAGE_KEY
  );

  localStorage.removeItem(
    MATERIAL_HISTORY_STORAGE_KEY
  );

  localStorage.removeItem(
    CONTROL_WORK_CONTEXTS_STORAGE_KEY
  );

  localStorage.removeItem(
    'buildmindActiveContextId-v2-clean'
  );

    localStorage.removeItem(
    'buildmind-material-candidate-reviews-v2-clean'
  );

  localStorage.removeItem(
    'buildmind-project-core-v1'
  );

  localStorage.removeItem(
    'buildmind-document-registry-v1'
  );

  window.location.reload();
}

function exportJson() {
  const data = {
    project: document.getElementById('projectName').value,
    object: document.getElementById('objectName').value,
    work: document.getElementById('workName').value,
    workStartDate: document.getElementById('workStartDate').value,
    safetyDays: Number(document.getElementById('safetyDays').value || 0),
    materials,
    archivedMaterials,
    materialHistory
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'buildmind-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('recalcBtn').addEventListener('click', render);
document.getElementById('addBtn').addEventListener('click', addMaterial);
document.getElementById('exportBtn').addEventListener('click', exportJson);
document.getElementById('resetBtn').addEventListener('click', resetMaterials);

document.getElementById(
  'cancelMaterialEditBtn'
).addEventListener(
  'click',
  cancelMaterialEdit
);

document.getElementById(
  'newCleanProjectBtn'
).addEventListener(
  'click',
  startCleanProject
);

initializeOperationalControlCenter();
render();

/* ==================================================
   ПРОЕКТНЫЕ ДОКУМЕНТЫ И ГПР
   ================================================== */

const MATERIAL_CANDIDATE_REVIEWS_KEY =
  'buildmind-material-candidate-reviews-v2-clean';

function loadMaterialCandidateReviews() {
  try {
    const savedReviews =
      localStorage.getItem(
        MATERIAL_CANDIDATE_REVIEWS_KEY
      );

    if (!savedReviews) {
      return {};
    }

    const parsedReviews =
      JSON.parse(savedReviews);

    return (
      parsedReviews &&
      typeof parsedReviews === 'object' &&
      !Array.isArray(parsedReviews)
        ? parsedReviews
        : {}
    );
  } catch (error) {
    console.warn(
      'Не удалось прочитать решения по кандидатам PDF:',
      error
    );

    return {};
  }
}

let materialCandidateReviews =
  loadMaterialCandidateReviews();

function saveMaterialCandidateReviews() {
  try {
    localStorage.setItem(
      MATERIAL_CANDIDATE_REVIEWS_KEY,
      JSON.stringify(
        materialCandidateReviews
      )
    );
  } catch (error) {
    console.warn(
      'Не удалось сохранить решения по кандидатам PDF:',
      error
    );
  }
}

function getMaterialCandidateReviewKey(
  documentItem,
  candidate
) {
  const file =
    documentItem &&
    documentItem.file
      ? documentItem.file
      : null;

  return [
    file ? file.name : '',
    file ? Number(file.size) || 0 : 0,
    Number(candidate.pageNumber) || 0,
    normalizeControlValue(
      candidate.name
    ),
    Number(candidate.quantity) || 0,
    normalizeControlValue(
      candidate.unit
    )
  ].join('|');
}

function findSavedMaterialCandidateReview(
  documentItem,
  candidate
) {
  const stableKey =
    getMaterialCandidateReviewKey(
      documentItem,
      candidate
    );

  const stableReview =
    materialCandidateReviews[
      stableKey
    ];

  if (stableReview) {
    return {
      key: stableKey,
      review: stableReview
    };
  }

  const file =
    documentItem &&
    documentItem.file
      ? documentItem.file
      : null;

  if (!file) {
    return null;
  }

  const legacyPrefix =
    [
      file.name,
      Number(file.size) || 0
    ].join('|') + '|';

  const legacySuffix =
    '|' +
    [
      Number(candidate.pageNumber) || 0,
      normalizeControlValue(
        candidate.name
      ),
      Number(candidate.quantity) || 0,
      normalizeControlValue(
        candidate.unit
      )
    ].join('|');

  const legacyKey =
    Object.keys(
      materialCandidateReviews
    ).find(function (savedKey) {
      return (
        savedKey.startsWith(
          legacyPrefix
        ) &&
        savedKey.endsWith(
          legacySuffix
        )
      );
    });

  if (!legacyKey) {
    return null;
  }

  return {
    key: legacyKey,
    review:
      materialCandidateReviews[
        legacyKey
      ]
  };
}

function rememberMaterialCandidateReview(
  documentItem,
  candidate
) {
  if (
    !documentItem ||
    !documentItem.file ||
    !candidate
  ) {
    return;
  }

  const reviewKey =
    getMaterialCandidateReviewKey(
      documentItem,
      candidate
    );

  materialCandidateReviews[
    reviewKey
  ] = {
    reviewStatus:
      candidate.reviewStatus ||
      'pending',

    transferStatus:
      candidate.transferStatus ||
      '',

    status:
      candidate.status ||
      'Требует проверки',

    updatedAt:
      new Date().toISOString()
  };

  saveMaterialCandidateReviews();
}

function materialCandidateAlreadyTransferred(
  documentItem,
  candidate
) {
  if (
    !documentItem ||
    !documentItem.file ||
    !candidate
  ) {
    return false;
  }

  return materials.some(
    function (row) {
      return (
        row.sourceDocument ===
          documentItem.file.name &&
        Number(row.sourcePage) ===
          Number(
            candidate.pageNumber
          ) &&
        normalizeControlValue(
          row.name
        ) ===
          normalizeControlValue(
            candidate.name
          )
      );
    }
  );
}

function applySavedMaterialCandidateReview(
  documentItem,
  candidate
) {
  if (
    materialCandidateAlreadyTransferred(
      documentItem,
      candidate
    )
  ) {
    candidate.reviewStatus =
      'confirmed';

    candidate.transferStatus =
      'transferred';

    candidate.status =
      'Перенесено в материалы';

    rememberMaterialCandidateReview(
      documentItem,
      candidate
    );

    return candidate;
  }

  const savedResult =
    findSavedMaterialCandidateReview(
      documentItem,
      candidate
    );

  if (!savedResult) {
    return candidate;
  }

  const savedReview =
    savedResult.review;

  candidate.reviewStatus =
    savedReview.reviewStatus ||
    'pending';

  candidate.transferStatus =
    savedReview.transferStatus ||
    '';

  candidate.status =
    savedReview.status ||
    'Требует проверки';

  const stableKey =
    getMaterialCandidateReviewKey(
      documentItem,
      candidate
    );

  if (
    savedResult.key !==
    stableKey
  ) {
    rememberMaterialCandidateReview(
      documentItem,
      candidate
    );
  }

  return candidate;
}

let uploadedProjectDocuments = [];

function notifyProjectDocumentsChanged(
  action,
  documentIds
) {
  window.dispatchEvent(
    new CustomEvent(
      'buildmind:project-documents-changed',
      {
        detail: {
          action:
            action || 'updated',

          documentIds:
            Array.isArray(documentIds)
              ? [...documentIds]
              : [],

          documentsCount:
            uploadedProjectDocuments.length
        }
      }
    )
  );
}

let pendingMaterialCandidateImport =
  null;

function prepareMaterialCandidateImport(
  documentItem,
  candidate
) {
  if (editingMaterialId) {
    cancelMaterialEdit();
  }

  const projectInput =
    document.getElementById(
      'newProject'
    );

  const objectInput =
    document.getElementById(
      'newObject'
    );

  const workInput =
    document.getElementById(
      'newWork'
    );

  const nameInput =
    document.getElementById(
      'newName'
    );

  const responsibleInput =
    document.getElementById(
      'newResponsible'
    );

  const needInput =
    document.getElementById(
      'newNeed'
    );

  const unitInput =
    document.getElementById(
      'newUnit'
    );

  if (
    !nameInput ||
    !needInput ||
    !unitInput
  ) {
    alert(
      'Форма добавления материала не найдена.'
    );

    return;
  }

  const alreadyTransferred =
  materialCandidateAlreadyTransferred(
    documentItem,
    candidate
  );

 if (alreadyTransferred) {
  candidate.transferStatus =
    'transferred';

  candidate.status =
    'Перенесено в материалы';

  rememberMaterialCandidateReview(
    documentItem,
    candidate
  );

  renderProjectDocuments();

    alert(
      'Эта позиция уже находится в таблице материалов.'
    );

    return;
  }

  const projectHeader =
    document.getElementById(
      'projectName'
    );

  const objectHeader =
    document.getElementById(
      'objectName'
    );

  const workHeader =
    document.getElementById(
      'workName'
    );

  if (
    projectInput &&
    projectHeader &&
    projectHeader.value.trim()
  ) {
    projectInput.value =
      projectHeader.value.trim();
  }

  if (
    objectInput &&
    objectHeader &&
    objectHeader.value.trim()
  ) {
    objectInput.value =
      objectHeader.value.trim();
  }

  if (
    workInput &&
    workHeader &&
    workHeader.value.trim()
  ) {
    workInput.value =
      workHeader.value.trim();
  }

  nameInput.value =
    candidate.name;

  needInput.value =
    String(candidate.quantity);

  unitInput.value =
    candidate.unit;

  if (responsibleInput) {
    responsibleInput.value = '';
  }

  pendingMaterialCandidateImport = {
  candidate,
  documentItem,
  fileName:
    documentItem.file.name
};

  const message =
    document.getElementById(
      'documentsMessage'
    );

  if (message) {
    message.textContent =
      'Кандидат подготовлен к переносу. ' +
      'Проверьте форму материала, ' +
      'назначьте ответственного и нажмите «Добавить материал».';
  }

  nameInput.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

  nameInput.focus();
}

function getProjectDocumentId(file) {
  return [
    file.name,
    file.size,
    file.lastModified
  ].join('-');
}

function getProjectDocumentExtension(file) {
  const parts =
    String(file.name || '').split('.');

  return parts.length > 1
    ? parts.pop().toLowerCase()
    : '';
}

function getProjectDocumentType(file) {
  const extension =
    getProjectDocumentExtension(file);

  const documentTypes = {
    pdf: 'PDF-документ',
    xlsx: 'Excel XLSX',
    xls: 'Excel XLS',
    csv: 'Таблица CSV'
  };

  return (
    documentTypes[extension] ||
    'Неизвестный формат'
  );
}

function formatProjectDocumentSize(bytes) {
  const size =
    Number(bytes) || 0;

  if (size < 1024) {
    return `${size} Б`;
  }

  if (size < 1024 * 1024) {
    return (
      `${(size / 1024).toFixed(1)} КБ`
    );
  }

  return (
    `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} МБ`
  );
}

function getDocumentsCountText(count) {
  const lastTwo =
    count % 100;

  const lastOne =
    count % 10;

  if (
    lastTwo >= 11 &&
    lastTwo <= 14
  ) {
    return `${count} файлов`;
  }

  if (lastOne === 1) {
    return `${count} файл`;
  }

  if (
    lastOne >= 2 &&
    lastOne <= 4
  ) {
    return `${count} файла`;
  }

  return `${count} файлов`;
}

function renderProjectDocuments() {
  const list =
    document.getElementById(
      'documentsList'
    );

  const count =
    document.getElementById(
      'documentsCount'
    );

  const message =
    document.getElementById(
      'documentsMessage'
    );

  const clearButton =
    document.getElementById(
      'clearDocumentsBtn'
    );

  if (
    !list ||
    !count ||
    !message ||
    !clearButton
  ) {
    return;
  }

  list.innerHTML = '';

  count.textContent =
    getDocumentsCountText(
      uploadedProjectDocuments.length
    );

  clearButton.disabled =
    uploadedProjectDocuments.length === 0;

  if (
    uploadedProjectDocuments.length === 0
  ) {
    message.textContent =
      'Файлы пока не выбраны.';

    return;
  }

  message.textContent =
    'Документы подготовлены к последующему анализу.';

  uploadedProjectDocuments.forEach(
    function (documentItem) {
      const card =
        document.createElement('article');

      card.className =
        'document-file-card';

      const main =
        document.createElement('div');

      main.className =
        'document-file-main';

      const name =
        document.createElement('p');

      name.className =
        'document-file-name';

      name.textContent =
        documentItem.file.name;

      const meta =
        document.createElement('div');

      meta.className =
        'document-file-meta';

      const type =
        document.createElement('span');

      type.textContent =
        getProjectDocumentType(
          documentItem.file
        );

      const size =
        document.createElement('span');

      size.textContent =
        formatProjectDocumentSize(
          documentItem.file.size
        );

      const status =
        document.createElement('span');

     status.className =
  'document-status';

if (
  documentItem.status ===
  'analyzing'
) {
  status.textContent =
    'Распознаётся';

  status.classList.add(
    'document-status-analyzing'
  );
} else if (
  documentItem.status ===
  'analyzed'
) {
  status.textContent =
    'Распознан';

  status.classList.add(
    'document-status-analyzed'
  );
} else if (
  documentItem.status ===
  'error'
) {
  status.textContent =
    'Ошибка анализа';

  status.classList.add(
    'document-status-error'
  );
} else {
  status.textContent =
    'Ожидает распознавания';
}

      meta.appendChild(type);
      meta.appendChild(size);
      meta.appendChild(status);

      main.appendChild(name);
      main.appendChild(meta);

      if (documentItem.analysis) {
  const analysisResult =
    document.createElement('div');

  analysisResult.className =
    'document-analysis-result';

  if (
    documentItem.analysis.success
  ) {
    const result =
      documentItem.analysis;

    analysisResult.textContent =
      `Страниц: ${result.totalPages}. ` +
      `Текст найден на ` +
      `${result.pagesWithText} из ` +
      `${result.totalPages} страниц. ` +
      result.pdfType;

    if (
      result.compositeAnalysis &&
      Array.isArray(
        result.compositeAnalysis
          .meaningfulSections
      )
    ) {
      const sections =
        result.compositeAnalysis
          .meaningfulSections;

      const sectionsBlock =
        document.createElement('div');

      sectionsBlock.className =
        'document-composite-sections';

      const sectionsTitle =
        document.createElement('h5');

      sectionsTitle.textContent =
        result.compositeAnalysis.isComposite
          ? `Найден составной PDF: ${sections.length} разделов`
          : `Найдено разделов: ${sections.length}`;

      sectionsBlock.appendChild(
        sectionsTitle
      );

      if (sections.length === 0) {
        const empty =
          document.createElement('p');

        empty.textContent =
          'Логические разделы пока не определены.';

        sectionsBlock.appendChild(
          empty
        );
      } else {
        sections.forEach(
          function (section) {
            const row =
              document.createElement('div');

            row.className =
              'document-composite-section-row';

            const label =
              document.createElement('strong');

            label.textContent =
              section.label;

            const pages =
              document.createElement('span');

            pages.textContent =
              section.startPage ===
                section.endPage
                ? `страница ${section.startPage}`
                : `страницы ${section.startPage}–${section.endPage}`;

            const confidence =
              document.createElement('small');

            const confidenceLabels = {
              high: 'Высокая уверенность',
              medium: 'Средняя уверенность',
              low: 'Требует уточнения'
            };

            let confidenceText =
              confidenceLabels[
                section.confidence
              ] ||
              confidenceLabels.low;

            if (
              section.kind === 'schedule' &&
              section.dateRange
            ) {
              confidenceText +=
                ` · ${section.dateRange.startDate}` +
                ` — ${section.dateRange.endDate}`;

              if (
                section.scheduleStatus ===
                'expired'
              ) {
                confidenceText +=
                  ' · срок графика прошёл';
              }
            }

            confidence.textContent =
              confidenceText;

            row.appendChild(label);
            row.appendChild(pages);
            row.appendChild(confidence);
            sectionsBlock.appendChild(row);
          }
        );
      }

      main.appendChild(
        sectionsBlock
      );
    }

    if (
      Array.isArray(result.ocrFailedPages) &&
      result.ocrFailedPages.length > 0
    ) {
      const ocrWarning =
        document.createElement('p');

      ocrWarning.className =
        'document-ocr-warning';

      ocrWarning.textContent =
        'Не удалось прочитать страницы: ' +
        result.ocrFailedPages.join(', ') +
        '. Их нужно проверить вручную.';

      main.appendChild(
        ocrWarning
      );
    }
  } else {
    analysisResult.textContent =
      documentItem.analysis.errorMessage ||
      'Не удалось проверить документ.';
  }

  main.appendChild(
    analysisResult
  );
        if (
  documentItem.analysis.success &&
  documentItem.analysis
    .documentClassification
) {
  const classification =
    documentItem.analysis
      .documentClassification;

  const classificationBlock =
    document.createElement('div');

  classificationBlock.className =
    'document-classification';

  const classificationTitle =
    document.createElement('strong');

  classificationTitle.textContent =
    'Предполагаемый тип: ' +
    classification.label;

  classificationBlock.appendChild(
    classificationTitle
  );

  const confidenceText =
    document.createElement('p');

  confidenceText.textContent =
    'Уверенность классификации: ' +
    classification.confidence;

  classificationBlock.appendChild(
    confidenceText
  );

  if (
    classification.sourcePages.length >
    0
  ) {
    const pagesText =
      document.createElement('p');

    pagesText.textContent =
      'Страницы-источники: ' +
      classification.sourcePages.join(
        ', '
      );

    classificationBlock.appendChild(
      pagesText
    );
  }

  if (
    classification
      .matchedKeywords.length > 0
  ) {
    const keywordsText =
      document.createElement('p');

    keywordsText.textContent =
      'Найденные признаки: ' +
      classification
        .matchedKeywords
        .join(', ');

    classificationBlock.appendChild(
      keywordsText
    );
  }

  const warningText =
    document.createElement('small');

  warningText.textContent =
    'Тип определён автоматически и требует подтверждения инженером.';

  classificationBlock.appendChild(
    warningText
  );

  main.appendChild(
    classificationBlock
  );
}

        if (
  documentItem.analysis.success &&
  Array.isArray(
    documentItem.analysis
      .materialCandidates
  )
) {
  const candidates =
    documentItem.analysis
      .materialCandidates;

  const candidatesBlock =
    document.createElement('div');

  candidatesBlock.className =
    'document-material-candidates';

  const candidatesTitle =
  document.createElement('h5');

const pendingCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate.reviewStatus ===
          'pending' &&
        candidate.transferStatus !==
          'transferred'
      );
    }
  ).length;

const confirmedCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate.reviewStatus ===
          'confirmed' &&
        candidate.transferStatus !==
          'transferred'
      );
    }
  ).length;

const rejectedCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate.reviewStatus ===
          'rejected' &&
        candidate.transferStatus !==
          'transferred'
      );
    }
  ).length;

const transferredCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate.transferStatus ===
        'transferred'
      );
    }
  ).length;

candidatesTitle.textContent =
  `Кандидаты: ${candidates.length} · ` +
  `ожидают: ${pendingCandidates} · ` +
  `подтверждено: ${confirmedCandidates} · ` +
  `отклонено: ${rejectedCandidates} · ` +
  `перенесено: ${transferredCandidates}`;
  candidatesBlock.appendChild(
    candidatesTitle
  );

  if (candidates.length === 0) {
    const emptyCandidates =
      document.createElement('p');

    emptyCandidates.textContent =
      'На доступных текстовых страницах позиции вида «материал — количество — единица» не найдены.';

    candidatesBlock.appendChild(
      emptyCandidates
    );
  } else {
    const candidatesTable =
      document.createElement('div');

    candidatesTable.className =
      'material-candidates-table';

    candidates
      .slice(0, 30)
      .forEach(function (candidate) {
        const candidateRow =
          document.createElement('div');

        candidateRow.className =
          'material-candidate-row';

        const candidateName =
          document.createElement('strong');

        candidateName.textContent =
          candidate.name;

        const candidateData =
          document.createElement('span');

        candidateData.textContent =
          `${candidate.quantity} ` +
          `${candidate.unit} · ` +
          `страница ` +
          `${candidate.pageNumber}`;

        const candidateStatus =
  document.createElement('small');

candidateStatus.className =
  'material-candidate-status';

if (
  candidate.transferStatus ===
  'transferred'
) {
  candidateStatus.textContent =
    'Перенесено в материалы';

  candidateStatus.classList.add(
    'material-candidate-status-transferred'
  );
} else if (
  candidate.reviewStatus ===
  'confirmed'
) {
  candidateStatus.textContent =
    'Подтверждено инженером';

  candidateStatus.classList.add(
    'material-candidate-status-confirmed'
  );
} else if (
  candidate.reviewStatus ===
  'rejected'
) {
  candidateStatus.textContent =
    'Отклонено инженером';

  candidateStatus.classList.add(
    'material-candidate-status-rejected'
  );
} else {
  candidateStatus.textContent =
    'Требует проверки';

  candidateStatus.classList.add(
    'material-candidate-status-pending'
  );
}

       const candidateActions =
  document.createElement('div');

candidateActions.className =
  'material-candidate-actions';

const confirmCandidateButton =
  document.createElement('button');

confirmCandidateButton.type =
  'button';

confirmCandidateButton.className =
  'material-candidate-confirm';

confirmCandidateButton.textContent =
  'Подтвердить';

confirmCandidateButton.disabled =
  candidate.reviewStatus ===
    'confirmed' ||
  candidate.transferStatus ===
    'transferred';

confirmCandidateButton.addEventListener(
  'click',
  function () {
  if (
    candidate.transferStatus ===
    'transferred'
  ) {
    return;
  }

  candidate.reviewStatus =
    'confirmed';

    candidate.status =
  'Подтверждено инженером';

rememberMaterialCandidateReview(
  documentItem,
  candidate
);

renderProjectDocuments();
  }
);

const rejectCandidateButton =
  document.createElement('button');

rejectCandidateButton.type =
  'button';

rejectCandidateButton.className =
  'material-candidate-reject';

rejectCandidateButton.textContent =
  'Отклонить';

rejectCandidateButton.disabled =
  candidate.reviewStatus ===
    'rejected' ||
  candidate.transferStatus ===
    'transferred';

rejectCandidateButton.addEventListener(
  'click',
  function () {
    if (
      candidate.transferStatus ===
      'transferred'
    ) {
      return;
    }

    candidate.reviewStatus =
      'rejected';

    candidate.status =
  'Отклонено инженером';

rememberMaterialCandidateReview(
  documentItem,
  candidate
);

renderProjectDocuments();
  }
);

candidateActions.appendChild(
  confirmCandidateButton
);

candidateActions.appendChild(
  rejectCandidateButton
);

        const transferCandidateButton =
  document.createElement('button');

transferCandidateButton.type =
  'button';

transferCandidateButton.className =
  'material-candidate-transfer';

transferCandidateButton.textContent =
  candidate.transferStatus ===
    'transferred'
    ? 'Перенесено'
    : 'В материалы';

transferCandidateButton.disabled =
  candidate.reviewStatus !==
    'confirmed' ||
  candidate.transferStatus ===
    'transferred';

transferCandidateButton.addEventListener(
  'click',
  function () {
    prepareMaterialCandidateImport(
      documentItem,
      candidate
    );
  }
);

candidateActions.appendChild(
  transferCandidateButton
);

candidateRow.classList.toggle(
  'material-candidate-confirmed',
  candidate.reviewStatus ===
    'confirmed'
);

candidateRow.classList.toggle(
  'material-candidate-rejected',
  candidate.reviewStatus ===
    'rejected'
);

candidateRow.classList.toggle(
  'material-candidate-transferred',
  candidate.transferStatus ===
    'transferred'
);

candidateRow.appendChild(
  candidateName
);

candidateRow.appendChild(
  candidateData
);

candidateRow.appendChild(
  candidateStatus
);

candidateRow.appendChild(
  candidateActions
);

candidatesTable.appendChild(
  candidateRow
);
      });

    candidatesBlock.appendChild(
      candidatesTable
    );

    if (candidates.length > 30) {
      const limitMessage =
        document.createElement('small');

      limitMessage.className =
        'material-candidates-limit';

      limitMessage.textContent =
        `Показаны первые 30 из ` +
        `${candidates.length} кандидатов.`;

      candidatesBlock.appendChild(
        limitMessage
      );
    }
  }

  const verificationWarning =
    document.createElement('small');

  verificationWarning.className =
    'material-candidates-warning';

  verificationWarning.textContent =
    'Результаты сформированы автоматически. Перед использованием требуется проверка инженером.';

  candidatesBlock.appendChild(
    verificationWarning
  );

  main.appendChild(
    candidatesBlock
  );
}
        
        if (
  documentItem.analysis.success &&
  Array.isArray(
    documentItem.analysis
      .extractedPages
  ) &&
  documentItem.analysis
    .extractedPages.length > 0
) {
  const textDetails =
    document.createElement(
      'details'
    );

  textDetails.className =
    'document-text-details';

  const textSummary =
    document.createElement(
      'summary'
    );

  textSummary.textContent =
    'Показать извлечённый текст — ' +
    documentItem.analysis
      .extractedPages.length +
    ' стр.';

  textDetails.appendChild(
    textSummary
  );

  documentItem.analysis
    .extractedPages
    .forEach(function (pageItem) {
      const pageBlock =
        document.createElement(
          'section'
        );

      pageBlock.className =
        'document-text-page';

      const pageTitle =
        document.createElement(
          'h5'
        );

      pageTitle.textContent =
        `Страница ` +
        `${pageItem.pageNumber} · ` +
        `${pageItem.textLength} символов`;

      const pageText =
        document.createElement(
          'pre'
        );

      pageText.textContent =
        pageItem.text;

      pageBlock.appendChild(
        pageTitle
      );

      pageBlock.appendChild(
        pageText
      );

      if (pageItem.truncated) {
        const truncatedMessage =
          document.createElement(
            'p'
          );

        truncatedMessage.className =
          'document-text-truncated';

        truncatedMessage.textContent =
          'Показаны первые 20 000 символов страницы.';

        pageBlock.appendChild(
          truncatedMessage
        );
      }

      textDetails.appendChild(
        pageBlock
      );
    });

  main.appendChild(
    textDetails
  );
}
}

      const removeButton =
        document.createElement('button');

      removeButton.type = 'button';

      removeButton.className =
        'document-remove-btn';

      removeButton.textContent =
        'Удалить';

      removeButton.dataset.documentId =
        documentItem.id;

      card.appendChild(main);
      card.appendChild(removeButton);
      list.appendChild(card);
    }
  );
}

function addProjectDocuments(fileList) {
  const allowedExtensions = [
    'pdf',
    'xlsx',
    'xls',
    'csv'
  ];

  const incomingFiles =
    Array.from(fileList || []);

  const rejectedFiles = [];

  const addedDocumentIds = [];

  incomingFiles.forEach(function (file) {
    const extension =
      getProjectDocumentExtension(file);

    if (
      !allowedExtensions.includes(
        extension
      )
    ) {
      rejectedFiles.push(file.name);
      return;
    }

    const id =
      getProjectDocumentId(file);

    const alreadyExists =
      uploadedProjectDocuments.some(
        function (documentItem) {
          return documentItem.id === id;
        }
      );

    if (!alreadyExists) {
      uploadedProjectDocuments.push({
  id,
  file,
  status: 'waiting'
});

addedDocumentIds.push(
  id
);
    }
  });

  renderProjectDocuments();

if (
  addedDocumentIds.length > 0
) {
  notifyProjectDocumentsChanged(
    'added',
    addedDocumentIds
  );
}
  
  const message =
    document.getElementById(
      'documentsMessage'
    );

  if (
    message &&
    rejectedFiles.length > 0
  ) {
    message.textContent =
      'Не добавлены неподдерживаемые файлы: ' +
      rejectedFiles.join(', ');
  }
}

function initializeProjectDocuments() {
  const input =
    document.getElementById(
      'projectDocumentsInput'
    );

  const selectButton =
    document.getElementById(
      'selectDocumentsBtn'
    );

  const clearButton =
    document.getElementById(
      'clearDocumentsBtn'
    );

  const dropZone =
    document.getElementById(
      'documentsDropZone'
    );

  const list =
    document.getElementById(
      'documentsList'
    );

  if (
    !input ||
    !selectButton ||
    !clearButton ||
    !dropZone ||
    !list
  ) {
    return;
  }

  selectButton.addEventListener(
    'click',
    function () {
      input.click();
    }
  );

  input.addEventListener(
    'change',
    function () {
      addProjectDocuments(
        input.files
      );

      input.value = '';
    }
  );

 clearButton.addEventListener(
  'click',
  function () {
    const removedDocumentIds =
      uploadedProjectDocuments.map(
        function (documentItem) {
          return documentItem.id;
        }
      );

    uploadedProjectDocuments = [];

    renderProjectDocuments();

    notifyProjectDocumentsChanged(
      'cleared',
      removedDocumentIds
    );
  }
);

  list.addEventListener(
    'click',
    function (event) {
      const removeButton =
        event.target.closest(
          '.document-remove-btn'
        );

      if (!removeButton) {
        return;
      }

      const documentId =
        removeButton.dataset.documentId;

      uploadedProjectDocuments =
  uploadedProjectDocuments.filter(
    function (documentItem) {
      return (
        documentItem.id !==
        documentId
      );
    }
  );

renderProjectDocuments();

notifyProjectDocumentsChanged(
  'removed',
  [documentId]
);
    }
  );

  dropZone.addEventListener(
    'dragover',
    function (event) {
      event.preventDefault();

      dropZone.classList.add(
        'drag-over'
      );
    }
  );

  dropZone.addEventListener(
    'dragleave',
    function () {
      dropZone.classList.remove(
        'drag-over'
      );
    }
  );

  dropZone.addEventListener(
    'drop',
    function (event) {
      event.preventDefault();

      dropZone.classList.remove(
        'drag-over'
      );

      addProjectDocuments(
        event.dataTransfer.files
      );
    }
  );

  dropZone.addEventListener(
    'keydown',
    function (event) {
      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        input.click();
      }
    }
  );

  renderProjectDocuments();
}

initializeProjectDocuments();

/* ==================================================
   ЛОКАЛЬНАЯ ДИАГНОСТИКА PDF
   ================================================== */

function getPdfTextLayerType(
  pagesWithText,
  totalPages
) {
  if (pagesWithText === 0) {
    return (
      'Вероятный скан — ' +
      'текстовый слой не обнаружен'
    );
  }

  if (pagesWithText === totalPages) {
    return (
      'Текстовый PDF — ' +
      'текстовый слой найден на всех страницах'
    );
  }

  return (
    'Смешанный PDF — ' +
    `текстовый слой найден на ` +
    `${pagesWithText} из ${totalPages} страниц`
  );
}

/* ==================================================
   КЛАССИФИКАЦИЯ ПРОЕКТНЫХ ДОКУМЕНТОВ
   ================================================== */

const PROJECT_DOCUMENT_RULES = [
  {
    id: 'schedule',
    label: 'График производства работ',
    keywords: [
      ['график производства работ', 8],
      ['календарный график', 7],
      ['календарный план', 6],
      ['гпр', 5],
      ['начало работ', 3],
      ['окончание работ', 3],
      ['продолжительность', 2],
      ['срок выполнения', 2]
    ]
  },
  {
    id: 'specification',
    label: 'Спецификация материалов и оборудования',
    keywords: [
      ['спецификация оборудования', 8],
      ['спецификация материалов', 8],
      ['наименование и техническая характеристика', 7],
      ['единица измерения', 4],
      ['ед. изм.', 4],
      ['количество', 3],
      ['масса единицы', 3],
      ['позиция', 2]
    ]
  },
  {
    id: 'work-volume',
    label: 'Ведомость объёмов работ',
    keywords: [
      ['ведомость объемов работ', 8],
      ['ведомость объёмов работ', 8],
      ['объем работ', 5],
      ['объём работ', 5],
      ['вид работ', 3],
      ['единица измерения', 3],
      ['количество', 2]
    ]
  },
  {
    id: 'cable-journal',
    label: 'Кабельный журнал',
    keywords: [
      ['кабельный журнал', 10],
      ['марка кабеля', 6],
      ['длина кабеля', 5],
      ['откуда', 3],
      ['куда', 3],
      ['обозначение кабеля', 4]
    ]
  },
 {
  id: 'explanatory-note',
  label: 'Пояснительная записка',
  keywords: [
    ['пояснительная записка', 10],
    ['общие указания', 5],
    ['исходные данные', 4],
    ['принятые решения', 4],
    ['технические решения', 3]
  ]
},
{
  id: 'commercial-proposal',
  label: 'Коммерческое предложение',
  keywords: [
    ['коммерческое предложение', 10],
    ['технико-коммерческое предложение', 10],
    ['ценовое предложение', 8],
    ['коммерческая часть', 6],
    ['стоимость предложения', 6],
    ['итого к оплате', 4]
  ]
},
{
  id: 'agreement',
  label: 'Договор / дополнительное соглашение',
  keywords: [
    ['дополнительное соглашение', 10],
    ['приложение к договору', 8],
    ['договорная ведомость', 8],
    ['предмет договора', 5],
    ['стоимость договора', 5]
  ]
},
{
  id: 'estimate',
  label: 'Сметная документация',
  keywords: [
    ['локальная смета', 9],
    ['локальный сметный расчет', 9],
    ['локальный сметный расчёт', 9],
    ['сметная стоимость', 6],
    ['ресурсная ведомость', 6],
    ['шифр расценки', 5],
    ['всего по смете', 5]
  ]
},
  {
    id: 'working-documents',
    label: 'Проектная / рабочая документация',
    keywords: [
      ['рабочая документация', 7],
      ['рабочий проект', 5],
      ['общие данные', 4],
      ['стадия', 2],
      ['номер листа', 3],
      ['формат', 2],
      ['лист', 1]
    ]
  }
];

function normalizeProjectDocumentText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeProjectDocumentRegExp(
  value
) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function countProjectDocumentPhrase(
  text,
  phrase
) {
  const normalizedPhrase =
    normalizeProjectDocumentText(
      phrase
    );

  if (!normalizedPhrase) {
    return 0;
  }

  const expression =
    new RegExp(
      escapeProjectDocumentRegExp(
        normalizedPhrase
      ),
      'g'
    );

  const matches =
    text.match(expression);

  return matches
    ? matches.length
    : 0;
}

function classifyProjectDocument(
  extractedPages
) {
  const pages =
    Array.isArray(extractedPages)
      ? extractedPages
      : [];

  const normalizedPages =
    pages.map(function (pageItem) {
      return {
        pageNumber:
          pageItem.pageNumber,
        text:
          normalizeProjectDocumentText(
            pageItem.text
          )
      };
    });

  const fullText =
    normalizedPages
      .map(function (pageItem) {
        return pageItem.text;
      })
      .join(' ');

  const coverText =
    normalizedPages
      .filter(function (pageItem) {
        return (
          Number(pageItem.pageNumber) <= 3
        );
      })
      .map(function (pageItem) {
        return pageItem.text;
      })
      .join(' ');

  if (!fullText) {
    return {
      id: 'unknown',
      label:
        'Тип документа пока не определён',
      confidence: 'Нет данных',
      matchedKeywords: [],
      sourcePages: []
    };
  }

  const projectCoverPattern =
    /(?:проектн[а-яё]*|рабоч[а-яё]*)\s+документац[а-яё]*|рабоч[а-яё]*\s+проект[а-яё]*|пояснительн[а-яё]*\s+записк[а-яё]*/;

  const projectCoverMatch =
    coverText.match(
      projectCoverPattern
    );

  if (projectCoverMatch) {
    const sourcePages =
      normalizedPages
        .filter(function (pageItem) {
          return (
            Number(pageItem.pageNumber) <= 3 &&
            projectCoverPattern.test(
              pageItem.text
            )
          );
        })
        .map(function (pageItem) {
          return pageItem.pageNumber;
        });

    return {
      id: 'working-documents',
      label:
        'Проектная / рабочая документация',
      confidence: 'Высокая',
      matchedKeywords: [
        projectCoverMatch[0]
      ],
      sourcePages
    };
  }

  const classificationResults =
    PROJECT_DOCUMENT_RULES.map(
      function (rule) {
        let score = 0;

        const matchedKeywords = [];

        rule.keywords.forEach(
          function (keywordRule) {
            const keyword =
              keywordRule[0];

            const weight =
              keywordRule[1];

            const occurrences =
              countProjectDocumentPhrase(
                fullText,
                keyword
              );

            if (occurrences > 0) {
              score +=
                occurrences * weight;

              matchedKeywords.push(
                keyword
              );
            }
          }
        );

        const sourcePages =
          normalizedPages
            .filter(function (pageItem) {
              return matchedKeywords.some(
                function (keyword) {
                  return pageItem.text
                    .includes(
                      normalizeProjectDocumentText(
                        keyword
                      )
                    );
                }
              );
            })
            .map(function (pageItem) {
              return pageItem.pageNumber;
            });

        return {
          id: rule.id,
          label: rule.label,
          score,
          matchedKeywords,
          sourcePages:
            Array.from(
              new Set(sourcePages)
            )
        };
      }
    );

  classificationResults.sort(
    function (first, second) {
      return (
        second.score -
        first.score
      );
    }
  );

  const bestResult =
    classificationResults[0];

  const secondResult =
    classificationResults[1];

  if (
    !bestResult ||
    bestResult.score < 4
  ) {
    return {
      id: 'unknown',
      label:
        'Тип документа пока не определён',
      confidence: 'Низкая',
      matchedKeywords: [],
      sourcePages: []
    };
  }

  let confidence = 'Низкая';

  const secondScore =
    secondResult
      ? secondResult.score
      : 0;

  if (
    bestResult.score >= 12 &&
    bestResult.score >=
      secondScore * 1.5
  ) {
    confidence = 'Высокая';
  } else if (
    bestResult.score >= 7
  ) {
    confidence = 'Средняя';
  }

  return {
    id: bestResult.id,
    label: bestResult.label,
    confidence,
    matchedKeywords:
      bestResult.matchedKeywords
        .slice(0, 8),
    sourcePages:
      bestResult.sourcePages
        .slice(0, 12)
  };
}

/* ==================================================
   КАНДИДАТЫ НА МАТЕРИАЛЫ ИЗ PDF
   ================================================== */

function normalizeMaterialCandidateName(
  value
) {
  const cleanedValue =
    String(value || '')
      .replace(/\s+/g, ' ')
      .replace(
        /^[\d\s.,;:№\-–—]+/,
        ''
      )
      .trim();

  const words =
    cleanedValue.split(' ');

 return words
  .slice(-10)
  .join(' ')
  .replace(
    /^(позиция|поз\.?|наименование|материал|оборудование)\s+/i,
    ''
  )
  .replace(
    /\s*[-–—:;,.]+\s*$/g,
    ''
  )
  .trim();
}

function normalizeMaterialCandidateUnit(
  value
) {
  const normalized =
    String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/\.$/, '');

  const units = {
    шт: 'шт',
    штук: 'шт',
    м: 'м',
    'п.м': 'п.м.',
    'пм': 'п.м.',
    'м²': 'м²',
    'м2': 'м²',
    'м³': 'м³',
    'м3': 'м³',
    кг: 'кг',
    т: 'т',
    л: 'л',
    компл: 'компл.',
    комплект: 'компл.',
    упак: 'упак.',
    упаковка: 'упак.',
    рул: 'рул.',
    рулон: 'рул.'
  };

  return units[normalized] || normalized;
}

function isLikelyMaterialCandidatePage(
  value
) {
  const text =
    normalizeProjectDocumentText(
      value
    );

  const strongMarkers = [
    /спецификац[а-яё]*(?:\s+[а-яё]+){0,5}\s+(?:оборудован|материал|издел)/,
    /наименовани[а-яё]*\s+и\s+техническ[а-яё]*\s+характеристик/,
    /наименовани[а-яё]*\s+вида?\s+работ[а-яё]*\s+и\s+материал/
  ];

  if (
    strongMarkers.some(function (pattern) {
      return pattern.test(text);
    })
  ) {
    return true;
  }

  const tableMarkers = [
    /(^|\s)поз\.?($|\s)/,
    /ед\.?\s*изм\.*/,
    /(^|\s)кол(?:\.|ичество)($|\s)/,
    /поставщик/,
    /примечани[а-яё]*/,
    /масса\s+(?:единиц|1\s*ед)/
  ];

  const markerCount =
    tableMarkers.reduce(
      function (count, pattern) {
        return (
          count +
          (pattern.test(text) ? 1 : 0)
        );
      },
      0
    );

  return markerCount >= 3;
}

function isLikelyMaterialCandidateName(
  value
) {
  const original =
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

  const text =
    normalizeProjectDocumentText(
      original
    );

  if (
    !text ||
    text.split(' ').length > 18
  ) {
    return false;
  }

  const noisePatterns = [
    /(^|\s)(?:площадью|площадь|длиной|длина|высотой|высота|отм\.?|отметка)(?:\s|$)/,
    /для\s+\d+\s+секци/,
    /h\s*\(\s*max\s*\)/,
    /общие\s+технические\s+условия/,
    /(^|\s)(?:гост|сп|снип|ту)\s*\d/,
    /(?:поз\.?|позиция)\s+наименовани/,
    /наименовани[а-яё]*\s+ед\.?\s*изм/,
    /(?:ед\.?\s*изм|количество|примечание|страница|лист)\s*$/,
    /(?:разработал|проверил|согласовано|инв\.?\s*№|подп\.?\s*и\s*дата)/
  ];

  if (
    noisePatterns.some(function (pattern) {
      return pattern.test(text);
    })
  ) {
    return false;
  }

  const workPatterns = [
    /^(?:монтаж|демонтаж|прокладка|установка|разработка|обратная\s+засыпка|восстановление|разборка|пусконаладоч|пнр)(?:\s|$)/,
    /^устройство\s+(?:фундамент|кабельн[а-яё]*\s+канализац|дорожн|покрыт|колодц|опор|светофорн[а-яё]*\s+объект)/
  ];

  if (
    workPatterns.some(function (pattern) {
      return pattern.test(text);
    })
  ) {
    return false;
  }

  const materialSignal =
    /кабел|провод|труб|шкаф|коммутатор|светофор|контроллер|детектор|видеокамер|камер|опор|фундамент|бетон|песок|грунт|щебен|колод|муфт|клемм|автомат|выключател|разъем|короб|модул|блок|креплен|стойк|лоток|панел|трансформатор|счетчик|датчик|радиолокатор|приемник|передатчик|сервер|маршрутизатор|усилител|аккумулятор|розетк|термостат|нагревател|вентилятор|кондиционер|капсул|шпильк|анкер|болт|гайк|шайб|заземл|электрод|светильник|ламп|цемент|раствор|кирпич|сетк|арматур|сталь|гипс|утеплител|изоляц|краск|грунтовк|двер|окн|профил|кронштейн|цоколь/.test(
      text
    );

  const modelSignal =
    /[A-ZА-ЯЁ]{2,}[A-ZА-ЯЁ0-9./+\-]*\d|[A-ZА-ЯЁ]{3,}/.test(
      original
    );

  return materialSignal || modelSignal;
}

function extractMaterialCandidates(
  extractedPages
) {
  const pages =
    Array.isArray(extractedPages)
      ? extractedPages
      : [];

  const candidates = [];

  const tableRowPattern =
    /^[ \t]*(?:\d+(?:\.\d+)*[ \t]+)?([А-ЯA-ZЁ][А-Яа-яA-Za-zЁё0-9«»"'№%()\/.,:+\-–—×xХ \t]{2,160}?)[ \t]+(шт\.?|штук|п\.?[ \t]*м\.?|м²|м2|м³|м3|м|кг|т|л|компл\.?|комплект|упак\.?|упаковка|рул\.?|рулон)[ \t]+(\d+(?:[.,]\d+)?)(?=[ \t]|$|[.,;:)])/iu;

  pages.forEach(function (pageItem) {
    const pageText =
      String(pageItem.text || '');

    if (
      !isLikelyMaterialCandidatePage(
        pageText
      )
    ) {
      return;
    }

    const lines =
      pageText
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean);

    lines.forEach(function (line) {
      if (
        candidates.length >= 100
      ) {
        return;
      }

      const match =
        line.match(
          tableRowPattern
        );

      if (!match) {
        return;
      }

      const name =
        normalizeMaterialCandidateName(
          match[1]
        );

      const quantity =
        Number(
          String(match[3])
            .replace(',', '.')
        );

      const unit =
        normalizeMaterialCandidateUnit(
          match[2]
        );

      if (
        !name ||
        name.length < 3 ||
        !isLikelyMaterialCandidateName(
          name
        ) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        return;
      }

      const duplicate =
        candidates.some(
          function (candidate) {
            return (
              candidate.pageNumber ===
                pageItem.pageNumber &&
              candidate.name
                .toLowerCase() ===
                name.toLowerCase() &&
              candidate.quantity ===
                quantity &&
              candidate.unit === unit
            );
          }
        );

      if (!duplicate) {
        candidates.push({
          id:
            'material-candidate-' +
            pageItem.pageNumber +
            '-' +
            candidates.length,
          name,
          quantity,
          unit,
          pageNumber:
            pageItem.pageNumber,
          status:
  'Требует проверки',
reviewStatus:
  'pending'
        });
      }

      return;
    });
  });

  return candidates;
}

function extractProjectDocumentPageText(
  items
) {
  return (
    Array.isArray(items)
      ? items
      : []
  )
    .map(function (item) {
      const value =
        String(item?.str || '');

      return (
        value +
        (item?.hasEOL ? '\n' : ' ')
      );
    })
    .join('')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

function notifyProjectDocumentAnalysisProgress(
  documentItem,
  detail
) {
  const payload = {
    documentId:
      documentItem?.id || null,
    fileName:
      documentItem?.file?.name || '',
    stage:
      detail?.stage || 'text',
    pageNumber:
      Number(detail?.pageNumber) || 0,
    totalPages:
      Number(detail?.totalPages) || 0,
    progress:
      Number(detail?.progress) || 0,
    message:
      detail?.message || ''
  };

  const message =
    document.getElementById(
      'documentsMessage'
    );

  if (message && payload.message) {
    message.textContent =
      payload.message;
  }

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:pdf-analysis-progress',
      {
        detail: payload
      }
    )
  );
}

function getProjectDocumentCompositeClassification(
  compositeAnalysis,
  fallbackClassification
) {
  const sections =
    Array.isArray(
      compositeAnalysis?.meaningfulSections
    )
      ? compositeAnalysis.meaningfulSections
      : [];

  if (sections.length === 0) {
    return fallbackClassification;
  }

  if (compositeAnalysis.isComposite) {
    return {
      id: 'composite',
      label:
        'Составной PDF / комплект документов',
      confidence: 'Высокая',
      matchedKeywords:
        sections
          .map(function (section) {
            return section.label;
          })
          .slice(0, 8),
      sourcePages:
        sections
          .flatMap(function (section) {
            return section.anchorPages || [];
          })
          .slice(0, 20)
    };
  }

  const section = sections[0];

  const confidenceLabels = {
    high: 'Высокая',
    medium: 'Средняя',
    low: 'Низкая'
  };

  return {
    id: section.kind,
    label: section.label,
    confidence:
      confidenceLabels[section.confidence] ||
      'Низкая',
    matchedKeywords:
      section.evidence || [],
    sourcePages:
      section.anchorPages || []
  };
}

async function inspectPdfDocument(
  documentItem
) {
  let pdfDocument = null;
  let ocrSession = null;

  try {
    const fileBuffer =
      await documentItem.file.arrayBuffer();

    const loadingTask =
      window.pdfjsLib.getDocument({
        data: new Uint8Array(fileBuffer)
      });

    pdfDocument =
      await loadingTask.promise;

    let pagesWithText = 0;
    let nativePagesWithText = 0;
    let ocrUnavailableReason = '';

    const extractedPages = [];
    const pageAnalyses = [];
    const ocrAttemptedPages = [];
    const ocrPages = [];
    const ocrFailedPages = [];

    for (
      let pageNumber = 1;
      pageNumber <= pdfDocument.numPages;
      pageNumber += 1
    ) {
      const page =
        await pdfDocument.getPage(
          pageNumber
        );

      const textContent =
        await page.getTextContent();

      const extractedText =
        extractProjectDocumentPageText(
          textContent.items
        );

      const nativeMeaningfulLength =
        window.BuildMindPdfOcr &&
        typeof window
          .BuildMindPdfOcr
          .meaningfulTextLength ===
          'function'
          ? window
              .BuildMindPdfOcr
              .meaningfulTextLength(
                extractedText
              )
          : extractedText.replace(
              /\s+/g,
              ''
            ).length;

      if (nativeMeaningfulLength >= 20) {
        nativePagesWithText += 1;
      }

      let pageText =
        extractedText;
      let extractionMethod =
        nativeMeaningfulLength >= 20
          ? 'text'
          : 'none';
      let ocrConfidence = null;

      const shouldRunOcr =
        window.BuildMindPdfOcr &&
        typeof window
          .BuildMindPdfOcr
          .shouldRecognize ===
          'function' &&
        window
          .BuildMindPdfOcr
          .shouldRecognize(
            extractedText
          );

      if (shouldRunOcr) {
        ocrAttemptedPages.push(
          pageNumber
        );

        if (ocrUnavailableReason) {
          if (nativeMeaningfulLength < 20) {
            ocrFailedPages.push(
              pageNumber
            );
          }
        } else {
          try {
          if (
            !window.BuildMindPdfOcr
              .isAvailable()
          ) {
            throw new Error(
              'OCR-библиотека не загрузилась.'
            );
          }

          if (!ocrSession) {
            notifyProjectDocumentAnalysisProgress(
              documentItem,
              {
                stage: 'ocr-loading',
                pageNumber,
                totalPages:
                  pdfDocument.numPages,
                message:
                  'Подключается локальное OCR для страниц без текста…'
              }
            );

            ocrSession =
              await window
                .BuildMindPdfOcr
                .createSession();
          }

          const recognition =
            await ocrSession
              .recognizePage(
                page,
                pageNumber,
                {
                  onProgress(
                    progress
                  ) {
                    const percent =
                      Math.round(
                        (
                          Number(
                            progress
                              ?.progress
                          ) || 0
                        ) * 100
                      );

                    notifyProjectDocumentAnalysisProgress(
                      documentItem,
                      {
                        stage: 'ocr',
                        pageNumber,
                        totalPages:
                          pdfDocument.numPages,
                        progress:
                          percent,
                        message:
                          `OCR: страница ${pageNumber} ` +
                          `из ${pdfDocument.numPages} · ` +
                          `${percent}%`
                      }
                    );
                  }
                }
              );

          if (
            recognition
              .meaningfulTextLength >= 20
          ) {
            pageText =
              recognition.text;
            extractionMethod =
              'ocr';
            ocrConfidence =
              recognition.confidence;
            ocrPages.push(
              pageNumber
            );
          } else {
            if (nativeMeaningfulLength < 20) {
              ocrFailedPages.push(
                pageNumber
              );
            }
          }
          } catch (ocrError) {
            console.warn(
              `OCR страницы ${pageNumber} не выполнен:`,
              ocrError
            );

            ocrUnavailableReason =
              ocrUnavailableReason ||
              String(
                ocrError?.message ||
                'OCR недоступен.'
              );

            if (nativeMeaningfulLength < 20) {
              ocrFailedPages.push(
                pageNumber
              );
            }
          }
        }
      }

      const meaningfulTextLength =
        window.BuildMindPdfOcr &&
        typeof window
          .BuildMindPdfOcr
          .meaningfulTextLength ===
          'function'
          ? window
              .BuildMindPdfOcr
              .meaningfulTextLength(
                pageText
              )
          : pageText.replace(
              /\s+/g,
              ''
            ).length;

      const pageResult = {
        pageNumber,
        textLength:
          pageText.length,
        text:
          pageText.slice(
            0,
            30000
          ),
        truncated:
          pageText.length > 30000,
        extractionMethod,
        nativeTextLength:
          extractedText.length,
        ocrConfidence
      };

      pageAnalyses.push(
        pageResult
      );

      if (meaningfulTextLength >= 20) {
        pagesWithText += 1;
        extractedPages.push(
          pageResult
        );
      }

      notifyProjectDocumentAnalysisProgress(
        documentItem,
        {
          stage: 'page-complete',
          pageNumber,
          totalPages:
            pdfDocument.numPages,
          message:
            `Прочитано страниц: ${pageNumber} ` +
            `из ${pdfDocument.numPages}`
        }
      );

      page.cleanup();
    }

    const fallbackClassification =
      classifyProjectDocument(
        extractedPages
      );

    const compositeAnalysis =
      window.BuildMindCompositePdf &&
      typeof window
        .BuildMindCompositePdf
        .analyzePages === 'function'
        ? window
            .BuildMindCompositePdf
            .analyzePages(
              pageAnalyses,
              {
                analysisDate:
                  document
                    .getElementById(
                      'todayDate'
                    )
                    ?.value ||
                  new Date()
                    .toISOString()
                    .slice(0, 10)
              }
            )
        : null;

    const documentClassification =
      getProjectDocumentCompositeClassification(
        compositeAnalysis,
        fallbackClassification
      );

    const materialCandidates =
  extractMaterialCandidates(
    extractedPages
  ).map(function (candidate) {
    return applySavedMaterialCandidateReview(
      documentItem,
      candidate
    );
  });
    
    const nativePdfType =
      getPdfTextLayerType(
        nativePagesWithText,
        pdfDocument.numPages
      );

    return {
      success: true,
      fileName:
        documentItem.file.name,
      totalPages:
        pdfDocument.numPages,
      pagesWithText,
      nativePagesWithText,
      extractedPages,
      pageAnalyses,
      documentClassification,
      materialCandidates,
      compositeAnalysis,
      ocrAttemptedPages,
      ocrPages,
      ocrFailedPages:
        Array.from(
          new Set(ocrFailedPages)
        ),
      ocrUnavailableReason,
      nativePdfType,
      pdfType:
        ocrPages.length > 0
          ? `${nativePdfType}. ` +
            `OCR восстановил текст на ` +
            `${ocrPages.length} стр.`
          : nativePdfType
    };
    
  } catch (error) {
    console.error(
      'Ошибка диагностики PDF:',
      error
    );

    let errorMessage =
      'Не удалось открыть или проверить PDF.';

    if (
      error &&
      error.name === 'PasswordException'
    ) {
      errorMessage =
        'PDF защищён паролем.';
    }

    return {
      success: false,
      fileName: documentItem.file.name,
      errorMessage
    };
  } finally {
    if (
      ocrSession &&
      typeof ocrSession.terminate ===
        'function'
    ) {
      await ocrSession.terminate();
    }

    if (
      pdfDocument &&
      typeof pdfDocument.destroy ===
        'function'
    ) {
      await pdfDocument.destroy();
    }
  }
}

async function analyzeSelectedPdfDocuments() {
  const message =
    document.getElementById(
      'documentsMessage'
    );

  const analyzeButton =
    document.getElementById(
      'analyzePdfBtn'
    );

  if (!message || !analyzeButton) {
    return;
  }

  const pdfDocuments =
    uploadedProjectDocuments.filter(
      function (documentItem) {
        return (
          getProjectDocumentExtension(
            documentItem.file
          ) === 'pdf'
        );
      }
    );

  if (pdfDocuments.length === 0) {
    message.textContent =
      'Сначала выберите хотя бы один PDF-файл.';

    return;
  }

  if (!window.pdfjsLib) {
    message.textContent =
      'Библиотека PDF ещё загружается. ' +
      'Проверьте подключение к интернету ' +
      'и повторите через несколько секунд.';

    return;
  }

  analyzeButton.disabled = true;

  analyzeButton.textContent =
    'Анализ PDF...';

  message.textContent =
    `Начинается проверка: ` +
    `${getDocumentsCountText(
      pdfDocuments.length
    )}.`;

  const results = [];

  for (
    let index = 0;
    index < pdfDocuments.length;
    index += 1
  ) {
    const documentItem =
      pdfDocuments[index];
    
documentItem.status =
  'analyzing';

documentItem.analysis = null;

renderProjectDocuments();
    
    message.textContent =
      `Проверяется ${index + 1} из ` +
      `${pdfDocuments.length}:\n` +
      documentItem.file.name;

    const result =
  await inspectPdfDocument(
    documentItem
  );

documentItem.analysis =
  result;

documentItem.status =
  result.success
    ? 'analyzed'
    : 'error';

results.push(result);

renderProjectDocuments();
  }

  const resultLines =
    results.map(function (result) {
      if (!result.success) {
        return (
          `✗ ${result.fileName}\n` +
          `  ${result.errorMessage}`
        );
      }

      return (
        `✓ ${result.fileName}\n` +
        `  Страниц: ${result.totalPages}\n` +
        `  ${result.pdfType}`
      );
    });

  message.textContent =
    'Анализ PDF завершён:\n\n' +
    resultLines.join('\n\n');

  analyzeButton.disabled = false;

  analyzeButton.textContent =
    'Анализировать PDF';
}

function initializePdfDiagnostics() {
  const analyzeButton =
    document.getElementById(
      'analyzePdfBtn'
    );

  if (!analyzeButton) {
    return;
  }

  analyzeButton.addEventListener(
    'click',
    analyzeSelectedPdfDocuments
  );
}

initializePdfDiagnostics();
async function analyzeProjectDocumentPdfForApi(
  documentItem
) {
  if (
    !documentItem ||
    !documentItem.file
  ) {
    return {
      success: false,

      errorMessage:
        'Файл для PDF-анализа не передан.'
    };
  }

  documentItem.status =
    'analyzing';

  documentItem.analysis =
    null;

  renderProjectDocuments();

  const result =
    await inspectPdfDocument(
      documentItem
    );

  documentItem.analysis =
    result;

  documentItem.status =
    result.success
      ? 'analyzed'
      : 'error';

  renderProjectDocuments();

  return result;
}

window.BuildMindProjectDocuments = {
  version:
    'project-documents-runtime-v1',

  getAll:
    function () {
      return uploadedProjectDocuments
        .slice();
    },

  getById:
    function (documentId) {
      return (
        uploadedProjectDocuments.find(
          function (
            documentItem
          ) {
            return (
              documentItem.id ===
              documentId
            );
          }
        ) ||
        null
      );
    },

  getExtension:
    getProjectDocumentExtension,

  chooseFiles:
    function () {
      document
        .getElementById(
          'projectDocumentsInput'
        )
        ?.click();
    },

  analyzePdfDocument:
    analyzeProjectDocumentPdfForApi,

  render:
    renderProjectDocuments
};
