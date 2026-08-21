'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const app =
  fs.readFileSync(
    path.join(root, 'app.js'),
    'utf8'
  );

const index =
  fs.readFileSync(
    path.join(root, 'index.html'),
    'utf8'
  );

[
  'PROJECT_DOCUMENT_FILE_READ_TIMEOUT_MS',
  'PROJECT_DOCUMENT_PDF_LOAD_TIMEOUT_MS',
  'PROJECT_DOCUMENT_PDF_PAGE_TIMEOUT_MS',
  'PROJECT_DOCUMENT_PDF_TEXT_TIMEOUT_MS',
  'awaitProjectDocumentOperation',
  'PDF_LOAD_TIMEOUT',
  'PDF_PAGE_TIMEOUT',
  'PDF_TEXT_TIMEOUT'
].forEach(function (requiredText) {
  assert.equal(
    app.includes(requiredText),
    true,
    'PDF timeout control is missing: ' +
      requiredText
  );
});

assert.equal(
  index.includes(
    'app.js?v=13'
  ),
  true
);

assert.equal(
  index.includes(
    'agentContracts.js?v=1'
  ),
  true
);

assert.equal(
  index.includes(
    'agentOrchestrator.js?v=1'
  ),
  true
);

assert.equal(
  index.includes(
    'analyzeUploadedDocumentsBtn'
  ),
  true
);

console.log(
  'BuildMind PDF timeout control test: PASS'
);
