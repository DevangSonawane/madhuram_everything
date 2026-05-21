/**
 * boqparser.js
 * BOQ parsers for Lodha Work Order, Hiranandani Work Order Form, and Oakwood PHE BOQ.
 *
 * This is an exact extraction of the parser logic from the BOQ Parser HTML tool.
 * All three parsers are run; the result with the most items is returned.
 *
 * Usage:
 *   import { parseBoq } from './boqparser.js';
 *   const { items, sections, projectName, name } = parseBoq(rawText);
 *
 *   items[i] fields:
 *     item_no, section, description, hsn, sac_code, unit, qty, rate, amount
 *     qty_text, rate_text, amount_text (optional, preserves decimals)
 */

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const normalizeSpaces = v => String(v || '').replace(/\s+/g, ' ').trim();

const toDecimalString = v => {
  if (v == null) return '';
  const cleaned = String(v).trim();
  const m = cleaned.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!m) return '';
  return m[0].replace(/,/g, '');
};

const toFixedDecimalString = (v, places = 2) => {
  const s = toDecimalString(v);
  if (!s) return '';
  const sign = s.startsWith('-') ? '-' : '';
  const abs = sign ? s.slice(1) : s;
  const [i = '0', f = ''] = abs.split('.');
  if (places <= 0) return sign + i.replace(/^0+(?=\d)/, '') || '0';
  const frac = (f + '0'.repeat(places)).slice(0, places);
  const intPart = (i.replace(/^0+(?=\d)/, '') || '0');
  return `${sign}${intPart}.${frac}`;
};

const toNumber = v => {
  if (v == null) return NaN;
  const cleaned = String(v).replace(/,/g, '').trim();
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return NaN;
  const n = parseFloat(m[0]);
  return isFinite(n) ? n : NaN;
};

const isLikelyFooterOrHeader = line => {
  const t = normalizeSpaces(line).toUpperCase();
  if (!t) return true;
  if (t.includes('SR.NO') && t.includes('ITEM') && t.includes('DESCRIPTION')) return true;
  if (t.includes('HSN') && t.includes('SAC') && t.includes('UNIT')) return true;
  if (t.includes('COMPANY') && t.includes('CONTRACTOR')) return true;
  if (t.includes('TOTAL OF AMOUNT')) return true;
  if (t.includes('CONTRACT AMOUNT')) return true;
  if (t === 'PAGE' || t.startsWith('PAGE ')) return true;
  // Lodha footer lines that bleed into descriptions
  if (/\(SIGN\s*[&]\s*STAMP\)/.test(t)) return true;
  if (/WORK ORDER\s*:\s*\d+/.test(t)) return true;
  if (/VERSION NO\s*:\s*\d+/.test(t)) return true;
  if (/^NO\.\s*CODE/.test(t)) return true;
  return false;
};

const splitLines = rawText =>
  String(rawText || '').split(/\r?\n/).map(l => normalizeSpaces(l)).filter(Boolean);

const findAllMatches = (str, regex) => {
  const matches = [];
  let m;
  const r = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  while ((m = r.exec(str)) !== null) matches.push(m);
  return matches;
};

// ─── LODHA PARSER ─────────────────────────────────────────────────────────────
function parseLodhaBoq(rawText) {
  const lines = splitLines(rawText).filter(l => !isLikelyFooterOrHeader(l));
  const sections = [];
  const items = [];
  const itemStartAt = []; // line index where each item began
  let currentSection = '';

  const sectionRe = /^\d+\.\d+\s+[A-Z]/;
  const itemNoRe  = /^(?:\d+\.\d+\.\d+|\d+\.\d+|\d+)\b/;
  const hsnRe     = /\b(\d{6})\b/;
  const tailRe    = /\b([A-Za-z]{1,10})\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s*$/;

  const pushSection = name => {
    const n = normalizeSpaces(name);
    if (!n || (sections.length && sections[sections.length - 1] === n)) return;
    sections.push(n);
  };

  // ── Pass 1: parse items, record start line index for each ────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (sectionRe.test(line)) {
      currentSection = normalizeSpaces(line.replace(/^\d+\.\d+\s+/, ''));
      pushSection(currentSection);
      continue;
    }

    if (!itemNoRe.test(line)) continue;

    const itemNo = normalizeSpaces((line.match(itemNoRe) || [''])[0]);
    const startLineIdx = i; // record NOW, before i is mutated by accumulation
    let buffer = line.slice(itemNo.length).trim();

    let consumed = 0;
    let hsnMatch = buffer.match(hsnRe);
    let tailOk   = tailRe.test(buffer);

    while ((!hsnMatch || !tailOk) && i + 1 < lines.length && consumed < 40) {
      const next = lines[i + 1];
      if (sectionRe.test(next)) break;
      if (itemNoRe.test(next) && (next.match(itemNoRe) || [''])[0] !== itemNo) break;
      if (isLikelyFooterOrHeader(next)) { i++; consumed++; continue; }
      buffer = `${buffer} ${next}`.trim();
      i++; consumed++;
      hsnMatch = buffer.match(hsnRe);
      tailOk   = tailRe.test(buffer);
    }

    if (!hsnMatch) continue;
    const hsn = hsnMatch[1];
    const tailMatch = buffer.match(tailRe);
    if (!tailMatch) continue;

    const [, unit, qtyRaw, rateRaw, amountRaw] = tailMatch;
    const qty    = toNumber(qtyRaw);
    const rate   = toNumber(rateRaw);
    const amount = toNumber(amountRaw);
    const qty_text    = toDecimalString(qtyRaw);
    const rate_text   = toFixedDecimalString(rateRaw, 2);
    const amount_text = toFixedDecimalString(amountRaw, 2);

    const beforeTail = buffer.slice(0, tailMatch.index).trim();
    const hsnIndex   = beforeTail.indexOf(hsn);
    let description  = normalizeSpaces(
      hsnIndex >= 0 ? beforeTail.slice(0, hsnIndex) : beforeTail.replace(hsnRe, '')
    );
    if (!description) continue;

    itemStartAt.push(startLineIdx);
    items.push({
      item_no: itemNo,
      section: currentSection,
      description,
      hsn,
      unit:   normalizeSpaces(unit),
      qty:    isFinite(qty)    ? qty    : 0,
      rate:   isFinite(rate)   ? rate   : 0,
      amount: isFinite(amount) ? amount : 0,
      qty_text,
      rate_text,
      amount_text,
    });
  }

  // ── Pass 2: attach dangling lines to the correct item ────────────────────
  // pdf.js column extraction causes second description lines to appear in raw
  // text AFTER the next row's content. Example:
  //
  //   li=10: 1.01.1 ... 998322 RMT 990 696 689040   → items[0], startAt=10
  //   li=11: 1.01.2 b) Waste Pipe 998322 RMT ...    → items[1], startAt=11
  //   li=12: 110 mm dia                             → dangling (no HSN, no item no)
  //   li=13: 1.01.3 c) Rain Water Pipe 998322 ...   → items[2], startAt=13
  //   li=14: 75 mm dia                              → dangling
  //
  // For dangling at li=12: first item starting after li=12 is items[2] (startAt=13).
  // So append to items[2-1] = items[1]. ✓
  // For dangling at li=14: first item starting after li=14 → none → append to last item.

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    if (isLikelyFooterOrHeader(line)) continue;
    if (sectionRe.test(line)) continue;
    // Use stricter check: real Lodha item numbers have at least one dot (1.01.1)
    // "110 mm dia" starts with digits but has no dot in the item-number position
    if (/^\d+\.\d+/.test(line)) continue;  // has an item number — not dangling
    if (hsnRe.test(line)) continue;     // has HSN — belongs to a full item row
    if (tailRe.test(line)) continue;    // has unit+qty+rate+amount tail

    // This is a dangling line. Find first item that starts strictly after li.
    let nextK = -1;
    for (let k = 0; k < itemStartAt.length; k++) {
      if (itemStartAt[k] > li) { nextK = k; break; }
    }

    // Target item is the one just before nextK
    const target = nextK > 0           ? nextK - 1
                 : nextK === -1 && items.length > 0 ? items.length - 1
                 : -1;

    if (target >= 0) {
      items[target].description = normalizeSpaces(
        items[target].description + ' ' + line
      );
    }
  }

  return { items, sections, name: 'Lodha' };
}

// ─── HIRANANDANI PARSER ───────────────────────────────────────────────────────
function parseHiranandaniBoqRowWise(rawText) {
  const lines = splitLines(rawText);
  const sections = [];
  const items = [];
  let currentSection = '';

  const sectionRe = /^\d+\s+[A-Za-z].+/;
  const itemStartRe = /^(?:\(\s*\d+\s*\)|\d+\))/;
  const lumpSumAuRe = /^\d+\s+AU\s+[\d,]+(\.\d+)?\b/i;

  const pushSection = name => {
    const n = normalizeSpaces(name);
    if (!n || (sections.length && sections[sections.length - 1] === n)) return;
    sections.push(n);
  };

  const normalizeItemText = value =>
    normalizeSpaces(value)
      .replace(/\(\s*(\d+)\s*\)/g, '($1)')
      .replace(/^(\d+)\)/, '($1)')
      .replace(/\bSAC\b/g, 'Sac')
      .replace(/\bS\.?A\.?C\.?\b/gi, 'Sac');

  const extractItem = (joinedRaw, itemNo) => {
    const joined = normalizeItemText(joinedRaw);
    // CGST/SGST lines are now skipped during accumulation, so no need to reject here

    // PDFs vary: "SAC: 995462", "SAC Code : 995462", "SAC Code 995462", "SAC-995462", etc.
    const sacMatch = joined.match(/Sac(?:\s*Code)?\s*[:\-]?\s*(\d[\d\s]{5,10})\b/i);
    const sac_code = sacMatch ? String(sacMatch[1] || '').replace(/\s+/g, '') : '';
    const afterSac = sacMatch
      ? joined.slice(sacMatch.index + sacMatch[0].length)
      : joined.replace(/^\(\d+\)\s*/i, '');

    const tokenMatches = findAllMatches(afterSac, /\S+/g);
    if (tokenMatches.length < 4) return null;
    const tokens = tokenMatches.map(m => m[0]);

    let tailIndex = -1;
    for (let t = tokens.length - 1; t >= 3; t--) {
      const value      = toNumber(tokens[t]);
      const unit_price = toNumber(tokens[t - 1]);
      const uom        = normalizeSpaces(tokens[t - 2]);
      const order_qty  = toNumber(tokens[t - 3]);
      if (isFinite(value) && isFinite(unit_price) && isFinite(order_qty) && uom) {
        tailIndex = t - 3; break;
      }
    }
    if (tailIndex < 0) return null;

    const order_qty  = toNumber(tokens[tailIndex]);
    const uom        = normalizeSpaces(tokens[tailIndex + 1]);
    const unit_price = toNumber(tokens[tailIndex + 2]);
    const value      = toNumber(tokens[tailIndex + 3]);
    const qty_text    = toDecimalString(tokens[tailIndex]);
    const rate_text   = toFixedDecimalString(tokens[tailIndex + 2], 2);
    const amount_text = toFixedDecimalString(tokens[tailIndex + 3], 2);
    if (!isFinite(value) || !isFinite(unit_price) || !isFinite(order_qty) || !uom) return null;

    const descTokens = tokens.slice(0, tailIndex);
    const service_description = normalizeSpaces(descTokens.join(' '))
      .replace(/\(\d+\)\s*/i, '')
      .replace(/(?:SAC|Sac)\s*:\s*\d{6}\s*-\s*/i, '')
      .trim();
    if (!service_description) return null;

    return {
      item_no: itemNo,
      section: currentSection,
      sac_code,
      description: service_description,
      unit: uom,
      qty: order_qty,
      rate: unit_price,
      amount: value,
      qty_text,
      rate_text,
      amount_text,
    };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeItemText(lines[i]);
    if (!line) continue;

    // Skip page-level noise lines
    if (/Sr\s*No\.?\s*Service\s*Description/i.test(line)) continue;
    if (/^Building\s*:/i.test(line)) continue;
    if (/Corporate\s*Addr/i.test(line)) continue;
    if (/Page\s*No\.?\s*:/i.test(line)) continue;

    if (sectionRe.test(line) && !itemStartRe.test(line) && !lumpSumAuRe.test(line)) {
      currentSection = line.replace(/^\d+\s+/, '').trim();
      pushSection(currentSection);
      continue;
    }

    if (lumpSumAuRe.test(line) ||
        (!itemStartRe.test(line) && !/\bSac\s*:\s*\d[\d\s]{5,10}\b/i.test(line))) continue;

    const itemNoMatch = line.match(/^\(\d+\)/) || line.match(/^\d+\)/) || line.match(/^\d+\b/);
    const itemNo = itemNoMatch
      ? (itemNoMatch[0].startsWith('(') ? itemNoMatch[0] : `(${itemNoMatch[0].replace(')', '')})`)
      : '';
    let joined = line;
    let consumed = 0;
    while (i + 1 < lines.length && consumed < 30) {
      const next = normalizeItemText(lines[i + 1]);
      if (!next) { i++; consumed++; continue; }
      // Only break on a real section (digit + space + alpha), not Building:/footer lines
      if (sectionRe.test(next) && !itemStartRe.test(next) &&
          !/^Building\s*:/i.test(next) &&
          !/Sr\s*No\.?\s*Service/i.test(next)) break;
      if (itemStartRe.test(next)) break;
      if (lumpSumAuRe.test(next)) { i++; consumed++; continue; }
      // Skip CGST/SGST/INR tax lines silently — they pollute the buffer
      if (/\b(CGST|SGST|INR)\b/i.test(next)) { i++; consumed++; continue; }
      // Skip page headers that appear mid-table (e.g. "Sr No. Service Description Order Qty. UOM Unit Price Value")
      if (/Sr\s*No\.?\s*Service\s*Description/i.test(next)) { i++; consumed++; continue; }
      // Skip "Building : ..." lines that appear after section headers
      if (/^Building\s*:/i.test(next)) { i++; consumed++; continue; }
      // Skip corporate footer lines
      if (/Corporate\s*Addr/i.test(next)) { i++; consumed++; continue; }
      if (/Page\s*No\.?\s*:/i.test(next)) { i++; consumed++; continue; }
      joined = `${joined} ${next}`.trim();
      i++; consumed++;
    }
    const parsed = extractItem(joined, itemNo);
    if (parsed) items.push(parsed);
  }
  // ── Post-pass: attach dangling lines to the correct item ────────────────
  // Same problem as Lodha: pdf.js emits the second description line of row N
  // AFTER the full content of row N+1. E.g.:
  //   (58) Sac: 995462 - Pro.Under gr.UPVC-Sch. 40 pipe 50  50  M  213.75  10,687.50
  //   (59) Sac: 995462 - Fix.Under gr.UPVC-Sch. 40 pipe 50 mm ...
  //   mm Ø                   ← belongs to (58), but comes here
  //
  // Fix: same two-pass approach — record start line index for each item,
  // then in pass 2 attach dangling lines (no item number, no SAC, no numeric tail)
  // to the item just before the next item that starts after them.

  const hsnRe2 = /\b\d{6}\b/;
  const tailRe2 = /\b[A-Za-z]{1,10}\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s*$/;
  const itemStartRe2 = /^(?:\(\s*\d+\s*\)|\d+\))/;

  const isDanglingH = line => {
    if (!line) return false;
    if (/\b(CGST|SGST|INR)\b/i.test(line)) return false;
    if (/Sr\s*No\.?\s*Service/i.test(line)) return false;
    if (/^Building\s*:/i.test(line)) return false;
    if (/Corporate\s*Addr/i.test(line)) return false;
    if (/Page\s*No\.?/i.test(line)) return false;
    if (/^\d+\s+[A-Za-z]/.test(line) && !itemStartRe2.test(line)) return false; // section
    if (itemStartRe2.test(line)) return false;
    if (hsnRe2.test(line)) return false;
    if (tailRe2.test(line)) return false;
    return true;
  };

  // Re-scan all lines to find where each item started
  const allLinesH = splitLines(rawText);
  const itemStartAtH = [];
  {
    let k = 0;
    for (let li = 0; li < allLinesH.length && k < items.length; li++) {
      const l = normalizeSpaces(allLinesH[li])
        .replace(/\(\s*(\d+)\s*\)/g, '($1)')
        .replace(/^(\d+)\)/, '($1)');
      if (itemStartRe2.test(l)) {
        const nm = l.match(/^\(\d+\)/);
        if (nm && k < items.length && items[k].item_no === nm[0]) {
          itemStartAtH[k] = li;
          k++;
        }
      }
    }
  }

  for (let li = 0; li < allLinesH.length; li++) {
    const line = normalizeSpaces(allLinesH[li]);
    if (!isDanglingH(line)) continue;

    // Find first item starting strictly after this line
    let nextK = -1;
    for (let k = 0; k < itemStartAtH.length; k++) {
      if (itemStartAtH[k] > li) { nextK = k; break; }
    }
    const target = nextK > 0 ? nextK - 1
                 : nextK === -1 && items.length > 0 ? items.length - 1
                 : -1;
    if (target >= 0) {
      items[target].description = normalizeSpaces(
        items[target].description + ' ' + line
      );
    }
  }

  return { items, sections, name: 'Hiranandani' };
}

// ─── OAKWOOD / GENERIC PARSER ─────────────────────────────────────────────────
function extractBOQFromText(rawText) {
  const items = [];
  let projectName = '';
  let category = '';
  let buffer = [];

  if (!rawText || typeof rawText !== 'string') return { items, projectName, sections: [], name: 'Oakwood' };

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const skip = line => {
    if (!line) return true;
    if (/^OAKWOOD\s+BUILDING|^Item\s*$|^Nos\.\s*Description|^Page\s+No\.|^--\s+\d+\s+of\s+\d+|^SCHEDULE\s+OF\s+QUANTITIES/i.test(line)) return true;
    if (/^Note:\s*$|^[ivxIVX]+\.\s|^[A-Z]\)\s/.test(line)) return true;
    if (/^TOTAL\s*:\s*["']?[A-G]["']?\s*CARRIED\s+TO\s+SUMMARY/i.test(line)) return true;
    if (/^Description\s+Unit\s+(Qty|Total|Tower)/i.test(line)) return true;
    return false;
  };

  const sectionMatch = line => /^([A-G])\.\s+(.+)$/.exec(line);
  const unitQtyOnly  = line => /^(Nos|RM|Cum|Sft|Job|Mtr|Sqm|Kg|Kgs|Set|Pair|M|MM|Meter|Meters|Litre|Ltr|Ltrs|Ft|Feet|Pcs|Each|mm|cm|in|inch|m2|sqm|sqft|sft|Lot|Bag)\.?\s*([\d,]+\.?\d*)\s*$/i.exec(line);
  const sameLine = line => {
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9\-\.]*)\s+(.+?)\s+(Nos|RM|Cum|Sft|Job|Mtr|Sqm|Kg|Kgs|Set|Pair|M|MM|Meter|Meters|Litre|Ltr|Ltrs|Ft|Feet|Pcs|Each|mm|cm|in|inch|m2|sqm|sqft|sft|Lot|Bag)\.?\s*([\d,]+\.?\d*)(?:\s+([\d,]+\.?\d*))?(?:\s+([\d,]+\.?\d*))?\s*$/i);
    if (!m) return null;
    const [, no, desc, unit, qty, rate, amount] = m;
    return {
      item_no: no.trim(), description: desc.trim(), unit: unit.trim(),
      qty: String(qty).replace(/,/g, ''),
      rate: rate ? String(rate).replace(/,/g, '') : undefined,
      amount: amount ? String(amount).replace(/,/g, '') : undefined,
    };
  };
  const itemStart = line => /^([A-Za-z0-9][A-Za-z0-9\-\.]*)\s+/.exec(line);

  const sections = [];
  const pushSection = name => {
    if (name && (!sections.length || sections[sections.length - 1] !== name)) sections.push(name);
  };

  for (const line of lines) {
    if (!projectName && /OAKWOOD\s+BUILDING|BUILDING\s+AT\s+KALYAN/i.test(line))
      projectName = line.trim().slice(0, 120);
    if (skip(line)) continue;

    const sec = sectionMatch(line);
    if (sec) {
      buffer = [];
      category = sec[2].replace(/\s*\([^)]*\)\s*$/, '').trim().slice(0, 80);
      pushSection(category);
      continue;
    }

    const uq = unitQtyOnly(line);
    if (uq) {
      if (buffer.length) {
        let desc = buffer.join(' ').trim().slice(0, 1000);
        let itemNo = '';
        const fm = /^([A-Za-z0-9][A-Za-z0-9\-\.]*)\s+/.exec(desc);
        if (fm) { itemNo = fm[1]; desc = desc.slice(fm[0].length).trim(); }
        if (desc) items.push({ item_no: itemNo, section: category, description: desc, hsn: '', unit: uq[1], qty: parseFloat(uq[2].replace(/,/g, '')) || 0, rate: 0, amount: 0 });
        buffer = [];
      }
      continue;
    }

    const sl = sameLine(line);
    if (sl) {
      buffer = [];
      items.push({
        item_no: sl.item_no,
        section: category,
        description: sl.description,
        hsn: '',
        unit: sl.unit,
        qty: parseFloat(sl.qty) || 0,
        rate: parseFloat(sl.rate) || 0,
        amount: parseFloat(sl.amount) || 0,
        qty_text: toDecimalString(sl.qty),
        rate_text: toFixedDecimalString(sl.rate, 2),
        amount_text: toFixedDecimalString(sl.amount, 2),
      });
      continue;
    }

    if (itemStart(line)) { buffer = [line]; continue; }
    if (buffer.length) buffer.push(line);
  }

  return { items, sections, projectName, name: 'Oakwood' };
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────────
/**
 * Run all parsers on rawText and return the result with the most items.
 * @param {string} rawText - output of extractRawText() from boqextractor.js
 * @returns {{ items: object[], sections: string[], projectName: string, name: string }}
 */
export function parseBoq(rawText) {
  const results = [
    parseLodhaBoq(rawText),
    parseHiranandaniBoqRowWise(rawText),
    extractBOQFromText(rawText),
  ];
  return results.reduce((a, b) => b.items.length > a.items.length ? b : a);
}
