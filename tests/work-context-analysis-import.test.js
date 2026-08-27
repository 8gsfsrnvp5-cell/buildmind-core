'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');


class FakeClassList {
  add() {}
  remove() {}
  toggle() {}
}


class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.className = '';
    this.classList =
      new FakeClassList();
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}
  focus() {}
}


const elements = new Map();

function getElement(id) {
  if (!elements.has(id)) {
    elements.set(
      id,
      new FakeElement(id)
    );
  }

  return elements.get(id);
}


const shared = new Map();
const events = [];

const localStorage = {
  getItem(key) {
    return shared.has(key)
      ? shared.get(key)
      : null;
  },
  setItem(key, value) {
    shared.set(key, String(value));
  },
  removeItem(key) {
    shared.delete(key);
  }
};

const document = {
  getElementById:
    getElement,
  createElement() {
    return new FakeElement();
  }
};

class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const context = {
  console: {
    info() {},
    warn() {}
  },
  document,
  localStorage,
  CustomEvent,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  RegExp,
  confirm() {
    return true;
  },
  dispatchEvent(event) {
    events.push(event);
  }
};

context.window = context;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      'workContexts.js'
    ),
    'utf8'
  ),
  context,
  {
    filename: 'workContexts.js'
  }
);


const snapshot = {
  savedAt:
    '2026-08-27T10:00:00.000Z',
  combinedRows: [
    {
      workName:
        'Монтаж светофоров',
      startDate:
        '2026-09-01',
      finishDate:
        '2026-09-10',
      status:
        'matched',
      sourceDocuments: [
        'ВОР 111.pdf',
        'ГПР 111.pdf'
      ],
      sourcePages: [1]
    },
    {
      workName:
        'Прокладка кабеля',
      startDate:
        '2026-09-11',
      finishDate:
        '2026-09-30',
      status:
        'schedule-only',
      requiresReview: true,
      reviewReasons: [
        'Проверить количество'
      ],
      sourceDocuments: [
        'ГПР 111.pdf'
      ],
      sourcePages: [2]
    },
    {
      workName:
        'Строка без окончания',
      startDate:
        '2026-10-01',
      finishDate: ''
    },
    {
      workName:
        'Строка с сомнительным годом',
      startDate:
        '2035-10-01',
      finishDate:
        '2035-10-10',
      requiresReview: true,
      reviewReasons: [
        'Проверить год и даты'
      ]
    }
  ]
};


const first =
  context.BuildMindWorkContexts
    .importFromAnalysis(
      snapshot,
      {
        project:
          'АСУДД ЮВХ',
        object:
          'Участок 7',
        safetyDays: 2
      }
    );

assert.equal(first.success, true);
assert.equal(first.added, 2);
assert.equal(first.invalid, 1);
assert.equal(first.reviewSkipped, 1);

let contexts =
  context.BuildMindWorkContexts
    .getAll();

assert.equal(contexts.length, 2);
assert.equal(
  contexts[0].sourceType,
  'analysis-gpr'
);
assert.equal(contexts[0].safetyDays, 2);
assert.equal(contexts[0].riskEligible, true);
assert.equal(contexts[1].requiresReview, true);
assert.ok(
  shared.has(
    'buildmindWorkContexts-v2-clean'
  )
);
assert.ok(
  events.some(
    function (event) {
      return (
        event.type ===
        'buildmind:work-contexts-changed'
      );
    }
  )
);

const safetyUpdate =
  context.BuildMindWorkContexts
    .updateSafetyDays(
      contexts[0].id,
      5
    );

assert.equal(safetyUpdate.success, true);
assert.equal(
  safetyUpdate.context.safetyDays,
  5
);


const duplicate =
  context.BuildMindWorkContexts
    .importFromAnalysis(
      snapshot,
      {
        project:
          'АСУДД ЮВХ',
        object:
          'Участок 7',
        safetyDays: 2
      }
    );

assert.equal(duplicate.added, 0);
assert.equal(duplicate.skipped, 2);

contexts =
  context.BuildMindWorkContexts
    .getAll();

assert.equal(
  contexts[0].safetyDays,
  5,
  'Повторный импорт ГПР не должен сбрасывать ручной страховой запас.'
);


snapshot.combinedRows[0].finishDate =
  '2026-09-12';

const update =
  context.BuildMindWorkContexts
    .importFromAnalysis(
      snapshot,
      {
        project:
          'АСУДД ЮВХ',
        object:
          'Участок 7',
        safetyDays: 2
      }
    );

assert.equal(update.updated, 1);

contexts =
  context.BuildMindWorkContexts
    .getAll();

assert.equal(
  contexts[0].endDate,
  '2026-09-12'
);


snapshot.combinedRows[0].requiresReview =
  true;
snapshot.combinedRows[0].reviewReasons = [
  'Проверить даты и год'
];

const blockedByDateReview =
  context.BuildMindWorkContexts
    .importFromAnalysis(
      snapshot,
      {
        project:
          'АСУДД ЮВХ',
        object:
          'Участок 7',
        safetyDays: 2
      }
    );

assert.equal(
  blockedByDateReview.reviewSkipped,
  2
);

contexts =
  context.BuildMindWorkContexts
    .getAll();

assert.equal(
  contexts[0].riskEligible,
  false
);

const repeatedBlockedImport =
  context.BuildMindWorkContexts
    .importFromAnalysis(
      snapshot,
      {
        project:
          'АСУДД ЮВХ',
        object:
          'Участок 7',
        safetyDays: 2
      }
    );

assert.equal(
  repeatedBlockedImport.updated,
  0
);


console.log(
  'BuildMind work context analysis import test: PASS'
);
