/**
 * Extract work order fields from raw PDF text.
 * Flexible patterns; handles variable fields across different WO formats.
 * All keys optional – missing fields stay empty.
 */

/**
 * @typedef {Object} ExtractedWO
 * @property {string} [wo_number]
 * @property {string} [wo_date] - YYYY-MM-DD
 * @property {string} [issuer] - Client (company issuing WO)
 * @property {string} [site_address]
 * @property {string} [building] - Project name
 * @property {string} [vendor]
 * @property {string} [description]
 * @property {string} [total_value] - Formatted for display (e.g. "19900622.12" or "19,900,622.12")
 * @property {string} [vendor_address]
 * @property {string} [vendor_phone]
 * @property {string} [vendor_gstin]
 */

/**
 * DD.MM.YYYY or DD/MM/YYYY -> YYYY-MM-DD
 */
function normalizeDate(s) {
  if (!s || typeof s !== 'string') return '';
  const t = s.trim();
  const m1 = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const m2 = t.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m2) {
    const [, y, mo, d] = m2;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return t;
}

/**
 * Parse currency string to number, then format for display (preserve commas optional).
 */
function parseValue(s) {
  if (!s || typeof s !== 'string') return '';
  const t = s.replace(/[,?\s]/g, '').replace(/^(INR|Rs\.?|₹)\s*/i, '').trim();
  const num = parseFloat(t);
  if (Number.isNaN(num)) return '';
  return String(num);
}

/**
 * Find a label/value pair in lines, supporting:
 * - "Label: value"
 * - "Label - value"
 * - "Label" on one line and value on next line
 */
function findLabeledValue(lines, labelRe) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!labelRe.test(line)) continue;

    // Same-line value (after ":" or "-")
    const m = line.match(labelRe);
    if (m && m[1] && String(m[1]).trim()) return String(m[1]).trim();

    // Next-line value (common in PDFs)
    const next = lines[i + 1] || '';
    if (next && next.length > 2 && !labelRe.test(next)) return next.trim();
  }
  return '';
}

/**
 * @param {string} rawText - Full text from extractTextFromPdf
 * @returns {ExtractedWO}
 */
export function extractWorkOrderFields(rawText) {
  const out = /** @type {ExtractedWO} */ ({});

  if (!rawText || typeof rawText !== 'string') return out;

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = rawText.replace(/\s+/g, ' ').trim();

  // ---- WO Number ----
  const woNum = text.match(/(?:WO\s*Number|WO\s*No\.?|Work\s*Order\s*No\.?)\s*[:\s]+\s*([A-Za-z0-9./_-]+)/i)
    || text.match(/(?:WO\s*#|PO\s*Number|PO\s*#)\s*[:\s]+\s*([A-Za-z0-9./_-]+)/i);
  if (woNum) out.wo_number = woNum[1].trim();

  // ---- WO Date ----
  const woDate = text.match(/(?:WO\s*Date|Work\s*Order\s*Date|Date)\s*[:\s]+\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
    || text.match(/(?:WO\s*Date|Date)\s*[:\s]+\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})/i);
  if (woDate) out.wo_date = normalizeDate(woDate[1]);

  // ---- Total value (often in last pages) ----
  const totalVal = text.match(/Total\s*Value\s+of\s+this\s+(?:PO|WO)\s*[:\s]*[^\d]*\s*INR\s+([\d,]+(?:\.\d{2})?)/i)
    || text.match(/(?:Total\s*Value|Total\s*Amount|Order\s*Value)\s*[:\s]+\s*INR\s+([\d,]+(?:\.\d{2})?)/i)
    || text.match(/INR\s+([\d,]+(?:\.\d{2})?)\s*\(Rupees\s+/i)
    || text.match(/(?:Total|Value)\s*[:\s]+\s*₹?\s*([\d,]+(?:\.\d{2})?)/i);
  if (totalVal) out.total_value = parseValue(totalVal[1]);

  // ---- Building / Project name ----
  // Prefer labeled lines (more reliable than global text regex)
  const projectName =
    findLabeledValue(lines, /^(?:Building|Project\s*Name|Project|Site\s*Name|Name\s*of\s*Project)\s*[:\-]\s*(.+)$/i)
    || findLabeledValue(lines, /^(?:Work\s*Location|Location)\s*[:\-]\s*(.+)$/i);
  if (projectName) out.building = projectName;
  if (!out.building) {
    const building = text.match(/Building\s*[:\s]+\s*([^\n]+?)(?:\s+$|\s+(?:\d|Sr\s*No|Description|Page\s*No|Corporate|GSTIN|CIN))/i)
      || text.match(/Building\s*[:\s]+\s*([A-Za-z0-9\s-]+?)(?=\s+\d|$)/i);
    if (building) out.building = building[1].trim();
  }

  // ---- Description of Work ----
  const desc = text.match(/Description\s+of\s+Work\s*[:\s]+\s*([^\n]+?)(?=\s*(?:Sr\s*No|Building|Page\s*No|Corporate|$))/is);
  if (desc) out.description = desc[1].replace(/\s+/g, ' ').trim().slice(0, 500);

  // ---- Issuer (client) ----
  // First: explicit labels commonly present
  const issuerLabeled =
    findLabeledValue(lines, /^(?:Client|Client\s*Name|Customer|Customer\s*Name|Issued\s*By)\s*[:\-]\s*(.+)$/i)
    || findLabeledValue(lines, /^(?:Company|Organisation|Organization)\s*[:\-]\s*(.+)$/i);
  if (issuerLabeled) out.issuer = issuerLabeled;

  // Fallback: line before "WORK ORDER FORM" / "WORK ORDER"
  const workOrderIdx = lines.findIndex((l) => /WORK\s*ORDER\s*(?:FORM)?/i.test(l));
  if (!out.issuer && workOrderIdx > 0) {
    const candidate = lines[workOrderIdx - 1].trim();
    if (candidate.length > 2 && !/^\d+$/.test(candidate) && !/^(WO|Date|To|Page)/i.test(candidate)) {
      out.issuer = candidate;
    }
  }
  if (!out.issuer) {
    const firstLlp = text.match(/^([A-Za-z0-9\s&.,'-]+(?:LLP|PVT\.?\s*LTD\.?|LTD\.?|LIMITED|L\.?L\.?C\.?)\s*)/i);
    if (firstLlp) out.issuer = firstLlp[1].trim();
  }

  // ---- Vendor (To:) ----
  const toIdx = lines.findIndex((l) => /^To\s*:\s*/i.test(l));
  if (toIdx !== -1) {
    const toLine = lines[toIdx].replace(/^To\s*:\s*/i, '').trim();
    if (toLine) out.vendor = toLine;
  }

  // ---- Site address / Location ----
  // First: explicit labels
  const addrLabeled =
    findLabeledValue(lines, /^(?:Site\s*Address|Address\s*of\s*Site|Work\s*Site\s*Address|Project\s*Location|Location)\s*[:\-]\s*(.+)$/i);
  if (addrLabeled) out.site_address = addrLabeled;

  // Fallback: block between WO Date and "To:" (multi-line)
  const dateIdx = lines.findIndex((l, i) => {
    if (!/\d{1,2}[./]\d{1,2}[./]\d{4}/.test(l)) return false;
    const prev = i > 0 ? lines[i - 1] : '';
    return /WO|Date/i.test(prev) || /^\d{1,2}[./]\d{1,2}[./]\d{4}\s*$/.test(l);
  });
  const searchStart = dateIdx !== -1 ? dateIdx + 1 : 0;
  const toLineIdx = lines.findIndex((l) => /^To\s*:\s*/i.test(l));
  const endIdx = toLineIdx !== -1 ? toLineIdx : lines.length;
  if (!out.site_address && endIdx > searchStart) {
    const block = lines
      .slice(searchStart, endIdx)
      .filter((l) => !/^(WO\s|Date\s|GSTIN\s|Phone\s)/i.test(l) && l.length > 3)
      .join(', ');
    if (block) out.site_address = block;
  }

  // ---- Vendor GSTIN / Phone (optional; prefer block after "To:") ----
  const vendorBlock = toLineIdx !== -1 ? lines.slice(toLineIdx, toLineIdx + 12).join(' ') : '';
  const gstin = vendorBlock ? vendorBlock.match(/GSTIN\s*[:\s]+\s*([A-Z0-9]{15})/i) : text.match(/GSTIN\s*[:\s]+\s*([A-Z0-9]{15})/i);
  if (gstin) out.vendor_gstin = gstin[1];
  const phone = vendorBlock ? vendorBlock.match(/Phone\s*[:\s]+\s*[\d\s-]*(\d{10})/) : text.match(/Phone\s*[:\s]+\s*[\d\s-]*(\d{10})/);
  if (phone) out.vendor_phone = phone[1];

  return out;
}

/**
 * Map extracted WO to Create Project form fields.
 * Only includes keys we actually use for auto-fill.
 * @param {ExtractedWO} ext
 * @returns {{ name: string, client: string, location: string, start_date: string, value: string, wo_number: string }}
 */
export function mapExtractedToProjectForm(ext) {
  return {
    name: ext.building ?? '',
    client: ext.issuer ?? '',
    location: ext.site_address ?? '',
    start_date: ext.wo_date ?? '',
    value: ext.total_value ?? '',
    wo_number: ext.wo_number ?? '',
  };
}

/**
 * Map extracted WO to ProjectForm (Projects page) fields.
 * @param {ExtractedWO} ext
 * @returns {{ project_name: string, client_name: string, product_duration: string, work_order_information: string, wo_number: string }}
 */
export function mapExtractedToProjectFormForm(ext) {
  const parts = [];
  if (ext.wo_number) parts.push(`WO #: ${ext.wo_number}`);
  if (ext.description) parts.push(`Description: ${ext.description}`);
  const work_order_information = parts.length ? parts.join('\n') : '';
  return {
    project_name: ext.building ?? '',
    client_name: ext.issuer ?? '',
    product_duration: ext.wo_date ?? '',
    work_order_information,
    wo_number: ext.wo_number ?? '',
  };
}
