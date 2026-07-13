# Quotation Line-Item Calculations (BOQ / Quotes)

This document describes **exactly how calculations are performed** for quotation line items in the Quotes Create/Edit UI.

Source of truth: `src/pages/QuotesCreate.jsx` (`handleBoqFile` import recalculation + `updatePreviewCell` live recalculation).

## 1) Column matching (keys)

The UI supports different column header spellings by matching “logical fields” using:

- `normalizeKey(value) = String(value).toLowerCase().replace(/[^a-z0-9]/g, "")`
- Example: `Final Rate After Discount`, `final_rate_after_discount`, and `finalRateAfterDiscount` all normalize to the same key.

The following logical fields are used by the calculation logic (if present in the sheet):

- Base: `basic_rate` (preferred) or `rate` (fallback)
- Quantity: `quantity`
- Discount (percentage): `discount`
- Derived: `total_rate`, `amount`, `final_rate_after_discount`

## 2) Number parsing

For calculations, numeric input is converted using:

- If value is a string: commas are removed first (e.g. `"1,200"` → `"1200"`)
- Non-numeric values become `0`

## 3) Percent add-on columns (“% sum”)

For each row, the logic builds `percentSum` by summing the values of the configured “percent add-on” columns that exist in the sheet.

Default percent add-on keys:

- `fittings`
- `transportation`
- `support`
- `miscellaneous`
- `total_material_price`
- `labour`
- `material_plus_labour`
- `profit`

If you add a new column as **“% Add-on”** in the UI, that new column key is appended to this list and becomes part of `percentSum` (same math as above).

## 4) Per-row calculation formula

For a given row:

1. `basicRate = toNumber(row[basic_rate] ?? row[rate])`
2. `discount = toNumber(row[discount])` (percentage)
3. `percentSum = sum(toNumber(row[each percent-addon column]))`
4. `totalRate = basicRate + (basicRate * percentSum)/100 - (basicRate * discount)/100`
5. `qty = toNumber(row[quantity])`
6. `amount = totalRate * qty`

Then, if the corresponding columns exist:

- `row[total_rate] = totalRate`
- `row[amount] = amount`
- `row[final_rate_after_discount] = amount`

## 5) Special behavior for `amount` edits

If the user edits the `amount` cell directly:

- `final_rate_after_discount` is set to the numeric value of `amount`.

## 6) When recalculation runs

Recalculation happens in two places:

1. **On import** of BOQ Excel (before showing the preview)
2. **On every cell edit** (live, while typing) via `updatePreviewCell`

If a required column is missing (e.g., there is no `quantity` column), that part of the calculation will effectively use `0` for missing numeric values.

## 7) Totals shown under the sheet

In the Quotes Create/Edit page, totals are computed as:

- For each field in:
  - `basic_rate`, `discount`, `final_rate_after_discount`, `fittings`, `transportation`, `support`, `miscellaneous`,
    `total_material_price`, `labour`, `material_plus_labour`, `profit`, `total_rate`
  - The UI sums `Number(row[field])` across all rows (non-finite values are ignored).

“Total Amount”:

- Uses the sheet column whose normalized key is exactly `amount` (or contains `amount`) and sums it across rows.

## 8) Important notes / constraints

- The spreadsheet UI is only a front-end editor; the calculation logic is centralized in `QuotesCreate.jsx`.
- `final_rate_after_discount` is treated as derived in the UI (disabled for editing) and is updated by the logic above.
- Adding “% Add-on” columns does **not** change the formula; it only changes which columns are included in `percentSum`.

