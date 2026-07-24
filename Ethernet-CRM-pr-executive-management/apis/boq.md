📘 Madhuram – BOQ API Documentation
Overview
The BOQ (Bill of Quantities) API allows Madhuram to manage BOQ items for construction projects.
It supports file uploads, CRUD operations, and project-wise BOQ retrieval.
Base URL: https://api.madhuram.enterprises
File Uploads: Supported (PDF, Excel, etc.)
Storage Path: /uploads/boq
Database: PostgreSQL
Authentication: Not applied in this module (can be added later)

📦 BOQ Object Schema
Field Name
Type
Description
boq_id
Integer
Unique BOQ ID
category
String
BOQ category
item_code
String
Item reference code
description
String
Item description
floor
String
Floor / level
unit
String
Measurement unit
quantity
Number
Quantity
rate
Number
Rate per unit
amount
Number
Total amount
boq_file
String
Uploaded file path
project_id
Integer
Associated project ID
created_at
DateTime
Record creation timestamp


1️⃣ Create BOQ Item
POST /api/boq
Creates a new BOQ entry with optional file upload.
Request Type
multipart/form-data
Request Fields
Field
Type
Required
category
String
✅
item_code
String
❌
description
String
❌
floor
String
❌
unit
String
❌
quantity
Number
❌
rate
Number
❌
amount
Number
❌
project_id
Integer
✅
boq_file
File
❌

Success Response (201)
{
  "boq_id": 1,
  "category": "Civil",
  "item_code": "C-101",
  "description": "Concrete work",
  "floor": "Ground",
  "unit": "Sq.m",
  "quantity": 100,
  "rate": 500,
  "amount": 50000,
  "boq_file": "/uploads/boq/boq-12345.pdf",
  "project_id": 2,
  "created_at": "2026-01-30T10:20:00Z"
}

Error Responses
400 – Invalid project_id
500 – Server error

2️⃣ Get All BOQs
GET /api/boq
Fetches all BOQ records.
Success Response (200)
[
  {
    "boq_id": 3,
    "category": "Electrical",
    "quantity": 50,
    "project_id": 1
  }
]


3️⃣ Get BOQ by ID
GET /api/boq/{id}
Fetches a single BOQ item using its ID.
Path Parameter
Name
Type
id
Integer

Success Response (200)
{
  "boq_id": 5,
  "category": "Plumbing",
  "amount": 20000
}

Error
404 – BOQ not found

4️⃣ Get BOQs by Project ID
GET /api/boq/project/{projectId}
Fetches all BOQ items for a specific project.
Path Parameter
Name
Type
projectId
Integer

Success Response (200)
[
  {
    "boq_id": 7,
    "category": "Finishing",
    "project_id": 4
  }
]


5️⃣ Update BOQ Item
PUT /api/boq/{id}
Updates one or more fields of a BOQ item.
Only provided fields will be updated.
Request Type
multipart/form-data
Updatable Fields
category
item_code
description
floor
unit
quantity
rate
amount
project_id
boq_file
Success Response (200)
{
  "boq_id": 5,
  "rate": 550,
  "amount": 55000
}

Errors
400 – No fields to update
404 – BOQ not found

6️⃣ Delete BOQ Item
DELETE /api/boq/{id}
Deletes a BOQ record and its uploaded file (if present).
Success Response (200)
{
  "message": "BOQ deleted successfully"
}

Errors
404 – BOQ not found
500 – Server error

📂 File Handling Notes
Files are stored in:
/uploads/boq
Max upload size: 50 MB
File is automatically deleted when BOQ is deleted
