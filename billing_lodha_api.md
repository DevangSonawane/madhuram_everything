BILLING MODULE — API MAPPING (Lodha RA Bill)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE URL: https://api.madhuram.enterprises
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─── BILLING LIST PAGE (Billing.jsx) ───────────────────

FETCH on load:
  GET /api/lodha-invoice/project/{projectId}
  → populate the billing list table (RA bills for this project)

─── LODHA RA BILL PAGE (LodhaRABill.jsx) ──────────────

FETCH on load (all parallel):
  GET /api/projects/{projectId}
  → work_order_number, work_order_date, building_name,
    site_address, place_of_supply, work_order_value,
    client name, client GSTIN, client address

  GET /api/boq/project/{projectId}
  → all BOQ items with item_no, description, unit, wo_qty, rate
  → use for CUMM BOQ tab, AMEND BOQ tab, RATE ANALYSIS tab

  GET /api/mir/project/{projectId}
  → for CHALLAN SUMMARY tab — linked MIRs with challan_no,
    items (qty per BOQ line), inspection dates

  GET /api/itr/project/{projectId}
  → for ITR SUMMARY tab — linked ITRs with items and quantities

  GET /api/lodha-invoice/{billId}   ← only if editing existing bill
  → populate full form state from saved bill

  GET /api/dc/project/{projectId}
  → for Challan Summary tab — delivery challan numbers to display

SAVE (Create new):
  POST /api/lodha-invoice
  Body: LodhaInvoiceInput schema
  → on "Save Draft" and on "Submit"

SAVE (Update existing):
  PUT /api/lodha-invoice/{id}
  Body: LodhaInvoiceInput schema
  → on auto-save debounce and on "Save Draft"

DELETE:
  DELETE /api/lodha-invoice/{id}
  → from billing list "Delete" action

─── BOQ IMPORT (AMEND BOQ tab) ────────────────────────

If BOQ not yet imported for project:
  POST /api/boq/parse-pdf/lodha
  Body: { boq_file: File }
  → parse work order PDF → returns array of BOQ items

  POST /api/boq/lodha   (once per item, or use generic)
  POST /api/boq         (generic, call per item to save)
  → save parsed BOQ items to DB against projectId

  GET /api/boq/project/{projectId}/items
  → lightweight fetch: item_no, description, unit, qty only

─── NO NEW APIs NEEDED ────────────────────────────────

Everything else is computed client-side from the data above:

  TAX INVOICE values   → computed from boq_items current quantities
  CUMM BOQ amounts     → qty × phase_factor × rate (client formula)
  CHALLAN SUMMARY      → joins mir items to boq items by description/HSN
  ITR SUMMARY          → joins itr items to boq items
  RATE ANALYSIS        → boq rate vs CPT rate (user-entered CPT)
  Amount in words      → amountToWords() utility function
  CGST/SGST amounts    → taxable_value × 0.09 each

─── APIs THAT DO NOT EXIST YET (need backend) ─────────

  NONE — all required endpoints already exist in the API.

  The only gap: when saving a Lodha Invoice, the
  LodhaInvoiceInput schema must include:
    - ra_number (RA bill cycle number)
    - boq_snapshot (the current-qty entries per item)
    - linked_mir_ids[]
    - linked_itr_ids[]
    - checklist_state (JSON of all Yes/No/NA answers)
    - cpt_price_list (rate overrides for rate analysis tab)

  Check if these fields exist in the current LodhaInvoice
  schema at https://api.madhuram.enterprises/docs/ under
  Schemas → LodhaInvoiceInput. If they don't, ask the
  backend to add them before building the save flow.

─── SUMMARY TABLE ─────────────────────────────────────

Page / Tab              Method   Endpoint
─────────────────────── ──────── ──────────────────────────────────────────
Billing list            GET      /api/lodha-invoice/project/{projectId}
Load project master     GET      /api/projects/{projectId}
Load BOQ items          GET      /api/boq/project/{projectId}
Load BOQ items light    GET      /api/boq/project/{projectId}/items
Load MIRs               GET      /api/mir/project/{projectId}
Load ITRs               GET      /api/itr/project/{projectId}
Load DCs                GET      /api/dc/project/{projectId}
Load existing bill      GET      /api/lodha-invoice/{id}
Create new bill         POST     /api/lodha-invoice
Update bill             PUT      /api/lodha-invoice/{id}
Delete bill             DELETE   /api/lodha-invoice/{id}
Parse BOQ PDF           POST     /api/boq/parse-pdf/lodha
Save BOQ items          POST     /api/boq/lodha