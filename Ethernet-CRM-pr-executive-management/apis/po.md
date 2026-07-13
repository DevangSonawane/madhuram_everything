📘 Madhuram – PO (Purchase Order) API Documentation
Overview
The PO API in Madhuram manages Purchase Orders for projects.
It supports:
Uploading PO files/attachments
Creating Purchase Orders with line items & tax calculations
Fetching POs project-wise
Getting PO by ID
Updating PO
Deleting PO
✅ Base URL: /api/po
✅ Upload Directory: /uploads/po
✅ Database Table: pos
✅ Items Storage: Stored as JSON string (items array)

📦 PO Object Structure (Stored in DB)
A PO record contains company details, vendor details, order details, item list, totals, and status.
Items Array Format
Each PO contains an items array stored as JSON.
[
  {
    "srno": 1,
    "hsn": "1234",
    "description": "Cement Bag",
    "qty": 10,
    "UOM": "Bag",
    "Rate": 300,
    "Amount": 3000,
    "remark": "Urgent"
  }
]


✅ Common PO Fields
Field
Type
Notes
po_id
integer
Primary key
project_id
integer
Project ID
company_name
string
Company issuing PO
company_subtitle
string
Optional subtitle
company_email
string
Email
company_gst
string
GST number
indent_no
string
Indent number
indent_date
date
Indent date
order_no
string
Order number
po_date
date
PO date
vendor_name
string
Vendor name
site
string
Site name/location
site_address
string
Site address
primary_contact_name
string
Primary contact name
primary_contact_number
string
Primary contact number
secondary_contact_name
string
Secondary contact name
secondary_contact_number
string
Secondary contact number
items
array
Stored as JSON
discount
number
Discount percentage/value
discount_amount
number
Discount amount
after_discount
number
Total after discount
cgst
number
CGST %
cgst_amount
number
CGST amount
sgst
number
SGST %
sgst_amount
number
SGST amount
total_amount
number
Final PO total
delivery
string
Delivery terms
payment
string
Payment terms
notes
string
Extra notes
status
string
Default: created
created_at
datetime
Creation time
updated_at
datetime
Updated time


🔼 1) Upload File for PO
POST /api/po/upload
Uploads a PO attachment and returns a file path for saving in your records (if needed in frontend/UI).
Request Type
multipart/form-data
Form Field
Field
Type
Required
file
file
✅

Success Response (200)
{
  "filePath": "/uploads/po/170687123123-123456789.pdf"
}

Error Response (400)
{
  "error": "No file uploaded"
}

✅ Note: Your current PO schema doesn’t store filePath in the PO table.
If you want to store this, you’ll need a DB column like po_file and include it in POST/PUT.

🧾 2) Create a New PO
POST /api/po
Creates a new Purchase Order record.
Request Type
application/json
Request Body Fields
(These are directly inserted into DB)
Core
project_id (integer)
company details (name/email/gst etc.)
vendor details
items (array)
totals (discount/taxes/total)
status (optional, default created)
Example Request
{
  "project_id": 1,
  "company_name": "Madhuram Pvt Ltd",
  "company_subtitle": "Procurement Division",
  "company_email": "purchase@madhuram.com",
  "company_gst": "27ABCDE1234F1Z5",
  "indent_no": "IND-001",
  "indent_date": "2026-02-01",
  "order_no": "PO-2026-009",
  "po_date": "2026-02-02",
  "vendor_name": "ABC Suppliers",
  "site": "Madhuram Site 1",
  "site_address": "Mumbai, India",
  "primary_contact_name": "Ravi Kumar",
  "primary_contact_number": "9999999999",
  "secondary_contact_name": "Suresh",
  "secondary_contact_number": "8888888888",
  "items": [
    {
      "srno": 1,
      "hsn": "2523",
      "description": "Cement Bag",
      "qty": 10,
      "UOM": "Bag",
      "Rate": 300,
      "Amount": 3000,
      "remark": "Deliver ASAP"
    }
  ],
  "discount": 5,
  "discount_amount": 150,
  "after_discount": 2850,
  "cgst": 9,
  "cgst_amount": 256.5,
  "sgst": 9,
  "sgst_amount": 256.5,
  "total_amount": 3363,
  "delivery": "Within 3 days",
  "payment": "Advance 50%, balance on delivery",
  "notes": "Pack properly",
  "status": "created"
}

Success Response (201)
Returns the inserted PO record (full DB row).
Error Response (500)
{
  "error": "error message here"
}


🏗️ 3) Get All POs for a Project
GET /api/po/project/{projectId}
Fetches all POs for a specific project (latest first).
Path Parameter
Param
Type
projectId
integer

Success Response (200)
[
  {
    "po_id": 10,
    "project_id": 1,
    "order_no": "PO-2026-009",
    "total_amount": 3363,
    "status": "created"
  }
]


🔎 4) Get PO by ID
GET /api/po/{id}
Fetches a single PO record using po_id.
Path Parameter
Param
Type
id
integer

Success Response (200)
{
  "po_id": 10,
  "project_id": 1,
  "company_name": "Madhuram Pvt Ltd",
  "items": [
    { "srno": 1, "description": "Cement Bag", "qty": 10 }
  ]
}

Error Response (404)
{ "error": "PO not found" }


✏️ 5) Update an Existing PO
PUT /api/po/{id}
Updates PO fields. Missing fields remain unchanged using COALESCE.
✅ updated_at is updated automatically.
Request Type
application/json
Example Update Request
{
  "status": "approved",
  "notes": "Approved by procurement head",
  "items": [
    {
      "srno": 1,
      "hsn": "2523",
      "description": "Cement Bag",
      "qty": 20,
      "UOM": "Bag",
      "Rate": 300,
      "Amount": 6000,
      "remark": "Increase qty"
    }
  ],
  "total_amount": 6726
}

Success Response (200)
Returns updated PO row.
Error Response (404)
{ "error": "PO not found" }


🗑️ 6) Delete a PO
DELETE /api/po/{id}
Deletes a PO record.
Success Response (200)
{ "message": "PO deleted successfully" }

Error Response (404)
{ "error": "PO not found" }

7) Parse PO PDF and return structured JSON
POST /api/po-parser/parse
Summary: Upload a PO PDF, parse it, and get back a JSON object with all the fields required for POST /api/po.
Request:
Content-Type: multipart/form-data


Field: file (PDF)


Success Response (200):
{
  "success": true,
  "filename": "PO-123.pdf",
  "data": {
    "company_name": "Madhuram Industries",
    "order_no": "PO-123",
    "po_date": "2026-02-01",
    "vendor_name": "Vendor ABC",
    "items": [
      { "srno": 1, "hsn": "1234", "description": "Item 1", "qty": 10, "rate": 200, "amount": 2000 }
    ],
    "total_amount": 2000,
    "status": "created"
  }
}
400: No file uploaded

 { "error": "No PDF file uploaded. Use field name 'file'." }


500: Parsing failed

 { "error": "Parsing failed" }


