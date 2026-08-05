'use strict';

/*
  ==================================================
  BUILDMIND WORK CONTEXTS — DEMO V1
  ==================================================
*/

const WORK_CONTEXTS_STORAGE_KEY =
  'buildmindWorkContexts';

const ACTIVE_CONTEXT_STORAGE_KEY =
  'buildmindActiveContextId';

const defaultWorkContexts = [
  {
    id: 'context-1',
    project: 'АСУДД 1',
    object: 'СВХ',
    work:
      'Кабельная канализация на эстакаде ДВ-4',
    startDate: '2026-07-30',
    endDate: '2026-08-15',
    safetyDays: 2
  },
  {
    id: 'context-2',
    project: 'АСУДД 1',
    object: 'ЮВХ',
    work:
      'Кабельная канализация на эстакаде В3',
    startDate: '2026-08-05',
    endDate: '2026-08-20',
    safetyDays: 2
  },
  {
    id: 'context-3',
    project: 'АСУДД 1',
    object: 'СВХ',
    work: 'Монтаж кабеля',
    startDate: '2026-08-12',
    endDate: '2026-08-25',
    safetyDays: 3
  }
];

let workContexts = [];

let activeContextId =
  localStorage.getItem(
    ACTIVE_CONTEXT_STORAGE_KEY
  ) || '';

function cloneDefaultWorkContexts() {
  return defaultWorkContexts.map(
    function (item) {
      return {
        ...item
      };
    }
  );
}

function saveWorkContexts() {
  localStorage.setItem(
    WORK_CONTEXTS_STORAGE_KEY,
    JSON.stringify(workContexts)
  );
}

function loadWorkContexts() {
  const savedContexts =
    localStorage.getItem(
      WORK_CONTEXTS_STORAGE_KEY
    );

  if (savedContexts === null) {
    workContexts =
      cloneDefaultWorkContexts();

    saveWorkContexts();
    return;
  }

  try {
    const parsedContexts =
      JSON.parse(savedContexts);

    if (
      !Array.isArray(parsedContexts)
    ) {
      throw new Error(
        'Контексты должны быть массивом.'
      );
    }

    workContexts =
      parsedContexts.map(
        function (context) {
          const defaultContext =
            defaultWorkContexts.find(
              function (item) {
                return (
                  item.id === context.id
                );
              }
            );

          return {
            ...context,

            endDate:
              context.endDate ||
              (
                defaultContext
                  ? defaultContext.endDate
                  : ''
              ),

            safetyDays:
              Number.isFinite(
                Number(
                  context.safetyDays
                )
              )
                ? Number(
                    context.safetyDays
                  )
                : 0
          };
        }
      );

    saveWorkContexts();
  } catch (error) {
    console.warn(
      'Не удалось прочитать контексты работ:',
      error
    );

    workContexts =
      cloneDefaultWorkContexts();

    saveWorkContexts();
  }
}

function setElementText(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.textContent =
      value || '—';
  }
}

function setInputValue(
  elementId,
  value
) {
  const element =
    document.getElementById(
      elementId
    );

  if (element) {
    element.value =
      value || '';
  }
}

function selectWorkContext(
  project,
  object,
  work,
  startDate,
  endDate,
  safetyDays
) {
  setElementText(
    'currentProject',
    project
  );

  setElementText(
    'currentObject',
    object
  );

  setElementText(
    'currentWork',
    work
  );

  setElementText(
    'currentStartDate',
    startDate
  );

  setElementText(
    'currentEndDate',
    endDate
  );

  const normalizedSafetyDays =
    Number.isFinite(
      Number(safetyDays)
    )
      ? Number(safetyDays)
      : 0;

  setElementText(
    'currentSafetyDays',
    `${normalizedSafetyDays} дн.`
  );

  setInputValue(
    'newProject',
    project
  );

  setInputValue(
    'newObject',
    object
  );

  setInputValue(
    'newWork',
    work
  );

  setInputValue(
    'workName',
    work
  );

  setInputValue(
    'workStartDate',
    startDate
  );

  setInputValue(
    'safetyDays',
    String(normalizedSafetyDays)
  );

  if (
    typeof window.render ===
    'function'
  ) {
    window.render();
  } else if (
    typeof render ===
    'function'
  ) {
    render();
  }
}

function clearCurrentWorkContext() {
  setElementText(
    'currentProject',
    '—'
  );

  setElementText(
    'currentObject',
    '—'
  );

  setElementText(
    'currentWork',
    '—'
  );

  setElementText(
    'currentStartDate',
    '—'
  );

  setElementText(
    'currentEndDate',
    '—'
  );

  setElementText(
    'currentSafetyDays',
    '—'
  );

  setInputValue(
    'newProject',
    ''
  );

  setInputValue(
    'newObject',
    ''
  );

  setInputValue(
    'newWork',
    ''
  );
}

function renderWorkContexts() {
  const list =
    document.getElementById(
      'contextsList'
    );

  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (workContexts.length === 0) {
    const emptyMessage =
      document.createElement('div');

    emptyMessage.className =
      'empty-contexts';

    emptyMessage.textContent =
      'Контексты пока не добавлены. ' +
      'Нажмите «+ Добавить контекст».';

    list.appendChild(
      emptyMessage
    );

    return;
  }

  workContexts.forEach(
    function (context) {
      const row =
        document.createElement('div');

      row.className =
        'context-row' +
        (
          context.id ===
          activeContextId
            ? ' active'
            : ''
        );

      const selectButton =
        document.createElement(
          'button'
        );

      selectButton.type =
        'button';

      selectButton.className =
        'context-select';

      selectButton.textContent =
        `${context.project} / ` +
        `${context.object} / ` +
        `${context.work}`;

      selectButton.addEventListener(
        'click',
        function () {
          selectWorkContextById(
            context.id
          );
        }
      );

      const deleteButton =
        document.createElement(
          'button'
        );

      deleteButton.type =
        'button';

      deleteButton.className =
        'context-delete';

      deleteButton.textContent =
        '×';

      deleteButton.title =
        'Удалить контекст';

      deleteButton.addEventListener(
        'click',
        function () {
          deleteWorkContext(
            context.id
          );
        }
      );

      row.appendChild(
        selectButton
      );

      row.appendChild(
        deleteButton
      );

      list.appendChild(row);
    }
  );
}

function selectWorkContextById(
  contextId
) {
  const selectedContext =
    workContexts.find(
      function (context) {
        return (
          context.id === contextId
        );
      }
    );

  if (!selectedContext) {
    return;
  }

  activeContextId =
    selectedContext.id;

  localStorage.setItem(
    ACTIVE_CONTEXT_STORAGE_KEY,
    activeContextId
  );

  selectWorkContext(
    selectedContext.project,
    selectedContext.object,
    selectedContext.work,
    selectedContext.startDate,
    selectedContext.endDate,
    selectedContext.safetyDays
  );

  renderWorkContexts();
}

function openContextForm() {
  const form =
    document.getElementById(
      'contextForm'
    );

  const projectNameInput =
    document.getElementById(
      'projectName'
    );

  const objectNameInput =
    document.getElementById(
      'objectName'
    );

  setInputValue(
    'contextProject',
    projectNameInput
      ? projectNameInput.value.trim()
      : ''
  );

  setInputValue(
    'contextObject',
    objectNameInput
      ? objectNameInput.value.trim()
      : ''
  );

  if (form) {
    form.classList.remove(
      'hidden'
    );
  }

  const workInput =
    document.getElementById(
      'contextWork'
    );

  if (workInput) {
    workInput.focus();
  }
}

function clearContextForm() {
  setInputValue(
    'contextProject',
    ''
  );

  setInputValue(
    'contextObject',
    ''
  );

  setInputValue(
    'contextWork',
    ''
  );

  setInputValue(
    'contextStartDate',
    ''
  );

  setInputValue(
    'contextEndDate',
    ''
  );

  setInputValue(
    'contextSafetyDays',
    '2'
  );
}

function closeContextForm() {
  const form =
    document.getElementById(
      'contextForm'
    );

  if (form) {
    form.classList.add(
      'hidden'
    );
  }

  clearContextForm();
}

function addWorkContext() {
  const projectInput =
    document.getElementById(
      'contextProject'
    );

  const objectInput =
    document.getElementById(
      'contextObject'
    );

  const workInput =
    document.getElementById(
      'contextWork'
    );

  const startDateInput =
    document.getElementById(
      'contextStartDate'
    );

  const endDateInput =
    document.getElementById(
      'contextEndDate'
    );

  const safetyDaysInput =
    document.getElementById(
      'contextSafetyDays'
    );

  const project =
    projectInput
      ? projectInput.value.trim()
      : '';

  const object =
    objectInput
      ? objectInput.value.trim()
      : '';

  const work =
    workInput
      ? workInput.value.trim()
      : '';

  const startDate =
    startDateInput
      ? startDateInput.value
      : '';

  const endDate =
    endDateInput
      ? endDateInput.value
      : '';

  const safetyDays =
    Number(
      safetyDaysInput
        ? safetyDaysInput.value
        : 0
    );

  if (
    !project ||
    !object ||
    !work ||
    !startDate ||
    !endDate
  ) {
    alert(
      'Заполните проект, объект, работу, начало и окончание работы по ГПР.'
    );

    return;
  }

  if (endDate < startDate) {
    alert(
      'Дата окончания работы не может быть раньше даты начала.'
    );

    return;
  }

  if (
    !Number.isFinite(
      safetyDays
    ) ||
    safetyDays < 0
  ) {
    alert(
      'Страховой запас должен быть числом не меньше нуля.'
    );

    return;
  }

  const duplicateContext =
    workContexts.some(
      function (context) {
        return (
          context.project
            .toLowerCase() ===
            project.toLowerCase() &&

          context.object
            .toLowerCase() ===
            object.toLowerCase() &&

          context.work
            .toLowerCase() ===
            work.toLowerCase()
        );
      }
    );

  if (duplicateContext) {
    alert(
      'Такая работа уже существует в выбранном проекте и объекте.'
    );

    return;
  }

  const newContext = {
    id:
      'context-' +
      Date.now(),

    project,
    object,
    work,
    startDate,
    endDate,
    safetyDays
  };

  workContexts.push(
    newContext
  );

  saveWorkContexts();
  closeContextForm();

  selectWorkContextById(
    newContext.id
  );
}

function deleteWorkContext(
  contextId
) {
  const contextToDelete =
    workContexts.find(
      function (context) {
        return (
          context.id ===
          contextId
        );
      }
    );

  if (!contextToDelete) {
    return;
  }

  const confirmed =
    confirm(
      'Удалить контекст?\n\n' +
      `${contextToDelete.project} / ` +
      `${contextToDelete.object} / ` +
      `${contextToDelete.work}`
    );

  if (!confirmed) {
    return;
  }

  workContexts =
    workContexts.filter(
      function (context) {
        return (
          context.id !==
          contextId
        );
      }
    );

  saveWorkContexts();

  if (
    activeContextId ===
    contextId
  ) {
    activeContextId = '';

    localStorage.removeItem(
      ACTIVE_CONTEXT_STORAGE_KEY
    );

    if (
      workContexts.length > 0
    ) {
      selectWorkContextById(
        workContexts[0].id
      );

      return;
    }

    clearCurrentWorkContext();
  }

  renderWorkContexts();
}

function initializeWorkContexts() {
  loadWorkContexts();

  if (
    workContexts.length === 0
  ) {
    clearCurrentWorkContext();
    renderWorkContexts();
    return;
  }

  const activeContextExists =
    workContexts.some(
      function (context) {
        return (
          context.id ===
          activeContextId
        );
      }
    );

  if (activeContextExists) {
    selectWorkContextById(
      activeContextId
    );
  } else {
    selectWorkContextById(
      workContexts[0].id
    );
  }
}

window.selectWorkContext =
  selectWorkContext;

window.selectWorkContextById =
  selectWorkContextById;

window.openContextForm =
  openContextForm;

window.closeContextForm =
  closeContextForm;

window.addWorkContext =
  addWorkContext;

window.deleteWorkContext =
  deleteWorkContext;

window.BuildMindWorkContexts = {
  getAll:
    function () {
      return workContexts.map(
        function (context) {
          return {
            ...context
          };
        }
      );
    },

  getActive:
    function () {
      const context =
        workContexts.find(
          function (item) {
            return (
              item.id ===
              activeContextId
            );
          }
        );

      return context
        ? {
            ...context
          }
        : null;
    },

  selectById:
    selectWorkContextById,

  refresh:
    renderWorkContexts
};

initializeWorkContexts();

console.info(
  'BuildMind Work Contexts загружен'
);
