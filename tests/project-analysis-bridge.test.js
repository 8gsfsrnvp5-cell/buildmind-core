'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'projectAnalysisBridge.js'),
  'utf8'
);

function createStorage(shared) {
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

function createSandbox(shared) {
  const listeners = new Map();
  const imports = [];
  const events = [];
  const window = {
    BuildMindDocumentRegistry: {
      importAnalysisSnapshot: function (snapshot) {
        imports.push(snapshot);
      }
    },
    BuildMindProjectIntake: {
      getLastResult: function () {
        return null;
      }
    },
    addEventListener: function (type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatchEvent: function (event) {
      events.push(event);
      (listeners.get(event.type) || []).forEach(function (handler) {
        handler(event);
      });
    }
  };

  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }

  const sandbox = {
    window,
    localStorage: createStorage(shared),
    CustomEvent,
    Date,
    Map,
    Set,
    JSON,
    Math,
    Number,
    String,
    Array,
    Object,
    console: {
      info: function () {},
      warn: function () {}
    }
  };

  vm.runInNewContext(source, sandbox);

  return {
    api: window.BuildMindProjectAnalysis,
    imports,
    events
  };
}

const shared = new Map();
const first = createSandbox(shared);

const result = {
  success: true,
  version: 'project-intake-v2.0',
  createdAt: '2026-08-21T12:00:00.000Z',
  qualityStatus: 'review',
  partial: false,
  documents: [
    {
      documentId: 'vor',
      fileName: 'ВОР 111.pdf',
      extension: 'pdf',
      documentRole: 'work-volume',
      kind: 'work-volume',
      confidence: 'high',
      totalPages: 3,
      ocrPages: [1, 2, 3],
      unreadablePages: []
    },
    {
      documentId: 'gpr',
      fileName: 'ГПР 111.pdf',
      extension: 'pdf',
      documentRole: 'schedule',
      kind: 'schedule',
      confidence: 'high',
      totalPages: 3,
      ocrPages: [1, 2, 3],
      unreadablePages: []
    }
  ],
  works: [
    {
      workCode: '1.1',
      workName: 'Монтаж светофоров',
      unit: 'шт',
      quantity: 16,
      fileName: 'ВОР 111.pdf',
      pageNumber: 1
    },
    {
      workCode: '2.1',
      workName: 'Утилизация мусора',
      unit: 'т',
      quantity: 5,
      fileName: 'ВОР 111.pdf',
      pageNumber: 2
    },
    {
      workCode: '1.1',
      workName: 'Монтаж светофоров',
      unit: 'шт',
      quantity: 16,
      startDate: '2025-02-20',
      finishDate: '2025-08-31',
      fileName: 'ГПР 111.pdf',
      pageNumber: 1
    },
    {
      workCode: '3.4',
      workName: 'Перевозка грунта',
      unit: 'м3',
      quantity: 20,
      startDate: '2025-07-01',
      finishDate: '',
      scheduleReviewRequired: true,
      scheduleReviewReasons: ['Нет даты окончания'],
      fileName: 'ГПР 111.pdf',
      pageNumber: 3
    }
  ],
  materials: [],
  approvals: [],
  reviewItems: [
    {
      reviewType: 'schedule-anomaly',
      fileName: 'ГПР 111.pdf',
      workName: 'Перевозка грунта',
      startDate: '2025-07-01',
      reasons: ['Нет даты окончания']
    }
  ],
  workVolumeRowsCount: 2,
  scheduleRowsCount: 2,
  unreadablePagesCount: 0
};

const snapshot = first.api.persistResult(result);

assert.equal(snapshot.summary.documentsCount, 2);
assert.equal(snapshot.summary.workVolumeRowsCount, 2);
assert.equal(snapshot.summary.scheduleRowsCount, 2);
assert.equal(snapshot.summary.matchedScheduleRowsCount, 1);
assert.equal(snapshot.summary.scheduleOnlyRowsCount, 1);
assert.equal(snapshot.summary.workVolumeOnlyRowsCount, 1);
assert.equal(snapshot.combinedRows.length, 3);
assert.equal(snapshot.documents[0].analysisFingerprint.length, 8);
assert.equal(first.imports.length, 1);
assert.equal(
  first.events.some(function (event) {
    return event.type === 'buildmind:project-analysis-snapshot-changed';
  }),
  true
);
assert.equal(
  shared.has('buildmind-project-analysis-snapshot-v1'),
  true
);

const second = createSandbox(shared);
const restored = second.api.getSnapshot();

assert.equal(restored.summary.documentsCount, 2);
assert.equal(restored.combinedRows.length, 3);
assert.equal(second.imports.length, 1);

console.log('BuildMind project analysis bridge test: PASS');
