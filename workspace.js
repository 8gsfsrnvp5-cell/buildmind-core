'use strict';

/* ==================================================
   BUILDMIND WORKSPACE UI — V1

   Переключает существующие модули
   между рабочими зонами,
   не меняя их ID и бизнес-логику.
   ================================================== */

const BUILDMIND_WORKSPACE_VERSION =
  'workspace-ui-v1';

const BUILDMIND_WORKSPACE_STORAGE_KEY =
  'buildmind-workspace-active-view-v1';


const BUILDMIND_WORKSPACE_VIEWS = [
  {
    id: 'dashboard',
    label: 'Главная'
  },

  {
    id: 'documents',
    label: 'Документы'
  },

  {
    id: 'works',
    label: 'Работы и ГПР'
  },

  {
    id: 'materials',
    label: 'Материалы'
  },

  {
    id: 'changes',
    label: 'Изменения'
  },

  {
    id: 'history',
    label: 'История'
  },

  {
    id: 'project',
    label: 'Проект'
  }
];


function escapeWorkspaceHtml(value) {
  const symbols = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    function (symbol) {
      return symbols[symbol];
    }
  );
}


function getWorkspaceElement(id) {
  return document.getElementById(
    id
  );
}


function getWorkspaceText(
  id,
  fallback = '0'
) {
  const element =
    getWorkspaceElement(id);

  const value =
    element
      ? element.textContent.trim()
      : '';

  return value || fallback;
}


function createWorkspaceView(id) {
  const view =
    document.createElement(
      'section'
    );

  view.id =
    `workspaceView-${id}`;

  view.className =
    'workspace-view';

  view.dataset.workspaceView =
    id;

  view.hidden =
    true;

  return view;
}


function createWorkspacePageHeader(
  title,
  description
) {
  const section =
    document.createElement(
      'section'
    );

  section.className =
    'card workspace-page-header';

  section.innerHTML = `
    <div>
      <span class="workspace-page-eyebrow">
        BUILDMIND WORKSPACE
      </span>

      <h2>
        ${escapeWorkspaceHtml(title)}
      </h2>

      <p class="muted">
        ${escapeWorkspaceHtml(description)}
      </p>
    </div>
  `;

  return section;
}


function createWorkspacePlaceholder(
  title,
  text
) {
  const section =
    document.createElement(
      'section'
    );

  section.className =
    'card workspace-placeholder-card';

  section.innerHTML = `
    <h2>
      ${escapeWorkspaceHtml(title)}
    </h2>

    <p>
      ${escapeWorkspaceHtml(text)}
    </p>

    <div class="workspace-placeholder-note">
      Модуль будет подключён поверх уже
      сохранённой истории проекта без
      перезаписи предыдущих данных.
    </div>
  `;

  return section;
}


function createWorkspaceNavigation() {
  const topbar =
    document.querySelector(
      '.topbar'
    );

  if (
    !topbar ||
    getWorkspaceElement(
      'buildMindWorkspaceNav'
    )
  ) {
    return null;
  }


  const nav =
    document.createElement(
      'nav'
    );

  nav.id =
    'buildMindWorkspaceNav';

  nav.className =
    'workspace-nav';

  nav.setAttribute(
    'aria-label',
    'Разделы BuildMind'
  );


  nav.innerHTML = `
    <div class="workspace-nav-inner">

      ${
        BUILDMIND_WORKSPACE_VIEWS
          .map(
            function (view) {
              return `
                <button
                  type="button"
                  class="workspace-nav-button"
                  data-workspace-target="${escapeWorkspaceHtml(
                    view.id
                  )}"
                >
                  ${escapeWorkspaceHtml(
                    view.label
                  )}
                </button>
              `;
            }
          )
          .join('')
      }

    </div>
  `;


  topbar.insertAdjacentElement(
    'afterend',
    nav
  );

  return nav;
}


function createDashboardProjectCard() {
  const section =
    document.createElement(
      'section'
    );

  section.id =
    'workspaceDashboardProject';

  section.className =
    'card workspace-dashboard-project';


  section.innerHTML = `
    <div class="workspace-dashboard-project-main">

      <div>
        <span class="workspace-page-eyebrow">
          ТЕКУЩИЙ ПРОЕКТ
        </span>

        <h2 id="workspaceDashboardProjectName">
          Проект не выбран
        </h2>

        <p
          id="workspaceDashboardProjectObject"
          class="muted"
        >
          Объект: —
        </p>
      </div>


      <div class="workspace-dashboard-active-node">
        <span>
          Активный пакет
        </span>

        <strong id="workspaceDashboardActiveNode">
          —
        </strong>
      </div>

    </div>


    <div class="workspace-quick-actions">

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="project"
      >
        Проект
      </button>

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="documents"
      >
        Документы
      </button>

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="materials"
      >
        Материалы
      </button>

      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="works"
      >
        Работы и ГПР
      </button>

    </div>
  `;

  return section;
}


function createDashboardOverview() {
  const section =
    document.createElement(
      'section'
    );

  section.className =
    'workspace-dashboard-overview';


  section.innerHTML = `
    <article class="card workspace-mini-card">

      <div class="workspace-mini-card-head">
        <div>
          <span class="workspace-mini-label">
            ТЕКУЩАЯ РАБОТА
          </span>

          <h3 id="workspaceCurrentWork">
            —
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="works"
        >
          Открыть
        </button>
      </div>


      <dl class="workspace-mini-list">

        <div>
          <dt>Проект</dt>
          <dd id="workspaceCurrentProject">—</dd>
        </div>

        <div>
          <dt>Объект</dt>
          <dd id="workspaceCurrentObject">—</dd>
        </div>

        <div>
          <dt>Начало</dt>
          <dd id="workspaceCurrentStart">—</dd>
        </div>

        <div>
          <dt>Окончание</dt>
          <dd id="workspaceCurrentEnd">—</dd>
        </div>

      </dl>

    </article>


    <article class="card workspace-mini-card">

      <div class="workspace-mini-card-head">
        <div>
          <span class="workspace-mini-label">
            ДОКУМЕНТЫ
          </span>

          <h3>
            Состояние документации
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="documents"
        >
          Открыть
        </button>
      </div>


      <div class="workspace-mini-stats">

        <div>
          <strong id="workspaceDocsTotal">0</strong>
          <span>Документов</span>
        </div>

        <div>
          <strong id="workspaceDocsCurrent">0</strong>
          <span>Действующих</span>
        </div>

        <div>
          <strong id="workspaceDocsReview">0</strong>
          <span>На проверке</span>
        </div>

      </div>

    </article>


    <article class="card workspace-mini-card">

      <div class="workspace-mini-card-head">
        <div>
          <span class="workspace-mini-label">
            МАТЕРИАЛЫ
          </span>

          <h3>
            Оперативная обеспеченность
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="materials"
        >
          Открыть
        </button>
      </div>


      <div class="workspace-mini-stats">

        <div>
          <strong id="workspaceMaterialsCritical">0</strong>
          <span>Критические</span>
        </div>

        <div>
          <strong id="workspaceMaterialsOrder">0</strong>
          <span>Заказать</span>
        </div>

        <div>
          <strong id="workspaceMaterialsExpected">0</strong>
          <span>Поставки</span>
        </div>

      </div>

    </article>
  `;

  return section;
}


function getWorkspaceAnalysisSnapshot() {
  if (
    !window.BuildMindProjectAnalysis ||
    typeof window.BuildMindProjectAnalysis.getSnapshot !==
      'function'
  ) {
    return null;
  }

  return window.BuildMindProjectAnalysis.getSnapshot();
}


function createWorkspaceAnalysisSummary() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceAnalysisSummary';
  section.className =
    'card workspace-analysis-summary';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          ПОСЛЕДНИЙ АНАЛИЗ КОМПЛЕКТА
        </span>
        <h2>Данные ВОР и ГПР</h2>
        <p id="workspaceAnalysisSavedAt" class="muted">
          Анализ ещё не выполнен
        </p>
      </div>
      <span
        id="workspaceAnalysisStatus"
        class="workspace-analysis-status workspace-analysis-status-empty"
      >
        Нет данных
      </span>
    </div>

    <div class="workspace-analysis-stats">
      <div><strong id="workspaceAnalysisDocuments">0</strong><span>Документов</span></div>
      <div><strong id="workspaceAnalysisVorRows">0</strong><span>Строк ВОР</span></div>
      <div><strong id="workspaceAnalysisGprRows">0</strong><span>Строк ГПР</span></div>
      <div><strong id="workspaceAnalysisMatched">0</strong><span>Связано ВОР ↔ ГПР</span></div>
      <div><strong id="workspaceAnalysisReview">0</strong><span>Требует проверки</span></div>
    </div>

    <div class="workspace-analysis-actions">
      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="works"
      >
        Открыть работы и ГПР
      </button>
      <button
        type="button"
        class="secondary-btn"
        data-workspace-open="documents"
      >
        Открыть документы
      </button>
    </div>
  `;

  return section;
}


function createWorkspaceAnalysisWorks() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceAnalysisWorks';
  section.className =
    'card workspace-analysis-table-card';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          СКВОЗНАЯ СВЕРКА
        </span>
        <h2>Ведомость работ и календарный график</h2>
        <p class="muted">
          Строки ГПР связаны с ВОР по коду и наименованию.
          Исходные значения не перезаписываются.
        </p>
      </div>
      <span id="workspaceWorksAnalysisStatus" class="workspace-analysis-status">
        Нет данных
      </span>
    </div>

    <div class="workspace-analysis-stats workspace-analysis-stats-compact">
      <div><strong id="workspaceWorksVorCount">0</strong><span>ВОР</span></div>
      <div><strong id="workspaceWorksGprCount">0</strong><span>ГПР</span></div>
      <div><strong id="workspaceWorksMatchedCount">0</strong><span>Связано</span></div>
      <div><strong id="workspaceWorksReviewCount">0</strong><span>Проверить</span></div>
    </div>

    <div class="table-wrap workspace-analysis-table-wrap">
      <table class="workspace-analysis-table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Работа</th>
            <th>Ед.</th>
            <th>Количество ВОР</th>
            <th>Количество ГПР</th>
            <th>Начало</th>
            <th>Окончание</th>
            <th>Связь</th>
            <th>Источник</th>
          </tr>
        </thead>
        <tbody id="workspaceAnalysisWorksRows">
          <tr><td colspan="9">Анализ комплекта ещё не выполнен.</td></tr>
        </tbody>
      </table>
    </div>
  `;

  return section;
}


function createWorkspaceAnalysisMaterials() {
  const section =
    document.createElement('section');

  section.id =
    'workspaceAnalysisMaterials';
  section.className =
    'card workspace-analysis-table-card';
  section.innerHTML = `
    <div class="workspace-analysis-head">
      <div>
        <span class="workspace-page-eyebrow">
          ИЗ ДОКУМЕНТОВ ПРОЕКТА
        </span>
        <h2>Материалы, найденные анализом</h2>
        <p class="muted">
          Кандидаты показаны отдельно от подтверждённого реестра материалов.
        </p>
      </div>
      <span id="workspaceAnalysisMaterialsCount" class="workspace-analysis-status">
        0 позиций
      </span>
    </div>

    <div class="table-wrap workspace-analysis-table-wrap">
      <table class="workspace-analysis-table">
        <thead>
          <tr>
            <th>Материал</th>
            <th>Ед.</th>
            <th>Количество</th>
            <th>Источник</th>
          </tr>
        </thead>
        <tbody id="workspaceAnalysisMaterialRows">
          <tr><td colspan="4">Материалы анализом не найдены.</td></tr>
        </tbody>
      </table>
    </div>
  `;

  return section;
}


function setWorkspaceAnalysisText(id, value) {
  const element = getWorkspaceElement(id);

  if (element) {
    element.textContent = String(value ?? '');
  }
}


function formatWorkspaceAnalysisQuantity(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value == null || value === ''
      ? '—'
      : String(value);
  }

  return number.toLocaleString('ru-RU', {
    maximumFractionDigits: 4
  });
}


function formatWorkspaceAnalysisDate(value) {
  if (!value) {
    return '—';
  }

  const isoDate = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (isoDate) {
    return [
      isoDate[3],
      isoDate[2],
      isoDate[1]
    ].join('.');
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('ru-RU');
}


function renderWorkspaceAnalysis() {
  const snapshot = getWorkspaceAnalysisSnapshot();
  const summary = snapshot?.summary || {};
  const statusLabels = {
    complete: 'Анализ завершён',
    review: 'Нужна проверка',
    blocked: 'Анализ заблокирован'
  };

  setWorkspaceAnalysisText(
    'workspaceAnalysisDocuments',
    summary.documentsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisVorRows',
    summary.workVolumeRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisGprRows',
    summary.scheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisMatched',
    summary.matchedScheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceAnalysisReview',
    summary.reviewCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksVorCount',
    summary.workVolumeRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksGprCount',
    summary.scheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksMatchedCount',
    summary.matchedScheduleRowsCount || 0
  );
  setWorkspaceAnalysisText(
    'workspaceWorksReviewCount',
    summary.reviewCount || 0
  );

  const status = getWorkspaceElement('workspaceAnalysisStatus');
  const worksStatus = getWorkspaceElement('workspaceWorksAnalysisStatus');
  const statusText = snapshot
    ? statusLabels[snapshot.qualityStatus] || 'Результат сохранён'
    : 'Нет данных';

  [status, worksStatus].filter(Boolean).forEach(function (element) {
    element.textContent = statusText;
    element.className =
      'workspace-analysis-status workspace-analysis-status-' +
      (snapshot?.qualityStatus || 'empty');
  });

  setWorkspaceAnalysisText(
    'workspaceAnalysisSavedAt',
    snapshot
      ? 'Сохранено: ' +
        new Date(snapshot.savedAt).toLocaleString('ru-RU') +
        '. Данные восстановятся после обновления страницы.'
      : 'Анализ ещё не выполнен'
  );

  const worksBody =
    getWorkspaceElement('workspaceAnalysisWorksRows');

  if (worksBody) {
    const rows = Array.isArray(snapshot?.combinedRows)
      ? snapshot.combinedRows
      : [];
    const relationLabels = {
      matched: 'ВОР ↔ ГПР',
      'schedule-only': 'Только ГПР',
      'volume-only': 'Только ВОР'
    };

    worksBody.innerHTML = rows.length === 0
      ? '<tr><td colspan="9">Анализ комплекта ещё не дал строк ВОР/ГПР.</td></tr>'
      : rows.slice(0, 500).map(function (row) {
          const sources = (row.sourceDocuments || []).join(', ') || '—';
          const pages = (row.sourcePages || []).length > 0
            ? ' · стр. ' + row.sourcePages.join(', ')
            : '';

          return `
            <tr class="${row.requiresReview ? 'workspace-analysis-row-review' : ''}">
              <td>${escapeWorkspaceHtml(row.workCode || '—')}</td>
              <td><strong>${escapeWorkspaceHtml(row.workName || '—')}</strong></td>
              <td>${escapeWorkspaceHtml(row.unit || '—')}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisQuantity(row.vorQuantity))}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisQuantity(row.gprQuantity))}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisDate(row.startDate))}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisDate(row.finishDate))}</td>
              <td>
                <span class="workspace-analysis-relation workspace-analysis-relation-${escapeWorkspaceHtml(row.status)}">
                  ${escapeWorkspaceHtml(relationLabels[row.status] || row.status)}
                </span>
                ${row.requiresReview ? '<span class="workspace-analysis-review-flag">Проверить</span>' : ''}
              </td>
              <td>${escapeWorkspaceHtml(sources + pages)}</td>
            </tr>
          `;
        }).join('');
  }

  const materialBody =
    getWorkspaceElement('workspaceAnalysisMaterialRows');
  const materials = Array.isArray(snapshot?.materials)
    ? snapshot.materials
    : [];

  setWorkspaceAnalysisText(
    'workspaceAnalysisMaterialsCount',
    materials.length + ' поз.'
  );

  if (materialBody) {
    materialBody.innerHTML = materials.length === 0
      ? '<tr><td colspan="4">Материалы анализом не найдены.</td></tr>'
      : materials.slice(0, 500).map(function (item) {
          const sources = (item.sourceDocuments || []).join(', ') || '—';

          return `
            <tr>
              <td><strong>${escapeWorkspaceHtml(item.workName || '—')}</strong></td>
              <td>${escapeWorkspaceHtml(item.unit || '—')}</td>
              <td>${escapeWorkspaceHtml(formatWorkspaceAnalysisQuantity(item.quantity))}</td>
              <td>${escapeWorkspaceHtml(sources)}</td>
            </tr>
          `;
        }).join('');
  }
}


function moveWorkspaceNode(
  node,
  target
) {
  if (
    node &&
    target
  ) {
    target.appendChild(
      node
    );
  }
}


function buildWorkspaceViews() {
  const layout =
    document.querySelector(
      'main.layout'
    );


  if (
    !layout ||
    getWorkspaceElement(
      'buildMindWorkspaceViews'
    )
  ) {
    return null;
  }


  const operationalCenter =
    getWorkspaceElement(
      'operationalControlCenter'
    );

  const projectData =
    getWorkspaceElement(
      'projectDataSection'
    );

  const projectCore =
    getWorkspaceElement(
      'projectCoreSection'
    );

const projectIntake =
  getWorkspaceElement(
    'projectIntakeSection'
  );
   
  const projectDocuments =
    getWorkspaceElement(
      'projectDocumentsSection'
    );

  const documentRegistry =
    getWorkspaceElement(
      'documentRegistrySection'
    );

  const changeSetSection =
    getWorkspaceElement(
      'changeSetSection'
    );

  const assistant =
    document.querySelector(
      '.assistant-card'
    );

  const materialsTable =
    getWorkspaceElement(
      'materialsTableSection'
    );

  const materialManagement =
    getWorkspaceElement(
      'materialManagementSection'
    );

  const materialArchive =
    getWorkspaceElement(
      'materialArchiveSection'
    );

  const materialHistory =
    getWorkspaceElement(
      'materialHistorySection'
    );

  const contextLayout =
    document.querySelector(
      '.context-layout'
    );


  const host =
    document.createElement(
      'div'
    );

  host.id =
    'buildMindWorkspaceViews';

  host.className =
    'workspace-views';

  layout.appendChild(
    host
  );


  const views = {};


  BUILDMIND_WORKSPACE_VIEWS
    .forEach(
      function (
        viewDefinition
      ) {
        const view =
          createWorkspaceView(
            viewDefinition.id
          );

        views[
          viewDefinition.id
        ] = view;

        host.appendChild(
          view
        );
      }
    );


  /*
    ==================================================
    ГЛАВНАЯ
    ==================================================
  */

  views.dashboard.appendChild(
    createDashboardProjectCard()
  );

  views.dashboard.appendChild(
    createWorkspaceAnalysisSummary()
  );

  moveWorkspaceNode(
    operationalCenter,
    views.dashboard
  );

  views.dashboard.appendChild(
    createDashboardOverview()
  );

  moveWorkspaceNode(
    assistant,
    views.dashboard
  );


  /*
    ==================================================
    ДОКУМЕНТЫ
    ==================================================
  */

  views.documents.appendChild(
    createWorkspacePageHeader(
      'Документы проекта',

      'Загрузка файлов, действующие редакции, ' +
      'новые версии и история документации проекта.'
    )
  );

moveWorkspaceNode(
  projectIntake,
  views.documents
);
   
  moveWorkspaceNode(
    projectDocuments,
    views.documents
  );

  moveWorkspaceNode(
    documentRegistry,
    views.documents
  );


  /*
    ==================================================
    РАБОТЫ И ГПР
    ==================================================
  */

  views.works.appendChild(
    createWorkspacePageHeader(
      'Работы и ГПР',

      'Рабочие контексты, объёмы, сроки ' +
      'и будущий план-факт по графику производства работ.'
    )
  );

  moveWorkspaceNode(
    contextLayout,
    views.works
  );

  views.works.appendChild(
    createWorkspaceAnalysisWorks()
  );


  /*
    ==================================================
    МАТЕРИАЛЫ
    ==================================================
  */

  views.materials.appendChild(
    createWorkspacePageHeader(
      'Материалы',

      'Полный реестр потребности, остатков, ' +
      'резервов, поставок, дефицита и риска по материалам.'
    )
  );

  views.materials.appendChild(
    createWorkspaceAnalysisMaterials()
  );

  moveWorkspaceNode(
    materialsTable,
    views.materials
  );

  moveWorkspaceNode(
    materialManagement,
    views.materials
  );

  moveWorkspaceNode(
    materialArchive,
    views.materials
  );


  /*
    ==================================================
    ИЗМЕНЕНИЯ
    ==================================================
  */

  views.changes.appendChild(
    createWorkspacePageHeader(
      'Изменения проекта',

      'Новые редакции, дополнительные ВОР, ' +
      'изменения ГПР и влияние изменений ' +
      'на работы, сроки и ресурсы.'
    )
  );

  moveWorkspaceNode(
    changeSetSection,
    views.changes
  );

  if (!changeSetSection) {
    views.changes.appendChild(
      createWorkspacePlaceholder(
        'Изменений пока нет',

        'Зарегистрируйте новую редакцию документа, ' +
        'чтобы сравнить работы, объёмы, материалы и даты.'
      )
    );
  }


  /*
    ==================================================
    ИСТОРИЯ
    ==================================================
  */

  views.history.appendChild(
    createWorkspacePageHeader(
      'История проекта',

      'Хронология редакций, утверждений, ' +
      'дополнительных соглашений и будущих ' +
      'фактических событий проекта.'
    )
  );

  moveWorkspaceNode(
    materialHistory,
    views.history
  );

  if (!materialHistory) {
    views.history.appendChild(
      createWorkspacePlaceholder(
        'Хронология будет формироваться автоматически',

        'История будет сохранять редакцию 1 → редакцию 2 → редакцию 3, ' +
        'пакеты изменений, утверждения и изменения ' +
        'без удаления прошлого.'
      )
    );
  }


  /*
    ==================================================
    ПРОЕКТ
    ==================================================
  */

  views.project.appendChild(
    createWorkspacePageHeader(
      'Проект',

      'Паспорт проекта, основные даты, договор ' +
      'и связанные проекты / пакеты.'
    )
  );

  moveWorkspaceNode(
    projectData,
    views.project
  );

  moveWorkspaceNode(
    projectCore,
    views.project
  );


  return views;
}


function updateWorkspaceDashboard() {
  let root =
    null;

  let activeNode =
    null;


  if (
    window.BuildMindProjectCore &&
    typeof window
      .BuildMindProjectCore
      .getRoot ===
      'function'
  ) {
    root =
      window.BuildMindProjectCore
        .getRoot();
  }


  if (
    window.BuildMindProjectCore &&
    typeof window
      .BuildMindProjectCore
      .getActiveNode ===
      'function'
  ) {
    activeNode =
      window.BuildMindProjectCore
        .getActiveNode();
  }


  const projectName =
    root?.name ||
    getWorkspaceElement(
      'projectName'
    )?.value ||
    'Проект не выбран';


  const objectName =
    root?.object ||
    getWorkspaceElement(
      'objectName'
    )?.value ||
    '—';


  const activeLabel =
    activeNode
      ? [
          activeNode.code,
          activeNode.name
        ]
          .filter(Boolean)
          .join(' · ')
      : '—';


  const projectNameElement =
    getWorkspaceElement(
      'workspaceDashboardProjectName'
    );

  const objectElement =
    getWorkspaceElement(
      'workspaceDashboardProjectObject'
    );

  const activeElement =
    getWorkspaceElement(
      'workspaceDashboardActiveNode'
    );


  if (projectNameElement) {
    projectNameElement.textContent =
      projectName;
  }


  if (objectElement) {
    objectElement.textContent =
      `Объект: ${objectName}`;
  }


  if (activeElement) {
    activeElement.textContent =
      activeLabel;
  }


  const mirrorPairs = [
    [
      'currentProject',
      'workspaceCurrentProject'
    ],

    [
      'currentObject',
      'workspaceCurrentObject'
    ],

    [
      'currentWork',
      'workspaceCurrentWork'
    ],

    [
      'currentStartDate',
      'workspaceCurrentStart'
    ],

    [
      'currentEndDate',
      'workspaceCurrentEnd'
    ]
  ];


  mirrorPairs.forEach(
    function (
      [
        sourceId,
        targetId
      ]
    ) {
      const source =
        getWorkspaceElement(
          sourceId
        );

      const target =
        getWorkspaceElement(
          targetId
        );

      if (target) {
        target.textContent =
          source
            ?.textContent
            ?.trim() ||
          '—';
      }
    }
  );


  const registryDocuments =
    getWorkspaceText(
      'documentRegistryDocumentsCount'
    );

  const registryCurrent =
    getWorkspaceText(
      'documentRegistryCurrentCount'
    );

  const registryReview =
    getWorkspaceText(
      'documentRegistryReviewCount'
    );


  const docsTotal =
    getWorkspaceElement(
      'workspaceDocsTotal'
    );

  const docsCurrent =
    getWorkspaceElement(
      'workspaceDocsCurrent'
    );

  const docsReview =
    getWorkspaceElement(
      'workspaceDocsReview'
    );


  if (docsTotal) {
    docsTotal.textContent =
      registryDocuments;
  }

  if (docsCurrent) {
    docsCurrent.textContent =
      registryCurrent;
  }

  if (docsReview) {
    docsReview.textContent =
      registryReview;
  }


  const materialCritical =
    getWorkspaceElement(
      'workspaceMaterialsCritical'
    );

  const materialOrder =
    getWorkspaceElement(
      'workspaceMaterialsOrder'
    );

  const materialExpected =
    getWorkspaceElement(
      'workspaceMaterialsExpected'
    );


  if (materialCritical) {
    materialCritical.textContent =
      getWorkspaceText(
        'criticalCount'
      );
  }


  if (materialOrder) {
    materialOrder.textContent =
      getWorkspaceText(
        'warningCount'
      );
  }


  if (materialExpected) {
    materialExpected.textContent =
      getWorkspaceText(
        'expectedDeliveryCount'
      );
  }
}


function getSavedWorkspaceView() {
  const saved =
    localStorage.getItem(
      BUILDMIND_WORKSPACE_STORAGE_KEY
    );


  const exists =
    BUILDMIND_WORKSPACE_VIEWS
      .some(
        function (view) {
          return (
            view.id ===
            saved
          );
        }
      );


  return exists
    ? saved
    : 'dashboard';
}


function openBuildMindWorkspaceView(
  viewId,
  options = {}
) {
  const exists =
    BUILDMIND_WORKSPACE_VIEWS
      .some(
        function (view) {
          return (
            view.id ===
            viewId
          );
        }
      );


  const targetView =
    exists
      ? viewId
      : 'dashboard';


  document
    .querySelectorAll(
      '[data-workspace-view]'
    )
    .forEach(
      function (view) {
        const isActive =
          view
            .dataset
            .workspaceView ===
          targetView;

        view.hidden =
          !isActive;

        view.classList.toggle(
          'workspace-view-active',
          isActive
        );
      }
    );


  document
    .querySelectorAll(
      '[data-workspace-target]'
    )
    .forEach(
      function (button) {
        const isActive =
          button
            .dataset
            .workspaceTarget ===
          targetView;

        button.classList.toggle(
          'active',
          isActive
        );

        button.setAttribute(
          'aria-current',

          isActive
            ? 'page'
            : 'false'
        );
      }
    );


  if (
    options.persist !==
    false
  ) {
    localStorage.setItem(
      BUILDMIND_WORKSPACE_STORAGE_KEY,
      targetView
    );
  }


  updateWorkspaceDashboard();


  if (
    options.scroll !==
    false
  ) {
    window.scrollTo(
      {
        top: 0,
        behavior: 'smooth'
      }
    );
  }


  window.dispatchEvent(
    new CustomEvent(
      'buildmind:workspace-view-changed',

      {
        detail: {
          viewId:
            targetView
        }
      }
    )
  );
}


function initializeWorkspaceObservers() {
  const ids = [
    'criticalCount',
    'warningCount',
    'expectedDeliveryCount',

    'documentRegistryDocumentsCount',
    'documentRegistryCurrentCount',
    'documentRegistryReviewCount',

    'currentProject',
    'currentObject',
    'currentWork',
    'currentStartDate',
    'currentEndDate'
  ];


  const targets =
    ids
      .map(
        getWorkspaceElement
      )
      .filter(Boolean);


  if (
    targets.length > 0 &&
    window.MutationObserver
  ) {
    const observer =
      new MutationObserver(
        updateWorkspaceDashboard
      );


    targets.forEach(
      function (target) {
        observer.observe(
          target,

          {
            childList: true,
            subtree: true,
            characterData: true
          }
        );
      }
    );
  }


  window.addEventListener(
    'buildmind:project-core-changed',
    updateWorkspaceDashboard
  );


  window.addEventListener(
    'buildmind:document-registry-changed',
    updateWorkspaceDashboard
  );


  window.addEventListener(
    'buildmind:project-analysis-snapshot-changed',
    function () {
      renderWorkspaceAnalysis();
      updateWorkspaceDashboard();
    }
  );
}


function initializeBuildMindWorkspace() {
  if (
    window
      .BuildMindWorkspace
      ?.initialized ===
    true
  ) {
    return;
  }


  const nav =
    createWorkspaceNavigation();

  const views =
    buildWorkspaceViews();


  if (
    !nav ||
    !views
  ) {
    console.warn(
      'BuildMind Workspace: ' +
      'не удалось создать рабочую оболочку.'
    );

    return;
  }


  nav.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '[data-workspace-target]'
        );

      if (!button) {
        return;
      }

      openBuildMindWorkspaceView(
        button
          .dataset
          .workspaceTarget
      );
    }
  );


  document.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '[data-workspace-open]'
        );

      if (!button) {
        return;
      }

      openBuildMindWorkspaceView(
        button
          .dataset
          .workspaceOpen
      );
    }
  );


  initializeWorkspaceObservers();

  updateWorkspaceDashboard();
  renderWorkspaceAnalysis();


  window
    .BuildMindWorkspace
    .initialized =
    true;


  openBuildMindWorkspaceView(
    getSavedWorkspaceView(),

    {
      persist: false,
      scroll: false
    }
  );
}


window.BuildMindWorkspace = {
  version:
    BUILDMIND_WORKSPACE_VERSION,

  initialized:
    false,

  open:
    openBuildMindWorkspaceView,

  refresh:
    updateWorkspaceDashboard,

  getActiveView:
    function () {
      return (
        document
          .querySelector(
            '[data-workspace-view]:not([hidden])'
          )
          ?.dataset
          .workspaceView ||
        'dashboard'
      );
    }
};


initializeBuildMindWorkspace();


console.info(
  'BuildMind Workspace загружен:',
  BUILDMIND_WORKSPACE_VERSION
);
