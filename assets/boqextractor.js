/**
 * boqextractor.js
 * PDF text extraction using pdf.js — exact logic used in the BOQ Parser HTML tool.
 *
 * Sorts text tokens by (y, x) position per page, emits a newline when the
 * vertical gap between consecutive tokens exceeds 3 units.
 *
 * @requires pdf.js (pdfjsLib global or import as needed)
 *
 * Usage:
 *   import { extractRawText } from './boqextractor.js';
 *   const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
 *   const rawText = await extractRawText(pdf);
 */

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
