'use strict';

const assert =
  require('node:assert/strict');
const fs =
  require('node:fs');
const path =
  require('node:path');
const compositePdf =
  require('../compositePdfEngine.js');

function run() {
  const fixturePath =
    path.join(
      __dirname,
      'fixtures',
      'composite-pdf-road-41p.gold.json'
    );

  const fixture =
    JSON.parse(
      fs.readFileSync(
        fixturePath,
        'utf8'
      )
    );

  assert.equal(
    fixture.sourcePolicy,
    'private-local-only'
  );
  assert.equal(
    fixture.totalPages,
    41
  );

  const coveredPages = [];

  fixture.expectedSections
    .forEach(function (section) {
      assert.ok(
        section.startPage >= 1
      );
      assert.ok(
        section.endPage >=
          section.startPage
      );

      for (
        let page =
          section.startPage;
        page <= section.endPage;
        page += 1
      ) {
        coveredPages.push(page);
      }
    });

  assert.deepEqual(
    coveredPages,
    Array.from(
      {
        length:
          fixture.totalPages
      },
      function (_, index) {
        return index + 1;
      }
    )
  );

  assert.deepEqual(
    fixture.expectedSections.map(
      function (section) {
        return [
          section.kind,
          section.startPage,
          section.endPage
        ];
      }
    ),
    [
      ['agreement', 1, 32],
      ['schedule', 33, 38],
      ['commercial-proposal', 39, 41]
    ]
  );

  assert.ok(
    fixture.pageExpectations.some(
      function (item) {
        return (
          item.pageNumber === 31 &&
          item.expectedKind ===
            'agreement' &&
          item.forbiddenAnchorKinds
            .includes('schedule')
        );
      }
    )
  );

  const syntheticPages =
    Array.from(
      {
        length: 41
      },
      function (_, index) {
        const pageNumber =
          index + 1;

        if (pageNumber === 1) {
          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              'ДОГОВОР ПОДРЯДА № ROAD-TEST. Заказчик поручает, а Подрядчик обязуется выполнить работы.'
          };
        }

        if (pageNumber <= 30) {
          const contractNoise = [
            'Цена договора включает стоимость работ, расходы и обязательные платежи. Заказчик и Подрядчик согласовали порядок расчётов.',
            'Подрядчик обязан передать проектную и рабочую документацию. Упоминание документации не начинает новый документ.',
            'Подрядчик обязан разработать график производства работ. Это договорное требование, а не сам ГПР.',
            'Объёмы работ и договорная цена уточняются сторонами в порядке, установленном договором.'
          ];

          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              `${pageNumber}.1. ${
                contractNoise[
                  pageNumber %
                  contractNoise.length
                ]
              } ${pageNumber}.2. Права и обязанности сторон.`
          };
        }

        if (pageNumber === 31) {
          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              'ПРИЛОЖЕНИЯ К ДОГОВОРУ\nПриложение № 1 — График производства работ.\nПриложение № 2 — Ведомость объемов и стоимости работ.'
          };
        }

        if (pageNumber === 32) {
          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              'АДРЕСА И РЕКВИЗИТЫ СТОРОН. Заказчик. Подрядчик. Подписи сторон.'
          };
        }

        if (pageNumber === 33) {
          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              'Приложение № 1. ГРАФИК ПРОИЗВОДСТВА РАБОТ. Наименование работ. Начало. Окончание. Продолжительность.'
          };
        }

        if (pageNumber <= 38) {
          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              `Этап ${pageNumber - 33}. Земляные работы 01.04.2026 30.04.2026.`
          };
        }

        if (pageNumber === 39) {
          return {
            pageNumber,
            extractionMethod: 'ocr',
            text:
              'Приложение № 2. ВЕДОМОСТЬ ОБЪЕМОВ И СТОИМОСТИ РАБОТ. Наименование работ. Ед. изм. Количество. Цена за единицу. Стоимость всего. Руб.'
          };
        }

        return {
          pageNumber,
          extractionMethod: 'ocr',
          text:
            `${pageNumber - 39}. Устройство дорожного основания м3 1250.`
        };
      }
    );

  const classified =
    compositePdf.analyzePages(
      syntheticPages,
      {
        analysisDate:
          '2026-08-18'
      }
    );

  assert.deepEqual(
    classified.meaningfulSections.map(
      function (section) {
        return [
          section.kind,
          section.startPage,
          section.endPage
        ];
      }
    ),
    fixture.expectedSections.map(
      function (section) {
        return [
          section.kind,
          section.startPage,
          section.endPage
        ];
      }
    ),
    'Эталон должен проверять фактический результат классификатора, а не только структуру JSON.'
  );

  assert.deepEqual(
    classified.meaningfulSections[2]
      .secondaryKinds,
    ['work-volume']
  );
  assert.equal(
    classified.counts.workVolumes,
    1
  );

  console.log(
    'BuildMind 41-page gold fixture test: PASS'
  );
}

run();
