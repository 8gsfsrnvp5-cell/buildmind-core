'use strict';

/* ==================================================
   BUILDMIND PDF OCR ENGINE — V1

   OCR выполняется локально в браузере. Файл не отправляется
   в BuildMind или на прикладной сервер. PDF.js сначала
   пытается прочитать штатный текстовый слой; Tesseract.js
   подключается только для страниц, где текста недостаточно.
   ================================================== */

const BUILDMIND_PDF_OCR_VERSION =
  'pdf-ocr-v1';

const PDF_OCR_DEFAULT_MIN_TEXT_LENGTH =
  60;

const PDF_OCR_DEFAULT_SCALE =
  1.65;

const PDF_OCR_MAX_PIXELS =
  7000000;

function normalizePdfOcrText(value) {
  return String(value || '')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

function getPdfOcrMeaningfulLength(value) {
  return normalizePdfOcrText(value)
    .replace(/[^а-яА-ЯёЁa-zA-Z0-9]/g, '')
    .length;
}

function shouldRecognizePdfPage(
  text,
  minimumLength =
    PDF_OCR_DEFAULT_MIN_TEXT_LENGTH
) {
  return (
    getPdfOcrMeaningfulLength(text) <
    Number(minimumLength)
  );
}

function getPdfOcrRenderScale(
  width,
  height,
  requestedScale =
    PDF_OCR_DEFAULT_SCALE
) {
  const safeWidth =
    Math.max(1, Number(width) || 1);
  const safeHeight =
    Math.max(1, Number(height) || 1);
  const safeScale =
    Math.max(1, Number(requestedScale) || 1);

  const requestedPixels =
    safeWidth *
    safeHeight *
    safeScale *
    safeScale;

  if (
    requestedPixels <=
    PDF_OCR_MAX_PIXELS
  ) {
    return safeScale;
  }

  return Math.max(
    0.35,
    Math.sqrt(
      PDF_OCR_MAX_PIXELS /
      (safeWidth * safeHeight)
    )
  );
}

function isPdfOcrAvailable() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.Tesseract &&
    typeof window.Tesseract
      .createWorker === 'function' &&
    typeof document !== 'undefined' &&
    typeof document.createElement ===
      'function'
  );
}

async function createPdfOcrSession(
  options = {}
) {
  if (!isPdfOcrAvailable()) {
    throw new Error(
      'OCR-библиотека Tesseract.js недоступна.'
    );
  }

  let activePageNumber = null;
  let activeProgress = null;

  const worker =
    await window.Tesseract.createWorker(
      [
        'rus',
        'eng'
      ],
      1,
      {
        logger(message) {
          if (
            typeof activeProgress !==
            'function'
          ) {
            return;
          }

          activeProgress({
            pageNumber:
              activePageNumber,
            status:
              message?.status ||
              'recognizing text',
            progress:
              Number(message?.progress) ||
              0
          });
        }
      }
    );

  let terminated = false;

  return {
    async recognizePage(
      pdfPage,
      pageNumber,
      recognitionOptions = {}
    ) {
      if (terminated) {
        throw new Error(
          'OCR-сессия уже завершена.'
        );
      }

      if (
        !pdfPage ||
        typeof pdfPage.getViewport !==
          'function'
      ) {
        throw new Error(
          'Страница PDF для OCR не передана.'
        );
      }

      const baseViewport =
        pdfPage.getViewport({
          scale: 1
        });

      const scale =
        getPdfOcrRenderScale(
          baseViewport.width,
          baseViewport.height,
          recognitionOptions.scale ||
            options.scale ||
            PDF_OCR_DEFAULT_SCALE
        );

      const viewport =
        pdfPage.getViewport({
          scale
        });

      const canvas =
        document.createElement('canvas');

      canvas.width =
        Math.max(
          1,
          Math.ceil(viewport.width)
        );
      canvas.height =
        Math.max(
          1,
          Math.ceil(viewport.height)
        );

      const context =
        canvas.getContext(
          '2d',
          {
            alpha: false,
            willReadFrequently: true
          }
        );

      if (!context) {
        throw new Error(
          'Браузер не смог создать поверхность для OCR.'
        );
      }

      context.fillStyle = '#ffffff';
      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      await pdfPage.render({
        canvasContext: context,
        viewport
      }).promise;

      activePageNumber =
        Number(pageNumber) || null;
      activeProgress =
        recognitionOptions.onProgress ||
        options.onProgress ||
        null;

      try {
        const recognition =
          await worker.recognize(
            canvas
          );

        const text =
          normalizePdfOcrText(
            recognition?.data?.text ||
            ''
          );

        return {
          success: true,
          pageNumber:
            Number(pageNumber) || null,
          text,
          textLength:
            text.length,
          meaningfulTextLength:
            getPdfOcrMeaningfulLength(
              text
            ),
          confidence:
            Number(
              recognition
                ?.data
                ?.confidence
            ) || 0,
          scale,
          width:
            canvas.width,
          height:
            canvas.height
        };
      } finally {
        activePageNumber = null;
        activeProgress = null;
        canvas.width = 1;
        canvas.height = 1;
      }
    },

    async terminate() {
      if (terminated) {
        return;
      }

      terminated = true;
      await worker.terminate();
    }
  };
}

const BuildMindPdfOcrApi = {
  version:
    BUILDMIND_PDF_OCR_VERSION,
  minimumTextLength:
    PDF_OCR_DEFAULT_MIN_TEXT_LENGTH,
  isAvailable:
    isPdfOcrAvailable,
  normalizeText:
    normalizePdfOcrText,
  meaningfulTextLength:
    getPdfOcrMeaningfulLength,
  shouldRecognize:
    shouldRecognizePdfPage,
  getRenderScale:
    getPdfOcrRenderScale,
  createSession:
    createPdfOcrSession
};

if (typeof window !== 'undefined') {
  window.BuildMindPdfOcr =
    BuildMindPdfOcrApi;
}

if (
  typeof module !== 'undefined' &&
  module.exports
) {
  module.exports =
    BuildMindPdfOcrApi;
}

console.info(
  'BuildMind PDF OCR Engine загружен:',
  BUILDMIND_PDF_OCR_VERSION
);
