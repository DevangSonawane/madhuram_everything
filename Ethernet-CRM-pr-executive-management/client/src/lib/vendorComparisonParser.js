import * as XLSX from "xlsx";

const toTrimmed = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return String(value ?? "").replace(/\u00A0/g, " ").trim();
};

const normalizeText = (value) =>
  toTrimmed(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeForMatch = (value) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toNumberOrNull = (value) => {
  if (value === "" || value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRate = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed == null) return null;
  if (parsed > 1 && parsed <= 100) return parsed / 100;
  return parsed;
};

const splitLabelValue = (cellValue, nextCellValue = "") => {
  const raw = toTrimmed(cellValue);
  if (!raw) return "";
  const match = raw.match(/^([^:]+):\s*-?\s*(.*)$/);
  if (!match) return raw;
  const inlineValue = toTrimmed(match[2]);
  if (inlineValue) return inlineValue;
  const nextRaw = toTrimmed(nextCellValue);
  if (!nextRaw) return "";
  if (nextRaw === raw) return "";
  const nextMatch = nextRaw.match(/^([^:]+):\s*-?\s*(.*)$/);
  if (nextMatch && !toTrimmed(nextMatch[2])) return "";
  return nextRaw;
};

const buildMergeLookup = (merges = []) => {
  const map = new Map();
  merges.forEach((m) => {
    const sr = m?.s?.r ?? null;
    const sc = m?.s?.c ?? null;
    const er = m?.e?.r ?? null;
    const ec = m?.e?.c ?? null;
    if (sr == null || sc == null || er == null || ec == null) return;
    for (let r = sr; r <= er; r += 1) {
      for (let c = sc; c <= ec; c += 1) {
        map.set(`${r}:${c}`, { r: sr, c: sc });
      }
    }
  });
  return map;
};

const sheetCellValue = (ws, mergeLookup, r, c) => {
  const key = `${r}:${c}`;
  const topLeft = mergeLookup.get(key);
  const target = topLeft ?? { r, c };
  const ref = XLSX.utils.encode_cell({ r: target.r, c: target.c });
  const cell = ws?.[ref];
  return cell?.v ?? "";
};

const buildRowMatrix = (workbook) => {
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return { rows: [], sheetName: "", range: null };
  }

  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    return { rows: [], sheetName, range: null };
  }

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  const mergeLookup = buildMergeLookup(ws["!merges"] || []);
  const rows = [];

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      row.push(sheetCellValue(ws, mergeLookup, r, c));
    }
    rows.push(row);
  }

  return { rows, sheetName, range };
};

const buildWorkbookMatrices = (workbook) =>
  (Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : []).map((sheetName) => ({
    sheetName,
    ...buildRowMatrix({ ...workbook, SheetNames: [sheetName] }),
  }));

const rowText = (row, maxCols = 6) =>
  (Array.isArray(row) ? row.slice(0, maxCols) : []).map((cell) => toTrimmed(cell)).join(" ");

const isSectionLabel = (value) => /^[A-Z]$/.test(toTrimmed(value));

const isNumericSr = (value) => {
  const parsed = toNumberOrNull(value);
  return parsed != null && Number.isInteger(parsed) && parsed > 0;
};

const isSummaryLabel = (text) => {
  const normalized = normalizeForMatch(text);
  return (
    normalized.includes("subtotal") ||
    normalized.includes("discount") ||
    normalized.includes("gst") ||
    normalized.includes("net amount") ||
    normalized.includes("total value")
  );
};

const findExactLabelRow = (rows, label, startRow = 0, endRow = rows.length - 1) => {
  const target = normalizeForMatch(label);
  for (let i = startRow; i <= endRow; i += 1) {
    const cell = normalizeForMatch(rows[i]?.[0] || "");
    if (cell === target) return i;
  }
  return -1;
};

const isStrictTemplateSheet = (rows) => {
  if (!Array.isArray(rows) || rows.length < 18) return false;
  const row0 = normalizeForMatch(rows[0]?.[0] || "");
  const row1 = normalizeForMatch(rows[1]?.[0] || "");
  const row2 = normalizeForMatch(rows[2]?.[0] || "");
  const row3 = normalizeForMatch(rows[3]?.[0] || "");
  const row4 = normalizeForMatch(rows[4]?.[0] || "");
  const row7 = (rows[7] || []).map((cell) => normalizeForMatch(cell));
  const row6 = rows[6] || [];
  const vendorCols = [];
  for (let col = 5; col < row7.length; col += 2) {
    if (row7[col] !== "rate" || row7[col + 1] !== "amount") break;
    vendorCols.push(col);
  }
  const row7HasHeaders =
    row7[0] === "sr no" &&
    row7[1] === "hsn code" &&
    row7[2] === "item description" &&
    row7[3] === "qty" &&
    row7[4] === "uom" &&
    row7.slice(5).every((cell, idx) => (idx % 2 === 0 ? cell === "rate" : cell === "amount"));

  return (
    row0.startsWith("company name") &&
    row1.startsWith("project name") &&
    row2.startsWith("indent no") &&
    row3.startsWith("indent date") &&
    row4.startsWith("comparison date") &&
    row7HasHeaders &&
    vendorCols.length > 0 &&
    vendorCols.every((col) => toTrimmed(row6[col] || "")) &&
    vendorCols.every((col) => {
      const left = toTrimmed(row6[col] || "");
      const right = toTrimmed(row6[col + 1] || "");
      return !right || right === left;
    })
  );
};

const readStrictMetaValue = (rows, rowIndex) => toTrimmed(rows[rowIndex]?.[1] || "");

const parseStrictTemplateSheet = (rows, sheetName, blockIndex) => {
  const summaryStart = findExactLabelRow(rows, "Subtotal", 8);
  const discountRowIdx = findExactLabelRow(rows, "Discount", 8);
  const netAmountRowIdx = findExactLabelRow(rows, "Net Amount", 8);
  const gstRowIdx = findExactLabelRow(rows, "GST", 8);
  const totalRowIdx = findExactLabelRow(rows, "Total Value", 8);
  if (summaryStart === -1 || discountRowIdx === -1 || netAmountRowIdx === -1 || gstRowIdx === -1 || totalRowIdx === -1) {
    return null;
  }

  const meta = {
    companyName: readStrictMetaValue(rows, 0),
    projectName: readStrictMetaValue(rows, 1),
    indentNo: readStrictMetaValue(rows, 2),
    indentDate: readStrictMetaValue(rows, 3),
    comparisonDate: readStrictMetaValue(rows, 4),
  };

  const vendorRow = rows[6] || [];
  const headerRow = rows[7] || [];
  const vendors = [];
  for (let i = 0; 5 + i * 2 < headerRow.length; i += 1) {
    const rateCol = 5 + i * 2;
    const amountCol = rateCol + 1;
    const rateHeader = normalizeForMatch(headerRow[rateCol] || "");
    const amountHeader = normalizeForMatch(headerRow[amountCol] || "");
    if (rateHeader !== "rate" || amountHeader !== "amount") break;
    const name = toTrimmed(vendorRow[rateCol]);
    if (!name) return null;
    const amountCellText = toTrimmed(vendorRow[amountCol]);
    if (amountCellText && amountCellText !== name) return null;
    vendors.push({
      vendorIndex: i,
      columnIndex: rateCol,
      name,
      rateColIndex: rateCol,
      amountColIndex: amountCol,
      subLabel: "",
      displayName: name,
      duplicateIndex: 1,
    });
  }

  if (vendors.length === 0) return null;

  const sections = [];
  let currentSection = null;
  for (let r = 8; r < summaryStart; r += 1) {
    const row = rows[r] || [];
    const sr = toTrimmed(row[0]);
    const desc = toTrimmed(row[2] || row[1] || "");
    const hasVendorText = vendors.some((vendor) => toTrimmed(row[vendor.rateColIndex] || row[vendor.amountColIndex] || ""));
    if (!sr && !desc && !hasVendorText) continue;

    if (isSectionLabel(sr)) {
      currentSection = {
        sectionLabel: sr,
        sectionDescription: desc || "-",
        vendorBrand: vendors.map(() => ""),
        items: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (isNumericSr(sr)) {
      if (!currentSection) {
        currentSection = { sectionLabel: "", sectionDescription: "", vendorBrand: vendors.map(() => ""), items: [] };
        sections.push(currentSection);
      }
      currentSection.items.push({
        srNo: Number(sr),
        hsnCode: toTrimmed(row[1]),
        description: desc,
        totalQty: toNumberOrNull(row[3]),
        uom: toTrimmed(row[4]),
        vendorData: vendors.map((vendor) => ({
          vendorIndex: vendor.vendorIndex,
          vendorName: vendor.displayName,
          vendorNameRaw: vendor.name,
          vendorBrand: "",
          rate: toNumberOrNull(row[vendor.rateColIndex]),
          amount: toNumberOrNull(row[vendor.amountColIndex]),
        })),
      });
    }
  }

  const issues = [];
  const summary = {
    subtotal: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, amount: null, source: "primary" })),
    discount: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, rate: null, amount: null, source: "primary" })),
    netAmount: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, amount: null, source: "primary" })),
    gst: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, rate: null, amount: null, source: "primary" })),
    totalValue: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, amount: null, source: "primary" })),
  };

  const summaryRows = [
    { key: "subtotal", rowIndex: summaryStart },
    { key: "discount", rowIndex: discountRowIdx },
    { key: "netAmount", rowIndex: netAmountRowIdx },
    { key: "gst", rowIndex: gstRowIdx },
    { key: "totalValue", rowIndex: totalRowIdx },
  ];

  summaryRows.forEach(({ key, rowIndex }) => {
    vendors.forEach((vendor, idx) => {
      const row = rows[rowIndex] || [];
      if (key === "discount" || key === "gst") {
        summary[key][idx] = {
          vendorIndex: vendor.vendorIndex,
          vendorName: vendor.displayName,
          rate: normalizeRate(row[vendor.rateColIndex]),
          amount: toNumberOrNull(row[vendor.amountColIndex]),
          source: "primary",
        };
      } else {
        summary[key][idx] = {
          vendorIndex: vendor.vendorIndex,
          vendorName: vendor.displayName,
          amount: toNumberOrNull(row[vendor.amountColIndex]),
          source: "primary",
        };
      }
    });
  });

  return {
    blockIndex,
    blockStartRow: 0,
    blockEndRow: rows.length - 1,
    meta,
    subProjectName: "",
    vendors,
    sections,
    summary,
    issues,
    sheetName,
    strictTemplate: true,
  };
};

const findBlockStarts = (rows) =>
  rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => normalizeForMatch(row?.[0] || "").startsWith("company name"))
    .map(({ index }) => index);

const findHeaderRowIndex = (rows, blockStart, blockEnd) => {
  const searchEnd = Math.min(blockEnd, blockStart + 12);
  for (let i = blockStart; i <= searchEnd; i += 1) {
    const normalized = (rows[i] || []).map((cell) => normalizeForMatch(cell));
    const hasSr = normalized.some((cell) => cell === "sr no" || cell === "sr. no" || cell === "sr no.");
    const hasUom = normalized.some((cell) => cell === "uom");
    const hasQty = normalized.some((cell) => cell === "qty" || cell === "total qty" || cell === "totalqty");
    if (hasSr && hasUom && hasQty) return i;
  }
  return Math.min(blockStart + 6, blockEnd);
};

const extractMeta = (rows, blockStart) => {
  const row0 = rows[blockStart] || [];
  const row1 = rows[blockStart + 1] || [];
  const row2 = rows[blockStart + 2] || [];
  const row3 = rows[blockStart + 3] || [];
  const row4 = rows[blockStart + 4] || [];

  return {
    companyName: splitLabelValue(row0[0], row0[1]),
    projectName: splitLabelValue(row1[0], row1[1]),
    indentNo: splitLabelValue(row2[0], row2[1]),
    indentDate: splitLabelValue(row3[0], row3[1]),
    comparisonDate: splitLabelValue(row4[0], row4[1]),
  };
};

const findVendorRowIndex = (rows, blockStart, headerRowIdx, blockEnd) => {
  let bestIdx = Math.min(blockStart + 5, blockEnd);
  let bestScore = -1;
  const searchEnd = Math.max(blockStart + 4, Math.min(headerRowIdx - 1, blockStart + 7));
  for (let i = blockStart + 4; i <= searchEnd; i += 1) {
    const row = rows[i] || [];
    const score = [5, 7, 9, 11, 13, 15].reduce((acc, col) => {
      const left = normalizeForMatch(row[col] || "");
      const right = normalizeForMatch(row[col + 1] || "");
      const hitLeft = left && left !== "rate" && left !== "amount";
      const hitRight = right && right !== "rate" && right !== "amount";
      const headerOnly = (left === "rate" || left === "amount") && (right === "rate" || right === "amount" || !right);
      if (headerOnly) return acc - 1;
      if (hitLeft && hitRight) return acc + 2;
      if (hitLeft || hitRight) return acc + 1;
      return acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
};

const parseVendorColumns = (rows, blockStart, headerRowIdx, blockEnd) => {
  const vendorRowIdx = findVendorRowIndex(rows, blockStart, headerRowIdx, blockEnd);
  const vendorRow = rows[vendorRowIdx] || [];
  const headerRow = rows[headerRowIdx] || [];
  const vendors = [];
  const maxCol = Math.max(headerRow.length, vendorRow.length);
  const subProjectName = Array.from({ length: Math.min(8, vendorRow.length) }, (_, idx) => vendorRow[idx])
    .map((cell) => toTrimmed(cell))
    .find((text) => normalizeForMatch(text).includes("project name")) || "";

  for (let col = 5; col < maxCol; col += 2) {
    const rateHeader = normalizeForMatch(headerRow[col] || "");
    const amountHeader = normalizeForMatch(headerRow[col + 1] || "");
    const hasHeaderPair = rateHeader === "rate" && amountHeader === "amount";
    const rawName = toTrimmed(vendorRow[col]);
    const rawNameAlt = toTrimmed(vendorRow[col + 1]);
    const candidateName = [rawName, rawNameAlt].find((text) => {
      const normalized = normalizeForMatch(text);
      return normalized && normalized !== "rate" && normalized !== "amount";
    });
    const name = candidateName || (hasHeaderPair ? `Vendor ${vendors.length + 1}` : "");
    if (!name && !hasHeaderPair && !candidateName) continue;

    vendors.push({
      vendorIndex: vendors.length,
      columnIndex: col,
      name: name || `Vendor ${vendors.length + 1}`,
      rateColIndex: col,
      amountColIndex: col + 1,
      subLabel: "",
    });
  }

  const seen = new Map();
  return {
    vendors: vendors.map((vendor) => {
    const key = normalizeForMatch(vendor.name);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    return {
      ...vendor,
      displayName: occurrence > 1 ? `${vendor.name} (Option ${occurrence})` : vendor.name,
      duplicateIndex: occurrence,
    };
    }),
    subProjectName,
  };
};

const candidatePairsForVendor = (row, vendor, offset) => {
  const rateCol = vendor.rateColIndex + offset;
  const amountCol = vendor.amountColIndex + offset;
  if (rateCol < 0 || amountCol < 0) return null;
  return {
    rateCol,
    amountCol,
    rateRaw: row?.[rateCol],
    amountRaw: row?.[amountCol],
  };
};

const scoreDiscountLikeCandidate = ({ rateRaw, amountRaw }, relatedAmount) => {
  const rate = normalizeRate(rateRaw);
  const amount = toNumberOrNull(amountRaw);
  if (rate == null || amount == null || relatedAmount == null) return { pass: false, rate, amount, error: Number.POSITIVE_INFINITY };
  if (rate < 0 || rate > 1.5) return { pass: false, rate, amount, error: Number.POSITIVE_INFINITY };
  const expected = relatedAmount * rate;
  const error = Math.abs(amount - expected);
  const tolerance = Math.max(Math.abs(relatedAmount) * 0.01, 1);
  return { pass: error <= tolerance, rate, amount, error };
};

const readSummaryCellPair = (row, vendor, rowType, relatedAmount, issues, blockIndex) => {
  const offsets = [0, -1, 1];
  let best = null;

  offsets.forEach((offset) => {
    const candidate = candidatePairsForVendor(row, vendor, offset);
    if (!candidate) return;
    const scored = scoreDiscountLikeCandidate(candidate, relatedAmount);
    const candidateResult = {
      rate: scored.rate,
      amount: scored.amount,
      source: offset === 0 ? "primary" : offset === -1 ? "shift-left" : "shift-right",
      pass: scored.pass,
      error: scored.error,
    };
    if (!best || (candidateResult.pass && !best.pass) || (candidateResult.pass === best.pass && candidateResult.error < best.error)) {
      best = candidateResult;
    }
  });

  if (!best || !best.pass) {
    issues.push({
      type: "summary-read",
      blockIndex,
      rowType,
      vendorIndex: vendor.vendorIndex,
      vendorName: vendor.name,
      message: `Could not validate ${rowType} values for ${vendor.name}.`,
    });
  }

  return best || { rate: null, amount: null, source: "unparsed", pass: false, error: null };
};

const readNumericSummaryValue = (row, vendor) => {
  const primary = toNumberOrNull(row?.[vendor.amountColIndex]);
  if (primary != null) return { amount: primary, source: "primary" };
  const left = toNumberOrNull(row?.[vendor.amountColIndex - 1]);
  if (left != null) return { amount: left, source: "shift-left" };
  const right = toNumberOrNull(row?.[vendor.amountColIndex + 1]);
  if (right != null) return { amount: right, source: "shift-right" };
  return { amount: null, source: "unparsed" };
};

const parseSummaryForBlock = (rows, blockStart, blockEnd, vendors, blockIndex) => {
  const summary = {
    subtotal: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, amount: null, source: "unparsed" })),
    discount: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, rate: null, amount: null, source: "unparsed" })),
    netAmount: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, amount: null, source: "unparsed" })),
    gst: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, rate: null, amount: null, source: "unparsed" })),
    totalValue: vendors.map((vendor) => ({ vendorIndex: vendor.vendorIndex, vendorName: vendor.displayName, amount: null, source: "unparsed" })),
  };

  const issues = [];
  const rowIndexByKey = new Map();
  const blankNumericRows = [];

  for (let r = blockStart; r <= blockEnd; r += 1) {
    const row = rows[r] || [];
    const text = rowText(row);
    const normalized = normalizeForMatch(text);
    if (!normalized) {
      const hasNumeric = vendors.some((vendor) => toNumberOrNull(row?.[vendor.amountColIndex]) != null);
      if (hasNumeric) blankNumericRows.push(r);
      continue;
    }

    if (normalized.includes("subtotal")) rowIndexByKey.set("subtotal", r);
    if (normalized.includes("discount")) rowIndexByKey.set("discount", r);
    if (normalized.includes("gst")) rowIndexByKey.set("gst", r);
    if (normalized.includes("net amount")) rowIndexByKey.set("netAmount", r);
    if (normalized.includes("total value")) rowIndexByKey.set("totalValue", r);
  }

  vendors.forEach((vendor, idx) => {
    const subtotalRow = rowIndexByKey.get("subtotal");
    if (subtotalRow != null) {
      const parsed = readNumericSummaryValue(rows[subtotalRow], vendor);
      summary.subtotal[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        amount: parsed.amount,
        source: parsed.source,
      };
    }
  });

  const netAmountRowIdx = rowIndexByKey.get("netAmount");
  if (netAmountRowIdx != null) {
    vendors.forEach((vendor, idx) => {
      const parsed = readNumericSummaryValue(rows[netAmountRowIdx], vendor);
      summary.netAmount[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        amount: parsed.amount,
        source: parsed.source,
      };
    });
  }

  const discountRowIdx = rowIndexByKey.get("discount");
  const gstRowIdx = rowIndexByKey.get("gst");

  vendors.forEach((vendor, idx) => {
    if (discountRowIdx != null) {
      const subtotalAmount = summary.subtotal[idx]?.amount ?? null;
      const parsed = readSummaryCellPair(rows[discountRowIdx], vendor, "discount", subtotalAmount, issues, blockIndex);
      summary.discount[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        rate: parsed.rate,
        amount: parsed.amount,
        source: parsed.source,
      };
    }

    if (summary.netAmount[idx]?.amount == null && summary.subtotal[idx]?.amount != null && discountRowIdx != null) {
      const subtotalAmount = summary.subtotal[idx]?.amount ?? null;
      const discountAmount = summary.discount[idx]?.amount ?? null;
      if (subtotalAmount != null && discountAmount != null) {
        summary.netAmount[idx] = {
          vendorIndex: vendor.vendorIndex,
          vendorName: vendor.displayName,
          amount: subtotalAmount - discountAmount,
          source: "computed",
        };
      }
    }

    if (gstRowIdx != null) {
      const netAmount = summary.netAmount[idx]?.amount ?? null;
      const parsed = readSummaryCellPair(rows[gstRowIdx], vendor, "gst", netAmount, issues, blockIndex);
      summary.gst[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        rate: parsed.rate,
        amount: parsed.amount,
        source: parsed.source,
      };
    }
  });

  if (netAmountRowIdx == null && discountRowIdx != null && gstRowIdx != null) {
    const candidateRow = blankNumericRows.find((r) => r > discountRowIdx && r < gstRowIdx);
    if (candidateRow != null) {
      vendors.forEach((vendor, idx) => {
        const parsed = readNumericSummaryValue(rows[candidateRow], vendor);
        summary.netAmount[idx] = {
          vendorIndex: vendor.vendorIndex,
          vendorName: vendor.displayName,
          amount: parsed.amount,
          source: "positional",
        };
      });
    }
  }

  vendors.forEach((vendor, idx) => {
    const totalRow = rowIndexByKey.get("totalValue");
    if (totalRow != null) {
      const parsed = readNumericSummaryValue(rows[totalRow], vendor);
      summary.totalValue[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        amount: parsed.amount,
        source: parsed.source,
      };
    }
  });

  vendors.forEach((vendor, idx) => {
    const subtotalAmount = summary.subtotal[idx]?.amount ?? null;
    const discountAmount = summary.discount[idx]?.amount ?? null;
    const netAmount = summary.netAmount[idx]?.amount;
    const gstAmount = summary.gst[idx]?.amount ?? null;

    if (summary.netAmount[idx]?.amount == null && subtotalAmount != null && discountAmount != null) {
      summary.netAmount[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        amount: subtotalAmount - discountAmount,
        source: "computed",
      };
    }

    if (summary.totalValue[idx]?.amount == null && netAmount != null && gstAmount != null) {
      summary.totalValue[idx] = {
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        amount: netAmount + gstAmount,
        source: "computed",
      };
    }
  });

  return { summary, issues };
};

const parseItemsForBlock = (rows, blockStart, blockEnd, headerRowIdx, vendors) => {
  const sections = [];
  let currentSection = null;
  let lastItem = null;

  for (let r = headerRowIdx + 1; r <= blockEnd; r += 1) {
    const row = rows[r] || [];
    const srRaw = toTrimmed(row[0]);
    const rowLabel = normalizeForMatch(rowText(row, 5));
    const desc = toTrimmed(row[2] || row[1] || "");

    if (rowLabel && (rowLabel.includes("subtotal") || rowLabel.includes("discount") || rowLabel.includes("gst") || rowLabel.includes("total value"))) {
      break;
    }

    if (isSectionLabel(srRaw)) {
      const vendorBrand = vendors.map((vendor) => toTrimmed(row[vendor.rateColIndex] || row[vendor.amountColIndex] || ""));
      currentSection = {
        sectionLabel: srRaw,
        sectionDescription: desc || "-",
        vendorBrand,
        items: [],
      };
      sections.push(currentSection);
      lastItem = null;
      continue;
    }

    if (isNumericSr(srRaw)) {
      if (!currentSection) {
        currentSection = { sectionLabel: "", sectionDescription: "", vendorBrand: vendors.map(() => ""), items: [] };
        sections.push(currentSection);
      }

      const vendorData = vendors.map((vendor, vendorIndex) => ({
        vendorIndex: vendor.vendorIndex,
        vendorName: vendor.displayName,
        vendorNameRaw: vendor.name,
        vendorBrand: currentSection.vendorBrand?.[vendorIndex] || "",
        rate: toNumberOrNull(row[vendor.rateColIndex]),
        amount: toNumberOrNull(row[vendor.amountColIndex]),
      }));

      const item = {
        srNo: Number(srRaw),
        hsnCode: toTrimmed(row[1]),
        description: desc,
        totalQty: toNumberOrNull(row[3]),
        uom: toTrimmed(row[4]),
        vendorData,
      };
      currentSection.items.push(item);
      lastItem = item;
      continue;
    }

    const continuationText = toTrimmed(row[2] || row[1] || "");
    if (continuationText && lastItem && !isSummaryLabel(continuationText) && !isSectionLabel(srRaw)) {
      lastItem.description = toTrimmed(`${lastItem.description || ""} ${continuationText}`);
    }
  }

  return sections;
};

const parseBlock = (rows, blockStart, blockEnd, blockIndex) => {
  const meta = extractMeta(rows, blockStart);
  const headerRowIdx = findHeaderRowIndex(rows, blockStart, blockEnd);
  const { vendors, subProjectName } = parseVendorColumns(rows, blockStart, headerRowIdx, blockEnd);
  const sections = parseItemsForBlock(rows, blockStart, blockEnd, headerRowIdx, vendors);
  const { summary, issues } = parseSummaryForBlock(rows, blockStart, blockEnd, vendors, blockIndex);

  return {
    blockIndex,
    blockStartRow: blockStart,
    blockEndRow: blockEnd,
    meta,
    subProjectName,
    vendors,
    sections,
    summary,
    issues,
  };
};

export const parseComparisonWorkbook = (workbook) => {
  const matrices = buildWorkbookMatrices(workbook);
  if (matrices.length > 0) {
    const strictBlocks = matrices.map(({ rows, sheetName }, index) => {
      if (!isStrictTemplateSheet(rows)) return null;
      return parseStrictTemplateSheet(rows, sheetName, index);
    });
    if (strictBlocks.every((block) => block != null)) {
      return {
        sheetName: matrices[0]?.sheetName || "",
        blocks: strictBlocks,
      };
    }
  }

  const { rows, sheetName } = buildRowMatrix(workbook);
  const blockStarts = findBlockStarts(rows);
  const starts = blockStarts.length > 0 ? blockStarts : [0];

  const blocks = starts.map((start, index) => {
    const nextStart = starts[index + 1];
    const end = nextStart != null ? nextStart - 1 : rows.length - 1;
    return parseBlock(rows, start, end, index);
  });

  return {
    sheetName,
    blocks,
  };
};

export const parseComparisonFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  return parseComparisonWorkbook(workbook);
};
