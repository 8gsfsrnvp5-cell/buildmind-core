'use strict';

/*
  ==================================================
  BUILDMIND WORK VOLUME ENGINE — DEMO V1
  ==================================================

  Читает XLSX / XLS / CSV, ищет таблицы вида
  «работа — единица — количество», сохраняет
  документ / лист / строку и сопоставляет строку ВОР
  с активным контекстом BuildMind.
*/

const BUILDMIND_WORK_VOLUME_ENGINE_VERSION =
  'work-volume-engine-demo-v1';

const WORK_VOLUME_SUPPORTED_EXTENSIONS = [
  'xlsx',
  'xls',
  'csv'
];

const WORK_VOLUME_HEADER_RULES = {
  work: [
    'наименование работ и затрат',
    'наименование работ',
    'наименование работы',
    'вид работ',
    'вид работы',
    'перечень работ',
    'описание работ',
    'работа'
  ],

  unit: [
    'единица измерения',
    'ед. изм.',
    'ед изм',
    'ед.изм.',
    'единица изм.',
    'единица'
  ],

  quantity: [
    'количество по проекту',
    'объем по проекту',
    'объём по проекту',
    'объем работ',
    'объём работ',
    'количество',
    'кол-во',
    'кол во',
    'объем',
    'объём'
  ]
};


function normalizeWorkVolumeText(
  value
) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\u00a0/g, ' ')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[.:;,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function getWorkVolumeFileExtension(
  file
) {
  const parts =
    String(
      file && file.name
        ? file.name
        : ''
    ).split('.');

  return parts.length > 1
    ? parts.pop().toLowerCase()
    : '';
}


function parseWorkVolumeNumber(
  value
) {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const normalized =
    String(value ?? '')
      .replace(/\u00a0/g, '')
      .replace(/\s/g, '')
      .replace(',', '.')
      .trim();

  if (
    !normalized ||
    !/^[+-]?\d+(?:\.\d+)?$/.test(
      normalized
    )
  ) {
    return null;
  }

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


function normalizeWorkVolumeUnit(
  value
) {
  const normalized =
    normalizeWorkVolumeText(
      value
    ).replace(/\s+/g, '');

  const units = {
    м: 'м',
    пм: 'п.м.',
    'п.м': 'п.м.',
    'пог.м': 'п.м.',
    погм: 'п.м.',
    м2: 'м²',
    'м²': 'м²',
    м3: 'м³',
    'м³': 'м³',
    км: 'км',
    шт: 'шт',
    штук: 'шт',
    компл: 'компл.',
    комплект: 'компл.',
    комплектов: 'компл.',
    т: 'т',
    кг: 'кг'
  };

  return units[normalized] || '';
}


function cleanWorkVolumeWorkName(
  value
) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+/, '')
    .replace(/[-–—\s]+$/, '')
    .trim();
}


function scoreWorkVolumeHeaderCell(
  cellValue,
  aliases
) {
  const normalizedCell =
    normalizeWorkVolumeText(
      cellValue
    );

  if (!normalizedCell) {
    return 0;
  }

  let bestScore = 0;

  aliases.forEach(
    function (alias) {
      const normalizedAlias =
        normalizeWorkVolumeText(
          alias
        );

      if (!normalizedAlias) {
        return;
      }

      if (
        normalizedCell ===
        normalizedAlias
      ) {
        bestScore =
          Math.max(
            bestScore,
            5
          );

        return;
      }

      if (
        normalizedAlias.length >= 5 &&
        normalizedCell.includes(
          normalizedAlias
        )
      ) {
        bestScore =
          Math.max(
            bestScore,
            4
          );
      }
    }
  );

  return bestScore;
}


function mapWorkVolumeHeaderRow(
  row
) {
  const cells =
    Array.isArray(row)
      ? row
      : [];

  const result = {
    workColumn: null,
    unitColumn: null,
    quantityColumn: null,
    workScore: 0,
    unitScore: 0,
    quantityScore: 0,
    score: 0
  };

  cells.forEach(
    function (
      cellValue,
      columnIndex
    ) {
      const workScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES.work
        );

      if (
        workScore >
        result.workScore
      ) {
        result.workScore =
          workScore;

        result.workColumn =
          columnIndex;
      }

      const unitScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES.unit
        );

      if (
        unitScore >
        result.unitScore
      ) {
        result.unitScore =
          unitScore;

        result.unitColumn =
          columnIndex;
      }

      const quantityScore =
        scoreWorkVolumeHeaderCell(
          cellValue,
          WORK_VOLUME_HEADER_RULES.quantity
        );

      if (
        quantityScore >
        result.quantityScore
      ) {
        result.quantityScore =
          quantityScore;

        result.quantityColumn =
          columnIndex;
      }
    }
  );

  result.score =
    result.workScore +
    result.unitScore +
    result.quantityScore;

  return result;
}


function getWorkVolumeHeaderConfidence(
  score
) {
  if (score >= 14) {
    return {
      level: 'high',
      label: 'Высокая'
    };
  }

  if (score >= 11) {
    return {
      level: 'medium',
      label: 'Средняя'
    };
  }

  return {
    level: 'low',
    label: 'Низкая'
  };
}


function findWorkVolumeHeader(
  rows
) {
  const sourceRows =
    Array.isArray(rows)
      ? rows
      : [];

  const scanLimit =
    Math.min(
      sourceRows.length,
      40
    );

  let best = null;

  for (
    let rowIndex = 0;
    rowIndex < scanLimit;
    rowIndex += 1
  ) {
    const mapped =
      mapWorkVolumeHeaderRow(
        sourceRows[rowIndex]
      );

    const complete =
      Boolean(
        mapped.workColumn !== null &&
        mapped.unitColumn !== null &&
        mapped.quantityColumn !== null
      );

    if (!complete) {
      continue;
    }

    if (
      !best ||
      mapped.score >
      best.score
    ) {
      best = {
        ...mapped,

        rowIndex,

        sourceRow:
          rowIndex + 1,

        confidence:
          getWorkVolumeHeaderConfidence(
            mapped.score
          )
      };
    }
  }

  return best;
}


function classifyWorkVolumeCandidate(
  workName
) {
  const taxonomyEngine =
    window.BuildMindWorkTaxonomy;

  if (
    !taxonomyEngine ||
    typeof taxonomyEngine
      .classify !==
      'function'
  ) {
    return null;
  }

  try {
    return taxonomyEngine.classify(
      workName
    );
  } catch (error) {
    console.warn(
      'Work Volume: не удалось применить Work Taxonomy:',
      error
    );

    return null;
  }
}


function analyzeWorkVolumeRows(
  rows,
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const sourceRows =
    Array.isArray(rows)
      ? rows
      : [];

  const sourceDocument =
    settings.sourceDocument ||
    '';

  const sourceSheet =
    settings.sourceSheet ||
    '';

  const header =
    findWorkVolumeHeader(
      sourceRows
    );

  if (!header) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_HEADER_NOT_FOUND',

      errorMessage:
        'Не найдены однозначные колонки работы, единицы измерения и объёма.',

      sourceDocument,

      sourceSheet,

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  const candidates = [];

  for (
    let rowIndex =
      header.rowIndex + 1;

    rowIndex <
      sourceRows.length;

    rowIndex += 1
  ) {
    const row =
      Array.isArray(
        sourceRows[rowIndex]
      )
        ? sourceRows[rowIndex]
        : [];

    const workName =
      cleanWorkVolumeWorkName(
        row[
          header.workColumn
        ]
      );

    const unit =
      normalizeWorkVolumeUnit(
        row[
          header.unitColumn
        ]
      );

    const quantity =
      parseWorkVolumeNumber(
        row[
          header.quantityColumn
        ]
      );

    if (
      !workName ||
      workName.length < 3 ||
      !unit ||
      quantity === null ||
      quantity <= 0
    ) {
      continue;
    }

    candidates.push({
      workName,

      quantity,

      unit,

      sourceType:
        'work-volume',

      sourceDocument,

      sourceSheet,

      sourceRow:
        rowIndex + 1,

      headerRow:
        header.sourceRow,

      headerConfidence:
        header.confidence,

      taxonomy:
        classifyWorkVolumeCandidate(
          workName
        ),

      decisionStatus:
        'requires-review',

      requiresEngineerConfirmation:
        true
    });

    if (
      candidates.length >=
      500
    ) {
      break;
    }
  }

  return {
    success:
      candidates.length > 0,

    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    sourceDocument,

    sourceSheet,

    header: {
      sourceRow:
        header.sourceRow,

      workColumn:
        header.workColumn,

      unitColumn:
        header.unitColumn,

      quantityColumn:
        header.quantityColumn,

      score:
        header.score,

      confidence:
        header.confidence
    },

    candidates,

    candidatesCount:
      candidates.length,

    requiresEngineerConfirmation:
      true
  };
}


function getWorkVolumeSheetRows(
  worksheet
) {
  if (
    !window.XLSX ||
    !window.XLSX.utils ||
    typeof window.XLSX.utils
      .sheet_to_json !==
      'function'
  ) {
    throw new Error(
      'XLSX_LIBRARY_NOT_AVAILABLE'
    );
  }

  return window.XLSX.utils
    .sheet_to_json(
      worksheet,
      {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false
      }
    );
}


function analyzeWorkVolumeWorkbook(
  workbook,
  options
) {
  const settings =
    options &&
    typeof options ===
      'object'
      ? options
      : {};

  const sourceDocument =
    settings.sourceDocument ||
    '';

  if (
    !workbook ||
    !Array.isArray(
      workbook.SheetNames
    ) ||
    !workbook.Sheets
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_WORKBOOK_INVALID',

      errorMessage:
        'Структура Excel-книги не распознана.',

      sourceDocument,

      sheets: [],

      candidates: [],

      candidatesCount: 0,

      requiresEngineerConfirmation:
        true
    };
  }

  const sheets = [];

  const candidates = [];

  workbook.SheetNames.forEach(
    function (sheetName) {
      const worksheet =
        workbook.Sheets[
          sheetName
        ];

      if (!worksheet) {
        return;
      }

      const rows =
        getWorkVolumeSheetRows(
          worksheet
        );

      const result =
        analyzeWorkVolumeRows(
          rows,
          {
            sourceDocument,

            sourceSheet:
              sheetName
          }
        );

      sheets.push({
        sheetName,

        success:
          result.success,

        errorCode:
          result.errorCode ||
          null,

        header:
          result.header ||
          null,

        candidatesCount:
          result.candidatesCount ||
          0
      });

      if (
        Array.isArray(
          result.candidates
        )
      ) {
        candidates.push(
          ...result.candidates
        );
      }
    }
  );

  return {
    success:
      candidates.length > 0,

    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    sourceDocument,

    sheets,

    candidates,

    candidatesCount:
      candidates.length,

    requiresEngineerConfirmation:
      true
  };
}


async function analyzeWorkVolumeFile(
  file
) {
  if (!file) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_FILE_NOT_FOUND',

      errorMessage:
        'Файл для анализа не передан.',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  const extension =
    getWorkVolumeFileExtension(
      file
    );

  if (
    !WORK_VOLUME_SUPPORTED_EXTENSIONS
      .includes(extension)
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_FILE_TYPE_NOT_SUPPORTED',

      errorMessage:
        'Поддерживаются XLSX, XLS и CSV.',

      sourceDocument:
        file.name ||
        '',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  if (
    !window.XLSX ||
    typeof window.XLSX.read !==
      'function'
  ) {
    return {
      success: false,

      errorCode:
        'XLSX_LIBRARY_NOT_AVAILABLE',

      errorMessage:
        'Excel-библиотека XLSX не загружена.',

      sourceDocument:
        file.name ||
        '',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  try {
    const arrayBuffer =
      await file.arrayBuffer();

    const workbook =
      window.XLSX.read(
        arrayBuffer,
        {
          type: 'array',
          cellDates: false
        }
      );

    return analyzeWorkVolumeWorkbook(
      workbook,
      {
        sourceDocument:
          file.name ||
          ''
      }
    );
  } catch (error) {
    console.error(
      'Ошибка анализа ВОР / Excel:',
      error
    );

    return {
      success: false,

      errorCode:
        'WORK_VOLUME_FILE_READ_ERROR',

      errorMessage:
        'Не удалось прочитать табличный документ.',

      sourceDocument:
        file.name ||
        '',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }
}


async function analyzeWorkVolumeDocument(
  documentItem
) {
  if (
    !documentItem ||
    !documentItem.file
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_DOCUMENT_NOT_FOUND',

      errorMessage:
        'Документ для анализа не передан.',

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  return analyzeWorkVolumeFile(
    documentItem.file
  );
}


function tokenizeWorkVolumeText(
  value
) {
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

  return normalizeWorkVolumeText(
    value
  )
    .split(
      /[^а-яa-z0-9-]+/iu
    )
    .filter(
      function (word) {
        return (
          word.length >= 3 &&
          !stopWords.has(
            word
          )
        );
      }
    );
}


function getWorkVolumeRoot(
  word
) {
  const normalized =
    normalizeWorkVolumeText(
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

  return ending
    ? normalized.slice(
        0,
        -ending.length
      )
    : normalized;
}


function getWorkVolumeRoots(
  value
) {
  return tokenizeWorkVolumeText(
    value
  ).map(
    getWorkVolumeRoot
  );
}


function workVolumeRootsMatch(
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


function calculateWorkVolumeTextMatch(
  workName,
  candidateWorkName
) {
  const workRoots =
    Array.from(
      new Set(
        getWorkVolumeRoots(
          workName
        )
      )
    );

  const candidateRoots =
    Array.from(
      new Set(
        getWorkVolumeRoots(
          candidateWorkName
        )
      )
    );

  if (
    workRoots.length === 0
  ) {
    return {
      score: 0,
      coverage: 0,
      matchedRoots: []
    };
  }

  const matchedRoots =
    workRoots.filter(
      function (workRoot) {
        return candidateRoots.some(
          function (
            candidateRoot
          ) {
            return workVolumeRootsMatch(
              workRoot,
              candidateRoot
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

    coverage,

    matchedRoots
  };
}


function getWorkVolumeProjectDocuments() {
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


function getWorkVolumeActiveContext() {
  if (
    window.BuildMindWorkContexts &&
    typeof window
      .BuildMindWorkContexts
      .getActive ===
      'function'
  ) {
    return window
      .BuildMindWorkContexts
      .getActive();
  }

  return null;
}


async function findBuildMindWorkVolume(
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
    getWorkVolumeActiveContext();

  if (
    !context ||
    !context.work
  ) {
    return {
      success: false,

      errorCode:
        'ACTIVE_CONTEXT_NOT_FOUND',

      errorMessage:
        'Активный контекст работы не найден.',

      requiresEngineerConfirmation:
        true
    };
  }

  const documents =
    Array.isArray(
      settings.documents
    )
      ? settings.documents
      : getWorkVolumeProjectDocuments();

  const tableDocuments =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.file &&

          WORK_VOLUME_SUPPORTED_EXTENSIONS
            .includes(
              getWorkVolumeFileExtension(
                documentItem.file
              )
            )
        );
      }
    );

  if (
    tableDocuments.length ===
    0
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_DOCUMENTS_NOT_FOUND',

      errorMessage:
        'Среди загруженных документов нет XLSX, XLS или CSV.',

      context,

      candidates: [],

      requiresEngineerConfirmation:
        true
    };
  }

  const candidates = [];

  const documentsAnalysis = [];

  for (
    let index = 0;
    index <
      tableDocuments.length;
    index += 1
  ) {
    const documentItem =
      tableDocuments[index];

    const result =
      await analyzeWorkVolumeDocument(
        documentItem
      );

    documentsAnalysis.push({
      sourceDocument:
        documentItem.file.name,

      success:
        result.success,

      errorCode:
        result.errorCode ||
        null,

      candidatesCount:
        result.candidatesCount ||
        0
    });

    if (
      !Array.isArray(
        result.candidates
      )
    ) {
      continue;
    }

    result.candidates.forEach(
      function (candidate) {
        const match =
          calculateWorkVolumeTextMatch(
            context.work,
            candidate.workName
          );

        const contextScore =
          Math.round(
            match.coverage *
            100
          );

        candidates.push({
          ...candidate,

          contextScore,

          matchedRoots:
            match.matchedRoots,

          workCoverage:
            match.coverage,

          eligibleForWorkVolume:
            contextScore >= 55
        });
      }
    );
  }

  candidates.sort(
    function (
      first,
      second
    ) {
      return (
        second.contextScore -
        first.contextScore
      );
    }
  );

  const eligibleCandidates =
    candidates.filter(
      function (candidate) {
        return (
          candidate
            .eligibleForWorkVolume ===
          true
        );
      }
    );

  const bestCandidate =
    eligibleCandidates[0];

  if (
    !bestCandidate ||
    bestCandidate.contextScore <
      70
  ) {
    return {
      success: false,

      errorCode:
        'WORK_VOLUME_NOT_CONFIDENT',

      errorMessage:
        'Надёжная строка ВОР для активной работы не найдена.',

      context,

      documentsAnalysis,

      candidates:
        candidates.slice(
          0,
          20
        ),

      eligibleCandidates:
        eligibleCandidates.slice(
          0,
          20
        ),

      requiresEngineerConfirmation:
        true
    };
  }

  return {
    success: true,

    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    context: {
      ...context
    },

    workName:
      bestCandidate.workName,

    quantity:
      bestCandidate.quantity,

    unit:
      bestCandidate.unit,

    sourceType:
      'work-volume',

    sourceDocument:
      bestCandidate.sourceDocument,

    sourceSheet:
      bestCandidate.sourceSheet,

    sourceRow:
      bestCandidate.sourceRow,

    headerRow:
      bestCandidate.headerRow,

    score:
      bestCandidate.contextScore,

    confidence:
      bestCandidate.contextScore >=
        85
        ? {
            level: 'high',
            label: 'Высокая'
          }
        : {
            level: 'medium',
            label: 'Средняя'
          },

    matchedRoots:
      bestCandidate.matchedRoots,

    workCoverage:
      bestCandidate.workCoverage,

    taxonomy:
      bestCandidate.taxonomy,

    alternatives:
      eligibleCandidates.slice(
        1,
        6
      ),

    requiresEngineerConfirmation:
      true,

    decisionStatus:
      'requires-review',

    disclaimer:
      'Объём извлечён автоматически из табличного документа. ' +
      'Рекомендуется проверить название работы, единицу, количество, ' +
      'лист и строку-источник перед использованием в планировании.'
  };
}


function testBuildMindWorkVolumeRows(
  rows,
  options
) {
  return analyzeWorkVolumeRows(
    rows,
    {
      sourceDocument:
        'DEMO-WORK-VOLUME.xlsx',

      sourceSheet:
        'ВОР',

      ...(options || {})
    }
  );
}


function getBuildMindWorkVolumeSummary() {
  const documents =
    getWorkVolumeProjectDocuments();

  const tableDocuments =
    documents.filter(
      function (
        documentItem
      ) {
        return Boolean(
          documentItem &&
          documentItem.file &&

          WORK_VOLUME_SUPPORTED_EXTENSIONS
            .includes(
              getWorkVolumeFileExtension(
                documentItem.file
              )
            )
        );
      }
    );

  return {
    version:
      BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

    excelLibraryAvailable:
      Boolean(
        window.XLSX &&
        typeof window.XLSX.read ===
          'function'
      ),

    projectDocuments:
      documents.length,

    tableDocuments:
      tableDocuments.length
  };
}


window.BuildMindWorkVolume = {
  version:
    BUILDMIND_WORK_VOLUME_ENGINE_VERSION,

  analyzeRows:
    analyzeWorkVolumeRows,

  analyzeWorkbook:
    analyzeWorkVolumeWorkbook,

  analyzeFile:
    analyzeWorkVolumeFile,

  analyzeDocument:
    analyzeWorkVolumeDocument,

  find:
    findBuildMindWorkVolume,

  calculateTextMatch:
    calculateWorkVolumeTextMatch,

  testRows:
    testBuildMindWorkVolumeRows,

  getSummary:
    getBuildMindWorkVolumeSummary
};


console.info(
  'BuildMind Work Volume Engine загружен:',
  getBuildMindWorkVolumeSummary()
);
