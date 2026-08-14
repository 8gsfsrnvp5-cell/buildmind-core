'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');


class ClassList {
  add() {}
  remove() {}
  toggle() {}
  contains() {
    return false;
  }
}


class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList =
      new ClassList();
    this.files = [];
    this.options = [];
    this.checked = false;
    this.disabled = false;
  }

  addEventListener() {}

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild() {}
  replaceChildren(...children) {
    this.children = children;
  }

  querySelector() {
    return new FakeElement();
  }

  querySelectorAll() {
    return [];
  }

  setAttribute() {}
  getAttribute() {
    return null;
  }

  removeAttribute() {}
  closest() {
    return null;
  }

  click() {}
  focus() {}
  remove() {}
  scrollIntoView() {}
}


function createBuildMindTestContext() {
  const elements =
    new Map();

  const element =
    function (id) {
      if (!elements.has(id)) {
        elements.set(
          id,
          new FakeElement(id)
        );
      }

      return elements.get(id);
    };

  element('newUnit').value =
    'шт';
  element('newStock').value =
    '0';
  element('newReserved').value =
    '0';
  element('newConfirmed').value =
    '0';
  element('newLead').value =
    '1';

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
    },

    removeItem(key) {
      storage.delete(key);
    },

    clear() {
      storage.clear();
    }
  };

  const document = {
    documentElement:
      new FakeElement('html'),

    body:
      new FakeElement('body'),

    getElementById:
      element,

    querySelector(selector) {
      return element(selector);
    },

    querySelectorAll() {
      return [];
    },

    createElement() {
      return new FakeElement();
    },

    createDocumentFragment() {
      return new FakeElement();
    },

    addEventListener() {}
  };

  const context = {
    console,
    document,
    localStorage,
    crypto:
      webcrypto,

    CustomEvent:
      class CustomEvent {
        constructor(
          type,
          options = {}
        ) {
          this.type = type;
          this.detail =
            options.detail;
        }
      },

    Blob,
    URL,
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
    setTimeout,
    clearTimeout,
    alert() {},
    confirm() {
      return true;
    },

    prompt() {
      return 'Тестовое основание';
    },

    addEventListener() {},
    dispatchEvent() {},
    location: {
      reload() {}
    },
    navigator: {}
  };

  context.window =
    context;
  context.globalThis =
    context;

  return {
    context,
    element,
    localStorage
  };
}


function readStoredArray(
  localStorage,
  key
) {
  return JSON.parse(
    localStorage.getItem(key) ||
      '[]'
  );
}


const {
  context,
  element,
  localStorage
} = createBuildMindTestContext();

vm.createContext(context);

vm.runInContext(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      'app.js'
    ),
    'utf8'
  ),
  context,
  {
    filename: 'app.js'
  }
);


element('newProject').value =
  'Тестовый проект';
element('newObject').value =
  'Объект 1';
element('newWork').value =
  'Кабельная канализация';
element('newName').value =
  'Гайка М10';
element('newNeed').value =
  '2000';
element('newUnit').value =
  'шт';
element('materialChangeReason').value =
  'Предварительный расчёт';

context.addMaterial();

let active =
  readStoredArray(
    localStorage,
    'buildmind-procurement-data-v2-clean'
  );

let history =
  readStoredArray(
    localStorage,
    'buildmind-material-history-v1'
  );

assert.equal(
  active.length,
  1
);

assert.equal(
  active[0].need,
  2000
);

assert.equal(
  active[0].revision,
  1
);

assert.ok(
  active[0].id.startsWith(
    'material-'
  )
);

assert.equal(
  history.length,
  1
);

assert.equal(
  history[0].action,
  'created'
);


context.startMaterialEdit(0);

element('newNeed').value =
  '2200';

element('materialChangeReason').value =
  'Добавлен технологический запас';

context.addMaterial();

active =
  readStoredArray(
    localStorage,
    'buildmind-procurement-data-v2-clean'
  );

history =
  readStoredArray(
    localStorage,
    'buildmind-material-history-v1'
  );

assert.equal(
  active[0].need,
  2200
);

assert.equal(
  active[0].revision,
  2
);

assert.equal(
  history.length,
  2
);

assert.equal(
  history[1].action,
  'updated'
);

assert.equal(
  history[1].before.need,
  2000
);

assert.equal(
  history[1].after.need,
  2200
);


context.deleteMaterial(0);

active =
  readStoredArray(
    localStorage,
    'buildmind-procurement-data-v2-clean'
  );

let archive =
  readStoredArray(
    localStorage,
    'buildmind-material-archive-v1'
  );

history =
  readStoredArray(
    localStorage,
    'buildmind-material-history-v1'
  );

assert.equal(
  active.length,
  0
);

assert.equal(
  archive.length,
  1
);

assert.equal(
  archive[0].status,
  'archived'
);

assert.equal(
  archive[0].revision,
  3
);

assert.equal(
  history[2].action,
  'archived'
);


context.restoreArchivedMaterial(
  archive[0].id
);

active =
  readStoredArray(
    localStorage,
    'buildmind-procurement-data-v2-clean'
  );

archive =
  readStoredArray(
    localStorage,
    'buildmind-material-archive-v1'
  );

history =
  readStoredArray(
    localStorage,
    'buildmind-material-history-v1'
  );

assert.equal(
  active.length,
  1
);

assert.equal(
  archive.length,
  0
);

assert.equal(
  active[0].status,
  'active'
);

assert.equal(
  active[0].revision,
  4
);

assert.equal(
  history.length,
  4
);

assert.equal(
  history[3].action,
  'restored'
);


context.resetMaterials();

active =
  readStoredArray(
    localStorage,
    'buildmind-procurement-data-v2-clean'
  );

archive =
  readStoredArray(
    localStorage,
    'buildmind-material-archive-v1'
  );

history =
  readStoredArray(
    localStorage,
    'buildmind-material-history-v1'
  );

assert.equal(
  active.length,
  0
);

assert.equal(
  archive.length,
  1
);

assert.equal(
  history.length,
  5
);

assert.equal(
  history[4].action,
  'archived'
);


console.log(
  'BuildMind material state test: PASS'
);
