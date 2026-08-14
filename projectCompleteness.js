'use strict';

/* ==================================================
   BUILDMIND PROJECT COMPLETENESS — V1

   Проверяет подтверждённую модель дорожного проекта:
   - наличие базовых групп документов;
   - заполненность сроков работ;
   - наличие обязательных материалов из базы знаний;
   - исходные данные закупочного контроля.

   Результат является контрольным профилем BuildMind,
   а не заключением о нормативном соответствии.
   ================================================== */

const BUILDMIND_PROJECT_COMPLETENESS_VERSION =
  'project-completeness-v1';

const PROJECT_COMPLETENESS_STORAGE_KEY =
  'buildmind-project-completeness-v1';

const PROJECT_COMPLETENESS_HISTORY_LIMIT = 30;

const COMPLETENESS_SEVERITY = {
  critical: {
    label: 'Критично',
    order: 0,
    confidence: 0.94
  },
  high: {
    label: 'Высокий приоритет',
    order: 1,
    confidence: 0.9
  },
  warning: {
    label: 'Требует данных',
    order: 2,
    confidence: 0.86
  },
  info: {
    label: 'Информация',
    order: 3,
    confidence: 0.78
  }
};

const COMPLETENESS_DOCUMENT_REQUIREMENTS = [
  {
    id: 'project-documentation',
    label: 'Проектная или рабочая документация',
    kinds: ['project-documentation'],
    terms: [
      'рабочая документация',
      'проектная документация',
      'пояснительная записка',
      'рабочий проект'
    ],
    severity: 'critical',
    reason:
      'Нужна подтверждённая проектная основа, с которой сверяются работы, объёмы и технические решения.',
    action:
      'Загрузить и подтвердить действующую проектную или рабочую документацию.'
  },
  {
    id: 'work-volume',
    label: 'Ведомость объёмов работ',
    kinds: ['work-volume'],
    terms: [
      'ведомость объемов работ',
      'ведомость объёмов работ',
      'вор'
    ],
    severity: 'critical',
    reason:
      'ВОР является источником подтверждённых работ и объёмов.',
    action:
      'Загрузить ВОР, проверить редакцию и подтвердить извлечённые позиции.'
  },
  {
    id: 'schedule',
    label: 'График производства работ',
    kinds: ['schedule'],
    terms: [
      'график производства работ',
      'календарный график',
      'гпр'
    ],
    severity: 'critical',
    reason:
      'ГПР задаёт последовательность, даты потребности и контроль сроков.',
    action:
      'Загрузить действующий ГПР и подтвердить даты работ.'
  },
  {
    id: 'resource-basis',
    label: 'Спецификация или сметная ресурсная основа',
    kinds: ['specification', 'estimate'],
    terms: [
      'спецификация',
      'локальная смета',
      'ресурсная ведомость',
      'сметный расчет',
      'сметный расчёт'
    ],
    severity: 'high',
    reason:
      'Без ресурсной основы нельзя надёжно проверить материалы и исходные количества.',
    action:
      'Добавить спецификацию, смету или ресурсную ведомость и подтвердить её статус.'
  },
  {
    id: 'traffic-management',
    label: 'Схема организации движения на период работ',
    kinds: [],
    terms: [
      'проект организации дорожного движения',
      'схема организации дорожного движения',
      'временная схема движения',
      'подд'
    ],
    severity: 'high',
    reason:
      'Для дорожного объекта необходимо отдельно проверить безопасную организацию движения на период производства работ.',
    action:
      'Проверить наличие действующей схемы организации движения и её согласования.'
  }
];

const COMPLETENESS_SECTION_WEIGHTS = {
  documents: 35,
  schedule: 25,
  materials: 25,
  procurement: 15
};


function completenessNow() {
  return new Date().toISOString();
}


function cloneCompletenessValue(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}


function normalizeCompletenessText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function completenessKey(value) {
  return normalizeCompletenessText(value)
    .replace(/\s+/g, '-');
}


function escapeCompletenessHtml(value) {
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


function emptyCompletenessState() {
  return {
    version: BUILDMIND_PROJECT_COMPLETENESS_VERSION,
    lastResult: null,
    history: [],
    updatedAt: ''
  };
}


function loadCompletenessState() {
  try {
    const saved = localStorage.getItem(
      PROJECT_COMPLETENESS_STORAGE_KEY
    );

    if (!saved) {
      return emptyCompletenessState();
    }

    const parsed = JSON.parse(saved);

    if (!parsed || typeof parsed !== 'object') {
      return emptyCompletenessState();
    }

    return {
      ...emptyCompletenessState(),
      ...parsed,
      version: BUILDMIND_PROJECT_COMPLETENESS_VERSION,
      history: Array.isArray(parsed.history)
        ? parsed.history
        : []
    };
  } catch (error) {
    console.warn(
      'Project Completeness: не удалось прочитать состояние:',
      error
    );

    return emptyCompletenessState();
  }
}


let projectCompletenessState =
  loadCompletenessState();

let completenessAutoTimer = null;


function saveCompletenessState() {
  projectCompletenessState.updatedAt =
    completenessNow();
  projectCompletenessState.history =
    projectCompletenessState.history.slice(
      -PROJECT_COMPLETENESS_HISTORY_LIMIT
    );

  localStorage.setItem(
    PROJECT_COMPLETENESS_STORAGE_KEY,
    JSON.stringify(projectCompletenessState)
  );

  window.dispatchEvent(
    new CustomEvent(
      'buildmind:project-completeness-changed',
      {
        detail: cloneCompletenessValue(
          projectCompletenessState.lastResult
        )
      }
    )
  );
}


function getConfirmedCompletenessModel() {
  const reviewCenter = window.BuildMindReviewCenter;

  if (
    !reviewCenter ||
    typeof reviewCenter.getModel !== 'function'
  ) {
    return null;
  }

  return reviewCenter.getModel();
}


function activeCompletenessEntities(items) {
  return (Array.isArray(items) ? items : [])
    .filter(
      function (item) {
        return item && item.status !== 'excluded';
      }
    );
}


function documentCompletenessText(documentItem) {
  return normalizeCompletenessText(
    [
      documentItem.kind,
      documentItem.name,
      documentItem.fileName,
      documentItem.title,
      documentItem.logicalTitle
    ].filter(Boolean).join(' ')
  );
}


function documentSatisfiesRequirement(
  documentItem,
  requirement
) {
  const kind = String(documentItem.kind || '');

  if (requirement.kinds.includes(kind)) {
    return true;
  }

  const source = documentCompletenessText(documentItem);

  return requirement.terms.some(
    function (term) {
      const normalizedTerm =
        normalizeCompletenessText(term);

      return normalizedTerm &&
        source.includes(normalizedTerm);
    }
  );
}


function createCompletenessFinding(input) {
  const severity = COMPLETENESS_SEVERITY[
    input.severity
  ] || COMPLETENESS_SEVERITY.warning;

  return {
    id: input.id,
    category: input.category,
    categoryLabel: input.categoryLabel,
    requirement: input.requirement,
    description: input.description,
    recommendedAction: input.recommendedAction,
    severity: input.severity || 'warning',
    severityLabel: severity.label,
    confidence: input.confidence || severity.confidence,
    evidence: cloneCompletenessValue(input.evidence || {}),
    status: 'open'
  };
}


function buildDocumentCompleteness(documents) {
  const checks = COMPLETENESS_DOCUMENT_REQUIREMENTS.map(
    function (requirement) {
      const matched = documents.find(
        function (documentItem) {
          return documentSatisfiesRequirement(
            documentItem,
            requirement
          );
        }
      );

      return {
        id: requirement.id,
        label: requirement.label,
        satisfied: Boolean(matched),
        matchedDocument: matched
          ? matched.name || matched.fileName || matched.title
          : '',
        severity: requirement.severity,
        reason: requirement.reason,
        action: requirement.action
      };
    }
  );

  const findings = checks
    .filter(function (check) {
      return !check.satisfied;
    })
    .map(function (check) {
      return createCompletenessFinding({
        id: `document:${check.id}`,
        category: 'documents',
        categoryLabel: 'Документы',
        requirement: check.label,
        description: check.reason,
        recommendedAction: check.action,
        severity: check.severity,
        evidence: {
          confirmedDocuments: documents.length
        }
      });
    });

  return buildCompletenessSection(
    'documents',
    'Документы',
    checks.length,
    checks.filter(function (check) {
      return check.satisfied;
    }).length,
    checks,
    findings
  );
}


function buildScheduleCompleteness(works) {
  const checks = works.map(
    function (work) {
      const hasStart = Boolean(work.startDate);
      const hasFinish = Boolean(work.finishDate);

      return {
        id: `schedule:${completenessKey(work.name)}`,
        label: work.name,
        satisfied: hasStart && hasFinish,
        startDate: work.startDate || '',
        finishDate: work.finishDate || ''
      };
    }
  );

  const findings = checks
    .filter(function (check) {
      return !check.satisfied;
    })
    .map(function (check) {
      return createCompletenessFinding({
        id: check.id,
        category: 'schedule',
        categoryLabel: 'Сроки ГПР',
        requirement: `Сроки работы: ${check.label}`,
        description:
          'У подтверждённой работы отсутствует дата начала или окончания.',
        recommendedAction:
          'Сверить работу с действующим ГПР и подтвердить обе даты.',
        severity: 'critical',
        evidence: {
          startDate: check.startDate,
          finishDate: check.finishDate
        }
      });
    });

  return buildCompletenessSection(
    'schedule',
    'Сроки работ',
    checks.length,
    checks.filter(function (check) {
      return check.satisfied;
    }).length,
    checks,
    findings
  );
}


function completenessTokens(value) {
  const ignored = new Set([
    'для',
    'или',
    'при',
    'под',
    'над',
    'материал',
    'материалы',
    'кабельной',
    'соединительная',
    'основания',
    'обоймы'
  ]);

  return normalizeCompletenessText(value)
    .split(' ')
    .filter(function (token) {
      return token.length >= 3 &&
        !ignored.has(token) &&
        !/^\d+$/.test(token);
    })
    .map(function (token) {
      return token.length > 5
        ? token.slice(0, token.length - 2)
        : token;
    });
}


function materialMatchesRequirement(
  material,
  expected
) {
  const materialName = normalizeCompletenessText(
    material.name || material.materialName
  );
  const expectedNames = [
    expected.name,
    ...(expected.aliases || [])
  ].filter(Boolean);

  if (!materialName) {
    return false;
  }

  if (
    expectedNames.some(function (name) {
      const expectedName = normalizeCompletenessText(name);
      return expectedName &&
        (
          materialName.includes(expectedName) ||
          expectedName.includes(materialName)
        );
    })
  ) {
    return true;
  }

  const materialTokens = new Set(
    completenessTokens(materialName)
  );

  return expectedNames.some(function (name) {
    const expectedTokens = completenessTokens(name);
    return expectedTokens.some(function (token) {
      return materialTokens.has(token);
    });
  });
}


function resolveCompletenessWorkProfile(work) {
  const knowledge = window.BuildMindRoadKnowledge;

  if (
    !knowledge ||
    typeof knowledge.findWorkByName !== 'function'
  ) {
    return null;
  }

  return knowledge.findWorkByName(work.name);
}


function buildMaterialCompleteness(works, materials) {
  const checks = [];
  const unknownWorks = [];
  const seen = new Set();

  works.forEach(function (work) {
    const profile = resolveCompletenessWorkProfile(work);

    if (!profile) {
      unknownWorks.push(work.name);
      return;
    }

    (profile.materials || [])
      .filter(function (expected) {
        return expected.required;
      })
      .forEach(function (expected) {
        const id = `${profile.id}:${expected.id || completenessKey(expected.name)}`;

        if (seen.has(id)) {
          return;
        }

        seen.add(id);

        const matched = materials.find(
          function (material) {
            return materialMatchesRequirement(
              material,
              expected
            );
          }
        );

        checks.push({
          id: `material:${id}`,
          label: expected.name,
          workName: work.name,
          profileName: profile.name,
          role: expected.role || '',
          satisfied: Boolean(matched),
          matchedMaterial: matched
            ? matched.name || matched.materialName
            : ''
        });
      });
  });

  const findings = checks
    .filter(function (check) {
      return !check.satisfied;
    })
    .map(function (check) {
      return createCompletenessFinding({
        id: check.id,
        category: 'materials',
        categoryLabel: 'Материалы',
        requirement: `Не найден материал: ${check.label}`,
        description:
          `Материал отмечен как обязательный для работы «${check.workName}» в предварительной базе знаний BuildMind.`,
        recommendedAction:
          'Сверить спецификацию и технологию. Подтвердить отсутствие либо связать найденный аналог.',
        severity: 'high',
        confidence: 0.84,
        evidence: {
          workName: check.workName,
          profileName: check.profileName,
          expectedMaterial: check.label,
          role: check.role
        }
      });
    });

  const section = buildCompletenessSection(
    'materials',
    'Материальная комплектность',
    checks.length,
    checks.filter(function (check) {
      return check.satisfied;
    }).length,
    checks,
    findings
  );

  section.recognizedWorks = works.length - unknownWorks.length;
  section.totalWorks = works.length;
  section.unknownWorks = unknownWorks;

  return section;
}


function buildProcurementCompleteness(materials) {
  const checks = [];
  const findings = [];

  materials.forEach(function (material) {
    const name = material.name ||
      material.materialName ||
      'Материал без названия';
    const key = completenessKey(name);
    const quantity = Number(material.quantity);
    const quantityReady =
      Number.isFinite(quantity) && quantity > 0;
    const needDateReady = Boolean(material.needDate);

    checks.push({
      id: `procurement:${key}:quantity`,
      label: `${name}: количество`,
      satisfied: quantityReady
    });
    checks.push({
      id: `procurement:${key}:need-date`,
      label: `${name}: дата потребности`,
      satisfied: needDateReady
    });

    if (!quantityReady) {
      findings.push(
        createCompletenessFinding({
          id: `procurement:${key}:quantity`,
          category: 'procurement',
          categoryLabel: 'Закупочный контроль',
          requirement: `Количество материала: ${name}`,
          description:
            'Количество отсутствует или не подтверждено положительным числом.',
          recommendedAction:
            'Сверить количество со спецификацией, ВОР или расчётным основанием.',
          severity: 'critical',
          evidence: {
            materialName: name,
            quantity: material.quantity,
            unit: material.unit || ''
          }
        })
      );
    }

    if (!needDateReady) {
      findings.push(
        createCompletenessFinding({
          id: `procurement:${key}:need-date`,
          category: 'procurement',
          categoryLabel: 'Закупочный контроль',
          requirement: `Дата потребности: ${name}`,
          description:
            'Материал подтверждён, но дата его потребности не определена.',
          recommendedAction:
            'Связать материал с работой ГПР и определить дату потребности до расчёта крайней даты заказа.',
          severity: 'warning',
          evidence: {
            materialName: name,
            quantity: material.quantity,
            unit: material.unit || ''
          }
        })
      );
    }
  });

  return buildCompletenessSection(
    'procurement',
    'Исходные данные закупок',
    checks.length,
    checks.filter(function (check) {
      return check.satisfied;
    }).length,
    checks,
    findings
  );
}


function buildCompletenessSection(
  id,
  label,
  total,
  satisfied,
  checks,
  findings
) {
  const evaluated = total > 0;
  const percent = evaluated
    ? Math.round((satisfied / total) * 100)
    : 0;

  return {
    id,
    label,
    total,
    satisfied,
    missing: Math.max(0, total - satisfied),
    percent,
    evaluated,
    checks,
    findings
  };
}


function calculateCompletenessScore(sections) {
  let weightedScore = 0;
  let usedWeight = 0;

  sections.forEach(function (section) {
    const weight = COMPLETENESS_SECTION_WEIGHTS[
      section.id
    ] || 0;

    if (!section.evaluated || weight <= 0) {
      return;
    }

    weightedScore += section.percent * weight;
    usedWeight += weight;
  });

  return usedWeight > 0
    ? Math.round(weightedScore / usedWeight)
    : 0;
}


function analyzeProjectCompleteness(model) {
  if (!model || Number(model.revision || 0) <= 0) {
    return {
      success: false,
      version: BUILDMIND_PROJECT_COMPLETENESS_VERSION,
      generatedAt: completenessNow(),
      errorCode: 'CONFIRMED_MODEL_EMPTY',
      errorMessage:
        'Сначала подтвердите исходные документы, работы и материалы в Review Center.'
    };
  }

  const documents = activeCompletenessEntities(model.documents);
  const works = activeCompletenessEntities(model.works);
  const materials = activeCompletenessEntities(model.materials);

  const sections = [
    buildDocumentCompleteness(documents),
    buildScheduleCompleteness(works),
    buildMaterialCompleteness(works, materials),
    buildProcurementCompleteness(materials)
  ];

  const findings = sections
    .flatMap(function (section) {
      return section.findings;
    })
    .sort(function (left, right) {
      return (
        COMPLETENESS_SEVERITY[left.severity].order -
        COMPLETENESS_SEVERITY[right.severity].order
      );
    });

  const severityCounts = {
    critical: 0,
    high: 0,
    warning: 0,
    info: 0
  };

  findings.forEach(function (finding) {
    severityCounts[finding.severity] += 1;
  });

  return {
    success: true,
    version: BUILDMIND_PROJECT_COMPLETENESS_VERSION,
    generatedAt: completenessNow(),
    modelRevision: Number(model.revision || 0),
    project: cloneCompletenessValue(model.project || {}),
    profile: {
      id: 'road-project-baseline-v1',
      label: 'Базовый контрольный профиль дорожного проекта',
      status: 'preliminary-engineering-profile',
      disclaimer:
        'Показатель отражает покрытие контрольного профиля BuildMind и не является заключением о соответствии проектной документации нормам.'
    },
    inputs: {
      documents: documents.length,
      works: works.length,
      materials: materials.length
    },
    sections,
    findings,
    summary: {
      coverageScore: calculateCompletenessScore(sections),
      findings: findings.length,
      critical: severityCounts.critical,
      high: severityCounts.high,
      warning: severityCounts.warning,
      recognizedWorks:
        sections.find(function (section) {
          return section.id === 'materials';
        })?.recognizedWorks || 0,
      totalWorks: works.length
    },
    requiresEngineerConfirmation: true
  };
}


function publishCompletenessFindings(result) {
  const reviewCenter = window.BuildMindReviewCenter;

  if (
    !result?.success ||
    !reviewCenter ||
    typeof reviewCenter.enqueueMany !== 'function'
  ) {
    return [];
  }

  const items = result.findings.map(
    function (finding) {
      return {
        sourceType: 'project-completeness',
        sourceId: finding.id,
        itemKey: finding.id,
        entityType: 'control',
        title: finding.requirement,
        description: finding.description,
        sourceLabel:
          `Комплектность · модель R${result.modelRevision}`,
        confidence: finding.confidence,
        status: 'pending',
        payload: {
          ...finding,
          name: finding.requirement,
          modelRevision: result.modelRevision,
          generatedAt: result.generatedAt
        },
        recommendedAction: finding.recommendedAction
      };
    }
  );

  return reviewCenter.enqueueMany(items);
}


function runProjectCompleteness(options) {
  const settings = options && typeof options === 'object'
    ? options
    : {};
  const model = settings.model ||
    getConfirmedCompletenessModel();
  const result = analyzeProjectCompleteness(model);

  projectCompletenessState.lastResult = result;

  if (result.success) {
    projectCompletenessState.history.push({
      generatedAt: result.generatedAt,
      modelRevision: result.modelRevision,
      coverageScore: result.summary.coverageScore,
      findings: result.summary.findings,
      critical: result.summary.critical
    });
  }

  saveCompletenessState();
  renderProjectCompleteness();

  if (result.success && settings.publish !== false) {
    const queued = publishCompletenessFindings(result);
    setCompletenessMessage(
      result.findings.length > 0
        ? `Проверка завершена. В Review Center передано замечаний: ${queued.length}.`
        : 'Проверка завершена: открытых замечаний по контрольному профилю нет.'
    );
  } else if (!result.success) {
    setCompletenessMessage(result.errorMessage);
  }

  return cloneCompletenessValue(result);
}


function formatCompletenessDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    'ru-RU',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  ).format(date);
}


function renderCompletenessSection(section) {
  const statusClass = section.percent === 100
    ? 'complete'
    : section.percent >= 70
      ? 'attention'
      : 'missing';

  return `
    <article class="completeness-metric completeness-metric-${statusClass}">
      <div>
        <strong>${escapeCompletenessHtml(section.label)}</strong>
        <span>${section.satisfied} из ${section.total}</span>
      </div>
      <b>${section.percent}%</b>
      <div class="completeness-progress">
        <span style="width: ${section.percent}%"></span>
      </div>
    </article>
  `;
}


function renderCompletenessFinding(finding) {
  return `
    <li class="completeness-finding completeness-finding-${escapeCompletenessHtml(finding.severity)}">
      <span>${escapeCompletenessHtml(finding.severityLabel)}</span>
      <div>
        <strong>${escapeCompletenessHtml(finding.requirement)}</strong>
        <p>${escapeCompletenessHtml(finding.description)}</p>
        <small>${escapeCompletenessHtml(finding.recommendedAction)}</small>
      </div>
    </li>
  `;
}


function renderProjectCompleteness() {
  createProjectCompletenessUi();

  const host = document.getElementById(
    'projectCompletenessResult'
  );
  const result = projectCompletenessState.lastResult;

  if (!host) {
    return;
  }

  if (!result) {
    host.innerHTML = `
      <div class="completeness-empty">
        После подтверждения модели BuildMind автоматически проверит
        документы, сроки, обязательные материалы и исходные данные закупок.
      </div>
    `;
    return;
  }

  if (!result.success) {
    host.innerHTML = `
      <div class="completeness-empty completeness-empty-warning">
        ${escapeCompletenessHtml(result.errorMessage)}
      </div>
    `;
    return;
  }

  const materialSection = result.sections.find(
    function (section) {
      return section.id === 'materials';
    }
  );
  const unknownWorks = materialSection?.unknownWorks || [];

  host.innerHTML = `
    <div class="completeness-overview">
      <div class="completeness-score">
        <strong>${result.summary.coverageScore}%</strong>
        <span>Покрытие профиля</span>
      </div>
      <div>
        <strong>${result.summary.findings}</strong>
        <span>Открытых замечаний</span>
      </div>
      <div>
        <strong>${result.summary.critical}</strong>
        <span>Критичных</span>
      </div>
      <div>
        <strong>${result.summary.recognizedWorks}/${result.summary.totalWorks}</strong>
        <span>Работ распознано</span>
      </div>
    </div>

    <div class="completeness-metrics">
      ${result.sections.map(renderCompletenessSection).join('')}
    </div>

    <div class="completeness-detail-grid">
      <section>
        <h3>Найденные пробелы</h3>
        <ul class="completeness-findings">
          ${result.findings.length
            ? result.findings.slice(0, 12)
                .map(renderCompletenessFinding)
                .join('')
            : '<li class="completeness-empty">Замечаний нет.</li>'}
        </ul>
      </section>

      <aside>
        <h3>Граница анализа</h3>
        <p>${escapeCompletenessHtml(result.profile.disclaimer)}</p>
        <dl>
          <div><dt>Модель</dt><dd>Редакция ${result.modelRevision}</dd></div>
          <div><dt>Документы</dt><dd>${result.inputs.documents}</dd></div>
          <div><dt>Работы</dt><dd>${result.inputs.works}</dd></div>
          <div><dt>Материалы</dt><dd>${result.inputs.materials}</dd></div>
          <div><dt>Проверено</dt><dd>${escapeCompletenessHtml(formatCompletenessDate(result.generatedAt))}</dd></div>
        </dl>
        ${unknownWorks.length
          ? `
            <div class="completeness-knowledge-gap">
              <strong>Требуют расширения базы знаний</strong>
              <p>${escapeCompletenessHtml(unknownWorks.join('; '))}</p>
            </div>
          `
          : ''}
      </aside>
    </div>
  `;
}


function setCompletenessMessage(text) {
  const element = document.getElementById(
    'projectCompletenessMessage'
  );

  if (element) {
    element.textContent = text || '';
  }
}


function createProjectCompletenessUi() {
  const existing = document.getElementById(
    'projectCompletenessSection'
  );

  if (existing) {
    return existing;
  }

  const reviewSection = document.getElementById(
    'reviewCenterSection'
  );

  if (!reviewSection) {
    return null;
  }

  const section = document.createElement('section');
  section.id = 'projectCompletenessSection';
  section.className = 'card project-completeness-section';
  section.innerHTML = `
    <div class="project-completeness-head">
      <div>
        <span class="review-center-eyebrow">ROAD PROJECT CONTROL V1</span>
        <h2>Проверка комплектности дорожного проекта</h2>
        <p class="muted">
          BuildMind сверяет только подтверждённую модель: документы,
          сроки работ, обязательные материалы и данные для закупочного контроля.
        </p>
      </div>
      <button type="button" id="runProjectCompletenessBtn" class="primary">
        Проверить комплектность
      </button>
    </div>

    <p id="projectCompletenessMessage" class="completeness-message">
      Проверка запускается автоматически после изменения подтверждённой модели.
    </p>

    <div id="projectCompletenessResult"></div>
  `;

  const flow = reviewSection.querySelector(
    '.review-center-flow'
  );

  if (flow && typeof flow.insertAdjacentElement === 'function') {
    flow.insertAdjacentElement('afterend', section);
  } else {
    reviewSection.appendChild(section);
  }

  document.getElementById('runProjectCompletenessBtn')
    ?.addEventListener('click', function () {
      runProjectCompleteness({publish: true});
    });

  return section;
}


function scheduleAutomaticCompleteness() {
  const model = getConfirmedCompletenessModel();
  const revision = Number(model?.revision || 0);
  const lastRevision = Number(
    projectCompletenessState.lastResult?.modelRevision || 0
  );

  if (revision <= 0 || revision === lastRevision) {
    return;
  }

  if (
    completenessAutoTimer &&
    typeof window.clearTimeout === 'function'
  ) {
    window.clearTimeout(completenessAutoTimer);
  }

  completenessAutoTimer = window.setTimeout(
    function () {
      completenessAutoTimer = null;
      runProjectCompleteness({publish: true});
    },
    450
  );
}


window.addEventListener(
  'buildmind:review-center-changed',
  scheduleAutomaticCompleteness
);


window.BuildMindProjectCompleteness = {
  version: BUILDMIND_PROJECT_COMPLETENESS_VERSION,
  analyze: analyzeProjectCompleteness,
  run: runProjectCompleteness,
  getLastResult: function () {
    return cloneCompletenessValue(
      projectCompletenessState.lastResult
    );
  },
  getState: function () {
    return cloneCompletenessValue(
      projectCompletenessState
    );
  },
  refresh: renderProjectCompleteness
};


createProjectCompletenessUi();
renderProjectCompleteness();
scheduleAutomaticCompleteness();


console.info(
  'BuildMind Project Completeness загружен:',
  BUILDMIND_PROJECT_COMPLETENESS_VERSION
);
