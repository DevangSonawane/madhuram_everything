/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Used for work order parsing before auto-fill.
 */

import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

// Configure PDF.js worker for Vite compatibility
if (typeof window !== 'undefined') {
  // Use jsdelivr CDN - more reliable than cdnjs and works with CORS
  const pdfjsVersion = pdfjsLib.version || '5.4.530';
  // Use CDN worker to avoid deployments that don't serve `.mjs` correctly from `/assets`.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
  
  console.log('PDF.js worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
}

/** Max pages to extract from start (header / vendor / site). */
const MAX_HEADER_PAGES = 10;
/** Max pages to extract from end (total value, signatures). */
const MAX_TAIL_PAGES = 5;

/**
 * Extract raw text from a PDF file.
 * Uses first N pages (header) + last M pages (totals) to cover variable layouts.
 * Optimized with parallel processing for better performance.
 * @param {File} file - PDF file
 * @param {object} opts - { maxHeaderPages, maxTailPages, fullDocument, maxPages, preserveLines, batchSize }
 * @returns {Promise<string>} Concatenated text from processed pages
 */
export async function extractTextFromPdf(file, opts = {}) {
  const fullDocument = opts.fullDocument === true;
  const maxHeader = opts.maxHeaderPages ?? MAX_HEADER_PAGES;
  const maxTail = opts.maxTailPages ?? MAX_TAIL_PAGES;
  const batchSize = opts.batchSize ?? 5; // Process 5 pages in parallel

  try {
    const bytes = await file.arrayBuffer();
    
    // Configure PDF.js with error handling
    const loadingTask = pdfjsLib.getDocument({ 
      data: bytes,
      verbosity: 0,
      isEvalSupported: false,
    });
    
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;

    if (numPages === 0) {
      throw new Error('PDF has no pages');
    }

    const pageIndices = new Set();
    if (fullDocument) {
      const cap = typeof opts.maxPages === 'number' ? opts.maxPages : 50; // Reduced from 150 to 50
      for (let i = 1; i <= Math.min(numPages, cap); i++) pageIndices.add(i);
    } else {
      for (let i = 1; i <= Math.min(numPages, maxHeader); i++) pageIndices.add(i);
      for (let i = Math.max(1, numPages - maxTail + 1); i <= numPages; i++) pageIndices.add(i);
    }

    const preserveLines = opts.preserveLines === true;
    const sortedIndices = [...pageIndices].sort((a, b) => a - b);
    const chunks = [];
    
    // Process pages in parallel batches for better performance
    for (let i = 0; i < sortedIndices.length; i += batchSize) {
      const batch = sortedIndices.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pageNum) => {
        try {
          const page = await doc.getPage(pageNum);
          const content = await page.getTextContent();
          
          if (preserveLines) {
            const byLine = new Map();
            for (const item of content.items) {
              if (!item || typeof item.str !== 'string') continue;
              const t = item.transform;
              const y = t && t[5] != null ? Number(t[5]) : 0;
              const x = t && t[4] != null ? Number(t[4]) : 0;
              const k = Math.round(y * 50) / 50;
              if (!byLine.has(k)) byLine.set(k, []);
              byLine.get(k).push({ x, str: item.str });
            }
            const lines = [...byLine.entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([, pts]) => pts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').trim());
            return { pageNum, text: lines.filter(Boolean).join('\n') };
          } else {
            const strings = content.items.map((it) => it.str ?? '').filter(Boolean);
            return { pageNum, text: strings.join(' ') };
          }
        } catch (error) {
          console.warn(`Failed to extract text from page ${pageNum}:`, error);
          return { pageNum, text: '' };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      // Sort results by page number to maintain order
      batchResults.sort((a, b) => a.pageNum - b.pageNum);
      chunks.push(...batchResults.map(r => r.text));
    }

    const result = chunks.join('\n');
    if (!result || result.trim().length === 0) {
      console.warn('No text extracted from PDF - PDF might be image-based or scanned');
    }
    
    return result;
  } catch (error) {
    console.error('PDF text extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message || 'Unknown error'}`);
  }
}

export async function extractTextFromPdfWithOcr(file, opts = {}) {
  const base = await extractTextFromPdf(file, opts);
  const baseLen = typeof base === 'string' ? base.replace(/\s+/g, '').length : 0;
  const needFullOcr = baseLen < 200;
  const ocrFirstPages = 4;
  let ocrText = '';
  try {
    const images = await extractImagesFromPdf(file, {
      scale: opts.scale ?? 1.2,
      maxPages: needFullOcr ? (typeof opts.maxPages === 'number' ? Math.min(opts.maxPages, 12) : 12) : ocrFirstPages,
      batchSize: needFullOcr ? 2 : 2,
      quality: 0.8,
    });
    for (const img of images) {
      try {
        const pre = await preprocessForOcr(img.imageDataUrl);
        const result = await Tesseract.recognize(pre, 'eng', { 
          logger: () => {}, 
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          psm: 6,
          preserve_interword_spaces: '1',
        });
        if (result?.data?.text) {
          ocrText += '\n' + result.data.text;
        }
        if (looksLikeBoqTable(ocrText)) break;
      } catch (_) {}
    }
  } catch (_) {}
  const combined = [base || '', ocrText || ''].join('\n').trim();
  return combined;
}

/**
 * Extract a single PDF page as an image (canvas -> data URL).
 * @param {object} page - PDF.js page object
 * @param {number} scale - Scale factor for rendering (default: 2 for better quality)
 * @returns {Promise<string>} Data URL of the rendered page
 */
async function extractPageAsImage(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  return canvas.toDataURL('image/png');
}

async function preprocessForOcr(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const v = y > 190 ? 255 : y > 140 ? 220 : y > 100 ? 180 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      // keep alpha
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return dataUrl;
  }
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function looksLikeBoqTable(text) {
  if (!text || text.length < 200) return false;
  const t = text.toLowerCase();
  const hasUnit = /(unit|uom|unit of measurement)/i.test(text);
  const hasQty = /(qty|quantity)/i.test(text);
  const hasPrice = /(rate|price|unit price|basic rate|cost|rs|inr|₹)/i.test(text);
  const hasAmount = /(amount|total|line total|value|extended amount|total amount)/i.test(text);
  const lines = text.split(/\r?\n/).slice(0, 80);
  let numericRows = 0;
  for (const l of lines) {
    const nums = l.match(/\d+(?:[.,]\d+)?/g);
    if (nums && nums.length >= 2) numericRows++;
    if (numericRows >= 6) break;
  }
  return (hasUnit && hasQty && (hasPrice || hasAmount)) || numericRows >= 6;
}

/**
 * Extract all pages from a PDF as images.
 * Optimized with parallel processing and lower default scale for better performance.
 * @param {File} file - PDF file
 * @param {object} opts - { scale, maxPages, pageRange, batchSize, quality }
 * @returns {Promise<Array<{ pageNumber: number, imageDataUrl: string, width: number, height: number }>>}
 */
export async function extractImagesFromPdf(file, opts = {}) {
  const scale = opts.scale ?? 1.5; // Reduced from 2 to 1.5 for faster processing
  const maxPages = opts.maxPages ?? 30; // Reduced from 150 to 30
  const pageRange = opts.pageRange; // e.g., { start: 1, end: 10 }
  const batchSize = opts.batchSize ?? 3; // Process 3 pages in parallel (images are heavier)
  const quality = opts.quality ?? 0.85; // JPEG quality for smaller file size

  try {
    const bytes = await file.arrayBuffer();
    
    // Configure PDF.js with error handling
    const loadingTask = pdfjsLib.getDocument({ 
      data: bytes,
      verbosity: 0, // Suppress warnings
      isEvalSupported: false, // Security: disable eval
    });
    
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;

    if (numPages === 0) {
      throw new Error('PDF has no pages');
    }

    let startPage = 1;
    let endPage = numPages;

    if (pageRange) {
      startPage = Math.max(1, pageRange.start ?? 1);
      endPage = Math.min(numPages, pageRange.end ?? numPages);
    } else {
      endPage = Math.min(numPages, maxPages);
    }

    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    const images = [];
    
    // Process pages in parallel batches for better performance
    for (let i = 0; i < pageNumbers.length; i += batchSize) {
      const batch = pageNumbers.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pageNum) => {
        try {
          const page = await doc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          
          // Create canvas with proper error handling
          const canvas = document.createElement('canvas');
          if (!canvas || !canvas.getContext) {
            throw new Error('Canvas not supported');
          }
          
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('2D context not available');
          }
          
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Render page with timeout (reduced from 30s to 15s)
          await Promise.race([
            page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Page render timeout')), 15000)
            )
          ]);

          // Use JPEG instead of PNG for smaller file size and faster processing
          const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          if (!imageDataUrl || imageDataUrl === 'data:,') {
            console.warn(`Page ${pageNum} produced empty image`);
            return null;
          }
          
          return {
            pageNumber: pageNum,
            imageDataUrl,
            width: viewport.width,
            height: viewport.height,
          };
        } catch (error) {
          console.warn(`Failed to extract page ${pageNum}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      // Filter out null results and add to images array
      const validResults = batchResults.filter(img => img !== null);
      images.push(...validResults);
    }

    if (images.length === 0) {
      throw new Error('No pages could be extracted as images');
    }

    // Sort by page number to maintain order
    images.sort((a, b) => a.pageNumber - b.pageNumber);

    return images;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract PDF: ${error.message || 'Unknown error'}`);
  }
}
