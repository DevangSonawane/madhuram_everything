/**
 * PDF text extraction for BOQ parsing using pdfjs-dist.
 *
 * Synced to the source-of-truth logic in `assets/boqextractor.js`.
 * Sorts text tokens by (y, x) per page and emits a newline when the
 * vertical gap between consecutive tokens exceeds 3 units.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Vite compatibility (mirrors `pdfUtils.js`).
if (typeof window !== 'undefined') {
  const pdfjsVersion = pdfjsLib.version || '5.4.530';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @returns {Promise<string>}
 */
export async function extractRawText(pdf) {
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.slice().sort((a, b) => {
      const ay = Math.round(a.transform[5] / 2) * 2;
      const by = Math.round(b.transform[5] / 2) * 2;
      if (ay !== by) return by - ay;
      return a.transform[4] - b.transform[4];
    });
    let lastY = null;
    for (const item of items) {
      const y = Math.round(item.transform[5] / 2) * 2;
      if (lastY !== null && Math.abs(y - lastY) > 3) fullText += '\n';
      fullText += item.str + ' ';
      lastY = y;
    }
    fullText += '\n';
  }
  return fullText;
}

/**
 * Convenience wrapper for browser File -> PDF -> rawText.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractRawTextFromPdfFile(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  return extractRawText(pdf);
}

