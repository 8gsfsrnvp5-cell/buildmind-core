'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');
const vm =
  require('node:vm');


function createStorage(seed = {}) {
  const state =
    new Map(
      Object.entries(seed)
    );

  return {
    getItem(key) {
      return state.has(key)
        ? state.get(key)
        : null;
    },

    setItem(key, value) {
      state.set(
        key,
        String(value)
      );
    },

    removeItem(key) {
      state.delete(key);
    },

    snapshot() {
      return Object.fromEntries(
        state.entries()
      );
    }
  };
}


function run() {
  const localStorage =
    createStorage({
      'buildmind-procurement-data-v2-clean':
        '[{"name":"Гайка М10"}]',
      'buildmind-material-archive-v1':
        '[{"name":"Гайка"}]',
      'buildmind-material-history-v1':
        '[{"action":"added"}]',
      'buildmindWorkContexts-v2-clean':
        '[{"project":"Капитальный ремонт"}]',
      'buildmindActiveContextId-v2-clean':
        'old-context',
      'buildmind-material-candidate-reviews-v2-clean':
        '{"candidate":"confirmed"}',
      'buildmind-project-core-v1':
        '{"rootProject":{"name":"Старый проект"}}',
      'buildmind-document-registry-v1':
        '{"documents":[{"logicalTitle":"Старая ВОР"}]}',
      'buildmind-change-sets-v1':
        '{"changeSets":[{"sourceType":"demo"}]}',
      'buildmind-workspace-active-view-v1':
        'changes',
      'buildmind-ui-locale-v1':
        'ru',
      'unrelated-user-setting':
        'preserve-me'
    });

  const sessionStorage =
    createStorage();

  const context = {
    console,
    localStorage,
    sessionStorage,
    Date,
    JSON,
    Object,
    Array,
    Error,
    module: {
      exports: {}
    }
  };

  context.window =
    context;

  vm.createContext(context);

  vm.runInContext(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        'projectSession.js'
      ),
      'utf8'
    ),
    context,
    {
      filename:
        'projectSession.js'
    }
  );

  const api =
    context
      .BuildMindProjectSession;

  const notice =
    api.resetLiveProject({
      localStorage,
      sessionStorage,
      nextView:
        'documents'
    });

  api.liveProjectStorageKeys
    .forEach(
      function (storageKey) {
        assert.equal(
          localStorage.getItem(
            storageKey
          ),
          null,
          `${storageKey} должен быть очищен`
        );
      }
    );

  assert.equal(
    localStorage.getItem(
      'buildmind-workspace-active-view-v1'
    ),
    'documents'
  );

  assert.equal(
    localStorage.getItem(
      'buildmind-ui-locale-v1'
    ),
    'ru'
  );

  assert.equal(
    localStorage.getItem(
      'unrelated-user-setting'
    ),
    'preserve-me'
  );

  assert.equal(
    notice.clearedKeys.length,
    api.liveProjectStorageKeys.length
  );

  const consumed =
    api.consumeCleanStartNotice(
      sessionStorage
    );

  assert.equal(
    consumed.nextView,
    'documents'
  );

  assert.equal(
    api.consumeCleanStartNotice(
      sessionStorage
    ),
    null
  );

  console.log(
    'BuildMind clean live project test: PASS'
  );
}


run();

