'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const intake = fs.readFileSync(path.join(root, 'projectIntake.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'documentRegistry.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'projectAnalysisBridge.js'), 'utf8');
const procurement = fs.readFileSync(path.join(root, 'procurementIntegration.js'), 'utf8');
const procurementRisk = fs.readFileSync(path.join(root, 'procurementRiskEngine.js'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'workspace.js'), 'utf8');

const riskIndex = index.indexOf('procurementRiskEngine.js?v=1');
const appIndex = index.indexOf('app.js?v=18');
const intakeIndex = index.indexOf('projectIntake.js?v=16');
const bridgeIndex = index.indexOf('projectAnalysisBridge.js?v=2');
const procurementIndex = index.indexOf('procurementIntegration.js?v=1');
const workspaceIndex = index.indexOf('workspace.js?v=7');

assert.equal(riskIndex >= 0, true);
assert.equal(appIndex > riskIndex, true);
assert.equal(intakeIndex > appIndex, true);
assert.equal(bridgeIndex > intakeIndex, true);
assert.equal(procurementIndex > bridgeIndex, true);
assert.equal(workspaceIndex > procurementIndex, true);
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
assert.equal(
  procurement.includes('importWorkContexts'),
  true
);
assert.equal(
  procurementRisk.includes('delivery-date-missing'),
  true
);
assert.equal(
  index.includes('activeContextSafetyDaysInput'),
  true
);
[
  'workspaceAnalysisSummary',
  'workspaceAnalysisWorksRows',
  'workspaceAnalysisMaterialRows',
  'buildmind:project-analysis-snapshot-changed',
  'workspaceImportGprContextsBtn',
  'data-analysis-material-index'
].forEach(function (marker) {
  assert.equal(
    workspace.includes(marker),
    true,
    'Workspace marker missing: ' + marker
  );
});

console.log('BuildMind end-to-end analysis flow test: PASS');
