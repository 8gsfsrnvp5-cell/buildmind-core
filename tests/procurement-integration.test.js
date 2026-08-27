'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');


const source = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    'procurementIntegration.js'
  ),
  'utf8'
);

const listeners = new Map();
const imports = [];
const events = [];

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
        '2026-09-10'
    }
  ]
};

let rootProject = {
  id: 'project-1',
  name: 'АСУДД ЮВХ',
  object: 'Участок 7'
};

class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const document = {
  readyState: 'complete',
  getElementById() {
    return {
      value: ''
    };
  },
  addEventListener() {}
};

const window = {
  BuildMindProjectCore: {
    getActiveNode() {
      return rootProject;
    },
    getRoot() {
      return rootProject;
    }
  },
  BuildMindProjectAnalysis: {
    getSnapshot() {
      return snapshot;
    }
  },
  BuildMindWorkContexts: {
    importFromAnalysis(
      incomingSnapshot,
      options
    ) {
      imports.push({
        snapshot:
          incomingSnapshot,
        options
      });

      return {
        success: true,
        reason: 'imported',
        added: 1,
        updated: 0,
        invalid: 0,
        reviewSkipped: 0
      };
    }
  },
  addEventListener(type, handler) {
    const handlers =
      listeners.get(type) || [];
    handlers.push(handler);
    listeners.set(type, handlers);
  },
  dispatchEvent(event) {
    events.push(event);
    (
      listeners.get(event.type) ||
      []
    ).forEach(
      function (handler) {
        handler(event);
      }
    );
  }
};

const context = {
  window,
  document,
  CustomEvent,
  Date,
  Number,
  String,
  Object,
  Array,
  Math,
  console: {
    info() {}
  }
};

vm.createContext(context);
vm.runInContext(
  source,
  context,
  {
    filename:
      'procurementIntegration.js'
  }
);


assert.equal(imports.length, 1);
assert.equal(
  imports[0].options.project,
  'АСУДД ЮВХ'
);
assert.equal(
  imports[0].options.object,
  'Участок 7'
);
assert.equal(
  imports[0].options.safetyDays,
  2
);
assert.ok(
  events.some(
    function (event) {
      return (
        event.type ===
        'buildmind:procurement-integration-changed'
      );
    }
  )
);


rootProject = null;

const missingProject =
  window.BuildMindProcurementIntegration
    .importWorkContexts({
      snapshot,
      source: 'test'
    });

assert.equal(
  missingProject.success,
  false
);
assert.equal(
  missingProject.reason,
  'missing-project-context'
);
assert.equal(imports.length, 1);


console.log(
  'BuildMind procurement integration test: PASS'
);

