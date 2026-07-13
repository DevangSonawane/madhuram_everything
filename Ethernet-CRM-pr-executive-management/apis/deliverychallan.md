📘 Madhuram API Documentation – Delivery Challan (DC) Module
Overview
The Delivery Challan API is used to create and manage delivery challans for projects and purchase orders.
It supports:
Create Delivery Challan (auto-calculates status)
Get DC list by project
Get DC list by PO
Get DC by ID
Update DC (re-calculates status)
Delete DC
✅ Base URL: /api/dc
✅ Table: delivery_challans
✅ Items stored as JSON: items
✅ Auto fields:
total_po_items (if PO exists)
total_challan_items (items length)
status = completed or incomplete

📦 Delivery Challan Schema
DeliveryChallan Object (Response)
Field
Type
Notes
dc_id
integer
Primary key
project_id
integer
Required
po_id
integer | null
Optional
po_number
string | null
Optional (used to lookup PO if po_id missing)
challan_number
string
Required
items
array(object)
Required
challan_date
date | null
Optional
work_order_number
string | null
Optional
order_date
date | null
Optional
total_po_items
integer | null
Calculated from PO items count
total_challan_items
integer
Calculated from items.length
status
string
completed / incomplete
created_at
datetime
Created time
updated_at
datetime
Updated time


🧾 Item Schema (Inside items Array)
Each item supports:
Field
Type
name
string
description
string
width
number
length
number
quantity
number
price
number

Example Item
{
  "name": "Tile",
  "description": "Floor tile",
  "width": 2,
  "length": 2,
  "quantity": 10,
  "price": 150
}


✅ Status Logic (Important)
When creating or updating a DC:
If po_id exists → system checks PO in pos table and counts the number of items.
Else if po_number exists → system tries to find PO by:
order_no = po_number
project_id = project_id
Then:
✅ total_challan_items = items.length
✅ status is:
completed if total_po_items === total_challan_items
otherwise incomplete
If PO is not found → total_po_items = null, status becomes incomplete.

✅ Endpoints

1) Create Delivery Challan
POST /api/dc
Creates a new delivery challan + calculates status.
Content-Type: application/json
Required Fields
✅ project_id
✅ challan_number
✅ items (array)
Request Body
Field
Type
Required
project_id
integer
✅
challan_number
string
✅
items
array
✅
po_id
integer
❌
po_number
string
❌
challan_date
date
❌
work_order_number
string
❌
order_date
date
❌

Example Request
{
  "project_id": 10,
  "po_id": 5,
  "challan_number": "DC-001",
  "items": [
    {
      "name": "Tile",
      "description": "Floor tile",
      "width": 2,
      "length": 2,
      "quantity": 10,
      "price": 150
    }
  ],
  "challan_date": "2026-02-26",
  "work_order_number": "WO-1001",
  "order_date": "2026-02-20"
}

Success Response (201)
Returns created DC with calculated fields:
{
  "dc_id": 1,
  "project_id": 10,
  "po_id": 5,
  "challan_number": "DC-001",
  "items": [...],
  "total_po_items": 1,
  "total_challan_items": 1,
  "status": "completed",
  "created_at": "2026-02-26T10:00:00.000Z"
}

Error Response (400)
If required fields missing:
{ "error": "project_id, challan_number and items are required" }


2) Get Delivery Challans by Project
GET /api/dc/project/{projectId}
Fetch all DCs for a project (latest first).
Path Param
Param
Type
Required
projectId
integer
✅

Success Response (200)
[
  {
    "dc_id": 1,
    "project_id": 10,
    "challan_number": "DC-001",
    "status": "completed"
  }
]


3) Get Delivery Challans by PO
GET /api/dc/po/{poId}
Fetch all DCs for a specific PO.
Path Param
Param
Type
Required
poId
integer
✅

Success Response (200)
Returns list of DCs for that PO.

4) Get Delivery Challan by ID
GET /api/dc/{id}
Fetch a single DC using dc_id.
Path Param
Param
Type
Required
id
integer
✅

Error Response (404)
{ "error": "Delivery Challan not found" }


5) Update Delivery Challan
PUT /api/dc/{id}
Updates DC fields + re-calculates:
total_po_items
total_challan_items
status
Content-Type: application/json
Request Body (Any Optional)
Field
Type
project_id
integer
po_id
integer
po_number
string
challan_number
string
items
array
challan_date
date
work_order_number
string
order_date
date

Example Request
{
  "items": [
    { "name": "Tile", "quantity": 10, "price": 150 },
    { "name": "Cement", "quantity": 5, "price": 350 }
  ]
}

Success Response (200)
Returns updated DC with updated status.
Error Response (404)
{ "error": "Delivery Challan not found" }


6) Delete Delivery Challan
DELETE /api/dc/{id}
Deletes a DC by ID.
Success Response (200)
{ "message": "Delivery Challan deleted successfully" }

Error Response (404)
{ "error": "Delivery Challan not found" }

7) Upload file for DC
POST /api/dc/upload
 Content type: multipart/form-data
 Form field: file (single file)
Success (200)
{ "filePath": "/uploads/dc/1677639023-123456789.jpg" }
Errors
400: { "error": "No file uploaded" }


curl
curl -X POST "https://<host>/api/dc/upload" \
 -F "file=@/path/to/challan.pdf"
Fetch (frontend)
const form = new FormData();
form.append("file", fileInput.files[0]);
const res = await fetch("/api/dc/upload", { method: "POST", body: form });
const data = await res.json(); // { filePath: "/uploads/dc/..." }



✅ Notes (Based on Your Code)
items are stored as JSON string in DB.
Status depends ONLY on comparing count of items:
PO items count vs DC items count
If PO not found → total_po_items = null → status = incomplete
No authentication middleware is used (routes are public currently)


