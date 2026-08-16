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

  delete global.window;

  console.log(
    'BuildMind intake precision test: PASS'
  );
}

run();
