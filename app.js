const STORAGE_KEY = 'buildmind-procurement-data-v1';

const defaultMaterials = [
  {
    project: 'АСУДД 1', object: 'СВХ', work: 'Кабельная канализация на эстакаде ДВ-4', name: 'Труба 76', responsible: 'Снабженец', unit: 'м', need: 5800, stock: 0, reserved: 3000,
    confirmed: 3000, deliveryDate: '2026-07-10', leadDays: 1
  },
  {
    project: 'АСУДД 1', object: 'СВХ', work: 'Кабельная канализация на эстакаде ДВ-4', name: 'Уголок', responsible: 'Прораб', unit: 'шт', need: 2000, stock: 0, reserved: 1500,
    confirmed: 1500, deliveryDate: '2026-07-11', leadDays: 2
  },
  {
    project: 'АСУДД 1', object: 'СВХ', work: 'Кабельная канализация на эстакаде ДВ-4', name: 'Хомуты', responsible: 'Кладовщик', unit: 'шт', need: 4500, stock: 0, reserved: 2500,
    confirmed: 2500, deliveryDate: '2026-07-10', leadDays: 1
  }
];

let materials = loadMaterials();

function loadMaterials() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [...defaultMaterials];
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
  const migratedMaterials =
    parsed.map(function (row) {
      if (
        row.work ===
        'Кабельная канализация на эстакаде В4'
      ) {
        return {
          ...row,
          work:
            'Кабельная канализация на эстакаде ДВ-4'
        };
      }

      return row;
    });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(migratedMaterials)
  );

  return migratedMaterials;
}
  } catch (error) {
    console.warn('Не удалось прочитать сохранённые данные BuildMind:', error);
  }

  return [...defaultMaterials];
}

function saveMaterials() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
}

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
        `Оформить дополнительную заявку на ` +
        `${deficit} ${row.unit}. ` +
        `Крайняя дата заказа: ` +
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
        'Ускорить поставку или найти ' +
        'резервного поставщика.'
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

function getSavedWorkContextsForControl() {
  const savedContexts =
    localStorage.getItem('buildmindWorkContexts');

  if (!savedContexts) {
    return [];
  }

  try {
    const parsedContexts =
      JSON.parse(savedContexts);

    return Array.isArray(parsedContexts)
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
      'Уточнить фактический статус у поставщика и подтвердить новую дату доставки.';
  } else if (primary === 'critical') {
    if (!needDate) {
      reason =
        'Для материала не найдена подтверждённая дата потребности.';

      recommendation =
        'Проверить привязку материала к контексту работы и графику.';
    } else if (deliveryAfterNeed) {
      reason =
        'Поставка запланирована позже даты потребности материала.';

      recommendation =
        'Ускорить поставку, найти резервный источник или проверить допустимый аналог.';
    } else {
      reason =
        `После учёта склада и подтверждённых поставок не хватает ${deficit} ${row.unit || ''}.`;

      recommendation =
        'Срочно проверить закупку и дополнительную потребность.';
    }
  } else if (primary === 'order') {
    reason =
      `Необходимо дополнительно заказать ${deficit} ${row.unit || ''}.`;

    recommendation =
      'Оформить заявку до крайней даты заказа.';
  } else if (primary === 'low-stock') {
    reason =
      'Свободный складской остаток меньше потребности работы.';

    recommendation =
      'Проверить подтверждённые поставки и доступные складские резервы.';
  } else if (primary === 'expected') {
    reason =
      'Поставка подтверждена поставщиком и ожидается.';

    recommendation =
      'Контролировать дату отгрузки и фактическое поступление.';
  } else {
    reason =
      'Свободного складского остатка достаточно для текущей потребности.';

    recommendation =
      'Поддерживать актуальность складских данных.';
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

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.project || '—'}</td>
      <td>${row.object || '—'}</td>
      <td>${row.work || '—'}</td>
      <td>${row.name}</td>
      <td>${row.responsible || '—'}</td>
      <td>${row.need}</td>
      <td>${row.unit}</td>
      <td>${row.stock}</td>
      <td>${row.reserved}</td>
      <td>${free}</td>
      <td>${row.confirmed}</td>
      <td>${row.deliveryDate || '—'}</td>
      <td>${row.leadDays}</td>
      <td>${deficit}</td>
      <td>${formatDate(needDate)}</td>
      <td>${formatDate(orderDeadline)}</td>
      <td><span class="badge ${risk.level}">${risk.text}</span></td>
      <td>${risk.action}</td>
      <td><button class="small-btn" onclick="deleteMaterial(${index})">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('criticalCount').textContent = critical;
  document.getElementById('warningCount').textContent = warning;
  document.getElementById('okCount').textContent = ok;

  renderOperationalControlCenter();
}

function addMaterial() {
  const project = document.getElementById('newProject').value.trim() || 'Без проекта';
  const object = document.getElementById('newObject').value.trim() || 'Без объекта';
  const work = document.getElementById('newWork').value.trim() || 'Без работы';
  const name = document.getElementById('newName').value.trim();
  const responsible = document.getElementById('newResponsible').value.trim() || 'Не назначен';
  const need = Number(document.getElementById('newNeed').value);
  const unit = document.getElementById('newUnit').value.trim() || 'шт';

  if (!name || !need) {
    alert('Введите материал и нужное количество.');
    return;
  }

  materials.push({
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
    deliveryDate: document.getElementById('newDelivery').value,
    leadDays: Number(document.getElementById('newLead').value || 1)
  });

  saveMaterials();
  clearAddForm();
  render();
}

function deleteMaterial(index) {
  materials.splice(index, 1);
  saveMaterials();
  render();
}

function clearAddForm() {
  document.getElementById('newName').value = '';
  document.getElementById('newResponsible').value = '';
  document.getElementById('newNeed').value = '';
  document.getElementById('newUnit').value = '';
  document.getElementById('newStock').value = '0';
  document.getElementById('newReserved').value = '0';
  document.getElementById('newConfirmed').value = '0';
  document.getElementById('newDelivery').value = '';
  document.getElementById('newLead').value = '1';
}

function resetMaterials() {
  const confirmed = confirm('Сбросить материалы к стартовому примеру? Все добавленные материалы будут удалены.');
  if (!confirmed) return;

  materials = [...defaultMaterials];
  saveMaterials();
  render();
}

function exportJson() {
  const data = {
    project: document.getElementById('projectName').value,
    object: document.getElementById('objectName').value,
    work: document.getElementById('workName').value,
    workStartDate: document.getElementById('workStartDate').value,
    safetyDays: Number(document.getElementById('safetyDays').value || 0),
    materials
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

initializeOperationalControlCenter();
render();
function calculateAssistantRow(material) {
  const need = Number(material.need) || 0;
  const stock = Number(material.stock) || 0;
  const reserved = Number(material.reserved) || 0;
  const confirmed = Number(material.confirmed) || 0;

  const free = Math.max(0, stock - reserved);
  const available = free + confirmed;
  const deficit = Math.max(0, need - available);

  return {
    ...material,
    need,
    stock,
    reserved,
    confirmed,
    free,
    available,
    deficit
  };
}

function runBuildMindAssistant() {
  const input = document.getElementById('assistantInput');
  const answer = document.getElementById('assistantAnswer');

  if (!input || !answer) {
    alert('Командное окно не найдено на странице.');
    return;
  }

  const command = input.value.trim().toLowerCase();

  if (!command) {
    answer.textContent = 'Введите команду для BuildMind.';
    return;
  }

  const calculatedMaterials = materials.map(calculateAssistantRow);

  if (
    command.includes('дефицит') ||
    command.includes('не хватает') ||
    command.includes('риск')
  ) {
    const deficitMaterials = calculatedMaterials.filter(item => item.deficit > 0);

    if (deficitMaterials.length === 0) {
      answer.textContent = 'Материалов с дефицитом не найдено.';
      return;
    }

    const lines = deficitMaterials.map(item => {
      return `- ${item.name}: дефицит ${item.deficit} ${item.unit}, ответственный: ${item.responsible || 'не назначен'}`;
    });

    answer.textContent =
      'Материалы с дефицитом:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('все материалы') ||
    command.includes('покажи материалы') ||
    command.includes('список материалов')
  ) {
    const lines = calculatedMaterials.map(item => {
      return `- ${item.name}: нужно ${item.need} ${item.unit}, доступно ${item.available} ${item.unit}, дефицит ${item.deficit} ${item.unit}`;
    });

    answer.textContent =
      'Список материалов:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('ответственный') ||
    command.includes('кто отвечает') ||
    command.includes('ответственные')
  ) {
    const lines = calculatedMaterials.map(item => {
      return `- ${item.name}: ${item.responsible || 'ответственный не назначен'}`;
    });

    answer.textContent =
      'Ответственные по материалам:\n\n' +
      lines.join('\n');

    return;
  }

  if (
    command.includes('помощь') ||
    command.includes('что умеешь') ||
    command.includes('команды')
  ) {
    answer.textContent =
      'Я пока понимаю простые команды:\n\n' +
      '1. Покажи материалы с дефицитом\n' +
      '2. Покажи все материалы\n' +
      '3. Кто ответственный\n' +
      '4. Помощь\n\n' +
      'Позже я буду понимать проекты, объекты, работы и периоды.';
    return;
  }

  answer.textContent =
    'Я пока не понял команду.\n\n' +
    'Попробуйте написать:\n' +
    '- Покажи материалы с дефицитом\n' +
    '- Покажи все материалы\n' +
    '- Кто ответственный\n' +
    '- Помощь';
}

function clearBuildMindAssistant() {
  const answer = document.getElementById('assistantAnswer');
  const input = document.getElementById('assistantInput');

  if (answer) {
    answer.textContent = 'Здесь появится ответ BuildMind.';
  }

  if (input) {
    input.value = '';
  }
}

window.runBuildMindAssistant = runBuildMindAssistant;
window.clearBuildMindAssistant = clearBuildMindAssistant;
/* ==================================================
   ПРОЕКТНЫЕ ДОКУМЕНТЫ И ГПР
   ================================================== */

let uploadedProjectDocuments = [];

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
    'Проверяется';

  status.classList.add(
    'document-status-analyzing'
  );
} else if (
  documentItem.status ===
  'analyzed'
) {
  status.textContent =
    'Проверен';

  status.classList.add(
    'document-status-analyzed'
  );
} else if (
  documentItem.status ===
  'error'
) {
  status.textContent =
    'Ошибка проверки';

  status.classList.add(
    'document-status-error'
  );
} else {
  status.textContent =
    'Ожидает анализа';
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

const confirmedCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate.reviewStatus ===
        'confirmed'
      );
    }
  ).length;

const rejectedCandidates =
  candidates.filter(
    function (candidate) {
      return (
        candidate.reviewStatus ===
        'rejected'
      );
    }
  ).length;

candidatesTitle.textContent =
  `Кандидаты: ${candidates.length} · ` +
  `подтверждено: ${confirmedCandidates} · ` +
  `отклонено: ${rejectedCandidates}`;

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
  'confirmed';

confirmCandidateButton.addEventListener(
  'click',
  function () {
    candidate.reviewStatus =
      'confirmed';

    candidate.status =
      'Подтверждено инженером';

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
  'rejected';

rejectCandidateButton.addEventListener(
  'click',
  function () {
    candidate.reviewStatus =
      'rejected';

    candidate.status =
      'Отклонено инженером';

    renderProjectDocuments();
  }
);

candidateActions.appendChild(
  confirmCandidateButton
);

candidateActions.appendChild(
  rejectCandidateButton
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
    }
  });

  renderProjectDocuments();

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
      uploadedProjectDocuments = [];
      renderProjectDocuments();
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
    label: 'Комплект рабочей документации',
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

function extractMaterialCandidates(
  extractedPages
) {
  const pages =
    Array.isArray(extractedPages)
      ? extractedPages
      : [];

  const candidates = [];

  const materialPattern =
    /([А-ЯA-ZЁ][А-Яа-яA-Za-zЁё0-9«»"'()\/.,+\-–—×xХ\s]{2,120}?)\s+(\d+(?:[.,]\d+)?)\s*(шт\.?|штук|п\.?\s*м\.?|м²|м2|м³|м3|м|кг|т|л|компл\.?|комплект|упак\.?|упаковка|рулон)(?=\s|$|[.,;:)])/giu;

  pages.forEach(function (pageItem) {
    const pageText =
      String(pageItem.text || '');

    let match = null;

    while (
      (
        match =
          materialPattern.exec(
            pageText
          )
      ) !== null
    ) {
      const name =
        normalizeMaterialCandidateName(
          match[1]
        );

      const quantity =
        Number(
          String(match[2])
            .replace(',', '.')
        );

      const unit =
        normalizeMaterialCandidateUnit(
          match[3]
        );

      if (
        !name ||
        name.length < 3 ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        continue;
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

      if (candidates.length >= 100) {
        return;
      }
    }
  });

  return candidates;
}

async function inspectPdfDocument(
  documentItem
) {
  let pdfDocument = null;

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

const extractedPages = [];

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
        textContent.items
          .map(function (item) {
            return item.str || '';
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

      const meaningfulTextLength =
        extractedText.replace(
          /\s+/g,
          ''
        ).length;

if (meaningfulTextLength >= 20) {
  pagesWithText += 1;

  extractedPages.push({
    pageNumber,
    textLength:
      extractedText.length,
    text:
      extractedText.slice(
        0,
        20000
      ),
    truncated:
      extractedText.length > 20000
  });
}

      page.cleanup();
    }

const documentClassification =
  classifyProjectDocument(
    extractedPages
  );

    const materialCandidates =
  extractMaterialCandidates(
    extractedPages
  );
    
    return {
  success: true,
  fileName:
    documentItem.file.name,
  totalPages:
    pdfDocument.numPages,
 pagesWithText,
extractedPages,
documentClassification,
materialCandidates,
pdfType:
    getPdfTextLayerType(
      pagesWithText,
      pdfDocument.numPages
    )
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
    'Проверка PDF...';

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
    'Диагностика PDF завершена:\n\n' +
    resultLines.join('\n\n');

  analyzeButton.disabled = false;

  analyzeButton.textContent =
    'Проверить PDF';
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
