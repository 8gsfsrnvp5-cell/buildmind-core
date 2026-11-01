'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createStorage() {
  const shared = new Map();

  return {
    getItem: function (key) {
      return shared.has(key) ? shared.get(key) : null;
    },
    setItem: function (key, value) {
      shared.set(key, String(value));
    },
    removeItem: function (key) {
      shared.delete(key);
    }
  };
}

function createSandbox() {
  const events = [];
  const window = {
    addEventListener: function () {},
    dispatchEvent: function (event) {
      events.push(event);
    }
  };

  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }

  const context = {
    window,
    localStorage: createStorage(),
    CustomEvent,
    console: {
      info: function () {},
      warn: function () {}
    }
  };

  vm.createContext(context);

  ['projectAnalysisBridge.js', 'truthReview.js'].forEach(function (fileName) {
    vm.runInContext(
      fs.readFileSync(path.join(root, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });

  return {
    context,
    events,
    bridge: window.BuildMindProjectAnalysis,
    truth: window.BuildMindTruthReview
  };
}

const analysisResult = {
  success: true,
  version: 'test',
  qualityStatus: 'review',
  documents: [
    { fileName: 'ВОР.pdf', documentRole: 'work-volume', kind: 'work-volume' },
    { fileName: 'ГПР.xlsx', documentRole: 'schedule', kind: 'schedule' }
  ],
  works: [
    {
      workCode: '1',
      workName: 'Устройство щебёночного основания',
      unit: 'м3',
      quantity: 120,
      fileName: 'ВОР.pdf',
      pageNumber: 3
    },
    {
      workCode: '1',
      workName: 'Устройство щебёночного основания',
      unit: 'м3',
      quantity: 100,
      startDate: '2026-05-01',
      finishDate: '2026-05-20',
      fileName: 'ГПР.xlsx',
      sourceSheet: 'ГПР',
      sourceRow: 12
    },
    {
      workCode: '2',
      workName: 'Разработка грунта экскаватором',
      unit: 'м3',
      quantity: null,
      fileName: 'ВОР.pdf',
      pageNumber: 4
    },
    {
      workCode: '3',
      workName: 'Укладка асфальтобетона',
      unit: 'м2',
      quantity: 500,
      fileName: 'ВОР.pdf',
      pageNumber: 5
    }
  ],
  materials: [
    {
      name: 'Щебень фр. 20-40',
      unit: 'м3',
      quantity: 130,
      fileName: 'ВОР.pdf',
      pageNumber: 6
    },
    {
      name: 'Битум',
      unit: 'т',
      quantity: 4
    }
  ],
  reviewItems: [
    {
      reviewType: 'ocr-gap',
      fileName: 'ВОР.pdf',
      pageNumbers: [7, 8],
      reason: 'Текст не распознан.'
    }
  ],
  agentReports: [
    {
      agentId: 'pdf-agent',
      taskType: 'document.pdf',
      status: 'partial',
      truthStatus: 'needs-review',
      qualityFlags: ['AGENT_PAYLOAD_WITHOUT_EVIDENCE'],
      evidence: [],
      metadata: { label: 'PDF агент', fileName: 'ВОР.pdf' }
    },
    {
      agentId: 'excel-agent',
      taskType: 'document.spreadsheet',
      status: 'completed',
      truthStatus: 'extracted',
      qualityFlags: [],
      evidence: [{ sourceFile: 'ГПР.xlsx' }]
    }
  ]
};

const { truth, bridge, events } = createSandbox();

assert.ok(truth, 'truth review module is loaded');

// Снимок сохраняет источник ВОР и ГПР по отдельности и отчёты агентов.
const snapshot = bridge.buildSnapshot(analysisResult);
const matched = snapshot.combinedRows.find(function (row) {
  return row.status === 'matched';
});

assert.ok(matched);
assert.deepEqual(Array.from(matched.vorSource.sourcePages), [3]);
assert.equal(matched.gprSource.sourceSheet, 'ГПР');
assert.equal(matched.gprSource.sourceRow, 12);
assert.equal(snapshot.agentReports.length, 2);
assert.equal(snapshot.agentReports[0].sourceFile, 'ВОР.pdf');
assert.deepEqual(
  Array.from(snapshot.agentReports[0].qualityFlags),
  ['AGENT_PAYLOAD_WITHOUT_EVIDENCE']
);

// Отдельное значение по контракту: пусто — это unknown, не ноль.
const missing = truth.createValueRecord({
  field: 'vorQuantity',
  kind: 'number',
  value: '',
  source: { sourceFile: 'ВОР.pdf', sourcePage: 2 }
});

assert.equal(missing.value, 'unknown');
assert.notEqual(missing.value, 0);
assert.equal(missing.status, 'not-found');

const withoutSource = truth.createValueRecord({
  field: 'vorQuantity',
  kind: 'number',
  value: 10
});

assert.equal(withoutSource.status, 'needs-review');
assert.match(withoutSource.reviewReason, /исходный файл/i);

const withoutPage = truth.createValueRecord({
  field: 'vorQuantity',
  kind: 'number',
  value: 10,
  source: { sourceFile: 'ВОР.pdf' }
});

assert.equal(withoutPage.status, 'needs-review');

const supported = truth.createValueRecord({
  field: 'vorQuantity',
  kind: 'number',
  value: 10,
  unit: 'м3',
  source: { sourceFile: 'ВОР.pdf', sourcePage: 2 }
});

assert.equal(supported.status, 'extracted');
assert.equal(supported.sourceFile, 'ВОР.pdf');
assert.equal(supported.sourcePage, '2');

// Модель экрана: конфликт, ненайденное, непрочитанное, без источника, агент.
let model = truth.buildModel(snapshot);
const byType = function (type) {
  return model.disputes.filter(function (dispute) {
    return dispute.disputeType === type;
  });
};

const conflict = byType('conflict')[0];

assert.ok(conflict, 'VOR/GPR quantity conflict is queued');
assert.equal(conflict.values.length, 2);
assert.equal(conflict.values[0].value, 120);
assert.equal(conflict.values[1].value, 100);
assert.match(conflict.values[0].sourceLabel, /ВОР\.pdf · стр\. 3/);
assert.match(conflict.values[1].sourceLabel, /ГПР\.xlsx · лист ГПР · строка 12/);
assert.equal(model.subjectStatus[matched.rowId], 'conflict');

const notFound = model.disputes.find(function (dispute) {
  return dispute.originalStatus === 'not-found';
});

assert.ok(notFound, 'missing VOR quantity is queued');
assert.equal(notFound.values[0].value, 'unknown');

const unreadable = model.disputes.find(function (dispute) {
  return dispute.originalStatus === 'unreadable';
});

assert.ok(unreadable, 'OCR gap is queued as unreadable');
assert.match(unreadable.values[0].sourceLabel, /стр\. 7, 8/);

const materialWithoutSource = model.disputes.find(function (dispute) {
  return dispute.subjectLabel === 'Битум';
});

assert.ok(materialWithoutSource, 'material without source is queued');
assert.equal(materialWithoutSource.originalStatus, 'needs-review');

assert.equal(byType('agent-report').length, 1, 'only unverified agent reports are queued');

// Строка с источником и без конфликтов остаётся «извлечено», не «подтверждено».
const asphalt = snapshot.combinedRows.find(function (row) {
  return row.workName === 'Укладка асфальтобетона';
});

assert.equal(model.subjectStatus[asphalt.rowId], 'extracted');
assert.equal(model.summary.confirmedCount, 0);

const openBefore = model.summary.openDisputesCount;

// Ручное решение требует роли, ФИО, основания и документа.
let result = truth.applyDecision(snapshot, conflict.disputeId, {
  action: 'manual-value',
  role: 'foreman',
  user: 'Иванов И.И.',
  reason: 'Акт',
  newValue: '110',
  documentRef: 'Акт №5'
});

assert.equal(result.success, false);
assert.equal(result.errorCode, 'ROLE_NOT_ALLOWED');

result = truth.applyDecision(snapshot, conflict.disputeId, {
  action: 'manual-value',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: '',
  newValue: '110',
  documentRef: 'Акт №5'
});

assert.equal(result.errorCode, 'REASON_REQUIRED');

result = truth.applyDecision(snapshot, conflict.disputeId, {
  action: 'manual-value',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: 'Уточнено по исполнительной съёмке',
  newValue: '110',
  documentRef: ''
});

assert.equal(result.errorCode, 'DOCUMENT_REQUIRED');

result = truth.applyDecision(snapshot, conflict.disputeId, {
  action: 'manual-value',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: 'Уточнено по исполнительной съёмке',
  newValue: '110,5',
  unit: 'м3',
  documentRef: 'Исполнительная съёмка, лист 2',
  comment: 'ВОР и ГПР устарели'
});

assert.equal(result.success, true, result.message);
assert.equal(result.entry.newValue, 110.5);
assert.equal(result.entry.status, 'manual-override');
assert.equal(result.entry.previousValue, 120);
assert.equal(result.entry.originalValues.length, 2);
assert.ok(
  events.some(function (event) {
    return event.type === 'buildmind:truth-review-changed';
  })
);

model = truth.buildModel(snapshot);

const decidedConflict = model.disputes.find(function (dispute) {
  return dispute.disputeId === conflict.disputeId;
});

assert.equal(decidedConflict.resolved, true);
assert.equal(decidedConflict.status, 'manual-override');
assert.equal(decidedConflict.currentValue, 110.5);
// Исходные значения источников не удаляются.
assert.equal(decidedConflict.values[0].value, 120);
assert.equal(decidedConflict.values[1].value, 100);
// Даты строки ещё не подтверждены, поэтому строка остаётся «извлечено».
assert.equal(model.subjectStatus[matched.rowId], 'extracted');
assert.equal(model.summary.openDisputesCount, openBefore - 1);

// Повторное изменение дополняет историю, а не перезаписывает её.
result = truth.applyDecision(snapshot, conflict.disputeId, {
  action: 'choose-source',
  sourceIndex: 1,
  role: 'project-manager',
  user: 'Петров П.П.',
  reason: 'Действующий график утверждён заказчиком'
});

assert.equal(result.success, true, result.message);
assert.equal(result.entry.previousValue, 110.5);
assert.equal(result.entry.newValue, 100);
assert.equal(result.entry.status, 'confirmed');

const history = truth.getHistory(conflict.disputeId);

assert.equal(history.length, 2);
assert.equal(history[0].newValue, 110.5);
assert.equal(history[0].previousValue, 120);
assert.equal(history[1].newValue, 100);

// Нельзя «подтвердить» неизвестное значение.
result = truth.applyDecision(snapshot, notFound.disputeId, {
  action: 'confirm-source',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: 'Проверено'
});

assert.equal(result.errorCode, 'SOURCE_HAS_NO_VALUE');

result = truth.applyDecision(snapshot, notFound.disputeId, {
  action: 'keep-unknown',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: 'Объём будет уточнён после изысканий'
});

assert.equal(result.success, true);
assert.equal(result.entry.newValue, 'unknown');

// Повторное распознавание оставляет запись открытой.
result = truth.applyDecision(snapshot, unreadable.disputeId, {
  action: 'rerecognize',
  role: 'project-admin',
  user: 'Сидоров С.С.',
  reason: 'Нужен скан лучшего качества'
});

assert.equal(result.success, true);

// Отклонённый материал помечается отклонённым.
result = truth.applyDecision(snapshot, materialWithoutSource.disputeId, {
  action: 'reject',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: 'Позиция не относится к проекту'
});

assert.equal(result.success, true);

// Назначение ответственного не меняет статус.
result = truth.applyDecision(snapshot, unreadable.disputeId, {
  action: 'assign',
  role: 'project-manager',
  user: 'Петров П.П.',
  responsible: 'Сидоров С.С.',
  dueDate: '2026-10-05'
});

assert.equal(result.success, true);

model = truth.buildModel(snapshot);

const requeued = model.disputes.find(function (dispute) {
  return dispute.disputeId === unreadable.disputeId;
});

assert.equal(requeued.resolved, false);
assert.equal(requeued.status, 'needs-review');
assert.equal(requeued.responsible, 'Сидоров С.С.');
assert.equal(requeued.dueDate, '2026-10-05');
assert.equal(model.subjectStatus['material-1'], 'rejected');
assert.equal(model.subjectStatus[matched.rowId], 'extracted');
assert.ok(model.records.some(function (record) {
  return record.subjectId === matched.rowId && record.status === 'confirmed';
}));

// Если источник изменился, прежнее решение не переносится молча.
const changedResult = JSON.parse(JSON.stringify(analysisResult));

changedResult.works[0].quantity = 125;

const changedModel = truth.buildModel(bridge.buildSnapshot(changedResult));
const changedConflict = changedModel.disputes.find(function (dispute) {
  return dispute.disputeType === 'conflict';
});

assert.notEqual(changedConflict.disputeId, conflict.disputeId);
assert.equal(changedConflict.resolved, false);
assert.equal(changedConflict.history.length, 0);

// Отсутствующая страница не превращается в «стр. 0».
const pageZero = truth.createValueRecord({
  field: 'vorQuantity',
  kind: 'number',
  value: 5,
  source: { sourceFile: 'ВОР.pdf', sourcePage: null }
});

assert.equal(pageZero.sourcePage, '');
assert.equal(pageZero.status, 'needs-review');

const nullPageSnapshot = bridge.buildSnapshot({
  ...analysisResult,
  works: [
    {
      workCode: '9',
      workName: 'Работа без страницы',
      unit: 'м',
      quantity: 7,
      fileName: 'ВОР.pdf',
      pageNumber: null
    }
  ]
});

assert.equal(nullPageSnapshot.workVolumeRows[0].sourcePages.length, 0);

// Бесспорное извлечённое значение ждёт подтверждения инженером,
// но не попадает в очередь спорных моментов.
const asphaltConfirmation = model.confirmations.find(function (item) {
  return item.subjectId === asphalt.rowId && item.field === 'vorQuantity';
});

assert.ok(asphaltConfirmation, 'extracted value waits for engineer confirmation');
assert.equal(asphaltConfirmation.disputeType, 'confirmation');
assert.equal(
  model.openDisputes.some(function (item) {
    return item.disputeId === asphaltConfirmation.disputeId;
  }),
  false
);

const pendingBefore = model.summary.pendingConfirmationCount;

result = truth.applyDecision(snapshot, asphaltConfirmation.disputeId, {
  action: 'confirm-source',
  role: 'pto-engineer',
  user: 'Иванов И.И.',
  reason: 'Сверено с ВОР, стр. 5'
});

assert.equal(result.success, true, result.message);
assert.equal(result.entry.previousValue, 500);
assert.equal(result.entry.newValue, 500);
assert.ok(result.entry.decidedAt);

model = truth.buildModel(snapshot);

assert.equal(model.subjectStatus[asphalt.rowId], 'confirmed');
assert.equal(model.summary.pendingConfirmationCount, pendingBefore - 1);
assert.equal(model.summary.confirmedByEngineerCount, 1);

console.log('BuildMind truth review test: PASS');
