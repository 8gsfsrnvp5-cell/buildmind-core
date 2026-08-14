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
    id: 'review',
    label: 'Проверка'
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
        data-workspace-open="review"
      >
        Центр проверки
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
            ПРОВЕРКА ИНЖЕНЕРОМ
          </span>

          <h3>
            Очередь решений
          </h3>
        </div>

        <button
          type="button"
          class="workspace-link-button"
          data-workspace-open="review"
        >
          Открыть
        </button>
      </div>


      <div class="workspace-mini-stats">

        <div>
          <strong id="workspaceReviewPending">0</strong>
          <span>Ожидают</span>
        </div>

        <div>
          <strong id="workspaceReviewClarification">0</strong>
          <span>Уточнить</span>
        </div>

        <div>
          <strong id="workspaceReviewConfirmed">0</strong>
          <span>Подтверждено</span>
        </div>

      </div>

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

  const reviewCenter =
    getWorkspaceElement(
      'reviewCenterSection'
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
    ЦЕНТР ПРОВЕРКИ
    ==================================================
  */

  views.review.appendChild(
    createWorkspacePageHeader(
      'Центр проверки',

      'Единая очередь выводов автоматического анализа. ' +
      'Только подтверждённые инженером данные формируют модель проекта.'
    )
  );

  moveWorkspaceNode(
    reviewCenter,
    views.review
  );

  if (!reviewCenter) {
    views.review.appendChild(
      createWorkspacePlaceholder(
        'Очередь проверки пока пуста',

        'После анализа документов здесь появятся работы, ' +
        'материалы, сроки и пакеты изменений.'
      )
    );
  }


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
    createWorkspacePlaceholder(
      'График производства работ',

      'Здесь будет единое представление ГПР, ' +
      'объёмов, сроков, исходного плана, действующего плана и факта ' +
      'и отклонений.'
    )
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


  const reviewPending =
    getWorkspaceElement(
      'workspaceReviewPending'
    );

  const reviewClarification =
    getWorkspaceElement(
      'workspaceReviewClarification'
    );

  const reviewConfirmed =
    getWorkspaceElement(
      'workspaceReviewConfirmed'
    );

  if (reviewPending) {
    reviewPending.textContent =
      getWorkspaceText(
        'reviewCenterPendingCount'
      );
  }

  if (reviewClarification) {
    reviewClarification.textContent =
      getWorkspaceText(
        'reviewCenterClarificationCount'
      );
  }

  if (reviewConfirmed) {
    reviewConfirmed.textContent =
      getWorkspaceText(
        'reviewCenterConfirmedCount'
      );
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

    'reviewCenterPendingCount',
    'reviewCenterClarificationCount',
    'reviewCenterConfirmedCount',

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
    'buildmind:review-center-changed',
    updateWorkspaceDashboard
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
