import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { parseComparisonWorkbook } from "@/lib/vendorComparisonParser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { getPrItemDescription, getPrItemNo, matchAgainstPrItems } from "@/lib/prItemMatcher";

const ACCEPTED_UPLOAD_TYPES = ".pdf,.csv,.xlsx,.xls";

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

const normalizeItemText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getPrItemKey = (item, index = 0) => {
  const description = normalizeItemText(getPrItemDescription(item));
  const unit = normalizeItemText(item?.unit ?? "");
  const qty = normalizeItemText(item?.req_qty ?? item?.qty ?? item?.quantity ?? "");
  const make = normalizeItemText(item?.make ?? "");
  const key = [description, unit, qty, make].filter(Boolean).join("|");
  return key || `row-${index}`;
};

const parseArrayLike = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  if (value && typeof value === "object") {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.rows)) return value.rows;
    if (Array.isArray(value.results)) return value.results;
  }
  return fallback;
};

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toTrimmed = (value) => String(value ?? "").replace(/\u00A0/g, " ").trim();

const normalizeVendorKey = (value) =>
  toTrimmed(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const findExistingVendorByName = (vendors, vendorName) => {
  const targetKey = normalizeVendorKey(vendorName);
  if (!targetKey) return null;
  return (Array.isArray(vendors) ? vendors : []).find((row) => normalizeVendorKey(row?.vendor_name) === targetKey) || null;
};

const getVendorId = (vendor) => {
  const rawId = vendor?.vendor_id ?? vendor?.id ?? null;
  if (rawId === null || rawId === undefined || rawId === "") return null;
  const numericId = Number(rawId);
  return Number.isFinite(numericId) ? numericId : null;
};

const buildVendorLookupMap = (vendors = []) => {
  const map = new Map();
  (Array.isArray(vendors) ? vendors : []).forEach((vendor) => {
    const vendorName = String(vendor?.vendor_name ?? vendor?.vendorName ?? vendor?.name ?? "").trim();
    const vendorId = getVendorId(vendor);
    if (!vendorName && vendorId === null) return;
    if (vendorName) map.set(normalizeVendorKey(vendorName), { vendor_id: vendorId, vendor_name: vendorName });
    if (vendorId !== null) map.set(String(vendorId), { vendor_id: vendorId, vendor_name: vendorName });
  });
  return map;
};

const resolveVendorIdentity = (vendorLookupMap, vendorName) => {
  const key = normalizeVendorKey(vendorName);
  if (!key) return { vendor_id: null, vendor_name: String(vendorName || "").trim() };
  return vendorLookupMap?.get(key) || { vendor_id: null, vendor_name: String(vendorName || "").trim() };
};

const toPositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getPrIdValue = (pr = {}, fallback = null) => toPositiveInteger(pr?.pr_id ?? pr?.id ?? fallback);

const getPrNumberValue = (pr = {}) => toPositiveInteger(pr?.pr_no ?? pr?.pr_number ?? pr?.prNo ?? null);

const buildVendorDraft = (vendorName, vendor = null) => ({
  source_name: vendorName,
  vendor_name: String(vendor?.vendor_name || vendorName || "").trim(),
  vendor_company_name: String(vendor?.vendor_company_name || "").trim(),
  vendor_email: String(vendor?.vendor_email || "").trim(),
  mobile_number: String(vendor?.mobile_number || "").trim(),
  location: String(vendor?.location || "").trim(),
  status: String(vendor?.status || "active").trim() || "active",
});

const buildVendorPayload = (draft) => ({
  vendor_name: String(draft?.vendor_name || "").trim(),
  vendor_company_name: String(draft?.vendor_company_name || "").trim(),
  vendor_email: String(draft?.vendor_email || "").trim(),
  mobile_number: String(draft?.mobile_number || "").trim(),
  location: String(draft?.location || "").trim(),
  status: String(draft?.status || "active").trim() || "active",
});

const isFilledText = (value) => String(value ?? "").trim().length > 0;

const isValidVendorEmail = (value) => {
  const email = String(value ?? "").trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isVendorDraftComplete = (draft = {}) =>
  isFilledText(draft.vendor_name) &&
  isFilledText(draft.vendor_company_name) &&
  isValidVendorEmail(draft.vendor_email) &&
  isFilledText(draft.mobile_number) &&
  isFilledText(draft.location);

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const formatMoney = (value) => {
  const n = toNumberOrNull(value);
  if (n === null) return "-";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const mergeWithPrItems = (excelRows, vendors, prItems) => {
  const comparisonRows = excelRows
    .map((row) => {
      const prMatchResult = matchAgainstPrItems(row, prItems);
      const prMatch = prMatchResult.matchedPrItem || null;
      if (!prMatch) return null;
      const canonical = getPrItemDescription(prMatch) || row.item_description;
      const itemNo = getPrItemNo(prMatch) || String(row?.item_no || row?.itemNo || "").trim();
      const unit = String(prMatch?.unit ?? row?.unit ?? "").trim();

      return {
        sr_no: row.sr_no,
        hsn_code: row.hsn_code,
        item_no: itemNo,
        material_description: canonical,
        qty: row.qty,
        unit,
        matchStatus: prMatchResult.matchStatus,
        matchedPrItem: prMatch,
        matchType: prMatchResult.matchType,
        matchScore: prMatchResult.matchScore,
        vendorPrices: vendors.map((vendorName) => {
          const found = row.vendorPrices.find((p) => p.vendorName === vendorName) || { vendorName, rate: null, amount: null };
          return { vendorName, rate: found.rate, amount: found.amount };
        }),
      };
    })
    .filter(Boolean);

  return comparisonRows;
};

const calculateTotals = (comparisonRows, vendors, summary = null, { discountRate = 0, gstRate = 0.18 } = {}) => {
  const subtotals = vendors.map(() => 0);
  const discountRates = vendors.map(() => discountRate);
  const gstRates = vendors.map(() => gstRate);

  const summaryRows = {
    subtotal: Array.isArray(summary?.subtotal) ? summary.subtotal : null,
    discount: Array.isArray(summary?.discount) ? summary.discount : null,
    gst: Array.isArray(summary?.gst) ? summary.gst : null,
    totalValue: Array.isArray(summary?.totalValue) ? summary.totalValue : null,
  };

  if (summaryRows.subtotal && summaryRows.discount && summaryRows.gst && summaryRows.totalValue) {
    return {
      subtotals: vendors.map((_, idx) => toNumberOrNull(summaryRows.subtotal[idx]?.amount) ?? 0),
      discount: vendors.map((_, idx) => toNumberOrNull(summaryRows.discount[idx]?.amount) ?? 0),
      gst: vendors.map((_, idx) => toNumberOrNull(summaryRows.gst[idx]?.amount) ?? 0),
      total: vendors.map((_, idx) => toNumberOrNull(summaryRows.totalValue[idx]?.amount) ?? 0),
      discountRates: vendors.map((_, idx) => toNumberOrNull(summaryRows.discount[idx]?.rate)),
      gstRates: vendors.map((_, idx) => toNumberOrNull(summaryRows.gst[idx]?.rate)),
      summarySource: "parsed",
    };
  }

  comparisonRows.forEach((row) => {
    row.vendorPrices.forEach((p, idx) => {
      const amount = toNumberOrNull(p.amount);
      const rate = toNumberOrNull(p.rate);
      const qty = toNumberOrNull(row.qty);
      const computed = amount ?? (rate !== null && qty !== null ? rate * qty : 0);
      subtotals[idx] += computed || 0;
    });
  });

  const discount = subtotals.map((s) => s * discountRate);
  const afterDiscount = subtotals.map((s, idx) => s - discount[idx]);
  const gst = afterDiscount.map((s) => s * gstRate);
  const total = afterDiscount.map((s, idx) => s + gst[idx]);

  return { subtotals, discount, gst, total, discountRates, gstRates, summarySource: "computed" };
};

const getPricelistRows = (comparison) =>
  parseArrayLike(
    comparison?.pricelist ?? comparison?.price_list ?? comparison?.priceList ?? comparison?.items,
    []
  );

const getUniqueVendorsFromPricelist = (pricelist) =>
  Array.from(
    new Set(
      (Array.isArray(pricelist) ? pricelist : [])
        .map((row) => String(row?.vendor_name ?? row?.vendorName ?? row?.vendor ?? "").trim())
        .filter(Boolean)
    )
  );

const getApprovedVendorName = (comparison) =>
  (() => {
    const explicitName = String(comparison?.approved_vendor_name ?? comparison?.approvedVendorName ?? "").trim();
    if (explicitName) return explicitName;
    const fallback = String(comparison?.approved_vendor ?? "").trim();
    if (!fallback) return "";
    return /^\d+$/.test(fallback) ? "" : fallback;
  })();

const buildPricelistFromRows = (comparisonRows, vendorLookupMap = new Map(), approvedVendorName = "") =>
  (Array.isArray(comparisonRows) ? comparisonRows : [])
    .flatMap((row) => {
      const qtyRaw = row?.qty ?? "";
      const qty = qtyRaw == null ? null : qtyRaw;
      const itemDescription = String(row?.material_description ?? row?.item_description ?? "").trim();
      const itemNo = String(row?.item_no ?? row?.itemNo ?? getPrItemNo(row?.matchedPrItem) ?? "").trim();
      if (!itemDescription) return [];
      const vendorPrices = Array.isArray(row?.vendorPrices) ? row.vendorPrices : [];
      const approvedKey = normalizeVendorKey(approvedVendorName);
      const selectedPrice = vendorPrices.find((vp) => normalizeVendorKey(vp?.vendorName ?? "") === approvedKey) || null;
      if (!selectedPrice) return [];
      const vendorName = String(selectedPrice?.vendorName ?? "").trim();
      if (!vendorName) return [];
      const vendorIdentity = resolveVendorIdentity(vendorLookupMap, vendorName);
      if (vendorIdentity.vendor_id === null) return [];
      return [
        {
          vendor_id: vendorIdentity.vendor_id,
          vendor_name: vendorIdentity.vendor_name || vendorName,
          item_no: itemNo,
          item_description: itemDescription,
          total_qty: toNumberOrNull(qty),
          rate: toNumberOrNull(selectedPrice?.rate),
          amount: toNumberOrNull(selectedPrice?.amount),
        },
      ];
    })
    .filter(Boolean);

const getComparisonIdValue = (comparison) =>
  comparison?.id ?? comparison?.comparison_id ?? comparison?.vendor_comparison_id ?? comparison?.comparisonId ?? null;

const buildComparisonFromPricelist = (comparison) => {
  const pricelist = parseArrayLike(comparison?.pricelist ?? comparison?.price_list ?? comparison?.priceList, []);
  if (!Array.isArray(pricelist) || pricelist.length === 0) {
    return { vendors: [], comparisonRows: [] };
  }

  const vendorSet = new Set();
  const itemMap = new Map();

  const getVendor = (row) => String(row?.vendor_name ?? row?.vendorName ?? row?.vendor ?? "").trim();
  const getDesc = (row) =>
    String(row?.item_description ?? row?.itemDescription ?? row?.description ?? row?.item_name ?? "").trim();
  const getHsn = (row) => String(row?.hsn ?? row?.hsn_code ?? row?.hsnCode ?? "").trim();
  const getUnit = (row) => String(row?.unit ?? row?.uom ?? row?.UOM ?? "").trim();

  pricelist.forEach((row) => {
    const vendorName = getVendor(row);
    const desc = getDesc(row) || "Unnamed Item";
    const hsn = getHsn(row);
    const unit = getUnit(row);
    const itemNo = String(row?.item_no ?? row?.itemNo ?? "").trim();
    const qty = toNumberOrNull(row?.total_qty ?? row?.qty ?? row?.quantity) ?? row?.total_qty ?? row?.qty ?? row?.quantity ?? null;
    const rate = toNumberOrNull(row?.rate);
    const amount = toNumberOrNull(row?.amount);

    if (vendorName) vendorSet.add(vendorName);

    const key = `${normalizeText(desc)}||${normalizeText(hsn)}||${normalizeText(unit)}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        material_description: desc,
        item_no: itemNo,
        hsn_code: hsn,
        unit,
        qtys: [],
        byVendor: new Map(),
      });
    }
    const entry = itemMap.get(key);
    if (!entry.item_no && itemNo) entry.item_no = itemNo;
    if (qty !== null && qty !== undefined && qty !== "") entry.qtys.push(qty);
    if (vendorName) entry.byVendor.set(vendorName, { vendorName, rate, amount });
  });

  const vendors = Array.from(vendorSet);
  const comparisonRows = Array.from(itemMap.values()).map((item, index) => {
    const qtyNumeric = item.qtys.map((v) => toNumberOrNull(v)).filter((v) => v !== null);
    const qty = qtyNumeric.length > 0 ? Math.max(...qtyNumeric) : item.qtys.find((v) => v !== null && v !== undefined) ?? null;
    return {
      sr_no: index + 1,
      item_no: item.item_no || "",
      hsn_code: item.hsn_code,
      material_description: item.material_description,
      qty,
      unit: item.unit,
      vendorPrices: vendors.map((vendorName) => {
        const hit = item.byVendor.get(vendorName) || { vendorName, rate: null, amount: null };
        return { vendorName, rate: hit.rate ?? null, amount: hit.amount ?? null };
      }),
    };
  });

  return { vendors, comparisonRows };
};

const buildExportWorkbook = ({ pr, vendors, comparisonRows, summary = null }) => {
  const vendorNames = (Array.isArray(vendors) ? vendors : []).map((vendor) =>
    typeof vendor === "string" ? vendor : String(vendor?.displayName || vendor?.name || "").trim()
  );
  const companyLine = "Company Name:- Madhuram Enterprises";
  const projectLine = `Project Name:- ${pr?.project_name || ""}`;
  const indentNoLine = `Indent No:- ${pr?.workorder_no || ""}`;
  const indentDateLine = `Indent Date:- ${pr?.date || ""}`;
  const comparisonDateLine = `Comparison Date:- ${todayISO()}`;

  const totals = calculateTotals(comparisonRows, vendorNames, summary);

  const vendorHeaderRow = ["", "", "", "", "", ""];
  vendorNames.forEach((name) => {
    vendorHeaderRow.push(name);
    vendorHeaderRow.push("");
  });

  const columnHeaderRow = ["Sr. No", "Item No", "HSN Code", "Item Description", "Qty", "UOM"];
  vendorNames.forEach(() => {
    columnHeaderRow.push("Rate");
    columnHeaderRow.push("Amount");
  });

  const itemRows = comparisonRows.map((row) => {
    const base = [
      row.sr_no,
      row.item_no || "",
      row.hsn_code,
      row.material_description,
      row.qty,
      row.unit,
    ];
    vendors.forEach((vendorName) => {
      const p = row.vendorPrices.find((x) => x.vendorName === vendorName) || {};
      base.push(p.rate ?? "");
      base.push(p.amount ?? "");
    });
    return base;
  });

  const subtotalRow = ["", "", "", "", "Subtotal", ""];
  totals.subtotals.forEach((v) => {
    subtotalRow.push("");
    subtotalRow.push(v);
  });
  const discountRow = ["", "", "", "", "Discount", ""];
  totals.discount.forEach((v) => {
    discountRow.push("");
    discountRow.push(v);
  });
  const gstRow = ["", "", "", "", "GST", ""];
  totals.gst.forEach((v) => {
    gstRow.push("");
    gstRow.push(v);
  });
  const totalRow = ["", "", "", "", "Total Value", ""];
  totals.total.forEach((v) => {
    totalRow.push("");
    totalRow.push(v);
  });

  const rows = [
    [companyLine],
    [projectLine],
    [indentNoLine],
    [indentDateLine],
    [comparisonDateLine],
    vendorHeaderRow,
    columnHeaderRow,
    ...itemRows,
    subtotalRow,
    discountRow,
    gstRow,
    totalRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const mergeRanges = [];
  vendorNames.forEach((_, idx) => {
    mergeRanges.push({ s: { r: 5, c: 6 + idx * 2 }, e: { r: 5, c: 7 + idx * 2 } });
  });
  ws["!merges"] = mergeRanges;

  const lastCol = 5 + vendors.length * 2;
  ws["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 60 },
    { wch: 10 },
    { wch: 10 },
    ...Array.from({ length: vendorNames.length * 2 }, (_, idx) => ({ wch: idx % 2 === 0 ? 14 : 16 })),
  ];

  const headerFill = { fgColor: { rgb: "1F4E79" } };
  const headerFont = { bold: true, color: { rgb: "FFFFFF" } };
  const border = {
    top: { style: "thin", color: { rgb: "9AA7B2" } },
    bottom: { style: "thin", color: { rgb: "9AA7B2" } },
    left: { style: "thin", color: { rgb: "9AA7B2" } },
    right: { style: "thin", color: { rgb: "9AA7B2" } },
  };
  const centered = { horizontal: "center", vertical: "center", wrapText: true };
  const leftWrap = { horizontal: "left", vertical: "center", wrapText: true };

  const applyCellStyle = (r, c, style) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = { ...(ws[ref].s || {}), ...style };
  };

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) continue;
      applyCellStyle(r, c, { border });
    }
  }

  for (let r = 0; r <= 4; r += 1) {
    applyCellStyle(r, 0, { font: { bold: true }, alignment: leftWrap });
  }

  for (let c = 0; c <= lastCol; c += 1) {
    applyCellStyle(5, c, { font: headerFont, fill: headerFill, alignment: centered });
    applyCellStyle(6, c, { font: headerFont, fill: headerFill, alignment: centered });
  }

  for (let r = 7; r < 7 + itemRows.length; r += 1) {
    applyCellStyle(r, 0, { alignment: centered });
    applyCellStyle(r, 1, { alignment: centered });
    applyCellStyle(r, 2, { alignment: centered });
    applyCellStyle(r, 3, { alignment: leftWrap });
    applyCellStyle(r, 4, { alignment: centered });
    applyCellStyle(r, 5, { alignment: centered });
    for (let c = 6; c <= lastCol; c += 1) {
      applyCellStyle(r, c, { alignment: centered });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vendor Comparison");
  return wb;
};

const DEFAULT_DOWNLOAD_VENDORS = ["Vendor 1", "Vendor 2", "Vendor 3", "Vendor 4"];

const CATEGORY_FIELDS = [
  "category",
  "category_name",
  "categoryName",
  "group",
  "group_name",
  "groupName",
  "section",
  "section_name",
  "sectionName",
  "item_category",
  "itemCategory",
  "item_group",
  "itemGroup",
  "subcategory",
  "sub_category",
  "subCategory",
  "head",
  "head_name",
  "headName",
];

const getItemCategoryInfo = (item = {}) => {
  for (const key of CATEGORY_FIELDS) {
    const value = item?.[key];
    const text = String(value ?? "").trim();
    if (text) return { key: text, name: text };
  }
  return { key: "", name: "" };
};

const groupItemsForDownload = (items = []) => {
  const hasCategoryField = (Array.isArray(items) ? items : []).some((item) => getItemCategoryInfo(item).key);
  if (!hasCategoryField) {
    return [{ type: "items", label: "", items: Array.isArray(items) ? items : [] }];
  }

  const groups = [];
  const groupMap = new Map();
  const uncategorized = [];

  (Array.isArray(items) ? items : []).forEach((item) => {
    const info = getItemCategoryInfo(item);
    if (!info.key) {
      uncategorized.push(item);
      return;
    }
    if (!groupMap.has(info.key)) {
      const group = { type: "category", label: info.key, name: info.name, items: [] };
      groupMap.set(info.key, group);
      groups.push(group);
    }
    groupMap.get(info.key).items.push(item);
  });

  if (uncategorized.length > 0) {
    groups.push({ type: "items", label: "", items: uncategorized });
  }

  return groups;
};

const buildItemsExcelWorkbook = async ({ pr, selectedItems, vendors = [] }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Madhuram Enterprises";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const worksheet = workbook.addWorksheet("Comparison", {
    views: [{ state: "frozen", xSplit: 5, ySplit: 8 }],
  });

  const exportVendors = (Array.isArray(vendors) && vendors.length > 0 ? vendors : DEFAULT_DOWNLOAD_VENDORS)
    .map((vendor) => (typeof vendor === "string" ? vendor : String(vendor?.displayName || vendor?.name || "").trim()))
    .filter(Boolean);

  const itemGroups = groupItemsForDownload(selectedItems);
  const lastCol = 6 + exportVendors.length * 2;
  const colLetter = (colNumber) => XLSX.utils.encode_col(colNumber - 1);

  const fillRange = (rowNumber, startCol, endCol, fill, font = null, alignment = { horizontal: "center", vertical: "middle", wrapText: true }) => {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = worksheet.getCell(rowNumber, col);
      cell.fill = fill;
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      if (font) cell.font = font;
      cell.alignment = alignment;
    }
  };

  const setBorderRange = (rowNumber, startCol, endCol, options = {}) => {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = worksheet.getCell(rowNumber, col);
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      if (options.fill) cell.fill = options.fill;
      if (options.font) cell.font = options.font;
      if (options.alignment) cell.alignment = options.alignment;
      if (options.numFmt && col === options.numFmtCol) cell.numFmt = options.numFmt;
    }
  };

  const styleThinBorderCell = (cell, { fill = null, font = null, alignment = null, numFmt = null } = {}) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
    if (fill) cell.fill = fill;
    if (font) cell.font = font;
    if (alignment) cell.alignment = alignment;
    if (numFmt) cell.numFmt = numFmt;
  };

  const fontArial10 = { name: "Arial", size: 10 };
  const fontArial10Bold = { name: "Arial", size: 10, bold: true };
  const fontArial10WhiteBold = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };

  const navyFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5496" } };
  const categoryFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
  const summaryFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  const totalValueFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6E0B4" } };

  const metadata = [
    ["Company Name:", "Madhuram Enterprises"],
    ["Project Name:", String(pr?.project_name || "").trim()],
    ["Indent No:", String(pr?.workorder_no || pr?.pr_number || "").trim()],
    ["Indent Date:", String(pr?.date || "").trim()],
    ["Comparison Date:", todayISO()],
  ];

  metadata.forEach(([label, value], index) => {
    const rowNumber = index + 1;
    const labelCell = worksheet.getCell(rowNumber, 1);
    const valueCell = worksheet.getCell(rowNumber, 2);
    labelCell.value = label;
    valueCell.value = value || "";
    labelCell.font = fontArial10Bold;
    valueCell.font = fontArial10;
    labelCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    valueCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    setBorderRange(rowNumber, 1, lastCol);
  });

  const vendorRow = 7;
  const headerRow = 8;
  for (let col = 7; col <= lastCol; col += 2) {
    const vendorIndex = Math.floor((col - 7) / 2);
    const rateCol = col;
    const amountCol = col + 1;
    const vendorName = exportVendors[vendorIndex] || `Vendor ${vendorIndex + 1}`;

    worksheet.mergeCells(vendorRow, rateCol, vendorRow, amountCol);
    const vendorCell = worksheet.getCell(vendorRow, rateCol);
    vendorCell.value = vendorName;
    vendorCell.font = fontArial10WhiteBold;
    vendorCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(vendorCell, { fill: navyFill, font: fontArial10WhiteBold, alignment: vendorCell.alignment });

    styleThinBorderCell(worksheet.getCell(vendorRow, amountCol), { fill: navyFill, font: fontArial10WhiteBold });

    const rateHeader = worksheet.getCell(headerRow, rateCol);
    const amountHeader = worksheet.getCell(headerRow, amountCol);
    rateHeader.value = "Rate";
    amountHeader.value = "Amount";
    rateHeader.font = fontArial10WhiteBold;
    amountHeader.font = fontArial10WhiteBold;
    rateHeader.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    amountHeader.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(rateHeader, { fill: headerFill, font: fontArial10WhiteBold, alignment: rateHeader.alignment });
    styleThinBorderCell(amountHeader, { fill: headerFill, font: fontArial10WhiteBold, alignment: amountHeader.alignment });
  }

  fillRange(headerRow, 1, lastCol, headerFill, fontArial10WhiteBold);

  ["Sr. No.", "Item No", "HSN Code", "Item Description", "Qty", "UOM"].forEach((text, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = text;
    cell.font = fontArial10WhiteBold;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(cell, { fill: headerFill, font: fontArial10WhiteBold, alignment: cell.alignment });
  });

  let currentRow = 9;
  const itemRowNumbers = [];
  let itemSerial = 1;

  itemGroups.forEach((group) => {
    if (group.type === "category" && group.label) {
      worksheet.mergeCells(currentRow, 3, currentRow, 5);
      worksheet.getCell(currentRow, 1).value = group.label;
      worksheet.getCell(currentRow, 3).value = group.name || group.label;
      worksheet.getCell(currentRow, 1).font = fontArial10Bold;
      worksheet.getCell(currentRow, 3).font = fontArial10Bold;
      worksheet.getCell(currentRow, 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      worksheet.getCell(currentRow, 3).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      for (let col = 1; col <= lastCol; col += 1) {
        styleThinBorderCell(worksheet.getCell(currentRow, col), {
          fill: categoryFill,
          font: col === 1 || col === 3 ? fontArial10Bold : fontArial10,
          alignment: col === 1 ? { horizontal: "center", vertical: "middle", wrapText: true } : { horizontal: "left", vertical: "middle", wrapText: true },
        });
      }
      worksheet.getRow(currentRow).height = 23.25;
      currentRow += 1;
    }

    group.items.forEach((item) => {
      const rowNumber = currentRow;
      itemRowNumbers.push(rowNumber);
      worksheet.getCell(rowNumber, 1).value = itemSerial;
      worksheet.getCell(rowNumber, 2).value = getPrItemNo(item) || item?.item_no || item?.itemNo || "";
      worksheet.getCell(rowNumber, 3).value = item?.hsn_code || item?.hsn || item?.hsnCode || "";
      worksheet.getCell(rowNumber, 4).value = getPrItemDescription(item) || item?.material_description || item?.description || "";
      worksheet.getCell(rowNumber, 5).value = item?.req_qty ?? item?.qty ?? item?.quantity ?? "";
      worksheet.getCell(rowNumber, 6).value = item?.unit ?? item?.uom ?? item?.UOM ?? "";

      worksheet.getCell(rowNumber, 1).numFmt = "0";
      worksheet.getCell(rowNumber, 5).numFmt = "#,##0";

      worksheet.getCell(rowNumber, 1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      worksheet.getCell(rowNumber, 2).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      worksheet.getCell(rowNumber, 3).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      worksheet.getCell(rowNumber, 4).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      worksheet.getCell(rowNumber, 5).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      worksheet.getCell(rowNumber, 6).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

      for (let col = 1; col <= lastCol; col += 1) {
        styleThinBorderCell(worksheet.getCell(rowNumber, col), {
          font: fontArial10,
          alignment:
            col === 4
              ? { horizontal: "left", vertical: "middle", wrapText: true }
              : { horizontal: "center", vertical: "middle", wrapText: true },
        });
      }

      for (let vendorIndex = 0; vendorIndex < exportVendors.length; vendorIndex += 1) {
        const rateCol = 7 + vendorIndex * 2;
        const amountCol = rateCol + 1;
        const rateCell = worksheet.getCell(rowNumber, rateCol);
        const amountCell = worksheet.getCell(rowNumber, amountCol);
        rateCell.value = "";
        rateCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        amountCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        rateCell.numFmt = "#,##0.00";
        amountCell.numFmt = "#,##0.00";
        amountCell.value = { formula: `${colLetter(rateCol)}${rowNumber}*$D${rowNumber}` };
        styleThinBorderCell(rateCell, { font: fontArial10, alignment: rateCell.alignment });
        styleThinBorderCell(amountCell, { font: fontArial10, alignment: amountCell.alignment });
      }

      worksheet.getRow(rowNumber).height = 15.75;
      currentRow += 1;
      itemSerial += 1;
    });
  });

  const firstItemRow = itemRowNumbers[0] || currentRow;
  const lastItemRow = itemRowNumbers[itemRowNumbers.length - 1] || currentRow - 1;

  const subtotalRow = currentRow;
  worksheet.getCell(subtotalRow, 1).value = "Subtotal";
  worksheet.getCell(subtotalRow, 1).font = fontArial10Bold;
  worksheet.getCell(subtotalRow, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  for (let vendorIndex = 0; vendorIndex < exportVendors.length; vendorIndex += 1) {
    const rateCol = 7 + vendorIndex * 2;
    const amountCol = rateCol + 1;
    const amountCell = worksheet.getCell(subtotalRow, amountCol);
    worksheet.getCell(subtotalRow, rateCol).value = "";
    amountCell.value = { formula: `SUM(${colLetter(amountCol)}${firstItemRow}:${colLetter(amountCol)}${lastItemRow})` };
    amountCell.numFmt = "#,##0.00";
    amountCell.font = fontArial10Bold;
    amountCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(worksheet.getCell(subtotalRow, rateCol), { font: fontArial10Bold });
    styleThinBorderCell(amountCell, { font: fontArial10Bold, alignment: amountCell.alignment });
  }
  for (let col = 1; col <= lastCol; col += 1) {
    styleThinBorderCell(worksheet.getCell(subtotalRow, col), { fill: summaryFill, font: fontArial10Bold });
  }
  worksheet.getRow(subtotalRow).height = 15.75;
  currentRow += 1;

  const discountRow = currentRow;
  worksheet.getCell(discountRow, 1).value = "Discount";
  worksheet.getCell(discountRow, 1).font = fontArial10Bold;
  worksheet.getCell(discountRow, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  for (let vendorIndex = 0; vendorIndex < exportVendors.length; vendorIndex += 1) {
    const rateCol = 7 + vendorIndex * 2;
    const amountCol = rateCol + 1;
    const rateCell = worksheet.getCell(discountRow, rateCol);
    const amountCell = worksheet.getCell(discountRow, amountCol);
    rateCell.value = 0;
    rateCell.numFmt = "0.00";
    amountCell.value = { formula: `${colLetter(rateCol)}${discountRow}*${colLetter(amountCol)}${subtotalRow}` };
    amountCell.numFmt = "#,##0.00";
    rateCell.font = fontArial10;
    amountCell.font = fontArial10Bold;
    rateCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    amountCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(rateCell, { font: fontArial10, alignment: rateCell.alignment });
    styleThinBorderCell(amountCell, { font: fontArial10Bold, alignment: amountCell.alignment });
  }
  for (let col = 1; col <= lastCol; col += 1) {
    styleThinBorderCell(worksheet.getCell(discountRow, col), {
      fill: summaryFill,
      font: col === 1 ? fontArial10Bold : fontArial10,
    });
  }
  worksheet.getRow(discountRow).height = 15.75;
  currentRow += 1;

  const netRow = currentRow;
  worksheet.getCell(netRow, 1).value = "Net Amount";
  worksheet.getCell(netRow, 1).font = fontArial10Bold;
  worksheet.getCell(netRow, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  for (let vendorIndex = 0; vendorIndex < exportVendors.length; vendorIndex += 1) {
    const rateCol = 7 + vendorIndex * 2;
    const amountCol = rateCol + 1;
    const netAmountCell = worksheet.getCell(netRow, amountCol);
    netAmountCell.value = { formula: `${colLetter(amountCol)}${subtotalRow}-${colLetter(amountCol)}${discountRow}` };
    netAmountCell.numFmt = "#,##0.00";
    netAmountCell.font = fontArial10Bold;
    netAmountCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(worksheet.getCell(netRow, rateCol), { font: fontArial10 });
    styleThinBorderCell(netAmountCell, { font: fontArial10Bold, alignment: netAmountCell.alignment });
  }
  for (let col = 1; col <= lastCol; col += 1) {
    styleThinBorderCell(worksheet.getCell(netRow, col), {
      fill: summaryFill,
      font: col === 1 ? fontArial10Bold : fontArial10,
    });
  }
  worksheet.getRow(netRow).height = 15.75;
  currentRow += 1;

  const gstRow = currentRow;
  worksheet.getCell(gstRow, 1).value = "GST";
  worksheet.getCell(gstRow, 1).font = fontArial10Bold;
  worksheet.getCell(gstRow, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  for (let vendorIndex = 0; vendorIndex < exportVendors.length; vendorIndex += 1) {
    const rateCol = 7 + vendorIndex * 2;
    const amountCol = rateCol + 1;
    const rateCell = worksheet.getCell(gstRow, rateCol);
    const amountCell = worksheet.getCell(gstRow, amountCol);
    rateCell.value = 0.18;
    rateCell.numFmt = "0.00";
    amountCell.value = { formula: `${colLetter(rateCol)}${gstRow}*${colLetter(amountCol)}${netRow}` };
    amountCell.numFmt = "#,##0.00";
    rateCell.font = fontArial10;
    amountCell.font = fontArial10Bold;
    rateCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    amountCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(rateCell, { font: fontArial10, alignment: rateCell.alignment });
    styleThinBorderCell(amountCell, { font: fontArial10Bold, alignment: amountCell.alignment });
  }
  for (let col = 1; col <= lastCol; col += 1) {
    styleThinBorderCell(worksheet.getCell(gstRow, col), {
      fill: summaryFill,
      font: col === 1 ? fontArial10Bold : fontArial10,
    });
  }
  worksheet.getRow(gstRow).height = 15.75;
  currentRow += 1;

  const totalRow = currentRow;
  worksheet.getCell(totalRow, 1).value = "Total Value";
  worksheet.getCell(totalRow, 1).font = fontArial10Bold;
  worksheet.getCell(totalRow, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  for (let vendorIndex = 0; vendorIndex < exportVendors.length; vendorIndex += 1) {
    const rateCol = 7 + vendorIndex * 2;
    const amountCol = rateCol + 1;
    const totalCell = worksheet.getCell(totalRow, amountCol);
    totalCell.value = { formula: `${colLetter(amountCol)}${netRow}+${colLetter(amountCol)}${gstRow}` };
    totalCell.numFmt = "#,##0.00";
    totalCell.font = fontArial10Bold;
    totalCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    styleThinBorderCell(worksheet.getCell(totalRow, rateCol), { font: fontArial10 });
    styleThinBorderCell(totalCell, { font: fontArial10Bold, alignment: totalCell.alignment });
  }
  for (let col = 1; col <= lastCol; col += 1) {
    styleThinBorderCell(worksheet.getCell(totalRow, col), {
      fill: totalValueFill,
      font: col === 1 ? fontArial10Bold : fontArial10,
    });
  }
  worksheet.getRow(totalRow).height = 15.75;
  currentRow += 2;

  ["Delivery", "Payment", "Transportation"].forEach((label) => {
    const rowNumber = currentRow;
    worksheet.getCell(rowNumber, 1).value = label;
    worksheet.getCell(rowNumber, 1).font = fontArial10Bold;
    worksheet.getCell(rowNumber, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    for (let col = 1; col <= lastCol; col += 1) {
      styleThinBorderCell(worksheet.getCell(rowNumber, col), { font: col === 1 ? fontArial10Bold : fontArial10 });
    }
    worksheet.getRow(rowNumber).height = 15.75;
    currentRow += 1;
  });

  for (let col = 1; col <= lastCol; col += 1) {
    const column = worksheet.getColumn(col);
    if (col === 1) column.width = 9;
    else if (col === 2) column.width = 22;
    else if (col === 3) column.width = 101.57;
    else if (col === 4 || col === 5) column.width = 8;
    else column.width = col % 2 === 0 ? 13 : 12;
  }

  return workbook;
};

export default function VendorComparisonModule() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const { toast } = useToast();
  const resolvedProject = useResolvedProject();
  const API_BASE_URL = useMemo(
    () => String(import.meta.env.VITE_API_BASE_URL || "https://api.madhuram.enterprises").replace(/\/$/, ""),
    []
  );
  const projectId = useMemo(() => {
    const raw = resolvedProject?.projectId;
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
    return n;
  }, [resolvedProject?.projectId]);

  const [loadingPrs, setLoadingPrs] = useState(false);
  const [prOptions, setPrOptions] = useState([]);
  const [selectedPrId, setSelectedPrId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPrItemKeys, setSelectedPrItemKeys] = useState([]);
  const [prItemsConfirmed, setPrItemsConfirmed] = useState(false);

  const [prItems, setPrItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [comparisonRows, setComparisonRows] = useState([]);
  const [headerInfo, setHeaderInfo] = useState({});
  const [parsedWorkbook, setParsedWorkbook] = useState(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [step, setStep] = useState("select");
  const [creatingComparison, setCreatingComparison] = useState(false);
  const [createdComparisonId, setCreatedComparisonId] = useState(null);
  const [existingComparison, setExistingComparison] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [useExisting, setUseExisting] = useState(true);
  const [selectedApprovedVendor, setSelectedApprovedVendor] = useState("");
  const [approvedVendorName, setApprovedVendorName] = useState("");
  const [approvalTargetId, setApprovalTargetId] = useState(null);
  const [vendorCheckLoading, setVendorCheckLoading] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDrafts, setVendorDrafts] = useState([]);
  const [pendingVendorUpload, setPendingVendorUpload] = useState(null);

  const [loadingPrDetails, setLoadingPrDetails] = useState(false);
  const [parsingExcel, setParsingExcel] = useState(false);

  const fileInputRef = useRef(null);
  const fullPrRef = useRef(null);

  const activeBlock = useMemo(
    () => parsedWorkbook?.blocks?.[selectedBlockIndex] || parsedWorkbook?.blocks?.[0] || null,
    [parsedWorkbook, selectedBlockIndex]
  );

  const selectedPrItemList = useMemo(() => {
    const selected = new Set(Array.isArray(selectedPrItemKeys) ? selectedPrItemKeys : []);
    return (Array.isArray(prItems) ? prItems : []).filter((item, index) => selected.has(getPrItemKey(item, index)));
  }, [prItems, selectedPrItemKeys]);

  const vendorDraftsReady = useMemo(
    () => vendorDrafts.length > 0 && vendorDrafts.every((draft) => isVendorDraftComplete(draft)),
    [vendorDrafts]
  );

  useEffect(() => {
    let cancelled = false;

    const loadPrs = async () => {
      if (!projectId) {
        setPrOptions([]);
        setSelectedPrId("");
        return;
      }

      setLoadingPrs(true);
      try {
        const result = await api.getPrsByProject(projectId);
        const rows = result?.success ? normalizeArray(result.data) : [];
        if (!cancelled) setPrOptions(rows);
      } catch {
        if (!cancelled) setPrOptions([]);
      } finally {
        if (!cancelled) setLoadingPrs(false);
      }
    };

    loadPrs();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filteredPrOptions = prOptions;

  const selectedPr = useMemo(() => {
    if (!selectedPrId) return null;
    return prOptions.find((row) => String(row?.pr_id ?? row?.id ?? "") === selectedPrId) || null;
  }, [prOptions, selectedPrId]);

  useEffect(() => {
    let cancelled = false;

    const loadFullPr = async () => {
      if (!selectedPrId) {
        fullPrRef.current = null;
        setPrItems([]);
        setSelectedPrItemKeys([]);
        setPrItemsConfirmed(false);
        setHeaderInfo({});
        setVendors([]);
        setComparisonRows([]);
        setStep("select");
        setExistingComparison(null);
        setUseExisting(true);
        setSelectedApprovedVendor("");
        setApprovedVendorName("");
        setApprovalTargetId(null);
        setParsedWorkbook(null);
        setSelectedBlockIndex(0);
        setVendorCheckLoading(false);
        setVendorDialogOpen(false);
        setVendorDrafts([]);
        setPendingVendorUpload(null);
        return;
      }

      setLoadingPrDetails(true);
      try {
        const result = await api.getPrById(selectedPrId);
        if (!result?.success) {
          throw new Error(result?.error || "Failed to load PR");
        }
        const pr = result?.data || null;
        fullPrRef.current = pr;
        const items = normalizeArray(pr?.items);
        if (!cancelled) {
          setPrItems(items);
          setSelectedPrItemKeys(items.map((item, index) => getPrItemKey(item, index)));
          setPrItemsConfirmed(false);
          setHeaderInfo((prev) => ({
            ...prev,
            project_name: pr?.project_name ?? prev.project_name,
            indent_no: pr?.workorder_no ?? prev.indent_no,
            indent_date: pr?.date ?? prev.indent_date,
          }));
          toast({ title: "PR loaded", description: `Loaded ${items.length} items.` });
        }

        const prId = getPrIdValue(pr, selectedPrId);
        const prNo = getPrNumberValue(pr) ?? getPrNumberValue(selectedPr || {});
        if (!cancelled && projectId && prId != null) {
          setLoadingExisting(true);
          try {
            const existingResult = await api.listVendorComparisons({ project_id: projectId, pr_no: prId });
            const existingRows = existingResult?.success ? parseArrayLike(existingResult.data, []) : [];
            const list = normalizeArray(existingRows);
            const score = (row) => {
              const updated = row?.updated_at ?? row?.updatedAt ?? row?.created_at ?? row?.createdAt ?? null;
              const t = updated ? new Date(updated).getTime() : 0;
              return Number.isFinite(t) ? t : 0;
            };
            const sorted = [...list].sort((a, b) => score(b) - score(a));

            let approvedComparison = null;
            let approvedName = "";
            let rawComparison = null;

            for (const row of sorted) {
              let data = row;
              let pricelist = getPricelistRows(data);
              if (pricelist.length === 0) {
                const id = getComparisonIdValue(data);
                if (id != null && id !== "") {
                  try {
                    const detail = await api.getVendorComparisonById(id);
                    if (detail?.success) data = detail.data || data;
                    pricelist = getPricelistRows(data);
                  } catch {
                    // ignore
                  }
                }
              }
              if (!Array.isArray(pricelist) || pricelist.length === 0) continue;
              const approvedFromRow = getApprovedVendorName(data);
              const unique = getUniqueVendorsFromPricelist(pricelist);
              if ((approvedFromRow || unique.length === 1) && !approvedComparison) {
                approvedComparison = data;
                approvedName = approvedFromRow || unique[0] || "";
              } else if (unique.length > 1 && !rawComparison) {
                rawComparison = data;
              }
              if (approvedComparison && rawComparison) break;
            }

            if (approvedComparison && approvedName) {
              const targetId = getComparisonIdValue(approvedComparison);
              setApprovalTargetId(targetId != null ? String(targetId) : null);
              setApprovedVendorName(approvedName);
              setSelectedApprovedVendor(approvedName);
              setUseExisting(true);

              const tableComparison = rawComparison || approvedComparison;
              setExistingComparison(tableComparison);

              const built = buildComparisonFromPricelist(tableComparison);
              setVendors(built.vendors);
              setComparisonRows(built.comparisonRows);
              setHeaderInfo((prev) => ({ ...prev, comparison_date: todayISO() }));
              setCreatedComparisonId(targetId != null ? String(targetId) : null);
              setStep("preview");
              setSelectedFile(null);
            } else {
              let fallbackApprovedComparison = null;
              let fallbackApprovedName = "";
              let fallbackRawComparison = null;

              if (prNo != null && prNo !== prId) {
                const fallbackResult = await api.listVendorComparisons({ project_id: projectId, pr_no: prNo });
                const fallbackRows = fallbackResult?.success ? parseArrayLike(fallbackResult.data, []) : [];
                const fallbackList = normalizeArray(fallbackRows);
                const fallbackSorted = [...fallbackList].sort((a, b) => score(b) - score(a));

                for (const row of fallbackSorted) {
                  let data = row;
                  let pricelist = getPricelistRows(data);
                  if (pricelist.length === 0) {
                    const id = getComparisonIdValue(data);
                    if (id != null && id !== "") {
                      try {
                        const detail = await api.getVendorComparisonById(id);
                        if (detail?.success) data = detail.data || data;
                        pricelist = getPricelistRows(data);
                      } catch {
                        // ignore
                      }
                    }
                  }
                  if (!Array.isArray(pricelist) || pricelist.length === 0) continue;
                  const approvedFromRow = getApprovedVendorName(data);
                  const unique = getUniqueVendorsFromPricelist(pricelist);
                  if ((approvedFromRow || unique.length === 1) && !fallbackApprovedComparison) {
                    fallbackApprovedComparison = data;
                    fallbackApprovedName = approvedFromRow || unique[0] || "";
                  } else if (unique.length > 1 && !fallbackRawComparison) {
                    fallbackRawComparison = data;
                  }
                  if (fallbackApprovedComparison && fallbackRawComparison) break;
                }
              }

              if (fallbackApprovedComparison && fallbackApprovedName) {
                const targetId = getComparisonIdValue(fallbackApprovedComparison);
                setApprovalTargetId(targetId != null ? String(targetId) : null);
                setApprovedVendorName(fallbackApprovedName);
                setSelectedApprovedVendor(fallbackApprovedName);
                setUseExisting(true);

                const tableComparison = fallbackRawComparison || fallbackApprovedComparison;
                setExistingComparison(tableComparison);

                const built = buildComparisonFromPricelist(tableComparison);
                setVendors(built.vendors);
                setComparisonRows(built.comparisonRows);
                setHeaderInfo((prev) => ({ ...prev, comparison_date: todayISO() }));
                setCreatedComparisonId(targetId != null ? String(targetId) : null);
                setStep("preview");
                setSelectedFile(null);
              } else {
                setExistingComparison(null);
                setUseExisting(false);
                setApprovedVendorName("");
                setApprovalTargetId(null);
                setSelectedApprovedVendor("");
                setVendors([]);
                setComparisonRows([]);
                setCreatedComparisonId(null);
                setStep("select");
                setSelectedFile(null);
              }
            }
          } catch {
            setExistingComparison(null);
          } finally {
            setLoadingExisting(false);
          }
        } else {
          if (!cancelled) setExistingComparison(null);
        }
      } catch (e) {
        if (!cancelled) {
          fullPrRef.current = null;
          setPrItems([]);
          setStep("select");
          setExistingComparison(null);
          setSelectedApprovedVendor("");
          setApprovedVendorName("");
          setApprovalTargetId(null);
          setParsedWorkbook(null);
          setSelectedBlockIndex(0);
          setVendors([]);
          setComparisonRows([]);
          setCreatedComparisonId(null);
          toast({
            title: "Failed to load PR",
            description: e?.message || "Could not fetch PR details.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoadingPrDetails(false);
      }
    };

    loadFullPr();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedPr, selectedPrId, toast]);

  useEffect(() => {
    if (!existingComparison) return;
    if (!useExisting) return;
    if (!approvalTargetId) return;
    const built = buildComparisonFromPricelist(existingComparison);
    setVendors(built.vendors);
    setComparisonRows(built.comparisonRows);
    setHeaderInfo((prev) => ({ ...prev, comparison_date: todayISO() }));
    setCreatedComparisonId(
      String(
        existingComparison?.id ??
          existingComparison?.comparison_id ??
          existingComparison?.vendor_comparison_id ??
          existingComparison?.comparisonId ??
          ""
      ) || null
    );
    const unique = getUniqueVendorsFromPricelist(getPricelistRows(existingComparison));
    setSelectedApprovedVendor(unique.length === 1 ? unique[0] : "");
    setSelectedFile(null);
    setStep("preview");
  }, [approvalTargetId, existingComparison, useExisting]);

  useEffect(() => {
    if (useExisting) return;
    if (!existingComparison) return;
    setVendors([]);
    setComparisonRows([]);
    setSelectedFile(null);
    setCreatedComparisonId(null);
    setStep("select");
  }, [existingComparison, useExisting]);

  const handlePickFile = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  const buildComparisonRowsFromBlock = useCallback(
    (block = null) => {
      const rows = (Array.isArray(block?.sections) ? block.sections : []).flatMap((section) =>
        (Array.isArray(section?.items) ? section.items : []).map((item, itemIndex) => ({
          sr_no: item?.srNo ?? itemIndex + 1,
          hsn_code: item?.hsnCode ?? "",
          item_no: item?.item_no ?? item?.itemNo ?? "",
          item_description: item?.description ?? "",
          qty: item?.totalQty ?? null,
          unit: item?.uom ?? "",
          vendorPrices: (Array.isArray(item?.vendorData) ? item.vendorData : []).map((vendor) => ({
            vendorName: vendor?.vendorName ?? "",
            rate: vendor?.rate ?? null,
            amount: vendor?.amount ?? null,
          })),
        }))
      );
      return mergeWithPrItems(rows, Array.isArray(block?.vendors) ? block.vendors.map((vendor) => vendor.displayName || vendor.name) : [], selectedPrItemList);
    },
    [selectedPrItemList]
  );

  useEffect(() => {
    if (!parsedWorkbook || step !== "preview") return;
    if (!activeBlock) return;
    const merged = buildComparisonRowsFromBlock(activeBlock);
    setVendors(Array.isArray(activeBlock.vendors) ? activeBlock.vendors : []);
    setComparisonRows(merged);
    setHeaderInfo((prev) => ({
      ...prev,
      excel_company: activeBlock.meta.companyName || "",
      excel_project: activeBlock.meta.projectName || "",
      excel_indent_no: activeBlock.meta.indentNo || "",
      excel_indent_date: activeBlock.meta.indentDate || "",
      excel_comparison_date: activeBlock.meta.comparisonDate || "",
      comparison_date: todayISO(),
    }));
  }, [activeBlock, buildComparisonRowsFromBlock, parsedWorkbook, step]);

  const togglePrItemSelection = (item, index, checked) => {
    const key = getPrItemKey(item, index);
    setSelectedPrItemKeys((prev) => {
      const current = new Set(Array.isArray(prev) ? prev : []);
      if (checked) current.add(key);
      else current.delete(key);
      return Array.from(current);
    });
    setPrItemsConfirmed(false);
  };

  const confirmSelectedPrItems = () => {
    if (selectedPrItemList.length === 0) {
      toast({ title: "Select PR items", description: "Tick at least one PR item before confirming.", variant: "destructive" });
      return;
    }
    setPrItemsConfirmed(true);
    setStep("upload");
    toast({
      title: "PR items confirmed",
      description: `${selectedPrItemList.length} item${selectedPrItemList.length === 1 ? "" : "s"} selected for comparison.`,
    });
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsedWorkbook(null);
    setSelectedBlockIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setVendors([]);
    setComparisonRows([]);
    setStep("select");
    setCreatedComparisonId(null);
    setSelectedApprovedVendor("");
    setVendorDialogOpen(false);
    setVendorDrafts([]);
    setPendingVendorUpload(null);
    setVendorCheckLoading(false);
    setPrItemsConfirmed(false);
    setSelectedPrItemKeys((prev) => (Array.isArray(prItems) ? prItems.map((item, index) => getPrItemKey(item, index)) : prev));
    if (existingComparison && useExisting) setUseExisting(false);
  };

  const disableUpload = Boolean(approvalTargetId && useExisting);
  const parseSelectedExcel = async (file) => {
    if (!file) return;
    if (!selectedPrId) {
      toast({ title: "Select PR first", description: "Please select a PR before uploading.", variant: "destructive" });
      return;
    }
    if (!prItemsConfirmed || selectedPrItemList.length === 0) {
      toast({
        title: "Confirm PR items first",
        description: "Please tick the PR items you want to compare and confirm them before uploading the vendor file.",
        variant: "destructive",
      });
      return;
    }
    if (disableUpload) {
      toast({
        title: "Existing comparison found",
        description: "This PR already has a vendor comparison. Click “Upload new instead” to upload a new sheet.",
        variant: "destructive",
      });
      return;
    }
    if (!fullPrRef.current) {
      toast({ title: "PR not ready", description: "PR details are still loading.", variant: "destructive" });
      return;
    }

    const name = String(file.name || "").toLowerCase();
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
    const isPdf = name.endsWith(".pdf");
    if (isPdf) {
      toast({ title: "PDF not supported", description: "Please upload the vendor comparison Excel file.", variant: "destructive" });
      return;
    }
    if (!isExcel) {
      toast({ title: "Unsupported file", description: "Upload .xlsx / .xls / .csv", variant: "destructive" });
      return;
    }

    setParsingExcel(true);
    setVendorCheckLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: "array", cellDates: true });
      const parsed = parseComparisonWorkbook(workbook);
      const block = Array.isArray(parsed?.blocks) ? parsed.blocks[0] || null : null;
      if (!block) {
        throw new Error("No comparison blocks found in the workbook.");
      }
      setParsedWorkbook(parsed);
      setSelectedBlockIndex(0);
      const vendorResult = await api.getVendors();
      if (!vendorResult?.success) {
        throw new Error(vendorResult?.error || "Unable to verify existing vendors.");
      }

      const backendVendors = parseArrayLike(vendorResult.data, []);
      const parsedVendorNames = Array.from(
        new Set(
          (Array.isArray(block.vendors) ? block.vendors : [])
            .map((vendor) => String(vendor?.displayName || vendor?.name || vendor || "").trim())
            .filter(Boolean)
        )
      );
      const missingVendorNames = [];

      parsedVendorNames.forEach((vendorName) => {
        const matchedVendor = findExistingVendorByName(backendVendors, vendorName);
        if (!matchedVendor) missingVendorNames.push(vendorName);
      });

      if (missingVendorNames.length > 0) {
        setPendingVendorUpload({
          file,
          parsedWorkbook: parsed,
          blockIndex: 0,
          vendorNames: parsedVendorNames,
        });
        setVendorDrafts(missingVendorNames.map((vendorName) => buildVendorDraft(vendorName)));
        setVendorDialogOpen(true);
        toast({
          title: "Missing vendors found",
          description: `${missingVendorNames.length} vendor${missingVendorNames.length === 1 ? "" : "s"} need to be added before continuing.`,
        });
        return;
      }

      const merged = buildComparisonRowsFromBlock(block);
      setSelectedFile(file);
      setVendors(Array.isArray(block.vendors) ? block.vendors : []);
      setComparisonRows(merged);
      setHeaderInfo((prev) => ({
        ...prev,
        excel_company: block.meta.companyName,
        excel_project: block.meta.projectName,
        excel_indent_no: block.meta.indentNo,
        excel_indent_date: block.meta.indentDate,
        excel_comparison_date: block.meta.comparisonDate,
        comparison_date: todayISO(),
      }));
      setCreatedComparisonId(null);
      setStep("preview");
      toast({
        title: "Excel parsed",
        description: `Vendors: ${block.vendors.length}, Items: ${merged.length} from ${selectedPrItemList.length} selected PR item(s)`,
      });
      if (merged.length === 0) {
        toast({
          title: "No matching PR items",
          description: "The uploaded Excel did not match any selected PR item names.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Parse failed", description: e?.message || "Could not parse Excel.", variant: "destructive" });
      setVendors([]);
      setComparisonRows([]);
      setParsedWorkbook(null);
      setStep("select");
    } finally {
      setParsingExcel(false);
      setVendorCheckLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    parseSelectedExcel(file);
  };

  const totals = useMemo(
    () => calculateTotals(comparisonRows, vendors, activeBlock?.summary),
    [activeBlock?.summary, comparisonRows, vendors]
  );

  const totalValueExtremes = useMemo(() => {
    const values = Array.isArray(totals?.total) ? totals.total : [];
    const numeric = values
      .map((v, idx) => ({ idx, value: toNumberOrNull(v) }))
      .filter((entry) => entry.value !== null);
    if (numeric.length === 0) return { minIdx: -1, maxIdx: -1 };
    numeric.sort((a, b) => a.value - b.value);
    return { minIdx: numeric[0].idx, maxIdx: numeric[numeric.length - 1].idx };
  }, [totals]);

  const handleDownloadExcel = () => {
    const pr = fullPrRef.current || selectedPr || {};
    if (!pr || vendors.length === 0 || comparisonRows.length === 0) {
      toast({ title: "Nothing to export", description: "Select PR and upload Excel first.", variant: "destructive" });
      return;
    }
    try {
      const wb = buildExportWorkbook({
        pr,
        vendors,
        comparisonRows,
        summary: activeBlock?.summary,
        approvedVendorName: approvedVendorName || selectedApprovedVendor,
      });
      const fileName = `Vendor_Comparison_${pr?.workorder_no || pr?.pr_id || "export"}_${todayISO()}.xlsx`;
      XLSX.writeFile(wb, fileName, { bookType: "xlsx", compression: true, cellStyles: true });
      toast({ title: "Downloaded", description: fileName });
    } catch (e) {
      toast({ title: "Export failed", description: e?.message || "Could not generate Excel.", variant: "destructive" });
    }
  };

  const handleDownloadItemsExcel = async () => {
    const pr = fullPrRef.current || selectedPr || {};
    const itemsToExport = selectedPrItemList;
    if (!pr || !prItemsConfirmed || itemsToExport.length === 0) {
      toast({ title: "Nothing to export", description: "Confirm the PR items first.", variant: "destructive" });
      return;
    }

    try {
      const wb = await buildItemsExcelWorkbook({
        pr,
        selectedItems: selectedPrItemList,
        vendors,
      });

      const baseName = String(pr?.sample_id || pr?.pr_number || pr?.workorder_no || "HelloTest123").trim();
      const fileName = `${baseName || "HelloTest123"}.xlsx`;
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, fileName);
      toast({ title: "Downloaded", description: fileName });
    } catch (e) {
      toast({ title: "Export failed", description: e?.message || "Could not generate Excel.", variant: "destructive" });
    }
  };

  const handleCreateComparison = async () => {
    if (creatingComparison) return;
    if (disableUpload) {
      toast({ title: "Use Save Approval", description: "This PR already has a vendor comparison record.", variant: "destructive" });
      return;
    }
    if (!selectedApprovedVendor) {
      toast({ title: "Select vendor", description: "Pick the approved vendor before saving.", variant: "destructive" });
      return;
    }
    if (!selectedFile) {
      toast({ title: "No file", description: "Upload the vendor comparison Excel first.", variant: "destructive" });
      return;
    }
    if (!projectId) {
      toast({ title: "No project", description: "Project is required to create a comparison record.", variant: "destructive" });
      return;
    }

    setCreatingComparison(true);
    try {
      const vendorResult = await api.getVendors();
      if (!vendorResult?.success) {
        toast({ title: "Vendor lookup failed", description: vendorResult?.error || "Unable to load vendor IDs.", variant: "destructive" });
        return;
      }
      const vendorLookupMap = buildVendorLookupMap(parseArrayLike(vendorResult.data, []));
      const approvedVendor = resolveVendorIdentity(vendorLookupMap, selectedApprovedVendor);
      if (approvedVendor.vendor_id === null) {
        toast({
          title: "Vendor not found",
          description: "The approved vendor must already exist in the vendor master list so we can send its vendor_id.",
          variant: "destructive",
        });
        return;
      }
      const fullPricelist = buildPricelistFromRows(comparisonRows, vendorLookupMap, selectedApprovedVendor);
      if (fullPricelist.length === 0) {
        toast({ title: "No items", description: "No items found for the selected vendor.", variant: "destructive" });
        return;
      }

      const prForPayload = fullPrRef.current || selectedPr || {};
      const prNoNumeric = getPrIdValue(prForPayload, selectedPrId);

      const createResult = await api.createVendorComparison({
        project_id: toPositiveInteger(resolvedProject.projectId ?? projectId),
        pr_no: prNoNumeric,
        pricelist: fullPricelist,
        approved_vendor: approvedVendor.vendor_id,
      });
      if (!createResult?.success) {
        toast({ title: "Create failed", description: createResult?.error || "Unable to create vendor comparison.", variant: "destructive" });
        return;
      }

      const created = createResult.data || {};
      const id = created?.id ?? created?.vendor_comparison_id ?? created?.comparison_id ?? created?.comparisonId ?? null;
      setCreatedComparisonId(id != null ? String(id) : null);
      setApprovalTargetId(id != null ? String(id) : null);
      setApprovedVendorName(selectedApprovedVendor);
      setUseExisting(true);
      toast({ title: "Created", description: id != null ? `Comparison ID: ${id}` : "Vendor comparison record created." });
    } catch (e) {
      toast({ title: "Create failed", description: e?.message || "Unable to create vendor comparison.", variant: "destructive" });
    } finally {
      setCreatingComparison(false);
    }
  };

  const handleSaveApproval = async () => {
    if (creatingComparison) return;
    if (!disableUpload) {
      toast({ title: "Create first", description: "No existing vendor comparison to update for this PR.", variant: "destructive" });
      return;
    }
    if (!approvalTargetId) {
      toast({ title: "Missing comparison id", description: "Could not determine comparison id for update.", variant: "destructive" });
      return;
    }
    if (!selectedApprovedVendor) {
      toast({ title: "Select vendor", description: "Pick the approved vendor before saving.", variant: "destructive" });
      return;
    }

    setCreatingComparison(true);
    try {
      const vendorResult = await api.getVendors();
      if (!vendorResult?.success) {
        toast({ title: "Vendor lookup failed", description: vendorResult?.error || "Unable to load vendor IDs.", variant: "destructive" });
        return;
      }
      const vendorLookupMap = buildVendorLookupMap(parseArrayLike(vendorResult.data, []));
      const approvedVendor = resolveVendorIdentity(vendorLookupMap, selectedApprovedVendor);
      if (approvedVendor.vendor_id === null) {
        toast({
          title: "Vendor not found",
          description: "The approved vendor must already exist in the vendor master list so we can send its vendor_id.",
          variant: "destructive",
        });
        return;
      }

      const fullPricelist = buildPricelistFromRows(comparisonRows, vendorLookupMap, selectedApprovedVendor);
      if (fullPricelist.length === 0) {
        toast({ title: "No items", description: "No items found for the selected vendor.", variant: "destructive" });
        return;
      }
      const result = await api.updateVendorComparison(approvalTargetId, {
        project_id: toPositiveInteger(resolvedProject.projectId ?? projectId),
        pr_no: getPrIdValue(fullPrRef.current || selectedPr || {}, selectedPrId),
        pricelist: fullPricelist,
        approved_vendor: approvedVendor.vendor_id,
      });
      if (!result?.success) {
        toast({ title: "Save failed", description: result?.error || "Unable to save approval.", variant: "destructive" });
        return;
      }
      setApprovedVendorName(selectedApprovedVendor);
      toast({ title: "Saved", description: `Approved vendor saved: ${selectedApprovedVendor}` });
    } catch (e) {
      toast({ title: "Save failed", description: e?.message || "Unable to save approval.", variant: "destructive" });
    } finally {
      setCreatingComparison(false);
    }
  };

  const lowestRateByRow = useMemo(() => {
    const map = new Map();
    comparisonRows.forEach((row) => {
      const rates = row.vendorPrices.map((p) => toNumberOrNull(p.rate)).filter((v) => v !== null);
      const min = rates.length > 0 ? Math.min(...rates) : null;
      map.set(row.sr_no, min);
    });
    return map;
  }, [comparisonRows]);

  const handleVendorDraftChange = (index, field, value) => {
    setVendorDrafts((prev) =>
      prev.map((draft, currentIndex) => (currentIndex === index ? { ...draft, [field]: value } : draft))
    );
  };

  const handleVendorDraftSubmit = async () => {
    if (!pendingVendorUpload) return;
    if (!vendorDraftsReady) {
      toast({
        title: "Missing required fields",
        description: "Please fill company name, email, mobile number, and location for every vendor before saving.",
        variant: "destructive",
      });
      return;
    }
    if (vendorDrafts.length === 0) {
      setVendorDialogOpen(false);
      setPendingVendorUpload(null);
      return;
    }

    setCreatingComparison(true);
    try {
      const savedVendorMap = new Map();

      for (const draft of vendorDrafts) {
        const payload = buildVendorPayload(draft);
        if (!payload.vendor_name) {
          throw new Error("Vendor name is required for every missing vendor.");
        }

        const result = await api.createVendor(payload);
        if (!result?.success) {
          throw new Error(result?.error || `Failed to create vendor ${payload.vendor_name}.`);
        }

        const createdVendor = result.data || {};
        savedVendorMap.set(payload.vendor_name, createdVendor);
      }

      const pending = pendingVendorUpload;
      const pendingBlock =
        pending?.parsedWorkbook?.blocks?.[pending?.blockIndex ?? 0] ||
        pending?.parsedWorkbook?.blocks?.[0] ||
        null;
      if (!pendingBlock) {
        throw new Error("No comparison block available after adding vendors.");
      }
      setParsedWorkbook(pending.parsedWorkbook || null);
      setSelectedBlockIndex(pending.blockIndex ?? 0);
      const merged = buildComparisonRowsFromBlock(pendingBlock);
      setSelectedFile(pending.file);
      setVendors(Array.isArray(pendingBlock.vendors) ? pendingBlock.vendors : []);
      setComparisonRows(merged);
      setHeaderInfo((prev) => ({
        ...prev,
        excel_company: pendingBlock.meta.companyName,
        excel_project: pendingBlock.meta.projectName,
        excel_indent_no: pendingBlock.meta.indentNo,
        excel_indent_date: pendingBlock.meta.indentDate,
        excel_comparison_date: pendingBlock.meta.comparisonDate,
        comparison_date: todayISO(),
      }));
      setCreatedComparisonId(null);
      setStep("preview");
      setPendingVendorUpload(null);
      setVendorDrafts([]);
      setVendorDialogOpen(false);

      toast({
        title: "Vendors added",
        description: `${savedVendorMap.size} vendor${savedVendorMap.size === 1 ? "" : "s"} saved successfully.`,
      });
    } catch (e) {
      toast({
        title: "Failed to add vendors",
        description: e?.message || "Unable to save vendor details.",
        variant: "destructive",
      });
    } finally {
      setCreatingComparison(false);
    }
  };

  const handleVendorDialogCancel = () => {
    setVendorDialogOpen(false);
    setVendorDrafts([]);
    setPendingVendorUpload(null);
    setSelectedFile(null);
    setParsedWorkbook(null);
    setSelectedBlockIndex(0);
    setVendors([]);
    setComparisonRows([]);
    setStep("select");
    setCreatedComparisonId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Comparison</h1>
          <p className="text-muted-foreground mt-2">Select a PR, tick the items you want, confirm them, then upload the vendor comparison file.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(routeProjectId ? `/${routeProjectId}/vendor-comparison` : projectId ? `/${projectId}/vendor-comparison` : "/vendor-comparison")}
          className="w-full sm:w-auto"
        >
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Purchase Request</CardTitle>
          <CardDescription>Pick a PR first, then choose the items you want to compare.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>PR</Label>
            <Select
              value={selectedPrId || undefined}
              onValueChange={(value) => setSelectedPrId(value)}
              disabled={!projectId || loadingPrs}
            >
              <SelectTrigger>
                <SelectValue placeholder={!projectId ? "Select project first" : loadingPrs ? "Loading PRs..." : "Select PR"} />
              </SelectTrigger>
              <SelectContent>
                {loadingPrs ? (
                  <SelectItem value="__loading" disabled>
                    Loading...
                  </SelectItem>
                ) : null}
                {!loadingPrs && filteredPrOptions.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    No PRs found.
                  </SelectItem>
                ) : null}
                {filteredPrOptions.map((row) => {
                  const id = row?.pr_id ?? row?.id;
                  const prNo = row?.pr_no ?? row?.pr_number ?? "";
                  const label = prNo ? `${id} - ${prNo}` : `${id}`;
                  if (id == null) return null;
                  return (
                    <SelectItem key={`vendor-comp-pr-${id}`} value={String(id)}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {loadingPrDetails ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading PR details...
              </div>
            ) : null}
            {loadingExisting ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking existing vendor comparison...
              </div>
            ) : null}
            {!loadingExisting && selectedPrId && approvalTargetId && useExisting ? (
              <div className="rounded-md border bg-emerald-50/60 p-3 text-xs text-emerald-900">
                <div className="font-medium">✓ Approved: {approvedVendorName || "-"}</div>
                <div className="mt-1 text-emerald-900/80">Approval record: {approvalTargetId}</div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {selectedPr ? (
        <Card>
          <CardHeader>
            <CardTitle>PR Items</CardTitle>
            <CardDescription>Tick the items you want to carry into this vendor comparison.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline">{selectedPrItemList.length} selected</Badge>
            </div>

            <div className="mt-4 overflow-x-auto rounded-md border">
              <Table className="min-w-[1080px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] text-center">Pick</TableHead>
                    <TableHead className="w-[140px]">Item No</TableHead>
                    <TableHead className="min-w-[320px]">Item</TableHead>
                    <TableHead className="w-[180px]">Unit</TableHead>
                    <TableHead className="w-[140px] text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        No PR items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    prItems.map((item, index) => {
                      const key = getPrItemKey(item, index);
                      const checked = selectedPrItemKeys.includes(key);
                      return (
                        <TableRow key={key}>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => togglePrItemSelection(item, index, Boolean(value))}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{getPrItemNo(item) || "-"}</TableCell>
                          <TableCell className="font-medium whitespace-normal break-words">{getPrItemDescription(item) || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap">{item?.unit || "-"}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">{item?.req_qty ?? item?.qty ?? item?.quantity ?? "-"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {prItemsConfirmed ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadItemsExcel}
                  className="border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                  disabled={loadingPrDetails || parsingExcel || vendorCheckLoading || (comparisonRows.length === 0 && selectedPrItemList.length === 0)}
                >
                  Download Items Excel
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={confirmSelectedPrItems}
                disabled={selectedPrItemList.length === 0}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Confirm Items
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Upload Vendor Comparison</CardTitle>
          <CardDescription>Upload stays locked until you confirm the PR items above.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input ref={fileInputRef} type="file" accept={ACCEPTED_UPLOAD_TYPES} className="hidden" onChange={handleFileChange} />
            <Button
              type="button"
              variant="outline"
              onClick={handlePickFile}
              className="w-full sm:w-auto"
              disabled={!selectedPrId || !prItemsConfirmed || loadingPrDetails || parsingExcel || vendorCheckLoading || disableUpload}
            >
              {parsingExcel || vendorCheckLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Choose File
            </Button>
            <Button type="button" variant="ghost" onClick={clearFile} className="w-full sm:w-auto" disabled={!selectedFile && step !== "preview"}>
              Remove
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Accepted: PDF / Excel / CSV. {selectedFile ? `Selected: ${selectedFile.name}` : ""}
          </div>
        </CardContent>
      </Card>

      {step === "preview" ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Vendors: {vendors.length} | Items: {comparisonRows.length} | PR Items: {prItems.length} | Totals:{" "}
              {totals.summarySource === "parsed" ? "parsed vendor summary" : "computed from rows"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {approvedVendorName ? (
              <div className="flex items-center">
                <span className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white">
                  ✓ Approved: {approvedVendorName}
                </span>
              </div>
            ) : null}

            {Array.isArray(parsedWorkbook?.blocks) && parsedWorkbook.blocks.length > 1 ? (
              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">Blocks</div>
                    <div className="text-xs text-muted-foreground">Switch between the stacked comparison tables in this workbook.</div>
                  </div>
                  <Badge variant="outline">{parsedWorkbook.blocks.length} blocks</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsedWorkbook.blocks.map((block, index) => (
                    <Button
                      key={`parsed-block-${index}`}
                      type="button"
                      variant={index === selectedBlockIndex ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedBlockIndex(index)}
                    >
                      Block {index + 1}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 rounded-lg border p-4 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <div className="font-medium">Header</div>
                <div className="text-muted-foreground">Company: Madhuram Enterprises</div>
                <div className="text-muted-foreground">Project: {headerInfo.project_name || "-"}</div>
                <div className="text-muted-foreground">Sub Project: {activeBlock?.subProjectName || "-"}</div>
                <div className="text-muted-foreground">Indent No: {headerInfo.indent_no || "-"}</div>
                <div className="text-muted-foreground">Indent Date: {headerInfo.indent_date || "-"}</div>
                <div className="text-muted-foreground">Comparison Date: {headerInfo.comparison_date || todayISO()}</div>
              </div>
              <div className="space-y-1">
                <div className="font-medium">From Excel</div>
                <div className="text-muted-foreground">Company: {headerInfo.excel_company || "-"}</div>
                <div className="text-muted-foreground">Project: {headerInfo.excel_project || "-"}</div>
                <div className="text-muted-foreground">Indent No: {headerInfo.excel_indent_no || "-"}</div>
                <div className="text-muted-foreground">Indent Date: {headerInfo.excel_indent_date || "-"}</div>
                <div className="text-muted-foreground">Comparison Date: {headerInfo.excel_comparison_date || "-"}</div>
              </div>
            </div>

            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Sr. No</TableHead>
                    <TableHead className="whitespace-nowrap">Item No</TableHead>
                    <TableHead className="whitespace-nowrap">HSN Code</TableHead>
                    <TableHead className="min-w-[320px]">Item Description</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Qty</TableHead>
                    <TableHead className="whitespace-nowrap">UOM</TableHead>
                    {vendors.map((vendor) => {
                      const vendorName = typeof vendor === "string" ? vendor : String(vendor?.displayName || vendor?.name || "").trim();
                      return (
                        <React.Fragment key={`vendor-head-${vendorName}`}>
                          <TableHead className="whitespace-nowrap text-right">{vendorName} Rate</TableHead>
                          <TableHead className="whitespace-nowrap text-right">{vendorName} Amount</TableHead>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonRows.map((row) => {
                    const lowestRate = lowestRateByRow.get(row.sr_no) ?? null;
                    return (
                    <TableRow key={`comp-row-${row.sr_no}`} className={row.matchStatus === "unmatched" ? "bg-muted/50" : ""}>
                        <TableCell className="whitespace-nowrap">{row.sr_no}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.item_no || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.hsn_code || "-"}</TableCell>
                        <TableCell className="min-w-[320px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="break-words">{row.material_description}</span>
                            {row.matchStatus === "unmatched" ? (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
                                Unmatched to PR
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">{row.qty ?? "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.unit || "-"}</TableCell>
                        {row.vendorPrices.map((p) => {
                          const rate = toNumberOrNull(p.rate);
                          const isLowest = lowestRate !== null && rate !== null && rate === lowestRate;
                          return (
                            <React.Fragment key={`cell-${row.sr_no}-${p.vendorName}`}>
                              <TableCell className={`whitespace-nowrap text-right ${isLowest ? "bg-green-50 text-green-800 font-semibold" : ""}`}>
                                {rate === null ? "-" : formatMoney(rate)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right">{p.amount === null ? "-" : formatMoney(p.amount)}</TableCell>
                            </React.Fragment>
                          );
                        })}
                      </TableRow>
                    );
                  })}

                  <TableRow>
                    <TableCell colSpan={6} className="font-medium">
                      Subtotal
                    </TableCell>
                    {totals.subtotals.map((value, idx) => (
                      <React.Fragment key={`subtotal-${idx}`}>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(value)}</TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} className="font-medium">Discount</TableCell>
                    {totals.discount.map((value, idx) => (
                      <React.Fragment key={`discount-${idx}`}>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(value)}</TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} className="font-medium">GST</TableCell>
                    {totals.gst.map((value, idx) => (
                      <React.Fragment key={`gst-${idx}`}>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(value)}</TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} className="font-semibold">
                      Total Value
                    </TableCell>
                    {totals.total.map((value, idx) => (
                      <React.Fragment key={`total-${idx}`}>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            idx === totalValueExtremes.minIdx
                              ? "bg-emerald-100 text-emerald-900"
                              : idx === totalValueExtremes.maxIdx
                                ? "bg-rose-100 text-rose-900"
                                : ""
                          }`}
                        >
                          {formatMoney(value)}
                        </TableCell>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="rounded-lg border p-4 text-sm">
              <div className="font-medium">Step 3: Select Vendor</div>
              <div className="text-muted-foreground mt-1">
                Selecting a vendor and clicking “Save Approval” saves a vendor comparison record with only that vendor’s items in `pricelist`.
                Any record that still contains multiple vendors is treated as a draft.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {vendors.length === 0 ? (
                  <div className="text-muted-foreground">No vendors found in this sheet.</div>
                ) : (
                  vendors.map((vendor) => {
                    const vendorName = typeof vendor === "string" ? vendor : String(vendor?.displayName || vendor?.name || "").trim();
                    const isSelected = selectedApprovedVendor === vendorName;
                    return (
                      <Button
                        key={`approve-${vendorName}`}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedApprovedVendor(vendorName)}
                      >
                        {vendorName}
                      </Button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
              <Button type="button" variant="outline" onClick={clearFile} className="w-full sm:w-auto">
                Clear
              </Button>
              {!disableUpload ? (
                <Button type="button" onClick={handleCreateComparison} className="w-full sm:w-auto" disabled={creatingComparison}>
                  {creatingComparison ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Approval
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={handleSaveApproval} className="w-full sm:w-auto" disabled={creatingComparison}>
                    {creatingComparison ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Approval
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUseExisting(false);
                      setExistingComparison(existingComparison);
                      setVendors([]);
                      setComparisonRows([]);
                      setCreatedComparisonId(null);
                      setSelectedApprovedVendor("");
                      setStep("select");
                    }}
                    className="w-full sm:w-auto"
                  >
                    Upload new instead
                  </Button>
                </>
              )}
              <Button type="button" onClick={handleDownloadExcel} className="w-full sm:w-auto">
                Download Excel
              </Button>
            </div>

            {createdComparisonId ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="font-medium">{disableUpload ? "Loaded" : "Created"}</div>
                <div className="mt-1 text-muted-foreground">
                  Vendor comparison record ID: {createdComparisonId}
                  {disableUpload ? " (existing)" : ""}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={vendorDialogOpen} onOpenChange={(open) => (open ? setVendorDialogOpen(true) : handleVendorDialogCancel())}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add Missing Vendors</DialogTitle>
            <DialogDescription>
              We found vendors in the uploaded comparison that do not exist in the backend yet. Fill in the missing details for each vendor
              and we’ll continue with the same price list after saving them.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-auto py-2 pr-1">
            {vendorDrafts.map((draft, index) => (
              <div key={`${draft.source_name || draft.vendor_name || index}`} className="rounded-lg border p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Vendor {index + 1}</div>
                    <div className="text-sm text-muted-foreground">From upload: {draft.source_name || draft.vendor_name || "-"}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Vendor Name</Label>
                    <Input value={draft.vendor_name} readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`vendor_company_name_${index}`}>Company Name *</Label>
                    <Input
                      id={`vendor_company_name_${index}`}
                      value={draft.vendor_company_name}
                      onChange={(event) => handleVendorDraftChange(index, "vendor_company_name", event.target.value)}
                      placeholder="Company name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`vendor_email_${index}`}>Email *</Label>
                    <Input
                      id={`vendor_email_${index}`}
                      type="email"
                      value={draft.vendor_email}
                      onChange={(event) => handleVendorDraftChange(index, "vendor_email", event.target.value)}
                      placeholder="vendor@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`mobile_number_${index}`}>Mobile Number *</Label>
                    <Input
                      id={`mobile_number_${index}`}
                      value={draft.mobile_number}
                      onChange={(event) => handleVendorDraftChange(index, "mobile_number", event.target.value)}
                      placeholder="Mobile number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`location_${index}`}>Location *</Label>
                    <Input
                      id={`location_${index}`}
                      value={draft.location}
                      onChange={(event) => handleVendorDraftChange(index, "location", event.target.value)}
                      placeholder="Location"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={draft.status}
                      onValueChange={(value) => handleVendorDraftChange(index, "status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-sm text-muted-foreground">
            Fill all required fields marked with * to enable saving the vendor registration.
          </div>

          <DialogFooter className="flex-row gap-3 sm:gap-2">
            <Button type="button" variant="outline" onClick={handleVendorDialogCancel} disabled={creatingComparison}>
              Cancel
            </Button>
            <Button type="button" onClick={handleVendorDraftSubmit} disabled={creatingComparison || !vendorDraftsReady}>
              {creatingComparison ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving vendors...
                </>
              ) : (
                "Save Vendors & Continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
