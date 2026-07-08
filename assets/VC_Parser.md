# Prompt for Claude Code: Fix Vendor Comparison Excel Parser

## Context

We have a vendor comparison Excel upload/parse feature in two files:
- `VendorComparisonUpload.jsx` — parses via `XLSX.utils.sheet_to_json(sheet, { header: 1 })` (array-of-arrays), function `parseComparisonWorkbook`.
- `VendorComparisonModule.jsx` — a **second, independent** implementation, `parseVendorComparisonExcel`, using direct cell access (`sheetCellValue`) with merge resolution.

Both parsers correctly extract **vendor names**, but silently produce wrong or null values for **item rows in some files, and for Subtotal / Discount / GST / Net Amount / Total Value in most files**. Two real sample files are attached as test fixtures:

- `madhuram_test_VC.xlsx` — a single, clean comparison table.
- `1783497546537-296620977.xls` — a real-world file with **4 stacked comparison blocks in one sheet**, category sub-headers, and messier formatting.

I diffed both files cell-by-cell against what the parser reads. Below are the confirmed root causes, in priority order.

---

## Bug 1 (critical): Discount/GST columns are read with the wrong offset

Both parsers compute vendor columns for summary rows like this:

```js
const baseCol = 5 + idx * 2;      // assumed "rate/percent" column
const amountCol = baseCol + 1;    // assumed "amount" column
if (match.key === "discount" || match.key === "gst") {
  rate: toNumberOrNull(row[baseCol]),
  amount: toNumberOrNull(row[amountCol]),
}
```

This formula is correct for the **Subtotal / Net Amount / Total Value** rows (their amounts really do sit under each vendor's "Amount" header column: G, I, K, M, O for 0-indexed columns 6, 8, 10, 12, 14).

But it is **wrong for Discount and GST rows**, because in `madhuram_test_VC.xlsx`, the discount/GST percentage and amount for each vendor are shifted **one column to the left** of where the header says "Rate"/"Amount" live. Verified with openpyxl, row 15 (Discount), 0-indexed columns:

| Col index | 4 (E) | 5 (F) | 6 (G) | 7 (H) | 8 (I) | 9 (J) | 10 (K) | 11 (L) | 12 (M) | 13 (N) |
|---|---|---|---|---|---|---|---|---|---|---|
| Value | 0.08 | 12520 | 0.07 | 10753 | 0.09 | 14348 | 0.08 | 12203 | 0.07 | 11057 |
| Meaning | Vendor1 % | Vendor1 amt | Vendor2 % | Vendor2 amt | Vendor3 % | Vendor3 amt | Vendor4 % | Vendor4 amt | Vendor5 % | Vendor5 amt |

Vendor1's actual Rate/Amount header columns are F(5)/G(6). The current code reads `row[5]` (=12520, actually vendor1's amount) as the **rate**, and `row[6]` (=0.07, actually vendor2's percent) as vendor1's **amount**. Every vendor's discount/GST is silently off by one vendor slot.

**However**, in the second sample file (`1783497546537-296620977.xls`), the Discount row is laid out **without** that shift — percent and amount sit directly under each vendor's own Rate/Amount columns (F/G, H/I, J/K, L/M). So the offset is not a fixed constant — it differs between files/templates. **Do not hardcode a fixed offset.** See "Required approach" below.

Expected values to verify against (vendor 1 in each file):

- `madhuram_test_VC.xlsx`, vendor "AquaFlow Industries": Subtotal 156500, Discount 8% / 12520, Net Amount 143980, GST 18% / 25916.4, Total Value 169896.4
- `1783497546537-296620977.xls`, block 1, vendor "Mehta Brothers": Subtotal 3107115, Discount 45% / 1398201.75, Net Amount 1708913.25, GST 18% / 307604.385, Total Value 2016517.635

## Bug 2 (critical): "Net Amount" row often has no text label at all

In `1783497546537-296620977.xls`, row 20 (the Net Amount row, sitting between Discount and GST) has **no label in any column** — it's just blank cells followed by the amount values (1708913.25, 1519047.84, 1729686.44, 1752908.46). The parser's row matcher requires the label to literally contain "net amount", so this row is never matched and `netAmount` stays `null` for this whole file.

Fix: detect the Net Amount row **positionally** — it's the row immediately following the matched Discount row (skipping blank rows) and immediately preceding the matched GST row — rather than requiring a text label. Fall back to computing it as `Subtotal amount − Discount amount` per vendor if the row can't be found at all, and flag it as computed vs. parsed for QA.

## Bug 3 (critical): Only the first comparison block on the sheet is parsed

`1783497546537-296620977.xls` contains **4 independent comparison tables stacked in one sheet** (rows 0–28, 33–58, 61–84, 86–108+), each with its own "Company Name / Project Name / Indent No / Comparison Date" header, its own vendor row, its own item rows, and its own Subtotal/Discount/Net/GST/Total block. Confirmed block start rows: 0, 33, 61, 86 (each begins with a cell containing "Company Name").

Both current parsers assume there is exactly **one** table per sheet:
- Meta (`companyName`, `projectName`, etc.) is read once from fixed rows 0–4.
- Vendor row is hardcoded at row index 5.
- The item-parsing loop `break`s at the first row matching "subtotal" and never resumes, so blocks 2–4 are **completely ignored**.
- `extractFixedTemplateSummary` separately scans the *entire* sheet for label matches, so it will actually pick up Subtotal/Discount/GST rows from **all 4 blocks** and overwrite each other in the same summary object — meaning the returned summary ends up containing values from whichever block's row was scanned last, mismatched against block-1's vendors/items.

Fix: **detect every block** on the sheet (any row where column A starts with "Company Name"), and parse each block fully independently (its own meta, vendor row, header row, items, and summary), returning an **array of comparison blocks** instead of a single object. Note each block's vendor row also contains a secondary "Project Name: - X" label (e.g. "Hiranandani") *inside* the vendor-name row itself, in the Item Description column — this is a per-block sub-project/tower label, distinct from the top-level Project Name, and should be captured separately (e.g. `block.subProjectName`) rather than dropped or confused with a vendor name.

## Bug 4: Company Name / Project Name meta breaks depending on file layout

`splitLabelValue` expects a single cell like `"Company Name: - Madhuram Enterprises"` and splits on `":-"`. That's how `1783497546537-296620977.xls` stores it (one cell, in column A).

But `madhuram_test_VC.xlsx` stores label and value in **two separate cells**: `A1 = "Company Name:-"`, `B1 = "Madhuram Enterprises"`. Reading only `row[0][0]` and running `splitLabelValue` on it returns an **empty string** for company/project name in this file, because there's nothing after `":-"` in cell A itself.

Fix: when `splitLabelValue(row[0])` returns empty but the label pattern (`"...:-"`) exists, fall back to reading the value from `row[1]` in the same row.

## Bug 5: Item rows with a category/brand sub-header lose the brand/model text

Rows where Sr. No. is a single letter (e.g. `"A"`) represent a category heading (e.g. "Forged Brass Full Bore Ball Valve"), and the vendor columns in that same row hold **brand/model text** instead of a rate (e.g. `"Itap Make (Art No - 090)"`, `"Lehry Make(LIV-BLV-BS-001)"`). This is already correctly detected as a section header by `isSectionLabel`, but the brand/model text per vendor is currently discarded — it's never stored anywhere. Individual item rows below it (e.g. `"15mm dia"`, qty 1816) only make sense in context of both the category description *and* the vendor's brand/model for that category.

Fix: capture this row's vendor-column text as `section.vendorBrand[vendorIndex]` (or similar) so it's available in the UI/downstream instead of being silently dropped.

## Bug 6: Duplicate vendor names across columns aren't disambiguated

In block 1 of `1783497546537-296620977.xls`, the same vendor name **"Shree Gajanan Ent."** appears in two different vendor column slots (columns H and J) with different model codes in the brand sub-header row (`LIV-BLV-BS-001` vs `LIV-BLV-BS-001A`) — i.e., the same vendor quoted two different options. Both current parsers key vendor totals/matching by `vendor.name` (see `findExistingVendorByName`, `vendorTotals` accumulation), so these two columns will be merged/collide.

Fix: keep a stable per-block `vendorIndex`/column identity distinct from `vendor_name` for all internal aggregation, and only use the display name for showing to the user (with a suffix like "Shree Gajanan Ent. (Option 2)" when a duplicate is detected within the same block).

## Bug 7: Duplicate, diverging parser implementations

`VendorComparisonUpload.jsx` and `VendorComparisonModule.jsx` each have their own copy of `extractFixedTemplateSummary`, `toNumberOrNull`, vendor-column detection, and item-row parsing, with subtly different logic (one is merge-aware, one isn't; the row-matching windows differ). This is exactly how the same bug (Bug 1) ended up duplicated in two places. Any fix applied to only one file will not fix the other.

Fix: extract a single shared parser module (e.g. `vendorComparisonParser.js`) exporting `parseComparisonWorkbook(workbook)` that returns `{ blocks: [...] }`, and have both `.jsx` files import and use it instead of maintaining their own copies.

---

## Required approach for the Discount/GST offset (don't hardcode)

Because Bug 1's column offset is **not consistent between files** (shifted in one sample, aligned in the other), fixed-offset math is not reliable. Instead:

1. For each vendor, you already know its real `rateColIndex`/`amountColIndex` from the header row (where "Rate"/"Amount" literally appear). Use those as the **primary** read for every row type, including Discount/GST.
2. After reading, **sanity-check** the result: a valid discount/GST row for a given vendor should satisfy roughly `amount ≈ percent × relatedSubtotal` (subtotal for discount, net amount for GST), within a small tolerance (e.g. 1%).
3. If the primary read fails the sanity check (or one of the two cells isn't numeric/isn't in a sane range — percent should be between 0 and 1, or at most 0–100 if stored as a whole number), retry reading one column to the left, then one column to the right, and take whichever candidate pair passes the sanity check.
4. Log/flag (don't silently swallow) any row where no candidate passes the check, so it surfaces as a "couldn't parse — please check" state in the UI rather than a silently wrong number.

---

## Deliverables

1. A single shared parsing module used by both `VendorComparisonUpload.jsx` and `VendorComparisonModule.jsx`, fixing Bugs 1–7 above.
2. The parser returns an **array of blocks**, each with `meta` (company, project, subProjectName, indentNo, indentDate, comparisonDate), `vendors`, `sections`/`items` (including any captured `vendorBrand` text), and `summary` (subtotal/discount/netAmount/gst/totalValue) per block — instead of a single flat object.
3. Update both components to render/handle multiple blocks (loop over `blocks` instead of assuming one comparison per file).
4. Add test coverage using the two attached sample files as fixtures, asserting against these known-correct values:
   - `madhuram_test_VC.xlsx`: 1 block, 5 vendors, 3 items. Vendor "AquaFlow Industries" → Subtotal 156500, Discount 8%/12520, Net Amount 143980, GST 18%/25916.4, Total Value 169896.4. Company Name resolves to "Madhuram Enterprises", Project Name to "Florencia B" (both currently broken per Bug 4).
   - `1783497546537-296620977.xls`: 4 blocks (verify all 4 are returned, not just the first). Block 1, vendor "Mehta Brothers" → Subtotal 3107115, Discount 45%/1398201.75, Net Amount 1708913.25 (verify this is populated despite no text label — Bug 2), GST 18%/307604.385, Total Value 2016517.635.
5. Don't throw/crash on either file — both should parse cleanly end-to-end.

Please implement this, run it against both attached files, and print out the full parsed structure for each so I can visually confirm the numbers match the tables above before wiring it back into the UI.