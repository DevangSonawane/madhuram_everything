📘 Madhuram – MIR (Material Inspection Request) API Documentation
Overview
The MIR API is used in Madhuram’s system to create and manage Material Inspection Requests for projects.
It supports:
Uploading reference documents (files)
Creating MIR entries with dynamic fields
CRUD operations
Fetching MIRs project-wise
✅ Base URL: /api/mir
✅ File Upload Path: /uploads/mir
✅ Database: PostgreSQL (mirs table)
✅ File Upload Middleware: Multer

✅ MIR Object Schema
Field
Type
Description
mir_id
integer
Unique MIR ID
project_name
string
Project name
project_code
string
Project code
client_name
string
Client name
pmc
string
PMC name
contractor
string
Contractor name
vendor_code
string
Vendor code
mir_refrence_no
string
MIR reference number
material_code
string
Material code
inspection_date_time
datetime
Inspection date & time
client_submission_date
date
Date submitted to client
refrence_docs_attached
string
File path returned from upload API
mir_submited
boolean
Submission status
dynamic_field
array
Custom dynamic fields in key-value format
project_id
integer
Linked project ID
created_at
datetime
Creation timestamp
updated_at
datetime
Updated timestamp (set on update)

dynamic_field format
[
  { "key": "Field1", "value": "Value1" },
  { "key": "Field2", "value": "Value2" }
]


🔼 1) Upload MIR Reference Document
POST /api/mir/upload
Uploads a file and returns the file path to store in the database.
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
  "filePath": "/uploads/mir/170687123123-123456789.pdf"
}

Error Response (400)
{
  "error": "No file uploaded"
}

✅ Note: The returned filePath should be used as refrence_docs_attached when creating/updating an MIR.

🧾 2) Create a New MIR
POST /api/mir
Creates a new MIR record.
Request Type
application/json
Request Body Fields
Field
Type
Required
project_name
string
❌
project_code
string
❌
client_name
string
❌
pmc
string
❌
contractor
string
❌
vendor_code
string
❌
mir_refrence_no
string
❌
material_code
string
❌
inspection_date_time
string (datetime)
❌
client_submission_date
string (date)
❌
refrence_docs_attached
string
❌
mir_submited
boolean
❌
dynamic_field
array
❌
project_id
integer
✅ (recommended; enforced by FK)

Example Request
{
  "project_name": "Project A",
  "project_code": "PA-001",
  "client_name": "Client X",
  "pmc": "PMC Y",
  "contractor": "Contractor Z",
  "vendor_code": "V-101",
  "mir_refrence_no": "MIR-2026-001",
  "material_code": "MAT-222",
  "inspection_date_time": "2026-02-02T10:30:00Z",
  "client_submission_date": "2026-02-02",
  "refrence_docs_attached": "/uploads/mir/170687123123-123456789.pdf",
  "mir_submited": false,
  "dynamic_field": [
    { "key": "Heat No", "value": "H123" },
    { "key": "Batch", "value": "B9" }
  ],
  "project_id": 1
}

Success Response (201)
Returns newly created record (entire row).
Error Responses
✅ 400 Invalid project_id
{ "error": "Invalid project_id: Project does not exist" }

✅ 500 Server error
{ "error": "Internal Server Error" }


📋 3) Get All MIRs
GET /api/mir
Fetches all MIR records (latest first).
Success Response (200)
[
  {
    "mir_id": 1,
    "project_name": "Project A",
    "mir_refrence_no": "MIR-2026-001",
    "created_at": "2026-02-02T10:00:00Z"
  }
]


🔎 4) Get MIR by ID
GET /api/mir/{id}
Fetches a single MIR record using mir_id.
Path Parameter
Param
Type
id
integer

Success Response (200)
{
  "mir_id": 1,
  "project_name": "Project A",
  "mir_refrence_no": "MIR-2026-001"
}

Error Response (404)
{ "error": "MIR not found" }


🏗️ 5) Get MIRs by Project ID
GET /api/mir/project/{projectId}
Fetches all MIRs linked to a specific project.
Path Parameter
Param
Type
projectId
integer

Success Response (200)
[
  {
    "mir_id": 5,
    "project_id": 2,
    "mir_refrence_no": "MIR-2026-014"
  }
]


✏️ 6) Update MIR
PUT /api/mir/{id}
Updates one or more fields of an MIR.
Request Type
application/json
✅ Only the fields you send are updated.
✅ Additionally, updated_at = CURRENT_TIMESTAMP is always updated.
Example Request
{
  "mir_submited": true,
  "client_submission_date": "2026-02-03",
  "dynamic_field": [
    { "key": "Approved By", "value": "Engineer A" }
  ]
}

Success Response (200)
Returns updated MIR row.
Error Responses
400 No fields to update
{ "error": "No fields to update" }

404 MIR not found
{ "error": "MIR not found" }


🗑️ 7) Delete MIR
DELETE /api/mir/{id}
Deletes an MIR entry by mir_id.
Success Response (200)
{ "message": "MIR deleted successfully" }

Error Response (404)
{ "error": "MIR not found" }


⚠️ Important Notes (based on your code)
✅ Upload API stores file physically, but on delete MIR you are not deleting the uploaded file (unlike your BOQ delete flow).
If you want, I can give you a small patch to delete the uploaded file automatically when MIR is deleted.
✅ dynamic_field is stored as JSON string using:
create: JSON.stringify(dynamic_field || [])
update: JSON.stringify(dynamic_field)

