'use strict';

const assert =
  require('node:assert/strict');

const pdfOcr =
  require('../pdfOcrEngine.js');

async function run() {
  assert.equal(
    pdfOcr.shouldRecognize(''),
    true
  );

  assert.equal(
    pdfOcr.shouldRecognize(
      'Ведомость объёмов работ содержит достаточный текстовый слой для штатного анализа и распознавания документа.'
    ),
    false
  );

  assert.equal(
    pdfOcr.meaningfulTextLength(
      '  ГПР\n  2026  '
    ),
    7
  );

  const limitedScale =
    pdfOcr.getRenderScale(
      5000,
      5000,
      2
    );

  assert.ok(
    limitedScale >= 0.35
  );
  assert.ok(
    5000 *
      5000 *
      limitedScale *
      limitedScale <=
      7000000 + 1
  );

  let abortInterrupted = false;
  const abortController =
    new AbortController();

  const abortedOperation =
    pdfOcr.runControlledOperation(
      new Promise(function () {}),
      {
        signal:
          abortController.signal,
        timeoutMs: 5000,
        onInterrupt() {
          abortInterrupted = true;
        }
      }
    );

  abortController.abort();

  await assert.rejects(
    abortedOperation,
    function (error) {
      return (
        error.name === 'AbortError' &&
        error.code === 'OCR_CANCELLED'
      );
    }
  );

  assert.equal(
    abortInterrupted,
    true
  );

  let timeoutInterrupted = false;

  await assert.rejects(
    pdfOcr.runControlledOperation(
      new Promise(function () {}),
      {
        timeoutMs: 1000,
        onInterrupt() {
          timeoutInterrupted = true;
        }
      }
    ),
    function (error) {
      return (
        error.name === 'TimeoutError' &&
        error.code ===
          'OCR_PAGE_TIMEOUT'
      );
    }
  );

  assert.equal(
    timeoutInterrupted,
    true
  );

  let terminated = false;
  let rendered = false;

  global.window = {
    Tesseract: {
      async createWorker(
        languages,
        oem,
        options
      ) {
        assert.deepEqual(
          languages,
          ['rus', 'eng']
        );
        assert.equal(oem, 1);
        assert.equal(
          typeof options.logger,
          'function'
        );

        return {
          async recognize() {
            return {
              data: {
                text:
                  'ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ',
                confidence: 92
              }
            };
          },

          async terminate() {
            terminated = true;
          }
        };
      }
    }
  };

  global.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            fillRect() {}
          };
        }
      };
    }
  };

  const session =
    await pdfOcr.createSession();

  const recognized =
    await session.recognizePage(
      {
        getViewport({
          scale
        }) {
          return {
            width: 1000 * scale,
            height: 1400 * scale
          };
        },

        render() {
          rendered = true;
          return {
            promise:
              Promise.resolve()
          };
        }
      },
      12
    );

  assert.equal(rendered, true);
  assert.equal(
    recognized.pageNumber,
    12
  );
  assert.equal(
    recognized.confidence,
    92
  );
  assert.equal(
    recognized.text,
    'ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ'
  );

  await session.terminate();
  assert.equal(terminated, true);

  delete global.window;
  delete global.document;

  console.log(
    'BuildMind PDF OCR helper test: PASS'
  );
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
