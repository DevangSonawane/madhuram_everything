import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import poHeaderUrl from "@/assets/po-header.png";

const formatDateDmy = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
};

const formatDateWithSeparator = (value, separator) => {
  const formatted = formatDateDmy(value);
  return formatted === "-" ? formatted : formatted.replace(/\./g, separator);
};

const asText = (value, fallback = "-") => {
  const raw = value == null ? "" : String(value);
  const cleaned = raw.trim();
  return cleaned ? cleaned : fallback;
};

const toAmount = (value) => {
  if (value == null || value === "") return "";
  const num = Number(String(value).replace(/,/g, "").trim());
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const normalizeLines = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  return String(value)
    .split(/\n+/)
    .map((v) => v.trim())
    .filter(Boolean);
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

const loadImageDataUrl = async (url) => {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  if (!blob || blob.size === 0) throw new Error("Empty image");
  return await blobToDataUrl(blob);
};

const loadHtmlImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });

const normalizeExcelText = (value, fallback = "") => {
  const raw = value == null ? "" : String(value);
  const cleaned = raw.trim();
  return cleaned || fallback;
};

const parseExcelNumber = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatExcelAmount = (value) => {
  const parsed = parseExcelNumber(value);
  if (parsed == null) return normalizeExcelText(value, "-");
  return parsed;
};

const safeExcelSheetName = (value) => {
  const raw = normalizeExcelText(value, "Purchase Order");
  return raw.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "Purchase Order";
};

const setCellStyle = (ws, addr, style) => {
  if (!ws[addr]) return;
  ws[addr].s = {
    ...(ws[addr].s || {}),
    ...style,
  };
};

const mergeRange = (startCol, startRow, endCol, endRow) => ({
  s: { c: startCol, r: startRow },
  e: { c: endCol, r: endRow },
});

const buildPurchaseOrderExcelSheet = (po) => {
  const vendor = po.vendor || {};
  const contacts = vendor.contacts || {};
  const primary = contacts.primary || {};
  const secondary = contacts.secondary || {};
  const items = Array.isArray(po.items) ? po.items : [];
  const notes = normalizeLines(po.notes);
  const terms = normalizeLines(po.termsAndConditions);

  const rows = [];
  const merges = [];
  const rowHeights = {};

  const push = (row) => {
    rows.push(row);
    return rows.length; // 1-based row number
  };

  const pushMergedRow = (value, startCol = 0, endCol = 7) => {
    const rowNumber = push([value, "", "", "", "", "", "", ""]);
    merges.push(mergeRange(startCol, rowNumber - 1, endCol, rowNumber - 1));
    return rowNumber;
  };

  const pushMetaRow = (label, value) => {
    const rowNumber = push([label, value, "", "", "", "", "", ""]);
    merges.push(mergeRange(1, rowNumber - 1, 7, rowNumber - 1));
    return rowNumber;
  };

  const indentDate = normalizeExcelText(po.indentNo, "-")
    ? `${normalizeExcelText(po.indentNo, "-")}, Dated - ${normalizeExcelText(po.indentDate || po.poDate, "-")}`
    : normalizeExcelText(po.indentDate || po.poDate, "-");
  const toValue = normalizeExcelText(vendor.name || po.vendorName || po.companyName, "-");
  const siteValue = normalizeExcelText(vendor.site || po.companyName || po.site, "-");
  const siteAddress = normalizeExcelText(
    vendor.siteAddress || vendor.address || po.siteAddress || po.site_address || po.companySubtitle || po.address,
    "-"
  );
  const primaryContactValue = [normalizeExcelText(primary.name, ""), normalizeExcelText(primary.phone, "")]
    .filter(Boolean)
    .join(" - ") || "-";
  const secondaryContactValue = [normalizeExcelText(secondary.name, ""), normalizeExcelText(secondary.phone, "")]
    .filter(Boolean)
    .join(" - ") || "-";

  const summaryRows = [
    ["Subtotal", formatExcelAmount(po.subtotalAmount)],
    ["Discount", normalizeExcelText(
      po.discount?.amount != null && po.discount?.amount !== ""
        ? `${normalizeExcelText(po.discount.percent, "0")}% (${normalizeExcelText(po.discount.amount, "0")})`
        : po.discount?.percent != null && po.discount?.percent !== ""
          ? `${normalizeExcelText(po.discount.percent, "0")}%`
          : po.discount?.amount || "",
      "-"
    )],
    ["After Discount", formatExcelAmount(po.afterDiscountAmount)],
    ["CGST", normalizeExcelText(
      po.taxes?.cgst?.percent || po.taxes?.cgst?.amount
        ? `${normalizeExcelText(po.taxes?.cgst?.percent, "0")}% (${normalizeExcelText(po.taxes?.cgst?.amount, "0")})`
        : "",
      "-"
    )],
    ["SGST", normalizeExcelText(
      po.taxes?.sgst?.percent || po.taxes?.sgst?.amount
        ? `${normalizeExcelText(po.taxes?.sgst?.percent, "0")}% (${normalizeExcelText(po.taxes?.sgst?.amount, "0")})`
        : "",
      "-"
    )],
    ["Total", formatExcelAmount(po.totalAmount)],
  ];

  pushMergedRow("PURCHASE ORDER");
  pushMergedRow(normalizeExcelText(po.companyName || po.title || vendor.name || "Purchase Order"));
  pushMergedRow(normalizeExcelText(po.sourceFileName || po.source || "Generated from the PO module"));
  push([]);
  pushMetaRow("Indent No.", indentDate);
  pushMetaRow("Order No.", normalizeExcelText(po.orderNo, "-"));
  pushMetaRow("PO Date", normalizeExcelText(po.poDate, "-"));
  pushMetaRow("To", toValue);
  pushMetaRow("Site", siteValue);
  pushMetaRow("Site Address", siteAddress);
  pushMetaRow("Primary Contact", primaryContactValue);
  pushMetaRow("Secondary Contact", secondaryContactValue);
  push([]);

  const itemsSectionRow = pushMergedRow("ITEMS");
  const headerRow = push(["S. No.", "Description", "HSN", "Qty", "UOM", "Rate", "Amount", "Remark"]);
  const itemDataStartRow = rows.length + 1;

  items.forEach((item, index) => {
    push([
      index + 1,
      normalizeExcelText(item?.description, "-"),
      normalizeExcelText(item?.hsnCode || item?.hsn, "-"),
      formatExcelAmount(item?.qty),
      normalizeExcelText(item?.uom || item?.UOM, "-"),
      formatExcelAmount(item?.rate),
      formatExcelAmount(item?.amount),
      normalizeExcelText(item?.remarks || item?.remark, ""),
    ]);
  });

  push([]);
  const summarySectionRow = pushMergedRow("SUMMARY");
  summaryRows.forEach(([label, value]) => {
    const rowNumber = push([label, value, "", "", "", "", "", ""]);
    merges.push(mergeRange(1, rowNumber - 1, 7, rowNumber - 1));
  });

  push([]);
  const notesSectionRow = pushMergedRow("NOTES");
  if (notes.length === 0) {
    const rowNumber = push(["-", "", "", "", "", "", "", ""]);
    merges.push(mergeRange(0, rowNumber - 1, 7, rowNumber - 1));
  } else {
    notes.forEach((note, index) => {
      const rowNumber = push([`${index + 1}. ${note}`, "", "", "", "", "", "", ""]);
      merges.push(mergeRange(0, rowNumber - 1, 7, rowNumber - 1));
    });
  }

  push([]);
  const termsSectionRow = pushMergedRow("TERMS & CONDITIONS");
  if (terms.length === 0) {
    const rowNumber = push(["-", "", "", "", "", "", "", ""]);
    merges.push(mergeRange(0, rowNumber - 1, 7, rowNumber - 1));
  } else {
    terms.forEach((term, index) => {
      const rowNumber = push([`${index + 1}. ${term}`, "", "", "", "", "", "", ""]);
      merges.push(mergeRange(0, rowNumber - 1, 7, rowNumber - 1));
    });
  }

  rowHeights[0] = 24;
  rowHeights[1] = 18;
  rowHeights[2] = 16;
  for (let row = 5; row <= 12; row += 1) {
    rowHeights[row - 1] = row === 10 ? 34 : 22;
  }
  rowHeights[itemsSectionRow - 1] = 20;
  rowHeights[headerRow - 1] = 28;
  for (let row = itemDataStartRow; row < itemDataStartRow + items.length; row += 1) {
    const item = items[row - itemDataStartRow];
    const descriptionLines = String(item?.description || "").length ? Math.ceil(String(item.description).length / 35) : 1;
    const remarkLines = String(item?.remarks || item?.remark || "").length ? Math.ceil(String(item.remarks || item.remark).length / 40) : 1;
    rowHeights[row - 1] = Math.max(20, Math.min(48, Math.max(descriptionLines, remarkLines) * 14));
  }
  rowHeights[summarySectionRow - 1] = 20;
  rowHeights[notesSectionRow - 1] = 20;
  rowHeights[termsSectionRow - 1] = 20;

  return {
    rows,
    merges,
    rowHeights,
    itemDataStartRow,
    itemDataEndRow: itemDataStartRow + items.length - 1,
    summarySectionRow,
    notesSectionRow,
    termsSectionRow,
  };
};

export const downloadPurchaseOrderExcel = async (poInput, { fileName } = {}) => {
  if (!poInput) return;

  const po = poInput || {};
  const { rows, merges, rowHeights, itemDataStartRow, itemDataEndRow, summarySectionRow, notesSectionRow, termsSectionRow } =
    buildPurchaseOrderExcelSheet(po);
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 8 },
    { wch: 38 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
  ];
  ws["!rows"] = rows.map((_, index) => (rowHeights[index] ? { hpt: rowHeights[index] } : { hpt: 22 }));

  const titleStyle = {
    font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "1F2937" } },
  };
  const subtitleStyle = {
    font: { name: "Calibri", sz: 11, italic: true, color: { rgb: "334155" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const sectionStyle = {
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "left", vertical: "center" },
    fill: { patternType: "solid", fgColor: { rgb: "0F766E" } },
  };
  const metaLabelStyle = {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "0F172A" } },
    fill: { patternType: "solid", fgColor: { rgb: "E2E8F0" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };
  const metaValueStyle = {
    font: { name: "Calibri", sz: 10, color: { rgb: "111827" } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };
  const headerStyle = {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
    border: {
      top: { style: "thin", color: { rgb: "1D4ED8" } },
      bottom: { style: "thin", color: { rgb: "1D4ED8" } },
      left: { style: "thin", color: { rgb: "1D4ED8" } },
      right: { style: "thin", color: { rgb: "1D4ED8" } },
    },
  };
  const bodyStyle = {
    font: { name: "Calibri", sz: 10, color: { rgb: "111827" } },
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
  };
  const numberBodyStyle = {
    ...bodyStyle,
    alignment: { horizontal: "right", vertical: "top", wrapText: true },
    numFmt: "#,##0.00",
  };
  const summaryLabelStyle = {
    ...metaLabelStyle,
    fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
  };
  const summaryValueStyle = {
    ...metaValueStyle,
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
    numFmt: "#,##0.00",
  };
  const noteTitleStyle = {
    ...sectionStyle,
    fill: { patternType: "solid", fgColor: { rgb: "7C3AED" } },
  };
  const noteBodyStyle = {
    ...metaValueStyle,
    alignment: { horizontal: "left", vertical: "top", wrapText: true },
  };

  setCellStyle(ws, "A1", titleStyle);
  setCellStyle(ws, "A2", subtitleStyle);
  setCellStyle(ws, "A3", subtitleStyle);
  for (let row = 5; row <= 12; row += 1) {
    setCellStyle(ws, `A${row}`, metaLabelStyle);
    setCellStyle(ws, `B${row}`, metaValueStyle);
  }
  setCellStyle(ws, `A${itemDataStartRow - 2}`, sectionStyle);
  for (const col of ["A", "B", "C", "D", "E", "F", "G", "H"]) {
    setCellStyle(ws, `${col}${itemDataStartRow - 1}`, headerStyle);
  }

  for (let row = itemDataStartRow; row <= itemDataEndRow; row += 1) {
    setCellStyle(ws, `A${row}`, { ...bodyStyle, alignment: { horizontal: "center", vertical: "top", wrapText: true } });
    setCellStyle(ws, `B${row}`, bodyStyle);
    setCellStyle(ws, `C${row}`, { ...bodyStyle, alignment: { horizontal: "center", vertical: "top", wrapText: true } });
    setCellStyle(ws, `D${row}`, numberBodyStyle);
    setCellStyle(ws, `E${row}`, { ...bodyStyle, alignment: { horizontal: "center", vertical: "top", wrapText: true } });
    setCellStyle(ws, `F${row}`, numberBodyStyle);
    setCellStyle(ws, `G${row}`, numberBodyStyle);
    setCellStyle(ws, `H${row}`, bodyStyle);
  }

  setCellStyle(ws, `A${summarySectionRow}`, sectionStyle);
  for (let row = summarySectionRow + 1; row < notesSectionRow - 1; row += 1) {
    setCellStyle(ws, `A${row}`, summaryLabelStyle);
    setCellStyle(ws, `B${row}`, summaryValueStyle);
  }

  setCellStyle(ws, `A${notesSectionRow}`, noteTitleStyle);
  for (let row = notesSectionRow + 1; row < termsSectionRow - 1; row += 1) {
    setCellStyle(ws, `A${row}`, noteBodyStyle);
  }

  setCellStyle(ws, `A${termsSectionRow}`, noteTitleStyle);
  for (let row = termsSectionRow + 1; row <= rows.length; row += 1) {
    setCellStyle(ws, `A${row}`, noteBodyStyle);
  }

  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: itemDataStartRow - 2 },
      e: { c: 7, r: Math.max(itemDataStartRow - 1, itemDataEndRow) },
    }),
  };

  const wb = XLSX.utils.book_new();
  const sheetName = safeExcelSheetName(po.orderNo ? `PO ${po.orderNo}` : po.title || "Purchase Order");
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName || `${sheetName}.xlsx`);
};

export const downloadPurchaseOrderPdf = async (poInput, { fileName } = {}) => {
  if (!poInput) return;

  const po = poInput || {};
  const vendor = po.vendor || {};
  const contacts = vendor.contacts || {};
  const primary = contacts.primary || {};
  const secondary = contacts.secondary || {};
  const items = Array.isArray(po.items) ? po.items : [];
  const notes = normalizeLines(po.notes);
  const terms = normalizeLines(po.termsAndConditions);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setTextColor(0);
  doc.setDrawColor(0);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const x = margin;
  const y = margin;
  const w = pageW - margin * 2;
  const h = pageH - margin * 2;
  const wrapText = (text, width) => {
    const raw = String(text ?? "").trim();
    if (!raw) return [];
    return doc.splitTextToSize(raw, Math.max(12, width)).map((line) => String(line));
  };

  const wrapLimitedText = (text, width, maxLines = 2) => {
    const wrapped = wrapText(text, width);
    if (wrapped.length <= maxLines) return wrapped;
    const clipped = wrapped.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/\s+$/, "")}...`;
    return clipped;
  };

  const compactNoteText = (text, maxWords = 8, maxChars = 52) => {
    const raw = String(text ?? "").trim();
    if (!raw) return "";
    const words = raw.split(/\s+/).filter(Boolean);
    const shortened = words.slice(0, maxWords).join(" ");
    const candidate = shortened.length > maxChars ? shortened.slice(0, maxChars).trimEnd() : shortened;
    if (candidate.length >= raw.length) return raw;
    return `${candidate.replace(/[.,;:\-]+$/, "")}...`;
  };

  const drawHeaderField = ({ label, value, bx, by, blockW, valueFontSize = 8.8, boldValue = false, valueOffset = 16 }) => {
    doc.setFont("times", "bold");
    doc.setFontSize(8.6);
    doc.text(label, bx, by);
    const labelW = doc.getTextWidth(label);
    const valueX = bx + Math.max(valueOffset, labelW + 2);
    doc.setLineWidth(0.25);
    doc.line(valueX, by + 1.1, bx + blockW, by + 1.1);
    doc.setFont("times", boldValue ? "bold" : "normal");
    doc.setFontSize(valueFontSize);
    doc.text(asText(value, "-"), valueX + 0.2, by);
  };

  const drawMultiLineHeaderField = ({
    label,
    value,
    bx,
    by,
    blockW,
    maxLines = 2,
    valueFontSize = 8.8,
    valueSpacing = 4.2,
    valueOffset = 16,
  }) => {
    const rawLines = String(value ?? "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const wrappedLines = rawLines.length
      ? rawLines.flatMap((line) => wrapText(line, Math.max(14, blockW - 16)))
      : [];
    const normalizedLines = wrappedLines.length ? wrappedLines.slice(0, maxLines) : ["-"];

    doc.setFont("times", "bold");
    doc.setFontSize(8.6);
    doc.text(label, bx, by);
    const labelW = doc.getTextWidth(label);
    const valueX = bx + Math.max(valueOffset, labelW + 2);
    doc.setFont("times", "normal");
    doc.setFontSize(valueFontSize);

    normalizedLines.forEach((line, index) => {
      const lineY = by + index * valueSpacing;
      doc.setLineWidth(0.25);
      doc.line(valueX, lineY + 1.1, bx + blockW, lineY + 1.1);
      doc.text(String(line || "-"), valueX + 0.2, lineY);
    });

    return by + Math.max(4.8, normalizedLines.length * valueSpacing);
  };

  const drawUnderlinedRow = ({ label, value, bx, by, width, valueOffset = 18 }) => {
    doc.setFont("times", "bold");
    doc.setFontSize(7.8);
    doc.text(label, bx, by);
    doc.setFont("times", "normal");
    const valueX = bx + valueOffset;
    const underlineY = by + 1.1;
    const underlineEndX = Math.min(bx + width, valueX + 34);
    doc.setLineWidth(0.22);
    doc.line(valueX, underlineY, underlineEndX, underlineY);
    doc.text(asText(value, "-"), valueX + 0.2, by);
  };

  const primaryContactValue = [asText(primary.name, ""), asText(primary.phone, "")].filter(Boolean).join(" - ") || "-";
  const secondaryContactValue = [asText(secondary.name, ""), asText(secondary.phone, "")].filter(Boolean).join(" - ") || "-";

  const indentDate = `${asText(po.indentNo, "-")}, Dated - ${formatDateWithSeparator(po.indentDate || po.poDate, "/")}`;
  const toValue = asText(vendor.name || po.vendorName || po.companyName, "-");
  const addressValue = asText(vendor.siteAddress || vendor.address || po.siteAddress || po.site_address || po.companySubtitle || po.address, "-");

  let metaTopY = y + 40;
  try {
    const headerDataUrl = await loadImageDataUrl(poHeaderUrl);
    const headerImg = await loadHtmlImage(headerDataUrl);
    const imgW = w;
    const imgH = (headerImg.naturalHeight / headerImg.naturalWidth) * imgW;
    doc.addImage(headerDataUrl, "PNG", x, y, imgW, imgH, undefined, "FAST");
    metaTopY = y + imgH + 4;
  } catch {
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("PURCHASE ORDER", x + w / 2, y + 12, { align: "center" });
    metaTopY = y + 18;
  }

  const leftBlockW = w * 0.64;
  const rightBlockX = x + leftBlockW + 8;
  const rightBlockW = w - leftBlockW - 8;

  drawHeaderField({
    label: "Indent No.",
    value: indentDate,
    bx: x + 2,
    by: metaTopY,
    blockW: leftBlockW - 4,
    boldValue: true,
  });
  drawHeaderField({
    label: "Order No :",
    value: po.orderNo,
    bx: rightBlockX,
    by: metaTopY,
    blockW: rightBlockW - 2,
    boldValue: true,
  });

  const row2Y = metaTopY + 8.6;
  drawHeaderField({
    label: "To :",
    value: toValue,
    bx: x + 2,
    by: row2Y,
    blockW: leftBlockW - 4,
    boldValue: true,
  });
  drawHeaderField({
    label: "P.O. Date :",
    value: formatDateWithSeparator(po.poDate, "-"),
    bx: rightBlockX,
    by: row2Y,
    blockW: rightBlockW - 2,
    boldValue: true,
  });

  const row3Y = row2Y + 8.6;
  drawHeaderField({
    label: "Site :",
    value: asText(vendor.site || po.companyName || po.site, "-"),
    bx: x + 2,
    by: row3Y,
    blockW: leftBlockW - 4,
    boldValue: true,
  });
  drawHeaderField({
    label: "Primary Contact :",
    value: primaryContactValue,
    bx: rightBlockX,
    by: row3Y,
    blockW: rightBlockW - 2,
    boldValue: true,
    valueFontSize: 8.2,
  });

  const row4Y = row3Y + 8.6;
  drawMultiLineHeaderField({
    label: "Address :",
    value: addressValue,
    bx: x + 2,
    by: row4Y,
    blockW: leftBlockW - 4,
    maxLines: 2,
  });
  drawHeaderField({
    label: "Secondary Contact :",
    value: secondaryContactValue,
    bx: rightBlockX,
    by: row4Y,
    blockW: rightBlockW - 2,
    boldValue: true,
    valueFontSize: 8.2,
  });

  const estimateFooterHeight = ({ noteList, termList, contentWidth }) => {
    const summaryHeight = 18;
    const termsHeight = 6 + termList.reduce((sum, line, idx) => sum + wrapText(`${idx + 1}) ${line}`, contentWidth).length * 3.3, 0);
    const notesHeight = noteList.length
      ? 5 + noteList.reduce((sum, line, idx) => sum + wrapText(`${idx + 1}) ${line}`, contentWidth).length * 3.4, 0)
      : 0;
    const signatureHeight = 11;
    return summaryHeight + termsHeight + notesHeight + signatureHeight;
  };

  // Items table (grid like the sample format)
  const tableStartY = row4Y + 14;
  const rows = items.map((item, index) => {
    const current = item || {};
    return [
      String(current.srNo || current.srno || index + 1),
      asText(current.hsnCode || current.hsn || "", ""),
      asText(current.description || "", ""),
      asText(current.qty || current.quantity || "", ""),
      asText(current.uom || current.UOM || "", ""),
      toAmount(current.rate || current.Rate || ""),
      toAmount(current.amount || current.Amount || ""),
      asText(current.remarks || current.remark || "", ""),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: x, right: x },
    tableWidth: w,
    theme: "grid",
    head: [["Sr. No.", "HSN Code", "Item Description", "Qty", "UOM", "Rate", "Amount", "Remarks"]],
    body: rows,
    styles: {
      font: "times",
      fontSize: 7.6,
      cellPadding: { top: 0.8, right: 0.8, bottom: 0.8, left: 0.8 },
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      valign: "top",
      overflow: "linebreak",
      minCellHeight: 4.8,
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 11, halign: "center" },
      1: { cellWidth: 16 },
      2: { cellWidth: 82 },
      3: { cellWidth: 11, halign: "center" },
      4: { cellWidth: 11, halign: "center" },
      5: { cellWidth: 17, halign: "right" },
      6: { cellWidth: 17, halign: "right" },
      7: { cellWidth: 19 },
    },
    pageBreak: "auto",
    rowPageBreak: "auto",
  });

  const afterTableYRaw = doc.lastAutoTable?.finalY || tableStartY + 120;
  const tableBottomY = afterTableYRaw;
  const totalsX = x + w - 54;
  const footerSummaryX = x;
  const footerSummaryRightX = x + w * 0.62;
  const footerContentWidth = w - 4;

  const FOOTER_DEFAULTS = {
    discount: "Nil",
    tax: "GST - 18%",
    delivery: "Immediate",
    payment: "Against P.I",
    terms: [
      "Please send your order acceptance on receipt of this order.",
      "Send all the material in single trip along with delivery challan & test certificate.",
      "Your payment term will begin from the date of material delivered at site.",
      "Transportation as per discussion (Subject to all material arrived at site as per PO)",
    ],
  };

  // Footer values should be fetched from PO fields, with sensible defaults.
  const footerDiscount = (() => {
    const rawPercent = po?.discount?.percent ?? "";
    const rawAmount = po?.discount?.amount ?? "";

    const percent =
      rawPercent != null && (typeof rawPercent === "string" || typeof rawPercent === "number")
        ? String(rawPercent).trim()
        : "";
    const amount =
      rawAmount != null && (typeof rawAmount === "string" || typeof rawAmount === "number")
        ? String(rawAmount).trim()
        : "";

    // Guard against accidental stringification of objects in upstream code.
    if (percent.toLowerCase().includes("[object")) return "";
    if (amount.toLowerCase().includes("[object")) return "";

    if (amount) return toAmount(amount) || amount;
    if (percent) return `${percent}%`;
    return FOOTER_DEFAULTS.discount;
  })();

  const footerTax = (() => {
    const explicit = String(po.summary?.tax ?? "").trim();
    if (explicit) return explicit;
    const cgst = Number(String(po.taxes?.cgst?.percent ?? "").trim());
    const sgst = Number(String(po.taxes?.sgst?.percent ?? "").trim());
    if (!Number.isNaN(cgst) && !Number.isNaN(sgst) && (cgst > 0 || sgst > 0)) {
      const total = cgst + sgst;
      const formatted = Number.isInteger(total) ? String(total) : total.toFixed(2);
      return `GST - ${formatted}%`;
    }
    return FOOTER_DEFAULTS.tax;
  })();

  const footerDelivery = (() => {
    const value = String(po.summary?.delivery ?? "").trim();
    return value || FOOTER_DEFAULTS.delivery;
  })();

  const footerPayment = (() => {
    const value = String(po.summary?.payment ?? "").trim();
    return value || FOOTER_DEFAULTS.payment;
  })();

  const footerTerms = (() => {
    const normalized = normalizeLines(po.termsAndConditions);
    const source = normalized.length ? normalized : FOOTER_DEFAULTS.terms;
    // Format spec shows 4 points.
    return source.slice(0, 4);
  })();

  const footerNoteLines = notes.slice(0, 4);
  const estimatedFooterH = estimateFooterHeight({
    noteList: footerNoteLines,
    termList: footerTerms,
    contentWidth: footerContentWidth,
  });

  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const pageBottomY = y + h;
  const footerStartY = tableBottomY + 6;
  const needsDedicatedFooterPage = footerStartY + estimatedFooterH > pageBottomY - 4;

  if (needsDedicatedFooterPage) {
    doc.addPage();
  }

  const footerPageTopY = needsDedicatedFooterPage ? y : footerStartY;
  let footerCursorY = footerPageTopY;

  const totalsBaseY = Math.max(footerCursorY, footerPageTopY + 1);
  doc.setFont("times", "bold");
  doc.setFontSize(7.6);
  doc.text(`CGST - ${asText(po.taxes?.cgst?.percent, "-")}%`, x + w - 56, totalsBaseY);
  doc.text(toAmount(po.taxes?.cgst?.amount) || "-", x + w - 2, totalsBaseY, { align: "right" });
  doc.text(`SGST - ${asText(po.taxes?.sgst?.percent, "-")}%`, x + w - 56, totalsBaseY + 4);
  doc.text(toAmount(po.taxes?.sgst?.amount) || "-", x + w - 2, totalsBaseY + 4, { align: "right" });
  doc.setFontSize(8.2);
  doc.text("Total Amount", x + w - 56, totalsBaseY + 10);
  doc.text(toAmount(po.totalAmount) || "-", x + w - 2, totalsBaseY + 10, { align: "right" });

  footerCursorY = totalsBaseY + 14;

  drawUnderlinedRow({
    label: "Discount:",
    value: footerDiscount,
    bx: footerSummaryX,
    by: footerCursorY,
    width: footerSummaryX + w * 0.45,
    valueOffset: 22,
  });
  drawUnderlinedRow({
    label: "Tax:",
    value: footerTax,
    bx: footerSummaryRightX,
    by: footerCursorY,
    width: x + w - 2,
    valueOffset: 12,
  });

  footerCursorY += 6;
  drawUnderlinedRow({
    label: "Delivery:",
    value: footerDelivery,
    bx: footerSummaryX,
    by: footerCursorY,
    width: footerSummaryX + w * 0.45,
    valueOffset: 22,
  });
  drawUnderlinedRow({
    label: "Payment:",
    value: footerPayment,
    bx: footerSummaryRightX,
    by: footerCursorY,
    width: x + w - 2,
    valueOffset: 18,
  });

  footerCursorY += 6;

  if (footerNoteLines.length) {
    doc.setFont("times", "bold");
    doc.setFontSize(7.8);
    doc.text("Notes:", footerSummaryX, footerCursorY);
    doc.setFont("times", "normal");
    doc.setFontSize(7.2);
    footerNoteLines.forEach((line, idx) => {
      footerCursorY += 3.4;
      doc.text(`${idx + 1}) ${compactNoteText(line)}`, footerSummaryX, footerCursorY);
    });
    footerCursorY += 3;
  }

  footerCursorY += 5;
  doc.setFont("times", "bold");
  doc.setFontSize(7.8);
  doc.text("Terms & Conditions:", footerSummaryX, footerCursorY);
  doc.setFont("times", "normal");
  doc.setFontSize(7.2);
  footerTerms.forEach((line, idx) => {
    const wrapped = wrapLimitedText(`${idx + 1}) ${String(line)}`, footerContentWidth, 2);
    wrapped.forEach((wrappedLine) => {
      footerCursorY += 3.4;
      doc.text(wrappedLine, footerSummaryX, footerCursorY);
    });
  });

  const signY = Math.max(y + h - 10, footerCursorY + 8);
  doc.setFont("times", "normal");
  doc.setFontSize(7.6);
  doc.text("Authorised Signatory", x + w - 40, signY + 6, { align: "center" });
  doc.setLineWidth(0.25);
  doc.line(x + w - 70, signY + 2.5, x + w - 10, signY + 2.5);

  const baseName = String(fileName || "").trim();
  const resolvedName = baseName
    ? baseName
    : `PO-${asText(po.orderNo, "PO")}-${formatDateDmy(po.poDate).replace(/\./g, "-")}.pdf`;
  doc.save(resolvedName);
};
