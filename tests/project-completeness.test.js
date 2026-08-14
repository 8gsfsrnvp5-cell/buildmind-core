'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');


function createTestContext() {
  const storage = new Map();
  const listeners = new Map();
  const queued = [];

  const model = {
    version: 'confirmed-project-model-v1.1',
    revision: 10,
    project: {
      name: 'Капитальный ремонт автомобильной дороги М-7',
      object: 'Участок км 125+000 — км 127+000'
    },
    documents: [
      {
        name: 'ВОР_дорога_R1.xlsx',
        kind: 'work-volume',
        status: 'active'
      },
      {
        name: 'ГПР_дорога_R1.xlsx',
        kind: 'schedule',
        status: 'active'
      }
    ],
    works: [
      {
        name: 'Устройство верхнего слоя ЩМА-16',
        startDate: '2026-09-20',
        finishDate: '2026-10-08',
        status: 'active'
      },
      {
        name: 'Установка бортового камня',
        startDate: '2026-09-14',
        finishDate: '2026-09-28',
        status: 'active'
      },
      {
        name: 'Строительство кабельной канализации',
        startDate: '2026-09-05',
        finishDate: '2026-10-10',
        status: 'active'
      }
    ],
    materials: [
      {
        name: 'ЩМА-16',
        quantity: 2480,
        unit: 'т',
        needDate: '2026-09-17',
        status: 'active'
      },
      {
        name: 'Битумная эмульсия',
        quantity: 12,
        unit: 'т',
        needDate: '2026-09-18',
        status: 'active'
      },
      {
        name: 'Бортовой камень БР 100.30.15',
        quantity: 1224,
        unit: 'шт',
        needDate: '2026-09-10',
        status: 'active'
      },
      {
        name: 'Труба ПНД 110',
        quantity: 1200,
        unit: 'м',
        status: 'active'
      }
    ]
  };

  const context = {
    console,
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
    localStorage: {
      getItem(key) {
        return storage.has(key)
          ? storage.get(key)
          : null;
      },

      setItem(key, value) {
        storage.set(key, String(value));
      }
    },
    document: {
      getElementById() {
        return null;
      },

      createElement() {
        return {};
      }
    },
    CustomEvent:
      class CustomEvent {
        constructor(type, options) {
          this.type = type;
          this.detail = options?.detail;
        }
      },
    addEventListener(type, callback) {
      const group = listeners.get(type) || [];
      group.push(callback);
      listeners.set(type, group);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || [])
        .forEach(function (callback) {
          callback(event);
        });
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {}
  };

  context.window = context;
  context.globalThis = context;
  context.BuildMindReviewCenter = {
    getModel() {
      return JSON.parse(JSON.stringify(model));
    },

    enqueueMany(items) {
      queued.push(
        ...JSON.parse(JSON.stringify(items))
      );
      return JSON.parse(JSON.stringify(items));
    }
  };

  return {
    context,
    storage,
    queued
  };
}


function runScript(context, fileName) {
  vm.runInContext(
    fs.readFileSync(
      path.resolve(__dirname, '..', fileName),
      'utf8'
    ),
    context,
    {filename: fileName}
  );
}


function run() {
  const {
    context,
    storage,
    queued
  } = createTestContext();

  vm.createContext(context);
  runScript(context, 'roadKnowledgeBase.js');
  runScript(context, 'projectCompleteness.js');

  const result = context
    .BuildMindProjectCompleteness
    .run({publish: true});

  assert.equal(result.success, true);
  assert.equal(result.modelRevision, 10);
  assert.equal(result.summary.coverageScore, 69);
  assert.equal(result.summary.findings, 6);
  assert.equal(result.summary.critical, 1);
  assert.equal(result.summary.recognizedWorks, 3);
  assert.equal(result.summary.totalWorks, 3);

  const documents = result.sections.find(
    function (section) {
      return section.id === 'documents';
    }
  );
  const schedule = result.sections.find(
    function (section) {
      return section.id === 'schedule';
    }
  );
  const materials = result.sections.find(
    function (section) {
      return section.id === 'materials';
    }
  );
  const procurement = result.sections.find(
    function (section) {
      return section.id === 'procurement';
    }
  );

  assert.equal(documents.satisfied, 2);
  assert.equal(documents.total, 5);
  assert.equal(schedule.satisfied, 3);
  assert.equal(schedule.total, 3);
  assert.equal(materials.satisfied, 4);
  assert.equal(materials.total, 6);
  assert.equal(procurement.satisfied, 7);
  assert.equal(procurement.total, 8);

  assert.ok(
    result.findings.some(
      function (finding) {
        return finding.id ===
          'material:road-curb-installation:curb-concrete-base';
      }
    )
  );
  assert.ok(
    result.findings.some(
      function (finding) {
        return finding.id ===
          'material:road-underground-duct:duct-coupling';
      }
    )
  );
  assert.equal(queued.length, 6);
  assert.ok(
    queued.every(function (item) {
      return item.entityType === 'control';
    })
  );
  assert.ok(
    storage.get(
      'buildmind-project-completeness-v1'
    )
  );

  console.log(
    'BuildMind Project Completeness V1 test: PASS'
  );
}


try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
