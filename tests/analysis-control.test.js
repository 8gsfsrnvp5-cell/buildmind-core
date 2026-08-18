'use strict';

const assert =
  require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(
  __dirname,
  '..'
);

const app = fs.readFileSync(
  path.join(root, 'app.js'),
  'utf8'
);

const intake = fs.readFileSync(
  path.join(root, 'projectIntake.js'),
  'utf8'
);

const index = fs.readFileSync(
  path.join(root, 'index.html'),
  'utf8'
);

const pdfTable = fs.readFileSync(
  path.join(root, 'pdfTableEngine.js'),
  'utf8'
);

assert.equal(
  index.includes('id="analyzePdfBtn"'),
  false,
  'В интерфейсе должна оставаться только одна кнопка анализа комплекта.'
);

assert.equal(
  intake.includes(
    'id="projectIntakeCancelBtn"'
  ),
  true,
  'Во время анализа должна быть доступна кнопка остановки.'
);

assert.equal(
  intake.includes(
    'PROJECT_INTAKE_AUTO_DELAY'
  ),
  false,
  'Загрузка файла не должна автоматически запускать тяжёлый анализ.'
);

assert.equal(
  intake.includes(
    'Анализ не запускается автоматически.'
  ),
  true
);

assert.equal(
  app.includes(
    'PROJECT_DOCUMENT_OCR_PAGE_TIMEOUT_MS'
  ),
  true,
  'OCR страницы должен иметь ограничение времени.'
);

assert.equal(
  app.includes(
    'PROJECT_DOCUMENT_OCR_INITIALIZATION_TIMEOUT_MS'
  ),
  true,
  'Первое подключение OCR должно иметь отдельное увеличенное время.'
);

assert.equal(
  app.includes(
    'PROJECT_DOCUMENT_OCR_DOCUMENT_TIMEOUT_MS'
  ),
  true,
  'Весь OCR-документ должен иметь общий лимит времени.'
);

assert.equal(
  app.includes(
    'getProjectDocumentPrioritizedOcrPages'
  ),
  true,
  'Сканированный PDF должен начинаться с быстрого поиска структуры.'
);

assert.equal(
  app.includes(
    "mode === 'detail'"
  ),
  true,
  'Точный OCR должен быть отделён от быстрого прохода.'
);

assert.equal(
  intake.includes(
    'shouldRetryOcr'
  ),
  true,
  'После ошибки подключения OCR повторный анализ должен запускать распознавание заново.'
);

assert.equal(
  intake.includes(
    'Анализ завершён не полностью'
  ),
  true,
  'При непрочитанных страницах интерфейс не должен показывать полный успех.'
);

assert.equal(
  index.includes(
    'pdfTableEngine.js?v=1'
  ),
  true,
  'Перед Project Intake должен подключаться анализатор PDF-таблиц.'
);

assert.equal(
  /https:\/\/cdn\.(?:jsdelivr|sheetjs)/.test(index),
  false,
  'Рабочий ZIP не должен зависеть от внешнего CDN.'
);

[
  'vendor/pdfjs/pdf.min.mjs',
  'vendor/pdfjs/pdf.worker.min.mjs',
  'vendor/xlsx/xlsx.full.min.js',
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/tesseract-core/tesseract-core-lstm.wasm.js',
  'vendor/tesseract-core/tesseract-core-lstm.wasm',
  'vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract-core/tesseract-core-simd-lstm.wasm',
  'vendor/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'vendor/tesseract-core/tesseract-core-relaxedsimd-lstm.wasm',
  'vendor/tessdata/4.0.0_best_int/rus.traineddata.gz',
  'vendor/tessdata/4.0.0_best_int/eng.traineddata.gz'
].forEach(function (relativePath) {
  const filePath = path.join(root, relativePath);

  assert.equal(
    fs.existsSync(filePath),
    true,
    `В ZIP должен входить ${relativePath}.`
  );

  assert.ok(
    fs.statSync(filePath).size > 0,
    `${relativePath} не должен быть пустым.`
  );
});

const pdfAnalyzerSource =
  intake.slice(
    intake.indexOf(
      'async function analyzeProjectIntakePdf'
    ),
    intake.indexOf(
      'async function analyzeProjectIntakeTable'
    )
  );

assert.equal(
  pdfAnalyzerSource.includes(
    'BuildMindPdfTable'
  ),
  true,
  'PDF должен передаваться в анализатор строк ВОР и ГПР.'
);

assert.equal(
  pdfAnalyzerSource.includes(
    'works: []'
  ),
  false,
  'PDF-анализатор не должен заранее возвращать пустой список работ.'
);

assert.equal(
  intake.includes(
    'Анализ не прошёл контроль качества'
  ),
  true,
  'Противоречивый результат нельзя показывать как завершённый.'
);

assert.equal(
  intake.includes(
    'result.reviewItems.unshift('
  ),
  true,
  'Причина блокировки должна показываться раньше длинного списка согласований.'
);

assert.equal(
  pdfTable.includes(
    'layoutWords'
  ),
  true,
  'Извлечение строк PDF должно использовать координаты OCR.'
);

assert.equal(
  app.includes(
    'projectDocumentsAnalysisBusy'
  ),
  true,
  'Загрузка и удаление документов должны блокироваться во время анализа.'
);

const nativeStage = app.indexOf(
  'Этап 1: быстро читаем штатный текстовый слой'
);

const ocrStage = app.indexOf(
  'Этап 2: двухпроходный локальный OCR'
);

assert.ok(nativeStage >= 0);
assert.ok(ocrStage > nativeStage);

console.log(
  'BuildMind analysis control test: PASS'
);
