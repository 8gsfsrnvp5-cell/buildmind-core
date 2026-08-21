'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'projectIntake.js'), 'utf8');
const vm = require('node:vm');
const qualitySandbox = {
  window: {},
  console: {
    info: function () {}
  }
};

vm.runInNewContext(
  fs.readFileSync(
    path.join(root, 'projectIntakeQuality.js'),
    'utf8'
  ),
  qualitySandbox
);

const quality =
  qualitySandbox.window
    .BuildMindProjectIntakeQuality;
const table = require(path.join(root, 'pdfTableEngine.js'));
const workVolume = fs.readFileSync(
  path.join(root, 'workVolumeEngine.js'),
  'utf8'
);

[
  'inferProjectDocumentRoleFromFile',
  'documentRoleSource',
  "return 'work-volume';",
  "return 'schedule';"
].forEach(function (marker) {
  assert.equal(app.includes(marker), true, marker);
});

assert.equal(
  app.includes("tessedit_pageseg_mode: '3'"),
  true
);
assert.equal(
  app.includes("tessedit_pageseg_mode: '6'"),
  false
);

assert.equal(
  intake.includes('mergeProjectIntakeAggregateCandidates'),
  true
);
assert.equal(
  intake.includes('АНАЛИЗ КОМПЛЕКТА · V1.8'),
  true
);
assert.equal(
  workVolume.includes('isSupplySchedule'),
  true
);
assert.equal(
  workVolume.includes('durationDays > 730'),
  true
);

const workVolumeSandbox = {
  window: {},
  console: {
    info: function () {}
  }
};

vm.runInNewContext(
  workVolume,
  workVolumeSandbox
);

const supplySchedule =
  workVolumeSandbox.window
    .BuildMindWorkVolume
    .analyzeRows(
      [
        [
          'Наименование работ',
          'Ед. изм.',
          'Объем',
          'Дата начала',
          'Дата окончания'
        ],
        [
          'Кабель силовой',
          'м',
          '120',
          '2024-09-09',
          '2025-09-04'
        ]
      ],
      {
        sourceDocument:
          'ГПР ЮВХ от 11.08.2025.xlsx',
        sourceSheet:
          'График поставок МТР'
      }
    );

assert.equal(
  supplySchedule.candidates[0].rowType,
  'material'
);
assert.equal(
  supplySchedule.candidates[0].sourceType,
  'supply-schedule'
);
assert.equal(
  supplySchedule.candidates[0].scheduleReviewRequired,
  false
);

const corrected = table.normalizeScheduleYears(
  [
    {
      sourceType: 'pdf-schedule',
      workName: 'Монтаж опоры',
      startDate: '2005-07-29',
      finishDate: '2035-08-31'
    },
    {
      sourceType: 'pdf-schedule',
      workName: 'Монтаж шкафа',
      startDate: '2025-07-30',
      finishDate: '2025-08-31'
    }
  ],
  {
    sourceDocument: 'ГПР от 11.08.2025.pdf'
  }
);

assert.equal(corrected[0].startDate, '2025-07-29');
assert.equal(corrected[0].finishDate, '2025-08-31');
assert.equal(
  corrected[0].scheduleReviewRequired,
  true
);

const safeCorrection = table.normalizeScheduleYears(
  [
    {
      sourceType: 'pdf-schedule',
      workName: 'Монтаж опоры',
      startDate: '2024-09-10',
      finishDate: '2025-03-31'
    }
  ],
  {
    sourceDocument: 'ГПР 111.pdf'
  }
);

assert.equal(
  safeCorrection[0].startDate,
  '2024-09-10'
);
assert.equal(
  safeCorrection[0].finishDate,
  '2025-03-31'
);

function layoutWord(
  text,
  x0,
  y0
) {
  return {
    text,
    bbox: {
      x0,
      y0,
      x1: x0 + 28,
      y1: y0 + 16
    }
  };
}

const structuredVolume = table.analyzePages(
  [
    {
      pageNumber: 1,
      layoutWords: [
        layoutWord('3.1.1', 12, 100),
        layoutWord('Монтаж', 120, 100),
        layoutWord('светофоров', 190, 100),
        layoutWord('шт', 575, 100),
        layoutWord('16', 655, 100),
        layoutWord('100', 790, 100),
        layoutWord('1600', 900, 100)
      ]
    }
  ],
  [
    {
      id: 'vor-1',
      kind: 'work-volume',
      pageNumbers: [1]
    }
  ],
  {
    sourceDocument: 'ВОР 111.pdf'
  }
);

assert.equal(structuredVolume.works.length, 1);
assert.equal(
  structuredVolume.works[0].workName,
  'Монтаж светофоров'
);
assert.equal(
  structuredVolume.works[0].quantity,
  16
);
assert.equal(
  structuredVolume.works[0].workCode,
  '3.1.1'
);

const structuredSchedule = table.analyzePages(
  [
    {
      pageNumber: 1,
      layoutWords: [
        layoutWord('3.1.1', 12, 100),
        layoutWord('Монтаж', 120, 100),
        layoutWord('светофоров', 190, 100),
        layoutWord('шт', 555, 100),
        layoutWord('13', 655, 100),
        layoutWord('10.09.2024', 730, 100),
        layoutWord('31.10.2024', 860, 100)
      ]
    }
  ],
  [
    {
      id: 'gpr-1',
      kind: 'schedule',
      pageNumbers: [1]
    }
  ],
  {
    sourceDocument: 'ГПР 111.pdf'
  }
);

assert.equal(structuredSchedule.works.length, 1);
assert.equal(
  structuredSchedule.works[0].startDate,
  '2024-09-10'
);
assert.equal(
  structuredSchedule.works[0].finishDate,
  '2024-10-31'
);
assert.equal(
  structuredSchedule.works[0].unit,
  'шт'
);
assert.equal(
  structuredSchedule.works[0].quantity,
  13
);
assert.equal(
  structuredSchedule.works[0].workCode,
  '3.1.1'
);

const inheritedScheduleDate = table.analyzePages(
  [
    {
      pageNumber: 1,
      layoutWords: [
        layoutWord('23', 12, 100),
        layoutWord('Магистральная', 120, 100),
        layoutWord('линия', 240, 100),
        layoutWord('20.09.2024', 730, 100),
        layoutWord('26.08.2025', 860, 100),
        layoutWord('23.1.1', 12, 130),
        layoutWord('Разработка', 120, 130),
        layoutWord('грунта', 240, 130),
        layoutWord('M3', 555, 130),
        layoutWord('1', 590, 130),
        layoutWord('023,68', 655, 130),
        layoutWord('17.05.2025', 860, 130)
      ]
    }
  ],
  [
    {
      id: 'gpr-parent-range',
      kind: 'schedule',
      pageNumbers: [1]
    }
  ],
  {
    sourceDocument: 'ГПР 111.pdf'
  }
);

assert.equal(inheritedScheduleDate.works.length, 1);
assert.equal(
  inheritedScheduleDate.works[0].workCode,
  '23.1.1'
);
assert.equal(
  inheritedScheduleDate.works[0].quantity,
  1023.68
);
assert.equal(
  inheritedScheduleDate.works[0].unit,
  'м³'
);
assert.equal(
  inheritedScheduleDate.works[0].startDate,
  '2024-09-20'
);
assert.equal(
  inheritedScheduleDate.works[0].finishDate,
  '2025-05-17'
);

const inferredScheduleUnit = table.analyzePages(
  [
    {
      pageNumber: 1,
      layoutWords: [
        layoutWord('21.10', 12, 100),
        layoutWord('Перевозка', 120, 100),
        layoutWord('мусора', 240, 100),
        layoutWord('4,22', 655, 100),
        layoutWord('20.02.2025', 730, 100),
        layoutWord('11.03.2025', 860, 100)
      ]
    }
  ],
  [
    {
      id: 'gpr-unit-inference',
      kind: 'schedule',
      pageNumbers: [1]
    }
  ],
  {
    sourceDocument: 'ГПР 111.pdf'
  }
);

assert.equal(inferredScheduleUnit.works.length, 1);
assert.equal(inferredScheduleUnit.works[0].unit, 'т');
assert.equal(
  inferredScheduleUnit.works[0].unitInferredFromWorkName,
  true
);

const supplyScheduleQuality =
  quality.evaluateResult({
    documents: [
      {
        documentRole: 'schedule',
        sections: [
          {
            kind: 'schedule'
          }
        ],
        works: [],
        materials: [
          {
            sourceType: 'supply-schedule'
          }
        ],
        totalPages: 1,
        pagesWithText: 1,
        extractedPagesCount: 1,
        ocrPages: []
      }
    ]
  });

assert.equal(
  supplyScheduleQuality.issues.some(function (issue) {
    return issue.code === 'schedule-rows-empty';
  }),
  false
);

const grouped = quality.groupApprovals([
  {
    type: 'approval',
    topic: 'Согласование',
    organization: 'ГКУ ЦОДД',
    intent: 'required',
    context: 'Согласовать схему с ГКУ ЦОДД до начала работ.',
    fileName: 'пакет-1.pdf',
    pageNumber: 12,
    matchIndex: 10
  },
  {
    type: 'approval',
    topic: 'Согласование',
    organization: 'ГКУ ЦОДД',
    intent: 'required',
    context: 'Согласовать схему с ГКУ ЦОДД до начала работ.',
    fileName: 'пакет-2.pdf',
    pageNumber: 16,
    matchIndex: 10
  }
]);

assert.equal(grouped.length, 1);
assert.equal(grouped[0].occurrenceCount, 2);
assert.equal(grouped[0].sourceFiles.length, 2);

console.log('BuildMind scan table structure test: PASS');
