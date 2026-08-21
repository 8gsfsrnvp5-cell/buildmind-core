'use strict';

const assert =
  require('node:assert/strict');

const pdfTable =
  require('../pdfTableEngine.js');

function word(
  text,
  x0,
  y0,
  x1,
  y1
) {
  return {
    text,
    confidence: 90,
    bbox: {
      x0,
      y0,
      x1,
      y1
    }
  };
}

function run() {
  const directRow =
    pdfTable.parseVolumeRow(
      '1 Устройство щебеночного основания м3 1 250,5',
      {
        workTable: true
      }
    );

  assert.equal(
    directRow.workName,
    'Устройство щебеночного основания'
  );
  assert.equal(
    directRow.unit,
    'м³'
  );
  assert.equal(
    directRow.quantity,
    1250.5
  );
  assert.equal(
    directRow.rowType,
    'work'
  );

  const rowWithPriceColumns =
    pdfTable.parseVolumeRow(
      '1 Устройство щебеночного основания м3 1 250,5 4 500,00 5 627 250,00',
      {
        workTable: true
      }
    );

  assert.equal(
    rowWithPriceColumns.quantity,
    1250.5,
    'Количество не должно склеиваться с ценой и итоговой стоимостью.'
  );

  const layoutRows =
    pdfTable.buildRowsFromLayoutWords([
      word('1', 10, 100, 20, 120),
      word('Устройство', 45, 100, 125, 120),
      word('основания', 135, 100, 205, 120),
      word('м3', 430, 100, 455, 120),
      word('1250', 520, 100, 565, 120),
      word('2', 10, 145, 20, 165),
      word('Щебень', 45, 145, 105, 165),
      word('фракции', 115, 145, 180, 165),
      word('20-40', 190, 145, 235, 165),
      word('т', 430, 145, 440, 165),
      word('800', 520, 145, 555, 165)
    ]);

  assert.deepEqual(
    layoutRows.map(function (row) {
      return row.text;
    }),
    [
      '1 Устройство основания м3 1250',
      '2 Щебень фракции 20-40 т 800'
    ]
  );

  const pricedLayoutRow =
    pdfTable.buildRowsFromLayoutWords([
      word('1', 10, 100, 20, 120),
      word('Устройство', 45, 100, 125, 120),
      word('основания', 135, 100, 205, 120),
      word('м3', 430, 100, 455, 120),
      word('1', 520, 100, 528, 120),
      word('250', 532, 100, 558, 120),
      word('500', 680, 100, 710, 120),
      word('625000', 830, 100, 890, 120)
    ])[0];

  assert.deepEqual(
    pricedLayoutRow.cells,
    [
      '1 Устройство основания',
      'м3',
      '1 250',
      '500',
      '625000'
    ]
  );
  assert.equal(
    pdfTable.parseLayoutVolumeRow(
      pricedLayoutRow,
      {
        workTable: true
      }
    ).quantity,
    1250,
    'Координаты колонок должны отделять количество от цены и стоимости.'
  );

  const pages = [
    {
      pageNumber: 33,
      text:
        'ГРАФИК ПРОИЗВОДСТВА РАБОТ. Наименование работ. Начало. Окончание.'
    },
    {
      pageNumber: 34,
      text:
        'Земляные работы 01.04.2026 30.04.2026'
    },
    {
      pageNumber: 39,
      text:
        'ВЕДОМОСТЬ ОБЪЕМОВ И СТОИМОСТИ РАБОТ. Наименование работ. Ед. изм. Количество.'
    },
    {
      pageNumber: 40,
      text: '',
      layoutWords: [
        word('1', 10, 100, 20, 120),
        word('Устройство', 45, 100, 125, 120),
        word('основания', 135, 100, 205, 120),
        word('м3', 430, 100, 455, 120),
        word('1250', 520, 100, 565, 120),
        word('2', 10, 145, 20, 165),
        word('Щебень', 45, 145, 105, 165),
        word('фракции', 115, 145, 180, 165),
        word('20-40', 190, 145, 235, 165),
        word('т', 430, 145, 440, 165),
        word('800', 520, 145, 555, 165)
      ]
    },
    {
      pageNumber: 41,
      text:
        '3\nУкладка асфальтобетона\nт\n640'
    }
  ];

  const result =
    pdfTable.analyzePages(
      pages,
      [
        {
          id: 'schedule',
          kind: 'schedule',
          pageNumbers: [33, 34]
        },
        {
          id: 'prices',
          kind: 'commercial-proposal',
          pageNumbers: [39, 40, 41]
        }
      ],
      {
        sourceDocument:
          'ROAD-TEST.pdf'
      }
    );

  assert.equal(
    result.success,
    true
  );
  assert.equal(
    result.sectionsReceived,
    2
  );
  assert.equal(
    result.contextsAnalyzed,
    2
  );
  assert.deepEqual(
    result.pagesConsidered,
    [33, 34, 39, 40, 41]
  );
  assert.equal(
    result.contextSections[0]
      .schedule,
    true
  );
  assert.equal(
    result.contextSections[1]
      .workTable,
    true
  );
  assert.equal(
    result.works.length,
    3
  );
  assert.equal(
    result.materials.length,
    1
  );
  assert.equal(
    result.uncertain.length,
    0
  );
  assert.deepEqual(
    result.pagesAnalyzed,
    [34, 40, 41]
  );
  assert.ok(
    result.works.some(function (item) {
      return (
        item.workName ===
          'Земляные работы' &&
        item.startDate ===
          '2026-04-01' &&
        item.finishDate ===
          '2026-04-30'
      );
    })
  );
  assert.ok(
    result.works.some(function (item) {
      return (
        item.workName ===
          'Укладка асфальтобетона' &&
        item.quantity === 640 &&
        item.unit === 'т'
      );
    })
  );

  console.log(
    'BuildMind PDF table engine test: PASS'
  );
}

run();
