import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";
import { parseComparisonWorkbook } from "../src/lib/vendorComparisonParser.js";

const readWorkbook = (relativePath) => {
  const buf = fs.readFileSync(new URL(relativePath, import.meta.url));
  return XLSX.read(buf, { type: "buffer", cellDates: true });
};

const getBlock = (parsed, index = 0) => parsed.blocks[index];

test("parses the clean xlsx vendor comparison workbook", () => {
  const workbook = readWorkbook("../../../assets/madhuram_test_VC.xlsx");
  const parsed = parseComparisonWorkbook(workbook);
  const block = getBlock(parsed, 0);

  assert.equal(parsed.blocks.length, 1);
  assert.equal(block.vendors.length, 5);
  assert.equal(block.sections.reduce((sum, section) => sum + (section.items?.length || 0), 0), 3);
  assert.equal(block.meta.companyName, "Madhuram Enterprises");
  assert.equal(block.meta.projectName, "Florencia B");
  assert.equal(block.summary.subtotal[0].amount, 156500);
  assert.equal(block.summary.discount[0].rate, 0.08);
  assert.equal(block.summary.discount[0].amount, 12520);
  assert.equal(block.summary.netAmount[0].amount, 143980);
  assert.equal(block.summary.gst[0].rate, 0.18);
  assert.equal(block.summary.gst[0].amount, 25916.4);
  assert.equal(block.summary.totalValue[0].amount, 169896.4);
  assert.equal(block.issues.length, 0);
});

test("parses the locked vendor comparison template via fixed positions", () => {
  const workbook = readWorkbook("../../../assets/vendor_comparison_template.xlsx");
  const parsed = parseComparisonWorkbook(workbook);
  const block = getBlock(parsed, 0);

  assert.equal(parsed.blocks.length, 1);
  assert.equal(block.strictTemplate, true);
  assert.equal(block.vendors.length, 5);
  assert.equal(block.meta.indentNo, "");
  assert.equal(block.meta.indentDate, "");
  assert.equal(block.summary.subtotal[0].source, "primary");
  assert.equal(block.summary.discount[0].source, "primary");
  assert.equal(block.summary.netAmount[0].source, "primary");
  assert.equal(block.summary.gst[0].source, "primary");
  assert.equal(block.summary.totalValue[0].source, "primary");
});

test("parses the stacked xls comparison workbook into four blocks", () => {
  const workbook = readWorkbook("../../../assets/1783497546537-296620977.xls");
  const parsed = parseComparisonWorkbook(workbook);
  const block = getBlock(parsed, 0);

  assert.equal(parsed.blocks.length, 4);
  assert.equal(block.vendors.length, 4);
  assert.equal(block.meta.companyName, "Madhuram Enterprises");
  assert.equal(block.meta.projectName, "Florencia B");
  assert.equal(block.subProjectName, "Project Name: - Hiranandani");
  assert.equal(block.summary.subtotal[0].amount, 3107115);
  assert.equal(block.summary.discount[0].rate, 0.45);
  assert.equal(block.summary.discount[0].amount, 1398201.75);
  assert.equal(block.summary.netAmount[0].amount, 1708913.25);
  assert.equal(block.summary.gst[0].rate, 0.18);
  assert.equal(block.summary.gst[0].amount, 307604.385);
  assert.equal(block.summary.totalValue[0].amount, 2016517.635);
  assert.equal(block.issues.length, 0);
});

test("vendor names can live in the amount column and blank merged meta stays blank", () => {
  const wb = XLSX.utils.book_new();
  const rows = [
    ["Company Name: - Example Co"],
    ["Project Name: - Demo Project"],
    ["Indent No:-", "", "", "", "", "", ""],
    ["Indent Date:-", "", "", "", "", "", ""],
    ["Comparison Date:- 2026-07-08"],
    ["", "", "", "", "", "AquaFlow Pipes", "", "Prime Plumbing", "", "Metro BuildTech", "", "Elite Sanitary", "", "Hydro Piping Solutions", ""],
    ["Sr. No.", "HSN Code", "Item Description", "Qty", "UOM", "Rate", "Amount", "Rate", "Amount", "Rate", "Amount", "Rate", "Amount", "Rate", "Amount"],
    [1, "", "Test Item", 1, "No", 10, 10, 20, 20, 30, 30, 40, 40, 50, 50],
    ["Subtotal", "", "", "", "", 10, 10, 20, 20, 30, 30, 40, 40, 50, 50],
    ["Discount", "", "", "", "", 0.08, 0.8, 0.07, 1.4, 0.1, 3, 0.09, 3.6, 0.08, 4],
    ["", "", "", "", "", 9.2, "", 18.6, "", 27, "", 36.4, "", 46, ""],
    ["GST", "", "", "", "", 0.18, 1.656, 0.18, 3.348, 0.18, 4.86, 0.18, 6.552, 0.18, 8.28],
    ["Total Value", "", "", "", "", 11.656, 11.656, 22.548, 22.548, 31.86, 31.86, 42.952, 42.952, 54.28, 54.28],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }];
  XLSX.utils.book_append_sheet(wb, ws, "Comparison");

  const parsed = parseComparisonWorkbook(wb);
  const block = getBlock(parsed, 0);

  assert.equal(block.vendors[0].displayName, "AquaFlow Pipes");
  assert.equal(block.vendors[1].displayName, "Prime Plumbing");
  assert.equal(block.vendors[2].displayName, "Metro BuildTech");
  assert.equal(block.vendors[3].displayName, "Elite Sanitary");
  assert.equal(block.vendors[4].displayName, "Hydro Piping Solutions");
  assert.equal(block.meta.indentNo, "");
  assert.equal(block.meta.indentDate, "");
  assert.equal(block.meta.comparisonDate, "2026-07-08");
});
