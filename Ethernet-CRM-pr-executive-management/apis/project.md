Madhuram Project API Documentation
Base URL
Production (recommended):
 https://api.madhuram.enterprises
Common Notes:
Content-Type: application/json


Token Authentication: The API uses JWT tokens for authentication. On successful login/signup, you'll receive a JWT token, which you should use in the Authorization header for all authenticated requests.



1) Create a New Project
Endpoint: POST /api/projects


Description: Create a new project and upload files.


Request Body: multipart form data 


{
    "project_id": 1,
    "project_name": "Lodha",
    "project_startdate": "2026-01-26T00:00:00.000Z",
    "client_name": "AS",
    "location": "asdd",
    "floor": "sad",
    "estimate_value": "xas",
    "wo_number": "asd",
    "work_order_file": "work_order_file-1769518178550-743418190.docx",
    "pr_po_tracking": [
        "ad"
    ],
    "samples": [
        "ad"
    ],
    "mas_file": "mas_file-1769518178553-870616482.docx",
    "ml_management": [
        "asda"
    ],
    "user_id": "c9c7d500-5728-4b82-bb96-d683ad781082",
    "created_at": "2026-01-27T12:49:22.909Z",
    "updated_at": "2026-01-27T12:49:38.578Z"
}


Response (201):


{
  "project_id": 1,
  "project_name": "Project A",
  "product_duration": "2022-12-31",
  "client_name": "Client A",
  "work_order_file": "work_order_file-16345312.pdf",
  "work_order_information": "Work order details",
  "pr_po_tracking": ["PO123", "PO124"],
  "samples": ["sample1", "sample2"],
  "mas_file": "mas_file-16345312.pdf",
  "ml_management": {
    "ml_task": "task details"
  },
  "created_at": "2022-12-01T12:00:00",
  "updated_at": "2022-12-01T12:00:00"
}

Error Responses:


400 Missing fields: { "error": "Missing required fields" }


400 Invalid file: { "error": "Invalid file format" }


500 Server error: { "error": "Failed to create project" }



2) Get All Projects
Endpoint: GET /api/projects


Description: Retrieve all the projects.


Response (200):


[
  {
    "project_id": 1,
    "project_name": "Project A",
    "product_duration": "2022-12-31",
    "client_name": "Client A",
    "work_order_file": "work_order_file-16345312.pdf",
    "work_order_information": "Work order details",
    "pr_po_tracking": ["PO123", "PO124"],
    "samples": ["sample1", "sample2"],
    "mas_file": "mas_file-16345312.pdf",
    "ml_management": {
      "ml_task": "task details"
    },
    "created_at": "2022-12-01T12:00:00",
    "updated_at": "2022-12-01T12:00:00"
  }
]


3) Get Project by ID
Endpoint: GET /api/projects/{id}


Description: Retrieve a specific project by its ID.


Response (200):


{
  "project_id": 1,
  "project_name": "Project A",
  "product_duration": "2022-12-31",
  "client_name": "Client A",
  "work_order_file": "work_order_file-16345312.pdf",
  "work_order_information": "Work order details",
  "pr_po_tracking": ["PO123", "PO124"],
  "samples": ["sample1", "sample2"],
  "mas_file": "mas_file-16345312.pdf",
  "ml_management": {
    "ml_task": "task details"
  },
  "created_at": "2022-12-01T12:00:00",
  "updated_at": "2022-12-01T12:00:00"
}

Error Response (404): { "error": "Project not found" }



4) Update a Project
Endpoint: PUT /api/projects/{id}


Description: Update an existing project by its ID. Allows updating project details and file uploads.


Request Body:


{
  "project_name": "Updated Project Name",
  "product_duration": "2023-12-31",
  "client_name": "Updated Client Name",
  "work_order_information": "Updated Work order details",
  "pr_po_tracking": ["PO567", "PO568"],
  "samples": ["sample3", "sample4"],
  "mas_file": "<file>",
  "ml_management": {
    "ml_task": "updated task details"
  }
}

Response (200):


{
  "project_id": 1,
  "project_name": "Updated Project Name",
  "product_duration": "2023-12-31",
  "client_name": "Updated Client Name",
  "work_order_file": "work_order_file-16345312.pdf",
  "work_order_information": "Updated Work order details",
  "pr_po_tracking": ["PO567", "PO568"],
  "samples": ["sample3", "sample4"],
  "mas_file": "mas_file-16345312.pdf",
  "ml_management": {
    "ml_task": "updated task details"
  },
  "created_at": "2022-12-01T12:00:00",
  "updated_at": "2023-12-01T12:00:00"
}


5) Delete a Project
Endpoint: DELETE /api/projects/{id}


Description: Delete a project by its ID.


Response (200):


{
  "message": "Project deleted successfully"
}

Error Response (404): { "error": "Project not found" }



6) File Access via URL
Once the files are uploaded, they are stored in the uploads directory on your VPS. The uploaded files can be accessed publicly via the following URL:
URL Format:
 https://api.madhuram.enterprises/uploads/{filename}
7) Compression api
Endpoint: POST /api/compress


Description:Compress the uploaded file.
Request Body:- multipart/formdata upload file 
File String


Response (200):


{
  "original_size": "string",
  "compressed_size": "string",
  "url": "string",
  "message": "string"
}


Error Response (404):Bad Request
Server Error (500)
