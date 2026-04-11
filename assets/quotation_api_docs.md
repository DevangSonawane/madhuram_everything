# Quotation Module — API Integration Guide

> **Base URL:** `https://<your-server>/api/quotations`
> **Content-Type:** `application/json` (unless noted as `multipart/form-data`)
> **Author:** Backend Team
> **Version:** v2 (Dynamic Fields)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quotation CRUD](#2-quotation-crud)
   - 2.1 Create Quotation
   - 2.2 Get All Quotations
   - 2.3 Get Single Quotation
   - 2.4 Update Quotation
   - 2.5 Delete Quotation
   - 2.6 Update Status
3. [Dynamic Field Definitions](#3-dynamic-field-definitions)
   - 3.1 Get All Fields
   - 3.2 Add a New Field
   - 3.3 Update a Field
   - 3.4 Deactivate a Field
4. [File Uploads](#4-file-uploads)
   - 4.1 Upload Drawing Files (standalone)
   - 4.2 Attach BOQ File to Quotation
   - 4.3 Attach Drawing Files to Quotation
   - 4.4 Import BOQ from Excel
5. [Calculation Engine](#5-calculation-engine)
6. [Data Models](#6-data-models)
7. [Error Reference](#7-error-reference)

---

## 1. Overview

The Quotation module manages BOQ (Bill of Quantities) quotations. Each quotation has:
- A **header** (project name, client, dates, GST, status, file attachments)
- A list of **line items** (the BOQ rows — the Excel-like grid)
- **Dynamic field values** per line item (for any custom columns added by admin)

### Key Rules

- The server **always recomputes** `total_rate`, `amount`, and `final_rate_after_discount` on every save. You can send frontend-calculated values but they will be overwritten. See Section 5 for the formula.
- `final_rate_after_discount` is always equal to `amount`. It is read-only — never show it as an editable cell.
- `grand_total = total_amount + gst_amount` (computed server-side).
- All file paths returned by the API are relative URLs (e.g. `/uploads/quotations/boq/file.xlsx`). Prefix with your server base URL to display them.

---

## 2. Quotation CRUD

---

### 2.1 Create Quotation

**`POST /api/quotations`**

Creates a new quotation with its BOQ line items.

#### Request Body

```json
{
  "project_name": "Metro Station Electrical Works",
  "client_name": "MMRDA",
  "quotation_no": "QT-2025-001",
  "quotation_date": "2025-04-11",
  "gst_percentage": 18,
  "last_date_revised_offer": "2025-05-01",
  "is_revised_offer": false,
  "notes": "Prices valid for 30 days.",
  "created_by": "user-uuid-here",
  "created_by_name": "Rahul Sharma",
  "boq_files": ["/uploads/quotations/boq/1712345678-boq.xlsx"],
  "drawing_files": ["/uploads/quotations/drawings/1712345679-plan.pdf"],
  "items": [
    {
      "item_no": "1",
      "sub_head": "A",
      "description": "Cable tray 200mm wide",
      "unit": "Rmt",
      "quantity": 100,
      "basic_rate": 850,
      "discount": 5,
      "fittings": 3,
      "transportation": 2,
      "support": 1,
      "miscellaneous": 0,
      "total_material_price": 0,
      "labour": 10,
      "material_plus_labour": 0,
      "profit": 5,
      "dynamic_values": [
        { "field_key": "erection_cost", "value": 200, "computed": false },
        { "field_key": "testing_charges", "value": 50, "computed": false }
      ]
    }
  ]
}
```

#### Field Reference — Header

| Field | Type | Required | Notes |
|---|---|---|---|
| `project_name` | string | ✅ | |
| `client_name` | string | ❌ | |
| `quotation_no` | string | ❌ | Must be unique. 400 error if duplicate. |
| `quotation_date` | string (date) | ❌ | Format: `YYYY-MM-DD` |
| `gst_percentage` | number | ❌ | Default: `18` |
| `last_date_revised_offer` | string (date) | ❌ | |
| `is_revised_offer` | boolean | ❌ | Default: `false` |
| `notes` | string | ❌ | |
| `created_by` | string | ❌ | User UUID for audit trail |
| `created_by_name` | string | ❌ | Display name for audit trail |
| `boq_files` | string[] | ❌ | Array of file paths (from upload API) |
| `drawing_files` | string[] | ❌ | Array of file paths (from upload API) |
| `items` | array | ❌ | BOQ line items. See item fields below. |

#### Field Reference — Each Item

| Field | Type | Editable | Notes |
|---|---|---|---|
| `item_no` | string | ✅ | e.g. "1", "1.1", "A" |
| `sub_head` | string | ✅ | Section header label |
| `description` | string | ✅ | |
| `unit` | string | ✅ | e.g. "Rmt", "Nos", "Sqm" |
| `quantity` | number | ✅ | |
| `basic_rate` | number | ✅ | Primary base rate (preferred over `rate`) |
| `rate` | number | ✅ | Fallback base rate if `basic_rate` is absent |
| `discount` | number | ✅ | Percentage (e.g. `5` = 5%) |
| `fittings` | number | ✅ | % add-on |
| `transportation` | number | ✅ | % add-on |
| `support` | number | ✅ | % add-on |
| `miscellaneous` | number | ✅ | % add-on |
| `total_material_price` | number | ✅ | % add-on |
| `labour` | number | ✅ | % add-on |
| `material_plus_labour` | number | ✅ | % add-on |
| `profit` | number | ✅ | % add-on |
| `total_rate` | number | ❌ READ-ONLY | Computed by server. See Section 5. |
| `amount` | number | ❌ READ-ONLY | Computed by server. See Section 5. |
| `final_rate_after_discount` | number | ❌ READ-ONLY | Always equals `amount`. |
| `dynamic_values` | array | ✅ | Values for custom columns. See below. |

#### dynamic_values Array

```json
"dynamic_values": [
  {
    "field_key": "erection_cost",
    "value": 200,
    "computed": false
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `field_key` | string | Must match a `field_key` from `GET /api/quotations/fields` |
| `value` | number | The value for this field on this item |
| `computed` | boolean | `true` if auto-calculated by frontend formula, `false` if user typed it |

#### Response `201 Created`

```json
{
  "message": "Quotation created successfully",
  "quotation": {
    "id": 12,
    "project_name": "Metro Station Electrical Works",
    "quotation_no": "QT-2025-001",
    "total_amount": 91750.00,
    "gst_percentage": 18,
    "gst_amount": 16515.00,
    "grand_total": 108265.00,
    "status": "draft",
    "items_count": 1,
    "created_at": "2025-04-11T09:30:00.000Z"
  }
}
```

---

### 2.2 Get All Quotations

**`GET /api/quotations`**

#### Query Parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `status` | string | `all` | One of: `all`, `draft`, `pending`, `sent`, `approved`, `rejected` |
| `is_revised_offer` | boolean | — | Filter by revised offer flag |

#### Example

```
GET /api/quotations?status=draft
GET /api/quotations?status=approved&is_revised_offer=false
```

#### Response `200 OK`

```json
[
  {
    "id": 12,
    "project_name": "Metro Station Electrical Works",
    "client_name": "MMRDA",
    "quotation_no": "QT-2025-001",
    "quotation_date": "2025-04-11",
    "total_amount": 91750.00,
    "gst_percentage": 18,
    "gst_amount": 16515.00,
    "grand_total": 108265.00,
    "status": "draft",
    "is_revised_offer": false,
    "boq_files": ["/uploads/quotations/boq/file.xlsx"],
    "drawing_files": [],
    "created_at": "2025-04-11T09:30:00.000Z",
    "updated_at": "2025-04-11T09:30:00.000Z"
  }
]
```

---

### 2.3 Get Single Quotation

**`GET /api/quotations/:id`**

Returns the quotation header plus all line items. Each item includes its `dynamic_values` keyed by `field_key`.

#### Response `200 OK`

```json
{
  "id": 12,
  "project_name": "Metro Station Electrical Works",
  "client_name": "MMRDA",
  "quotation_no": "QT-2025-001",
  "total_amount": 91750.00,
  "gst_amount": 16515.00,
  "grand_total": 108265.00,
  "status": "draft",
  "boq_files": ["/uploads/quotations/boq/file.xlsx"],
  "drawing_files": ["/uploads/quotations/drawings/plan.pdf"],
  "items": [
    {
      "id": 55,
      "item_no": "1",
      "description": "Cable tray 200mm wide",
      "unit": "Rmt",
      "quantity": 100,
      "basic_rate": 850,
      "discount": 5,
      "fittings": 3,
      "transportation": 2,
      "support": 1,
      "miscellaneous": 0,
      "total_material_price": 0,
      "labour": 10,
      "material_plus_labour": 0,
      "profit": 5,
      "total_rate": 917.50,
      "amount": 91750.00,
      "final_rate_after_discount": 91750.00,
      "sort_order": 1,
      "dynamic_values": {
        "erection_cost": {
          "value": 200,
          "label": "Erection Cost",
          "data_type": "number",
          "computed": false
        },
        "testing_charges": {
          "value": 50,
          "label": "Testing Charges",
          "data_type": "number",
          "computed": false
        }
      }
    }
  ]
}
```

> **Note:** `dynamic_values` is a plain object keyed by `field_key`. If an item has no value stored for a field, that key will simply be absent. Always check with `item.dynamic_values?.["erection_cost"]` before reading.

---

### 2.4 Update Quotation

**`PUT /api/quotations/:id`**

Replaces the header and **all** line items. Send the complete items array every time (same as Create). Any items not included will be deleted.

The request body is identical to Create (Section 2.1), with these extra fields:

| Field | Type | Notes |
|---|---|---|
| `status` | string | One of: `draft`, `pending`, `sent`, `approved`, `rejected` |
| `updated_by` | string | User UUID |
| `updated_by_name` | string | Display name |

#### Response `200 OK`

```json
{
  "message": "Quotation updated successfully",
  "quotation": { ...quotation header... }
}
```

---

### 2.5 Delete Quotation

**`DELETE /api/quotations/:id`**

Permanently deletes the quotation, all its items, and drawing records.

#### Request Body (optional)

```json
{
  "deleted_by": "user-uuid",
  "deleted_by_name": "Rahul Sharma"
}
```

#### Response `200 OK`

```json
{ "message": "Quotation deleted successfully" }
```

---

### 2.6 Update Status

**`PATCH /api/quotations/:id/status`**

Updates only the status field. Does not touch items.

#### Request Body

```json
{
  "status": "sent",
  "updated_by": "user-uuid",
  "updated_by_name": "Rahul Sharma"
}
```

Allowed status values: `draft` → `pending` → `sent` → `approved` / `rejected`

#### Response `200 OK`

```json
{
  "message": "Status updated to sent",
  "quotation": { ...quotation header... }
}
```

---

## 3. Dynamic Field Definitions

Dynamic fields are the **column definitions** for the BOQ grid. On page load, call `GET /api/quotations/fields` and use the response to render column headers. This lets admins add new columns without frontend code changes.

---

### 3.1 Get All Fields

**`GET /api/quotations/fields`**

Call this once on quotation page load to get the full ordered list of columns.

#### Query Parameters

| Param | Default | Notes |
|---|---|---|
| `active_only` | `true` | Pass `false` to include deactivated fields |

#### Response `200 OK`

```json
{
  "fields": [
    {
      "id": 1,
      "field_key": "item_no",
      "label": "Item No",
      "data_type": "text",
      "field_role": "text",
      "formula_description": null,
      "description": null,
      "is_active": true,
      "sort_order": 1
    },
    {
      "id": 6,
      "field_key": "basic_rate",
      "label": "Basic Rate",
      "data_type": "number",
      "field_role": "base",
      "formula_description": "Primary base rate. Engine variable: basicRate = basic_rate ?? rate",
      "is_active": true,
      "sort_order": 6
    },
    {
      "id": 19,
      "field_key": "erection_cost",
      "label": "Erection Cost (%)",
      "data_type": "percent",
      "field_role": "percent_addon",
      "formula_description": "Added to percentSum. Effect: total_rate += basicRate × erection_cost / 100",
      "is_active": true,
      "sort_order": 19
    }
  ]
}
```

#### field_role Values — How to use in UI

| `field_role` | What it means for the UI |
|---|---|
| `text` | Plain text input cell. Not part of any calculation. |
| `input` | Numeric input cell. User types a value. (e.g. `quantity`, `discount`) |
| `base` | Numeric input. One of the two base rate inputs (`basic_rate` / `rate`). |
| `percent_addon` | Numeric/percent input. This value is included in `percentSum` and affects `total_rate`. Show as editable. |
| `derived` | **Read-only.** Computed by the server/calculation engine. Show as a greyed-out cell. |

---

### 3.2 Add a New Field

**`POST /api/quotations/fields`**

Adds a new column to the BOQ grid for all quotations.

#### Request Body

```json
{
  "field_key": "erection_cost",
  "label": "Erection Cost (%)",
  "data_type": "percent",
  "field_role": "percent_addon",
  "formula_description": "5% of basic rate added to total",
  "description": "Shown as tooltip in the grid header",
  "sort_order": 19,
  "created_by": "user-uuid"
}
```

#### Field Reference

| Field | Required | Notes |
|---|---|---|
| `field_key` | ✅ | Lowercase letters, digits, underscores only. Must start with a letter. Must be unique. Example: `erection_cost` |
| `label` | ✅ | Column header text shown in the UI |
| `data_type` | ❌ | `number` (default), `text`, or `percent` |
| `field_role` | ❌ | Default: `input`. See table above. Use `percent_addon` if this column should contribute to `total_rate`. |
| `formula_description` | ❌ | Human-readable description for tooltips. Not evaluated at runtime. |
| `description` | ❌ | Extra tooltip/notes |
| `sort_order` | ❌ | Column position. Lower = further left. Default: `0` |
| `created_by` | ❌ | User UUID |

#### Response `201 Created`

```json
{
  "message": "Dynamic field \"Erection Cost (%)\" created successfully.",
  "field": {
    "id": 19,
    "field_key": "erection_cost",
    "label": "Erection Cost (%)",
    "data_type": "percent",
    "field_role": "percent_addon",
    "is_active": true,
    "sort_order": 19
  }
}
```

> **After adding a field:** Refresh your column list (`GET /api/quotations/fields`) and re-render the grid headers. Existing quotation items will have no value for this field until the user fills it in.

---

### 3.3 Update a Field

**`PUT /api/quotations/fields/:id`**

Update any property of a field. Only send the fields you want to change.

#### Request Body (all fields optional)

```json
{
  "label": "Erection & Installation (%)",
  "sort_order": 20,
  "is_active": true
}
```

#### Response `200 OK`

```json
{
  "message": "Field updated.",
  "field": { ...updated field object... }
}
```

---

### 3.4 Deactivate a Field

**`DELETE /api/quotations/fields/:id`**

Soft-deletes the field (sets `is_active = false`). The column disappears from `GET /api/quotations/fields` (unless `active_only=false`). Stored values on existing items are preserved in the database.

#### Response `200 OK`

```json
{
  "message": "Field deactivated.",
  "field": { ...field with is_active: false... }
}
```

---

## 4. File Uploads

---

### 4.1 Upload Drawing Files (Standalone)

**`POST /api/quotation/upload`**

Upload drawing files before creating a quotation (or independently). Returns file paths to include in the quotation body.

#### Request

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `drawing` | file (multiple) | Up to 10 files. Any file type. |

#### Response `200 OK`

```json
{
  "success": true,
  "drawing_files": [
    "/uploads/quotations/drawings/1712345679-plan.pdf",
    "/uploads/quotations/drawings/1712345680-elevation.pdf"
  ]
}
```

> Pass these paths in `drawing_files` array when calling Create or Update quotation.

---

### 4.2 Attach BOQ File to Existing Quotation

**`POST /api/quotations/:id/upload/boq`**

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | file | Single file. Any type. |
| `uploaded_by` | string | User UUID (optional) |
| `uploaded_by_name` | string | Display name (optional) |

#### Response `200 OK`

```json
{
  "message": "BOQ file uploaded successfully",
  "file_path": "/uploads/quotations/boq/1712345678-boq.xlsx",
  "quotation": { ...quotation header... }
}
```

---

### 4.3 Attach Drawing Files to Existing Quotation

**`POST /api/quotations/:id/upload/drawings`**

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `files` | file (multiple) | Up to 20 files. Any type. |
| `uploaded_by` | string | Optional |
| `uploaded_by_name` | string | Optional |

#### Response `200 OK`

```json
{
  "message": "2 drawing(s) uploaded",
  "quotation": { ...quotation header... }
}
```

---

### 4.4 Import BOQ from Excel

**`POST /api/quotations/import/excel`**

Upload a `.xls` or `.xlsx` BOQ file. The server parses it and returns the items as JSON — use this to pre-fill the quotation form grid. **Does not save a quotation.** After user reviews, call Create (2.1) with the items.

`Content-Type: multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | file | `.xls` or `.xlsx` only |

#### Response `200 OK`

```json
{
  "success": true,
  "file_url": "/uploads/quotations/boq/1712345678-boq.xlsx",
  "message": "Parsed 24 BOQ items from sheet \"BOQ\"",
  "items_count": 24,
  "total_amount": 850000.00,
  "gst_amount": 153000.00,
  "grand_total": 1003000.00,
  "items": [
    {
      "item_no": "1",
      "description": "Cable tray 200mm",
      "unit": "Rmt",
      "quantity": 100,
      "basic_rate": 850,
      "discount": 5,
      "fittings": 3,
      "total_rate": 917.50,
      "amount": 91750.00,
      "final_rate_after_discount": 91750.00
    }
  ],
  "summary": {
    "total_amount": 850000.00,
    "gst_amount": 153000.00,
    "grand_total": 1003000.00
  }
}
```

> **Typical flow:**
> 1. User uploads Excel → call this endpoint
> 2. Show parsed items in the editable grid
> 3. User reviews / edits cells
> 4. User clicks Save → call `POST /api/quotations` with the final items

---

## 5. Calculation Engine

The server recomputes `total_rate`, `amount`, and `final_rate_after_discount` on every Create and Update call. Your frontend values for these fields are **ignored and replaced**.

### Formula

```
percentSum  = fittings + transportation + support + miscellaneous
            + total_material_price + labour + material_plus_labour + profit
            + (any custom field with field_role = "percent_addon")

basicRate   = basic_rate  (if > 0)
              OR  rate    (fallback when basic_rate is absent or zero)

discount    = discount field value (percentage, e.g. 10 = 10%)

total_rate  = basicRate
            + (basicRate × percentSum / 100)
            − (basicRate × discount   / 100)

amount                    = total_rate × quantity
final_rate_after_discount = amount          ← always identical to amount
```

### Number Parsing Rules

- Comma-separated strings are supported: `"1,200"` → `1200`
- Non-numeric / missing values → `0`

### Column Totals (footer row)

The following columns are summed across all rows for the totals row:

`basic_rate`, `discount`, `final_rate_after_discount`, `fittings`, `transportation`, `support`, `miscellaneous`, `total_material_price`, `labour`, `material_plus_labour`, `profit`, `total_rate`

**Total Amount** = sum of all rows' `amount` field.

### Adding a Custom % Add-on Column

If admin adds a field with `field_role: "percent_addon"` (e.g. `erection_cost`), the server automatically includes it in `percentSum` for every subsequent save. No frontend formula change is needed — just send the value in `dynamic_values`.

---

## 6. Data Models

### Quotation Status Flow

```
draft  →  pending  →  sent  →  approved
                           ↘  rejected
```

### Full Quotation Object

```json
{
  "id": 12,
  "project_name": "string",
  "client_name": "string | null",
  "quotation_no": "string | null",
  "quotation_date": "date | null",
  "total_amount": 0.00,
  "gst_percentage": 18,
  "gst_amount": 0.00,
  "grand_total": 0.00,
  "status": "draft | pending | sent | approved | rejected",
  "is_revised_offer": false,
  "last_date_revised_offer": "date | null",
  "notes": "string | null",
  "boq_files": ["string"],
  "drawing_files": ["string"],
  "created_by": "string | null",
  "created_by_name": "string | null",
  "updated_by": "string | null",
  "updated_by_name": "string | null",
  "edit_history": [
    {
      "updated_by": "user-uuid",
      "updated_by_name": "Rahul Sharma",
      "updated_at": "2025-04-11T10:00:00.000Z",
      "action": "Quotation updated"
    }
  ],
  "created_at": "2025-04-11T09:30:00.000Z",
  "updated_at": "2025-04-11T09:30:00.000Z"
}
```

### Full Field Definition Object

```json
{
  "id": 19,
  "field_key": "erection_cost",
  "label": "Erection Cost (%)",
  "data_type": "number | text | percent",
  "field_role": "input | percent_addon | base | derived | text",
  "formula_description": "string | null",
  "description": "string | null",
  "is_active": true,
  "sort_order": 19,
  "created_by": "string | null",
  "created_at": "2025-04-11T09:00:00.000Z",
  "updated_at": "2025-04-11T09:00:00.000Z"
}
```

---

## 7. Error Reference

All errors follow this shape:

```json
{ "error": "Human-readable error message." }
```

| HTTP Code | When it happens |
|---|---|
| `400` | Validation failed (missing required fields, invalid values, duplicate `quotation_no` or `field_key`) |
| `404` | Quotation or field not found |
| `500` | Unexpected server error — check server logs |

### Common Errors

| Error message | Fix |
|---|---|
| `Quotation number 'X' already exists.` | Use a different `quotation_no` |
| `field_key and label are required.` | Include both in `POST /fields` |
| `field_key must start with a lowercase letter...` | Use format: `my_column_name` |
| `A field with field_key "X" already exists.` | Change the `field_key` |
| `status must be one of: draft, pending, sent, approved, rejected` | Send a valid status string |
| `Only .xls and .xlsx files are allowed` | Wrong file type in Excel import |

---

## Quick Integration Checklist

- [ ] On quotation list page load: `GET /api/quotations`
- [ ] On quotation create/edit page load: `GET /api/quotations/fields` → render column headers
- [ ] To pre-fill grid from Excel: `POST /api/quotations/import/excel`
- [ ] To upload drawings before saving: `POST /api/quotation/upload`
- [ ] To save a new quotation: `POST /api/quotations` with full items array
- [ ] To save edits: `PUT /api/quotations/:id` with full items array (replace, not patch)
- [ ] Status button (Send / Approve / Reject): `PATCH /api/quotations/:id/status`
- [ ] Delete: `DELETE /api/quotations/:id`
- [ ] Admin adds column: `POST /api/quotations/fields` then refresh column headers
- [ ] `total_rate`, `amount`, `final_rate_after_discount` are always READ-ONLY — never editable cells
