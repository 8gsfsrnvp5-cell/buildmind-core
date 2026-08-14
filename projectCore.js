'use strict';

/* ==================================================
   BUILDMIND PROJECT CORE — V1
   Постоянные ID главного проекта и связанных пакетов.
   ================================================== */

const BUILDMIND_PROJECT_CORE_VERSION =
  'project-core-v1';

const PROJECT_CORE_STORAGE_KEY =
  'buildmind-project-core-v1';


function projectCoreId(prefix) {
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


function emptyProjectCoreState() {
  return {
    version:
      BUILDMIND_PROJECT_CORE_VERSION,

    rootProject:
      null,

    linkedProjects:
      [],

    activeNodeId:
      '',

    timeline: {
      baselineSnapshotId:
        null,

      currentApprovedSnapshotId:
        null,

      latestReceivedChangeSetId:
        null,

      actualSnapshotId:
        null
    },

    createdAt:
      '',

    updatedAt:
      ''
  };
}


function loadProjectCoreState() {
  try {
    const saved =
      localStorage.getItem(
        PROJECT_CORE_STORAGE_KEY
      );

    if (!saved) {
      return emptyProjectCoreState();
    }

    const parsed =
      JSON.parse(saved);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return emptyProjectCoreState();
    }

    return {
      ...emptyProjectCoreState(),

      ...parsed,

      version:
        BUILDMIND_PROJECT_CORE_VERSION,

      linkedProjects:
        Array.isArray(
          parsed.linkedProjects
        )
          ? parsed.linkedProjects
          : [],

      timeline: {
        ...emptyProjectCoreState()
          .timeline,

        ...(parsed.timeline || {})
      }
    };
  } catch (error) {
    console.warn(
      'Project Core: не удалось прочитать состояние:',
      error
    );

    return emptyProjectCoreState();
  }
}


let projectCoreState =
  loadProjectCoreState();


function cloneProjectCore(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function saveProjectCoreState() {
  const now =
    new Date().toISOString();

  if (!projectCoreState.createdAt) {
    projectCoreState.createdAt =
      now;
  }

  projectCoreState.updatedAt =
    now;

  localStorage.setItem(
    PROJECT_CORE_STORAGE_KEY,
    JSON.stringify(
      projectCoreState
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:project-core-changed',
      {
        detail:
          cloneProjectCore(
            projectCoreState
          )
      }
    )
  );
}


function escapeProjectCoreHtml(value) {
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


function getProjectCoreNodes() {
  return [
    ...(
      projectCoreState.rootProject
        ? [
            projectCoreState
              .rootProject
          ]
        : []
    ),

    ...projectCoreState
      .linkedProjects
  ];
}


function getProjectCoreNodeById(
  nodeId
) {
  return (
    getProjectCoreNodes()
      .find(
        function (node) {
          return (
            node.id === nodeId
          );
        }
      ) ||
    null
  );
}


function projectCoreNodeLabel(
  node
) {
  return [
    node.code,
    node.name,
    node.object
  ]
    .filter(Boolean)
    .join(' · ');
}


function setProjectCoreMessage(
  text
) {
  const element =
    document.getElementById(
      'projectCoreMessage'
    );

  if (element) {
    element.textContent =
      text || '';
  }
}


function syncProjectCoreInputs() {
  const root =
    projectCoreState.rootProject;

  if (!root) {
    return;
  }

  const projectName =
    document.getElementById(
      'projectName'
    );

  const objectName =
    document.getElementById(
      'objectName'
    );

  const code =
    document.getElementById(
      'projectCoreCode'
    );

  const contract =
    document.getElementById(
      'projectCoreContract'
    );

  if (projectName) {
    projectName.value =
      root.name || '';
  }

  if (objectName) {
    objectName.value =
      root.object || '';
  }

  if (code) {
    code.value =
      root.code || '';
  }

  if (contract) {
    contract.value =
      root.contractNumber || '';
  }
}


function renderProjectCore() {
  const root =
    projectCoreState.rootProject;

  const rootSummary =
    document.getElementById(
      'projectCoreRootSummary'
    );

  const linkedList =
    document.getElementById(
      'projectCoreLinkedList'
    );

  const linkedCount =
    document.getElementById(
      'projectCoreLinkedCount'
    );

  const activeSelect =
    document.getElementById(
      'projectCoreActiveNode'
    );

  const activeLabel =
    document.getElementById(
      'projectCoreActiveLabel'
    );


  if (rootSummary) {
    rootSummary.innerHTML =
      root
        ? `
          <div
            class="
              project-core-node-card
              project-core-node-root
            "
          >
            <div>
              <span
                class="project-core-node-type"
              >
                ГЛАВНЫЙ ПРОЕКТ
              </span>

              <strong>
                ${escapeProjectCoreHtml(
                  root.name
                )}
              </strong>

              <p>
                ${escapeProjectCoreHtml(
                  root.object ||
                  'Объект не указан'
                )}
              </p>

              <small>
                ${escapeProjectCoreHtml(
                  root.code ||
                  'Шифр не указан'
                )}

                ${
                  root.contractNumber
                    ? (
                        ' · Договор ' +
                        escapeProjectCoreHtml(
                          root.contractNumber
                        )
                      )
                    : ''
                }
              </small>
            </div>

            <span
              class="
                project-core-status
                project-core-status-${escapeProjectCoreHtml(
                  root.status
                )}
              "
            >
              ${
                root.status ===
                  'closed'
                  ? 'Закрыт'
                  : 'Активен'
              }
            </span>
          </div>
        `
        : (
            '<div class="project-core-empty">' +
            'Главный проект ещё не сохранён.' +
            '</div>'
          );
  }


  if (linkedCount) {
    linkedCount.textContent =
      String(
        projectCoreState
          .linkedProjects
          .length
      );
  }


  if (linkedList) {
    linkedList.innerHTML =
      projectCoreState
        .linkedProjects
        .length
        ? projectCoreState
            .linkedProjects
            .map(
              function (node) {
                return `
                  <article
                    class="project-core-node-card"
                  >
                    <div>
                      <span
                        class="project-core-node-type"
                      >
                        СВЯЗАННЫЙ ПРОЕКТ / ПАКЕТ
                      </span>

                      <strong>
                        ${escapeProjectCoreHtml(
                          node.name
                        )}
                      </strong>

                      <p>
                        ${escapeProjectCoreHtml(
                          node.object ||
                          'Объект не указан'
                        )}
                      </p>

                      <small>
                        ${escapeProjectCoreHtml(
                          node.code ||
                          'Шифр не указан'
                        )}
                      </small>
                    </div>

                    <div
                      class="project-core-node-actions"
                    >
                      <span
                        class="
                          project-core-status
                          project-core-status-${escapeProjectCoreHtml(
                            node.status
                          )}
                        "
                      >
                        ${
                          node.status ===
                            'closed'
                            ? 'Закрыт'
                            : 'Активен'
                        }
                      </span>

                      <button
                        type="button"
                        class="project-core-close-node"
                        data-node-id="${escapeProjectCoreHtml(
                          node.id
                        )}"
                      >
                        ${
                          node.status ===
                            'closed'
                            ? 'Возобновить'
                            : 'Закрыть'
                        }
                      </button>
                    </div>
                  </article>
                `;
              }
            )
            .join('')
        : (
            '<div class="project-core-empty">' +
            'Связанные проекты / пакеты пока не добавлены.' +
            '</div>'
          );
  }


  if (activeSelect) {
    const nodes =
      getProjectCoreNodes();

    activeSelect.innerHTML =
      '<option value="">Не выбран</option>';

    nodes.forEach(
      function (node) {
        const option =
          document.createElement(
            'option'
          );

        option.value =
          node.id;

        option.textContent =
          projectCoreNodeLabel(
            node
          ) +
          (
            node.status ===
              'closed'
              ? ' [закрыт]'
              : ''
          );

        activeSelect.appendChild(
          option
        );
      }
    );

    activeSelect.value =
      projectCoreState
        .activeNodeId ||
      '';
  }


  const activeNode =
    getProjectCoreNodeById(
      projectCoreState
        .activeNodeId
    );

  if (activeLabel) {
    activeLabel.textContent =
      activeNode
        ? projectCoreNodeLabel(
            activeNode
          )
        : '—';
  }
}


function saveRootProjectFromUi() {
  const name =
    (
      document.getElementById(
        'projectName'
      )?.value ||
      ''
    ).trim();

  const object =
    (
      document.getElementById(
        'objectName'
      )?.value ||
      ''
    ).trim();

  const code =
    (
      document.getElementById(
        'projectCoreCode'
      )?.value ||
      ''
    ).trim();

  const contractNumber =
    (
      document.getElementById(
        'projectCoreContract'
      )?.value ||
      ''
    ).trim();


  if (
    !name ||
    !object
  ) {
    setProjectCoreMessage(
      'Сначала заполните название проекта и объект ' +
      'в блоке «Данные проекта».'
    );

    return;
  }


  const now =
    new Date().toISOString();


  if (
    !projectCoreState
      .rootProject
  ) {
    projectCoreState.rootProject = {
      id:
        projectCoreId(
          'project'
        ),

      parentProjectId:
        null,

      nodeType:
        'root',

      name,

      object,

      code,

      contractNumber,

      status:
        'active',

      createdAt:
        now,

      updatedAt:
        now
    };

    projectCoreState.activeNodeId =
      projectCoreState
        .rootProject
        .id;
  } else {
    projectCoreState.rootProject = {
      ...projectCoreState
        .rootProject,

      name,

      object,

      code,

      contractNumber,

      updatedAt:
        now
    };
  }


  saveProjectCoreState();
  renderProjectCore();

  setProjectCoreMessage(
    'Паспорт сохранён. Постоянный Project ID ' +
    'не меняется при новых редакциях документов.'
  );
}


function upsertRootProject(
  project
) {
  const source =
    project &&
    typeof project === 'object'
      ? project
      : {};

  const name =
    String(source.name || '').trim();

  const object =
    String(source.object || '').trim();

  if (
    !name ||
    !object
  ) {
    return null;
  }

  const now =
    new Date().toISOString();

  if (!projectCoreState.rootProject) {
    projectCoreState.rootProject = {
      id:
        source.id ||
        projectCoreId('project'),
      parentProjectId: null,
      nodeType: 'root',
      name,
      object,
      code:
        String(source.code || '').trim(),
      contractNumber:
        String(
          source.contractNumber ||
          ''
        ).trim(),
      status:
        source.status === 'closed'
          ? 'closed'
          : 'active',
      createdAt:
        source.createdAt || now,
      updatedAt: now
    };

    projectCoreState.activeNodeId =
      projectCoreState.rootProject.id;
  } else {
    projectCoreState.rootProject = {
      ...projectCoreState.rootProject,
      name,
      object,
      code:
        source.code !== undefined
          ? String(source.code || '').trim()
          : projectCoreState.rootProject.code,
      contractNumber:
        source.contractNumber !== undefined
          ? String(
              source.contractNumber ||
              ''
            ).trim()
          : projectCoreState.rootProject
              .contractNumber,
      status:
        source.status === 'closed'
          ? 'closed'
          : projectCoreState.rootProject.status,
      updatedAt: now
    };
  }

  saveProjectCoreState();
  syncProjectCoreInputs();
  renderProjectCore();

  return cloneProjectCore(
    projectCoreState.rootProject
  );
}


function addLinkedProjectFromUi() {
  const root =
    projectCoreState
      .rootProject;

  if (!root) {
    setProjectCoreMessage(
      'Сначала сохраните главный проект.'
    );

    return;
  }


  const nameInput =
    document.getElementById(
      'linkedProjectName'
    );

  const codeInput =
    document.getElementById(
      'linkedProjectCode'
    );

  const objectInput =
    document.getElementById(
      'linkedProjectObject'
    );


  const name =
    (
      nameInput?.value ||
      ''
    ).trim();

  const code =
    (
      codeInput?.value ||
      ''
    ).trim();

  const object =
    (
      objectInput?.value ||
      ''
    ).trim();


  if (!name) {
    setProjectCoreMessage(
      'Укажите название связанного проекта / пакета.'
    );

    return;
  }


  const duplicate =
    projectCoreState
      .linkedProjects
      .some(
        function (node) {
          return (
            node.name
              .toLowerCase() ===
              name.toLowerCase() &&

            (
              node.code ||
              ''
            ).toLowerCase() ===
              code.toLowerCase()
          );
        }
      );

  if (duplicate) {
    setProjectCoreMessage(
      'Такой связанный проект / пакет уже существует.'
    );

    return;
  }


  const now =
    new Date().toISOString();

  const newNode = {
    id:
      projectCoreId(
        'project'
      ),

    parentProjectId:
      root.id,

    nodeType:
      'linked',

    name,

    object:
      object ||
      root.object ||
      '',

    code,

    contractNumber:
      '',

    status:
      'active',

    createdAt:
      now,

    updatedAt:
      now
  };


  projectCoreState
    .linkedProjects
    .push(
      newNode
    );

  projectCoreState.activeNodeId =
    newNode.id;

  saveProjectCoreState();
  renderProjectCore();


  if (nameInput) {
    nameInput.value = '';
  }

  if (codeInput) {
    codeInput.value = '';
  }

  if (objectInput) {
    objectInput.value = '';
  }


  setProjectCoreMessage(
    'Связанный проект / пакет добавлен ' +
    'без изменения истории главного проекта.'
  );
}


function toggleLinkedProjectStatus(
  nodeId
) {
  const node =
    projectCoreState
      .linkedProjects
      .find(
        function (item) {
          return (
            item.id ===
            nodeId
          );
        }
      );

  if (!node) {
    return;
  }

  node.status =
    node.status ===
      'closed'
      ? 'active'
      : 'closed';

  node.updatedAt =
    new Date().toISOString();

  saveProjectCoreState();
  renderProjectCore();
}


function selectProjectCoreNode(
  nodeId
) {
  if (
    nodeId &&
    !getProjectCoreNodeById(
      nodeId
    )
  ) {
    return;
  }

  projectCoreState.activeNodeId =
    nodeId || '';

  saveProjectCoreState();
  renderProjectCore();
}


function initializeProjectCore() {
  syncProjectCoreInputs();


  document.getElementById(
    'saveProjectCoreBtn'
  )?.addEventListener(
    'click',
    saveRootProjectFromUi
  );


  document.getElementById(
    'addLinkedProjectBtn'
  )?.addEventListener(
    'click',
    addLinkedProjectFromUi
  );


  document.getElementById(
    'projectCoreActiveNode'
  )?.addEventListener(
    'change',
    function (event) {
      selectProjectCoreNode(
        event.target.value
      );
    }
  );


  document.getElementById(
    'projectCoreLinkedList'
  )?.addEventListener(
    'click',
    function (event) {
      const button =
        event.target.closest(
          '.project-core-close-node'
        );

      if (button) {
        toggleLinkedProjectStatus(
          button.dataset.nodeId
        );
      }
    }
  );


  renderProjectCore();
}


window.BuildMindProjectCore = {
  version:
    BUILDMIND_PROJECT_CORE_VERSION,

  getState:
    function () {
      return cloneProjectCore(
        projectCoreState
      );
    },

  getRoot:
    function () {
      return projectCoreState
        .rootProject
        ? cloneProjectCore(
            projectCoreState
              .rootProject
          )
        : null;
    },

  getNodes:
    function () {
      return cloneProjectCore(
        getProjectCoreNodes()
      );
    },

  getActiveNode:
    function () {
      const node =
        getProjectCoreNodeById(
          projectCoreState
            .activeNodeId
        );

      return node
        ? cloneProjectCore(
            node
          )
        : null;
    },

  getNodeById:
    function (nodeId) {
      const node =
        getProjectCoreNodeById(
          nodeId
        );

      return node
        ? cloneProjectCore(
            node
          )
        : null;
    },

  selectNode:
    selectProjectCoreNode,

  upsertRoot:
    upsertRootProject,

  refresh:
    renderProjectCore
};


initializeProjectCore();


console.info(
  'BuildMind Project Core загружен:',
  BUILDMIND_PROJECT_CORE_VERSION
);
