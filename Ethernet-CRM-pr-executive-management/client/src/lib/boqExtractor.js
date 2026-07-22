/**
 * PDF text extraction for BOQ parsing using pdfjs-dist.
 *
 * Synced to the source-of-truth logic in `assets/boqextractor.js`.
 * Sorts text tokens by (y, x) per page and emits a newline when the
 * vertical gap between consecutive tokens exceeds 3 units.
 */

// Initialize pdfjsLib - in browser it's global, in Node.js we import it
let pdfjsLib;
if (typeof window !== 'undefined' && window.pdfjsLib) {
  // Browser: use global pdfjsLib loaded from CDN
  pdfjsLib = window.pdfjsLib;
}

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

/**
 * Column-aware extraction for Rustomjee-style tabular BOQs (Annexure - A - Bill of
 * Quantities). Unlike `extractRawText`, this keeps the Sr.No / Description / Unit /
 * Qty / Rate / Amount columns separate instead of flattening everything left-to-right
 * on the same visual line. That matters here because Rustomjee PDFs vertically-center
 * the Sr.No/Unit/Qty/Rate/Amount cell values inside tall, multi-line Description cells,
 * so a naive y-threshold join (as used by `extractRawText`) scrambles rows together.
 *
 * Column boundaries are derived per-page from that page's own header row (every page
 * repeats "Sr.No. Description Unit Qty Rate Amount"), so layout drift between pages is
 * tolerated. Each text item is assigned to its nearest column anchor by x-position.
 *
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @returns {Promise<Array<{page:number, srNo:string, description:string, unit:string, qty:string, rate:string, amount:string}>>}
 */
async function extractRustomjeeRowsByLine(pdf) {
  // Interval classification (not nearest-anchor): wrapped description text can start
  // as far right as x~280-300 (still much closer to the Unit anchor than the
  // Description anchor), so nearest-anchor misclassifies it as Unit. Column
  // boundaries below reflect each column's actual left edge instead.
  const classifyColumn = (x, boundaries) => {
    let best = boundaries[0].name;
    for (const b of boundaries) {
      if (x >= b.at) best = b.name;
    }
    return best;
  };

  const allRows = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim() !== '')
      .slice()
      .sort((a, b) => {
        const ay = a.transform[5];
        const by = b.transform[5];
        if (Math.abs(ay - by) > 0.5) return by - ay;
        return a.transform[4] - b.transform[4];
      });

    const findHeaderX = (re) => {
      const hit = items.find((it) => re.test(it.str.trim()));
      return hit ? hit.transform[4] : null;
    };
    const srNoX = findHeaderX(/^Sr\.?\s*No\.?$/i);
    const unitX = findHeaderX(/^Unit$/i);
    const qtyX = findHeaderX(/^Qty\.?$/i);
    const rateX = findHeaderX(/^Rate$/i);
    const amountX = findHeaderX(/^Amount$/i);

    // Not a Rustomjee-style tabular page (e.g. missing header row) — skip it.
    if (srNoX == null || unitX == null || qtyX == null || rateX == null || amountX == null) continue;

    // The "Description" header caption sits centered/right within its (wide) column,
    // far from the column's actual left edge where body text starts — so we don't use
    // it directly. Empirically, body description text starts ~25-30 units right of the
    // Sr.No column's own anchor, which works reliably across both layouts in this doc.
    // Unit/Qty/Rate/Amount are narrow right-aligned numeric columns, so their left edge
    // sits a small, fairly constant margin before the header caption's own x.
    const boundaries = [
      { name: 'srNo', at: -Infinity },
      { name: 'description', at: srNoX + 20 },
      { name: 'unit', at: unitX - 30 },
      { name: 'qty', at: qtyX - 15 },
      { name: 'rate', at: rateX - 15 },
      { name: 'amount', at: amountX - 15 },
    ];

    // Group items into physical rows by y (tight tolerance — same-row items land
    // within ~0.1-0.3 units of each other, while distinct visual lines are ~9 units apart).
    const rows = [];
    let currentY = null;
    let currentRow = null;
    for (const it of items) {
      const y = it.transform[5];
      if (currentRow == null || Math.abs(y - currentY) > 1.2) {
        currentRow = { cells: { srNo: [], description: [], unit: [], qty: [], rate: [], amount: [] } };
        rows.push(currentRow);
        currentY = y;
      }
      const col = classifyColumn(it.transform[4], boundaries);
      currentRow.cells[col].push(it.str);
    }

    let pastHeader = false;
    let visualRow = 0;
    for (const row of rows) {
      const srNoText = row.cells.srNo.join(' ').trim();
      const descText = row.cells.description.join(' ').trim();
      if (!pastHeader) {
        if (/^Sr\.?\s*No\.?$/i.test(srNoText) || /^Description$/i.test(descText)) pastHeader = true;
        continue;
      }
      visualRow += 1;
      allRows.push({
        page: p,
        visualRow,
        srNo: srNoText,
        description: descText,
        unit: row.cells.unit.join(' ').trim(),
        qty: row.cells.qty.join(' ').trim(),
        rate: row.cells.rate.join(' ').trim(),
        amount: row.cells.amount.join(' ').trim(),
      });
    }
  }

  return allRows;
}

export async function extractRustomjeeRows(pdf) {
  const classifyColumn = (x, boundaries) => {
    let best = boundaries[0].name;
    for (const b of boundaries) {
      if (x >= b.at) best = b.name;
    }
    return best;
  };

  const uniqueSortedY = (values) => {
    const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => b - a);
    const out = [];
    for (const y of sorted) {
      if (!out.some((existing) => Math.abs(existing - y) < 1.2)) out.push(y);
    }
    return out;
  };

  const getTableHorizontalLines = async (page) => {
    const opList = await page.getOperatorList();
    const lines = [];
    const valuesFrom = (value) => {
      if (!value) return [];
      if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value);
      if (typeof value === 'object') return Object.values(value);
      return [];
    };
    const bboxFromArgs = (args) => {
      const direct = valuesFrom(args?.[2]).map(Number);
      if (direct.length >= 4 && direct.every(Number.isFinite)) return direct.slice(0, 4);

      for (const part of valuesFrom(args)) {
        const nums = valuesFrom(part).map(Number).filter(Number.isFinite);
        if (nums.length === 4) return nums;
      }
      return null;
    };
    for (let i = 0; i < opList.fnArray.length; i++) {
      const bbox = bboxFromArgs(opList.argsArray[i]);
      if (!bbox || bbox.length < 4) continue;
      const [x1, y1, x2, y2] = bbox;
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      if (width > 450 && height <= 2.5 && x1 < 60 && x2 > 520) {
        lines.push((y1 + y2) / 2);
      }
    }
    return uniqueSortedY(lines);
  };

  const groupCellText = (cellItems) => {
    const lines = [];
    const sorted = cellItems.slice().sort((a, b) => {
      const ay = a.transform[5];
      const by = b.transform[5];
      if (Math.abs(ay - by) > 1.2) return by - ay;
      return a.transform[4] - b.transform[4];
    });

    for (const it of sorted) {
      const y = it.transform[5];
      let line = lines.find((l) => Math.abs(l.y - y) <= 1.2);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push(it);
    }

    return lines
      .sort((a, b) => b.y - a.y)
      .map((line) =>
        line.items
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((it) => it.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter(Boolean)
      .join(' ')
      .trim();
  };

  const buildRowFromItems = (pageNo, rowNo, rowItems, boundaries) => {
    const cells = { srNo: [], description: [], unit: [], qty: [], rate: [], amount: [] };
    for (const it of rowItems) {
      const col = classifyColumn(it.transform[4], boundaries);
      cells[col].push(it);
    }
    return {
      page: pageNo,
      visualRow: rowNo,
      srNo: groupCellText(cells.srNo),
      description: groupCellText(cells.description),
      unit: groupCellText(cells.unit),
      qty: groupCellText(cells.qty),
      rate: groupCellText(cells.rate),
      amount: groupCellText(cells.amount),
    };
  };

  const mergeLineRows = (lineRows, pageNo) => {
    const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    const hasMeasure = (row) => clean(row.unit) || clean(row.qty) || clean(row.rate) || clean(row.amount);
    const itemOpenerRe = /^(Supply|Supplying|Providing|SITC|Installation|Install|Making|ITC|Note)\b/i;
    const isSectionLine = (row) => {
      const srNo = clean(row.srNo);
      const desc = clean(row.description);
      if (hasMeasure(row)) return false;
      if (/^[A-Za-z]$/.test(srNo) && desc) return true;
      return !srNo && desc.length <= 90 && desc === desc.toUpperCase() && /[A-Z]/.test(desc);
    };
    const appendDesc = (target, value) => {
      const text = clean(value);
      if (text) target.description = clean(`${target.description} ${text}`);
    };

    const merged = [];
    let pending = [];
    let current = null;

    const finishCurrent = () => {
      if (!current) return;
      merged.push(current);
      current = null;
    };

    for (const row of lineRows) {
      const normalized = {
        page: pageNo,
        srNo: clean(row.srNo),
        description: clean(row.description),
        unit: clean(row.unit),
        qty: clean(row.qty),
        rate: clean(row.rate),
        amount: clean(row.amount),
      };
      if (!normalized.srNo && !normalized.description && !hasMeasure(normalized)) continue;

      if (isSectionLine(normalized)) {
        finishCurrent();
        if (pending.length) {
          merged.push({ page: pageNo, srNo: '', description: clean(pending.join(' ')), unit: '', qty: '', rate: '', amount: '' });
          pending = [];
        }
        merged.push(normalized);
        continue;
      }

      const startsRow = normalized.srNo || hasMeasure(normalized);
      if (startsRow) {
        if (current) finishCurrent();
        current = normalized;
        if (pending.length) {
          current.description = clean(`${pending.join(' ')} ${current.description}`);
          pending = [];
        }
        continue;
      }

      if (current && hasMeasure(current) && itemOpenerRe.test(normalized.description)) {
        finishCurrent();
        pending = [normalized.description];
        continue;
      }

      if (current) appendDesc(current, normalized.description);
      else pending.push(normalized.description);
    }

    finishCurrent();
    if (pending.length) merged.push({ page: pageNo, srNo: '', description: clean(pending.join(' ')), unit: '', qty: '', rate: '', amount: '' });

    return merged.map((row, index) => ({ ...row, visualRow: index + 1 }));
  };

  const allRows = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim() !== '')
      .slice()
      .sort((a, b) => {
        const ay = a.transform[5];
        const by = b.transform[5];
        if (Math.abs(ay - by) > 0.5) return by - ay;
        return a.transform[4] - b.transform[4];
      });

    const findHeaderX = (re) => {
      const hit = items.find((it) => re.test(it.str.trim()));
      return hit ? hit.transform[4] : null;
    };
    const srNoX = findHeaderX(/^Sr\.?\s*No\.?$/i);
    const unitX = findHeaderX(/^Unit$/i);
    const qtyX = findHeaderX(/^Qty\.?$/i);
    const rateX = findHeaderX(/^Rate$/i);
    const amountX = findHeaderX(/^Amount$/i);
    if (srNoX == null || unitX == null || qtyX == null || rateX == null || amountX == null) continue;

    const boundaries = [
      { name: 'srNo', at: -Infinity },
      { name: 'description', at: srNoX + 20 },
      { name: 'unit', at: unitX - 30 },
      { name: 'qty', at: qtyX - 15 },
      { name: 'rate', at: rateX - 15 },
      { name: 'amount', at: amountX - 15 },
    ];

    const horizontalLines = await getTableHorizontalLines(page);
    const fallbackRows = async () => mergeLineRows(await extractRustomjeeRowsByLine({ numPages: 1, getPage: async () => page }), p);
    if (horizontalLines.length < 2) {
      allRows.push(...(await fallbackRows()));
      continue;
    }

    const intervals = [];
    for (let i = 0; i < horizontalLines.length - 1; i++) {
      intervals.push({ top: horizontalLines[i], bottom: horizontalLines[i + 1], items: [] });
    }

    for (const it of items) {
      const y = it.transform[5];
      const interval = intervals.find((row) => y < row.top - 0.2 && y >= row.bottom - 1.5);
      if (interval) interval.items.push(it);
    }

    let pastHeader = false;
    let visualRow = 0;
    const pageRows = [];
    for (const interval of intervals) {
      if (interval.items.length === 0) continue;
      const candidate = buildRowFromItems(p, visualRow + 1, interval.items, boundaries);
      if (!pastHeader) {
        if (/^Sr\.?\s*No\.?$/i.test(candidate.srNo) || /^Description$/i.test(candidate.description)) {
          pastHeader = true;
        }
        continue;
      }
      if (!candidate.srNo && !candidate.description && !candidate.unit && !candidate.qty && !candidate.rate && !candidate.amount) continue;
      visualRow += 1;
      candidate.visualRow = visualRow;
      pageRows.push(candidate);
    }
    const badGridMerge = pageRows.some((row) => /Note\s*:/i.test(row.description) && row.srNo);
    allRows.push(...(badGridMerge ? await fallbackRows() : pageRows));
  }

  return allRows;
}

/**
 * Convenience wrapper for browser File -> PDF -> structured Rustomjee rows.
 * @param {File} file
 * @returns {Promise<Array<object>>}
 */
export async function extractRustomjeeRowsFromPdfFile(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  return extractRustomjeeRows(pdf);
}
