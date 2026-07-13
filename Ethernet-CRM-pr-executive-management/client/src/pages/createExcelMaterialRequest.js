import * as XLSX from "xlsx";

const FONT = "Calibri";
const THIN = { style: "thin", color: { rgb: "7A7A7A" } };
const LIGHT_BORDER = { style: "thin", color: { rgb: "BFBFBF" } };

const FILL_HEADER = { fgColor: { rgb: "D9E1F2" }, patternType: "solid" };
const FILL_INFO = { fgColor: { rgb: "F3F4F6" }, patternType: "solid" };

const align = (horizontal = "center", vertical = "center", wrapText = false) => ({
  horizontal,
  vertical,
  wrapText,
});

const baseBorder = () => ({
  top: THIN,
  right: THIN,
  bottom: THIN,
  left: THIN,
});

const styleCell = (overrides = {}) => ({
  font: { name: FONT, sz: 11, ...overrides.font },
  alignment: { ...align(), ...overrides.alignment },
  border: baseBorder(),
  ...overrides,
});

const titleStyle = styleCell({
  font: { name: FONT, sz: 18, bold: true },
  alignment: align("center", "center"),
});

const infoLabelStyle = styleCell({
  font: { name: FONT, sz: 11, bold: true },
  alignment: align("left", "center"),
  fill: FILL_INFO,
});

const infoValueStyle = styleCell({
  font: { name: FONT, sz: 11 },
  alignment: align("left", "center", true),
  fill: FILL_INFO,
});

const tableHeaderStyle = styleCell({
  font: { name: FONT, sz: 10, bold: true },
  alignment: align("center", "center", true),
  fill: FILL_HEADER,
});

const itemIndexStyle = styleCell({
  font: { name: FONT, sz: 10 },
  alignment: align("center", "top"),
});

const itemDescStyle = styleCell({
  font: { name: FONT, sz: 10 },
  alignment: align("left", "top", true),
});

const itemCenterStyle = styleCell({
  font: { name: FONT, sz: 10 },
  alignment: align("center", "center"),
});

const footerStyle = styleCell({
  font: { name: FONT, sz: 11, bold: true },
  alignment: align("center", "center"),
});

function toText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDateDmy(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function createBaseSheet(maxRow = 32, maxCol = 12) {
  const ws = {};
  for (let r = 0; r < maxRow; r += 1) {
    for (let c = 0; c < maxCol; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = { v: "", t: "s", s: styleCell() };
    }
  }
  ws["!ref"] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: maxRow - 1, c: maxCol - 1 });
  return ws;
}

function setCell(ws, addr, value, style) {
  const nextValue = value == null ? "" : value;
  ws[addr] = {
    v: nextValue,
    t: typeof nextValue === "number" ? "n" : "s",
    s: style || styleCell(),
  };
}

function merge(ws, ranges) {
  ws["!merges"] = ranges;
}

function setRowHeights(ws, heights) {
  ws["!rows"] = [];
  Object.entries(heights).forEach(([rowIndex, height]) => {
    ws["!rows"][Number(rowIndex)] = { hpt: height };
  });
}

function setColWidths(ws) {
  ws["!cols"] = [
    { wch: 12 }, // A - BOQ No.
    { wch: 20 }, // B - Item Name
    { wch: 36 }, // C - Description
    { wch: 12 }, // D - Unit
    { wch: 12 }, // E - Qty
    { wch: 10 }, // F
    { wch: 10 }, // G
    { wch: 10 }, // H
    { wch: 14 }, // I - Make
    { wch: 10 }, // J - place start
    { wch: 10 }, // K
    { wch: 12 }, // L - place end
  ];
}

function estimateWrappedLines(text, maxCharsPerLine) {
  const content = String(text ?? "").trim();
  if (!content) return 1;
  const words = content.split(/\s+/).filter(Boolean);
  let lines = 1;
  let current = 0;

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      if (current > 0) {
        lines += 1;
        current = 0;
      }
      lines += Math.ceil(word.length / maxCharsPerLine) - 1;
      current = word.length % maxCharsPerLine;
      if (current === 0) current = maxCharsPerLine;
      continue;
    }

    const needed = current === 0 ? word.length : current + 1 + word.length;
    if (needed <= maxCharsPerLine) {
      current = needed;
    } else {
      lines += 1;
      current = word.length;
    }
  }

  return lines;
}

function fillRange(ws, startRow, endRow, startCol, endCol, fill) {
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] || { v: "", t: "s", s: styleCell() };
      cell.s = {
        ...(cell.s || styleCell()),
        fill,
      };
      ws[addr] = cell;
    }
  }
}

export function createMaterialRequestWorkbook(pr = {}) {
  const items = Array.isArray(pr.items) ? pr.items : [];
  const minRows = 15;
  const totalRows = Math.max(items.length, minRows);
  const footerGapRows = 2;
  const footerStartRow = 11 + totalRows + footerGapRows;
  const footerRows = 4;
  const maxRow = footerStartRow + footerRows + 1;
  const ws = createBaseSheet(maxRow, 12);

  const headerMerges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    { s: { r: 2, c: 6 }, e: { r: 2, c: 11 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
    { s: { r: 3, c: 6 }, e: { r: 3, c: 11 } },
    { s: { r: 4, c: 0 }, e: { r: 5, c: 11 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 5 } },
    { s: { r: 6, c: 6 }, e: { r: 6, c: 11 } },
    { s: { r: 7, c: 0 }, e: { r: 7, c: 5 } },
    { s: { r: 7, c: 6 }, e: { r: 7, c: 11 } },
    { s: { r: footerStartRow - 1, c: 0 }, e: { r: footerStartRow - 1, c: 3 } },
    { s: { r: footerStartRow - 1, c: 4 }, e: { r: footerStartRow - 1, c: 7 } },
    { s: { r: footerStartRow - 1, c: 8 }, e: { r: footerStartRow - 1, c: 11 } },
    { s: { r: footerStartRow, c: 8 }, e: { r: footerStartRow + 2, c: 11 } },
  ];

  setCell(ws, "A1", "Material Request", titleStyle);

  setCell(ws, "A3", "Project Name", infoLabelStyle);
  setCell(ws, "B3", toText(pr.project_name), infoValueStyle);
  setCell(ws, "G3", "Date", infoLabelStyle);
  setCell(ws, "H3", formatDateDmy(pr.date || pr.created_at), infoValueStyle);

  setCell(ws, "A4", "Work Order No.", infoLabelStyle);
  setCell(ws, "B4", toText(pr.workorder_no), infoValueStyle);
  setCell(ws, "G4", "Floor No.", infoLabelStyle);
  setCell(ws, "H4", toText(pr.floor_no || pr.floorNo), infoValueStyle);

  setCell(ws, "A5", "Location", infoLabelStyle);
  setCell(ws, "B5", toText(pr.location), infoValueStyle);
  setCell(ws, "G5", "Flat No.", infoLabelStyle);
  setCell(ws, "H5", toText(pr.flat_no || pr.flatNo), infoValueStyle);

  setCell(ws, "A7", "MR No.", infoLabelStyle);
  setCell(ws, "B7", toText(pr.pr_number || pr.pr_id || pr.id), infoValueStyle);
  setCell(ws, "G7", "Sample ID", infoLabelStyle);
  setCell(ws, "H7", toText(pr.sample_id), infoValueStyle);

  setCell(ws, "A8", "Urgency", infoLabelStyle);
  setCell(ws, "B8", toText(pr.urgency, "Medium"), infoValueStyle);

  fillRange(ws, 2, 7, 0, 11, FILL_INFO);

  setCell(ws, "A10", "BOQ No.", tableHeaderStyle);
  setCell(ws, "B10", "Item Name", tableHeaderStyle);
  setCell(ws, "C10", "Description", tableHeaderStyle);
  setCell(ws, "D10", "Unit", tableHeaderStyle);
  setCell(ws, "E10", "Qty", tableHeaderStyle);

  const rowHeights = {
    0: 40,
    1: 8,
    2: 22,
    3: 22,
    4: 28,
    5: 0,
    6: 22,
    7: 22,
    8: 20,
    9: 24,
    [footerStartRow - 1]: 22,
    [footerStartRow]: 22,
    [footerStartRow + 1]: 28,
    [footerStartRow + 2]: 28,
  };

  for (let i = 0; i < totalRows; i += 1) {
    const row = 11 + i;
    const item = items[i] || {};
    const boqNo = i < items.length ? toText(item.boq_serial_no, "") : "";
    const itemName = i < items.length ? toText(item.item_name, "") : "";
    const description = i < items.length ? toText(item.description || item.material_description, "") : "";

    setCell(ws, `A${row}`, boqNo, itemIndexStyle);
    setCell(ws, `B${row}`, itemName, itemDescStyle);
    setCell(ws, `C${row}`, description, itemDescStyle);
    setCell(ws, `D${row}`, i < items.length ? toText(item.unit, "") : "", itemCenterStyle);
    setCell(ws, `E${row}`, i < items.length ? toText(item.req_qty, "") : "", itemCenterStyle);

    const descLines = estimateWrappedLines(description, 38);
    const nameLines = estimateWrappedLines(itemName, 24);
    const lineCount = Math.max(descLines, nameLines, 1);
    rowHeights[row - 1] = Math.max(22, lineCount * 16);
  }

  merge(ws, headerMerges);

  setCell(ws, `A${footerStartRow}`, "Requested By :", footerStyle);
  setCell(ws, `E${footerStartRow}`, "Checked By :", footerStyle);
  setCell(ws, `I${footerStartRow}`, "Approved By :", footerStyle);

  if (pr.approved_by && pr.approved_by !== "-") {
    setCell(ws, `I${footerStartRow + 1}`, String(pr.approved_by), footerStyle);
  }
  if (pr.signature_file_path) {
    setCell(ws, `I${footerStartRow + 2}`, "Signature attached", footerStyle);
  }

  fillRange(ws, 9, 9, 0, 11, FILL_HEADER);

  setRowHeights(ws, rowHeights);
  setColWidths(ws);

  ws["!pageSetup"] = {
    paperSize: 9,
    orientation: "portrait",
    fitToWidth: 1,
    fitToHeight: 0,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Material Request");
  return wb;
}

export async function downloadMaterialRequestExcel(pr, filename) {
  const wb = createMaterialRequestWorkbook(pr);
  XLSX.writeFile(wb, filename || `Material-Request-${String(pr?.pr_number || pr?.pr_id || "PR").trim()}.xlsx`);
}
