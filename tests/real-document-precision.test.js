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

console.log('BuildMind real document precision test: PASS');
