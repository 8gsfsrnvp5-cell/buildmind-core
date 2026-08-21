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
    crypto: {}
  },

  console: {
    info() {},
    warn() {}
  }
};

vm.createContext(context);

[
  'agentContracts.js',
  'agentOrchestrator.js'
].forEach(function (fileName) {
  vm.runInContext(
    fs.readFileSync(
      path.join(root, fileName),
      'utf8'
    ),
    context,
    {
      filename: fileName
    }
  );
});

const orchestrator =
  context.window
    .BuildMindAgentOrchestrator;

assert.ok(orchestrator);
assert.equal(
  orchestrator.list().length,
  0
);

orchestrator.register({
  id: 'test-pdf-agent',
  taskType: 'document.pdf',
  label: 'Тестовый PDF-агент',
  run: async function (input) {
    return {
      fileName:
        input.fileName,
      works: [
        {
          name: 'Тестовая работа'
        }
      ]
    };
  }
});

orchestrator.register({
  id: 'test-material-agent',
  taskType: 'materials.extract',
  run: function () {
    return {
      materials: [
        {
          name: 'Тестовый материал'
        }
      ]
    };
  }
});

async function run() {
  const report =
    await orchestrator.run(
      'document.pdf',
      {
        fileName:
          'demo.pdf'
      }
    );

  assert.equal(
    report.agentId,
    'test-pdf-agent'
  );
  assert.equal(
    report.status,
    'completed'
  );
  assert.equal(
    report.payload.fileName,
    'demo.pdf'
  );

  const materialReport =
    await orchestrator.run(
      'materials.extract',
      {}
    );

  const summary =
    orchestrator.aggregate([
      report,
      materialReport
    ]);

  assert.equal(
    summary.reportCount,
    2
  );
  assert.equal(
    Array.from(
      summary.agentIds
    )
      .sort()
      .join(','),
    'test-material-agent,test-pdf-agent'
  );
  assert.equal(
    summary.statusCounts.completed,
    2
  );

  const missing =
    await orchestrator.run(
      'document.unknown',
      {}
    );

  assert.equal(
    missing.status,
    'failed'
  );
  assert.equal(
    missing.errorCode,
    'AGENT_NOT_REGISTERED'
  );

  console.log(
    'BuildMind agent orchestrator test: PASS'
  );
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
