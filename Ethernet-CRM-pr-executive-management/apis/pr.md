Madhuram PR API Documentation
The PR (Purchase Requisition) API is used for managing PR requests, including file uploads, item management, and status updates.

Base URL:
/api/pr

Endpoints Summary
Upload PR File
POST /api/pr/upload
Upload Signature for PR
POST /api/pr/upload-signature
Create PR
POST /api/pr
Get All PRs
GET /api/pr
Get PR by Project
GET /api/pr/project/{projectId}
Get PR by Sample
GET /api/pr/sample/{sampleId}
Get Single PR by ID
GET /api/pr/{id}
Update PR
PUT /api/pr/{id}
Delete PR
DELETE /api/pr/{id}

1) Upload PR File
POST /api/pr/upload
Description:
Uploads the PR document.
Request Body (Form-data):
file (required): The file to upload.
Success Response:
{
  "filePath": "/uploads/pr/1710000000000-123456789.pdf"
}

Error Response:
{
  "error": "No file uploaded"
}


2) Upload Signature for PR
POST /api/pr/upload-signature
Description:
Uploads an authorized signature for the PR.
Request Body (Form-data):
file (required): The signature file to upload.
Success Response:
{
  "filePath": "/uploads/pr_signatures/1710000000000-987654321.jpg"
}

Error Response:
{
  "error": "No file uploaded"
}


3) Create PR
POST /api/pr
Description:
Creates a new PR entry. If an item includes `inventory_id`, the backend auto stock-outs that inventory item.
Request Body (JSON):
{
  "project_id": 117,
  "project_name": "PQR",
  "sample_id": "string",
  "pr_number": "string",
  "workorder_no": "string",
  "location": "string",
  "mirno": "string",
  "urgency": "string",
  "floor_no": "string",
  "flat_no": "string",
  "date": "2026-07-18",
  "items": [
    {
      "material_description": "string",
      "unit": "string",
      "req_qty": 0,
      "make": "string",
      "place_of_utilisation": "string",
      "inventory_id": 0,
      "issued_qty": 0,
      "boq_id": 0,
      "boq_qty": 0,
      "item_no": "string"
    }
  ]
}

Success Response:
{
  "pr_id": 1,
  "project_id": 117,
  "project_name": "PQR",
  "sample_id": "string",
  "pr_number": "string",
  "workorder_no": "string",
  "location": "string",
  "mirno": "string",
  "urgency": "string",
  "floor_no": "string",
  "flat_no": "string",
  "date": "2026-07-18",
  "items": [
    {
      "pr_item_id": 1,
      "material_description": "string",
      "unit": "string",
      "req_qty": 0,
      "make": "string",
      "place_of_utilisation": "string",
      "inventory_id": 0,
      "issued_qty": 0,
      "boq_id": 0,
      "boq_qty": 0,
      "item_no": "string"
    }
  ]
}

Error Responses:
400 - Missing required fields or invalid input.
{
  "error": "project_id and project_name are required"
}


4) Get All PRs
GET /api/pr
Description:
Fetches all PRs in the system.
Success Response:
[
  {
    "pr_id": 1,
    "project_id": 5,
    "project_name": "Project Name",
    "workorder_no": "12345",
    "location": "Location",
    "mirno": "98765",
    "urgency": "High",
    "date": "2024-04-01",
    "approved_by": "Manager",
    "pr_file_path": "/uploads/pr/file.pdf",
    "signature_file_path": "/uploads/pr_signatures/signature.jpg",
    "items": [...]
  },
  {
    "pr_id": 2,
    "project_id": 6,
    "project_name": "Another Project",
    "workorder_no": "12346",
    "location": "Location 2",
    "mirno": "98766",
    "urgency": "Medium",
    "date": "2024-04-02",
    "approved_by": "Manager 2",
    "pr_file_path": "/uploads/pr/file2.pdf",
    "signature_file_path": "/uploads/pr_signatures/signature2.jpg",
    "items": [...]
  }
]

Error Response:
{
  "error": "Internal server error"
}


5) Get PRs by Project ID
GET /api/pr/project/{projectId}
Description:
Fetches all PRs related to a specific project.
Path Parameters:
projectId: The ID of the project.
Success Response:
[
  {
    "pr_id": 1,
    "project_id": 5,
    "project_name": "Project Name",
    "workorder_no": "12345",
    "location": "Location",
    "mirno": "98765",
    "urgency": "High",
    "date": "2024-04-01",
    "approved_by": "Manager",
    "pr_file_path": "/uploads/pr/file.pdf",
    "signature_file_path": "/uploads/pr_signatures/signature.jpg",
    "items": [...]
  }
]

Error Response:
{
  "error": "Internal server error"
}


6) Get PR by Sample ID
GET /api/pr/sample/{sampleId}
Description:
Fetches all PRs related to a specific sample.
Path Parameters:
sampleId: The sample ID.
Success Response:
[
  {
    "pr_id": 1,
    "project_id": 5,
    "project_name": "Project Name",
    "workorder_no": "12345",
    "location": "Location",
    "mirno": "98765",
    "urgency": "High",
    "date": "2024-04-01",
    "approved_by": "Manager",
    "pr_file_path": "/uploads/pr/file.pdf",
    "signature_file_path": "/uploads/pr_signatures/signature.jpg",
    "items": [...]
  }
]

Error Response:
{
  "error": "Internal server error"
}


7) Get Single PR by ID
GET /api/pr/{id}
Description:
Fetches a specific PR by its ID.
Path Parameters:
id: The ID of the PR.
Success Response:
{
  "pr_id": 1,
  "project_id": 5,
  "project_name": "Project Name",
  "workorder_no": "12345",
  "location": "Location",
  "mirno": "98765",
  "urgency": "High",
  "date": "2024-04-01",
  "approved_by": "Manager",
  "pr_file_path": "/uploads/pr/file.pdf",
  "signature_file_path": "/uploads/pr_signatures/signature.jpg",
  "items": [...]
}

Error Response:
{
  "error": "PR not found"
}


8) Update PR
PUT /api/pr/{id}
Description:
Updates a specific PR by its ID.
Path Parameters:
id: The ID of the PR.
Request Body (JSON):
{
  "project_name": "Updated Project Name",
  "workorder_no": "12346",
  "location": "New Location",
  "items": [
    {
      "material_description": "New Material",
      "unit": "KG",
      "req_qty": 15,
      "make": "New Make",
      "place_of_utilisation": "New Place"
    }
  ]
}

Success Response:
{
  "pr_id": 1,
  "project_name": "Updated Project Name",
  "workorder_no": "12346",
  "location": "New Location",
  "items": [...]
}

Error Response:
{
  "error": "PR not found"
}


9) Delete PR
DELETE /api/pr/{id}
Description:
Deletes a specific PR by its ID.
Path Parameters:
id: The ID of the PR.
Success Response:
{
  "message": "PR deleted successfully"
}

Error Response:
{
  "error": "PR not found"
}


Activity Logging
For most operations (upload, create, update, delete), the Madhuram PR API logs the activity using the logActivity function, which includes:
action type (created, updated, deleted, uploaded)
entity type (pr_file, pr_signature, pr)
entity name (e.g., PR ID or file name)
performed by (user ID and name)
project ID or sample ID as context
