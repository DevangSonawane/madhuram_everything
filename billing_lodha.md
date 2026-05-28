# Claude Code Prompt: Build the Lodha Billing Module

## Context

You are working on a React CRM (`src/`) for Madhuram Enterprises, a plumbing contractor. The app already has:

- **Routing:** `src/App.jsx` — routes exist for `/:projectId/billing` → `<Billing />` and `/:projectId/billing/invoice-editor` → `<BillingInvoiceEditor />`
- **Existing Billing page:** `src/pages/Billing.jsx` — shows a list of MIRs and ITRs merged as "invoices". This needs to be extended.
- **API layer:** `src/lib/api.js` — has `createLodhaInvoice`, `getLodhaInvoice`, `getLodhaInvoicesByProject`, `updateLodhaInvoice`, `deleteLodhaInvoice`, `getMirsByProject`, `getItrsByProject`, `getBOQItemsByProject` (or similar BOQ endpoint), `getDcsByProject`
- **Invoice transforms:** `src/lib/invoiceTransforms.js` — has `lodhaFormToApiPayload` and `lodhaApiToFormData`
- **Company defaults:** `src/lib/companyDefaults.js` — exports `COMMON_COMPANY_HEADER` and `withCommonCompanyHeader`
- **Excel invoice generator:** `src/pages/createExcelInvoice.js` — already builds pixel-perfect `.xlsx` for Lodha and Hiranandani formats
- **HTML/PDF invoice:** `src/pages/createHtmlInvoice.js` — `downloadInvoicePdf(template, formData)`
- **Number format:** `src/lib/numberFormat.js` — `formatCurrencyINR(amount)`
- **ProjectContext:** `src/contexts/useProject.js` — `useProject()` gives `selectedProject`, `projects`
- **LuckySheet spreadsheet:** `src/components/ProjectSpreadsheet.jsx` — renders an Excel-like spreadsheet in-browser using LuckySheet + SheetJS

The reference Excel file `EDEN_C_PL_RA_3.xlsx` is a Lodha RA (Running Account) Bill package. You have already analysed this file deeply. The task is to build a **complete Billing Module** in the CRM that auto-generates this exact package.

---

## What to Build

### Overview

The Billing page (`src/pages/Billing.jsx`) should become a full billing management module with:

1. **Billing List** — table of all RA bills created for the project, with status and actions
2. **"Create Billing" button** — opens a modal to choose the client template (Lodha / Hiranandani)
3. **Lodha RA Bill Creator** — a multi-tab in-browser spreadsheet interface that replicates the exact structure of `EDEN_C_PL_RA_3.xlsx`, with formulas, auto-populated data, and download options

For now, **only implement the Lodha template.** The Hiranandani template is a separate task for later.

---

## Task 1: Refactor `src/pages/Billing.jsx`

Rewrite the Billing page completely. Keep the same imports pattern but build a proper billing module.

### Billing List Table

The table should have these columns:
- **RA Bill No** (e.g. "RA 3")
- **Invoice No** (e.g. "ME/EDENC-PL/3")
- **Invoice Date**
- **Work Order No**
- **Taxable Amount** (formatted as INR)
- **Total (with GST)**
- **Status** — badge: Draft / Submitted / Approved
- **Actions** — View, Download Excel, Download PDF, Delete

Fetch from: `api.getLodhaInvoicesByProject(effectiveProjectId)` (for Lodha bills).

### "Create New Billing" Button

Prominent button at top right. Clicking it opens a **Dialog** (use `src/components/ui/dialog.jsx`) with two large cards side by side:

```
┌─────────────────────┐  ┌─────────────────────┐
│                     │  │                     │
│    🏢 LODHA         │  │  🏗️ HIRANANDANI     │
│                     │  │                     │
│  Lodha/Macrotech    │  │  Hiranandani format │
│  RA Bill format     │  │                     │
│  (TAX Invoice +     │  │  (Coming soon)      │
│   CUMM BOQ etc.)    │  │                     │
│                     │  │                     │
│  [Select Lodha]     │  │  [Disabled]         │
└─────────────────────┘  └─────────────────────┘
```

Clicking "Select Lodha" navigates to: `/:projectId/billing/lodha/new`

---

## Task 2: Create `src/pages/LodhaRABill.jsx` — The Core Page

This is the main RA Bill creation/editing page. Route it at `/:projectId/billing/lodha/new` and `/:projectId/billing/lodha/:billId` (for editing an existing bill).

Add these routes in `src/App.jsx`:
```jsx
<Route path="billing/lodha/new" element={<LodhaRABill />} />
<Route path="billing/lodha/:billId" element={<LodhaRABill />} />
```

### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Back    Lodha RA Bill — [Project Name]    [Save Draft] │
│                                               [Download ▾]│
├──────────────────────────────────────────────────────────┤
│ [CHECK LIST] [TAX INVOICE] [CUMM BOQ] [CHALLAN SUMMARY]  │
│ [ITR SUMMARY] [RATE ANALYSIS] [AMEND BOQ]                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              (Sheet content renders here)                │
│              — In-browser spreadsheet view —             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Use `Tabs` from `src/components/ui/tabs.jsx`. Each tab renders the corresponding sheet.

### State Structure

```js
const [formData, setFormData] = useState({
  // --- Header / meta (user inputs) ---
  ra_number: "",            // "RA 3"
  invoice_number: "",       // "ME/EDENC-PL/3" — auto-generated but editable
  invoice_date: "",         // "2024-03-06"
  work_order_number: "",    // from project master
  work_order_date: "",      // from project master
  plant_name: "",           // from project master
  building_name: "",        // from project master
  place_of_supply: "",      // from project master

  // --- Supplier (auto from companyDefaults) ---
  supplier_gstin: "",
  pan_number: "",
  pf_number: "",
  esic_number: "",
  ptr_number: "",
  mlwf_number: "",

  // --- Buyer (from project master / client master) ---
  bill_to_name: "",
  bill_to_address: "",
  bill_to_gstin: "",
  bill_to_state: "",
  bill_to_state_code: "",

  // --- Service line (single line for Lodha) ---
  work_description: "PLUMBING WORKS",
  sac_code: "998322",
  cgst_rate: 0.09,
  sgst_rate: 0.09,

  // --- BOQ items (from DB + user's current quantities) ---
  boq_items: [],
  // Each item: { item_no, section, description, uom, wo_qty, rate,
  //              prev_supply_qty, curr_supply_qty,
  //              prev_install_qty, curr_install_qty,
  //              prev_tc_qty, curr_tc_qty,
  //              prev_handover_qty, curr_handover_qty }

  // --- Challan/MIR links ---
  linked_mir_ids: [],
  linked_itr_ids: [],

  // --- Computed (derived, not stored) ---
  // current_bill_amount, total_cgst, total_sgst, total_invoice_amount
});
```

### On Mount / Data Loading

When the page loads:

1. **Load project master** from `useProject()` → populate WO number, WO date, plant name, building name, place of supply, client details, client GSTIN
2. **Load company defaults** from `withCommonCompanyHeader({})` → populate supplier GSTIN, address, PF, ESIC, PTR, MLWF numbers (these come from the project's contractor record or companyDefaults)
3. **Load BOQ items** via `api.getBOQItemsByProject(projectId)` → populate `boq_items` array with WO qty, rates, descriptions (these are fixed from the AMEND sheet imported once)
4. **Load previous RA bills** → for each BOQ item, compute `prev_supply_qty`, `prev_install_qty`, etc. by summing all prior approved RA bills for this project
5. **Load linked MIRs** → `api.getMirsByProject(projectId)` — show in Challan Summary tab
6. **Load linked ITRs** → `api.getItrsByProject(projectId)` — show in ITR Summary tab
7. **Auto-generate invoice number** from pattern: `ME/{project_code}-PL/{ra_number}` where project_code is extracted from the project name/building name

---

## Task 3: Build Each Tab/Sheet

### TAB 1: CHECK LIST

Render an **editable table** that exactly matches the CHECK LIST sheet structure.

Use a `<Table>` component. Structure:

```
Header row: "Invoice Processing Check-List - Construction Services"
Sub-header: Project Name | Tracker No
            Vendor Code  | Work Order No | [value from state]
            Contractor   | RA Bill No    | [value from state]
            Package      | Type of WO    | FML / FLO

Columns: Sr.No | Checklist Item | Site(Yes/No/NA) | Site Remark | Account(Yes/No/NA) | Account Remark

Section A: Documents to be submitted
  1. Mandatory documents for other than Final RA Bill
    a. SES copy duly signed...
    b. Tax invoice / bill of supply...
    c. Cumulative abstract sheet...
    d. Measurement sheet...
    e. PF challan for last month...
    f. ESIC challan/WCP...
    g. Material reconciliation (every 3rd RA)
    i. NCR Log (every 3rd RA)
    j. Basic rate variation (every 3rd RA)
    k. BG Expired Date
  2. Additional mandatory document for site work order
    a. Supply of water/machinery original challan...
    b. Attendance sheet/labour supply challan...
  3. Additional mandatory for Final RA Bill
    a. No due certificate
    b. Work completion certificate
    c. Statement of hold...
  4. Optional documents
    a. MITR supported by DC
    b. ITR certified by engineer

Section B: Points to be checked while certifying Invoice
  1. Vendor GST No in invoice match with GST No on SES
  2. Company GSTN in invoice match with GST No on SES
  3. First 4 digit of HSN/SAC match with WO
  4. Invoice rate, BOQ description and tax rate match with SES
  5. GL code maintained in work order as per nature of work
  6. Tax % maintained in work order with invoice
  7. Retention % in work order per T&C
  8. Debit/credit note posted in SAP
  9. Work order closure tick done (for final RA bill)
  10. Adjust open advances (>6 months façade, >3 months others)
  11. Debit note adjusted against same project
  12. DCO approval if contract value > Rs 1 cr (final RA bill)

Footer: Signature fields — Billing Eng | Commercial Manager | Bill Processor | Bill Approved
        Name field | Date field
```

For each Yes/No/NA column, use a `<Select>` with options: Yes / No / N/A.
For remarks, use a small `<Input>`.

**Auto-checks:** Items B.1, B.2, B.3, B.4, B.6 — if project master data is loaded and matches, auto-set to "Yes" with a grey readonly style. Show a tick icon. The user can override.

---

### TAB 2: TAX INVOICE

This is the most important sheet. Render it as a **styled HTML table that visually matches the Excel format exactly.**

Do NOT use a generic table component. Build a custom component `<LodhaInvoiceSheet />` using plain `<table>` with inline styles or Tailwind that mirrors the Excel layout precisely.

#### Layout to replicate:

```
Row 1-3: Company Header (merged columns)
  ┌────────────────────────────────────────────────────┐
  │ Madhuram Enterprises                               │
  │ SHOP NO - S/2, FLOOR NO 2,X TH CENTRAL MAL,       │
  │ MAHAVIR NAGAR, KANDIVALIWEST. MUMBAI -400 067.     │
  │ Cell no. +919819408257  Email: manish.plumbing@... │
  │ Website: www.madhuramrealtors.com                  │
  └────────────────────────────────────────────────────┘

Row 4: ─── TAX INVOICE ─── (large, centered, bold)

Row 5-8: Two-column layout
  Left:                              Right (Receiver):
  Invoice No : [invoice_number]      Receiver Details: COWTOWN INFOTECH...
  Invoice Date: [invoice_date]       Address: ANJUR CASA EDEN C
  GSTIN: [supplier_gstin]
  Address: [company_address]         Place of Supply: EDEN C WING, ANJUR UPPER THANE

Row 9: Buyer's Details
  Name: [bill_to_name]              WO No: [work_order_number] DT [work_order_date]
  Address: [bill_to_address]        PLANT NAME: [plant_name]
  State Name: [bill_to_state]       BILL NO: RA [ra_number]
  State Code: [bill_to_state_code]
  GSTIN: [bill_to_gstin]

Row 10: Column headers (all bordered, small text):
  SN | Description of Service/Goods | SAC/HSN Code | UOM | Qty | Rate |
  Total Value | Discount | Taxable Value |
  CGST (Rate / Amt) | SGST (Rate / Amt) | IGST (Rate / Amt) | Cess (Rate / Amt)

Row 11: Line item (1 row for Lodha — PLUMBING WORKS):
  1 | PLUMBING WORKS | 998322 | (blank) | (blank) | (blank) |
  [taxable_value] | 0 | [taxable_value] |
  9% | [cgst_amount] | 9% | [sgst_amount] | 0 | 0 | 0 | 0

Row 12: Totals row:
  "Total" | | | | | | [total_value] | | | | [total_cgst] | | [total_sgst] | | 0 | | 0

Row 13: Total Invoice Value (In figure): [total_invoice_amount]
Row 14: Total Invoice Value (In words): [amount_in_words]

Row 15: Declaration + "For MADHURAM ENTERPRISES" + "Authorised Signatory"
```

**Formulas / computed values:**
- `taxable_value` = sum of all `curr_supply_qty × rate × supply_factor + curr_install_qty × rate × install_factor + ...` across all BOQ items for this bill period. This is the current bill amount from the CUMM BOQ tab.
- `cgst_amount` = `taxable_value × cgst_rate` (0.09)
- `sgst_amount` = `taxable_value × sgst_rate` (0.09)
- `total_invoice_amount` = `taxable_value + cgst_amount + sgst_amount`
- `amount_in_words` = convert `total_invoice_amount` to Indian number words (implement `amountToWords(n)` function that handles lakhs/crores)

Make all computed values update live as the user edits BOQ quantities in the CUMM BOQ tab.

#### Styling rules:
- Outer border: 2px solid black on the whole table
- Inner borders: 1px solid black on all cells
- Header rows (company name): background `#FFFFFF`, font-size 14px, bold for company name
- "TAX INVOICE" text: font-size 22px, bold, centered, font-family serif (Bookman Old Style or Georgia)
- Column headers row: background `#D9D9D9` (light grey), bold, text-align center, font-size 9px
- Data cells: font-size 10px, text-align right for numbers
- Declaration row: light background, italic smaller text

---

### TAB 3: CUMM BOQ (Cumulative Bill of Quantities)

This is the data-entry heart of the billing. Render as an **editable spreadsheet-like table.**

#### Header section (read-only, from project master):
```
Company Name & Address: Madhuram Enterprises...    Reference: ME/EDEN C - PL/RA [X] DT [date]
                                                   Site Address: THANE, 421302
Work Order No. [wo_number]                         Work Order Value (Rs.): [wo_value] WITH GST
Project & Building Name: [building_name]           Work Order Date: [wo_date]
```

#### Column headers (exactly as in Excel):
```
Sr.No | Description of Work | Current WO Qty |
Work Done Qty (Previous / Current / Cumulative) |
Bill of Quantity BOQ (Previous / Current / Cumulative) |
U.O.M. | Rate/U.O.M. |
Amount in Rs. (Previous / Current / Cumulative)
```

#### Row structure for each BOQ item:

Each BOQ item (e.g. "1.01.1 Soil pipe 110mm dia") renders as a **section header row** + **4 sub-rows**:

```
[SECTION HEADER] — item_no | description | wo_qty | | | | | | | uom | rate | | |
  Supply @ 60%   |         |             |  prev  | curr | cumm | prev×0.6 | curr×0.6 | cumm×0.6 | | | prev_s_amt | curr_s_amt | cumm_s_amt
  Install @ 25%  |         |             |  prev  | curr | cumm | prev×0.25| curr×0.25| cumm×0.25| | | prev_i_amt | curr_i_amt | cumm_i_amt
  Testing @ 10%  |         |             |  prev  | curr | cumm | prev×0.1 | curr×0.1 | cumm×0.1 | | | prev_t_amt | curr_t_amt | cumm_t_amt
  Handover @ 5%  |         |             |  prev  | curr | cumm | prev×0.05| curr×0.05| cumm×0.05| | | prev_h_amt | curr_h_amt | cumm_h_amt
```

**User-editable cells:** Only the `curr` (Current) quantity cells for each phase. All other cells are computed or locked.

**Formulas:**
- `cumm_qty = prev_qty + curr_qty` (per phase)
- `boq_qty = wo_qty × phase_factor` (e.g. Supply BOQ qty = wo_qty × 0.60)
- `amount = qty × rate` (where qty is the BOQ qty, not done qty — Lodha bills by BOQ quantity proportion)

Wait — re-read the Excel. The amounts in the CUMM BOQ are:
- `curr_amount = curr_supply_qty × rate × 0.60` for Supply row
- Actually looking at the data: `prev_supply_amount = prev_supply_qty × rate` where rate is the full item rate × 0.60

So the sub-row rate = `item_rate × phase_factor`:
- Supply sub-row amount = `qty × (rate × 0.60)`
- Install sub-row amount = `qty × (rate × 0.25)`
- T&C sub-row amount = `qty × (rate × 0.10)`
- Handover sub-row amount = `qty × (rate × 0.05)`

**Totals row at the bottom:**
```
SUPPLY total   | | prev_supply_total | curr_supply_total | cumm_supply_total | | | prev_s_amt_total | curr_s_amt_total | cumm_s_amt_total
INSTALL total  | | prev_install_total| curr_install_total| cumm_install_total| | | prev_i_amt_total | curr_i_amt_total | cumm_i_amt_total

                                          TOTAL: [prev_total] | [curr_total] | [cumm_total]
                                          GST 18%: [prev_gst]  | [curr_gst]   | [cumm_gst]
                                          AMOUNT: [prev_with_gst]|[curr_with_gst]|[cumm_with_gst]
```

**Current Bill Amount** = `curr_total` from this totals section. This value feeds the TAX INVOICE tab's `taxable_value`.

#### Section grouping:
Group BOQ items under section headers (which are NOT editable rows):
- **DRAINAGE INSTALLATIONS** (items 1.01.x)
  - Sub-section: "SITC of UPVC SWR type B pipe..." etc.
- **PLUMBING INSTALLATIONS** (items 1.02.x)
- **PLUMBING PUMP INSTALLATIONS** (items 1.03.x)
- **WATER TANK ACCESSORIES** (items 1.04.x)
- **SANITARY FIXTURES & FITTINGS** (items 1.05.x)

Section header rows: background `#E2EFDA` (light green), bold, no editable cells.
Sub-section header rows: background `#F2F2F2`, italic.
Phase sub-rows: white background, `curr` cells have a light blue background `#EBF5FB` to indicate editable.

#### Extra Items section:
After the main BOQ, add an "EXTRA ITEM" section where users can add ad-hoc items not in the original BOQ (e.g. "PVC AGRI PIPE 20MM" as seen in the Excel).

---

### TAB 4: CHALLAN SUMMARY (MIR Summary)

Render as a read-only table showing which MIRs and challans belong to each RA bill.

#### Structure:
```
Header: MADHURAM ENTERPRISES | WORK ORDER NO. [wo_no] | Site: EDEN C PL | MIR SUMMARY SHEET

Columns:
Sr.No | Description of Work | WO Qty |
MIR No. | Challan No. (multiple per RA) | RA Total |
... (repeated for each previous RA) ...
PREVIOUS CLAIMED | THIS BILL QTY | CUMM QTY | Balance Qty (WO - CUMM)
```

Data comes from linked MIRs. Show a "Link MIRs" button that opens a side panel listing all unlinked approved MIRs for this project. User selects which MIRs belong to this RA bill.

Each MIR's items are matched to BOQ items by HSN code or description (fuzzy match). Show a match confidence badge.

**Validation:** If `THIS BILL QTY > WO QTY - PREVIOUS CLAIMED`, highlight the cell in red and show a warning toast.

---

### TAB 5: ITR SUMMARY

Same structure as Challan Summary but for ITRs (installation test reports).

```
Header: MADHURAM ENTERPRISES | WORK ORDER NO. [wo_no] | Site: EDEN C PL | ITR SUMMARY SHEET

Columns:
Sr.No | Description | WO Qty | ITR No. | This Bill Qty |
PREVIOUS CLAIMED | THIS BILL QTY | CUMM QTY | Balance Qty
```

Show "Link ITRs" button. Data from `api.getItrsByProject(projectId)`.

---

### TAB 6: RATE ANALYSIS

Read-only computed sheet showing the rate variation between WO rates and current market (CPT) rates.

```
Header: Rate Analysis Sheet — RA [X] Price List [date]

Columns:
BOQ No | S.No | Description | Unit | WO Qty | Basic Rate | FP% |
CPT Approved Rate (M1) | Delivered Qty (QC) | Variation Amount (Vm)

Formula: Vm = (CPT_Rate - Basic_Rate × (1 - FP%)) × Delivered_Qty
         (negative = deduction from bill)

Total variation: [sum of all Vm]
```

Add a **"Set CPT Price List"** button per RA bill that lets user enter the CPT rate date and override rates per item. Pre-populate with `Basic Rate × (1 - FP%)` as the default CPT rate (i.e., zero variation unless overridden).

---

### TAB 7: AMEND BOQ

Read-only table showing the full amended BOQ with final rates. This is the rate master.

```
Columns: Sr.No | Description | Current WO Qty | UOM | Rate/UOM | Amount (WO Qty × Rate)

Footer: Total WO Value (ex-GST): [sum]
```

Data from `api.getBOQItemsByProject(projectId)`. Add an "Import BOQ" button at the top that lets the user upload a PDF (the work order BOQ) and calls `api.parseBOQFromPdf(file, 'lodha')` to auto-populate all items. This uses the existing `boqExtractor.js` + `boqParser.js` pipeline.

---

## Task 4: Download / Export Options

Add a dropdown button "Download ▾" in the page header with options:

1. **Download as Excel (.xlsx)** — calls `createExcelInvoice("lodha", formData)` from `src/pages/createExcelInvoice.js` — generates the full workbook with all sheets matching the original format
2. **Download Tax Invoice PDF** — calls `downloadInvoicePdf("lodha", formData)` from `src/pages/createHtmlInvoice.js`
3. **Download MIR PDF** — calls `downloadMirPdf(...)` from `src/lib/mirPdf.js`
4. **Download ITR PDF** — calls `downloadItrPdf(...)` from `src/lib/itrPdf.js`

For the Excel download, extend `createExcelInvoice.js` to also generate the **CUMM BOQ sheet** and **CHALLAN SUMMARY sheet** in addition to the existing TAX INVOICE sheet. Add a function `createLodhaFullPackage(formData, boqItems, mirSummary, itrSummary)` that returns a workbook with all 7 sheets.

---

## Task 5: Save / Load Flow

### Save Draft
- `POST /api/lodha-invoice` with the full `formData` converted via `lodhaFormToApiPayload(formData, projectId)`
- Show a success toast
- Update URL to `/:projectId/billing/lodha/:newBillId`

### Auto-save
- Auto-save debounced (2 seconds) whenever any field changes
- Show a "Saving..." indicator in the header

### Load existing bill
- If route has `/:billId`, call `api.getLodhaInvoice(billId)` and populate state via `lodhaApiToFormData(data)`

### Submit for approval
- Add a "Submit" button that changes status to "Submitted" and disables editing

---

## Task 6: `amountToWords(n)` utility

Create `src/lib/amountToWords.js`:

```js
// Convert a number to Indian rupee words
// e.g. 811862.73 → "EIGHT LAKH ELEVEN THOUSAND EIGHT HUNDRED AND SIXTY THREE ONLY"
export function amountToWords(amount) { ... }
```

Handle: paise (if decimal), ones, tens, hundreds, thousands, ten-thousands (Indian system: thousand, lakh, ten-lakh, crore, ten-crore). No external library — implement from scratch. Return uppercase string ending in "ONLY".

---

## Task 7: Extend `createExcelInvoice.js` — CUMM BOQ Sheet

Add a `buildCummBOQSheet(boqItems, formData)` function to `createExcelInvoice.js`.

The sheet should exactly replicate the CUMM BOQ tab from `EDEN_C_PL_RA_3.xlsx`:

- Merged header rows (company name, reference, WO details)
- Column headers with sub-columns (Work Done Qty: Prev/Curr/Cumm — BOQ Qty: Prev/Curr/Cumm — Amount: Prev/Curr/Cumm)
- Each BOQ item as a section header row (bold, merged across description cols, light green background `#E2EFDA`)
- 4 phase sub-rows per item (Supply/Install/T&C/Handover) with computed quantities and amounts
- Section totals
- Grand total with GST rows at the bottom
- Column widths matching the original (Sr.No=40px, Description=300px, WO Qty=60px, etc.)
- Row heights: header rows 30px, data rows 18px

Cell number format: `#,##0.00` for amounts, `#,##0` for quantities.

---

## Implementation Order

1. `src/lib/amountToWords.js` — utility, no dependencies
2. Refactor `src/pages/Billing.jsx` — add billing list + template picker dialog
3. `src/pages/LodhaRABill.jsx` — page shell with tab navigation + state + data loading
4. `<LodhaCheckListSheet />` component (in `src/components/billing/LodhaCheckListSheet.jsx`)
5. `<LodhaTaxInvoiceSheet />` component (in `src/components/billing/LodhaTaxInvoiceSheet.jsx`)
6. `<LodhaCummBOQSheet />` component (in `src/components/billing/LodhaCummBOQSheet.jsx`)
7. `<LodhaChallanSummarySheet />` component (in `src/components/billing/LodhaChallanSummarySheet.jsx`)
8. `<LodhaITRSummarySheet />` component (in `src/components/billing/LodhaITRSummarySheet.jsx`)
9. `<LodhaRateAnalysisSheet />` component (in `src/components/billing/LodhaRateAnalysisSheet.jsx`)
10. `<LodhaAmendBOQSheet />` component (in `src/components/billing/LodhaAmendBOQSheet.jsx`)
11. Extend `createExcelInvoice.js` — add CUMM BOQ sheet builder
12. Wire up download buttons
13. Add routes in `src/App.jsx`

---

## Styling Constraints

- Use **only Tailwind CSS utility classes** (no custom CSS files except for the spreadsheet-like table which needs explicit `border-collapse`)
- Use existing shadcn/ui components from `src/components/ui/`
- Follow the existing dark mode pattern (`dark:` classes)
- The TAX INVOICE sheet table should use `style={{}}` props for pixel-precise replication where Tailwind can't match
- The CUMM BOQ sheet is the widest — it needs horizontal scrolling. Wrap in `<div className="overflow-x-auto">`
- Text in the invoice header: use `font-serif` (Georgia or Times) for the "TAX INVOICE" title to match Bookman Old Style

---

## Key Numbers and Constants (hardcode these as defaults)

```js
// Phase weights
const PHASE_WEIGHTS = { supply: 0.60, install: 0.25, tc: 0.10, handover: 0.05 };

// Tax rates
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;

// SAC code for plumbing
const PLUMBING_SAC_CODE = "998322";

// Invoice number pattern
const generateInvoiceNumber = (projectCode, raNumber) =>
  `ME/${projectCode}-PL/${raNumber}`;

// Project code extraction from building name
const extractProjectCode = (buildingName) =>
  String(buildingName || "").replace(/\s+/g, "").toUpperCase().slice(0, 8);
```

---

## Critical: Do NOT Do These Things

- Do NOT hardcode any monetary values, names, addresses, or GST numbers as static strings in JSX — all must come from state/props/API
- Do NOT use `luckysheet` for the inline sheet display — it's too heavy and already causes issues. Build the sheets as custom React tables.
- Do NOT call `downloadInvoicePdf` or `createExcelInvoice` on page load — only on button click
- Do NOT make the Check List tab require network calls — it's form state only
- Do NOT forget to handle the case where `getBOQItemsByProject` returns empty (show an "Import BOQ" prompt)
- Do NOT break the existing `Billing.jsx` routes — the new code extends it, not replaces routes

---

## Files to Create / Modify

### New files:
- `src/pages/LodhaRABill.jsx`
- `src/components/billing/LodhaCheckListSheet.jsx`
- `src/components/billing/LodhaTaxInvoiceSheet.jsx`
- `src/components/billing/LodhaCummBOQSheet.jsx`
- `src/components/billing/LodhaChallanSummarySheet.jsx`
- `src/components/billing/LodhaITRSummarySheet.jsx`
- `src/components/billing/LodhaRateAnalysisSheet.jsx`
- `src/components/billing/LodhaAmendBOQSheet.jsx`
- `src/lib/amountToWords.js`

### Modified files:
- `src/pages/Billing.jsx` — add billing list table + template picker dialog
- `src/pages/createExcelInvoice.js` — add `buildCummBOQSheet` and `createLodhaFullPackage`
- `src/App.jsx` — add new routes for LodhaRABill

---

## Reference: Exact Column Structure for CUMM BOQ

From the analysed Excel, the CUMM BOQ has these exact columns (left to right):

| Col | Content |
|-----|---------|
| A | Sr. No. |
| B | Description of Work |
| C | Current WO Qty |
| D | Work Done - Previous |
| E | Work Done - Current |
| F | Work Done - Cumulative |
| G | BOQ Qty - Previous |
| H | BOQ Qty - Current |
| I | BOQ Qty - Cumulative |
| J | U.O.M. |
| K | Rate / U.O.M. |
| L | Amount - Previous |
| M | Amount - Current |
| N | Amount - Cumulative |

The "Work Done" quantities are the actual physical quantities installed/delivered.
The "BOQ Qty" = Work Done Qty × Phase Factor (0.60 for supply etc.) — this is what gets multiplied by rate.

So: `Amount = BOQ_Qty × Rate = Work_Done_Qty × Phase_Factor × Rate`

---

## Reference: TAX INVOICE — Exact Column Widths

From the analysed Excel (14 columns total A–N):
- A (SN): narrow ~40px
- B (Description): wide ~200px
- C (SAC/HSN): ~70px
- D (UOM): ~40px
- E (Qty): ~50px
- F (Rate): ~60px
- G (Total Value): ~90px
- H (Discount): ~70px
- I (Taxable Value): ~90px
- J (CGST Rate): ~45px
- K (CGST Amt): ~75px
- L (SGST Rate): ~45px
- M (SGST Amt): ~75px
- N (IGST Rate+Amt, Cess Rate+Amt): split into 4 sub-cols ~40px each

The invoice sheet renders at about 1200px wide minimum. Use `min-width: 1200px` on the table.