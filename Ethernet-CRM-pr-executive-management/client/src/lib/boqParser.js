/**
 * BOQ parsers for Lodha Work Order, Hiranandani Work Order Form, and Oakwood PHE BOQ.
 *
 * Synced to the source-of-truth logic in `assets/boqparser.js`.
 * All three parsers are run; the result with the most items is returned.
 *
 * Returned `items[i]` fields:
 *   item_no, section, description, hsn, sac_code, unit, qty, rate, amount
 *   qty_text, rate_text, amount_text (optional, preserves decimals)
 */

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const normalizeSpaces = (v) => String(v || '').replace(/\s+/g, ' ').trim();

const toDecimalString = (v) => {
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
  const intPart = i.replace(/^0+(?=\d)/, '') || '0';
  return `${sign}${intPart}.${frac}`;
};

const toNumber = (v) => {
  if (v == null) return NaN;
  const cleaned = String(v).replace(/,/g, '').trim();
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return NaN;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : NaN;
};

const isLikelyFooterOrHeader = (line) => {
  const t = normalizeSpaces(line).toUpperCase();
  if (!t) return true;
  if (t.includes('SR.NO') && t.includes('ITEM') && t.includes('DESCRIPTION')) return true;
  if (t.includes('HSN') && t.includes('SAC') && t.includes('UNIT')) return true;
  if (t.includes('COMPANY') && t.includes('CONTRACTOR')) return true;
  if (t.includes('TOTAL OF AMOUNT')) return true;
  if (t.includes('CONTRACT AMOUNT')) return true;
  if (t === 'PAGE' || t.startsWith('PAGE ')) return true;
  if (/\(SIGN\s*[&]\s*STAMP\)/.test(t)) return true;
  if (/WORK ORDER\s*:\s*\d+/.test(t)) return true;
  if (/VERSION NO\s*:\s*\d+/.test(t)) return true;
  if (/^NO\.\s*CODE/.test(t)) return true;
  return false;
};

const splitLines = (rawText) =>
  String(rawText || '')
    .split(/\r?\n/)
    .map((l) => normalizeSpaces(l))
    .filter(Boolean);

const findAllMatches = (str, regex) => {
  const matches = [];
  let m;
  const r = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  while ((m = r.exec(str)) !== null) matches.push(m);
  return matches;
};

// ─── LODHA PARSER ─────────────────────────────────────────────────────────────
function parseLodhaBoqInternal(rawText) {
  const lines = splitLines(rawText).filter((l) => !isLikelyFooterOrHeader(l));
  const sections = [];
  const items = [];
  const itemStartAt = [];
  let currentSection = '';

  const sectionRe = /^\d+\.\d+\s+[A-Z]/;
  const itemNoRe = /^(?:\d+\.\d+\.\d+|\d+\.\d+|\d+)\b/;
  const hsnRe = /\b(\d{6})\b/;
  const tailRe = /\b([A-Za-z]{1,10})\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s+(-?\d[\d,]*\.?\d*)\s*$/;

  const pushSection = (name) => {
    const n = normalizeSpaces(name);
    if (!n || (sections.length && sections[sections.length - 1] === n)) return;
    sections.push(n);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (sectionRe.test(line)) {
      currentSection = normalizeSpaces(line.replace(/^\d+\.\d+\s+/, ''));
      pushSection(currentSection);
      continue;
    }

    if (!itemNoRe.test(line)) continue;

    const itemNo = normalizeSpaces((line.match(itemNoRe) || [''])[0]);
    const startLineIdx = i;
    let buffer = line.slice(itemNo.length).trim();

    let consumed = 0;
    let hsnMatch = buffer.match(hsnRe);
    let tailOk = tailRe.test(buffer);

    while ((!hsnMatch || !tailOk) && i + 1 < lines.length && consumed < 40) {
      const next = lines[i + 1];
      if (sectionRe.test(next)) break;
      if (itemNoRe.test(next) && (next.match(itemNoRe) || [''])[0] !== itemNo) break;
      if (isLikelyFooterOrHeader(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      buffer = `${buffer} ${next}`.trim();
      i += 1;
      consumed += 1;
      hsnMatch = buffer.match(hsnRe);
      tailOk = tailRe.test(buffer);
    }

    if (!hsnMatch) continue;
    const hsn = hsnMatch[1];
    const tailMatch = buffer.match(tailRe);
    if (!tailMatch) continue;

    const [, unit, qtyRaw, rateRaw, amountRaw] = tailMatch;
    const qty = toNumber(qtyRaw);
    const rate = toNumber(rateRaw);
    const amount = toNumber(amountRaw);
    const qty_text = toDecimalString(qtyRaw);
    const rate_text = toFixedDecimalString(rateRaw, 2);
    const amount_text = toFixedDecimalString(amountRaw, 2);

    const beforeTail = buffer.slice(0, tailMatch.index).trim();
    const hsnIndex = beforeTail.indexOf(hsn);
    let description = normalizeSpaces(hsnIndex >= 0 ? beforeTail.slice(0, hsnIndex) : beforeTail.replace(hsnRe, ''));
    if (!description) continue;

    itemStartAt.push(startLineIdx);
    items.push({
      item_no: itemNo,
      section: currentSection,
      description,
      hsn,
      sac_code: '',
      unit: normalizeSpaces(unit),
      qty: Number.isFinite(qty) ? qty : 0,
      rate: Number.isFinite(rate) ? rate : 0,
      amount: Number.isFinite(amount) ? amount : 0,
      qty_text,
      rate_text,
      amount_text,
    });
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    if (isLikelyFooterOrHeader(line)) continue;
    if (sectionRe.test(line)) continue;
    if (/^\d+\.\d+/.test(line)) continue;
    if (hsnRe.test(line)) continue;
    if (tailRe.test(line)) continue;

    let nextK = -1;
    for (let k = 0; k < itemStartAt.length; k++) {
      if (itemStartAt[k] > li) {
        nextK = k;
        break;
      }
    }

    const target =
      nextK > 0 ? nextK - 1 : nextK === -1 && items.length > 0 ? items.length - 1 : -1;

    if (target >= 0) {
      items[target].description = normalizeSpaces(`${items[target].description} ${line}`);
    }
  }

  return { items, sections, name: 'Lodha', projectName: '' };
}

// ─── HIRANANDANI PARSER ───────────────────────────────────────────────────────
function parseHiranandaniBoqRowWiseInternal(rawText) {
  const lines = splitLines(rawText);
  const sections = [];
  const items = [];
  let currentSection = '';

  const sectionRe = /^\d+\s+[A-Za-z].+/;
  const itemStartRe = /^(?:\(\s*\d+\s*\)|\d+\))/;
  const lumpSumAuRe = /^\d+\s+AU\s+[\d,]+(\.\d+)?\b/i;

  const pushSection = (name) => {
    const n = normalizeSpaces(name);
    if (!n || (sections.length && sections[sections.length - 1] === n)) return;
    sections.push(n);
  };

  const normalizeItemText = (value) =>
    normalizeSpaces(value)
      .replace(/\(\s*(\d+)\s*\)/g, '($1)')
      .replace(/^(\d+)\)/, '($1)')
      .replace(/\bSAC\b/g, 'Sac')
      .replace(/\bS\.?A\.?C\.?\b/gi, 'Sac');

  const extractItem = (joinedRaw, itemNo) => {
    const joined = normalizeItemText(joinedRaw);

    // PDFs vary: "SAC: 995462", "SAC Code : 995462", "SAC Code 995462", "SAC-995462", etc.
    const sacMatch = joined.match(/Sac(?:\s*Code)?\s*[:\-]?\s*(\d[\d\s]{5,10})\b/i);
    let sac_code = sacMatch ? String(sacMatch[1] || '').replace(/\s+/g, '') : '';
    const afterSac = sacMatch ? joined.slice(sacMatch.index + sacMatch[0].length) : joined.replace(/^\(\d+\)\s*/i, '');

    const tokenMatches = findAllMatches(afterSac, /\S+/g);
    if (tokenMatches.length < 4) return null;
    const tokens = tokenMatches.map((m) => m[0]);

    let tailIndex = -1;
    let tailMode = 'QTY_UOM_RATE_VALUE'; // legacy: qty uom unit_price value
    for (let t = tokens.length - 1; t >= 3; t--) {
      const value = toNumber(tokens[t]);
      const unit_price = toNumber(tokens[t - 1]);
      if (!Number.isFinite(value) || !Number.isFinite(unit_price)) continue;

      // Mode A (legacy): ... qty uom unit_price value
      {
        const uom = normalizeSpaces(tokens[t - 2]);
        const order_qty = toNumber(tokens[t - 3]);
        if (Number.isFinite(order_qty) && uom && !Number.isFinite(toNumber(uom))) {
          tailIndex = t - 3;
          tailMode = 'QTY_UOM_RATE_VALUE';
          break;
        }
      }

      // Mode B (newer): ... uom qty unit_price value
      {
        const uom = normalizeSpaces(tokens[t - 3]);
        const order_qty = toNumber(tokens[t - 2]);
        if (Number.isFinite(order_qty) && uom && !Number.isFinite(toNumber(uom))) {
          tailIndex = t - 3;
          tailMode = 'UOM_QTY_RATE_VALUE';
          break;
        }
      }
    }
    if (tailIndex < 0) return null;

    const qty = tailMode === 'QTY_UOM_RATE_VALUE' ? toNumber(tokens[tailIndex]) : toNumber(tokens[tailIndex + 1]);
    const unit = tailMode === 'QTY_UOM_RATE_VALUE' ? normalizeSpaces(tokens[tailIndex + 1]) : normalizeSpaces(tokens[tailIndex]);
    const rate = toNumber(tokens[tailIndex + 2]);
    const amount = toNumber(tokens[tailIndex + 3]);
    const qty_text = tailMode === 'QTY_UOM_RATE_VALUE' ? toDecimalString(tokens[tailIndex]) : toDecimalString(tokens[tailIndex + 1]);
    const rate_text = toFixedDecimalString(tokens[tailIndex + 2], 2);
    const amount_text = toFixedDecimalString(tokens[tailIndex + 3], 2);
    if (!Number.isFinite(amount) || !Number.isFinite(rate) || !Number.isFinite(qty) || !unit) return null;

    let descTokens = tokens.slice(0, tailIndex);

    // Newer Hiranandani exports sometimes have separate columns:
    // Item No | Description | Section | SAC Code | UOM | Order Qty | Unit Price | Value
    // In this case, SAC code may appear as a bare 4–10 digit token (no "SAC:" label).
    if (!sac_code) {
      for (let j = descTokens.length - 1; j >= 0; j--) {
        const t = String(descTokens[j] || '');
        const m = t.match(/^(\d[\d\s]{3,10})$/);
        if (m) {
          const candidate = String(m[1]).replace(/\s+/g, '');
          if (candidate.length >= 4 && candidate.length <= 10) {
            sac_code = candidate;
            descTokens = descTokens.slice(0, j).concat(descTokens.slice(j + 1));
            break;
          }
        }
      }
    }

    const description = normalizeSpaces(descTokens.join(' '))
      .replace(/\(\d+\)\s*/i, '')
      .replace(/(?:SAC|Sac)\s*:\s*\d{6}\s*-\s*/i, '')
      .trim();
    if (!description) return null;

    return {
      item_no: itemNo,
      section: currentSection,
      hsn: '',
      sac_code,
      description,
      unit,
      qty,
      rate,
      amount,
      qty_text,
      rate_text,
      amount_text,
    };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeItemText(lines[i]);
    if (!line) continue;

    if (/Sr\s*No\.?\s*Service\s*Description/i.test(line)) continue;
    if (/^Building\s*:/i.test(line)) continue;
    if (/Corporate\s*Addr/i.test(line)) continue;
    if (/Page\s*No\.?\s*:/i.test(line)) continue;

    if (sectionRe.test(line) && !itemStartRe.test(line) && !lumpSumAuRe.test(line)) {
      currentSection = line.replace(/^\d+\s+/, '').trim();
      pushSection(currentSection);
      continue;
    }

    if (
      lumpSumAuRe.test(line) ||
      (!itemStartRe.test(line) && !/\bSac\s*:\s*\d[\d\s]{5,10}\b/i.test(line))
    )
      continue;

    const itemNoMatch = line.match(/^\(\d+\)/) || line.match(/^\d+\)/) || line.match(/^\d+\b/);
    const itemNo = itemNoMatch
      ? itemNoMatch[0].startsWith('(')
        ? itemNoMatch[0]
        : `(${itemNoMatch[0].replace(')', '')})`
      : '';
    let joined = line;
    let consumed = 0;
    while (i + 1 < lines.length && consumed < 30) {
      const next = normalizeItemText(lines[i + 1]);
      if (!next) {
        i += 1;
        consumed += 1;
        continue;
      }
      if (
        sectionRe.test(next) &&
        !itemStartRe.test(next) &&
        !/^Building\s*:/i.test(next) &&
        !/Sr\s*No\.?\s*Service/i.test(next)
      )
        break;
      if (itemStartRe.test(next)) break;
      if (lumpSumAuRe.test(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      if (/\b(CGST|SGST|INR)\b/i.test(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      if (/Sr\s*No\.?\s*Service\s*Description/i.test(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      if (/^Building\s*:/i.test(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      if (/Corporate\s*Addr/i.test(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      if (/Page\s*No\.?\s*:/i.test(next)) {
        i += 1;
        consumed += 1;
        continue;
      }
      joined = `${joined} ${next}`.trim();
      i += 1;
      consumed += 1;
    }
    const parsed = extractItem(joined, itemNo);
    if (parsed) items.push(parsed);
  }

  const hsnRe2 = /\b\d{6}\b/;
  const tailRe2 = /\b[A-Za-z]{1,10}\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s+[\d,]+\.?\d*\s*$/;
  const itemStartRe2 = /^(?:\(\s*\d+\s*\)|\d+\))/;

  const isDanglingH = (line) => {
    if (!line) return false;
    if (/\b(CGST|SGST|INR)\b/i.test(line)) return false;
    if (/Sr\s*No\.?\s*Service/i.test(line)) return false;
    if (/^Building\s*:/i.test(line)) return false;
    if (/Corporate\s*Addr/i.test(line)) return false;
    if (/Page\s*No\.?/i.test(line)) return false;
    if (/^\d+\s+[A-Za-z]/.test(line) && !itemStartRe2.test(line)) return false;
    if (itemStartRe2.test(line)) return false;
    if (hsnRe2.test(line)) return false;
    if (tailRe2.test(line)) return false;
    return true;
  };

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
          k += 1;
        }
      }
    }
  }

  for (let li = 0; li < allLinesH.length; li++) {
    const line = normalizeSpaces(allLinesH[li]);
    if (!isDanglingH(line)) continue;

    let nextK = -1;
    for (let k = 0; k < itemStartAtH.length; k++) {
      if (itemStartAtH[k] > li) {
        nextK = k;
        break;
      }
    }
    const target =
      nextK > 0 ? nextK - 1 : nextK === -1 && items.length > 0 ? items.length - 1 : -1;
    if (target >= 0) {
      items[target].description = normalizeSpaces(`${items[target].description} ${line}`);
    }
  }

  return { items, sections, name: 'Hiranandani', projectName: '' };
}

// ─── OAKWOOD / GENERIC PARSER ─────────────────────────────────────────────────
function extractBOQFromTextInternal(rawText) {
  const items = [];
  let projectName = '';
  let category = '';
  let buffer = [];

  if (!rawText || typeof rawText !== 'string') return { items, projectName, sections: [], name: 'Oakwood' };

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const skip = (line) => {
    if (!line) return true;
    if (/^OAKWOOD\s+BUILDING|^Item\s*$|^Nos\.\s*Description|^Page\s+No\.|^--\s+\d+\s+of\s+\d+|^SCHEDULE\s+OF\s+QUANTITIES/i.test(line)) return true;
    if (/^Note:\s*$|^[ivxIVX]+\.\s|^[A-Z]\)\s/.test(line)) return true;
    if (/^TOTAL\s*:\s*["']?[A-G]["']?\s*CARRIED\s+TO\s+SUMMARY/i.test(line)) return true;
    if (/^Description\s+Unit\s+(Qty|Total|Tower)/i.test(line)) return true;
    return false;
  };

  const sectionMatch = (line) => /^([A-G])\.\s+(.+)$/.exec(line);
  const unitQtyOnly = (line) =>
    /^(Nos|RM|Cum|Sft|Job|Mtr|Sqm|Kg|Kgs|Set|Pair|M|MM|Meter|Meters|Litre|Ltr|Ltrs|Ft|Feet|Pcs|Each|mm|cm|in|inch|m2|sqm|sqft|sft|Lot|Bag)\.?\s*([\d,]+\.?\d*)\s*$/i.exec(
      line
    );
  const sameLine = (line) => {
    const m = line.match(
      /^([A-Za-z0-9][A-Za-z0-9.-]*)\s+(.+?)\s+(Nos|RM|Cum|Sft|Job|Mtr|Sqm|Kg|Kgs|Set|Pair|M|MM|Meter|Meters|Litre|Ltr|Ltrs|Ft|Feet|Pcs|Each|mm|cm|in|inch|m2|sqm|sqft|sft|Lot|Bag)\.?\s*([\d,]+\.?\d*)(?:\s+([\d,]+\.?\d*))?(?:\s+([\d,]+\.?\d*))?\s*$/i
    );
    if (!m) return null;
    const [, no, desc, unit, qty, rate, amount] = m;
    return {
      item_no: no.trim(),
      description: desc.trim(),
      unit: unit.trim(),
      qty: String(qty).replace(/,/g, ''),
      rate: rate ? String(rate).replace(/,/g, '') : undefined,
      amount: amount ? String(amount).replace(/,/g, '') : undefined,
    };
  };
  const itemStart = (line) => /^([A-Za-z0-9][A-Za-z0-9.-]*)\s+/.exec(line);

  const sections = [];
  const pushSection = (name) => {
    if (name && (!sections.length || sections[sections.length - 1] !== name)) sections.push(name);
  };

  for (const line of lines) {
    if (!projectName && /OAKWOOD\s+BUILDING|BUILDING\s+AT\s+KALYAN/i.test(line)) projectName = line.trim().slice(0, 120);
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
        const fm = /^([A-Za-z0-9][A-Za-z0-9.-]*)\s+/.exec(desc);
        if (fm) {
          itemNo = fm[1];
          desc = desc.slice(fm[0].length).trim();
        }
        if (desc) {
          items.push({
            item_no: itemNo,
            section: category,
            description: desc,
            hsn: '',
            sac_code: '',
            unit: uq[1],
            qty: Number.parseFloat(uq[2].replace(/,/g, '')) || 0,
            rate: 0,
            amount: 0,
          });
        }
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
        sac_code: '',
        unit: sl.unit,
        qty: Number.parseFloat(sl.qty) || 0,
        rate: Number.parseFloat(sl.rate) || 0,
        amount: Number.parseFloat(sl.amount) || 0,
        qty_text: toDecimalString(sl.qty),
        rate_text: toFixedDecimalString(sl.rate, 2),
        amount_text: toFixedDecimalString(sl.amount, 2),
      });
      continue;
    }

    if (itemStart(line)) {
      buffer = [line];
      continue;
    }
    if (buffer.length) buffer.push(line);
  }

  return { items, sections, projectName, name: 'Oakwood' };
}

// ─── PUBLIC ENTRY POINTS ──────────────────────────────────────────────────────
export function parseLodhaBoq(rawText) {
  const { items, sections } = parseLodhaBoqInternal(rawText);
  return { items, sections };
}

export function parseHiranandaniBoq(rawText) {
  const { items, sections } = parseHiranandaniBoqRowWiseInternal(rawText);
  return { items, sections };
}

export function parseOakwoodBoq(rawText) {
  const { items, sections, projectName } = extractBOQFromTextInternal(rawText);
  return { items, sections, projectName };
}

/**
 * Run all parsers and return the result with the most items.
 * @param {string} rawText
 * @returns {{ items: any[], sections: string[], projectName: string, name: string }}
 */
export function parseBoq(rawText) {
  const results = [
    parseLodhaBoqInternal(rawText),
    parseHiranandaniBoqRowWiseInternal(rawText),
    extractBOQFromTextInternal(rawText),
  ];
  return results.reduce((a, b) => (b.items.length > a.items.length ? b : a));
}
