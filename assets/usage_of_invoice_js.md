# How to wire the Download button into InvoiceCreate.jsx

## 1. Install SheetJS (if not already)

```bash
npm install xlsx
```

---

## 2. Import into InvoiceCreate.jsx

```jsx
import { downloadInvoiceExcel } from "./createExcelInvoice";
```

---

## 3. Add a Download button to LodhaInvoiceForm

Inside `LodhaInvoiceForm`, replace the save buttons div with:

```jsx
<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
  <Button type="button" variant="outline"
    onClick={() => onSave?.({ header, items, totals, declaration }, { closeAfter: false })}>
    Save Draft
  </Button>

  {/* ADD THIS */}
  <Button type="button" variant="outline"
    onClick={() => downloadInvoiceExcel("lodha", { header, items, totals, declaration })}>
    Download Excel
  </Button>

  <Button type="button"
    onClick={() => onSave?.({ header, items, totals, declaration }, { closeAfter: true })}>
    Save Invoice
  </Button>
</div>
```

---

## 4. Add a Download button to HiranandaniInvoiceForm

```jsx
<Button type="button" variant="outline"
  onClick={() => downloadInvoiceExcel("hiranandani", {
    header,
    billingShipping,
    projectWork,
    items,
    totals,
    bankDeclaration,
  })}>
  Download Excel
</Button>
```

---

## 5. Lodha field mapping (form state to Excel)

| Form field key           | Excel position                          |
|--------------------------|-----------------------------------------|
| company_name             | Row 2, 28pt Lucida Sans Unicode         |
| company_address          | Row 3                                   |
| company_contact_number   | Row 4                                   |
| company_email            | Row 4                                   |
| company_website          | Row 5                                   |
| invoice_number           | Row 11 left (Invoice No :)              |
| invoice_date             | Row 12 left                             |
| supplier_gstin           | Row 7 left                              |
| pan_number               | Row 7 center                            |
| pf_number                | Row 11 right                            |
| esic_number              | Row 12 right                            |
| ptr_number               | Row 13 right                            |
| mlwf_number              | Row 14 right                            |
| reverse_charge           | Row 13 Y/N                              |
| state_name / state_code  | Row 14                                  |
| receiver_name            | Row 17 left Bill to Co A/C              |
| receiver_address         | Row 18 left                             |
| buyer_gstin              | Row 20 left                             |
| building_name            | Row 22 right                            |
| ra_number                | Row 23 RA No.                           |
| work_description         | Row 23 Work                             |
| work_order_number        | Row 23 WO NO                            |
| service_date_from/to     | Row 24                                  |

Items: description, sac_code, value_of_supply, discount, taxable_value,
       cgst_rate, cgst_amount, sgst_rate, sgst_amount, total

Totals: total_taxable_value, total_cgst, total_sgst, total_invoice_value,
        round_off, total_invoice_value_in_words, gst_on_reverse_charge

Declaration: terms, authorised_signatory

---

## 6. Hiranandani field mapping (form state to Excel)

| Form object       | Maps to             |
|-------------------|---------------------|
| header            | data.header         |
| billingShipping   | data.billingShipping|
| projectWork       | data.projectWork    |
| items             | data.items          |
| totals            | data.totals         |
| bankDeclaration   | data.bankDeclaration|

Key projectWork fields used in Excel:
- building_name      Row 8 right (Address / receiver)
- work_order_number  Row 12 right (WO No)
- plant_name         Row 13 right (PLANT NAME)
- bill_no            Row 14 right (BILL NO)
- work_description   Row 10 right (Place of Supply)

Items: description, sac_code, value_of_supply, cgst_rate, cgst_amount,
       sgst_rate, sgst_amount, igst_rate, igst_amount, cess_rate, cess_amount

Totals: total_value, total_cgst, total_sgst, total_invoice_value,
        total_invoice_value_in_words

---

## 7. What the output matches from the original files

### Lodha INV sheet
- Exact column widths (A=6.89, B=12.78, D=12.55, F=13.55, G=4.33...)
- Exact row heights (row 2=34.8pt, row 27=21pt, row 32=25.8pt, row 42=90pt)
- "Tax Invoice" title: bold 24pt Bookman Old Style, centered, rows 9-10 merged
- Company name: 28pt Lucida Sans Unicode
- All borders matching original (medium outer, thin inner table lines)
- Accounting number format on all monetary cells
- Merges on all header/footer regions exactly as original
- Terms and Conditions in tall row 90pt at bottom

### Hiranandani TAX Invoice sheet  
- Exact column widths (A=7.11, H=12.22, J=8.66, L=12.22, N=11.22...)
- Exact row heights (row 2=34.8pt, row 6=28.8pt, row 10=30.6pt)
- "TAX INVOICE" title: bold 22pt Calibri, full width A6:R6 merged, bordered
- Company logo embedded at cols O-R rows 1-2 (exact position from original)
- Tax rates as 0% format (decimal values like 0.09 display as 9%)
- All 18 columns A through R
- Totals section: Total Invoice Value (In figure) + (In Words)
- Declaration + Authorised Signatory section