import React from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { resolveProjectNumericId } from "@/lib/resolveProjectId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import "luckysheet/dist/plugins/css/pluginsCss.css";
import "luckysheet/dist/plugins/plugins.css";
import "luckysheet/dist/css/luckysheet.css";
import "luckysheet/dist/assets/iconfont/iconfont.css";

const isPlainObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

const sanitizeSheetName = (rawName, usedNames) => {
  const base = String(rawName || "Sheet")
    .trim()
    .replace(/[\[\]\*\/\\\?\:]/g, "_")
    .replace(/^'+|'+$/g, "")
    .slice(0, 31) || "Sheet";

  let name = base;
  let counter = 2;
  while (usedNames.has(name)) {
    const suffix = `_${counter}`;
    name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    counter += 1;
  }
  usedNames.add(name);
  return name;
};

const inferCellType = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return "n";
  if (typeof value === "boolean") return "b";
  if (value == null) return "g";
  return "g";
};

const toLuckyCell = (value) => {
  const t = inferCellType(value);
  if (value == null) {
    return { m: "", v: null, ct: { fa: "General", t: "g" } };
  }
  return { m: String(value), v: value, ct: { fa: "General", t } };
};

const toLuckyFormulaCell = (formula, value = null) => {
  const normalized = String(formula || "").trim();
  const f = normalized.startsWith("=") ? normalized : `=${normalized}`;
  const normalizedValue = value == null ? "" : value;
  const hasTypedValue = normalizedValue !== "";
  return {
    m: String(normalizedValue),
    v: normalizedValue,
    f,
    ct: { fa: "General", t: hasTypedValue && typeof normalizedValue === "number" ? "n" : "g" },
  };
};

const safeStringify = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const flattenRecord = (record, { maxDepth = 2, excludeKeys = new Set(), prefix = "" } = {}, depth = 0, out = {}) => {
  if (!isPlainObject(record)) return out;

  Object.keys(record).forEach((key) => {
    if (excludeKeys.has(key)) return;
    const nextKey = prefix ? `${prefix}.${key}` : key;
    const value = record[key];

    if (value == null) {
      out[nextKey] = null;
      return;
    }

    if (isPlainObject(value) && depth < maxDepth) {
      flattenRecord(value, { maxDepth, excludeKeys, prefix: nextKey }, depth + 1, out);
      return;
    }

    if (Array.isArray(value)) {
      out[nextKey] = safeStringify(value);
      return;
    }

    out[nextKey] = value;
  });

  return out;
};

const orderedHeadersFromRows = (rows) => {
  const headers = [];
  const seen = new Set();
  rows.forEach((row) => {
    if (!isPlainObject(row)) return;
    Object.keys(row).forEach((k) => {
      if (seen.has(k)) return;
      seen.add(k);
      headers.push(k);
    });
  });
  return headers;
};

const rowsToMatrix = (rows) => {
  const safeRows = Array.isArray(rows) ? rows.filter((r) => r != null) : [];
  if (safeRows.length === 0) return [["No data"]];

  const normalizedRows = safeRows.map((row) => (isPlainObject(row) ? row : { value: row }));
  const headers = orderedHeadersFromRows(normalizedRows);
  return [headers, ...normalizedRows.map((row) => headers.map((h) => row[h] ?? null))];
};

const firstColumnFormulaRef = (sheetName) => `=${sheetName}!A2`;

const countRowsFormula = (sheetName) => `=MAX(0, COUNTA(${sheetName}!A:A)-1)`;

const buildWorkbookSheetMatrices = (workbookData) => {
  const usedNames = new Set();
  const matrices = new Map();
  const rawNamesSeen = new Set();

  const addSheet = (rawName, rows) => {
    if (rawNamesSeen.has(rawName)) return null;
    rawNamesSeen.add(rawName);
    const name = sanitizeSheetName(rawName, usedNames);
    matrices.set(name, rowsToMatrix(rows));
    return name;
  };

  const itemTabs = normalizeToArray(workbookData?.ItemTabs)
    .filter((t) => isPlainObject(t) && typeof t.name === "string" && Array.isArray(t.matrix))
    .map((t) => [t.name, t.matrix]);

  const moduleOrder = [
    ["WO", workbookData?.BOQ],
    ["Inv", workbookData?.Invoice],
    ["Abstract", workbookData?.Abstract],
    ["QTY", workbookData?.QTY],
    ["CPVC", workbookData?.CPVC],
    ...itemTabs,
  ];

  moduleOrder.forEach(([name, dataset]) => {
    if (dataset == null) return;
    if (rawNamesSeen.has(name)) return;
    if (Array.isArray(dataset) && Array.isArray(dataset[0])) {
      rawNamesSeen.add(name);
      const sheetName = sanitizeSheetName(name, usedNames);
      matrices.set(sheetName, dataset);
      return;
    }
    if (Array.isArray(dataset)) {
      const rows = dataset.map((row) => (isPlainObject(row) ? flattenRecord(row) : { value: row }));
      addSheet(name, rows);
      return;
    }
    if (isPlainObject(dataset)) {
      addSheet(name, [flattenRecord(dataset)]);
      return;
    }
    addSheet(name, [{ value: dataset }]);
  });

  return Array.from(matrices.entries()).map(([name, matrix]) => ({ name, matrix }));
};

const matrixToLuckySheet = (name, matrix, sheetIndex) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const rowCount = Math.max(36, safeMatrix.length + 10);
  const colCount = Math.max(18, Math.max(1, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1))) + 5);

  const celldata = [];
  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [safeMatrix[r]];
    for (let c = 0; c < row.length; c += 1) {
      const raw = row[c];
      if (raw == null) continue;

      if (isPlainObject(raw) && raw.__formula) {
        celldata.push({ r, c, v: toLuckyFormulaCell(raw.__formula, raw.__value ?? null) });
        continue;
      }

      celldata.push({ r, c, v: toLuckyCell(raw) });
    }
  }

  return {
    name,
    index: String(sheetIndex),
    status: sheetIndex === 0 ? 1 : 0,
    order: sheetIndex,
    row: rowCount,
    column: colCount,
    celldata,
    config: {},
  };
};

const applyBoqSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(6, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(40, safeMatrix.length + 10);

  const merge = {};
  merge["0_0"] = { r: 0, c: 0, rs: 1, cs: width };
  merge["1_0"] = { r: 1, c: 0, rs: 1, cs: width };

  for (let r = 2; r < safeMatrix.length; r += 1) {
    const row = safeMatrix[r];
    if (!Array.isArray(row)) continue;
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = [2, 3, 4, 5].every((idx) => String(row[idx] ?? "").trim() === "");
    if (/^[A-Z]\.?$/.test(sr) && desc && restEmpty) {
      merge[`${r}_1`] = { r, c: 1, rs: 1, cs: Math.max(1, width - 1) };
    }
  }

  const columnlen = { 0: 70, 1: 720, 2: 80, 3: 80, 4: 100, 5: 120 };
  const rowlen = { 0: 30, 1: 24 };
  for (let r = 2; r < safeMatrix.length; r += 1) {
    const row = safeMatrix[r];
    if (!Array.isArray(row)) continue;
    const isHeader =
      (String(row[0] ?? "") === "SR NO." && String(row[1] ?? "") === "ITEM DESCRIPTION") ||
      (String(row[0] ?? "") === "WO SR NO" && String(row[1] ?? "") === "SERVICE DESCRIPTION");
    if (isHeader) {
      rowlen[r] = 24;
      continue;
    }
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = [2, 3, 4, 5].every((idx) => String(row[idx] ?? "").trim() === "");
    if (/^[A-Z]\.?$/.test(sr) && desc && restEmpty) {
      rowlen[r] = 28;
      continue;
    }
    const lineCount = String(desc).split("\n").filter(Boolean).length || 1;
    const lines = Math.min(3, Math.max(1, lineCount));
    rowlen[r] = 18 * lines + 8;
  }
  sheet.config = {
    ...sheet.config,
    merge,
    columnlen,
    rowlen,
  };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const patchCell = (r, c, patch) => {
    const entry = cellMap.get(`${r}_${c}`);
    if (!entry || !entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  patchCell(0, 0, { bl: 1, fs: 16, ht: 1, vt: 1 });
  patchCell(1, 0, { bl: 1, fs: 12, ht: 0, vt: 1 });

  for (let r = 2; r < safeMatrix.length; r += 1) {
    const row = safeMatrix[r];
    if (!Array.isArray(row)) continue;
    const isHeader =
      (String(row[0] ?? "") === "SR NO." && String(row[1] ?? "") === "ITEM DESCRIPTION") ||
      (String(row[0] ?? "") === "WO SR NO" && String(row[1] ?? "") === "SERVICE DESCRIPTION");
    if (isHeader) {
      for (let c = 0; c < width; c += 1) {
        patchCell(r, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      }
      continue;
    }
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = [2, 3, 4, 5].every((idx) => String(row[idx] ?? "").trim() === "");
    if (/^[A-Z]\.?$/.test(sr) && desc && restEmpty) {
      patchCell(r, 0, { bl: 1, bg: "#dbeafe", fc: "#1d4ed8", ht: 1, vt: 1 });
      patchCell(r, 1, { bl: 1, bg: "#dbeafe", fc: "#1d4ed8", ht: 0, vt: 1, tb: 2 });
      continue;
    }
    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    patchCell(r, 2, { ht: 1, vt: 1 });
    patchCell(r, 3, { ht: 2, vt: 1 });
    patchCell(r, 4, { ht: 2, vt: 1 });
    patchCell(r, 5, { ht: 2, vt: 1 });
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const lastRow = Math.max(0, safeMatrix.length - 1);
  const lastCol = Math.max(0, width - 1);

  for (let r = 0; r <= lastRow; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const isHeaderRow =
      (String(row[0] ?? "") === "SR NO." && String(row[1] ?? "") === "ITEM DESCRIPTION") ||
      (String(row[0] ?? "") === "WO SR NO" && String(row[1] ?? "") === "SERVICE DESCRIPTION");
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = [2, 3, 4, 5].every((idx) => String(row[idx] ?? "").trim() === "");
    const isSectionRow = /^[A-Z]\.?$/.test(sr) && desc && restEmpty;

    for (let c = 0; c <= lastCol; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      const bd = {
        t: r === 0 || isHeaderRow || isSectionRow ? thick : thin,
        b: r === lastRow || isHeaderRow || isSectionRow ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === lastCol ? thick : thin,
      };
      entry.v.bd = bd;
    }
  }

  return sheet;
};

const applySamplesSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(12, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(60, safeMatrix.length + 10);

  const merge = {};
  const columnlen = {
    0: 60,
    1: 650,
    2: 70,
    3: 70,
    4: 90,
    5: 110,
    6: 90,
    7: 90,
    8: 90,
    9: 110,
    10: 110,
    11: 110,
  };
  const rowlen = {};

  safeMatrix.forEach((row, r) => {
    if (!Array.isArray(row)) return;
    const isSingleLine = String(row[0] ?? "").trim() && row.slice(1).every((c) => String(c ?? "").trim() === "");
    if (isSingleLine) {
      merge[`${r}_0`] = { r, c: 0, rs: 1, cs: width };
      rowlen[r] = 26;
      return;
    }

    const isMultiHeaderTop =
      String(row[0] ?? "") === "Sl No" &&
      String(row[1] ?? "") === "Description" &&
      String(row[4] ?? "") === "BOQ" &&
      String(row[6] ?? "") === "Quantity" &&
      String(row[9] ?? "") === "Amount";

    if (isMultiHeaderTop) {
      merge[`${r}_0`] = { r, c: 0, rs: 2, cs: 1 };
      merge[`${r}_1`] = { r, c: 1, rs: 2, cs: 1 };
      merge[`${r}_2`] = { r, c: 2, rs: 2, cs: 1 };
      merge[`${r}_3`] = { r, c: 3, rs: 2, cs: 1 };
      merge[`${r}_4`] = { r, c: 4, rs: 1, cs: 2 };
      merge[`${r}_6`] = { r, c: 6, rs: 1, cs: 3 };
      merge[`${r}_9`] = { r, c: 9, rs: 1, cs: 3 };
      rowlen[r] = 24;
      rowlen[r + 1] = 22;
      return;
    }

    const desc = String(row[1] ?? "");
    const lineCount = desc.split("\n").filter(Boolean).length || 1;
    const lines = Math.min(3, Math.max(1, lineCount));
    rowlen[r] = 18 * lines + 8;
  });

  sheet.config = {
    ...sheet.config,
    merge,
    columnlen,
    rowlen,
  };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const patchCell = (r, c, patch) => {
    const entry = cellMap.get(`${r}_${c}`);
    if (!entry || !entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = safeMatrix[r];
    if (!Array.isArray(row)) continue;

    const isSingleLine = String(row[0] ?? "").trim() && row.slice(1).every((c) => String(c ?? "").trim() === "");
    if (isSingleLine) {
      const value = String(row[0] ?? "");
      if (value.startsWith("Sample -")) {
        patchCell(r, 0, { bl: 1, bg: "#dbeafe", fc: "#1d4ed8", ht: 1, vt: 1 });
      } else if (value === "ABSTRACT SHEET") {
        patchCell(r, 0, { bl: 1, fs: 12, ht: 1, vt: 1 });
      } else {
        patchCell(r, 0, { bl: 1, ht: 0, vt: 1 });
      }
      continue;
    }

    const isMultiHeaderTop =
      String(row[0] ?? "") === "Sl No" &&
      String(row[1] ?? "") === "Description" &&
      String(row[4] ?? "") === "BOQ" &&
      String(row[6] ?? "") === "Quantity" &&
      String(row[9] ?? "") === "Amount";
    if (isMultiHeaderTop) {
      for (let c = 0; c < width; c += 1) patchCell(r, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      for (let c = 0; c < width; c += 1) patchCell(r + 1, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      continue;
    }

    patchCell(r, 1, { tb: 2, vt: 1 });
    for (const c of [3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      patchCell(r, c, { ht: 2, vt: 1 });
    }
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const lastRow = Math.max(0, safeMatrix.length - 1);
  const lastCol = Math.max(0, width - 1);
  const groupRight = new Set([3, 5, 8, 11]);
  const groupLeft = new Set([4, 6, 9]);

  for (let r = 0; r <= lastRow; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const isSingleLine = String(row[0] ?? "").trim() && row.slice(1).every((c) => String(c ?? "").trim() === "");
    const isMultiHeaderTop =
      String(row[0] ?? "") === "Sl No" &&
      String(row[1] ?? "") === "Description" &&
      String(row[4] ?? "") === "BOQ" &&
      String(row[6] ?? "") === "Quantity" &&
      String(row[9] ?? "") === "Amount";
    const isMultiHeaderSecond =
      String(row[4] ?? "") === "Rate" &&
      String(row[5] ?? "") === "Amount" &&
      String(row[6] ?? "") === "Previous" &&
      String(row[7] ?? "") === "Present" &&
      String(row[8] ?? "") === "Total" &&
      String(row[9] ?? "") === "Previous" &&
      String(row[10] ?? "") === "Present" &&
      String(row[11] ?? "") === "Total";

    for (let c = 0; c <= lastCol; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;

      const topThick = r === 0 || isMultiHeaderTop || (isSingleLine && String(row[0] ?? "").startsWith("Sample -"));
      const bottomThick = r === lastRow || isMultiHeaderSecond;

      const bd = {
        t: topThick ? thick : thin,
        b: bottomThick ? thick : thin,
        l: c === 0 || groupLeft.has(c) ? thick : thin,
        r: c === lastCol || groupRight.has(c) ? thick : thin,
      };
      entry.v.bd = bd;
    }
  }

  return sheet;
};

const applyInvoiceSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = 9;
  sheet.column = width;
  sheet.row = Math.max(50, safeMatrix.length + 10);

  const merge = {};
  merge["0_0"] = { r: 0, c: 0, rs: 1, cs: width };
  merge["1_0"] = { r: 1, c: 0, rs: 1, cs: width };
  merge["3_0"] = { r: 3, c: 0, rs: 1, cs: width };
  merge["4_0"] = { r: 4, c: 0, rs: 1, cs: width };
  merge["6_0"] = { r: 6, c: 0, rs: 1, cs: 3 };
  merge["6_3"] = { r: 6, c: 3, rs: 1, cs: 4 };
  merge["6_7"] = { r: 6, c: 7, rs: 1, cs: 2 };
  merge["9_0"] = { r: 9, c: 0, rs: 1, cs: width };

  for (let r = 10; r <= 13; r += 1) {
    merge[`${r}_0`] = { r, c: 0, rs: 1, cs: 1 };
    merge[`${r}_1`] = { r, c: 1, rs: 1, cs: 3 };
    merge[`${r}_4`] = { r, c: 4, rs: 1, cs: 2 };
    merge[`${r}_6`] = { r, c: 6, rs: 1, cs: 3 };
  }

  merge["15_0"] = { r: 15, c: 0, rs: 1, cs: 4 };
  merge["15_4"] = { r: 15, c: 4, rs: 1, cs: 5 };

  for (let r = 16; r <= 20; r += 1) {
    merge[`${r}_0`] = { r, c: 0, rs: 1, cs: 1 };
    merge[`${r}_1`] = { r, c: 1, rs: 1, cs: 3 };
    merge[`${r}_4`] = { r, c: 4, rs: 1, cs: 1 };
    merge[`${r}_5`] = { r, c: 5, rs: 1, cs: 4 };
  }

  merge["21_0"] = { r: 21, c: 0, rs: 1, cs: 2 };
  merge["21_2"] = { r: 21, c: 2, rs: 1, cs: 2 };
  merge["21_4"] = { r: 21, c: 4, rs: 1, cs: 5 };

  merge["23_0"] = { r: 23, c: 0, rs: 1, cs: width };

  merge["31_0"] = { r: 31, c: 0, rs: 1, cs: 3 };

  for (let r = 32; r <= 38; r += 1) {
    merge[`${r}_0`] = { r, c: 0, rs: 1, cs: 4 };
    merge[`${r}_4`] = { r, c: 4, rs: 1, cs: 4 };
    merge[`${r}_8`] = { r, c: 8, rs: 1, cs: 1 };
  }

  merge["39_0"] = { r: 39, c: 0, rs: 1, cs: 2 };
  merge["39_4"] = { r: 39, c: 4, rs: 1, cs: 5 };
  merge["40_0"] = { r: 40, c: 0, rs: 1, cs: 4 };
  merge["40_4"] = { r: 40, c: 4, rs: 1, cs: 5 };
  merge["41_0"] = { r: 41, c: 0, rs: 1, cs: 4 };
  merge["41_4"] = { r: 41, c: 4, rs: 1, cs: 5 };

  const columnlen = {
    0: 100,
    1: 200,
    2: 80,
    3: 100,
    4: 90,
    5: 100,
    6: 60,
    7: 80,
    8: 100,
  };

  const rowlen = {
    0: 40,
    1: 22,
    3: 18,
    4: 16,
    6: 20,
    9: 30,
    15: 22,
    21: 22,
    22: 20,
    24: 22,
    25: 20,
    26: 40,
    31: 26,
    38: 20,
    40: 20,
  };

  sheet.config = {
    ...sheet.config,
    merge,
    columnlen,
    rowlen,
  };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  // Center-align everything in the invoice sheet by default.
  // Luckysheet alignment codes: `ht: 1` = center, `ht: 2` = right.
  patchCell(0, 0, { bl: 1, fs: 20, ht: 1, vt: 1 });
  patchCell(6, 0, { bl: 1, fs: 10 });
  patchCell(6, 3, { bl: 1, fs: 10 });
  patchCell(6, 7, { bl: 1, fs: 10, ht: 1, vt: 1 });
  patchCell(9, 0, { bl: 1, fs: 14, ht: 1, vt: 1 });
  patchCell(15, 0, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  patchCell(15, 4, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  for (let c = 0; c < width; c += 1) patchCell(21, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  for (let c = 0; c < width; c += 1) {
    patchCell(24, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
    patchCell(25, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }
  patchCell(26, 1, { tb: 2, ht: 1, vt: 1 });
  for (let c = 0; c < width; c += 1) patchCell(31, c, { bl: 1 });
  patchCell(39, 0, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  const lastRow = Math.max(0, safeMatrix.length - 1);
  const lastCol = width - 1;

  for (let r = 0; r <= lastRow; r += 1) {
    for (let c = 0; c <= lastCol; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.ht = 1;
      entry.v.vt = 1;
      const isTop = r === 0;
      const isBottom = r === lastRow;
      const isLeft = c === 0;
      const isRight = c === lastCol;

      const isHeaderSection = r === 6;
      const isTaxInvoice = r === 9;
      const isBillToParty = r === 15;
      const isTableHeader = r === 24;
      const isTotal = r === 31;
      const isSummaryStart = r === 32;
      const isBankDetails = r === 39;

      const topBorder = (isTop || isTaxInvoice || isBillToParty || isTableHeader || isSummaryStart || isBankDetails) ? thick : thin;
      const bottomBorder = (isBottom || isHeaderSection || isTaxInvoice || r === 13 || isBillToParty || r === 20 || isTableHeader || r === 25 || isTotal || r === 38 || r === 41) ? thick : thin;

      entry.v.bd = {
        t: topBorder,
        b: bottomBorder,
        l: isLeft ? thick : thin,
        r: isRight ? thick : thin,
      };
    }
  }

  for (let r = 15; r <= 21; r += 1) {
    const entry = ensureCell(r, 4);
    if (entry.v && typeof entry.v === "object") {
      entry.v.bd = { ...entry.v.bd, l: thick };
    }
  }

  for (let r = 32; r <= 38; r += 1) {
    const entry = ensureCell(r, 4);
    if (entry.v && typeof entry.v === "object") {
      entry.v.bd = { ...entry.v.bd, l: thick };
    }
    const entry2 = ensureCell(r, 8);
    if (entry2.v && typeof entry2.v === "object") {
      entry2.v.bd = { ...entry2.v.bd, l: thick };
    }
  }

  return sheet;
};

const applyCpvcSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = 28;
  sheet.column = Math.max(width, sheet.column || 0);
  sheet.row = Math.max(250, safeMatrix.length + 80);

  const merge = {};
  merge["0_0"] = { r: 0, c: 0, rs: 1, cs: 14 };
  merge["0_14"] = { r: 0, c: 14, rs: 1, cs: 14 };
  merge["1_0"] = { r: 1, c: 0, rs: 1, cs: 14 };
  merge["1_14"] = { r: 1, c: 14, rs: 1, cs: 14 };
  merge["2_0"] = { r: 2, c: 0, rs: 1, cs: width };
  merge["3_0"] = { r: 3, c: 0, rs: 1, cs: width };

  merge["5_0"] = { r: 5, c: 0, rs: 2, cs: 1 };
  merge["5_1"] = { r: 5, c: 1, rs: 2, cs: 1 };
  for (let i = 0; i < 8; i += 1) {
    merge[`5_${2 + i * 3}`] = { r: 5, c: 2 + i * 3, rs: 1, cs: 3 };
  }
  merge["5_26"] = { r: 5, c: 26, rs: 2, cs: 1 };
  merge["5_27"] = { r: 5, c: 27, rs: 2, cs: 1 };

  const totalRowIdx = safeMatrix.findIndex((row) => Array.isArray(row) && String(row[0] ?? "").trim() === "TOTAL");
  if (totalRowIdx >= 0) {
    merge[`${totalRowIdx}_0`] = { r: totalRowIdx, c: 0, rs: 1, cs: 2 };
  }

  const columnlen = { 0: 50, 1: 90, 26: 80, 27: 90 };
  for (let c = 2; c <= 25; c += 1) columnlen[c] = 55;

  const rowlen = { 0: 20, 1: 20, 2: 24, 3: 20, 5: 22, 6: 20 };
  for (let r = 7; r < safeMatrix.length; r += 1) rowlen[r] = 18;
  if (totalRowIdx >= 0) rowlen[totalRowIdx] = 22;

  sheet.config = {
    ...sheet.config,
    merge,
    columnlen,
    rowlen,
  };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  patchCell(2, 0, { bl: 1, fs: 11, ht: 1, vt: 1 });
  patchCell(3, 0, { bl: 1, fs: 10, ht: 1, vt: 1, fc: "#1d4ed8" });

  for (let c = 0; c < width; c += 1) {
    patchCell(5, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
    patchCell(6, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  const tableStartRow = 5;
  const tableEndRow = totalRowIdx >= 0 ? totalRowIdx : Math.max(tableStartRow + 2, safeMatrix.length - 1);
  const groupLeft = new Set([0, 1, 2, 5, 8, 11, 14, 17, 20, 23, 26, 27]);
  const groupRight = new Set([0, 1, 4, 7, 10, 13, 16, 19, 22, 25, 26, 27]);

  for (let r = tableStartRow; r <= tableEndRow; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === tableStartRow ? thick : thin,
        b: r === tableEndRow ? thick : thin,
        l: groupLeft.has(c) ? thick : thin,
        r: groupRight.has(c) ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyQtySheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = 4;
  sheet.column = Math.max(width, sheet.column || 0);
  sheet.row = Math.max(80, safeMatrix.length + 40);

  const merge = {};
  const columnlen = { 0: 420, 1: 80, 2: 110, 3: 110 };
  const rowlen = {};

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const isChallanRow = String(row[0] ?? "").toUpperCase().startsWith("CHALLAN NO");
    const isHeaderRow = String(row[1] ?? "") === "QTY" && String(row[2] ?? "") === "PER PC MTR" && String(row[3] ?? "") === "TOT QTY";
    if (isChallanRow) {
      merge[`${r}_0`] = { r, c: 0, rs: 1, cs: width };
      rowlen[r] = 22;
      continue;
    }
    if (isHeaderRow) {
      rowlen[r] = 22;
      continue;
    }
    rowlen[r] = 18;
  }

  sheet.config = {
    ...sheet.config,
    merge,
    columnlen,
    rowlen,
  };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const isChallanRow = String(row[0] ?? "").toUpperCase().startsWith("CHALLAN NO");
    const isHeaderRow = String(row[1] ?? "") === "QTY" && String(row[2] ?? "") === "PER PC MTR" && String(row[3] ?? "") === "TOT QTY";
    if (isChallanRow) {
      patchCell(r, 0, { bl: 1, bg: "#fef08a", ht: 0, vt: 1 });
      continue;
    }
    if (isHeaderRow) {
      for (let c = 0; c < width; c += 1) patchCell(r, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      continue;
    }
    patchCell(r, 0, { ht: 0, vt: 1, tb: 2 });
    patchCell(r, 1, { ht: 2, vt: 1 });
    patchCell(r, 2, { ht: 2, vt: 1 });
    patchCell(r, 3, { ht: 2, vt: 1 });
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  const lastRow = Math.max(0, safeMatrix.length - 1);
  const lastCol = width - 1;

  for (let r = 0; r <= lastRow; r += 1) {
    for (let c = 0; c <= lastCol; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 0 ? thick : thin,
        b: r === lastRow ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === lastCol ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyAbstractSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = 36;
  sheet.column = Math.max(width, sheet.column || 0);
  sheet.row = Math.max(250, safeMatrix.length + 80);

  const merge = {};
  const rowlen = {};
  const columnlen = { 0: 55, 1: 90, 34: 70, 35: 90 };
  for (let c = 2; c <= 33; c += 1) columnlen[c] = 48;

  const isSingleLineRow = (row) => Array.isArray(row) && String(row[0] ?? "").trim() && row.slice(1).every((c) => String(c ?? "").trim() === "");

  const tableHeaderStarts = [];
  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const isTableHeader = String(row[0] ?? "") === "Sl No" && String(row[1] ?? "") === "Floor" && String(row[2] ?? "").startsWith("FLAT NO");
    if (isTableHeader) tableHeaderStarts.push(r);
  }

  tableHeaderStarts.forEach((startRow) => {
    merge[`${startRow}_0`] = { r: startRow, c: 0, rs: 2, cs: 1 };
    merge[`${startRow}_1`] = { r: startRow, c: 1, rs: 2, cs: 1 };
    for (let i = 0; i < 8; i += 1) {
      merge[`${startRow}_${2 + i * 4}`] = { r: startRow, c: 2 + i * 4, rs: 1, cs: 4 };
    }
    merge[`${startRow}_34`] = { r: startRow, c: 34, rs: 2, cs: 1 };
    merge[`${startRow}_35`] = { r: startRow, c: 35, rs: 2, cs: 1 };
  });

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    if (isSingleLineRow(row)) {
      merge[`${r}_0`] = { r, c: 0, rs: 1, cs: width };
      rowlen[r] = String(row[0] ?? "").startsWith("WORK ORDER SERIAL NO") ? 22 : 20;
      continue;
    }
    rowlen[r] = rowlen[r] ?? 18;
  }

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    if (isSingleLineRow(row)) {
      const v = String(row[0] ?? "");
      if (v.startsWith("WORK ORDER SERIAL NO")) {
        patchCell(r, 0, { bl: 1, bg: "#dbeafe", fc: "#1d4ed8", ht: 1, vt: 1 });
      } else if (v === "Installation Abstract") {
        patchCell(r, 0, { bl: 1, fs: 11, ht: 1, vt: 1 });
      } else {
        patchCell(r, 0, { bl: 1, ht: 0, vt: 1 });
      }
      continue;
    }
    const isTableHeader = String(row[0] ?? "") === "Sl No" && String(row[1] ?? "") === "Floor";
    if (isTableHeader || (String(row[2] ?? "") === "CT" && String(row[3] ?? "") === "MT")) {
      for (let c = 0; c < width; c += 1) patchCell(r, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      continue;
    }
    patchCell(r, 1, { vt: 1 });
    patchCell(r, 34, { ht: 2, vt: 1 });
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };
  const groupLeft = new Set([0, 1, 2, 6, 10, 14, 18, 22, 26, 30, 34, 35]);
  const groupRight = new Set([0, 1, 5, 9, 13, 17, 21, 25, 29, 33, 34, 35]);

  tableHeaderStarts.forEach((startRow) => {
    const tableEnd = (() => {
      for (let r = startRow + 2; r < safeMatrix.length; r += 1) {
        const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
        if (String(row[0] ?? "").trim() === "TOTAL") return r;
      }
      return Math.min(safeMatrix.length - 1, startRow + 2 + 30);
    })();

    for (let r = startRow; r <= tableEnd; r += 1) {
      for (let c = 0; c < width; c += 1) {
        const entry = ensureCell(r, c);
        if (!entry.v || typeof entry.v !== "object") continue;
        entry.v.bd = {
          t: r === startRow ? thick : thin,
          b: r === tableEnd ? thick : thin,
          l: groupLeft.has(c) ? thick : thin,
          r: groupRight.has(c) ? thick : thin,
        };
      }
    }
  });

  return sheet;
};

const applyChecklistSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(18, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(90, safeMatrix.length + 6);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "3_7": { r: 3, c: 7, rs: 1, cs: 3 },
    "6_2": { r: 6, c: 2, rs: 1, cs: 8 },
    "6_10": { r: 6, c: 10, rs: 1, cs: 8 },
    "31_2": { r: 31, c: 2, rs: 1, cs: 7 },
    "80_0": { r: 80, c: 0, rs: 2, cs: 1 },
    "80_1": { r: 80, c: 1, rs: 2, cs: 1 },
  };

  const columnlen = {
    0: 77,
    1: 828,
    2: 24,
    3: 26,
    4: 26,
    5: 26,
    6: 26,
    7: 26,
    8: 23,
    9: 163,
    10: 26,
    11: 31,
    12: 18,
    13: 30,
    14: 15,
    15: 28,
    16: 28,
    17: 137,
  };

  const rowlen = {
    1: 15,
    5: 15,
    6: 15,
    7: 15,
    25: 29,
    29: 29,
    35: 29,
    67: 29,
    73: 29,
    81: 15,
    86: 15,
  };

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { ht: 1, vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, fs: 14, ht: 1, vt: 1 });

  [2, 3, 4, 5].forEach((r) => {
    patchCell(r, 0, { bl: 1, vt: 1 });
    patchCell(r, 2, { bl: 1, vt: 1 });
    patchCell(r, 7, { bl: 1, ht: 1, vt: 1 });
    patchCell(r, 9, { bl: 1, ht: 1, vt: 1 });
  });

  [6, 7].forEach((r) => {
    for (let c = 0; c < width; c += 1) patchCell(r, c, { bl: 1, ht: 1, vt: 1, bg: "#f6f8fb" });
  });
  patchCell(6, 2, { ht: 1, vt: 1 });
  patchCell(6, 10, { ht: 1, vt: 1 });

  const sectionRows = new Set([9, 11, 33, 39, 47, 53]);
  const subsectionRows = new Set([13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 35, 37, 41, 43, 45, 49, 51, 55, 57, 59, 61, 63, 65, 67, 69, 71, 73, 75, 77]);

  for (let r = 8; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const first = String(row[0] ?? "").trim();
    const second = String(row[1] ?? "").trim();

    if (r === 8) {
      for (let c = 0; c < width; c += 1) patchCell(r, c, { bl: 1, bg: "#e8edf5", ht: 1, vt: 1, tb: 2 });
      continue;
    }

    if (sectionRows.has(r)) {
      patchCell(r, 0, { bl: 1, bg: "#dbeafe", fc: "#1d4ed8", ht: 1, vt: 1 });
      patchCell(r, 1, { bl: 1, bg: "#dbeafe", fc: "#1d4ed8", ht: 1, vt: 1 });
      continue;
    }

    if (subsectionRows.has(r)) {
      patchCell(r, 0, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      patchCell(r, 1, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
      continue;
    }

    if (first || second) {
      patchCell(r, 0, { ht: 1, vt: 1 });
      patchCell(r, 1, { ht: 1, vt: 1, tb: 2 });
      [3, 5, 7, 11, 13, 15].forEach((c) => patchCell(r, c, { ht: 1, vt: 1 }));
      [9, 17].forEach((c) => patchCell(r, c, { ht: 1, vt: 1, tb: 2 }));
    }
  }

  [79, 80, 84, 85].forEach((r) => {
    patchCell(r, 1, { bl: 1, vt: 1 });
  });

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };
  const leftHeavy = new Set([0, 1, 3, 5, 7, 9, 11, 13, 15, 17]);
  const rightHeavy = new Set([0, 1, 4, 6, 8, 10, 12, 14, 16, 17]);
  const checklistBoxColumns = new Set([3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16]);

  for (let r = 7; r <= 85; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      const isChecklistBox = checklistBoxColumns.has(c);
      entry.v.bd = {
        t: r === 7 || sectionRows.has(r) || subsectionRows.has(r) || isChecklistBox ? thick : thin,
        b: r === 85 || isChecklistBox ? thick : thin,
        l: leftHeavy.has(c) || isChecklistBox ? thick : thin,
        r: rightHeavy.has(c) || isChecklistBox ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyCummBoqSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(14, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(140, safeMatrix.length + 10);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "1_2": { r: 1, c: 2, rs: 5, cs: 6 },
    "2_0": { r: 2, c: 0, rs: 2, cs: 2 },
    "2_8": { r: 2, c: 8, rs: 2, cs: 6 },
    "4_0": { r: 4, c: 0, rs: 1, cs: 2 },
    "4_8": { r: 4, c: 8, rs: 1, cs: 3 },
    "4_11": { r: 4, c: 11, rs: 1, cs: 3 },
    "5_0": { r: 5, c: 0, rs: 1, cs: 2 },
    "5_8": { r: 5, c: 8, rs: 1, cs: 3 },
    "5_11": { r: 5, c: 11, rs: 1, cs: 3 },
    "6_0": { r: 6, c: 0, rs: 2, cs: 1 },
    "6_1": { r: 6, c: 1, rs: 2, cs: 1 },
    "6_2": { r: 6, c: 2, rs: 2, cs: 1 },
    "6_3": { r: 6, c: 3, rs: 1, cs: 3 },
    "6_6": { r: 6, c: 6, rs: 1, cs: 3 },
    "6_11": { r: 6, c: 11, rs: 1, cs: 3 },
  };

  const columnlen = {
    0: 70,
    1: 412,
    2: 102,
    3: 70,
    4: 70,
    5: 106,
    6: 70,
    7: 70,
    8: 94,
    9: 70,
    10: 106,
    11: 104,
    12: 104,
    13: 104,
  };

  const rowlen = { 0: 22, 6: 22, 7: 20 };
  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { ht: 1, vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, fs: 14, ht: 1, vt: 1 });
  [1, 2, 4, 5].forEach((r) => {
    [0, 2, 8, 11].forEach((c) => patchCell(r, c, { bl: 1, ht: 1, vt: 1 }));
  });

  for (let c = 0; c < width; c += 1) {
    patchCell(6, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
    patchCell(7, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  for (let r = 8; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();

    if (!sr && desc && row.slice(2).every((cell) => String(cell ?? "").trim() === "")) {
      patchCell(r, 1, { bl: 1, bg: "#e2efda", ht: 1, vt: 1 });
      continue;
    }

    if (sr && desc) {
      patchCell(r, 0, { bl: 1, bg: "#fff2cc", ht: 1, vt: 1 });
      patchCell(r, 1, { vt: 1 });
    }
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };
  for (let r = 6; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 6 || r === 7 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyChallanSummarySheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(14, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(120, safeMatrix.length + 12);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "1_0": { r: 1, c: 0, rs: 1, cs: width },
    "2_0": { r: 2, c: 0, rs: 1, cs: width },
    "3_0": { r: 3, c: 0, rs: 1, cs: width },
    "4_4": { r: 4, c: 4, rs: 1, cs: 6 },
    "4_10": { r: 4, c: 10, rs: 1, cs: 4 },
    "5_0": { r: 5, c: 0, rs: 2, cs: 1 },
    "5_1": { r: 5, c: 1, rs: 2, cs: 1 },
    "5_2": { r: 5, c: 2, rs: 2, cs: 1 },
  };

  const columnlen = {
    0: 88,
    1: 314,
    2: 83,
    3: 71,
    4: 58,
    5: 58,
    6: 58,
    7: 58,
    8: 58,
    9: 73,
    10: 73,
    11: 60,
    12: 60,
    13: 68,
  };
  const rowlen = { 0: 28, 1: 22, 2: 22, 3: 24, 4: 22, 5: 24, 6: 22 };

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, fs: 16, ht: 0, vt: 1 });
  patchCell(1, 0, { bl: 1, fs: 11, ht: 0, vt: 1 });
  patchCell(2, 0, { bl: 1, fs: 11, ht: 0, vt: 1 });
  patchCell(3, 0, { bl: 1, fs: 12, ht: 1, vt: 1 });
  patchCell(4, 1, { bl: 1, bg: "#f8fafc", ht: 1, vt: 1 });
  patchCell(4, 4, { bl: 1, bg: "#f8fafc", ht: 1, vt: 1 });
  patchCell(4, 10, { bl: 1, bg: "#f8fafc", ht: 1, vt: 1 });

  for (let c = 0; c < width; c += 1) {
    patchCell(5, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
    patchCell(6, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  for (let r = 7; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = row.slice(2).every((cell) => String(cell ?? "").trim() === "");

    if (!sr && desc && restEmpty) {
      patchCell(r, 1, { bl: 1, bg: "#e2efda", ht: 0, vt: 1 });
      continue;
    }

    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    [2, 3, 9, 10, 11, 12, 13].forEach((c) => patchCell(r, c, { ht: 2, vt: 1 }));
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  for (let r = 5; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 5 || r === 6 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyItrSummarySheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(10, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(120, safeMatrix.length + 12);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "1_0": { r: 1, c: 0, rs: 1, cs: width },
    "2_0": { r: 2, c: 0, rs: 1, cs: width },
    "3_0": { r: 3, c: 0, rs: 1, cs: width },
    "4_4": { r: 4, c: 4, rs: 1, cs: 2 },
    "4_7": { r: 4, c: 7, rs: 1, cs: 3 },
    "5_0": { r: 5, c: 0, rs: 2, cs: 1 },
    "5_1": { r: 5, c: 1, rs: 2, cs: 1 },
    "5_2": { r: 5, c: 2, rs: 2, cs: 1 },
  };

  const columnlen = {
    0: 88,
    1: 334,
    2: 83,
    3: 71,
    4: 74,
    5: 60,
    6: 60,
    7: 73,
    8: 60,
    9: 95,
  };
  const rowlen = { 0: 28, 1: 22, 2: 22, 3: 24, 4: 22, 5: 24, 6: 22 };

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, fs: 16, ht: 0, vt: 1 });
  patchCell(1, 0, { bl: 1, fs: 11, ht: 0, vt: 1 });
  patchCell(2, 0, { bl: 1, fs: 11, ht: 0, vt: 1 });
  patchCell(3, 0, { bl: 1, fs: 12, ht: 1, vt: 1 });
  patchCell(4, 1, { bl: 1, bg: "#f8fafc", ht: 1, vt: 1 });
  patchCell(4, 7, { bl: 1, bg: "#f8fafc", ht: 1, vt: 1 });

  for (let c = 0; c < width; c += 1) {
    patchCell(5, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
    patchCell(6, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  for (let r = 7; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = row.slice(2).every((cell) => String(cell ?? "").trim() === "");

    if (!sr && desc && restEmpty) {
      patchCell(r, 1, { bl: 1, bg: "#e2efda", ht: 0, vt: 1 });
      continue;
    }

    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    [2, 3, 4, 5, 6, 7, 8, 9].forEach((c) => patchCell(r, c, { ht: 2, vt: 1 }));
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  for (let r = 5; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 5 || r === 6 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyAmendSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(6, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(100, safeMatrix.length + 10);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "1_0": { r: 1, c: 0, rs: 1, cs: width },
    "2_0": { r: 2, c: 0, rs: 1, cs: width },
    "3_0": { r: 3, c: 0, rs: 1, cs: width },
  };

  const columnlen = {
    0: 80,
    1: 720,
    2: 110,
    3: 100,
    4: 120,
    5: 120,
  };
  const rowlen = { 0: 28, 1: 22, 2: 22, 3: 24, 4: 24 };

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, fs: 16, ht: 0, vt: 1 });
  patchCell(1, 0, { bl: 1, fs: 11, ht: 0, vt: 1 });
  patchCell(2, 0, { bl: 1, fs: 11, ht: 0, vt: 1 });
  patchCell(3, 0, { bl: 1, fs: 12, ht: 1, vt: 1 });

  for (let c = 0; c < width; c += 1) {
    patchCell(4, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  for (let r = 5; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = row.slice(2).every((cell) => String(cell ?? "").trim() === "");

    if (!sr && desc && restEmpty) {
      patchCell(r, 1, { bl: 1, bg: "#e2efda", ht: 0, vt: 1 });
      continue;
    }

    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    [2, 3, 4, 5].forEach((c) => patchCell(r, c, { ht: 2, vt: 1 }));
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };

  for (let r = 4; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 4 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyHiranandaniSummSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(15, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(120, safeMatrix.length + 12);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: 2 },
    "1_0": { r: 1, c: 0, rs: 1, cs: 2 },
    "2_0": { r: 2, c: 0, rs: 1, cs: 2 },
    "3_0": { r: 3, c: 0, rs: 1, cs: 2 },
    "4_4": { r: 4, c: 4, rs: 1, cs: 3 },
    "5_4": { r: 5, c: 4, rs: 1, cs: 3 },
  };

  const columnlen = {
    0: 83,
    1: 284,
    2: 72,
    3: 22,
    4: 72,
    5: 72,
    6: 92,
    7: 36,
    8: 78,
    9: 82,
    10: 22,
    11: 88,
    12: 88,
    13: 118,
    14: 30,
  };
  const rowlen = { 0: 24, 1: 22, 2: 22, 3: 22, 4: 22, 5: 24 };

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { vt: 1 });
    }
  }

  [0, 1, 2, 3, 4].forEach((r) => {
    patchCell(r, 0, { bl: r === 0 ? 1 : 0, ht: 0, vt: 1 });
    patchCell(r, 2, { bl: 1, ht: 1, vt: 1 });
    patchCell(r, 4, { ht: 1, vt: 1 });
    patchCell(r, 5, { ht: 1, vt: 1 });
    patchCell(r, 6, { ht: 1, vt: 1 });
  });

  for (let c = 0; c < width; c += 1) {
    patchCell(5, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }
  patchCell(5, 4, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });

  for (let r = 6; r < safeMatrix.length; r += 1) {
    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    [2, 9, 11, 12].forEach((c) => patchCell(r, c, { ht: 2, vt: 1 }));
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };
  const groupRight = new Set([2, 6, 9, 12, 13, 14]);
  const spacerCols = new Set([3, 7, 10, 14]);

  for (let r = 5; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 5 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 || groupRight.has(c) || spacerCols.has(c) ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyHiranandaniAbstractSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(12, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(160, safeMatrix.length + 12);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "1_0": { r: 1, c: 0, rs: 1, cs: 3 },
    "1_3": { r: 1, c: 3, rs: 1, cs: 4 },
    "1_8": { r: 1, c: 8, rs: 1, cs: 3 },
    "2_0": { r: 2, c: 0, rs: 1, cs: 3 },
    "2_3": { r: 2, c: 3, rs: 1, cs: 4 },
    "2_8": { r: 2, c: 8, rs: 1, cs: 3 },
  };

  const columnlen = {
    0: 80,
    1: 325,
    2: 80,
    3: 95,
    4: 95,
    5: 95,
    6: 80,
    7: 95,
    8: 110,
    9: 100,
    10: 100,
    11: 90,
  };
  const rowlen = { 0: 24, 1: 22, 2: 22, 4: 24 };
  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, ht: 1, vt: 1 });
  [1, 2].forEach((r) => {
    [0, 3, 8].forEach((c) => patchCell(r, c, { bl: 1, ht: 0, vt: 1 }));
  });

  for (let c = 0; c < width; c += 1) {
    patchCell(4, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  for (let r = 5; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = row.slice(2).every((cell) => String(cell ?? "").trim() === "");
    if (/^[A-Z]$/.test(sr) && desc && restEmpty) {
      patchCell(r, 0, { bl: 1, bg: "#e2efda", ht: 1, vt: 1 });
      patchCell(r, 1, { bl: 1, bg: "#e2efda", ht: 0, vt: 1 });
      continue;
    }
    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    [2, 3, 4, 5, 7, 8, 9, 10, 11].forEach((c) => patchCell(r, c, { ht: 2, vt: 1 }));
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };
  const groupRight = new Set([2, 5, 7, 10, 11]);

  for (let r = 4; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 4 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 || groupRight.has(c) ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyHiranandaniSignSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(12, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(160, safeMatrix.length + 12);

  const merge = {
    "0_0": { r: 0, c: 0, rs: 1, cs: width },
    "1_0": { r: 1, c: 0, rs: 1, cs: 3 },
    "1_3": { r: 1, c: 3, rs: 1, cs: 4 },
    "1_8": { r: 1, c: 8, rs: 1, cs: 4 },
    "2_0": { r: 2, c: 0, rs: 1, cs: 3 },
    "2_3": { r: 2, c: 3, rs: 1, cs: 4 },
    "2_8": { r: 2, c: 8, rs: 1, cs: 4 },
  };

  const columnlen = {
    0: 80,
    1: 325,
    2: 80,
    3: 95,
    4: 95,
    5: 95,
    6: 80,
    7: 95,
    8: 95,
    9: 110,
    10: 80,
    11: 90,
  };
  const rowlen = { 0: 24, 1: 22, 2: 22, 4: 24 };
  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { vt: 1 });
    }
  }

  patchCell(0, 0, { bl: 1, ht: 1, vt: 1 });
  [1, 2].forEach((r) => {
    [0, 3, 8].forEach((c) => patchCell(r, c, { bl: 1, ht: 0, vt: 1 }));
  });

  for (let c = 0; c < width; c += 1) {
    patchCell(4, c, { bl: 1, bg: "#f2f2f2", ht: 1, vt: 1 });
  }

  for (let r = 5; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    const sr = String(row[0] ?? "").trim();
    const desc = String(row[1] ?? "").trim();
    const restEmpty = row.slice(2).every((cell) => String(cell ?? "").trim() === "");
    if (/^[A-Z]$/.test(sr) && desc && restEmpty) {
      patchCell(r, 0, { bl: 1, bg: "#e2efda", ht: 1, vt: 1 });
      patchCell(r, 1, { bl: 1, bg: "#e2efda", ht: 0, vt: 1 });
      continue;
    }
    patchCell(r, 0, { ht: 1, vt: 1 });
    patchCell(r, 1, { ht: 0, vt: 1, tb: 2 });
    [2, 3, 4, 5, 7, 8, 9, 10, 11].forEach((c) => patchCell(r, c, { ht: 2, vt: 1 }));
  }

  const thin = { style: 1, color: "#111827" };
  const thick = { style: 2, color: "#111827" };
  const groupRight = new Set([2, 5, 6, 7, 8, 9, 10, 11]);

  for (let r = 4; r < safeMatrix.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 4 ? thick : thin,
        b: r === safeMatrix.length - 1 ? thick : thin,
        l: c === 0 ? thick : thin,
        r: c === width - 1 || groupRight.has(c) ? thick : thin,
      };
    }
  }

  return sheet;
};

const applyIllegalImmigrationSheetPresentation = (sheet, matrix) => {
  const safeMatrix = Array.isArray(matrix) ? matrix : [["No data"]];
  const width = Math.max(9, ...safeMatrix.map((r) => (Array.isArray(r) ? r.length : 1)));
  sheet.column = width;
  sheet.row = Math.max(36, safeMatrix.length + 10);

  const merge = {
    "1_0": { r: 1, c: 0, rs: 1, cs: width },
    "2_0": { r: 2, c: 0, rs: 1, cs: width },
    "3_0": { r: 3, c: 0, rs: 1, cs: width },
    "4_0": { r: 4, c: 0, rs: 1, cs: width },
    "10_1": { r: 10, c: 1, rs: 1, cs: width - 2 },
    "14_1": { r: 14, c: 1, rs: 4, cs: width - 2 },
    "21_1": { r: 21, c: 1, rs: 1, cs: 2 },
  };

  const columnlen = {
    0: 90,
    1: 185,
    2: 185,
    3: 185,
    4: 185,
    5: 185,
    6: 185,
    7: 185,
    8: 185,
  };

  const rowlen = {
    1: 42,
    2: 24,
    3: 24,
    4: 24,
    10: 36,
    14: 44,
    15: 44,
    16: 44,
    17: 44,
    21: 26,
  };

  sheet.config = { ...sheet.config, merge, columnlen, rowlen };

  const cellMap = new Map();
  sheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const ensureCell = (r, c) => {
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) return existing;
    const created = { r, c, v: toLuckyCell("") };
    sheet.celldata.push(created);
    cellMap.set(key, created);
    return created;
  };

  const patchCell = (r, c, patch) => {
    const entry = ensureCell(r, c);
    if (!entry.v || typeof entry.v !== "object") return;
    Object.assign(entry.v, patch);
  };

  for (let r = 0; r < safeMatrix.length; r += 1) {
    const row = Array.isArray(safeMatrix[r]) ? safeMatrix[r] : [];
    for (let c = 0; c < width; c += 1) {
      if (String(row[c] ?? "").trim() === "") continue;
      patchCell(r, c, { ht: 1, vt: 1 });
    }
  }

  patchCell(1, 0, { bl: 1, fs: 26, fc: "#534b34", ht: 0, vt: 1 });
  patchCell(2, 0, { fs: 11, fc: "#3f3f46", ht: 0, vt: 1 });
  patchCell(3, 0, { fs: 12, fc: "#0563c1", ul: 1, ht: 1, vt: 1 });
  patchCell(4, 0, { fs: 10, fc: "#0563c1", ul: 1, ht: 0, vt: 1 });
  patchCell(10, 1, { bl: 1, fs: 18, ht: 1, vt: 1, ul: 1 });
  patchCell(14, 1, { fs: 18, ht: 1, vt: 1, tr: 1, tb: 2 });
  patchCell(21, 1, { bl: 1, fs: 15, ht: 0, vt: 1 });

  const borderColor = "#111827";
  const thin = { style: 1, color: borderColor };
  const medium = { style: 2, color: borderColor };

  for (let c = 0; c < width; c += 1) {
    const topEntry = ensureCell(1, c);
    if (topEntry.v && typeof topEntry.v === "object") {
      topEntry.v.bd = {
        t: medium,
        b: c === width - 1 ? medium : thin,
        l: c === 0 ? medium : undefined,
        r: c === width - 1 ? medium : undefined,
      };
    }
  }

  for (let r = 1; r <= 4; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const entry = ensureCell(r, c);
      if (!entry.v || typeof entry.v !== "object") continue;
      entry.v.bd = {
        t: r === 1 ? medium : thin,
        b: r === 4 ? medium : thin,
        l: c === 0 ? medium : thin,
        r: c === width - 1 ? medium : thin,
      };
    }
  }

  for (let c = 1; c < Math.max(3, width - 5); c += 1) {
    const signatureCell = ensureCell(21, c);
    if (signatureCell.v && typeof signatureCell.v === "object") {
      signatureCell.v.bd = {
        b: thin,
      };
    }
  }

  return sheet;
};

const buildLuckySheetFromMatrix = (name, matrix, sheetIndex) => {
  const base = matrixToLuckySheet(name, matrix, sheetIndex);
  const key = String(name).toLowerCase();
  if (key === "checklist sheet") return applyChecklistSheetPresentation(base, matrix);
  if (key === "cumm boq") return applyCummBoqSheetPresentation(base, matrix);
  if (key === "challan summary") return applyChallanSummarySheetPresentation(base, matrix);
  if (key === "itr summary") return applyItrSummarySheetPresentation(base, matrix);
  if (key === "amend") return applyAmendSheetPresentation(base, matrix);
  if (key === "summ") return applyHiranandaniSummSheetPresentation(base, matrix);
  if (key === "illegal immigration") return applyIllegalImmigrationSheetPresentation(base, matrix);
  if (key === "inv" || key === "invoice") return applyInvoiceSheetPresentation(base, matrix);
  if (key === "wo" || key === "boq") return applyBoqSheetPresentation(base, matrix);
  if (
    key === "abstract" &&
    Array.isArray(matrix) &&
    String(matrix?.[4]?.[0] ?? "") === "WO SR NO" &&
    String(matrix?.[4]?.[1] ?? "") === "SERVICE DESCRIPTION"
  ) {
    return applyHiranandaniAbstractSheetPresentation(base, matrix);
  }
  if (key === "sign") {
    return applyHiranandaniAbstractSheetPresentation(base, matrix);
  }
  if (key === "abstract" || key === "samples") return applyAbstractSheetPresentation(base, matrix);
  if (key === "cpvc") return applyCpvcSheetPresentation(base, matrix);
  if (key === "qty") return applyQtySheetPresentation(base, matrix);
  if (
    Array.isArray(matrix) &&
    matrix.some((row) => Array.isArray(row) && String(row[0] ?? "").startsWith("WORK ORDER SERIAL NO")) &&
    matrix.some((row) => Array.isArray(row) && String(row[0] ?? "") === "Sl No" && String(row[1] ?? "") === "Floor")
  ) {
    return applyAbstractSheetPresentation(base, matrix);
  }
  return base;
};

const normalizeFormulaForSheetJs = (formula) => {
  const f = String(formula || "").trim();
  return f.startsWith("=") ? f.slice(1) : f;
};

const inferSheetJsCellType = (value, hasFormula) => {
  if (typeof value === "number" && Number.isFinite(value)) return "n";
  if (typeof value === "boolean") return "b";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return "d";
  if (value == null && hasFormula) return "n";
  return "s";
};

const isLuckysheetValueObject = (value) => {
  if (!isPlainObject(value)) return false;
  return "v" in value || "m" in value || "f" in value || "ct" in value;
};

const readLuckysheetCell = (cell) => {
  if (cell == null) return { value: null, formula: null };
  if (isLuckysheetValueObject(cell)) {
    return { value: cell.v ?? cell.m ?? null, formula: cell.f ?? null };
  }
  if (isPlainObject(cell) && isLuckysheetValueObject(cell.v)) {
    return { value: cell.v.v ?? cell.v.m ?? null, formula: cell.v.f ?? null };
  }
  return { value: cell, formula: null };
};

const asNumber = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildNumericFormulaCell = (formula, value) => ({
  m: String(value ?? 0),
  v: value ?? 0,
  f: String(formula || "").startsWith("=") ? String(formula) : `=${formula}`,
  ct: { fa: "General", t: "n" },
});

const isCummBoqSheet = (sheet, rowData) => {
  const name = String(sheet?.name || "").trim().toLowerCase();
  if (name === "cumm boq" || name === "boq") return true;

  const label = String(readLuckysheetCell(rowData?.[1]).value || "").trim().toLowerCase();
  return (
    label.includes("supply @") ||
    label.includes("installation @") ||
    label.includes("testing") ||
    label.includes("handover @")
  );
};

const getCummBoqPhaseWeight = (rowData) => {
  const label = String(readLuckysheetCell(rowData?.[1]).value || "").trim().toLowerCase();
  if (label.includes("supply")) return 0.6;
  if (label.includes("installation")) return 0.25;
  if (label.includes("testing")) return 0.1;
  if (label.includes("handover")) return 0.05;
  return 0;
};

const syncCummBoqDerivedCells = (luckysheet, sheet) => {
  if (!sheet) return false;

  const flowdata =
    typeof luckysheet?.flowdata === "function"
      ? luckysheet.flowdata()
      : Array.isArray(sheet.data)
        ? sheet.data
        : null;

  if (!Array.isArray(flowdata)) return false;

  let changed = false;

  for (let r = 0; r < flowdata.length; r += 1) {
    const rowData = flowdata[r];
    if (!Array.isArray(rowData) || !isCummBoqSheet(sheet, rowData)) continue;

    const phaseWeight = getCummBoqPhaseWeight(rowData);
    if (!phaseWeight) continue;

    const prev = asNumber(readLuckysheetCell(rowData[3]).value);
    const curr = asNumber(readLuckysheetCell(rowData[4]).value);
    const rate = asNumber(readLuckysheetCell(rowData[10]).value);
    const sum = prev + curr;
    const prevBoq = prev * phaseWeight;
    const currBoq = curr * phaseWeight;
    const cummBoq = sum * phaseWeight;
    const prevAmt = prevBoq * rate;
    const currAmt = currBoq * rate;
    const cummAmt = cummBoq * rate;

    const nextCells = new Map([
      [5, buildNumericFormulaCell(`=SUM(D${r + 1},E${r + 1})`, sum)],
      [6, toLuckyCell(prevBoq)],
      [7, toLuckyCell(currBoq)],
      [8, toLuckyCell(cummBoq)],
      [11, toLuckyCell(prevAmt)],
      [12, toLuckyCell(currAmt)],
      [13, toLuckyCell(cummAmt)],
    ]);

    nextCells.forEach((nextCell, c) => {
      const currentValue = asNumber(readLuckysheetCell(rowData[c]).value);
      const nextValue = asNumber(readLuckysheetCell(nextCell).value);
      const currentFormula = readLuckysheetCell(rowData[c]).formula || "";
      const nextFormula = readLuckysheetCell(nextCell).formula || "";
      if (currentValue === nextValue && currentFormula === nextFormula) return;

      rowData[c] = nextCell;
      if (Array.isArray(sheet.data)) {
        if (!Array.isArray(sheet.data[r])) sheet.data[r] = [];
        sheet.data[r][c] = nextCell;
      }
      if (Array.isArray(sheet.celldata)) {
        const existing = sheet.celldata.find((entry) => entry && entry.r === r && entry.c === c);
        if (existing) {
          existing.v = nextCell;
        } else {
          sheet.celldata.push({ r, c, v: nextCell });
        }
      }
      changed = true;
    });
  }

  return changed;
};

const isAmendSheet = (sheet) => String(sheet?.name || "").trim().toLowerCase() === "amend";

const isAmendDataRow = (rowData) => {
  if (!Array.isArray(rowData)) return false;
  const sr = String(readLuckysheetCell(rowData[0]).value || "").trim();
  const desc = String(readLuckysheetCell(rowData[1]).value || "").trim();
  if (!sr || !desc) return false;
  const qty = readLuckysheetCell(rowData[2]).value;
  const rate = readLuckysheetCell(rowData[4]).value;
  return qty !== null || rate !== null;
};

const syncAmendDerivedCells = (luckysheet, sheet) => {
  if (!sheet || !isAmendSheet(sheet)) return false;

  const flowdata =
    typeof luckysheet?.flowdata === "function"
      ? luckysheet.flowdata()
      : Array.isArray(sheet.data)
        ? sheet.data
        : null;

  if (!Array.isArray(flowdata)) return false;

  let changed = false;

  for (let r = 0; r < flowdata.length; r += 1) {
    const rowData = flowdata[r];
    if (!Array.isArray(rowData) || !isAmendDataRow(rowData)) continue;

    const qty = asNumber(readLuckysheetCell(rowData[2]).value);
    const rate = asNumber(readLuckysheetCell(rowData[4]).value);
    const amount = qty * rate;
    const nextCell = buildNumericFormulaCell(`=C${r + 1}*E${r + 1}`, amount);
    const currentValue = asNumber(readLuckysheetCell(rowData[5]).value);
    const currentFormula = readLuckysheetCell(rowData[5]).formula || "";
    const nextFormula = readLuckysheetCell(nextCell).formula || "";

    if (currentValue === amount && currentFormula === nextFormula) continue;

    rowData[5] = nextCell;
    if (Array.isArray(sheet.data)) {
      if (!Array.isArray(sheet.data[r])) sheet.data[r] = [];
      sheet.data[r][5] = nextCell;
    }
    if (Array.isArray(sheet.celldata)) {
      const existing = sheet.celldata.find((entry) => entry && entry.r === r && entry.c === 5);
      if (existing) {
        existing.v = nextCell;
      } else {
        sheet.celldata.push({ r, c: 5, v: nextCell });
      }
    }
    changed = true;
  }

  return changed;
};

const toSpreadsheetColumn = (index) => {
  let n = Number(index) + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

const normalizeEditedCellValue = (value) => {
  if (value == null) return "";
  if (isPlainObject(value) && ("v" in value || "m" in value || "f" in value)) {
    return readLuckysheetCell(value).value ?? "";
  }
  return value;
};

const getLuckysheetSheets = (luckysheet) => {
  const getter =
    luckysheet?.getLuckysheetfile ||
    luckysheet?.getLuckysheetFile ||
    luckysheet?.getLuckysheetfile?.bind?.(luckysheet) ||
    null;

  const file =
    typeof getter === "function"
      ? getter()
      : typeof luckysheet?.getAllSheets === "function"
        ? luckysheet.getAllSheets()
        : null;

  return Array.isArray(file) ? file : [];
};

const ensureHiranandaniSignFormulaLinks = (luckysheet) => {
  if (!luckysheet) return false;
  const sheets = getLuckysheetSheets(luckysheet);
  const abstractSheet = sheets.find((sheet) => String(sheet?.name || "").trim().toLowerCase() === "abstract");
  const signSheet = sheets.find((sheet) => String(sheet?.name || "").trim().toLowerCase() === "sign");
  if (!abstractSheet || !signSheet) return false;

  const abstractData =
    typeof luckysheet.flowdata === "function" && Number(abstractSheet?.status) === 1
      ? luckysheet.flowdata()
      : Array.isArray(abstractSheet.data)
        ? abstractSheet.data
        : null;

  if (!Array.isArray(abstractData)) return false;
  if (!Array.isArray(signSheet.data)) signSheet.data = [];
  if (!Array.isArray(signSheet.celldata)) signSheet.celldata = [];

  const cellMap = new Map();
  signSheet.celldata.forEach((entry) => {
    if (!entry) return;
    cellMap.set(`${entry.r}_${entry.c}`, entry);
  });

  const setSignCell = (r, c, cell) => {
    if (typeof luckysheet.setcellvalue === "function") {
      try {
        luckysheet.setcellvalue(r, c, cell, {
          order: signSheet.order,
          isRefresh: Number(signSheet?.status) === 1,
        });
      } catch {
        null;
      }
    }
    if (!Array.isArray(signSheet.data[r])) signSheet.data[r] = [];
    signSheet.data[r][c] = cell;
    const key = `${r}_${c}`;
    const existing = cellMap.get(key);
    if (existing) {
      existing.v = cell;
    } else {
      const created = { r, c, v: cell };
      signSheet.celldata.push(created);
      cellMap.set(key, created);
    }
  };

  let changed = false;
  const maxColumns = Math.max(12, ...abstractData.map((row) => (Array.isArray(row) ? row.length : 0)));

  for (let r = 0; r < abstractData.length; r += 1) {
    const sourceRow = Array.isArray(abstractData[r]) ? abstractData[r] : [];
    for (let c = 0; c < maxColumns; c += 1) {
      const sourceCell = sourceRow[c] ?? toLuckyCell("");
      const sourceValue = readLuckysheetCell(sourceCell).value ?? "";
      const formula = `=Abstract!${toSpreadsheetColumn(c)}${r + 1}`;
      const nextCell = toLuckyFormulaCell(formula, sourceValue);
      const currentCell = Array.isArray(signSheet.data[r]) ? signSheet.data[r][c] : null;
      const currentValue = readLuckysheetCell(currentCell).value ?? "";
      const currentFormula = readLuckysheetCell(currentCell).formula || "";
      if (currentValue === sourceValue && currentFormula === formula) continue;
      setSignCell(r, c, nextCell);
      changed = true;
    }
  }

  return changed;
};

const syncHiranandaniSignCellFromAbstract = (luckysheet, r, c, editedValue) => {
  if (!luckysheet) return false;
  const sheets = getLuckysheetSheets(luckysheet);
  const abstractSheet = sheets.find((sheet) => String(sheet?.name || "").trim().toLowerCase() === "abstract");
  const signSheet = sheets.find((sheet) => String(sheet?.name || "").trim().toLowerCase() === "sign");
  if (!abstractSheet || !signSheet) return false;
  if (r < 0 || c < 0 || c > 11) return false;

  const abstractData =
    typeof luckysheet.flowdata === "function" && Number(abstractSheet?.status) === 1
      ? luckysheet.flowdata()
      : Array.isArray(abstractSheet.data)
        ? abstractSheet.data
        : null;
  if (!Array.isArray(abstractData) || !Array.isArray(abstractData[r])) return false;

  const sourceCell = abstractData[r][c] ?? toLuckyCell("");
  const fallbackValue = readLuckysheetCell(sourceCell).value ?? "";
  const sourceValue = editedValue !== undefined ? normalizeEditedCellValue(editedValue) : fallbackValue;
  const formula = `=Abstract!${toSpreadsheetColumn(c)}${r + 1}`;
  const nextCell = toLuckyFormulaCell(formula, sourceValue);

  if (typeof luckysheet.setcellvalue === "function") {
    try {
      luckysheet.setcellvalue(r, c, nextCell, {
        order: signSheet.order,
        isRefresh: Number(signSheet?.status) === 1,
      });
    } catch {
      null;
    }
  }

  if (!Array.isArray(signSheet.data)) signSheet.data = [];
  if (!Array.isArray(signSheet.data[r])) signSheet.data[r] = [];
  signSheet.data[r][c] = nextCell;

  if (!Array.isArray(signSheet.celldata)) signSheet.celldata = [];
  const existing = signSheet.celldata.find((entry) => entry && entry.r === r && entry.c === c);
  if (existing) existing.v = nextCell;
  else signSheet.celldata.push({ r, c, v: nextCell });

  return true;
};

const buildWorkbookFromLuckysheetFile = (luckysheetFile = []) => {
  const workbook = XLSX.utils.book_new();

  luckysheetFile.forEach((sheet) => {
    const sheetName = String(sheet?.name || "Sheet").slice(0, 31) || "Sheet";
    const data = Array.isArray(sheet?.data) ? sheet.data : [];
    const celldata = Array.isArray(sheet?.celldata) ? sheet.celldata : [];

    const ws = {};
    let maxR = 0;
    let maxC = 0;

    const writeCell = (r, c, cell) => {
      const { value, formula } = readLuckysheetCell(cell);
      if (value == null && !formula) return;

      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);

      const addr = XLSX.utils.encode_cell({ r, c });
      const normalizedFormula = formula ? normalizeFormulaForSheetJs(formula) : undefined;
      const cellType = inferSheetJsCellType(value, Boolean(normalizedFormula));
      const normalizedValue = value == null ? (cellType === "n" ? 0 : "") : value;

      if (normalizedFormula) {
        ws[addr] = { t: cellType, v: normalizedValue, f: normalizedFormula };
      } else {
        ws[addr] = { t: cellType, v: normalizedValue };
      }
    };

    if (data.length > 0) {
      for (let r = 0; r < data.length; r += 1) {
        const row = Array.isArray(data[r]) ? data[r] : [];
        for (let c = 0; c < row.length; c += 1) {
          writeCell(r, c, row[c]);
        }
      }
    } else if (celldata.length > 0) {
      celldata.forEach((entry) => {
        if (!entry) return;
        const r = Number(entry.r);
        const c = Number(entry.c);
        if (!Number.isFinite(r) || !Number.isFinite(c)) return;
        writeCell(r, c, entry.v);
      });
    }

    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  return workbook;
};

const getAuthToken = () => {
  const userStr = localStorage.getItem("inventory_user");
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return user?.token || null;
  } catch {
    return null;
  }
};

const fetchProjectData = async (projectId) => {
  const numericProjectId = await resolveProjectNumericId(projectId);
  const resolvedProjectId = numericProjectId ?? projectId;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "https://api.madhuram.enterprises").replace(/\/$/, "");
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const tryFetch = async (url) => {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const error = body?.error || body?.message || res.statusText || "Request failed";
      throw new Error(error);
    }
    if (body && typeof body === "object" && "data" in body && "success" in body) {
      if (!body.success) throw new Error(body.error || "Request failed");
      return body.data;
    }
    return body;
  };

  const urls = [`${baseUrl}/api/projects/${resolvedProjectId}`];
  for (const url of urls) {
    try {
      return await tryFetch(url);
    } catch {
      null;
    }
  }

  if (!numericProjectId) {
    throw new Error("Invalid project id");
  }

  const fallback = await api.getProjectById(numericProjectId);
  if (!fallback?.success) throw new Error(fallback?.error || "Failed to load project data");
  return fallback.data;
};

const normalizeToArray = (value) => (Array.isArray(value) ? value : []);

const placeholderMatrix = (label) => [[`Click tab to load ${label}`]];

const sectionKeyForRawSheetName = (rawName) => {
  const name = String(rawName || "");
  if (name === "WO") return "BOQ";
  if (name === "Inv") return "Invoice";
  if (name === "Abstract") return "Abstract";
  if (name === "QTY") return "QTY";
  if (name === "CPVC") return "CPVC";
  return null;
};

const datasetToMatrix = (dataset) => {
  if (dataset == null) return [["No data"]];
  if (Array.isArray(dataset)) {
    const rows = dataset.map((row) => (isPlainObject(row) ? flattenRecord(row) : { value: row }));
    return rowsToMatrix(rows);
  }
  if (isPlainObject(dataset)) return rowsToMatrix([flattenRecord(dataset)]);
  return rowsToMatrix([{ value: dataset }]);
};

const wrapCellText = (value, { maxLineChars = 90, maxLines = 3 } = {}) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxLineChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = w;
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  const truncated = words.length > 0 && lines.join(" ").length < text.length;
  const out = lines.slice(0, maxLines).join("\n");
  return truncated ? `${out}…` : out;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const buildInvoiceMatrix = (project) => {
  const projectName = String(project?.project_name || project?.name || "").trim();
  const clientName = String(project?.client_name || "").trim();
  const woNumber = String(project?.wo_number || "").trim();
  const location = String(project?.location || "").trim();
  const buildingName = String(project?.building_name || project?.site_name || "").trim();
  const raNumber = String(project?.ra_number || project?.ra_no || "").trim();

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const invoiceDate = `${dd}.${mm}.${yyyy}`;

  const invoiceNo = woNumber ? `${woNumber}` : `INV-${yyyy}${mm}${dd}`;

  const r = () => Array(9).fill("");
  const rows = [];

  rows.push(Object.assign(r(), { 0: "Madhuram Enterprises" }));
  rows.push(Object.assign(r(), { 0: "401, SUJATA BLDG, RAMNAGAR, OPP PARIVAR BLDG, BORIVALI WEST, MUMBAI - 400092" }));
  rows.push(r());
  rows.push(Object.assign(r(), { 0: "Cell no. - 9819910257, Email id: mmsplumbing@gmail.com" }));
  rows.push(Object.assign(r(), { 0: "Website: www.madhuramrealtors.com" }));
  rows.push(r());
  rows.push(
    Object.assign(r(), {
      0: "GSTIN: 27AESPN7117D1ZA",
      3: "PAN NO.: AESPN7117D",
      7: "ORIGINAL FOR RECIPIENT",
    }),
  );
  rows.push(r());
  rows.push(r());
  rows.push(Object.assign(r(), { 0: "Tax Invoice" }));
  rows.push(
    Object.assign(r(), {
      0: "Invoice No :",
      2: invoiceNo,
      4: "PF NO -",
      5: "",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "Invoice date:",
      2: invoiceDate,
      4: "ESIC NO -",
      5: "",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "Reverse Charge (Y/N)",
      2: "N",
      4: "PTR NO -",
      5: "",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "State: MAHARASHTRA",
      2: "Code",
      3: "27",
      4: "MLWF NO -",
      5: "",
    }),
  );
  rows.push(r());
  rows.push(
    Object.assign(r(), {
      0: "Bill to Party",
      4: "Ship to Party / Site",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "Co A/C Name:",
      1: clientName || "-",
      4: "Co A/C Name:",
      5: "",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "Address:",
      1: wrapCellText(location || "-", { maxLineChars: 52, maxLines: 1 }),
      4: "GSTIN:",
      5: "",
    }),
  );
  rows.push(Object.assign(r(), { 0: "", 1: "", 4: "", 5: "" }));
  rows.push(
    Object.assign(r(), {
      0: "GSTIN:",
      1: "",
      4: "",
      5: "",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "State: Maharashtra",
      2: "Code",
      3: "27",
      4: "State: Maharashtra",
      6: "Code",
      7: "27",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "BUILDING NAME",
      1: buildingName || projectName || "-",
      4: buildingName || projectName || "-",
    }),
  );
  rows.push(
    Object.assign(r(), {
      0: "Reference :-",
      1: "RA No.",
      2: raNumber || "7",
      3: "Work",
      4: "PLUMBING WORK",
      5: "WO NO",
      6: woNumber || "",
    }),
  );
  rows.push(Object.assign(r(), { 0: "SERVICE DATE FROM - 1.12.2025 TO 31.12.2025" }));
  rows.push(
    Object.assign(r(), {
      0: "S. No.",
      1: "Goods / Service Description",
      2: "SAC code",
      3: "Value of Supply",
      4: "Discount",
      5: "Taxable Value",
      6: "CGST",
      7: "",
      8: "SGST",
    }),
  );
  rows.push(Object.assign(r(), { 6: "Rate", 7: "Amount", 8: "Rate" }));
  rows.push(
    Object.assign(r(), {
      0: "",
      1: "Plumbing / Sanitation Contract works",
      2: "995462",
      3: "",
      4: "0",
      5: "",
      6: "9",
      7: "",
      8: "9",
    }),
  );
  rows.push(r());
  rows.push(r());
  rows.push(r());
  rows.push(r());
  rows.push(
    Object.assign(r(), {
      0: "Total",
      3: "",
      4: "-",
      5: "",
      6: "",
      7: "",
      8: "",
    }),
  );
  rows.push(Object.assign(r(), { 0: "Total Invoice amount in words", 4: "Total Amount before Tax", 8: "" }));
  rows.push(Object.assign(r(), { 0: "RUPEES ONE LAKH FIFTY EIGHT THOUSAND FIVE HUNDRED", 4: "Add: CGST", 8: "" }));
  rows.push(Object.assign(r(), { 0: "AND THIRTY ONLY", 4: "Add: SGST", 8: "" }));
  rows.push(Object.assign(r(), { 4: "ROUND OFF", 8: "" }));
  rows.push(Object.assign(r(), { 4: "Total Amount after Tax:", 8: "" }));
  rows.push(Object.assign(r(), { 4: "GST on Reverse Charge", 8: "0" }));
  rows.push(Object.assign(r(), { 0: "Bank Details", 4: "E & O.E" }));
  rows.push(Object.assign(r(), { 0: "Bank:", 1: "", 4: "For," }));
  rows.push(Object.assign(r(), { 0: "Terms and Conditions:-", 4: "MMS. MADHURAM ENTERPRISES" }));
  rows.push(Object.assign(r(), { 4: "AUTHORISED SIGNATORY" }));

  return rows;
};

const buildCpvcMatrix = (project) => {
  const rawFloors =
    project?.floors ??
    project?.no_of_floors ??
    project?.noOfFloors ??
    project?.total_floors ??
    project?.totalFloors ??
    project?.floor ??
    "";

  const floorCount = (() => {
    const n = Number(String(rawFloors).replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0 && n <= 250) return Math.floor(n);
    return 1;
  })();

  const building = String(project?.project_name || project?.name || "BUILDING").trim();
  const woNumber = String(project?.wo_number || "").trim();

  const width = 28;
  const blankRow = () => Array(width).fill("");

  const floorLabel = (idx) => {
    if (idx === 0) return "G/F";
    const n = idx;
    const mod10 = n % 10;
    const mod100 = n % 100;
    const suffix = mod10 === 1 && mod100 !== 11 ? "st" : mod10 === 2 && mod100 !== 12 ? "nd" : mod10 === 3 && mod100 !== 13 ? "rd" : "th";
    return `${n}${suffix} Flr`;
  };

  const matrix = [];

  const row0 = blankRow();
  row0[0] = `Building - ${building.toUpperCase()}`;
  row0[20] = woNumber ? `Work Order - ${woNumber}` : "Work Order -";
  matrix.push(row0);

  const row1 = blankRow();
  row1[0] = "Contractor : MADHURAM ENTERPRISES";
  row1[20] = "";
  matrix.push(row1);

  const titleRow = blankRow();
  titleRow[0] = "CPVC Pipe 15mm (Concealed) - Installation Abstract";
  matrix.push(titleRow);

  const woRow = blankRow();
  woRow[0] = woNumber ? `WORK ORDER SR.NO ${woNumber}` : "WORK ORDER SR.NO";
  matrix.push(woRow);

  matrix.push(blankRow());

  const groupRow = blankRow();
  groupRow[0] = "Sr";
  groupRow[1] = "Floor";
  for (let i = 1; i <= 8; i += 1) {
    groupRow[2 + (i - 1) * 3] = `FLAT NO ${i}`;
  }
  groupRow[26] = "Total";
  groupRow[27] = "Remarks";
  matrix.push(groupRow);

  const subRow = blankRow();
  for (let i = 0; i < 8; i += 1) {
    const base = 2 + i * 3;
    subRow[base] = "CT";
    subRow[base + 1] = "MT";
    subRow[base + 2] = "KIT";
  }
  subRow[26] = "Total";
  matrix.push(subRow);

  for (let i = 0; i < floorCount; i += 1) {
    const row = blankRow();
    row[0] = i + 1;
    row[1] = floorLabel(i);
    matrix.push(row);
  }

  const totalRow = blankRow();
  totalRow[0] = "TOTAL";
  matrix.push(totalRow);

  return matrix;
};

const buildQtyMatrix = (rawDcs) => {
  const dcs = normalizeToArray(rawDcs);

  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const displayNum = (v) => {
    if (v == null) return "";
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = toNum(v);
    return n == null ? "" : n;
  };

  const matrix = [];
  let first = true;

  dcs.forEach((dc) => {
    if (!isPlainObject(dc)) return;
    const challanNumber = String(dc.challan_number || "").trim();
    if (!challanNumber) return;

    if (!first) matrix.push(["", "", "", ""]);
    first = false;

    matrix.push([`CHALLAN NO ${challanNumber}`, "", "", ""]);
    matrix.push(["", "QTY", "PER PC MTR", "TOT QTY"]);

    const items = normalizeToArray(dc.items);
    items.forEach((item) => {
      if (!isPlainObject(item)) return;
      const name = String(item.name || item.description || "").trim();
      if (!name) return;

      const qty = displayNum(item.quantity ?? item.qty);
      const perPc =
        displayNum(
          item.per_pc_mtr ??
            item.perPcMtr ??
            item.per_pc_meter ??
            item.perPcMeter ??
            item.length ??
            item.mtr ??
            item.meter,
        ) || "";

      const qtyNum = typeof qty === "number" ? qty : toNum(qty);
      const perNum = typeof perPc === "number" ? perPc : toNum(perPc);

      const total =
        qtyNum != null && perNum != null
          ? Number((qtyNum * perNum).toFixed(3))
          : qtyNum != null
            ? qtyNum
            : "";

      matrix.push([name, qty, perPc, total]);
    });
  });

  return matrix.length > 0 ? matrix : [["No data"]];
};

const buildItemTabsAfterCpvc = (project, rawSamples, rawDcs) => {
  const samples = normalizeToArray(rawSamples);
  const seen = new Set();
  const tabs = [];

  const makeTabName = (label) => {
    const upper = String(label || "").toUpperCase();
    const sizeMatch = /(\d+)\s*MM/.exec(upper);
    const typeMatch = /TYPE\s*([A-Z])/.exec(upper);
    const size = sizeMatch ? sizeMatch[1] : "";
    const type = typeMatch ? typeMatch[1] : "";
    const base = size && type ? `${size}${type}` : size ? `${size}MM` : upper.replace(/[^A-Z0-9]+/g, " ").trim().slice(0, 12);
    const sanitized = base || "ITEM";
    let name = sanitized;
    let n = 2;
    while (seen.has(name)) {
      name = `${sanitized}-${n}`;
      n += 1;
    }
    seen.add(name);
    return name.slice(0, 31);
  };

  const itemLabels = [];
  const labelSeen = new Set();
  samples.forEach((sample) => {
    if (!isPlainObject(sample)) return;
    const rows = parseJsonArray(sample.item_description);
    rows.forEach((row) => {
      if (!isPlainObject(row)) return;
      const label = String(row.item || row.description || row.material_description || "").trim();
      if (!label || labelSeen.has(label)) return;
      labelSeen.add(label);
      itemLabels.push(label);
    });
  });

  itemLabels.forEach((label) => {
    tabs.push({ name: makeTabName(label), matrix: buildAbstractMatrix(project, rawDcs, `${label} - Installation Abstract`) });
  });

  return tabs;
};

function buildAbstractMatrix(project, rawDcs, title = "Installation Abstract") {
  const dcs = normalizeToArray(rawDcs);

  const rawFloors =
    project?.floors ??
    project?.no_of_floors ??
    project?.noOfFloors ??
    project?.total_floors ??
    project?.totalFloors ??
    project?.floor ??
    "";

  const floorCount = (() => {
    const n = Number(String(rawFloors).replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0 && n <= 250) return Math.floor(n);
    return 1;
  })();

  const workOrders = (() => {
    const seen = new Set();
    const list = [];
    dcs.forEach((dc) => {
      if (!isPlainObject(dc)) return;
      const wo = String(dc.work_order_number || "").trim();
      if (!wo || seen.has(wo)) return;
      seen.add(wo);
      list.push(wo);
    });
    const fallback = String(project?.wo_number || "").trim();
    if (list.length === 0 && fallback) return [fallback];
    return list.length > 0 ? list : ["-"];
  })();

  const building = String(project?.project_name || project?.name || "BUILDING").trim();
  const woNumberTop = String(project?.wo_number || "").trim();

  const width = 36;
  const blankRow = () => Array(width).fill("");

  const floorLabel = (idx) => {
    if (idx === 0) return "G/F";
    const n = idx;
    const mod10 = n % 10;
    const mod100 = n % 100;
    const suffix = mod10 === 1 && mod100 !== 11 ? "st" : mod10 === 2 && mod100 !== 12 ? "nd" : mod10 === 3 && mod100 !== 13 ? "rd" : "th";
    return `${n}${suffix} Flr`;
  };

  const matrix = [];

  workOrders.forEach((woSerial, tableIndex) => {
    if (tableIndex > 0) matrix.push(blankRow(), blankRow());

    const row0 = blankRow();
    row0[0] = `Building - ${building.toUpperCase()}`;
    row0[26] = woNumberTop ? `Work Order - ${woNumberTop}` : "Work Order -";
    matrix.push(row0);

    const row1 = blankRow();
    row1[0] = "Contractor : MADHURAM ENTERPRISES";
    row1[26] = "";
    matrix.push(row1);

    const titleRow = blankRow();
    titleRow[0] = title;
    matrix.push(titleRow);

    const woRow = blankRow();
    woRow[0] = `WORK ORDER SERIAL NO ${woSerial}`;
    matrix.push(woRow);

    matrix.push(blankRow());

    const groupRow = blankRow();
    groupRow[0] = "Sl No";
    groupRow[1] = "Floor";
    for (let i = 1; i <= 8; i += 1) {
      groupRow[2 + (i - 1) * 4] = `FLAT NO ${i}`;
    }
    groupRow[34] = "TOT";
    groupRow[35] = "REMARKS";
    matrix.push(groupRow);

    const subRow = blankRow();
    for (let i = 0; i < 8; i += 1) {
      const base = 2 + i * 4;
      subRow[base] = "CT";
      subRow[base + 1] = "MT";
      subRow[base + 2] = "BAL";
      subRow[base + 3] = "KIT";
    }
    subRow[34] = "TOT";
    matrix.push(subRow);

    for (let i = 0; i < floorCount; i += 1) {
      const row = blankRow();
      row[0] = i + 1;
      row[1] = floorLabel(i);
      matrix.push(row);
    }

    const totalRow = blankRow();
    totalRow[0] = "TOTAL";
    matrix.push(totalRow);
  });

  return matrix.length > 0 ? matrix : [["No data"]];
}

const buildBoqMatrix = (raw, project) => {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.boqs)
      ? raw.boqs
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : "";
  };

  const projectName = String(project?.project_name || project?.name || "BOQ").trim();
  const woNumber = String(project?.wo_number || "").trim();

  const matrix = [];
  matrix.push([projectName.toUpperCase(), "", "", "", "", ""]);
  matrix.push([woNumber ? `WO NO - ${woNumber}` : "", "", "", "", "", ""]);

  let lastCategory = null;
  arr.forEach((row) => {
    if (!isPlainObject(row)) return;
    const category = String(row.category ?? "").trim();
    if (category && category !== lastCategory) {
      const m = /^([A-Z])\.\s*(.+)$/.exec(category);
      const sr = m ? `${m[1]}.` : "";
      const desc = m ? m[2] : category;
      matrix.push([sr, desc, "", "", "", ""]);
      matrix.push(["SR NO.", "ITEM DESCRIPTION", "UNIT", "QTY", "RATE", "AMOUNT"]);
      lastCategory = category;
    }

    matrix.push([
      row.item_code ?? row.code ?? "",
      wrapCellText(row.description ?? ""),
      row.unit ?? "",
      toNum(row.quantity),
      toNum(row.rate),
      toNum(row.amount),
    ]);
  });

  return matrix;
};

const buildSamplesMatrix = (raw, project) => {
  const samples = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];

  const matrix = [];
  let first = true;

  samples.forEach((sample) => {
    if (!isPlainObject(sample)) return;
    const id = sample.sample_id ?? sample.id ?? "";
    const label = String(sample.work_done || sample.site_name || sample.building_name || (id ? `Sample #${id}` : "Sample")).trim();
    if (!label) return;

    if (!first) matrix.push(Array(12).fill(""));
    first = false;

    const building = String(sample.building_name || "").trim();
    const contractor = String(project?.client_name || "").trim();
    const workOrder = String(project?.wo_number || "").trim();

    matrix.push([`Sample - ${label}`, ...Array(11).fill("")]);
    matrix.push([`Building - ${building || "-"}`, ...Array(11).fill("")]);
    matrix.push([`Contractor - ${contractor || "-"}`, ...Array(11).fill("")]);
    matrix.push(["ABSTRACT SHEET", ...Array(11).fill("")]);
    matrix.push([`Work Order - ${workOrder || "-"}`, ...Array(11).fill("")]);
    matrix.push(["", ...Array(11).fill("")]);
    matrix.push([
      "Sl No",
      "Description",
      "Unit",
      "Qty",
      "BOQ",
      "",
      "Quantity",
      "",
      "",
      "Amount",
      "",
      "",
    ]);
    matrix.push(["", "", "", "", "Rate", "Amount", "Previous", "Present", "Total", "Previous", "Present", "Total"]);

    const rows = parseJsonArray(sample.item_description);
    rows.forEach((row, idx) => {
      if (!isPlainObject(row)) return;
      const qty = row.quantity ?? row.qty ?? row.req_qty ?? "";
      const amount = row.value ?? "";
      matrix.push([
        row.sr_no ?? row.sr ?? String(idx + 1),
        wrapCellText(row.description ?? row.material_description ?? row.item ?? ""),
        row.unit ?? row.uom ?? row.UOM ?? "",
        qty,
        "",
        amount,
        "",
        qty,
        qty,
        "",
        amount,
        amount,
      ]);
    });
  });

  return matrix.length > 0 ? matrix : [["No data"]];
};

const buildInitialWorkbookSheets = (_project) => {
  const usedNames = new Set();
  const rawToSheetName = new Map();
  const sheets = [];

  const addMatrix = (rawName, matrix) => {
    const name = sanitizeSheetName(rawName, usedNames);
    rawToSheetName.set(rawName, name);
    sheets.push({ rawName, name, matrix });
    return name;
  };

  ["WO", "Inv", "Abstract", "QTY", "CPVC"].forEach((rawName) =>
    addMatrix(rawName, placeholderMatrix(rawName)),
  );

  return { sheets, rawToSheetName };
};

const fetchProjectWorkbookData = async (projectId) => {
  const numericProjectId = await resolveProjectNumericId(projectId);
  const resolvedProjectId = numericProjectId ?? projectId;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL || "https://api.madhuram.enterprises").replace(/\/$/, "");
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchJson = async (url) => {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const error = body?.error || body?.message || res.statusText || "Request failed";
      throw new Error(error);
    }
    if (body && typeof body === "object" && "data" in body && "success" in body) {
      if (!body.success) throw new Error(body.error || "Request failed");
      return body.data;
    }
    return body;
  };

  const project = await fetchProjectData(projectId);

  const endpoints = [
    ["DeliveryChallans", `${baseUrl}/api/dc/project/${resolvedProjectId}`],
    ["BOQ", `${baseUrl}/api/boq/project/${resolvedProjectId}`],
    ["Samples", `${baseUrl}/api/sample/project/${resolvedProjectId}`],
  ];

  const results = await Promise.allSettled(endpoints.map(([, url]) => fetchJson(url)));
  const workbook = { Project: project };

  endpoints.forEach(([key], idx) => {
    const r = results[idx];
    if (r.status === "fulfilled") {
      workbook[key] = r.value;
    } else {
      workbook[key] = [{ error: r.reason?.message || "Failed to fetch", endpoint: key }];
    }
  });

  workbook.Invoice = buildInvoiceMatrix(project);
  workbook.CPVC = buildCpvcMatrix(project);
  workbook.QTY = buildQtyMatrix(workbook.DeliveryChallans);
  workbook.BOQ = buildBoqMatrix(workbook.BOQ, project);
  workbook.Abstract = buildAbstractMatrix(project, workbook.DeliveryChallans);
  workbook.ItemTabs = buildItemTabsAfterCpvc(project, workbook.Samples, workbook.DeliveryChallans);

  return workbook;
};

export default function ProjectSpreadsheet({
  projectId,
  title = "Spreadsheet",
  workbookTitle,
  workbookData,
  downloadFilename,
  showHeader = true,
  showDownload = true,
  wrapperClassName,
  bodyClassName,
  apiRef,
}) {
  const containerId = React.useId().replace(/:/g, "");
  const luckysheetRef = React.useRef(null);
  const depsRef = React.useRef({ dollar: null, luckysheet: null, pluginsLoaded: false });
  const sheetNameToRawRef = React.useRef(new Map());
  const sheetNameToSectionRef = React.useRef(new Map());
  const loadedSectionsRef = React.useRef(new Set());
  const loadingSectionRef = React.useRef(new Set());
  const recreatingRef = React.useRef(false);
  const projectDataRef = React.useRef(null);
  const cummBoqRepairTimerRef = React.useRef(null);
  const amendRepairTimeoutRef = React.useRef(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const scheduleCummBoqRepair = React.useCallback((targetRow = null) => {
    if (cummBoqRepairTimerRef.current != null) {
      window.clearTimeout(cummBoqRepairTimerRef.current);
    }

    cummBoqRepairTimerRef.current = window.setTimeout(() => {
      cummBoqRepairTimerRef.current = null;
      const luckysheet = luckysheetRef.current;
      if (!luckysheet || typeof luckysheet.getAllSheets !== "function") return;

      const sheets = luckysheet.getAllSheets() || [];
      const activeSheet = sheets.find((sheet) => Number(sheet?.status) === 1);
      if (!activeSheet) return;

      const name = String(activeSheet?.name || "").trim().toLowerCase();
      if (name !== "cumm boq" && name !== "boq") return;

      if (targetRow == null) {
        if (syncCummBoqDerivedCells(luckysheet, activeSheet) && typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
        return;
      }

      const flowdata =
        typeof luckysheet.flowdata === "function"
          ? luckysheet.flowdata()
          : Array.isArray(activeSheet.data)
            ? activeSheet.data
            : null;
      if (!Array.isArray(flowdata) || !Array.isArray(flowdata[targetRow])) return;

      const sheetClone = {
        ...activeSheet,
        data: flowdata.map((row, index) => (index === targetRow ? row : [])),
      };

      if (syncCummBoqDerivedCells(luckysheet, sheetClone)) {
        if (Array.isArray(activeSheet.data) && Array.isArray(sheetClone.data[targetRow])) {
          activeSheet.data[targetRow] = sheetClone.data[targetRow];
        }
        if (Array.isArray(sheetClone.celldata)) {
          activeSheet.celldata = sheetClone.celldata;
        }
        if (typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
      }
    }, 80);
  }, []);

  const scheduleAmendRepair = React.useCallback((targetRow = null) => {
    window.clearTimeout(amendRepairTimeoutRef.current);
    amendRepairTimeoutRef.current = window.setTimeout(() => {
      const luckysheet = luckysheetRef.current;
      if (!luckysheet || typeof luckysheet.getAllSheets !== "function") return;

      const sheets = luckysheet.getAllSheets() || [];
      const activeSheet = sheets.find((sheet) => Number(sheet?.status) === 1);
      if (!activeSheet || !isAmendSheet(activeSheet)) return;

      if (targetRow == null) {
        if (syncAmendDerivedCells(luckysheet, activeSheet) && typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
        return;
      }

      const flowdata =
        typeof luckysheet.flowdata === "function"
          ? luckysheet.flowdata()
          : Array.isArray(activeSheet.data)
            ? activeSheet.data
            : null;
      if (!Array.isArray(flowdata) || !Array.isArray(flowdata[targetRow])) return;

      const sheetClone = {
        ...activeSheet,
        data: flowdata.map((row, index) => (index === targetRow ? row : [])),
      };

      if (syncAmendDerivedCells(luckysheet, sheetClone)) {
        if (Array.isArray(activeSheet.data) && Array.isArray(sheetClone.data[targetRow])) {
          activeSheet.data[targetRow] = sheetClone.data[targetRow];
        }
        if (Array.isArray(sheetClone.celldata)) {
          activeSheet.celldata = sheetClone.celldata;
        }
        if (typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
      }
    }, 80);
  }, []);

  const recalculateCummBoqRow = React.useCallback((r, c, _editedValue, isRefresh) => {
    if (isRefresh) return;
    if (c !== 3 && c !== 4) return;

    setTimeout(() => {
    requestAnimationFrame(() => {
      const luckysheet = luckysheetRef.current;
      if (!luckysheet || typeof luckysheet.getAllSheets !== "function") return;

      const sheets = luckysheet.getAllSheets() || [];
      const activeSheet = sheets.find((sheet) => Number(sheet?.status) === 1);
      if (!activeSheet) return;

      const flowdata =
        typeof luckysheet.flowdata === "function"
          ? luckysheet.flowdata()
          : Array.isArray(activeSheet.data)
            ? activeSheet.data
            : null;
      if (!Array.isArray(flowdata) || !Array.isArray(flowdata[r])) return;

      const rowData = flowdata[r];
      if (!isCummBoqSheet(activeSheet, rowData)) return;
      const prevCell = rowData[3];
      const currCell = rowData[4];
      const prev = asNumber(readLuckysheetCell(prevCell).value);
      const curr = asNumber(readLuckysheetCell(currCell).value);
      const sum = prev + curr;
      const phaseWeight = getCummBoqPhaseWeight(rowData);
      const rate = asNumber(readLuckysheetCell(rowData[10]).value);
      const prevBoq = prev * phaseWeight;
      const currBoq = curr * phaseWeight;
      const cummBoq = sum * phaseWeight;
      const prevAmt = prevBoq * rate;
      const currAmt = currBoq * rate;
      const cummAmt = cummBoq * rate;
      const formula = `=SUM(D${r + 1},E${r + 1})`;
      const nextFormulaCell = buildNumericFormulaCell(formula, sum);
      const nextBoqCurrCell = toLuckyCell(currBoq);
      const nextBoqCummCell = toLuckyCell(cummBoq);
      const nextAmountPrevCell = toLuckyCell(prevAmt);
      const nextAmountCurrCell = toLuckyCell(currAmt);
      const nextAmountCummCell = toLuckyCell(cummAmt);

      if (typeof luckysheet.setcellvalue === "function") {
        try {
          luckysheet.setcellvalue(r, 5, nextFormulaCell, {
            order: activeSheet.order,
            isRefresh: true,
          });
          luckysheet.setcellvalue(r, 7, nextBoqCurrCell, {
            order: activeSheet.order,
            isRefresh: true,
          });
          luckysheet.setcellvalue(r, 8, nextBoqCummCell, {
            order: activeSheet.order,
            isRefresh: true,
          });
          luckysheet.setcellvalue(r, 11, nextAmountPrevCell, {
            order: activeSheet.order,
            isRefresh: true,
          });
          luckysheet.setcellvalue(r, 12, nextAmountCurrCell, {
            order: activeSheet.order,
            isRefresh: true,
          });
          luckysheet.setcellvalue(r, 13, nextAmountCummCell, {
            order: activeSheet.order,
            isRefresh: true,
          });
        } catch {
          rowData[5] = nextFormulaCell;
          rowData[7] = nextBoqCurrCell;
          rowData[8] = nextBoqCummCell;
          rowData[11] = nextAmountPrevCell;
          rowData[12] = nextAmountCurrCell;
          rowData[13] = nextAmountCummCell;
        }
      } else {
        rowData[5] = nextFormulaCell;
        rowData[7] = nextBoqCurrCell;
        rowData[8] = nextBoqCummCell;
        rowData[11] = nextAmountPrevCell;
        rowData[12] = nextAmountCurrCell;
        rowData[13] = nextAmountCummCell;
      }

      rowData[5] = nextFormulaCell;
      rowData[7] = nextBoqCurrCell;
      rowData[8] = nextBoqCummCell;
      rowData[11] = nextAmountPrevCell;
      rowData[12] = nextAmountCurrCell;
      rowData[13] = nextAmountCummCell;
      if (Array.isArray(activeSheet.data) && Array.isArray(activeSheet.data[r])) {
        activeSheet.data[r][5] = nextFormulaCell;
        activeSheet.data[r][7] = nextBoqCurrCell;
        activeSheet.data[r][8] = nextBoqCummCell;
        activeSheet.data[r][11] = nextAmountPrevCell;
        activeSheet.data[r][12] = nextAmountCurrCell;
        activeSheet.data[r][13] = nextAmountCummCell;
      }

      if (Array.isArray(activeSheet.celldata)) {
        [
          [5, nextFormulaCell],
          [7, nextBoqCurrCell],
          [8, nextBoqCummCell],
          [11, nextAmountPrevCell],
          [12, nextAmountCurrCell],
          [13, nextAmountCummCell],
        ].forEach(([colIndex, nextCell]) => {
          const existing = activeSheet.celldata.find((entry) => entry && entry.r === r && entry.c === colIndex);
          if (existing) {
            existing.v = nextCell;
          } else {
            activeSheet.celldata.push({ r, c: colIndex, v: nextCell });
          }
        });
      }

      if (typeof luckysheet.luckysheetrefreshgrid === "function") {
        luckysheet.luckysheetrefreshgrid();
      }
    });
    }, 0);
    scheduleCummBoqRepair(r);
  }, [scheduleCummBoqRepair]);

  const recalculateAmendRow = React.useCallback((r, c, _editedValue, isRefresh) => {
    if (isRefresh) return;
    if (c !== 2 && c !== 4) return;

    setTimeout(() => {
      requestAnimationFrame(() => {
        const luckysheet = luckysheetRef.current;
        if (!luckysheet || typeof luckysheet.getAllSheets !== "function") return;

        const sheets = luckysheet.getAllSheets() || [];
        const activeSheet = sheets.find((sheet) => Number(sheet?.status) === 1);
        if (!activeSheet || !isAmendSheet(activeSheet)) return;

        const flowdata =
          typeof luckysheet.flowdata === "function"
            ? luckysheet.flowdata()
            : Array.isArray(activeSheet.data)
              ? activeSheet.data
              : null;
        if (!Array.isArray(flowdata) || !Array.isArray(flowdata[r])) return;

        const rowData = flowdata[r];
        if (!isAmendDataRow(rowData)) return;

        const qty = asNumber(readLuckysheetCell(rowData[2]).value);
        const rate = asNumber(readLuckysheetCell(rowData[4]).value);
        const amount = qty * rate;
        const nextFormulaCell = buildNumericFormulaCell(`=C${r + 1}*E${r + 1}`, amount);

        if (typeof luckysheet.setcellvalue === "function") {
          try {
            luckysheet.setcellvalue(r, 5, nextFormulaCell, {
              order: activeSheet.order,
              isRefresh: true,
            });
          } catch {
            rowData[5] = nextFormulaCell;
          }
        } else {
          rowData[5] = nextFormulaCell;
        }

        rowData[5] = nextFormulaCell;
        if (Array.isArray(activeSheet.data) && Array.isArray(activeSheet.data[r])) {
          activeSheet.data[r][5] = nextFormulaCell;
        }

        if (Array.isArray(activeSheet.celldata)) {
          const existing = activeSheet.celldata.find((entry) => entry && entry.r === r && entry.c === 5);
          if (existing) {
            existing.v = nextFormulaCell;
          } else {
            activeSheet.celldata.push({ r, c: 5, v: nextFormulaCell });
          }
        }

        if (typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
      });
    }, 0);
    scheduleAmendRepair(r);
  }, [scheduleAmendRepair]);

  const recalculateHiranandaniSignLink = React.useCallback((r, c, editedValue, isRefresh) => {
    if (isRefresh) return;
    if (r < 0 || c < 0 || c > 11) return;

    setTimeout(() => {
      requestAnimationFrame(() => {
        const luckysheet = luckysheetRef.current;
        if (!luckysheet) return;

        const sheets = getLuckysheetSheets(luckysheet);
        const activeSheet = sheets.find((sheet) => Number(sheet?.status) === 1);
        const activeName = String(activeSheet?.name || "").trim().toLowerCase();
        if (activeName !== "abstract") return;

        if (syncHiranandaniSignCellFromAbstract(luckysheet, r, c, editedValue) && typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
      });
    }, 0);
  }, []);

  const initLuckysheet = React.useCallback(async (sheets, hook) => {
    if (!depsRef.current.dollar) {
      const jq = await import("jquery");
      const dollar = jq?.default || jq;
      depsRef.current.dollar = dollar;
      globalThis.$ = dollar;
      globalThis.jQuery = dollar;
      const mw = await import("jquery-mousewheel");
      const attachMousewheel = mw?.default || mw;
      if (typeof attachMousewheel === "function") {
        attachMousewheel(dollar);
      }
    }

    if (!depsRef.current.luckysheet) {
      const mod = await import("luckysheet");
      depsRef.current.luckysheet = mod?.default || mod;
    }

    if (!depsRef.current.pluginsLoaded) {
      await import("luckysheet/dist/plugins/js/plugin.js");
      depsRef.current.pluginsLoaded = true;
    }

    const luckysheet = depsRef.current.luckysheet;

    if (luckysheetRef.current && typeof luckysheetRef.current.destroy === "function") {
      try {
        luckysheetRef.current.destroy();
      } catch {
        null;
      }
    }

    const el = document.getElementById(containerId);
    if (el) el.innerHTML = "";

    luckysheetRef.current = luckysheet;
    const mergedHook = {
      ...(hook || {}),
      cellUpdateBefore: (r, c, value, isRefresh) => {
        recalculateCummBoqRow(r, c, value, isRefresh);
        recalculateAmendRow(r, c, value, isRefresh);
        recalculateHiranandaniSignLink(r, c, value, isRefresh);
        if (typeof hook?.cellUpdateBefore === "function") {
          hook.cellUpdateBefore(r, c, value, isRefresh);
        }
      },
      cellUpdated: (r, c, oldValue, newValue, isRefresh) => {
        recalculateCummBoqRow(r, c, newValue, isRefresh);
        recalculateAmendRow(r, c, newValue, isRefresh);
        recalculateHiranandaniSignLink(r, c, newValue, isRefresh);
        if (typeof hook?.cellUpdated === "function") {
          hook.cellUpdated(r, c, oldValue, newValue, isRefresh);
        }
      },
      updated: (operate) => {
        scheduleCummBoqRepair(null);
        scheduleAmendRepair(null);
        setTimeout(() => {
          requestAnimationFrame(() => {
            if (ensureHiranandaniSignFormulaLinks(luckysheet) && typeof luckysheet.luckysheetrefreshgrid === "function") {
              luckysheet.luckysheetrefreshgrid();
            }
          });
        }, 0);
        if (typeof hook?.updated === "function") {
          hook.updated(operate);
        }
      },
    };

    luckysheet.create({
      container: containerId,
      title: workbookTitle ?? title,
      showtoolbar: true,
      showsheetbar: true,
      showinfobar: true,
      showstatisticBar: true,
      sheetFormulaBar: true,
      enableAddBackTop: false,
      allowEdit: true,
      forceCalculation: true,
      forceCaculate: true,
      data: sheets,
      hook: mergedHook,
    });

    setTimeout(() => {
      requestAnimationFrame(() => {
        if (ensureHiranandaniSignFormulaLinks(luckysheet) && typeof luckysheet.luckysheetrefreshgrid === "function") {
          luckysheet.luckysheetrefreshgrid();
        }
      });
    }, 0);
  }, [containerId, title, workbookTitle, recalculateAmendRow, recalculateCummBoqRow, recalculateHiranandaniSignLink, scheduleAmendRepair, scheduleCummBoqRepair]);

  const fetchWorkbookSectionMatrices = React.useCallback(
    async (sectionKey) => {
      const baseUrl = (import.meta.env.VITE_API_BASE_URL || "https://api.madhuram.enterprises").replace(/\/$/, "");
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const fetchJson = async (url) => {
        const res = await fetch(url, { headers });
        const contentType = res.headers.get("content-type") || "";
        const body = contentType.includes("application/json") ? await res.json() : await res.text();
        if (!res.ok) {
          const error = body?.error || body?.message || res.statusText || "Request failed";
          throw new Error(error);
        }
        if (body && typeof body === "object" && "data" in body && "success" in body) {
          if (!body.success) throw new Error(body.error || "Request failed");
          return body.data;
        }
        return body;
      };

      if (sectionKey === "PurchaseOrders") {
        const pos = normalizeToArray(await fetchJson(`${baseUrl}/api/po/project/${projectId}`));
        const poRows = pos.map((po) => {
          if (!isPlainObject(po)) return po;
          const { items, ...rest } = po;
          return flattenRecord(rest, { maxDepth: 2 });
        });
        return new Map([["PurchaseOrders", datasetToMatrix(poRows)]]);
      }

      if (sectionKey === "DeliveryChallans") {
        const dcs = normalizeToArray(await fetchJson(`${baseUrl}/api/dc/project/${projectId}`));
        const dcRows = dcs.map((dc) => {
          if (!isPlainObject(dc)) return dc;
          const { items, ...rest } = dc;
          return flattenRecord(rest, { maxDepth: 2 });
        });
        return new Map([["DeliveryChallans", datasetToMatrix(dcRows)]]);
      }

      if (sectionKey === "BOQ") {
        const raw = await fetchJson(`${baseUrl}/api/boq/project/${projectId}`);
        let project = projectDataRef.current;
        if (!project) {
          try {
            project = await fetchProjectData(projectId);
            projectDataRef.current = project;
          } catch {
            project = null;
          }
        }
        return new Map([["WO", buildBoqMatrix(raw, project)]]);
      }

      if (sectionKey === "Invoice") {
        let project = projectDataRef.current;
        if (!project) {
          try {
            project = await fetchProjectData(projectId);
            projectDataRef.current = project;
          } catch {
            project = null;
          }
        }
        return new Map([["Inv", buildInvoiceMatrix(project)]]);
      }

      if (sectionKey === "CPVC") {
        let project = projectDataRef.current;
        if (!project) {
          try {
            project = await fetchProjectData(projectId);
            projectDataRef.current = project;
          } catch {
            project = null;
          }
        }
        return new Map([["CPVC", buildCpvcMatrix(project)]]);
      }

      if (sectionKey === "QTY") {
        const dcs = await fetchJson(`${baseUrl}/api/dc/project/${projectId}`);
        return new Map([["QTY", buildQtyMatrix(dcs)]]);
      }

      if (sectionKey === "Abstract") {
        const dcs = await fetchJson(`${baseUrl}/api/dc/project/${projectId}`);
        let project = projectDataRef.current;
        if (!project) {
          try {
            project = await fetchProjectData(projectId);
            projectDataRef.current = project;
          } catch {
            project = null;
          }
        }
        return new Map([["Abstract", buildAbstractMatrix(project, dcs)]]);
      }

      if (sectionKey === "MIR") {
        const mirs = normalizeToArray(await fetchJson(`${baseUrl}/api/mir/project/${projectId}`));
        const mirRows = mirs.map((mir) => {
          if (!isPlainObject(mir)) return mir;
          const { items, dynamic_field, ...rest } = mir;
          return flattenRecord(rest, { maxDepth: 2 });
        });
        return new Map([["MIR", datasetToMatrix(mirRows)]]);
      }

      if (sectionKey === "ITR") {
        const itrs = await fetchJson(`${baseUrl}/api/itr/project/${projectId}`);
        return new Map([["ITR", datasetToMatrix(itrs)]]);
      }

      if (sectionKey === "Samples") {
        const samples = await fetchJson(`${baseUrl}/api/sample/project/${projectId}`);
        let project = projectDataRef.current;
        if (!project) {
          try {
            project = await fetchProjectData(projectId);
            projectDataRef.current = project;
          } catch {
            project = null;
          }
        }
        return new Map([["Abstract", buildSamplesMatrix(samples, project)]]);
      }

      if (sectionKey === "Inventory") {
        const inventory = await fetchJson(`${baseUrl}/api/inventory/project/${projectId}`);
        return new Map([["Inventory", datasetToMatrix(inventory)]]);
      }

      if (sectionKey === "Vendors") {
        const vendors = normalizeToArray(await fetchJson(`${baseUrl}/api/vendors`));
        return new Map([["Vendors", datasetToMatrix(vendors)]]);
      }

      return new Map();
    },
    [projectId],
  );

  const handleSheetActivate = React.useCallback(
    async (sheetIndex) => {
      if (recreatingRef.current) return;
      const luckysheet = luckysheetRef.current;
      if (!luckysheet || typeof luckysheet.getAllSheets !== "function") return;

      const sheets = luckysheet.getAllSheets() || [];
      const sheet = sheets[sheetIndex];
      const sheetName = sheet?.name;
      if (!sheetName) return;

      const rawName = sheetNameToRawRef.current.get(sheetName) ?? null;
      const sectionKey = sheetNameToSectionRef.current.get(sheetName) ?? sectionKeyForRawSheetName(rawName);
      if (!sectionKey || sectionKey === "Project" || sectionKey === "Summary") return;
      if (loadedSectionsRef.current.has(sectionKey) || loadingSectionRef.current.has(sectionKey)) return;

      loadingSectionRef.current.add(sectionKey);
      setLoading(true);
      setError("");
      try {
        const matrices = await fetchWorkbookSectionMatrices(sectionKey);

        const updatedSheets = sheets.map((s, idx) => {
          const next = { ...s, status: idx === sheetIndex ? 1 : 0 };
          const raw = sheetNameToRawRef.current.get(s?.name);
          if (!raw || !matrices.has(raw)) return next;
          const matrix = matrices.get(raw);
          const rebuilt = buildLuckySheetFromMatrix(next.name, matrix, Number(next.order ?? idx));
          return { ...next, row: rebuilt.row, column: rebuilt.column, celldata: rebuilt.celldata, config: rebuilt.config, data: [] };
        });

        recreatingRef.current = true;
        try {
          await initLuckysheet(updatedSheets, {
            sheetActivateAfter: (i) => {
              handleSheetActivate(i);
            },
          });
        } finally {
          recreatingRef.current = false;
        }

        loadedSectionsRef.current.add(sectionKey);
      } catch (e) {
        setError(e?.message || "Failed to load sheet data");
      } finally {
        loadingSectionRef.current.delete(sectionKey);
        setLoading(false);
      }
    },
    [fetchWorkbookSectionMatrices, initLuckysheet],
  );

  React.useEffect(() => {
    let cancelled = false;
    let frameId = null;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        loadedSectionsRef.current = new Set();
        loadingSectionRef.current = new Set();
        sheetNameToRawRef.current = new Map();
        sheetNameToSectionRef.current = new Map();

        if (workbookData) {
          const customSheets = buildWorkbookSheetMatrices(workbookData);
          customSheets.forEach((s) => {
            sheetNameToRawRef.current.set(s.name, s.name);
            sheetNameToSectionRef.current.set(s.name, "Custom");
          });

          const luckySheets = customSheets.map((s, i) => buildLuckySheetFromMatrix(s.name, s.matrix, i));
          if (!cancelled) {
            await initLuckysheet(luckySheets, {});
          }
          return;
        }

        const project = await fetchProjectData(projectId);
        projectDataRef.current = project;
        const { sheets, rawToSheetName } = buildInitialWorkbookSheets(project);

        sheets.forEach((s) => {
          sheetNameToRawRef.current.set(s.name, s.rawName);
          sheetNameToSectionRef.current.set(s.name, sectionKeyForRawSheetName(s.rawName));
        });

        rawToSheetName.forEach((sheetName, rawName) => {
          sheetNameToRawRef.current.set(sheetName, rawName);
          sheetNameToSectionRef.current.set(sheetName, sectionKeyForRawSheetName(rawName));
        });

        const luckySheets = sheets.map((s, i) => buildLuckySheetFromMatrix(s.name, s.matrix, i));
        if (!cancelled) {
          await initLuckysheet(luckySheets, {
            sheetActivate: (i) => {
              handleSheetActivate(i);
            },
            sheetActivateAfter: (i) => {
              handleSheetActivate(i);
            },
          });
          // Attempt eager data load for all sections so tabs show fields immediately
          try {
            const fullWorkbook = await fetchProjectWorkbookData(projectId);
            const fullSheets = buildWorkbookSheetMatrices(fullWorkbook).map((s, i) =>
              buildLuckySheetFromMatrix(s.name, s.matrix, i),
            );
            await initLuckysheet(fullSheets, {
              sheetActivate: (i) => {
                handleSheetActivate(i);
              },
              sheetActivateAfter: (i) => {
                handleSheetActivate(i);
              },
            });
          } catch {
            null;
          }
          // No extra tabs beyond sidebar; don't mark any default section as loaded
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to load project data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!workbookData && !projectId) {
      setLoading(false);
      setError("Project id is missing.");
      return () => {
        cancelled = true;
      };
    }

    frameId = window.requestAnimationFrame(() => {
      load();
    });
    return () => {
      cancelled = true;
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
      if (luckysheetRef.current?.destroy) {
        try {
          luckysheetRef.current.destroy();
        } catch {
          null;
        }
      }
    };
  }, [projectId, workbookData, initLuckysheet, handleSheetActivate]);

  const downloadExcel = React.useCallback(() => {
    const luckysheet = luckysheetRef.current;
    const getter =
      luckysheet?.getLuckysheetfile ||
      luckysheet?.getLuckysheetFile ||
      luckysheet?.getLuckysheetfile?.bind(luckysheet) ||
      null;

    const file =
      typeof getter === "function"
        ? getter()
        : typeof luckysheet?.getAllSheets === "function"
          ? luckysheet.getAllSheets()
          : null;

    if (!file) return;
    const workbook = buildWorkbookFromLuckysheetFile(file);
    const filename = downloadFilename || `project-${projectId}-workbook.xlsx`;
    XLSX.writeFile(workbook, filename, { compression: true });
  }, [downloadFilename, projectId]);

  const getLuckysheetFile = React.useCallback(() => {
    const luckysheet = luckysheetRef.current;
    const getter =
      luckysheet?.getLuckysheetfile ||
      luckysheet?.getLuckysheetFile ||
      luckysheet?.getLuckysheetfile?.bind(luckysheet) ||
      null;

    return typeof getter === "function"
      ? getter()
      : typeof luckysheet?.getAllSheets === "function"
        ? luckysheet.getAllSheets()
        : null;
  }, []);

  React.useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      downloadExcel,
      getLuckysheetFile,
    };
    return () => {
      if (apiRef.current) {
        apiRef.current = null;
      }
    };
  }, [apiRef, downloadExcel, getLuckysheetFile]);

  React.useEffect(() => {
    return () => {
      if (cummBoqRepairTimerRef.current != null) {
        window.clearTimeout(cummBoqRepairTimerRef.current);
      }
    };
  }, []);

  const body = error ? (
    <div className="p-6 text-sm text-destructive">{error}</div>
  ) : (
    <div className={bodyClassName ?? "relative h-[calc(100vh-12rem)] w-full"}>
      {loading && <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-sm" />}
      <div id={containerId} className="h-full w-full" />
    </div>
  );

  if (!showHeader) {
    return (
      <div className={wrapperClassName ?? "h-full w-full"}>
        {showDownload && (
          <div className="fixed right-4 top-4 z-50">
            <Button variant="outline" onClick={downloadExcel} disabled={loading || Boolean(error)}>
              Download Excel
            </Button>
          </div>
        )}
        {body}
      </div>
    );
  }

  return (
    <Card className={wrapperClassName ?? "h-[calc(100vh-8rem)]"}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        {showDownload && (
          <Button onClick={downloadExcel} disabled={loading || Boolean(error)}>
            Download Excel
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {body}
      </CardContent>
    </Card>
  );
}
