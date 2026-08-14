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


function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function createTestContext() {
  const storage = new Map();
  const listeners = new Map();
  const changeSets = [];
  let rootProject = null;

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

  const context = {
    console,
    crypto: webcrypto,
    localStorage,
    document: {
      getElementById() {
        return null;
      },

      querySelector() {
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
    setTimeout(callback) {
      callback();
      return 1;
    },
    addEventListener(type, callback) {
      const group =
        listeners.get(type) || [];
      group.push(callback);
      listeners.set(type, group);
    },
    dispatchEvent(event) {
      (
        listeners.get(event.type) ||
        []
      ).forEach(
        function (callback) {
          callback(event);
        }
      );
    }
  };

  context.window = context;
  context.globalThis = context;

  context.BuildMindProjectCore = {
    getRoot() {
      return rootProject
        ? clone(rootProject)
        : null;
    },

    upsertRoot(project) {
      rootProject = {
        id: 'project-demo-road',
        ...project
      };
      return clone(rootProject);
    }
  };

  context.BuildMindChangeSet = {
    getAll() {
      return clone(changeSets);
    },

    createDemo() {
      if (changeSets.length > 0) {
        return clone(changeSets[0]);
      }

      const demo = {
        id: 'change-set-demo',
        status: 'pending',
        logicalTitle:
          'Дополнительная ВОР',
        previousRevisionLabel: 'R1',
        newRevisionLabel: 'R2',
        warnings: [],
        summary: {
          total: 3,
          added: 1,
          modified: 1,
          removed: 1
        },
        changes: [
          {
            entityType: 'work',
            changeType: 'modified',
            label:
              'Устройство верхнего слоя ЩМА-16',
            before: {
              name:
                'Устройство верхнего слоя ЩМА-16',
              quantity: 20000,
              unit: 'м²'
            },
            after: {
              name:
                'Устройство верхнего слоя ЩМА-16',
              quantity: 22000,
              unit: 'м²'
            }
          },
          {
            entityType: 'material',
            changeType: 'added',
            label:
              'Щебень фракции 20–40',
            after: {
              name:
                'Щебень фракции 20–40',
              quantity: 640,
              unit: 'т'
            }
          },
          {
            entityType: 'material',
            changeType: 'removed',
            label: 'Песок природный',
            before: {
              name: 'Песок природный',
              quantity: 180,
              unit: 'м³'
            }
          }
        ]
      };

      changeSets.push(demo);
      context.dispatchEvent(
        new context.CustomEvent(
          'buildmind:change-sets-changed'
        )
      );

      return clone(demo);
    },

    setDecision(id, status, comment) {
      const item = changeSets.find(
        function (candidate) {
          return candidate.id === id;
        }
      );

      if (!item) {
        return false;
      }

      item.status = status;
      item.decisionComment = comment;
      return true;
    }
  };

  return {
    context,
    localStorage,
    changeSets
  };
}


function run() {
  const {
    context,
    localStorage,
    changeSets
  } = createTestContext();

  vm.createContext(context);

  vm.runInContext(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        'reviewCenter.js'
      ),
      'utf8'
    ),
    context,
    {
      filename: 'reviewCenter.js'
    }
  );

  const demoState =
    context.BuildMindReviewCenter
      .createDemo();

  assert.equal(
    demoState.queue.length,
    10
  );
  assert.equal(
    demoState.queue.filter(
      function (item) {
        return item.status === 'pending';
      }
    ).length,
    10
  );
  assert.equal(
    demoState.model.revision,
    0
  );

  assert.equal(
    context.BuildMindReviewCenter
      .confirmPending(),
    10
  );

  const finalState =
    context.BuildMindReviewCenter
      .getState();

  assert.equal(
    finalState.queue.filter(
      function (item) {
        return item.status ===
          'confirmed';
      }
    ).length,
    10
  );
  assert.equal(
    finalState.decisions.length,
    10
  );
  assert.equal(
    finalState.model.revision,
    10
  );
  assert.equal(
    finalState.model.documents.length,
    2
  );
  assert.ok(
    finalState.model.works.some(
      function (item) {
        return (
          item.name ===
            'Устройство верхнего слоя ЩМА-16' &&
          item.quantity === 22000
        );
      }
    )
  );
  assert.ok(
    finalState.model.materials.some(
      function (item) {
        return item.name ===
          'Щебень фракции 20–40';
      }
    )
  );
  assert.ok(
    finalState.model.materials.some(
      function (item) {
        return (
          item.name ===
            'Песок природный' &&
          item.status === 'excluded'
        );
      }
    )
  );
  assert.deepEqual(
    finalState.model
      .appliedChangeSetIds,
    ['change-set-demo']
  );
  assert.equal(
    changeSets[0].status,
    'confirmed'
  );
  assert.ok(
    localStorage.getItem(
      'buildmind-review-center-v1'
    )
  );

  console.log(
    'BuildMind Review Center V1 test: PASS'
  );
}


try {
  run();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
