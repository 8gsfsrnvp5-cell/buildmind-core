'use strict';

/* ==================================================
   BUILDMIND COMPOSITE PDF ENGINE — V1

   Назначение:
   - анализировать каждую страницу PDF отдельно;
   - находить договор, ВОР, ГПР и коммерческие приложения
     внутри одного физического файла;
   - объединять соседние страницы в логические разделы;
   - сохранять номера страниц и признаки, на которых
     основан вывод.

   Движок не утверждает найденные разделы автоматически.
   ================================================== */

const BUILDMIND_COMPOSITE_PDF_VERSION =
  'composite-pdf-v1';

const COMPOSITE_PDF_KIND_LABELS = {
  agreement:
    'Договор / дополнительное соглашение',

  'work-volume':
    'Ведомость объёмов работ',

  schedule:
    'График производства работ',

  'commercial-proposal':
    'Договорная цена / коммерческое предложение',

  estimate:
    'Сметная документация',

  specification:
    'Спецификация',

  'project-documentation':
    'Проектная / рабочая документация',

  other:
    'Раздел требует определения'
};

const COMPOSITE_PDF_RULES = [
  {
    kind: 'work-volume',

    title: [
      /ведомост[а-я]*\s+(?:объем|объ[её]м|обьем)[а-я]*\s+работ[а-я]*/,
      /сводн[а-я]*\s+ведомост[а-я]*\s+(?:объем|объ[её]м|обьем)[а-я]*\s+работ[а-я]*/,
      /ведомост[а-я]*\s+объединенн[а-я]*\s+работ[а-я]*/,
      /ведомост[а-я]*\s+объединённ[а-я]*\s+работ[а-я]*/,
      /(^|[^а-яa-z0-9])вор([^а-яa-z0-9]|$)/
    ],

    strong: [
      /наименовани[а-я]*\s+работ[а-я]*/,
      /вид[а-я]*\s+работ[а-я]*/,
      /объем[а-я]*\s+работ[а-я]*/,
      /объ[её]м[а-я]*\s+работ[а-я]*/
    ],

    weak: [
      /ед\.?\s*изм\.?/,
      /единиц[а-я]*\s+измерени[а-я]*/,
      /количеств[а-я]*/,
      /итого\s+по\s+ведомост[а-я]*/
    ]
  },

  {
    kind: 'schedule',

    title: [
      /график[а-я]*\s+производств[а-я]*\s+работ[а-я]*/,
      /календарн[а-я]*\s+график[а-я]*/,
      /календарн[а-я]*\s+план[а-я]*/,
      /(^|[^а-яa-z0-9])гпр([^а-яa-z0-9]|$)/
    ],

    strong: [
      /начал[а-я]*\s+работ[а-я]*/,
      /окончани[а-я]*\s+работ[а-я]*/,
      /дат[а-я]*\s+начал[а-я]*/,
      /дат[а-я]*\s+окончани[а-я]*/,
      /продолжительност[а-я]*/
    ],

    weak: [
      /наименовани[а-я]*\s+работ[а-я]*/,
      /срок[а-я]*\s+выполнени[а-я]*/,
      /январ[а-я]*|феврал[а-я]*|март[а-я]*|апрел[а-я]*|ма[йя]|июн[а-я]*|июл[а-я]*|август[а-я]*|сентябр[а-я]*|октябр[а-я]*|ноябр[а-я]*|декабр[а-я]*/
    ]
  },

  {
    kind: 'commercial-proposal',

    title: [
      /коммерческ[а-я]*\s+предложени[а-я]*/,
      /технико-коммерческ[а-я]*\s+предложени[а-я]*/,
      /ведомост[а-я]*\s+договорн[а-я]*\s+цен[а-я]*/,
      /договорн[а-я]*\s+цен[а-я]*/,
      /ценов[а-я]*\s+предложени[а-я]*/
    ],

    strong: [
      /стоимост[а-я]*\s+работ[а-я]*/,
      /цен[а-я]*\s+за\s+единиц[а-я]*/,
      /итого\s+к\s+оплат[а-я]*/,
      /всего\s+по\s+договор[а-я]*/
    ],

    weak: [
      /без\s+ндс/,
      /в\s+том\s+числе\s+ндс/,
      /руб\.?|рубл[а-я]*/,
      /стоимост[а-я]*/
    ]
  },

  {
    kind: 'estimate',

    title: [
      /локальн[а-я]*\s+смет[а-я]*/,
      /сметн[а-я]*\s+расч[её]т[а-я]*/,
      /сметн[а-я]*\s+документац[а-я]*/,
      /(^|[^а-яa-z0-9])смета([^а-яa-z0-9]|$)/
    ],

    strong: [
      /сметн[а-я]*\s+стоимост[а-я]*/,
      /шифр[а-я]*\s+расценк[а-я]*/,
      /всего\s+по\s+смете/
    ],

    weak: [
      /накладн[а-я]*\s+расход[а-я]*/,
      /сметн[а-я]*\s+прибыл[а-я]*/,
      /базисн[а-я]*\s+цен[а-я]*/
    ]
  },

  {
    kind: 'specification',

    title: [
      /спецификац[а-я]*\s+материал[а-я]*/,
      /спецификац[а-я]*\s+оборудован[а-я]*/,
      /(^|[^а-яa-z0-9])спецификац[а-я]*/
    ],

    strong: [
      /наименовани[а-я]*\s+и\s+техническ[а-я]*\s+характеристик[а-я]*/,
      /тип[а-я]*,?\s+марк[а-я]*,?\s+обозначени[а-я]*/
    ],

    weak: [
      /ед\.?\s*изм\.?/,
      /количеств[а-я]*/,
      /масс[а-я]*\s+единиц[а-я]*/
    ]
  },

  {
    kind: 'project-documentation',

    title: [
      /проектн[а-я]*\s+документац[а-я]*/,
      /рабоч[а-я]*\s+документац[а-я]*/,
      /пояснительн[а-я]*\s+записк[а-я]*/,
      /рабоч[а-я]*\s+проект[а-я]*/
    ],

    strong: [
      /общие\s+указани[а-я]*/,
      /общие\s+данные/,
      /принят[а-я]*\s+техническ[а-я]*\s+решени[а-я]*/
    ],

    weak: [
      /стади[а-я]*\s+лист/,
      /инв\.?\s*№/,
      /н\.?\s*контр\.?/
    ]
  },

  {
    kind: 'agreement',

    title: [
      /договор[а-я]*(?:\s+строительн[а-я]*)?\s+подряд[а-я]*/,
      /договор\s*№\s*[а-яa-z0-9/_\-.]+/,
      /дополнительн[а-я]*\s+соглашени[а-я]*/,
      /контракт\s*№\s*[а-яa-z0-9/_\-.]+/
    ],

    strong: [
      /предмет\s+договор[а-я]*/,
      /заказчик[а-я]*\s+поруча[а-я]*/,
      /подрядчик[а-я]*\s+обязу[а-я]*/,
      /права\s+и\s+обязанност[а-я]*\s+сторон/,
      /реквизит[а-я]*\s+сторон/
    ],

    weak: [
      /заказчик[а-я]*/,
      /подрядчик[а-я]*/,
      /сторон[а-я]*\s+заключил[а-я]*/,
      /цена\s+договор[а-я]*/
    ]
  }
];

function normalizeCompositePdfText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function meaningfulCompositePdfLength(value) {
  return normalizeCompositePdfText(value)
    .replace(/[^а-яa-z0-9]/g, '')
    .length;
}

function toCompositePdfIsoDate(
  year,
  month,
  day
) {
  let numericYear =
    Number(year);

  if (numericYear < 100) {
    numericYear += 2000;
  }

  const numericMonth =
    Number(month);
  const numericDay =
    Number(day);

  const date =
    new Date(
      Date.UTC(
        numericYear,
        numericMonth - 1,
        numericDay
      )
    );

  if (
    date.getUTCFullYear() !==
      numericYear ||
    date.getUTCMonth() !==
      numericMonth - 1 ||
    date.getUTCDate() !==
      numericDay
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function extractCompositePdfDates(value) {
  const text =
    String(value || '');
  const dates = [];

  const dayFirstPattern =
    /(^|[^\d])(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?!\d)/g;

  let match = null;

  while (
    (
      match =
        dayFirstPattern.exec(text)
    ) !== null
  ) {
    const date =
      toCompositePdfIsoDate(
        match[4],
        match[3],
        match[2]
      );

    if (date) {
      dates.push(date);
    }
  }

  const isoPattern =
    /(^|[^\d])(20\d{2})-(\d{1,2})-(\d{1,2})(?!\d)/g;

  while (
    (
      match =
        isoPattern.exec(text)
    ) !== null
  ) {
    const date =
      toCompositePdfIsoDate(
        match[2],
        match[3],
        match[4]
      );

    if (date) {
      dates.push(date);
    }
  }

  return Array.from(
    new Set(dates)
  ).sort();
}

function getCompositePdfAnalysisDate(
  value
) {
  const normalized =
    String(value || '')
      .slice(0, 10);

  if (
    /^20\d{2}-\d{2}-\d{2}$/
      .test(normalized)
  ) {
    return normalized;
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
}

function getCompositePdfLeadText(text) {
  return normalizeCompositePdfText(text)
    .slice(0, 1800);
}

function testCompositePdfPattern(pattern, text) {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function collectCompositePdfMatches(patterns, text) {
  return patterns
    .filter(function (pattern) {
      return testCompositePdfPattern(pattern, text);
    });
}

function isCompositePdfContentsPage(text) {
  const normalized =
    normalizeCompositePdfText(text);

  const hasContentsHeading =
    /(^|\n)\s*(содержание|оглавление|перечень\s+приложений)\s*($|\n)/
      .test(normalized);

  if (!hasContentsHeading) {
    return false;
  }

  const mentionedKinds =
    COMPOSITE_PDF_RULES.filter(
      function (rule) {
        return rule.title.some(
          function (pattern) {
            return testCompositePdfPattern(
              pattern,
              normalized
            );
          }
        );
      }
    ).length;

  return mentionedKinds >= 2;
}

function getCompositePdfStructuralBonuses(text) {
  const normalized =
    normalizeCompositePdfText(text);

  const bonuses = {};

  const hasNameColumn =
    /наименовани[а-я]*\s+(?:работ[а-я]*|затрат[а-я]*)/
      .test(normalized);

  const hasUnitColumn =
    /ед\.?\s*изм\.?|единиц[а-я]*\s+измерени[а-я]*/
      .test(normalized);

  const hasQuantityColumn =
    /количеств[а-я]*|объем[а-я]*|объ[её]м[а-я]*/
      .test(normalized);

  if (
    hasNameColumn &&
    hasUnitColumn &&
    hasQuantityColumn
  ) {
    bonuses['work-volume'] = 9;
  }

  const hasScheduleStart =
    /(^|\s)(начало|дата\s+начала)(\s|$)/
      .test(normalized);

  const hasScheduleFinish =
    /(^|\s)(окончание|дата\s+окончания)(\s|$)/
      .test(normalized);

  if (
    hasNameColumn &&
    hasScheduleStart &&
    hasScheduleFinish
  ) {
    bonuses.schedule = 11;
  }

  if (
    /цен[а-я]*\s+за\s+единиц[а-я]*|стоимост[а-я]*\s+всего/
      .test(normalized) &&
    /ндс|руб\.?|рубл[а-я]*/
      .test(normalized)
  ) {
    bonuses['commercial-proposal'] = 8;
  }

  const clauseMatches =
    normalized.match(/(^|\s)\d{1,2}\.\d{1,2}\.?\s/g) ||
    [];

  if (
    clauseMatches.length >= 4 &&
    /заказчик|подрядчик/.test(normalized)
  ) {
    bonuses.agreement = 7;
  }

  return bonuses;
}

function classifyCompositePdfPage(page) {
  const pageNumber =
    Number(page?.pageNumber) || 0;

  const rawText =
    String(page?.text || '');

  const normalized =
    normalizeCompositePdfText(rawText);

  const leadText =
    getCompositePdfLeadText(rawText);

  const meaningfulLength =
    meaningfulCompositePdfLength(rawText);

  const contentsPage =
    isCompositePdfContentsPage(rawText);

  if (meaningfulLength < 20) {
    return {
      pageNumber,
      kind: 'other',
      label:
        COMPOSITE_PDF_KIND_LABELS.other,
      confidence: 'low',
      score: 0,
      anchor: false,
      evidence: [],
      alternatives: [],
      requiresOcr:
        page?.extractionMethod !== 'ocr',
      extractionMethod:
        page?.extractionMethod || 'none',
      ocrConfidence:
        page?.ocrConfidence ?? null,
      textLength:
        rawText.length,
      meaningfulLength,
      textSample: '',
      dateValues: []
    };
  }

  const bonuses =
    getCompositePdfStructuralBonuses(rawText);

  const results =
    COMPOSITE_PDF_RULES.map(
      function (rule) {
        const titleLead =
          collectCompositePdfMatches(
            rule.title,
            leadText
          );

        const titleBody =
          collectCompositePdfMatches(
            rule.title,
            normalized
          );

        const strong =
          collectCompositePdfMatches(
            rule.strong,
            normalized
          );

        const weak =
          collectCompositePdfMatches(
            rule.weak,
            normalized
          );

        const structuralBonus =
          Number(bonuses[rule.kind]) || 0;

        let score =
          titleLead.length * 24 +
          Math.max(
            0,
            titleBody.length -
              titleLead.length
          ) * 10 +
          strong.length * 5 +
          weak.length * 2 +
          structuralBonus;

        if (contentsPage) {
          score =
            Math.min(
              score,
              5
            );
        }

        const evidence = [];

        if (titleLead.length > 0) {
          evidence.push(
            'заголовок раздела'
          );
        } else if (titleBody.length > 0) {
          evidence.push(
            'явное название раздела'
          );
        }

        if (strong.length > 0) {
          evidence.push(
            'характерные термины'
          );
        }

        if (weak.length > 0) {
          evidence.push(
            'дополнительные признаки'
          );
        }

        if (structuralBonus > 0) {
          evidence.push(
            'структура таблицы / документа'
          );
        }

        return {
          kind: rule.kind,
          score,
          anchor:
            !contentsPage &&
            (
              titleLead.length > 0 ||
              score >= 16
            ),
          evidence
        };
      }
    )
    .sort(function (first, second) {
      return second.score - first.score;
    });

  const best = results[0];
  const second = results[1];
  const hasResult =
    best &&
    best.score >= 6;

  let confidence = 'low';

  if (hasResult) {
    if (
      best.anchor &&
      best.score >= 20 &&
      best.score >=
        (second?.score || 0) + 5
    ) {
      confidence = 'high';
    } else if (
      best.score >= 10 &&
      best.score >=
        (second?.score || 0) + 2
    ) {
      confidence = 'medium';
    }
  }

  const kind =
    hasResult
      ? best.kind
      : 'other';

  return {
    pageNumber,
    kind,
    label:
      COMPOSITE_PDF_KIND_LABELS[kind] ||
      COMPOSITE_PDF_KIND_LABELS.other,
    confidence,
    score:
      hasResult
        ? best.score
        : 0,
    anchor:
      Boolean(
        hasResult &&
        best.anchor
      ),
    evidence:
      hasResult
        ? Array.from(
            new Set(best.evidence)
          )
        : contentsPage
          ? ['содержание / перечень приложений']
          : [],
    alternatives:
      results
        .filter(function (item) {
          return item.score > 0;
        })
        .slice(1, 3)
        .map(function (item) {
          return {
            kind: item.kind,
            score: item.score
          };
        }),
    requiresOcr: false,
    extractionMethod:
      page?.extractionMethod || 'text',
    ocrConfidence:
      page?.ocrConfidence ?? null,
    textLength:
      rawText.length,
    meaningfulLength,
    textSample:
      normalized.slice(0, 280),
    dateValues:
      extractCompositePdfDates(
        rawText
      ),
    contentsPage
  };
}

function assignCompositePdfPageKinds(pageResults) {
  const assigned =
    pageResults.map(function (page) {
      return {
        ...page,
        assignedKind: null,
        inherited: false
      };
    });

  let activeKind = null;

  assigned.forEach(function (page) {
    if (page.anchor) {
      activeKind = page.kind;
      page.assignedKind = page.kind;
      return;
    }

    if (!activeKind) {
      if (
        page.kind !== 'other' &&
        page.score >= 10
      ) {
        activeKind = page.kind;
        page.assignedKind = page.kind;
      }

      return;
    }

    if (
      page.kind === activeKind ||
      page.kind === 'other' ||
      page.score < 12
    ) {
      page.assignedKind = activeKind;
      page.inherited =
        page.kind !== activeKind;
      return;
    }

    activeKind = page.kind;
    page.assignedKind = page.kind;
  });

  const firstAssignedIndex =
    assigned.findIndex(function (page) {
      return Boolean(page.assignedKind);
    });

  if (firstAssignedIndex > 0) {
    const firstKind =
      assigned[firstAssignedIndex]
        .assignedKind;

    for (
      let index = 0;
      index < firstAssignedIndex;
      index += 1
    ) {
      assigned[index].assignedKind =
        firstKind;
      assigned[index].inherited = true;
    }
  }

  assigned.forEach(function (page) {
    if (!page.assignedKind) {
      page.assignedKind =
        page.kind !== 'other'
          ? page.kind
          : 'other';
    }
  });

  return assigned;
}

function createCompositePdfSections(
  pageResults,
  analysisDate
) {
  const assigned =
    assignCompositePdfPageKinds(
      pageResults
    );

  const sections = [];

  assigned.forEach(function (page) {
    const kind =
      page.assignedKind || 'other';

    let current =
      sections[sections.length - 1];

    if (
      !current ||
      current.kind !== kind
    ) {
      current = {
        id:
          `pdf-section-${sections.length + 1}`,
        kind,
        label:
          COMPOSITE_PDF_KIND_LABELS[kind] ||
          COMPOSITE_PDF_KIND_LABELS.other,
        startPage: page.pageNumber,
        endPage: page.pageNumber,
        pageNumbers: [],
        confidence: 'low',
        evidence: [],
        extractionMethods: [],
        ocrPages: [],
        unreadablePages: [],
        anchorPages: [],
        dateValues: [],
        maxScore: 0,
        textSample: ''
      };

      sections.push(current);
    }

    current.pageNumbers.push(
      page.pageNumber
    );
    current.endPage =
      page.pageNumber;
    current.maxScore =
      Math.max(
        current.maxScore,
        Number(page.score) || 0
      );
    current.evidence.push(
      ...(
        Array.isArray(page.evidence)
          ? page.evidence
          : []
      )
    );
    current.dateValues.push(
      ...(
        Array.isArray(page.dateValues)
          ? page.dateValues
          : []
      )
    );
    current.extractionMethods.push(
      page.extractionMethod || 'none'
    );

    if (page.anchor) {
      current.anchorPages.push(
        page.pageNumber
      );
    }

    if (
      page.extractionMethod === 'ocr'
    ) {
      current.ocrPages.push(
        page.pageNumber
      );
    }

    if (page.meaningfulLength < 20) {
      current.unreadablePages.push(
        page.pageNumber
      );
    }

    if (
      !current.textSample &&
      page.textSample
    ) {
      current.textSample =
        page.textSample;
    }
  });

  const currentDate =
    getCompositePdfAnalysisDate(
      analysisDate
    );

  return sections.map(function (section) {
    const hasAnchor =
      section.anchorPages.length > 0;

    let confidence = 'low';

    if (
      hasAnchor &&
      section.maxScore >= 20
    ) {
      confidence = 'high';
    } else if (
      section.maxScore >= 10
    ) {
      confidence = 'medium';
    }

    const dates =
      Array.from(
        new Set(section.dateValues)
      ).sort();

    const dateRange =
      dates.length > 0
        ? {
            startDate: dates[0],
            endDate:
              dates[dates.length - 1],
            datesCount:
              dates.length
          }
        : null;

    let scheduleStatus = null;

    if (
      section.kind === 'schedule' &&
      dateRange
    ) {
      if (
        dateRange.endDate <
        currentDate
      ) {
        scheduleStatus = 'expired';
      } else if (
        dateRange.startDate >
        currentDate
      ) {
        scheduleStatus = 'upcoming';
      } else {
        scheduleStatus = 'active';
      }
    }

    return {
      ...section,
      confidence,
      evidence:
        Array.from(
          new Set(section.evidence)
        ),
      extractionMethods:
        Array.from(
          new Set(section.extractionMethods)
        ),
      dateValues: dates,
      dateRange,
      scheduleStatus,
      analysisDate:
        currentDate
    };
  });
}

function analyzeCompositePdfPages(
  pages,
  options = {}
) {
  const normalizedPages =
    (Array.isArray(pages) ? pages : [])
      .map(function (page, index) {
        return {
          ...page,
          pageNumber:
            Number(page?.pageNumber) ||
            index + 1
        };
      })
      .sort(function (first, second) {
        return first.pageNumber - second.pageNumber;
      });

  const pageResults =
    normalizedPages.map(
      classifyCompositePdfPage
    );

  const sections =
    createCompositePdfSections(
      pageResults,
      options.analysisDate
    );

  const meaningfulSections =
    sections.filter(function (section) {
      return section.kind !== 'other';
    });

  const detectedKinds =
    Array.from(
      new Set(
        meaningfulSections.map(
          function (section) {
            return section.kind;
          }
        )
      )
    );

  const requiresOcrPages =
    pageResults
      .filter(function (page) {
        return page.requiresOcr;
      })
      .map(function (page) {
        return page.pageNumber;
      });

  const ocrPages =
    pageResults
      .filter(function (page) {
        return page.extractionMethod === 'ocr';
      })
      .map(function (page) {
        return page.pageNumber;
      });

  const unreadablePages =
    pageResults
      .filter(function (page) {
        return page.meaningfulLength < 20;
      })
      .map(function (page) {
        return page.pageNumber;
      });

  return {
    success: true,
    version:
      BUILDMIND_COMPOSITE_PDF_VERSION,
    totalPages:
      normalizedPages.length,
    isComposite:
      detectedKinds.length >= 2,
    detectedKinds,
    sections,
    meaningfulSections,
    pageResults,
    requiresOcrPages,
    ocrPages,
    unreadablePages,
    counts: {
      sections:
        meaningfulSections.length,
      agreements:
        meaningfulSections.filter(
          function (section) {
            return section.kind === 'agreement';
          }
        ).length,
      workVolumes:
        meaningfulSections.filter(
          function (section) {
            return section.kind === 'work-volume';
          }
        ).length,
      schedules:
        meaningfulSections.filter(
          function (section) {
            return section.kind === 'schedule';
          }
        ).length,
      commercial:
        meaningfulSections.filter(
          function (section) {
            return [
              'commercial-proposal',
              'estimate'
            ].includes(section.kind);
          }
        ).length,
      ocrPages:
        ocrPages.length,
      unreadablePages:
        unreadablePages.length
    }
  };
}

const BuildMindCompositePdfApi = {
  version:
    BUILDMIND_COMPOSITE_PDF_VERSION,
  kindLabels:
    COMPOSITE_PDF_KIND_LABELS,
  normalizeText:
    normalizeCompositePdfText,
  meaningfulTextLength:
    meaningfulCompositePdfLength,
  extractDates:
    extractCompositePdfDates,
  classifyPage:
    classifyCompositePdfPage,
  analyzePages:
    analyzeCompositePdfPages
};

if (typeof window !== 'undefined') {
  window.BuildMindCompositePdf =
    BuildMindCompositePdfApi;
}

if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports =
    BuildMindCompositePdfApi;
}

console.info(
  'BuildMind Composite PDF Engine загружен:',
  BUILDMIND_COMPOSITE_PDF_VERSION
);
