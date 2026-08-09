'use strict';

/*
  ==================================================
  BUILDMIND WORK QUANTITY ENGINE — DEMO V1
  ==================================================

  Назначение:
  - находить объём строительной работы
    в уже извлечённом тексте документов;
  - связывать объём с активным контекстом;
  - сохранять документ и страницу-источник;
  - показывать уверенность и основание;
  - не подменять инженерное решение.

  Важно:
  Модуль работает только с уже извлечённым
  текстовым слоем PDF.

  OCR для сканов здесь пока не используется.
*/

const BUILDMIND_WORK_QUANTITY_ENGINE_VERSION =
  'work-quantity-engine-demo-v1';


/*
  ==================================================
  ЕДИНИЦЫ ИЗМЕРЕНИЯ
  ==================================================
*/

const WORK_QUANTITY_UNIT_RULES = [
  {
    pattern:
      /п\.?\s*м\.?/iu,

    unit:
      'п.м.'
  },

  {
    pattern:
      /м²|м2/iu,

    unit:
      'м²'
  },

  {
    pattern:
      /м³|м3/iu,

    unit:
      'м³'
  },

  {
    pattern:
      /км/iu,

    unit:
      'км'
  },

  {
    pattern:
      /м/iu,

    unit:
      'м'
  },

  {
    pattern:
      /шт\.?|штук/iu,

    unit:
      'шт'
  },

  {
    pattern:
      /компл\.?|комплект(?:ов|а)?/iu,

    unit:
      'компл.'
  },

  {
    pattern:
      /т/iu,

    unit:
      'т'
  },

  {
    pattern:
      /кг/iu,

    unit:
      'кг'
  }
];


/*
  ==================================================
  НОРМАЛИЗАЦИЯ
  ==================================================
*/

function normalizeWorkQuantityText(
  value
) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}


function tokenizeWorkQuantityText(
  value
) {
  const normalized =
    normalizeWorkQuantityText(
      value
    );

  if (!normalized) {
    return [];
  }

  const stopWords =
    new Set([
      'на',
      'в',
      'по',
      'для',
      'из',
      'под',
      'над',
      'при',
      'и',
      'или',
      'до',
      'от',
      'к',
      'через',
      'устройство',
      'выполнение',
      'работы',
      'работ'
    ]);

  return normalized
    .split(/[^а-яa-z0-9-]+/iu)
    .filter(
      function (word) {
        return (
          word.length >= 3 &&
          !stopWords.has(word)
        );
      }
    );
}


function getWorkQuantityRoot(
  word
) {
  const normalized =
    normalizeWorkQuantityText(
      word
    );

  if (
    normalized.length <= 4
  ) {
    return normalized;
  }

  const endings = [
    'иями',
    'ями',
    'ами',
    'ого',
    'ему',
    'ому',
    'ыми',
    'ими',
    'ий',
    'ый',
    'ой',
    'ая',
    'яя',
    'ое',
    'ее',
    'ые',
    'ие',
    'ов',
    'ев',
    'ей',
    'ам',
    'ям',
    'ах',
    'ях',
    'ом',
    'ем',
    'а',
    'я',
    'ы',
    'и',
    'у',
    'ю',
    'е',
    'о'
  ];

  const ending =
    endings.find(
      function (item) {
        return (
          normalized.endsWith(
            item
          ) &&
          normalized.length -
            item.length >=
            4
        );
      }
    );

  if (!ending) {
    return normalized;
  }

  return normalized.slice(
    0,
    -ending.length
  );
}


function getWorkQuantityRoots(
  value
) {
  return tokenizeWorkQuantityText(
    value
  ).map(
    getWorkQuantityRoot
  );
}


function workQuantityRootsMatch(
  firstRoot,
  secondRoot
) {
  if (
    !firstRoot ||
    !secondRoot
  ) {
    return false;
  }

  return (
    firstRoot ===
      secondRoot ||

    (
      firstRoot.length >= 4 &&
      secondRoot.length >= 4 &&

      (
        firstRoot.startsWith(
          secondRoot
        ) ||

        secondRoot.startsWith(
          firstRoot
        )
      )
    )
  );
}


/*
  ==================================================
  РАБОТА С ЧИСЛАМИ
  ==================================================
*/

function parseWorkQuantityNumber(
  value
) {
  const normalized =
    String(value || '')
      .replace(/\s/g, '')
      .replace(',', '.');

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


function normalizeWorkQuantityUnit(
  value
) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  const matchedRule =
    WORK_QUANTITY_UNIT_RULES.find(
      function (rule) {
        return rule.pattern.test(
          normalized
        );
      }
    );

  return matchedRule
    ? matchedRule.unit
    : normalized;
}


/*
  ==================================================
  ПРИОРИТЕТ ИСТОЧНИКА
  ==================================================
*/

function getWorkQuantitySourcePriority(
  classificationId
) {
  const priorities = {
    'work-volume':
      100,

    schedule:
      80,

    specification:
      60,

    'working-documents':
      50,

    estimate:
      40,

    'cable-journal':
      30,

    'explanatory-note':
      20,

    unknown:
      10
  };

  return (
    priorities[
      classificationId
    ] || 10
  );
}


/*
  ==================================================
  СОВПАДЕНИЕ РАБОТЫ С ТЕКСТОМ
  ==================================================
*/

function calculateWorkQuantityTextMatch(
  workName,
  text
) {
  const workRoots =
    Array.from(
      new Set(
        getWorkQuantityRoots(
          workName
        )
      )
    );

  const textRoots =
    Array.from(
      new Set(
        getWorkQuantityRoots(
          text
        )
      )
    );

  if (
    workRoots.length === 0
  ) {
    return {
      score: 0,
      matchedRoots: [],
      coverage: 0
    };
  }

  const matchedRoots =
    workRoots.filter(
      function (workRoot) {
        return textRoots.some(
          function (textRoot) {
            return workQuantityRootsMatch(
              workRoot,
              textRoot
            );
          }
        );
      }
    );

  const coverage =
    matchedRoots.length /
    workRoots.length;

  return {
    score:
      Math.round(
        coverage * 100
      ),

    matchedRoots,

    coverage
  };
}


/*
  ==================================================
  КАНДИДАТЫ КОЛИЧЕСТВА
  ==================================================
*/

function extractWorkQuantityCandidatesFromText(
  text
) {
  const sourceText =
    String(text || '');

  const candidates = [];

  /*
    Поддерживаем:

    5420 м
    5 420 м
    5420,5 м
    5420.5 м
    120 шт.
    12 компл.
  */

  const pattern =
    /(\d{1,3}(?:\s\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(п\.?\s*м\.?|м²|м2|м³|м3|км|м|шт\.?|штук|компл\.?|комплект(?:ов|а)?|кг|т)(?=\s|$|[.,;:)])/giu;

  let match = null;

  while (
    (
      match =
        pattern.exec(
          sourceText
        )
    ) !== null
  ) {
    const quantity =
      parseWorkQuantityNumber(
        match[1]
      );

    if (
      quantity === null ||
      quantity <= 0
    ) {
      continue;
    }

    const unit =
      normalizeWorkQuantityUnit(
        match[2]
      );

    candidates.push({
      quantity,
      unit,

      index:
        match.index,

      raw:
        match[0]
    });
  }

  return candidates;
}


/*
  ==================================================
  ОКНО ТЕКСТА ВОКРУГ КОЛИЧЕСТВА
  ==================================================
*/

function getWorkQuantityEvidenceWindow(
  text,
  candidateIndex,
  beforeLength,
  afterLength
) {
  const sourceText =
    String(text || '');

  const before =
    Number(beforeLength) ||
    220;

  const after =
    Number(afterLength) ||
    100;

  const start =
    Math.max(
      0,
      candidateIndex -
        before
    );

  const end =
    Math.min(
      sourceText.length,
      candidateIndex +
        after
    );

  return sourceText
    .slice(
      start,
      end
    )
    .replace(/\s+/g, ' ')
    .trim();
}


/*
  ==================================================
  ОЦЕНКА КАНДИДАТА
  ==================================================
*/

function scoreWorkQuantityCandidate(
  workName,
  candidate,
  pageText,
  sourcePriority
) {
  const evidence =
    getWorkQuantityEvidenceWindow(
      pageText,
      candidate.index,
      240,
      100
    );

  const workMatch =
    calculateWorkQuantityTextMatch(
      workName,
      evidence
    );

  let score = 0;

  /*
    Основной фактор —
    сколько ключевых слов работы
    присутствуют рядом с объёмом.
  */

  score +=
    workMatch.coverage *
    65;

  /*
    Приоритет типа документа.
  */

  score +=
    (
      Number(
        sourcePriority
      ) /
      100
    ) *
    20;

  /*
    Инженерные единицы.
  */

  if (
    [
      'м',
      'п.м.',
      'м²',
      'м³',
      'км',
      'шт',
      'компл.'
    ].includes(
      candidate.unit
    )
  ) {
    score += 10;
  }

  /*
    Сильное совпадение работы.
  */

  if (
    workMatch.coverage >=
      0.75
  ) {
    score += 5;
  }

  return {
    score:
      Math.min(
        Math.round(score),
        100
      ),

    evidence,

    workMatch
  };
}


/*
  ==================================================
  УРОВЕНЬ УВЕРЕННОСТИ
  ==================================================
*/

function getWorkQuantityConfidence(
  score
) {
  if (score >= 85) {
    return {
      level:
        'high',

      label:
        'Высокая'
    };
  }

  if (score >= 70) {
    return {
      level:
        'medium',

      label:
        'Средняя'
    };
  }

  if (score >= 55) {
    return {
      level:
        'low',

      label:
        'Низкая'
    };
  }

  return {
    level:
      'none',

    label:
      'Недостаточно данных'
  };
}


/*
  ==================================================
  АНАЛИЗ ОДНОГО ДОКУМЕНТА
  ==================================================
*/

function analyzeWorkQuantityDocument(
  documentItem,
  context
) {
  if (
    !documentItem ||
    !documentItem.analysis ||
    !documentItem.analysis.success ||
    !context
  ) {
    return [];
  }

  const extractedPages =
    Array.isArray(
      documentItem.analysis
        .extractedPages
    )
      ? documentItem.analysis
          .extractedPages
      : [];

  const classification =
    documentItem.analysis
      .documentClassification ||
    {};

  const classificationId =
    classification.id ||
    'unknown';

  const sourcePriority =
    getWorkQuantitySourcePriority(
      classificationId
    );

  const results = [];

  extractedPages.forEach(
    function (pageItem) {
      const pageText =
        String(
          pageItem.text ||
          ''
        );

      const quantityCandidates =
        extractWorkQuantityCandidatesFromText(
          pageText
        );

      quantityCandidates.forEach(
        function (
          quantityCandidate
        ) {
          const scoring =
            scoreWorkQuantityCandidate(
              context.work,
              quantityCandidate,
              pageText,
              sourcePriority
            );

          if (
            scoring.score < 45
          ) {
            return;
          }

          results.push({
            quantity:
              quantityCandidate.quantity,

            unit:
              quantityCandidate.unit,

            rawQuantity:
              quantityCandidate.raw,

            score:
              scoring.score,

            confidence:
              getWorkQuantityConfidence(
                scoring.score
              ),

            matchedRoots:
              scoring.workMatch
                .matchedRoots,

            workCoverage:
              scoring.workMatch
                .coverage,

            evidence:
              scoring.evidence,

            sourceDocument:
              documentItem.file
                ? documentItem.file.name
                : (
                    documentItem.analysis
                      .fileName ||
                    ''
                  ),

            sourcePage:
              pageItem.pageNumber,

            sourceType:
              classificationId,

            sourceLabel:
              classification.label ||
              'Тип документа не определён',

            sourcePriority,

            requiresEngineerConfirmation:
              true
          });
        }
      );
    }
  );

  return results;
}


/*
  ==================================================
  ПОЛУЧЕНИЕ ТЕКУЩИХ ДОКУМЕНТОВ
  ==================================================
*/

function getWorkQuantityProjectDocuments() {
  if (
    typeof uploadedProjectDocuments !==
      'undefined' &&
    Array.isArray(
      uploadedProjectDocuments
    )
  ) {
    return uploadedProjectDocuments;
  }

  return [];
}


/*
  ==================================================
  АКТИВНЫЙ КОНТЕКСТ
  ==================================================
*/

function getWorkQuantityActiveContext() {
  if (
    window.BuildMindWorkContexts &&
    typeof window
      .BuildMindWorkContexts
      .getActive === 'function'
  ) {
    return window
      .BuildMindWorkContexts
      .getActive();
  }

  return null;
}


/*
  ==================================================
  ГЛАВНЫЙ ПОИСК
  ==================================================
*/

function findBuildMindWorkQuantity(
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const context =
    settings.context ||
    getWorkQuantityActiveContext();

  if (!context) {
    return {
      success: false,

      errorCode:
        'ACTIVE_CONTEXT_NOT_FOUND',

      errorMessage:
        'Активный контекст работы не найден.'
    };
  }

  const documents =
    Array.isArray(
      settings.documents
    )
      ? settings.documents
      : getWorkQuantityProjectDocuments();

  const analyzedDocuments =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.analysis &&
          documentItem.analysis
            .success
        );
      }
    );

  if (
    analyzedDocuments.length ===
    0
  ) {
    return {
      success: false,

      errorCode:
        'ANALYZED_DOCUMENTS_NOT_FOUND',

      errorMessage:
        'Нет проанализированных документов с извлечённым текстом.',

      context,

      requiresEngineerConfirmation:
        true
    };
  }

  const candidates = [];

  analyzedDocuments.forEach(
    function (
      documentItem
    ) {
      candidates.push(
        ...analyzeWorkQuantityDocument(
          documentItem,
          context
        )
      );
    }
  );

  candidates.sort(
    function (
      first,
      second
    ) {
      if (
        second.score !==
        first.score
      ) {
        return (
          second.score -
          first.score
        );
      }

      return (
        second.sourcePriority -
        first.sourcePriority
      );
    }
  );

  const bestCandidate =
    candidates[0];

  if (
    !bestCandidate ||
    bestCandidate.score < 55
  ) {
    return {
      success: false,

      errorCode:
        'WORK_QUANTITY_NOT_CONFIDENT',

      errorMessage:
        'Надёжный объём работы в документах пока не найден.',

      context,

      candidates:
        candidates.slice(
          0,
          10
        ),

      requiresEngineerConfirmation:
        true
    };
  }

  return {
    success: true,

    version:
      BUILDMIND_WORK_QUANTITY_ENGINE_VERSION,

    context: {
      ...context
    },

    quantity:
      bestCandidate.quantity,

    unit:
      bestCandidate.unit,

    sourceDocument:
      bestCandidate.sourceDocument,

    sourcePage:
      bestCandidate.sourcePage,

    sourceType:
      bestCandidate.sourceType,

    sourceLabel:
      bestCandidate.sourceLabel,

    evidence:
      bestCandidate.evidence,

    score:
      bestCandidate.score,

    confidence:
      bestCandidate.confidence,

    matchedRoots:
      bestCandidate.matchedRoots,

    workCoverage:
      bestCandidate.workCoverage,

    alternatives:
      candidates
        .slice(1, 6),

    requiresEngineerConfirmation:
      true,

    decisionStatus:
      bestCandidate.confidence
        .level === 'high'
          ? 'candidate-high-confidence'
          : 'requires-review',

    disclaimer:
      'Объём найден автоматически в извлечённом тексте документа. ' +
      'Рекомендуется проверить название работы, единицу измерения, ' +
      'значение объёма и страницу-источник перед использованием в планировании.'
  };
}


/*
  ==================================================
  ТЕСТ НА ПЕРЕДАННЫХ СТРАНИЦАХ

  Нужен для безопасной проверки алгоритма
  до интеграции с Planning Engine.
  ==================================================
*/

function testBuildMindWorkQuantityPages(
  workName,
  pages,
  documentType
) {
  const fakeDocument = {
    file: {
      name:
        'DEMO-WORK-QUANTITY.pdf'
    },

    analysis: {
      success: true,

      documentClassification: {
        id:
          documentType ||
          'work-volume',

        label:
          'Тестовый документ'
      },

      extractedPages:
        Array.isArray(pages)
          ? pages
          : []
    }
  };

  return findBuildMindWorkQuantity({
    context: {
      id:
        'quantity-test',

      project:
        'Тест',

      object:
        'Тест',

      work:
        workName
    },

    documents: [
      fakeDocument
    ]
  });
}


/*
  ==================================================
  СВОДКА
  ==================================================
*/

function getBuildMindWorkQuantitySummary() {
  const documents =
    getWorkQuantityProjectDocuments();

  const analyzedCount =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.analysis &&
          documentItem.analysis
            .success
        );
      }
    ).length;

  return {
    version:
      BUILDMIND_WORK_QUANTITY_ENGINE_VERSION,

    projectDocuments:
      documents.length,

    analyzedDocuments:
      analyzedCount
  };
}


/*
  ==================================================
  PUBLIC API
  ==================================================
*/

window.BuildMindWorkQuantity = {
  version:
    BUILDMIND_WORK_QUANTITY_ENGINE_VERSION,

  find:
    findBuildMindWorkQuantity,

  analyzeDocument:
    analyzeWorkQuantityDocument,

  calculateTextMatch:
    calculateWorkQuantityTextMatch,

  extractCandidates:
    extractWorkQuantityCandidatesFromText,

  testPages:
    testBuildMindWorkQuantityPages,

  getSummary:
    getBuildMindWorkQuantitySummary
};


console.info(
  'BuildMind Work Quantity Engine загружен:',
  getBuildMindWorkQuantitySummary()
);
