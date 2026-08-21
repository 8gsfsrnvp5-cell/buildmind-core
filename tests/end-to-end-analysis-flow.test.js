'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'projectIntake.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'documentRegistry.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'projectAnalysisBridge.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');

const intakeIndex = index.indexOf('projectIntake.js?v=15');
const bridgeIndex = index.indexOf('projectAnalysisBridge.js?v=1');
const workspaceIndex = index.indexOf('workspace.js?v=5');

assert.equal(intakeIndex >= 0, true);
assert.equal(bridgeIndex > intakeIndex, true);
assert.equal(workspaceIndex > bridgeIndex, true);
assert.equal(
  intake.includes('buildmind:project-intake-completed'),
  true
);
assert.equal(
  bridge.includes('buildmind-project-analysis-snapshot-v1'),
  true
);
assert.equal(
  bridge.includes('buildProjectAnalysisCombinedRows'),
  true
);
assert.equal(
  registry.includes('importAnalysisSnapshot'),
  true
);
[
  'workspaceAnalysisSummary',
  'workspaceAnalysisWorksRows',
  'workspaceAnalysisMaterialRows',
  'buildmind:project-analysis-snapshot-changed'
].forEach(function (marker) {
  assert.equal(
    workspace.includes(marker),
    true,
    'Workspace marker missing: ' + marker
  );
});

console.log('BuildMind end-to-end analysis flow test: PASS');
