'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');
const vm =
  require('node:vm');
const {
  webcrypto
} = require('node:crypto');


function createTestContext() {
  const elements =
    new Map();

  class FakeElement {
    constructor() {
      this._id = '';
      this.className = '';
      this.innerHTML = '';
      this.textContent = '';
      this.dataset = {};
      this.children = [];
    }

    set id(value) {
      this._id = value;
      if (value) {
        elements.set(value, this);
      }
    }

    get id() {
      return this._id;
    }

    appendChild(child) {
      this.children.push(child);
      if (child.id) {
        elements.set(child.id, child);
      }
      return child;
    }

    addEventListener() {}
  }

  const layout =
    new FakeElement();
  layout.className =
    'layout';

  const storage =
    new Map();

  const localStorage = {
    getItem(key) {
      return storage.has(key)
        ? storage.get(key)
        : null;
    },

    setItem(key, value) {
      storage.set(
        key,
        String(value)
      );
    }
  };

  const document = {
    getElementById(id) {
      return elements.get(id) ||
        null;
    },

    querySelector(selector) {
      return selector === '.layout'
        ? layout
        : null;
    },

    createElement() {
      return new FakeElement();
    }
  };

  const context = {
    console,
    document,
    localStorage,
    crypto:
      webcrypto,
    CustomEvent:
      class CustomEvent {
        constructor(type, options) {
          this.type = type;
          this.detail =
            options?.detail;
        }
      },
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    RegExp,
    Promise,
    Map,
    Set,
    Intl,
    parseInt,
    parseFloat,
    confirm() {
      return true;
    },
    prompt() {
      return 'Проверено тестом';
    },
    addEventListener() {},
    dispatchEvent() {}
  };

  context.window =
    context;
  context.globalThis =
    context;

  return {
    context,
    localStorage
  };
}


async function run() {
  const {
    context,
    localStorage
  } = createTestContext();

  vm.createContext(context);

  vm.runInContext(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        'changeSetEngine.js'
      ),
      'utf8'
    ),
    context,
    {
      filename:
        'changeSetEngine.js'
    }
  );

  const demo =
    context
      .BuildMindChangeSet
      .createDemo();

  assert.equal(
    demo.summary.total,
    6
  );
  assert.equal(
    demo.summary.added,
    2
  );
  assert.equal(
    demo.summary.removed,
    1
  );
  assert.equal(
    demo.summary.modified,
    3
  );
  assert.equal(
    demo.summary.workChanges,
    3
  );
  assert.equal(
    demo.summary.materialChanges,
    3
  );

  const cableChange =
    demo.changes.find(
      function (item) {
        return item.label ===
          'Строительство кабельной канализации';
      }
    );

  assert.ok(cableChange);
  assert.equal(
    cableChange.changeType,
    'modified'
  );
  assert.equal(
    cableChange.before.quantity,
    1000
  );
  assert.equal(
    cableChange.after.quantity,
    1200
  );
  assert.equal(
    cableChange.impact.quantityDelta,
    200
  );
  assert.equal(
    cableChange.impact.startShiftDays,
    4
  );
  assert.equal(
    cableChange.impact.finishShiftDays,
    10
  );

  assert.equal(
    context
      .BuildMindChangeSet
      .setDecision(
        demo.id,
        'confirmed',
        'Проверено инженером'
      ),
    true
  );

  const confirmed =
    context
      .BuildMindChangeSet
      .getAll()
      .find(
        function (item) {
          return item.id ===
            demo.id;
        }
      );

  assert.equal(
    confirmed.status,
    'confirmed'
  );
  assert.equal(
    confirmed.decisionComment,
    'Проверено инженером'
  );

  const firstDocument = {
    file: {
      name: 'ВОР-R1.xlsx'
    },
    workVolumeAnalysis: {
      version: 'test-v1',
      candidates: [
        {
          rowType: 'work',
          workName: 'Монтаж трубы',
          quantity: 100,
          unit: 'м',
          startDate: '2026-09-01',
          finishDate: '2026-09-10'
        }
      ]
    }
  };

  const registryDocument = {
    documentId: 'document-test',
    logicalTitle: 'Тестовая ВОР',
    kind: 'work-volume'
  };

  const firstRevision = {
    revisionId: 'revision-r1',
    revisionLabel: 'R1',
    relationType: 'initial',
    projectNodeIds: ['project-1'],
    fileName: 'ВОР-R1.xlsx'
  };

  const baselineResult =
    await context
      .BuildMindChangeSet
      .captureRevision({
        uploadedDocument:
          firstDocument,
        registryDocument,
        revision:
          firstRevision,
        previousRevision:
          null
      });

  assert.ok(
    baselineResult.snapshot
  );
  assert.equal(
    baselineResult.changeSet,
    null
  );
  assert.equal(
    firstRevision
      .analysisSnapshot
      .works[0]
      .quantity,
    100
  );

  const secondRevision = {
    revisionId: 'revision-r2',
    revisionLabel: 'R2',
    relationType: 'replaces',
    projectNodeIds: ['project-1'],
    fileName: 'ВОР-R2.xlsx'
  };

  const comparisonResult =
    await context
      .BuildMindChangeSet
      .captureRevision({
        uploadedDocument: {
          file: {
            name: 'ВОР-R2.xlsx'
          },
          workVolumeAnalysis: {
            version: 'test-v1',
            candidates: [
              {
                rowType: 'work',
                workName: 'Монтаж трубы',
                quantity: 125,
                unit: 'м',
                startDate: '2026-09-03',
                finishDate: '2026-09-14'
              }
            ]
          }
        },
        registryDocument,
        revision:
          secondRevision,
        previousRevision:
          firstRevision
      });

  assert.ok(
    comparisonResult.changeSetId
  );
  assert.equal(
    secondRevision.changeSetId,
    comparisonResult.changeSetId
  );
  assert.equal(
    comparisonResult
      .changeSet
      .summary
      .modified,
    1
  );

  const stored =
    JSON.parse(
      localStorage.getItem(
        'buildmind-change-sets-v1'
      )
    );

  assert.equal(
    stored.changeSets.length,
    2
  );

  console.log(
    'BuildMind ChangeSet V1 test: PASS'
  );
}


run().catch(
  function (error) {
    console.error(error);
    process.exitCode = 1;
  }
);
