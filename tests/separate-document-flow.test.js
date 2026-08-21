'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'projectIntake.js'), 'utf8');
const quality = fs.readFileSync(
  path.join(root, 'projectIntakeQuality.js'),
  'utf8'
);
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

[
  'document-role-select',
  'inferProjectDocumentRoleFromFile(file)',
  'documentRoleSource:',
  'getProjectDocumentRoleOptions',
  'ocr-detail-plan'
].forEach(function (marker) {
  assert.equal(app.includes(marker), true, 'app marker missing: ' + marker);
});

[
  'contract-agent',
  'project-documentation-agent',
  'work-volume-agent',
  'schedule-agent',
  'document.work-volume',
  'document.schedule',
  'project.aggregate',
  'calculation.quantity',
  'Назначение файла выбрано пользователем'
].forEach(function (marker) {
  assert.equal(
    intake.includes(marker),
    true,
    'intake marker missing: ' + marker
  );
});

assert.equal(
  quality.includes('expectedNoDownstream'),
  true,
  'separate contract/project-documentation guard is missing'
);
assert.equal(
  index.includes('Анализировать сейчас'),
  true,
  'manual analysis action is missing'
);

console.log('BuildMind separate document flow test: PASS');
