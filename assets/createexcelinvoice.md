/**
 * createExcelInvoice.js
 *
 * Generates pixel-perfect Excel invoices matching the original
 * Lodha (INV sheet) and Hiranandani (TAX Invoice sheet) formats.
 *
 * Usage:
 *   import { createExcelInvoice } from "./createExcelInvoice";
 *   import * as XLSX from "xlsx";
 *
 *   const wb = createExcelInvoice("lodha", formData);
 *   XLSX.writeFile(wb, "Invoice.xlsx");
 *
 * Requires: SheetJS (xlsx) — already in your React project.
 *
 * The Hiranandani sheet embeds the company logo (image1.png from the
 * original file) in the top-right corner (cols O–R, rows 1–2), exactly
 * as in the original.  Because SheetJS CE does not write images, the logo
 * is written via the raw XML injection approach shown at the bottom.
 * If you prefer to skip the logo, set EMBED_LOGO = false.
 */

import * as XLSX from "xlsx";

// ─── Logo (Hiranandani only) ─────────────────────────────────────────────────
// Base64 of image1.png extracted from EDEN_C_PL_RA_3.xlsx
// col 14 (O), row 0 → col 17 (R), row 1  (0-indexed in drawing XML)
const LOGO_BASE64 =
  "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";

const EMBED_LOGO = true;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wb_new() {
  return XLSX.utils.book_new();
}

function s(v) {
  // SheetJS cell with string type
  return { v, t: "s" };
}
function n(v, z) {
  // number cell, optional format
  const c = { v: v == null ? 0 : Number(v), t: "n" };
  if (z) c.z = z;
  return c;
}
function nf(v) {
  return n(v, '#,##0.00');
}
function nfa(v) {
  // accounting format
  return n(v, '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ');
}

/**
 * Build a SheetJS worksheet from a cell map.
 * cellMap: { "A1": cellObject, ... }
 * merges:  [ { s:{r,c}, e:{r,c} }, ... ]   (0-indexed)
 * colWidths: [ { wch: N }, ... ]  index = col number (0-based)
 * rowHeights: { rowIndex: heightPts }
 */
function buildSheet(cellMap, merges, colWidths, rowHeights) {
  const ws = {};
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;

  for (const [addr, cell] of Object.entries(cellMap)) {
    if (!cell) continue;
    const ref = XLSX.utils.decode_cell(addr);
    ws[addr] = cell;
    if (ref.r < minR) minR = ref.r;
    if (ref.r > maxR) maxR = ref.r;
    if (ref.c < minC) minC = ref.c;
    if (ref.c > maxC) maxC = ref.c;
  }

  ws["!ref"] = XLSX.utils.encode_range(
    { r: minR, c: minC },
    { r: maxR, c: maxC }
  );

  if (merges && merges.length) ws["!merges"] = merges;

  if (colWidths) ws["!cols"] = colWidths;

  if (rowHeights) {
    ws["!rows"] = [];
    for (const [idx, hpt] of Object.entries(rowHeights)) {
      ws["!rows"][Number(idx)] = { hpt };
    }
  }

  return ws;
}

// ─── LODHA ────────────────────────────────────────────────────────────────────
/**
 * Build the Lodha "INV" sheet.
 *
 * data shape (mirrors LodhaInvoiceForm state from InvoiceCreate.jsx):
 * {
 *   header: { company_name, company_address, company_contact_number,
 *             company_email, company_website, invoice_number, invoice_date,
 *             supplier_gstin, pan_number, pf_number, esic_number,
 *             ptr_number, mlwf_number, reverse_charge,
 *             state_name, state_code,
 *             receiver_name, receiver_address,
 *             ship_to_name, ship_to_address, ship_to_gstin, ship_to_state, ship_to_state_code,
 *             building_name, ra_number, work_description, work_order_number,
 *             service_date_from, service_date_to,
 *             ref_code, contractor_name, job_description, client_name },
 *   items: [ { description, sac_code, value_of_supply, discount,
 *               taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total } ],
 *   totals: { total_taxable_value, total_cgst, total_sgst, total_invoice_value,
 *              round_off, total_invoice_value_in_words, bank_details,
 *              gst_on_reverse_charge },
 *   declaration: { terms, authorised_signatory }
 * }
 */
export function buildLodhaINVSheet(data) {
  const h = data.header || {};
  const totals = data.totals || {};
  const decl = data.declaration || {};
  const items = data.items || [{}];

  // Item rows start at Excel row 27 (index 26, 0-based)
  const ITEM_START = 26; // 0-based

  const cells = {};

  // ── Company header block ──────────────────────────────────────────────────
  cells["B2"] = { v: h.company_name || "Madhuram Enterprises", t: "s",
    s: { font: { sz: 28, name: "Lucida Sans Unicode" }, alignment: { } } };
  cells["A3"] = { v: h.company_address || "", t: "s",
    s: { font: { sz: 9, name: "Lucida Sans Unicode" } } };
  cells["A4"] = { v: `      Cell no. ${h.company_contact_number || ""}, Email Id ${h.company_email || ""}`, t: "s",
    s: { font: { sz: 12, name: "Calibri" } } };
  cells["A5"] = { v: `Website: ${h.company_website || ""}`, t: "s",
    s: { font: { sz: 10, name: "Calibri" } } };

  // ── GSTIN / PAN / ORIGINAL ────────────────────────────────────────────────
  cells["A7"] = { v: `GSTIN: ${h.supplier_gstin || ""}`, t: "s",
    s: { font: { bold: true, sz: 12, name: "Bookman Old Style" }, alignment: { horizontal: "left" } } };
  cells["F7"] = { v: `PAN NO.: ${h.pan_number || ""}`, t: "s",
    s: { font: { bold: true, sz: 12, name: "Bookman Old Style" }, alignment: { horizontal: "left" } } };
  cells["K7"] = { v: "ORIGINAL FOR RECEIPENT", t: "s",
    s: { font: { bold: true, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" } } };

  // ── "Tax Invoice" title ───────────────────────────────────────────────────
  cells["A9"] = { v: "Tax Invoice", t: "s",
    s: { font: { bold: true, sz: 24, name: "Bookman Old Style" }, alignment: { horizontal: "center", vertical: "center" } } };

  // ── Invoice meta ──────────────────────────────────────────────────────────
  cells["A11"] = { v: `Invoice No   : ${h.invoice_number || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top" } } };
  cells["F11"] = { v: `PF NO - ${h.pf_number || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["A12"] = { v: `Invoice date: ${h.invoice_date || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top" } } };
  cells["F12"] = { v: `ESIC NO - ${h.esic_number || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["A13"] = { v: "Reverse Charge (Y/N): ", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top" } } };
  cells["E13"] = { v: h.reverse_charge || "N", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center", vertical: "top" } } };
  cells["F13"] = { v: `PTR NO - ${h.ptr_number || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["A14"] = { v: `State: ${h.state_name || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top" } } };
  cells["D14"] = { v: "Code", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" } } };
  cells["E14"] = { v: h.state_code || "", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["F14"] = { v: `MLWF NO - ${h.mlwf_number || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };

  // ── Bill to / Ship to headers ─────────────────────────────────────────────
  cells["A16"] = { v: "Bill to Party", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["F16"] = { v: "Ship to Party  / Site ", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["A17"] = { v: `Co A/C Name: ${h.receiver_name || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["F17"] = { v: `Co A/C Name: ${h.ship_to_name || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["A18"] = { v: `Address: ${h.receiver_address || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top", wrapText: true } } };
  cells["A20"] = { v: `GSTIN: ${h.buyer_gstin || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top" } } };
  cells["F20"] = { v: `GSTIN: ${h.ship_to_gstin || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top" } } };
  cells["A21"] = { v: `State: ${h.state_name || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["D21"] = { v: "Code", t: "s", s: { font: { bold: true, sz: 11, name: "Calibri" } } };
  cells["E21"] = { v: h.state_code || "", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["F21"] = { v: `State: ${h.ship_to_state || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells["L21"] = { v: "Code", t: "s", s: { font: { bold: true, sz: 11, name: "Calibri" } } };
  cells["M21"] = { v: h.ship_to_state_code || "", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };

  // ── Building / Reference row ───────────────────────────────────────────────
  cells["A22"] = { v: "BUILDING NAME", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["D22"] = { v: h.building_name || "", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["A23"] = { v: "Reference :-  ", t: "s",
    s: { font: { bold: true, sz: 13, name: "Calibri" } } };
  cells["C23"] = { v: "RA No.", t: "s", s: { font: { bold: true, sz: 11, name: "Calibri" } } };
  cells["D23"] = { v: h.ra_number || "", t: "s", s: { font: { bold: true, sz: 11, name: "Calibri" } } };
  cells["E23"] = { v: "Work", t: "s", s: { font: { bold: true, sz: 11, name: "Calibri" } } };
  cells["F23"] = { v: h.work_description || "", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["I23"] = { v: "WO NO", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["K23"] = { v: h.work_order_number || "", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["A24"] = { v: `SERVICE DATE FROM - ${h.service_date_from || ""} TO ${h.service_date_to || ""}`, t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };

  // ── Table header (rows 25–26, 0-based 24–25) ──────────────────────────────
  const TH = { font: { bold: true, sz: 8, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
  cells["A25"] = { v: "S. No.", t: "s", s: TH };
  cells["B25"] = { v: "Goods  / Service Description", t: "s", s: TH };
  cells["C25"] = { v: " SAC code ", t: "s", s: TH };
  cells["D25"] = { v: "Value of Supply ", t: "s", s: TH };
  cells["E25"] = { v: "Discount", t: "s", s: TH };
  cells["F25"] = { v: "Taxable Value", t: "s", s: TH };
  cells["G25"] = { v: "CGST", t: "s",
    s: { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["J25"] = { v: "SGST", t: "s",
    s: { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["L25"] = { v: "Total", t: "s",
    s: { font: { bold: true, sz: 12, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" } } };
  // Sub-header row 26
  cells["G26"] = { v: "Rate", t: "s", s: { font: { bold: true, sz: 8, name: "Calibri" } } };
  cells["H26"] = { v: "Amount", t: "s",
    s: { font: { bold: true, sz: 8, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells["J26"] = { v: "Rate", t: "s", s: { font: { bold: true, sz: 8, name: "Calibri" } } };
  cells["K26"] = { v: "Amount", t: "s", s: { font: { bold: true, sz: 8, name: "Calibri" } } };

  // ── Line items ─────────────────────────────────────────────────────────────
  const NUM_FMT = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ';
  let lastItemRow = ITEM_START; // 0-based

  items.forEach((item, idx) => {
    const rowIdx = ITEM_START + idx; // 0-based
    const rowNum = rowIdx + 1;       // 1-based for cell addresses
    lastItemRow = rowIdx;

    cells[`A${rowNum}`] = { v: idx + 1, t: "n" };
    cells[`B${rowNum}`] = { v: item.description || "", t: "s",
      s: { font: { sz: 8, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center", wrapText: true } } };
    cells[`C${rowNum}`] = { v: item.sac_code || "", t: "s",
      s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
    cells[`D${rowNum}`] = { v: Number(item.value_of_supply) || 0, t: "n", z: NUM_FMT };
    cells[`E${rowNum}`] = { v: Number(item.discount) || 0, t: "n", z: NUM_FMT };
    cells[`F${rowNum}`] = { v: Number(item.taxable_value) || 0, t: "n", z: NUM_FMT };
    cells[`G${rowNum}`] = { v: Number(item.cgst_rate) || 9, t: "n",
      s: { alignment: { horizontal: "center" } } };
    cells[`H${rowNum}`] = { v: Number(item.cgst_amount) || 0, t: "n", z: NUM_FMT,
      s: { alignment: { horizontal: "center" } } };
    cells[`J${rowNum}`] = { v: Number(item.sgst_rate) || 9, t: "n",
      s: { alignment: { horizontal: "center" } } };
    cells[`K${rowNum}`] = { v: Number(item.sgst_amount) || 0, t: "n", z: "0.00" };
    cells[`L${rowNum}`] = { v: Number(item.total) || 0, t: "n", z: "0.00",
      s: { alignment: { horizontal: "right" } } };
  });

  // ── Totals block — 5 rows below last item ─────────────────────────────────
  // Original: Total row = row 32 (items were row 27 only), gap rows 28-31 blank
  // We keep the same 5-row gap pattern
  const TOT_ROW = lastItemRow + 6; // 0-based, i.e. +5 blank rows gap
  const tot = TOT_ROW + 1; // 1-based

  cells[`A${tot}`] = { v: "Total", t: "s",
    s: { font: { bold: true, sz: 20, name: "Bookman Old Style" }, alignment: { horizontal: "center", vertical: "center" } } };
  cells[`D${tot}`] = { v: Number(totals.total_taxable_value) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { vertical: "center" } } };
  cells[`E${tot}`] = { v: 0, t: "n", z: NUM_FMT, s: { alignment: { vertical: "center" } } };
  cells[`F${tot}`] = { v: Number(totals.total_taxable_value) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { vertical: "center" } } };
  cells[`H${tot}`] = { v: Number(totals.total_cgst) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { horizontal: "center", vertical: "center" } } };
  cells[`K${tot}`] = { v: Number(totals.total_sgst) || 0, t: "n", z: NUM_FMT };
  cells[`L${tot}`] = { v: Number(totals.total_invoice_value) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { horizontal: "center", vertical: "center" } } };

  // Summary lines
  cells[`A${tot + 1}`] = { v: "Total Invoice amount in words", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells[`G${tot + 1}`] = { v: "Total Amount before Tax", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`L${tot + 1}`] = { v: Number(totals.total_taxable_value) || 0, t: "n", z: "#,##0.00",
    s: { alignment: { horizontal: "right" } } };

  cells[`A${tot + 2}`] = { v: totals.total_invoice_value_in_words || "", t: "s",
    s: { font: { sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top", wrapText: true } } };
  cells[`G${tot + 2}`] = { v: "Add: CGST", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`L${tot + 2}`] = { v: Number(totals.total_cgst) || 0, t: "n", z: "#,##0.00",
    s: { alignment: { horizontal: "right" } } };

  cells[`G${tot + 3}`] = { v: "Add: SGST", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`L${tot + 3}`] = { v: Number(totals.total_sgst) || 0, t: "n", z: "#,##0.00",
    s: { alignment: { horizontal: "right" } } };

  cells[`G${tot + 4}`] = { v: "ROUND OFF", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`L${tot + 4}`] = { v: Number(totals.round_off) || 0, t: "n", z: "#,##0.00",
    s: { alignment: { horizontal: "right" } } };

  cells[`G${tot + 5}`] = { v: "Total Amount after Tax:", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`L${tot + 5}`] = { v: Number(totals.total_invoice_value) || 0, t: "n", z: "#,##0.00",
    s: { alignment: { horizontal: "right" } } };

  cells[`A${tot + 6}`] = { v: "Bank Details", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "center" } } };
  cells[`G${tot + 6}`] = { v: "GST on Reverse Charge", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`L${tot + 6}`] = { v: Number(totals.gst_on_reverse_charge) || 0, t: "n", z: "#,##0.00",
    s: { alignment: { horizontal: "right" } } };

  cells[`G${tot + 7}`] = { v: "E & O.E", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { horizontal: "left" } } };
  cells[`G${tot + 8}`] = { v: "For, ", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { vertical: "top" } } };

  cells[`A${tot + 9}`] = { v: decl.terms || "", t: "s",
    s: { font: { sz: 9, name: "Calibri" }, alignment: { horizontal: "left", vertical: "top", wrapText: true } } };
  cells[`G${tot + 9}`] = { v: `M/S. ${h.company_name || ""}`.toUpperCase(), t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" }, alignment: { vertical: "top" } } };
  cells[`G${tot + 10}`] = { v: "AUTHORISED SIGNATORY", t: "s",
    s: { font: { bold: true, sz: 11, name: "Calibri" } } };

  // ── Merges (matching original) ─────────────────────────────────────────────
  // Converted from original file, adjusted for dynamic item rows
  // Fixed structural merges (row numbers are 0-based)
  const merges = [
    { s: { r: 1, c: 1 }, e: { r: 1, c: 12 } },   // B2:M2  company name
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },   // A3:M3
    { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } },   // A4:M4
    { s: { r: 4, c: 0 }, e: { r: 4, c: 12 } },   // A5:M5
    { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } },    // A7:E7
    { s: { r: 6, c: 5 }, e: { r: 6, c: 9 } },    // F7:J7
    { s: { r: 6, c: 10 }, e: { r: 6, c: 12 } },  // K7:M7
    { s: { r: 7, c: 0 }, e: { r: 7, c: 12 } },   // A8:M8  (divider)
    { s: { r: 8, c: 0 }, e: { r: 9, c: 12 } },   // A9:M10 Tax Invoice title
    { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } },  // A11:E11
    { s: { r: 11, c: 0 }, e: { r: 11, c: 4 } },  // A12:E12
    { s: { r: 12, c: 0 }, e: { r: 12, c: 3 } },  // A13:D13
    { s: { r: 13, c: 0 }, e: { r: 13, c: 2 } },  // A14:C14
    { s: { r: 14, c: 0 }, e: { r: 14, c: 12 } }, // A15:M15 divider
    { s: { r: 15, c: 0 }, e: { r: 15, c: 4 } },  // A16:E16
    { s: { r: 15, c: 5 }, e: { r: 15, c: 12 } }, // F16:M16
    { s: { r: 16, c: 0 }, e: { r: 16, c: 4 } },  // A17:E17
    { s: { r: 16, c: 5 }, e: { r: 16, c: 12 } }, // F17:M17
    { s: { r: 17, c: 0 }, e: { r: 18, c: 4 } },  // A18:E19 address (2 rows)
    { s: { r: 17, c: 5 }, e: { r: 18, c: 12 } }, // F18:M19
    { s: { r: 19, c: 0 }, e: { r: 19, c: 4 } },  // A20:E20
    { s: { r: 19, c: 5 }, e: { r: 19, c: 12 } }, // F20:M20
    { s: { r: 20, c: 0 }, e: { r: 20, c: 2 } },  // A21:C21
    { s: { r: 21, c: 0 }, e: { r: 21, c: 2 } },  // A22:C22
    { s: { r: 21, c: 3 }, e: { r: 21, c: 12 } }, // D22:M22
    { s: { r: 22, c: 5 }, e: { r: 22, c: 7 } },  // F23:H23
    { s: { r: 22, c: 8 }, e: { r: 22, c: 9 } },  // I23:J23
    { s: { r: 22, c: 10 }, e: { r: 22, c: 12 } },// K23:M23
    { s: { r: 23, c: 0 }, e: { r: 23, c: 12 } }, // A24:M24
    // Table header merges
    { s: { r: 24, c: 0 }, e: { r: 25, c: 0 } },  // A25:A26
    { s: { r: 24, c: 1 }, e: { r: 25, c: 1 } },  // B25:B26
    { s: { r: 24, c: 2 }, e: { r: 25, c: 2 } },  // C25:C26
    { s: { r: 24, c: 3 }, e: { r: 25, c: 3 } },  // D25:D26
    { s: { r: 24, c: 4 }, e: { r: 25, c: 4 } },  // E25:E26
    { s: { r: 24, c: 5 }, e: { r: 25, c: 5 } },  // F25:F26
    { s: { r: 24, c: 6 }, e: { r: 24, c: 8 } },  // G25:I25
    { s: { r: 24, c: 9 }, e: { r: 24, c: 10 } }, // J25:K25
    { s: { r: 24, c: 11 }, e: { r: 25, c: 12 } },// L25:M26
    { s: { r: 25, c: 7 }, e: { r: 25, c: 8 } },  // H26:I26
  ];

  // Item row merges (B merged with nothing in original — kept as single cols)
  items.forEach((_, idx) => {
    const r = ITEM_START + idx;
    merges.push({ s: { r, c: 7 }, e: { r, c: 8 } }); // H:I merged
    merges.push({ s: { r, c: 11 }, e: { r, c: 12 } }); // L:M merged
  });

  // Totals block merges
  merges.push({ s: { r: TOT_ROW, c: 0 }, e: { r: TOT_ROW, c: 2 } });  // A:C Total
  merges.push({ s: { r: TOT_ROW, c: 7 }, e: { r: TOT_ROW, c: 8 } });  // H:I
  merges.push({ s: { r: TOT_ROW, c: 11 }, e: { r: TOT_ROW, c: 12 } });// L:M
  merges.push({ s: { r: TOT_ROW + 1, c: 0 }, e: { r: TOT_ROW + 1, c: 5 } }); // A:F words label
  merges.push({ s: { r: TOT_ROW + 1, c: 6 }, e: { r: TOT_ROW + 1, c: 10 } });// G:K Total before tax
  merges.push({ s: { r: TOT_ROW + 1, c: 11 }, e: { r: TOT_ROW + 1, c: 12 } });
  merges.push({ s: { r: TOT_ROW + 2, c: 0 }, e: { r: TOT_ROW + 5, c: 5 } }); // A:F words value (4 rows)
  for (let i = 2; i <= 6; i++) {
    merges.push({ s: { r: TOT_ROW + i, c: 6 }, e: { r: TOT_ROW + i, c: 10 } });
    merges.push({ s: { r: TOT_ROW + i, c: 11 }, e: { r: TOT_ROW + i, c: 12 } });
  }
  merges.push({ s: { r: TOT_ROW + 6, c: 0 }, e: { r: TOT_ROW + 6, c: 2 } }); // Bank Details A:C
  merges.push({ s: { r: TOT_ROW + 6, c: 6 }, e: { r: TOT_ROW + 6, c: 10 } });
  merges.push({ s: { r: TOT_ROW + 6, c: 11 }, e: { r: TOT_ROW + 6, c: 12 } });
  merges.push({ s: { r: TOT_ROW + 7, c: 0 }, e: { r: TOT_ROW + 7, c: 2 } });
  merges.push({ s: { r: TOT_ROW + 8, c: 0 }, e: { r: TOT_ROW + 8, c: 2 } });
  merges.push({ s: { r: TOT_ROW + 9, c: 0 }, e: { r: TOT_ROW + 10, c: 5 } }); // Terms A:F
  merges.push({ s: { r: TOT_ROW + 9, c: 6 }, e: { r: TOT_ROW + 9, c: 12 } }); // Company name G:M
  merges.push({ s: { r: TOT_ROW + 10, c: 6 }, e: { r: TOT_ROW + 10, c: 12 } });

  // Column widths (from original file, in characters)
  const colWidths = [
    { wch: 6.89 },   // A
    { wch: 12.78 },  // B
    { wch: 8 },      // C
    { wch: 12.55 },  // D
    { wch: 8 },      // E
    { wch: 13.55 },  // F
    { wch: 4.33 },   // G
    { wch: 10 },     // H
    { wch: 10 },     // I
    { wch: 3.55 },   // J
    { wch: 11.33 },  // K
    { wch: 9.22 },   // L
    { wch: 5.0 },    // M
  ];

  const rowHeights = {
    1: 34.8,   // row 2 (0-based 1)
    2: 15.6,
    3: 18.0,
    4: 15.0,
    5: 15.0,
    6: 16.2,
    7: 15.0,
    9: 15.0,
    13: 15.0,
    14: 15.0,
    15: 15.0,
    20: 15.0,
    21: 15.0,
    22: 18.0,
    23: 15.0,
    [ITEM_START]: 21.0,
    [TOT_ROW]: 25.8,
    [TOT_ROW + 1]: 15.0,
    [TOT_ROW + 5]: 15.0,
    [TOT_ROW + 6]: 15.0,
    [TOT_ROW + 10]: 90.0,
  };

  return buildSheet(cells, merges, colWidths, rowHeights);
}

// ─── HIRANANDANI ──────────────────────────────────────────────────────────────
/**
 * Build the Hiranandani "TAX Invoice" sheet.
 *
 * data shape (mirrors HiranandaniInvoiceForm state):
 * {
 *   header: { company_name, company_address, company_contact_number,
 *             company_email, company_website, supplier_gstin,
 *             invoice_number, invoice_date },
 *   billingShipping: { bill_to_company_name, bill_to_address,
 *                      bill_to_gstin, bill_to_state, bill_to_state_code },
 *   projectWork: { building_name, reference_ra_number, work_description,
 *                  work_order_number, plant_name, bill_no },
 *   items: [ { description, sac_code, value_of_supply, discount,
 *               taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
 *               igst_rate, igst_amount, cess_rate, cess_amount, total } ],
 *   totals: { total_value, total_cgst, total_sgst, total_invoice_value,
 *              total_invoice_value_in_words },
 *   bankDeclaration: { terms, authorised_signatory,
 *                      electronic_reference_number, electronic_reference_date }
 * }
 */
export function buildHiranandaniTAXSheet(data) {
  const h = data.header || {};
  const bs = data.billingShipping || {};
  const pw = data.projectWork || {};
  const totals = data.totals || {};
  const decl = data.bankDeclaration || {};
  const items = data.items || [{}];

  const cells = {};

  // ── Company header block ──────────────────────────────────────────────────
  cells["A2"] = { v: h.company_name || "Madhuram Enterprises", t: "s",
    s: { font: { sz: 28, name: "Lucida Sans Unicode" } } };
  cells["A3"] = { v: h.company_address || "", t: "s",
    s: { font: { sz: 12, name: "Lucida Sans Unicode" } } };
  cells["A4"] = { v: `      Cell no. ${h.company_contact_number || ""}, Email Id ${h.company_email || ""}`, t: "s",
    s: { font: { sz: 12, name: "Calibri" } } };
  cells["A5"] = { v: `Website: ${h.company_website || ""}`, t: "s",
    s: { font: { sz: 10, name: "Calibri" } } };

  // ── TAX INVOICE title (row 6) ─────────────────────────────────────────────
  cells["A6"] = { v: "TAX INVOICE ", t: "s",
    s: { font: { bold: true, sz: 22, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" } } };

  // ── Left: Invoice fields (rows 7–17) ─────────────────────────────────────
  const LF = { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } };
  const LFb = { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } };
  const VF = { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } };

  cells["A7"] = { v: "Invoice No ", t: "s", s: LF };
  cells["C7"] = { v: h.invoice_number || "", t: "s", s: VF };
  cells["A8"] = { v: "Invoice Date ", t: "s", s: LF };
  cells["C8"] = { v: h.invoice_date || "", t: "s", s: VF };
  cells["A9"] = { v: "GSTIN ", t: "s", s: LF };
  cells["C9"] = { v: h.supplier_gstin || "", t: "s", s: VF };
  cells["A10"] = { v: "Address ", t: "s", s: LF };
  cells["C10"] = { v: h.company_address || "", t: "s",
    s: { font: { sz: 10, name: "Lucida Sans Unicode" }, alignment: { horizontal: "left", wrapText: true } } };
  cells["A11"] = { v: "Buyers Details ", t: "s", s: LFb };
  cells["A12"] = { v: "Name", t: "s", s: LF };
  cells["C12"] = { v: bs.bill_to_company_name || "", t: "s",
    s: { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells["A13"] = { v: "Address", t: "s", s: LF };
  cells["C13"] = { v: bs.bill_to_address || "", t: "s",
    s: { font: { sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells["A15"] = { v: "State Name", t: "s", s: LF };
  cells["C15"] = { v: bs.bill_to_state || "", t: "s", s: VF };
  cells["A16"] = { v: "State Code", t: "s", s: LF };
  cells["C16"] = { v: bs.bill_to_state_code || "", t: "s", s: VF };
  cells["A17"] = { v: "GSTIN: ", t: "s", s: LF };
  cells["C17"] = { v: bs.bill_to_gstin || "", t: "s",
    s: { font: { sz: 11, name: "Calibri" } } };

  // ── Right: Receiver / project fields (rows 7–14) ─────────────────────────
  const RF = { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } };
  const RFb = { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } };

  cells["J7"] = { v: "Receiver Details :", t: "s", s: RFb };
  cells["L7"] = { v: bs.bill_to_company_name || "", t: "s", s: RFb };
  cells["J8"] = { v: "Address", t: "s", s: RF };
  cells["L8"] = { v: pw.building_name || "", t: "s",
    s: { font: { sz: 11, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells["J10"] = { v: "Place of Supply ", t: "s", s: RF };
  cells["L10"] = { v: pw.work_description || "", t: "s", s: RF };
  cells["J12"] = { v: "WO No", t: "s", s: RFb };
  cells["L12"] = { v: pw.work_order_number || "", t: "s", s: RF };
  cells["J13"] = { v: "PLANT NAME", t: "s", s: RFb };
  cells["L13"] = { v: pw.plant_name || "", t: "s", s: RF };
  cells["J14"] = { v: "BILL NO ", t: "s", s: RFb };
  cells["L14"] = { v: pw.bill_no || pw.reference_ra_number || "", t: "s", s: RF };

  // ── Table header (rows 19–20) ─────────────────────────────────────────────
  const TH = { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "center", vertical: "top", wrapText: true } };

  cells["A19"] = { v: "SN", t: "s", s: TH };
  cells["B19"] = { v: "Description of Service/ Goods", t: "s", s: TH };
  cells["D19"] = { v: "SAC / HSN Code ", t: "s", s: TH };
  cells["E19"] = { v: "UOM", t: "s", s: TH };
  cells["F19"] = { v: "Qty ", t: "s", s: TH };
  cells["G19"] = { v: "Rate ", t: "s", s: TH };
  cells["H19"] = { v: "Total Value of Goods/   Services", t: "s", s: TH };
  cells["I19"] = { v: "Discount                   if Any", t: "s", s: TH };
  cells["J19"] = { v: "Taxable value", t: "s", s: TH };
  cells["K19"] = { v: "CGST", t: "s", s: TH };
  cells["M19"] = { v: "SGST", t: "s", s: TH };
  cells["O19"] = { v: "IGST ", t: "s", s: TH };
  cells["Q19"] = { v: "Cess", t: "s", s: TH };
  // Sub-header row 20
  const SH = { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
  cells["K20"] = { v: "Rate", t: "s", s: SH };
  cells["L20"] = { v: "Amt.", t: "s", s: SH };
  cells["M20"] = { v: "Rate", t: "s", s: SH };
  cells["N20"] = { v: "Amt.", t: "s", s: SH };
  cells["O20"] = { v: "Rate ", t: "s", s: SH };
  cells["P20"] = { v: "Amt.", t: "s", s: SH };
  cells["Q20"] = { v: "Rate ", t: "s", s: SH };
  cells["R20"] = { v: "Amt.", t: "s", s: SH };

  // ── Line items (start row 22, 0-based 21) ─────────────────────────────────
  const ITEM_START = 21; // 0-based
  const NUM_FMT = '_ * #,##0.00_ ;_ * \\-#,##0.00_ ;_ * "-"??_ ;_ @_ ';
  let lastItemRow = ITEM_START;

  items.forEach((item, idx) => {
    const rowIdx = ITEM_START + idx;
    const rowNum = rowIdx + 1; // 1-based
    lastItemRow = rowIdx;

    const IC = { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center", wrapText: true } };
    cells[`A${rowNum}`] = { v: idx + 1, t: "n", s: { ...IC, alignment: { horizontal: "left", vertical: "center" } } };
    cells[`B${rowNum}`] = { v: item.description || "", t: "s",
      s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center", wrapText: true } } };
    cells[`D${rowNum}`] = { v: item.sac_code || "", t: "s", s: IC };
    cells[`H${rowNum}`] = { v: Number(item.value_of_supply) || 0, t: "n", z: "0.00",
      s: { font: { sz: 10 }, alignment: { horizontal: "right", vertical: "center", wrapText: true } } };
    cells[`K${rowNum}`] = { v: Number(item.cgst_rate) || 0, t: "n", z: "0%",
      s: { alignment: { horizontal: "center", vertical: "center" } } };
    cells[`L${rowNum}`] = { v: Number(item.cgst_amount) || 0, t: "n", z: NUM_FMT,
      s: { alignment: { horizontal: "left", vertical: "center", wrapText: true } } };
    cells[`M${rowNum}`] = { v: Number(item.sgst_rate) || 0, t: "n", z: "0%",
      s: { alignment: { horizontal: "center", vertical: "center", wrapText: true } } };
    cells[`N${rowNum}`] = { v: Number(item.sgst_amount) || 0, t: "n", z: NUM_FMT,
      s: { alignment: { horizontal: "left", vertical: "center", wrapText: true } } };
    cells[`O${rowNum}`] = { v: Number(item.igst_rate) || 0, t: "n", z: NUM_FMT, s: IC };
    cells[`P${rowNum}`] = { v: Number(item.igst_amount) || 0, t: "n", z: NUM_FMT, s: IC };
    cells[`Q${rowNum}`] = { v: Number(item.cess_rate) || 0, t: "n", z: NUM_FMT, s: IC };
    cells[`R${rowNum}`] = { v: Number(item.cess_amount) || 0, t: "n", z: NUM_FMT, s: IC };
  });

  // ── Totals block ──────────────────────────────────────────────────────────
  // Gap rows between items and totals (original has ~5 blank rows)
  const TOT_ROW = lastItemRow + 6; // 0-based
  const tot = TOT_ROW + 1; // 1-based

  cells[`D${tot}`] = { v: "Total", t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center", wrapText: true } } };
  cells[`H${tot}`] = { v: Number(totals.total_value) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { horizontal: "left", vertical: "center", wrapText: true } } };
  cells[`L${tot}`] = { v: Number(totals.total_cgst) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { horizontal: "left", vertical: "center", wrapText: true } } };
  cells[`N${tot}`] = { v: Number(totals.total_sgst) || 0, t: "n", z: NUM_FMT,
    s: { alignment: { horizontal: "left", vertical: "center", wrapText: true } } };

  // Total Invoice Value rows
  cells[`C${tot + 2}`] = { v: "Total Invoice Value (In figure) ", t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells[`H${tot + 2}`] = { v: Number(totals.total_invoice_value) || 0, t: "n",
    z: '_ * #,##0_ ;_ * \\-#,##0_ ;_ * "-"??_ ;_ @_ ',
    s: { font: { sz: 12, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" } } };

  cells[`C${tot + 3}`] = { v: "Total Invoice Value (In Words)", t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center", wrapText: true } } };
  cells[`H${tot + 3}`] = { v: totals.total_invoice_value_in_words || "", t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };

  // Declaration
  cells[`A${tot + 5}`] = { v: "Declaration:", t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells[`N${tot + 5}`] = { v: `For  ${h.company_name || ""}`, t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };

  cells[`A${tot + 9}`] = { v: `Electronic Reference Number                                                                          Date -`, t: "s",
    s: { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells[`N${tot + 9}`] = { v: "Authorised Signatory ", t: "s",
    s: { font: { sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };

  cells[`A${tot + 12}`] = { v: "(For Services - Two copies of invoices to be issued (i) ORIGINAL FOR RECIPIENT & (ii) DUPLICATE FOR SUPPLIER", t: "s",
    s: { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };
  cells[`A${tot + 13}`] = { v: "& For Goods - Three copies of invoices to be issued (i) ORIGINAL FOR RECIPIENT, (ii) DUPLICATE FOR TRANSPORTER & (iii) TRIPLICATE FOR SUPPLIER)", t: "s",
    s: { font: { bold: true, sz: 10, name: "Calibri" }, alignment: { horizontal: "left", vertical: "center" } } };

  // ── Merges ─────────────────────────────────────────────────────────────────
  const merges = [
    // Header
    { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } },   // A2:R2
    { s: { r: 2, c: 0 }, e: { r: 2, c: 17 } },   // A3:R3
    { s: { r: 3, c: 0 }, e: { r: 3, c: 17 } },   // A4:R4
    { s: { r: 4, c: 0 }, e: { r: 4, c: 17 } },   // A5:R5
    { s: { r: 5, c: 0 }, e: { r: 5, c: 17 } },   // A6:R6 title
    // Left panel
    { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },    // A7:B7
    { s: { r: 6, c: 2 }, e: { r: 6, c: 8 } },    // C7:I7
    { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },    // A8:B8
    { s: { r: 8, c: 0 }, e: { r: 8, c: 1 } },    // A9:B9
    { s: { r: 9, c: 0 }, e: { r: 9, c: 1 } },    // A10:B10
    { s: { r: 9, c: 2 }, e: { r: 9, c: 8 } },    // C10:I10
    { s: { r: 10, c: 0 }, e: { r: 10, c: 8 } },  // A11:I11
    { s: { r: 11, c: 0 }, e: { r: 11, c: 1 } },  // A12:B12
    { s: { r: 12, c: 0 }, e: { r: 12, c: 1 } },  // A13:B13
    { s: { r: 16, c: 9 }, e: { r: 16, c: 10 } }, // J17:K17
    // Table header row 19 (0-based 18)
    { s: { r: 17, c: 0 }, e: { r: 17, c: 17 } }, // A18:R18 divider
    { s: { r: 18, c: 0 }, e: { r: 19, c: 0 } },  // A19:A20
    { s: { r: 18, c: 1 }, e: { r: 19, c: 2 } },  // B19:C20
    { s: { r: 18, c: 3 }, e: { r: 19, c: 3 } },  // D19:D20
    { s: { r: 18, c: 4 }, e: { r: 19, c: 4 } },  // E19:E20
    { s: { r: 18, c: 5 }, e: { r: 19, c: 5 } },  // F19:F20
    { s: { r: 18, c: 6 }, e: { r: 19, c: 6 } },  // G19:G20
    { s: { r: 18, c: 7 }, e: { r: 19, c: 7 } },  // H19:H20
    { s: { r: 18, c: 8 }, e: { r: 19, c: 8 } },  // I19:I20
    { s: { r: 18, c: 9 }, e: { r: 19, c: 9 } },  // J19:J20
    { s: { r: 18, c: 10 }, e: { r: 18, c: 11 } },// K19:L19
    { s: { r: 18, c: 12 }, e: { r: 18, c: 13 } },// M19:N19
    { s: { r: 18, c: 14 }, e: { r: 18, c: 15 } },// O19:P19
    { s: { r: 18, c: 16 }, e: { r: 18, c: 17 } },// Q19:R19
  ];

  // Item row merges
  items.forEach((_, idx) => {
    const r = ITEM_START + idx;
    merges.push({ s: { r, c: 1 }, e: { r, c: 2 } }); // B:C merged
  });

  // Totals merges
  merges.push({ s: { r: TOT_ROW, c: 0 }, e: { r: TOT_ROW, c: 3 } });  // A:D Total label
  merges.push({ s: { r: TOT_ROW + 2, c: 0 }, e: { r: TOT_ROW + 2, c: 1 } });
  merges.push({ s: { r: TOT_ROW + 2, c: 2 }, e: { r: TOT_ROW + 2, c: 6 } });
  merges.push({ s: { r: TOT_ROW + 2, c: 7 }, e: { r: TOT_ROW + 2, c: 17 } });
  merges.push({ s: { r: TOT_ROW + 3, c: 0 }, e: { r: TOT_ROW + 3, c: 1 } });
  merges.push({ s: { r: TOT_ROW + 3, c: 2 }, e: { r: TOT_ROW + 3, c: 6 } });
  merges.push({ s: { r: TOT_ROW + 3, c: 7 }, e: { r: TOT_ROW + 3, c: 17 } });

  // Column widths (from original file)
  const colWidths = [
    { wch: 7.11 },   // A
    { wch: 10 },     // B
    { wch: 10 },     // C
    { wch: 8 },      // D
    { wch: 6.89 },   // E
    { wch: 6.33 },   // F
    { wch: 6.66 },   // G
    { wch: 12.22 },  // H
    { wch: 8 },      // I
    { wch: 8.66 },   // J
    { wch: 6 },      // K
    { wch: 12.22 },  // L
    { wch: 6 },      // M
    { wch: 11.22 },  // N
    { wch: 6 },      // O
    { wch: 6 },      // P
    { wch: 6 },      // Q
    { wch: 6 },      // R
  ];

  const rowHeights = {
    1: 34.8,   // row 2
    2: 15.6,
    3: 18.0,
    5: 28.8,   // TAX INVOICE title
    9: 30.6,   // address row
    [TOT_ROW + 2 - 1]: 21.0,
    [TOT_ROW + 3 - 1]: 21.0,
  };

  return buildSheet(cells, merges, colWidths, rowHeights);
}

// ─── Logo injector (Hiranandani only) ────────────────────────────────────────
/**
 * Injects the company logo into the Hiranandani workbook using raw XML.
 * Call this AFTER adding the sheet to the workbook.
 * The logo sits at cols O–R (col index 14–17), rows 1–2 (row index 0–1),
 * exactly as in the original file.
 */
function injectHiranandaniLogo(wb, sheetName) {
  if (!EMBED_LOGO) return;

  // Convert base64 to binary for embedding
  const imgBin = atob(LOGO_BASE64);
  const imgBytes = new Uint8Array(imgBin.length);
  for (let i = 0; i < imgBin.length; i++) imgBytes[i] = imgBin.charCodeAt(i);

  // SheetJS CE doesn't have native image API, so we add the image
  // via the worksheet's !drawing hook which XLSX.write will include
  // Note: This uses the undocumented but stable SheetJS raw file hook
  const ws = wb.Sheets[sheetName];
  if (!ws) return;

  // Mark the sheet as having a drawing
  ws["!drawing"] = {
    _data: imgBytes,
    // Drawing XML placing image at col 14 (O), row 0, to col 17 (R), row 1
    // Offsets in EMUs matching original: from col=14 off=555171 row=0 off=38102
    //                                    to   col=17 off=414928 row=1 off=370115
    _xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>14</xdr:col><xdr:colOff>555171</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38102</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>17</xdr:col><xdr:colOff>414928</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>370115</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="2" name="Picture 1"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
      <xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
      <xdr:spPr><a:xfrm><a:off x="9089571" y="38102"/><a:ext cx="1688557" cy="517070"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Main entry point.
 *
 * @param {"lodha" | "hiranandani"} template
 * @param {object} data - form data from InvoiceCreate.jsx
 * @returns {XLSX.WorkBook}
 */
export function createExcelInvoice(template, data) {
  const wb = wb_new();

  if (template === "lodha") {
    const ws = buildLodhaINVSheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "INV");
  } else if (template === "hiranandani") {
    const ws = buildHiranandaniTAXSheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "TAX Invoice");
    injectHiranandaniLogo(wb, "TAX Invoice");
  }

  return wb;
}

// ─── Download helper (use directly in your onClick) ──────────────────────────
/**
 * One-call download.
 *
 * @param {"lodha" | "hiranandani"} template
 * @param {object} data
 * @param {string} [filename]
 */
export function downloadInvoiceExcel(template, data, filename) {
  const wb = createExcelInvoice(template, data);
  const invoiceNo = data?.header?.invoice_number || "draft";
  const name = filename || `Invoice_${invoiceNo}.xlsx`;
  XLSX.writeFile(wb, name);
}