/**
 * Extract purchase order fields from raw PDF text.
 * Handles common PO layouts with header, vendor, items, totals, and terms.
 */

/**
 * @typedef {Object} PurchaseOrderItem
 * @property {string} [srNo]
 * @property {string} [hsnCode]
 * @property {string} [description]
 * @property {string} [qty]
 * @property {string} [uom]
 * @property {string} [rate]
 * @property {string} [amount]
 * @property {string} [remarks]
 */

/**
 * @typedef {Object} ExtractedPO
 * @property {string} [title]
 * @property {string} [companyName]
 * @property {string} [companySubtitle]
 * @property {string} [companyAddress]
 * @property {string} [companyEmail]
 * @property {string} [companyGstNo]
 * @property {string} [source]
 * @property {string} [sourceFileName]
 * @property {string} [indentNo]
 * @property {string} [indentDate]
 * @property {string} [orderNo]
 * @property {string} [poDate]
 * @property {{ name?: string, site?: string, siteAddress?: string, contacts?: { primary?: { name?: string, phone?: string }, secondary?: { name?: string, phone?: string } } }} [vendor]
 * @property {{ title?: string, description?: string }} [itemsGroup]
 * @property {PurchaseOrderItem[]} [items]
 * @property {string} [subtotalAmount]
 * @property {{ percent?: string, amount?: string }} [discount]
 * @property {string} [afterDiscountAmount]
 * @property {{ cgst?: { percent?: string, amount?: string }, sgst?: { percent?: string, amount?: string } }} [taxes]
 * @property {string} [totalAmount]
 * @property {{ discountPercent?: string, tax?: string, delivery?: string, payment?: string }} [summary]
 * @property {string[]} [notes]
 * @property {string[]} [termsAndConditions]
 * @property {string} [authorisedSignatory]
 */

function normalizeDate(s) {
  if (!s || typeof s !== 'string') return '';
  const t = s.trim();
  const m1 = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return t;
}

function cleanNumber(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/,/g, '').replace(/\s+/g, '').trim();
}

function stripLabel(line, re) {
  const m = line.match(re);
  if (!m) return '';
  return (m[1] || '').trim();
}

/**
 * @param {string} rawText
 * @returns {ExtractedPO}
 */
export function extractPurchaseOrderFields(rawText) {
  const out = /** @type {ExtractedPO} */ ({
    vendor: { contacts: { primary: {}, secondary: {} } },
    itemsGroup: {},
    items: [],
    discount: {},
    taxes: { cgst: {}, sgst: {} },
    summary: {},
    notes: [],
    termsAndConditions: [],
  });

  if (!rawText || typeof rawText !== 'string') return out;

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = rawText.replace(/\s+/g, ' ').trim();

  // ---- Header / Company ----
  if (/PURCHASE\s+ORDER/i.test(text)) out.title = 'PURCHASE ORDER';
  const poIdx = lines.findIndex((l) => /PURCHASE\s+ORDER/i.test(l));
  if (lines[0]) out.companyName = lines[0];
  if (lines[1] && (!/PURCHASE\s+ORDER/i.test(lines[1]))) out.companySubtitle = lines[1];
  if (poIdx > 0) {
    const headerLines = lines.slice(0, poIdx).filter((l) => !/Email\s*:/i.test(l) && !/GST\s*(?:NO|IN)/i.test(l));
    if (headerLines.length > 2) {
      out.companyAddress = headerLines.slice(2).join(' ');
    }
  }
  const emailMatch = text.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (emailMatch) out.companyEmail = emailMatch[1];
  const gstMatch = text.match(/GST\s*(?:NO|IN)?\s*[:\-]?\s*([A-Z0-9]{15})/i);
  if (gstMatch) out.companyGstNo = gstMatch[1];

  // ---- Order Metadata ----
  const indentNo = text.match(/Indent\s*No\.?\s*[:\-]?\s*([A-Za-z0-9./_-]+)/i);
  if (indentNo) out.indentNo = indentNo[1];
  const indentDate = text.match(/Indent\s*No\.?[\s\S]*?Dated\s*[-:]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (indentDate) out.indentDate = normalizeDate(indentDate[1]);
  const orderNo = text.match(/Order\s*No\s*[:\-]?\s*([A-Za-z0-9./_-]+)/i);
  if (orderNo) out.orderNo = orderNo[1];
  const poDate = text.match(/P\.?O\.?\s*Date\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i);
  if (poDate) out.poDate = normalizeDate(poDate[1]);

  // ---- Vendor / Recipient ----
  const toLine = lines.find((l) => /^To\s*:\s*/i.test(l));
  if (toLine) out.vendor.name = stripLabel(toLine, /^To\s*:\s*(.+)$/i);
  const siteLine = lines.find((l) => /^Site\s*:\s*/i.test(l));
  if (siteLine) out.vendor.site = stripLabel(siteLine, /^Site\s*:\s*(.+)$/i);

  const addrIdx = lines.findIndex((l) => /^(Site\s*Address|Address)\s*:\s*/i.test(l));
  if (addrIdx !== -1) {
    const addrParts = [];
    const first = stripLabel(lines[addrIdx], /^(?:Site\s*Address|Address)\s*:\s*(.+)$/i);
    if (first) addrParts.push(first);
    for (let i = addrIdx + 1; i < Math.min(lines.length, addrIdx + 4); i++) {
      const l = lines[i];
      if (/^(Sr\.|HSN|Item|Qty|UOM|Rate|Amount|Remarks)/i.test(l)) break;
      if (/^Mr\.?\s+/i.test(l)) break;
      if (/^Note\s*:/i.test(l)) break;
      addrParts.push(l);
    }
    if (addrParts.length) out.vendor.siteAddress = addrParts.join(' ');
  }

  const contactMatches = [...text.matchAll(/([A-Za-z. ]+?)\s*-\s*(\d{10})/g)];
  if (contactMatches[0]) {
    out.vendor.contacts.primary.name = contactMatches[0][1].trim();
    out.vendor.contacts.primary.phone = contactMatches[0][2];
  }
  if (contactMatches[1]) {
    out.vendor.contacts.secondary.name = contactMatches[1][1].trim();
    out.vendor.contacts.secondary.phone = contactMatches[1][2];
  }

  // ---- Items ----
  const headerIdx = lines.findIndex((l) => /Sr\.?\s*No/i.test(l) && /HSN/i.test(l) && /Item/i.test(l));
  if (headerIdx !== -1) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      let line = lines[i];
      if (/^(Discount|CGST|SGST|Total\s*Amount|Note\s*:|Terms\s*&\s*Conditions)/i.test(line)) break;
      if (/^\d+[\d,]*\.\d{2}$/.test(line)) continue; // stray amount line

      if (!out.itemsGroup.title && /^[A-Z]\s+/.test(line) && !/^\d+\s+/.test(line)) {
        out.itemsGroup.title = line;
        continue;
      }

      const fixed = line.replace(/(\d)\s*\.\s*(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim();
      let match = fixed.match(/^(\d+)\s+(\d{4,})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z]+)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)(?:\s+(.*))?$/);
      if (!match && i + 1 < lines.length) {
        const combined = `${fixed} ${lines[i + 1].trim()}`.replace(/\s+/g, ' ').trim();
        match = combined.match(/^(\d+)\s+(\d{4,})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([A-Za-z]+)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)(?:\s+(.*))?$/);
        if (match) i += 1;
      }

      if (match) {
        const [, srNo, hsnCode, description, qty, uom, rate, amount, remarks] = match;
        out.items.push({
          srNo: srNo.trim(),
          hsnCode: hsnCode.trim(),
          description: description.trim(),
          qty: cleanNumber(qty),
          uom: uom.trim(),
          rate: cleanNumber(rate),
          amount: cleanNumber(amount),
          remarks: remarks ? remarks.trim() : '',
        });
      }
    }
  }

  // ---- Pricing / Taxes / Totals ----
  const discountLine = lines.find((l) => /^Discount\s*-\s*/i.test(l));
  if (discountLine) {
    const m = discountLine.match(/Discount\s*-\s*(\d+(?:\.\d+)?)%?\s*([\d,]+(?:\.\d+)?)/i);
    if (m) {
      out.discount.percent = m[1];
      out.discount.amount = cleanNumber(m[2]);
    }
    const idx = lines.indexOf(discountLine);
    const next = lines[idx + 1] || '';
    if (/^[\d,]+(?:\.\d+)?$/.test(next)) out.afterDiscountAmount = cleanNumber(next);
  }

  const cgstMatch = text.match(/CGST\b[\s\-:]*?(\d+(?:\.\d+)?)%[\s\-:]*?([\d,]+(?:\.\d+)?)/i)
    || lines.find((l) => /CGST\s*/i.test(l))?.match(/CGST\b[\s\-:]*?(\d+(?:\.\d+)?)%[\s\-:]*?([\d,]+(?:\.\d+)?)/i);
  if (cgstMatch) {
    out.taxes.cgst.percent = cgstMatch[1];
    out.taxes.cgst.amount = cleanNumber(cgstMatch[2]);
  }

  const sgstMatch = text.match(/SGST\b[\s\-:]*?(\d+(?:\.\d+)?)%[\s\-:]*?([\d,]+(?:\.\d+)?)/i)
    || lines.find((l) => /SGST\s*/i.test(l))?.match(/SGST\b[\s\-:]*?(\d+(?:\.\d+)?)%[\s\-:]*?([\d,]+(?:\.\d+)?)/i);
  if (sgstMatch) {
    out.taxes.sgst.percent = sgstMatch[1];
    out.taxes.sgst.amount = cleanNumber(sgstMatch[2]);
  }

  const totalLine = lines.find((l) => /^Total\s*Amount/i.test(l));
  if (totalLine) {
    const m = totalLine.match(/Total\s*Amount\s*([\d,]+(?:\.\d+)?)/i);
    if (m) out.totalAmount = cleanNumber(m[1]);
  }

  const summaryLine = lines.find((l) => /Discount\s*:/i.test(l) && /Tax\s*:/i.test(l));
  if (summaryLine) {
    const d = summaryLine.match(/Discount\s*:\s*([\d.]+)%/i);
    if (d) out.summary.discountPercent = d[1];
    const t = summaryLine.match(/Tax\s*:\s*([^D]+?)(?:\s+Delivery\s*:|\s+Payment\s*:|$)/i);
    if (t) out.summary.tax = t[1].trim();
    const del = summaryLine.match(/Delivery\s*:\s*([^P]+?)(?:\s+Payment\s*:|$)/i);
    if (del) out.summary.delivery = del[1].trim();
    const pay = summaryLine.match(/Payment\s*:\s*(.+)$/i);
    if (pay) out.summary.payment = pay[1].trim();
  }

  // ---- Notes ----
  const noteIdx = lines.findIndex((l) => /^Note\s*:/i.test(l));
  if (noteIdx !== -1) {
    const noteLine = lines[noteIdx];
    const firstNote = stripLabel(noteLine, /^Note\s*:\s*(.+)$/i);
    if (firstNote) out.notes.push(firstNote);
    for (let i = noteIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^Terms\s*&\s*Conditions/i.test(l)) break;
      if (/^Total\s*Amount/i.test(l)) continue;
      if (/^\d+\)/.test(l) || /^\d+\./.test(l)) {
        out.notes.push(l.replace(/^\d+[).]\s*/, '').trim());
      } else if (/^\d+\s+/.test(l)) {
        out.notes.push(l.replace(/^\d+\s+/, '').trim());
      }
    }
  }

  // ---- Terms & Conditions ----
  const termsIdx = lines.findIndex((l) => /^Terms\s*&\s*Conditions/i.test(l));
  if (termsIdx !== -1) {
    for (let i = termsIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^Authorised\s+Signatory/i.test(l)) break;
      if (/^\d+\)/.test(l) || /^\d+\./.test(l)) {
        out.termsAndConditions.push(l.replace(/^\d+[).]\s*/, '').trim());
      } else if (/^\d+\s+/.test(l)) {
        out.termsAndConditions.push(l.replace(/^\d+\s+/, '').trim());
      }
    }
  }

  if (lines.some((l) => /^Authorised\s+Signatory/i.test(l))) {
    out.authorisedSignatory = 'Authorised Signatory';
  }

  return out;
}

/**
 * Map extracted PO to Purchase Request items (name/quantity/unit).
 * @param {ExtractedPO} po
 * @returns {Array<{ id: number, name: string, quantity: string, unit: string }>} 
 */
export function mapPurchaseOrderToRequestItems(po) {
  const items = Array.isArray(po?.items) ? po.items : [];
  return items
    .filter((it) => it.description || it.qty)
    .map((it, idx) => ({
      id: Date.now() + idx,
      name: it.description || `Item ${idx + 1}`,
      quantity: it.qty || '',
      unit: it.uom || 'nos',
    }));
}
