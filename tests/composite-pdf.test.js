'use strict';

const assert =
  require('node:assert/strict');

const compositePdf =
  require('../compositePdfEngine.js');

function run() {
  const result =
    compositePdf.analyzePages([
      {
        pageNumber: 1,
        extractionMethod: 'text',
        text:
          'ДОГОВОР ПОДРЯДА № TEST-01. Заказчик и Подрядчик заключили настоящий договор. Предмет договора.'
      },
      {
        pageNumber: 2,
        extractionMethod: 'text',
        text:
          'ПЕРЕЧЕНЬ ПРИЛОЖЕНИЙ\nВедомость объемов работ — приложение 1\nГрафик производства работ — приложение 2\nКоммерческое предложение — приложение 3'
      },
      {
        pageNumber: 3,
        extractionMethod: 'text',
        text:
          '3.1. Подрядчик обязуется выполнить работы. 3.2. Заказчик принимает результат. 3.3. Права и обязанности сторон.'
      },
      {
        pageNumber: 4,
        extractionMethod: 'ocr',
        ocrConfidence: 88,
        text:
          'Приложение № 1. ВЕДОМОСТЬ ОБЪЕДИНЕННЫХ РАБОТ. № п/п. Наименование работ. Ед. изм. Количество.'
      },
      {
        pageNumber: 5,
        extractionMethod: 'text',
        text:
          '№ п/п Наименование работ Ед. изм. Количество. Устройство основания м3 1250. Укладка асфальтобетона т 800.'
      },
      {
        pageNumber: 6,
        extractionMethod: 'text',
        text:
          'Приложение № 2. ГРАФИК ПРОИЗВОДСТВА РАБОТ. Наименование работ. Дата начала. Дата окончания. Продолжительность.'
      },
      {
        pageNumber: 7,
        extractionMethod: 'text',
        text:
          'Наименование работ Начало Окончание Продолжительность. Земляные работы 01.04.2025 30.04.2025 30 дней.'
      },
      {
        pageNumber: 8,
        extractionMethod: 'text',
        text:
          'Приложение № 3. ВЕДОМОСТЬ ДОГОВОРНОЙ ЦЕНЫ. Стоимость работ. Цена за единицу. Всего по договору. В том числе НДС.'
      }
    ], {
      analysisDate: '2026-08-15'
    });

  assert.equal(
    result.success,
    true
  );
  assert.equal(
    result.isComposite,
    true
  );
  assert.deepEqual(
    result.detectedKinds,
    [
      'agreement',
      'work-volume',
      'schedule',
      'commercial-proposal'
    ]
  );

  assert.equal(
    result.meaningfulSections.length,
    4
  );

  assert.deepEqual(
    result.meaningfulSections.map(
      function (section) {
        return [
          section.kind,
          section.startPage,
          section.endPage
        ];
      }
    ),
    [
      ['agreement', 1, 3],
      ['work-volume', 4, 5],
      ['schedule', 6, 7],
      ['commercial-proposal', 8, 8]
    ]
  );

  assert.deepEqual(
    result.ocrPages,
    [4]
  );
  assert.equal(
    result.counts.workVolumes,
    1
  );
  assert.equal(
    result.counts.schedules,
    1
  );
  assert.equal(
    result.counts.commercial,
    1
  );

  const schedule =
    result.meaningfulSections.find(
      function (section) {
        return section.kind ===
          'schedule';
      }
    );

  assert.deepEqual(
    schedule.dateRange,
    {
      startDate: '2025-04-01',
      endDate: '2025-04-30',
      datesCount: 2
    }
  );
  assert.equal(
    schedule.scheduleStatus,
    'expired'
  );

  const missingText =
    compositePdf.analyzePages([
      {
        pageNumber: 1,
        extractionMethod: 'none',
        text: ''
      }
    ]);

  assert.deepEqual(
    missingText.requiresOcrPages,
    [1]
  );
  assert.deepEqual(
    missingText.unreadablePages,
    [1]
  );

  const misleadingContents =
    compositePdf.classifyPage({
      pageNumber: 10,
      extractionMethod: 'text',
      text:
        'СОДЕРЖАНИЕ\nДоговор подряда — стр. 1\nВедомость объемов работ — стр. 20\nГрафик производства работ — стр. 40'
    });

  assert.equal(
    misleadingContents.anchor,
    false
  );
  assert.equal(
    misleadingContents.contentsPage,
    true
  );

  const numberedAppendixRegister =
    compositePdf.classifyPage({
      pageNumber: 31,
      extractionMethod: 'ocr',
      text:
        '19. ПРИЛОЖЕНИЯ К ДОГОВОРУ\nПриложение № 1 — График производства работ;\nПриложение № 1.1 — График освоения денежных средств;\nПриложение № 2 — Ведомость объемов и стоимости работ.'
    });

  assert.equal(
    numberedAppendixRegister.contentsPage,
    true
  );
  assert.equal(
    numberedAppendixRegister.anchor,
    false
  );

  const contractWithAppendixRegister =
    compositePdf.analyzePages([
      {
        pageNumber: 30,
        extractionMethod: 'ocr',
        text:
          '18.6. Подрядчик обязуется выполнить работы. Заказчик и Подрядчик руководствуются условиями договора.'
      },
      {
        pageNumber: 31,
        extractionMethod: 'ocr',
        text:
          '19. ПРИЛОЖЕНИЯ К ДОГОВОРУ\nПриложение № 1 — График производства работ;\nПриложение № 2 — Ведомость объемов и стоимости работ.'
      },
      {
        pageNumber: 32,
        extractionMethod: 'ocr',
        text:
          '20. АДРЕСА И РЕКВИЗИТЫ СТОРОН. Заказчик. Подрядчик. Подписи сторон.'
      }
    ], {
      analysisDate: '2026-08-16'
    });

  assert.deepEqual(
    contractWithAppendixRegister.detectedKinds,
    ['agreement']
  );
  assert.equal(
    contractWithAppendixRegister.counts.schedules,
    0
  );

  const contractScheduleReference =
    compositePdf.classifyPage({
      pageNumber: 11,
      extractionMethod: 'text',
      text:
        '4.1. Подрядчик выполняет работы. 4.2. Заказчик принимает результат. 4.3. Подрядчик обязан разработать и согласовать график производства работ. 4.4. Стороны руководствуются условиями договора.'
    });

  assert.notEqual(
    contractScheduleReference.kind,
    'schedule'
  );
  assert.equal(
    contractScheduleReference.anchor,
    false
  );

  const contractWithoutFalseSchedule =
    compositePdf.analyzePages([
      {
        pageNumber: 1,
        extractionMethod: 'text',
        text:
          'ДОГОВОР ПОДРЯДА № TEST-02. Предмет договора. Заказчик поручает, а Подрядчик обязуется выполнить работы.'
      },
      {
        pageNumber: 2,
        extractionMethod: 'text',
        text:
          '4.1. Подрядчик выполняет работы. 4.2. Заказчик принимает результат. 4.3. Подрядчик обязан представить график производства работ. 4.4. Стороны согласовали условия договора.'
      }
    ], {
      analysisDate: '2026-08-16'
    });

  assert.deepEqual(
    contractWithoutFalseSchedule.detectedKinds,
    ['agreement']
  );
  assert.equal(
    contractWithoutFalseSchedule.counts.schedules,
    0
  );

  const scheduleWithDateNoise =
    compositePdf.analyzePages([
      {
        pageNumber: 1,
        extractionMethod: 'ocr',
        text:
          'ГРАФИК ПРОИЗВОДСТВА РАБОТ. Наименование работ. Дата начала. Дата окончания. Продолжительность. Земляные работы 01.04.2026 30.09.2026. Ошибка OCR 31.04.2026 и 01.04.2825.'
      }
    ], {
      analysisDate: '2026-08-16'
    });

  const noisySchedule =
    scheduleWithDateNoise
      .meaningfulSections[0];

  assert.equal(
    noisySchedule.kind,
    'schedule'
  );
  assert.deepEqual(
    noisySchedule.dateRange,
    {
      startDate: '2026-04-01',
      endDate: '2026-09-30',
      datesCount: 2
    }
  );
  assert.deepEqual(
    noisySchedule.rejectedDateValues,
    ['2825-04-01']
  );
  assert.equal(
    noisySchedule.dateValidation.status,
    'review'
  );
  assert.equal(
    noisySchedule.scheduleStatus,
    'review'
  );

  console.log(
    'BuildMind composite PDF test: PASS'
  );
}

run();
