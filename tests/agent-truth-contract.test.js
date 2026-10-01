'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');
const vm =
  require('node:vm');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const context = {
  window: {
    crypto: {
      randomUUID() {
        return 'test-id';
      }
    }
  },
  console: {
    info() {},
    warn() {}
  }
};

vm.createContext(context);

vm.runInContext(
  fs.readFileSync(
    path.join(root, 'agentContracts.js'),
    'utf8'
  ),
  context,
  {
    filename: 'agentContracts.js'
  }
);

const contracts =
  context.window
    .BuildMindAgentContracts;

assert.ok(contracts);

const unsupported =
  contracts.createReport({
    agentId: 'test-agent',
    taskType: 'test',
    status: 'completed',
    facts: [
      {
        name: 'Объём без источника',
        value: 100,
        unit: 'м³'
      }
    ]
  });

assert.equal(
  unsupported.status,
  'partial'
);
assert.equal(
  unsupported.truthStatus,
  'needs-review'
);
assert.ok(
  unsupported.qualityFlags.includes(
    'FACTS_HAVE_NO_EVIDENCE'
  )
);
assert.ok(
  unsupported.qualityFlags.includes(
    'UNSUPPORTED_FACTS_PRESENT'
  )
);

const supported =
  contracts.createReport({
    agentId: 'test-agent',
    taskType: 'test',
    status: 'completed',
    truthStatus: 'extracted',
    facts: [
      {
        name: 'Объём',
        value: 100,
        unit: 'м³',
        evidence: {
          sourceFile: 'ВОР.pdf',
          sourcePage: 2,
          sourceQuote: '100 м³'
        }
      }
    ],
    evidence: [
      {
        sourceFile: 'ВОР.pdf',
        sourcePage: 2,
        sourceQuote: '100 м³'
      }
    ]
  });

assert.equal(
  supported.status,
  'completed'
);
assert.equal(
  supported.truthStatus,
  'extracted'
);
assert.equal(
  supported.qualityFlags.length,
  0
);

const confirmedWithoutEvidence =
  contracts.validateIntegrity({
    truthStatus: 'confirmed',
    facts: [
      {
        value: 1
      }
    ],
    evidence: []
  });

assert.equal(
  confirmedWithoutEvidence.valid,
  false
);
assert.ok(
  confirmedWithoutEvidence.issues.includes(
    'FACTS_HAVE_NO_EVIDENCE'
  )
);
assert.ok(
  confirmedWithoutEvidence.issues.includes(
    'CONFIRMED_STATUS_REQUIRES_EVIDENCE'
  )
);

const manual =
  contracts.createReport({
    agentId: 'engineer',
    taskType: 'manual-review',
    status: 'completed',
    truthStatus: 'manual-override',
    manualReview: {
      role: 'engineer',
      reason: 'Уточнено по подписанному акту',
      previousValue: 100,
      newValue: 120
    },
    facts: [],
    evidence: [
      {
        sourceFile: 'Акт.pdf',
        sourcePage: 1
      }
    ]
  });

assert.equal(
  manual.truthStatus,
  'manual-override'
);
assert.equal(
  manual.manualReview.newValue,
  120
);

console.log(
  'BuildMind truth contract test: PASS'
);
