'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'documentRegistry.js'),
  'utf8'
);
const storage = new Map();
const events = [];
let nextId = 0;

const window = {
  crypto: {
    randomUUID: function () {
      nextId += 1;
      return 'id-' + nextId;
    }
  },
  addEventListener: function () {},
  dispatchEvent: function (event) {
    events.push(event);
  }
};
const document = {
  getElementById: function () {
    return null;
  },
  querySelectorAll: function () {
    return [];
  },
  createElement: function () {
    return {};
  }
};
const localStorage = {
  getItem: function (key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem: function (key, value) {
    storage.set(key, String(value));
  }
};

class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
}

vm.runInNewContext(source, {
  window,
  document,
  localStorage,
  CustomEvent,
  Date,
  Map,
  Set,
  Array,
  Object,
  String,
  Number,
  JSON,
  Math,
  console: {
    info: function () {},
    warn: function () {},
    error: function () {}
  },
  confirm: function () {
    return true;
  }
});

const api = window.BuildMindDocumentRegistry;
const snapshot = {
  savedAt: '2026-08-21T12:00:00.000Z',
  qualityStatus: 'review',
  documents: [
    {
      fileName: 'ВОР 111.pdf',
      documentRole: 'work-volume',
      kind: 'work-volume',
      confidence: 'high',
      totalPages: 3,
      ocrPages: [1, 2, 3],
      unreadablePages: [],
      worksCount: 55,
      materialsCount: 0,
      analysisFingerprint: 'vor-a'
    },
    {
      fileName: 'ГПР 111.pdf',
      documentRole: 'schedule',
      kind: 'schedule',
      confidence: 'high',
      totalPages: 3,
      ocrPages: [1, 2, 3],
      unreadablePages: [],
      worksCount: 123,
      materialsCount: 0,
      analysisFingerprint: 'gpr-a'
    }
  ]
};

api.importAnalysisSnapshot(snapshot);
let state = api.getState();

assert.equal(state.documents.length, 2);
assert.equal(state.documents[0].revisions.length, 1);
assert.equal(state.documents[0].revisions[0].status, 'under-review');
assert.equal(
  state.documents[0].revisions[0].sourceType,
  'project-intake-analysis'
);

api.importAnalysisSnapshot(snapshot);
state = api.getState();
assert.equal(state.documents[0].revisions.length, 1);

api.importAnalysisSnapshot({
  ...snapshot,
  savedAt: '2026-08-21T13:00:00.000Z',
  documents: snapshot.documents.map(function (item, index) {
    return index === 0
      ? {
          ...item,
          worksCount: 56,
          analysisFingerprint: 'vor-b'
        }
      : item;
  })
});
state = api.getState();

assert.equal(state.documents[0].revisions.length, 2);
assert.equal(state.documents[0].revisions[0].status, 'superseded');
assert.equal(state.documents[0].revisions[1].status, 'under-review');
assert.equal(
  events.some(function (event) {
    return event.type === 'buildmind:document-registry-changed';
  }),
  true
);

console.log('BuildMind document registry analysis import test: PASS');
