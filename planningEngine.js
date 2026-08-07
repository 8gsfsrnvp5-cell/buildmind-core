'use strict';

/*
  ==================================================
  BUILDMIND PLANNING ENGINE — CORE V1
  ==================================================

  Назначение:
  - объединить активную работу;
  - реальные материалы BuildMind;
  - Road Knowledge Base;
  - Engineering Audit;
  - Planning Rules;
  - сформировать единый инженерный анализ.

  Важно:
  BuildMind не принимает окончательные решения.
  Все выводы требуют проверки ответственным специалистом.
*/

const BUILDMIND_PLANNING_ENGINE_VERSION =
  'planning-engine-core-v1';


function getPlanningEngineActiveContext() {
  if (
    window.BuildMindWorkContexts &&
    typeof window.BuildMindWorkContexts
      .getActive === 'function'
  ) {
    return (
      window.BuildMindWorkContexts
        .getActive()
    );
  }

  return null;
}


function getPlanningEngineMaterials() {
  if (
    typeof materials !==
    'undefined' &&
    Array.isArray(materials)
  ) {
    return materials;
  }

  return [];
}


function normalizePlanningEngineText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}


function getPlanningEngineContextMaterials(
  context,
  allMaterials
) {
  if (!context) {
    return [];
  }

  const project =
    normalizePlanningEngineText(
      context.project
    );

  const object =
    normalizePlanningEngineText(
      context.object
    );

  const work =
    normalizePlanningEngineText(
      context.work
    );

  return allMaterials.filter(
    function (material) {
      return (
        normalizePlanningEngineText(
          material.project
        ) === project &&

        normalizePlanningEngineText(
          material.object
        ) === object &&

        normalizePlanningEngineText(
          material.work
        ) === work
      );
    }
  );
}


function calculatePlanningEngineMaterialState(
  material
) {
  const need =
    Number(material.need) || 0;

  const stock =
    Number(material.stock) || 0;

  const reserved =
    Number(material.reserved) || 0;

  const confirmed =
    Number(material.confirmed) || 0;

  const free =
    Math.max(
      stock - reserved,
      0
    );

  const available =
    free + confirmed;

  const deficit =
    Math.max(
      need - available,
      0
    );

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


function getPlanningEngineWorkItem(
  context
) {
  const knowledge =
    window.BuildMindRoadKnowledge;

  if (!knowledge || !context) {
    return null;
  }

  if (
    typeof knowledge
      .findWorkByName !== 'function'
  ) {
    return null;
  }

  return (
    knowledge.findWorkByName(
      context.work
    )
  );
}


function getPlanningEngineWorkQuantity(
  contextMaterials
) {
  if (
    !Array.isArray(
      contextMaterials
    ) ||
    contextMaterials.length === 0
  ) {
    return {
      quantity: null,
      unit: '',
      source:
        'not-determined'
    };
  }

  /*
    Core V1:
    пока используем крупнейшую
    потребность среди материалов
    как временный источник объёма.

    Это НЕ финальная логика.

    Позже объём работы будет
    извлекаться из ГПР / ВОР /
    проектной документации.
  */

  const sorted =
    contextMaterials
      .map(
        calculatePlanningEngineMaterialState
      )
      .sort(
        function (first, second) {
          return (
            second.need -
            first.need
          );
        }
      );

  const primary =
    sorted[0];

  if (!primary) {
    return {
      quantity: null,
      unit: '',
      source:
        'not-determined'
    };
  }

  return {
    quantity:
      Number(primary.need) || null,

    unit:
      primary.unit || '',

    source:
      'temporary-material-need',

    sourceMaterial:
      primary.name || ''
  };
}


function runPlanningEngineAudit(
  workItem,
  contextMaterials
) {
  const auditEngine =
    window.BuildMindEngineeringAudit;

  if (
    !auditEngine ||
    typeof auditEngine.run !==
      'function' ||
    !workItem
  ) {
    return null;
  }

  return auditEngine.run({
    workId:
      workItem.id,

    materials:
      contextMaterials
  });
}


function runPlanningEngineRules(
  workItem,
  workQuantity
) {
  const rulesEngine =
    window.BuildMindPlanningRules;

  if (
    !rulesEngine ||
    typeof rulesEngine
      .calculateForWork !==
      'function' ||
    !workItem
  ) {
    return null;
  }

  if (
    workQuantity.quantity ===
    null
  ) {
    return {
      success: false,

      errorCode:
        'WORK_QUANTITY_NOT_DETERMINED',

      errorMessage:
        'Объём работы пока не определён.'
    };
  }

  return (
    rulesEngine.calculateForWork(
      workItem.id,
      {
        workQuantity:
          workQuantity.quantity,

        workUnit:
          workQuantity.unit
      }
    )
  );
}


function buildPlanningEngineMaterialRisks(
  contextMaterials
) {
  return contextMaterials
    .map(
      calculatePlanningEngineMaterialState
    )
    .filter(
      function (material) {
        return (
          material.deficit > 0
        );
      }
    )
    .map(
      function (material) {
        return {
          type:
            'material-deficit',

          severity:
            'warning',

          materialName:
            material.name,

          deficit:
            material.deficit,

          unit:
            material.unit,

          message:
            'По текущим данным обнаружен дефицит материала.',

          verification:
            'Рекомендуется проверить складские остатки, резерв и подтверждённые поставки.',

          requiresEngineerConfirmation:
            true
        };
      }
    );
}


function buildPlanningEngineScheduleState(
  context
) {
  if (!context) {
    return {
      startDate: null,
      endDate: null,
      safetyDays: 0
    };
  }

  return {
    startDate:
      context.startDate || null,

    endDate:
      context.endDate || null,

    safetyDays:
      Number(
        context.safetyDays || 0
      )
  };
}


function calculatePlanningEngineRiskLevel(
  materialRisks,
  audit,
  planningRules
) {
  const hasMaterialDeficit =
    Array.isArray(
      materialRisks
    ) &&
    materialRisks.length > 0;

  const hasRequiredMissing =
    Boolean(
      audit &&
      audit.success &&
      Array.isArray(
        audit.missingRequiredMaterials
      ) &&
      audit.missingRequiredMaterials
        .length > 0
    );

  const hasAuditWarnings =
    Boolean(
      audit &&
      audit.success &&
      Array.isArray(
        audit.typicalMissingChecks
      ) &&
      audit.typicalMissingChecks.some(
        function (item) {
          return !item.found;
        }
      )
    );

  if (
    hasMaterialDeficit ||
    hasRequiredMissing
  ) {
    return {
      level:
        'high',

      label:
        'Высокое внимание',

      explanation:
        'Выявлены дефициты или отсутствующие обязательные позиции.'
    };
  }

  if (hasAuditWarnings) {
    return {
      level:
        'medium',

      label:
        'Требуется проверка',

      explanation:
        'Выявлены позиции, которые рекомендуется дополнительно проверить.'
    };
  }

  if (
    planningRules &&
    planningRules.success
  ) {
    return {
      level:
        'low',

      label:
        'Критичных отклонений не выявлено',

      explanation:
        'По имеющимся данным существенных отклонений не обнаружено.'
    };
  }

  return {
    level:
      'unknown',

    label:
      'Недостаточно данных',

    explanation:
      'Для полноценной оценки недостаточно исходной информации.'
  };
}


function buildPlanningEngineRecommendations(
  audit,
  materialRisks,
  planningRules
) {
  const recommendations = [];

  if (
    Array.isArray(materialRisks) &&
    materialRisks.length > 0
  ) {
    recommendations.push({
      category:
        'materials',

      text:
        'Рекомендуется проверить материальные дефициты и подтверждённые поставки.'
    });
  }

  if (
    audit &&
    audit.success
  ) {
    const missingRequired =
      audit.missingRequiredMaterials ||
      [];

    if (
      missingRequired.length > 0
    ) {
      recommendations.push({
        category:
          'audit',

        text:
          'Рекомендуется проверить комплектность обязательных ресурсов по выбранной работе.'
      });
    }

    const unresolvedTypical =
      (
        audit.typicalMissingChecks ||
        []
      ).filter(
        function (item) {
          return !item.found;
        }
      );

    if (
      unresolvedTypical.length > 0
    ) {
      recommendations.push({
        category:
          'audit',

        text:
          'Обнаружены типовые позиции, которые часто отсутствуют в проектной документации. Рекомендуется проверить их наличие.'
      });
    }
  }

  if (
    planningRules &&
    planningRules.success &&
    Array.isArray(
      planningRules.results
    )
  ) {
    recommendations.push({
      category:
        'planning',

      text:
        'Сформированы предварительные расчётные оценки ресурсов. Рекомендуется проверить коэффициенты и исходный объём работы.'
    });
  }

  if (
    recommendations.length === 0
  ) {
    recommendations.push({
      category:
        'general',

      text:
        'Рекомендуется подтвердить исходные данные и результаты анализа ответственным специалистом.'
    });
  }

  return recommendations;
}


function runBuildMindPlanningEngine(
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const activeContext =
    settings.context ||
    getPlanningEngineActiveContext();

  if (!activeContext) {
    return {
      success: false,

      errorCode:
        'ACTIVE_CONTEXT_NOT_FOUND',

      errorMessage:
        'Активный контекст работы не найден.'
    };
  }

  const allMaterials =
    getPlanningEngineMaterials();

  const contextMaterials =
    getPlanningEngineContextMaterials(
      activeContext,
      allMaterials
    );

  const workItem =
    getPlanningEngineWorkItem(
      activeContext
    );

  if (!workItem) {
    return {
      success: false,

      errorCode:
        'WORK_NOT_FOUND_IN_KNOWLEDGE_BASE',

      errorMessage:
        'Активная работа пока не найдена в Road Knowledge Base.',

      context:
        activeContext
    };
  }

  const workQuantity =
    settings.workQuantity !==
      undefined
      ? {
          quantity:
            Number(
              settings.workQuantity
            ),

          unit:
            settings.workUnit ||
            '',

          source:
            'manual-input'
        }
      : getPlanningEngineWorkQuantity(
          contextMaterials
        );

  const engineeringAudit =
    runPlanningEngineAudit(
      workItem,
      contextMaterials
    );

  const planningRules =
    runPlanningEngineRules(
      workItem,
      workQuantity
    );

  const materialRisks =
    buildPlanningEngineMaterialRisks(
      contextMaterials
    );

  const schedule =
    buildPlanningEngineScheduleState(
      activeContext
    );

  const riskLevel =
    calculatePlanningEngineRiskLevel(
      materialRisks,
      engineeringAudit,
      planningRules
    );

  const recommendations =
    buildPlanningEngineRecommendations(
      engineeringAudit,
      materialRisks,
      planningRules
    );

  return {
    success: true,

    version:
      BUILDMIND_PLANNING_ENGINE_VERSION,

    generatedAt:
      new Date().toISOString(),

    context:
      {
        ...activeContext
      },

    work: {
      id:
        workItem.id,

      name:
        workItem.name,

      category:
        workItem.categoryName || ''
    },

    schedule,

    workQuantity,

    materials: {
      total:
        contextMaterials.length,

      items:
        contextMaterials.map(
          calculatePlanningEngineMaterialState
        )
    },

    engineeringAudit,

    planningRules,

    risks: {
      overall:
        riskLevel,

      materials:
        materialRisks
    },

    recommendations,

    requiresEngineerConfirmation:
      true,

    decisionStatus:
      'requires-review',

    disclaimer:
      'BuildMind формирует предварительный аналитический результат. ' +
      'Рекомендуется проверить исходные данные, проектную документацию, ' +
      'применённые расчётные правила и подтвердить выводы ответственным специалистом.'
  };
}


function getBuildMindPlanningReadableResult(
  result
) {
  if (
    !result ||
    !result.success
  ) {
    return (
      result &&
      result.errorMessage
        ? result.errorMessage
        : 'Не удалось выполнить анализ.'
    );
  }

  const lines = [];

  lines.push(
    'BUILDMIND — ПРЕДВАРИТЕЛЬНЫЙ ИНЖЕНЕРНЫЙ АНАЛИЗ'
  );

  lines.push('');

  lines.push(
    `Работа: ${result.work.name}`
  );

  lines.push(
    `Категория: ${result.work.category}`
  );

  lines.push('');

  lines.push(
    `Статус анализа: ${result.risks.overall.label}`
  );

  lines.push(
    result.risks.overall.explanation
  );

  lines.push('');

  lines.push(
    'Материалы текущего контекста:'
  );

  if (
    result.materials.items.length ===
    0
  ) {
    lines.push(
      '— Материалы пока не найдены.'
    );
  } else {
    result.materials.items.forEach(
      function (material) {
        lines.push(
          `• ${material.name}: ` +
          `потребность ${material.need} ${material.unit}, ` +
          `доступно ${material.available} ${material.unit}, ` +
          `дефицит ${material.deficit} ${material.unit}`
        );
      }
    );
  }

  lines.push('');

  if (
    result.planningRules &&
    result.planningRules.success
  ) {
    lines.push(
      'Предварительные расчётные ресурсы:'
    );

    result.planningRules.results
      .forEach(
        function (resource) {
          if (!resource.success) {
            return;
          }

          lines.push(
            `• ${resource.resourceName}: ` +
            `${resource.calculatedQuantity} ` +
            `${resource.outputUnit} ` +
            `(уверенность: ${resource.confidence})`
          );
        }
      );

    lines.push('');
  }

  lines.push(
    'Рекомендации для проверки:'
  );

  result.recommendations.forEach(
    function (recommendation) {
      lines.push(
        `• ${recommendation.text}`
      );
    }
  );

  lines.push('');

  lines.push(
    'Статус решения: требует проверки ответственным специалистом.'
  );

  return lines.join('\n');
}


window.BuildMindPlanningEngine = {
  version:
    BUILDMIND_PLANNING_ENGINE_VERSION,

  run:
    runBuildMindPlanningEngine,

  toText:
    getBuildMindPlanningReadableResult
};


console.info(
  'BuildMind Planning Engine загружен:',
  {
    version:
      BUILDMIND_PLANNING_ENGINE_VERSION
  }
);
