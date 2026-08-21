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

const index =
  fs.readFileSync(
    path.join(root, 'index.html'),
    'utf8'
  );

const intake =
  fs.readFileSync(
    path.join(root, 'projectIntake.js'),
    'utf8'
  );

[
  'agentContracts.js?v=1',
  'agentOrchestrator.js?v=1',
  'projectIntake.js?v=11'
].forEach(function (asset) {
  assert.equal(
    index.includes(asset),
    true,
    'Agent asset is not loaded: ' +
      asset
  );
});

[
  'document.pdf',
  'document.spreadsheet',
  'document.other',
  'materials.extract',
  'calculation.quantity',
  'agentReports',
  'agentSummary'
].forEach(function (marker) {
  assert.equal(
    intake.includes(marker),
    true,
    'Agent integration marker is missing: ' +
      marker
  );
});

console.log(
  'BuildMind agent integration test: PASS'
);
