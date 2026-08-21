'use strict';

const assert =
  require('node:assert/strict');

global.window = {};

require('../projectIntakeQuality.js');

const intakeQuality =
  global.window
    .BuildMindProjectIntakeQuality;

function run() {
  const contractReference =
    intakeQuality.classifySignals(
      'Документ.pdf',
      '4.1. Подрядчик выполняет работы. 4.2. Заказчик принимает результат. 4.3. Подрядчик обязан разработать и согласовать график производства работ. 4.4. Стороны руководствуются договором.'
    );

  assert.notEqual(
    contractReference?.kind,
    'schedule'
  );

  const realSchedule =
    intakeQuality.classifySignals(
      'ГПР объекта.pdf',
      'ГРАФИК ПРОИЗВОДСТВА РАБОТ. Наименование работ. Дата начала. Дата окончания. Продолжительность.'
    );

  assert.equal(
    realSchedule.kind,
    'schedule'
  );
  assert.equal(
    realSchedule.confidence,
    'high'
  );

  const approvals =
    intakeQuality.extractApprovals({
      file: {
        name:
          'Договор подряда № TEST-03.pdf'
      },
      analysis: {
        success: true,
        extractedPages: [
          {
            pageNumber: 1,
            text:
              'До начала работ Подрядчик обязан получить согласование схемы с Заказчиком.'
          },
          {
            pageNumber: 2,
            text:
              'Подрядчик обязан согласовать график производства работ с Заказчиком.'
          },
          {
            pageNumber: 3,
            text:
              'График производства работ согласован Заказчиком 12.08.2026.'
          },
          {
            pageNumber: 4,
            text:
              'Условия настоящего договора согласованы сторонами.'
          },
          {
            pageNumber: 5,
            text:
              'При замене материала решение принимается по согласованию с проектной организацией.'
          },
          {
            pageNumber: 6,
            text:
              'Разрешение на производство работ получено 12.08.2026.'
          },
          {
            pageNumber: 7,
            text:
              'Согласование схемы с Заказчиком.'
          },
          {
            pageNumber: 8,
            text:
              'Подрядчик повторно указывает, что обязан согласовать график производства работ с Заказчиком.'
          },
          {
            pageNumber: 9,
            text:
              'До начала работ Подрядчик обязан получить согласование схемы с Заказчиком.'
          }
        ]
      }
    });

  assert.equal(
    approvals.length,
    5
  );

  const byPage =
    new Map(
      approvals.map(function (item) {
        return [
          item.pageNumber,
          item
        ];
      })
    );

  assert.equal(
    byPage.get(1).intent,
    'prerequisite'
  );
  assert.equal(
    byPage.get(2).intent,
    'contractual-requirement'
  );
  assert.equal(
    byPage.get(3).intent,
    'completed'
  );
  assert.equal(
    byPage.has(4),
    false
  );
  assert.equal(
    byPage.get(5).intent,
    'conditional'
  );
  assert.equal(
    byPage.get(6).intent,
    'completed'
  );
  assert.equal(
    byPage.has(7),
    false
  );

  assert.deepEqual(
    byPage.get(1).pageNumbers,
    [1, 9]
  );
  assert.deepEqual(
    byPage.get(2).pageNumbers,
    [2, 8]
  );

  const failedQuality =
    intakeQuality.evaluateResult({
      unreadablePagesCount: 0,
      approvals:
        Array.from(
          {
            length: 41
          },
          function () {
            return {};
          }
        ),
      documents: [
        {
          fileName: 'ROAD-FAIL.pdf',
          totalPages: 41,
          works: [],
          sections:
            Array.from(
              {
                length: 14
              },
              function (_, index) {
                return {
                  kind:
                    index === 12
                      ? 'work-volume'
                      : 'agreement'
                };
              }
            )
        }
      ]
    });

  assert.equal(
    failedQuality.status,
    'blocked'
  );
  assert.ok(
    failedQuality.issues.some(
      function (issue) {
        return issue.code ===
          'section-fragmentation';
      }
    )
  );
  assert.ok(
    failedQuality.issues.some(
      function (issue) {
        return issue.code ===
          'work-volume-empty';
      }
    )
  );
  assert.ok(
    failedQuality.issues.some(
      function (issue) {
        return issue.code ===
          'approval-overflow';
      }
    )
  );

  const emptyDownstreamQuality =
    intakeQuality.evaluateResult({
      unreadablePagesCount: 0,
      approvals: [],
      documents: [
        {
          fileName:
            'ROAD-REAL-41P.pdf',
          totalPages: 41,
          extractedPagesCount: 41,
          pagesWithText: 41,
          ocrPages:
            Array.from(
              {
                length: 40
              },
              function (_, index) {
                return index + 1;
              }
            ),
          kind: 'agreement',
          sections: [
            {
              kind: 'agreement',
              startPage: 1,
              endPage: 41
            }
          ],
          works: [],
          materials: [],
          pdfTableAnalysis: {
            sectionsReceived: 1,
            contextsAnalyzed: 0,
            pagesConsidered: []
          }
        }
      ]
    });

  assert.equal(
    emptyDownstreamQuality.status,
    'blocked'
  );
  assert.ok(
    emptyDownstreamQuality.issues.some(
      function (issue) {
        return issue.code ===
          'downstream-extraction-empty';
      }
    )
  );

  const scheduleEmptyQuality =
    intakeQuality.evaluateResult({
      unreadablePagesCount: 0,
      approvals: [],
      documents: [
        {
          fileName:
            'ROAD-SCHEDULE-EMPTY.pdf',
          totalPages: 41,
          extractedPagesCount: 41,
          sections: [
            {
              kind: 'agreement'
            },
            {
              kind: 'schedule'
            }
          ],
          works: [],
          materials: []
        }
      ]
    });

  assert.equal(
    scheduleEmptyQuality.status,
    'blocked'
  );
  assert.ok(
    scheduleEmptyQuality.issues.some(
      function (issue) {
        return (
          issue.code ===
            'schedule-rows-empty' &&
          issue.severity ===
            'blocked'
        );
      }
    )
  );

  const passedQuality =
    intakeQuality.evaluateResult({
      unreadablePagesCount: 0,
      approvals: approvals.slice(0, 4),
      documents: [
        {
          fileName: 'ROAD-PASS.pdf',
          totalPages: 41,
          sections: [
            {
              kind: 'agreement'
            },
            {
              kind: 'schedule'
            },
            {
              kind:
                'commercial-proposal',
              secondaryKinds: [
                'work-volume'
              ]
            }
          ],
          works: [
            {
              workName:
                'Земляные работы',
              quantity: 1250,
              sourceType:
                'pdf-work-volume',
              sourceTypes: [
                'pdf-work-volume',
                'pdf-schedule'
              ]
            }
          ]
        }
      ]
    });

  assert.equal(
    passedQuality.status,
    'complete'
  );
  assert.deepEqual(
    passedQuality.issues,
    []
  );

  delete global.window;

  console.log(
    'BuildMind intake precision test: PASS'
  );
}

run();
