📘 Madhuram API Documentation – Sample Module
Overview
The Sample API in Madhuram is used to:
Upload multiple sample files
Create a sample record
Fetch samples (all / by id / by project)
Update a sample
Delete a sample
✅ Base URL: /api/sample
✅ Upload Base Path: /uploads/sample/
✅ Table: samples
✅ JSON fields stored in DB:
location (object)
item_description (array)
add_fields (array)

📦 Sample Schema
Sample Object
Field
Type
Notes
sample_id
integer
Primary key
project_id
integer
FK to projects
building_name
string
Building name
site_name
string
Site name
location
object
Address object
work_done
string
Work description
item_description
array(object)
List of items with optional extra fields
add_fields
array(object)
Extra key-value fields
sample_file
string
Optional file path
created_at
datetime
Created time
updated_at
datetime
Updated time


✅ Endpoints

1) Upload Multiple Files
POST /api/sample/upload
Uploads multiple files under the key file and returns an array of stored paths.
Content-Type: multipart/form-data
Form Data
Key
Type
Required
file
file[]
✅

Success Response (200)
{
  "filePaths": [
    "/uploads/sample/1700000000-123456789.pdf",
    "/uploads/sample/1700000001-987654321.jpg"
  ]
}

Error Response (400)
{ "error": "No files uploaded" }

✅ Use these returned paths in your frontend to store/link files (example: save one path to sample_file, or store in a custom field if you want multiple).

2) Create Sample Record
POST /api/sample/create-sample
Creates a new sample entry in DB.
Content-Type: application/json
Request Body
Field
Type
Required
project_id
integer
✅
building_name
string
❌
site_name
string
❌
location
object
❌
work_done
string
❌
item_description
array
❌ (default [])
add_fields
array
❌ (default [])

location object format
{
  "address_line1": "Line 1",
  "address_line2": "Line 2",
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India"
}

item_description format
[
  {
    "sr_no": 1,
    "description": "Item name",
    "quantity": 10,
    "value": 1000,
    "add_fields": [
      { "key": "Brand", "value": "ABC" }
    ]
  }
]

add_fields format
[
  { "key": "Remark", "value": "Urgent" }
]

Example Request
{
  "project_id": 10,
  "building_name": "Tower A",
  "site_name": "Madhuram Site",
  "location": {
    "address_line1": "Street 1",
    "city": "Mumbai",
    "state": "MH",
    "country": "India"
  },
  "work_done": "Wall painting",
  "item_description": [
    {
      "sr_no": 1,
      "description": "Paint work",
      "quantity": 5,
      "value": 2000,
      "add_fields": [{ "key": "Color", "value": "White" }]
    }
  ],
  "add_fields": [{ "key": "Status", "value": "Approved" }]
}

Success Response (201)
Returns created record:
{
  "sample_id": 1,
  "project_id": 10,
  "building_name": "Tower A",
  "site_name": "Madhuram Site",
  "location": { "city": "Mumbai" },
  "work_done": "Wall painting",
  "item_description": [],
  "add_fields": [],
  "created_at": "2026-02-18T10:00:00.000Z"
}

Error Responses
400 Invalid project_id:
{ "error": "Invalid project_id: Project does not exist" }

500 Internal server error:
{ "error": "Internal Server Error" }


3) Get All Samples
GET /api/sample
Fetches all sample records.
Success Response (200)
[
  {
    "sample_id": 1,
    "project_id": 10,
    "building_name": "Tower A",
    "created_at": "2026-02-18T10:00:00.000Z"
  }
]


4) Get Sample by ID
GET /api/sample/{id}
Path Param
Param
Type
Required
id
integer
✅

Success Response (200)
Returns one record.
Error Response (404)
{ "error": "Sample not found" }


5) Get Samples by Project ID
GET /api/sample/project/{projectId}
Path Param
Param
Type
Required
projectId
integer
✅

Success Response (200)
Returns list of samples for that project.

6) Update Sample
PUT /api/sample/{id}
Updates any fields. Uses COALESCE, so only provided values are changed.
✅ Auto sets updated_at.
Content-Type: application/json
Request Body (Optional Fields)
Field
Type
building_name
string
site_name
string
location
object
work_done
string
item_description
array
add_fields
array
sample_file
string

Example Request
{
  "work_done": "Painting completed",
  "sample_file": "/uploads/sample/1700000001-987654321.jpg"
}

Success (200)
Returns updated record.
Error (404)
{ "error": "Sample not found" }


7) Delete Sample
DELETE /api/sample/{id}
Deletes sample record.
Success Response (200)
{ "message": "Sample deleted successfully" }

Error Response (404)
{ "error": "Sample not found" }


✅ Notes (Important)
Upload returns multiple file paths, but DB has single sample_file field.
If you want multiple attachments per sample, change DB column to sample_files JSONB.
Delete endpoint does not delete uploaded files from disk.

