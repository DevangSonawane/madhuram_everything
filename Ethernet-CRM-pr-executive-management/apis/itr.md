📘 Madhuram API Documentation – ITR Module
Overview
The ITR (Inspection Test Request) API in Madhuram is used to:
upload ITR-related files
create a new ITR
fetch ITRs by project
fetch a single ITR
update an ITR partially
update only ITR status and inspection outcome
delete an ITR
log all major actions into the dashboard activity system
Base URL
/api/itr

Upload Directory
/uploads/itr


Main Features
Structured JSON-based ITR records
Linked references to:
project_id
po_id
mir_id
Rich nested sections:
project info
header
location
quantity
work items
shaft details
attachments
contractor part
PMC part
Activity log support via logActivity()

Data Structure
An ITR record contains these major sections:
Field
Type
Description
itr_id
integer
Unique ITR ID
project_id
integer
Linked project ID
po_id
integer/null
Linked PO ID
mir_id
integer/null
Linked MIR ID
project_info
object
Project-related information
itr_header
object
ITR header information
itr_ref_no
string/null
Extracted from itr_header.itr_ref_no
location
object
Tower/floor/grid/location details
discipline
string
Work discipline
quantity
object
Previous/current qty info
description_of_work
string
Work description
work_items
array
Work item entries
shaft_details
array
Shaft/staff details
attachments
object
Attached docs/checklists info
part_a_contractor
object
Contractor-side submission details
part_b_lodha_pmc
object
PMC-side comments and signoff
status
string
ITR workflow status
allowed_values
object
Config values for dropdowns / enums
created_at
datetime
Created timestamp
updated_at
datetime
Updated timestamp


Allowed Enum Values
Discipline
[
  "SURVEYING",
  "STRUCTURAL_CIVIL",
  "MECHANICAL",
  "ARCH_FINISHING",
  "ELECTRICAL",
  "LANDSCAPE",
  "PLUMBING",
  "FACADE",
  "OTHERS",
  "ID"
]

Status
[
  "DRAFT",
  "SUBMITTED",
  "UNDER_INSPECTION",
  "APPROVED",
  "REJECTED",
  "RESUBMITTED",
  "CLOSED"
]

Attachment Flags
["YES", "NO", "NA"]

Inspection Code
{
  "CODE_1": "Work may proceed",
  "CODE_2": "Conditionally approved. Work may proceed and resubmit incorporating comments",
  "CODE_3": "Revise and Resubmit. Work may NOT proceed",
  "CODE_4": "For information and records only. Work may proceed"
}


1) Upload ITR File
POST /api/itr/upload
Uploads one file for ITR.
Request Type
multipart/form-data
Form Fields
Field
Type
Required
file
file
Yes
user_id
integer
No
user_name
string
No

Success Response
{
  "filePath": "/uploads/itr/1710000000000-123456789.pdf"
}

Error Response
{
  "error": "No file uploaded"
}

Activity Log
If user_id is provided, backend logs:
action: "uploaded"
entity_type: "itr_file"

2) Create ITR
POST /api/itr
Creates a new ITR.
Required Fields
Field
Type
Required
project_id
integer
Yes

All other fields are optional.

Example Request Body
{
  "project_id": 5,
  "po_id": 10,
  "mir_id": 3,
  "project_info": {
    "project_name": "ANJUR CASA MAGNOLIA C PLUMBING",
    "project_code": "MAG-C-PL",
    "client_employer": "COWTOWN INFOTECH SERVICES PRIVATE LIMITED",
    "pmc_engineer": "John Engineer",
    "contractor": "MADHURAM ENTERPRISES",
    "vendor_code": "30010937",
    "material_code": "995462",
    "work_order_no": "6100019853"
  },
  "itr_header": {
    "itr_ref_no": "UT-WIR-EWS-MAG C-MADH-PL-32",
    "rev_no": "00",
    "submission_datetime": "2024-06-15T10:30:00+05:30",
    "inspection_datetime": "2024-06-16T09:00:00+05:30",
    "submitted_to": "LODHA PMC",
    "submitted_by": "MADHURAM ENTERPRISES"
  },
  "location": {
    "tower_block_ref": "MAGNOLIA C",
    "floor_level": "ALL FLR",
    "room_area_ref": "",
    "grid_reference": ""
  },
  "discipline": "PLUMBING",
  "quantity": {
    "previous_qty": 0,
    "current_qty": 153,
    "unit": "NOS"
  },
  "description_of_work": "CP INSTALLATION DONE",
  "work_items": [
    {
      "item_description": "UPVC BALL VALVE",
      "size": "20MM",
      "quantity": 11,
      "unit": "NOS"
    }
  ],
  "shaft_details": [
    {
      "shaft_no": 1,
      "staff_id": 1,
      "staff_name": "Ravi Kumar",
      "staff_number": "STF-001"
    }
  ],
  "attachments": {
    "drawing_attached": "NO",
    "drawing_ref_no": "",
    "method_statement_attached": "YES",
    "test_certificates_attached": "NO",
    "checklist_attached": "YES",
    "joint_measurement_attached": "NA"
  },
  "part_a_contractor": {
    "comments": "Work completed as per drawing.",
    "ready_for_inspection_date": "2024-06-15",
    "ready_for_inspection_time": "10:30",
    "signed_by": "MADHURAM ENTERPRISES",
    "other_section_signoffs": [
      {
        "section": "MEP Clearance",
        "name": "",
        "designation": "",
        "signed_date": "",
        "signature_url": "",
        "comments": ""
      }
    ]
  },
  "part_b_lodha_pmc": {
    "comments": "",
    "inspection_code": "",
    "signoffs": [
      {
        "role": "Engineer/Manager-CIVIL",
        "name": "",
        "signature_url": "",
        "signed_date": ""
      }
    ]
  },
  "status": "SUBMITTED",
  "allowed_values": {
    "discipline": [
      "SURVEYING",
      "STRUCTURAL_CIVIL",
      "MECHANICAL"
    ],
    "status": [
      "DRAFT",
      "SUBMITTED",
      "APPROVED"
    ],
    "attachments": ["YES", "NO", "NA"],
    "inspection_code": {
      "CODE_1": "Work may proceed"
    }
  },
  "user_id": 5,
  "user_name": "Aniket Jha"
}


Success Response
{
  "itr_id": 1,
  "project_id": 5,
  "po_id": 10,
  "mir_id": 3,
  "project_info": {...},
  "itr_header": {...},
  "itr_ref_no": "UT-WIR-EWS-MAG C-MADH-PL-32",
  "location": {...},
  "discipline": "PLUMBING",
  "quantity": {...},
  "description_of_work": "CP INSTALLATION DONE",
  "work_items": [...],
  "shaft_details": [...],
  "attachments": {...},
  "part_a_contractor": {...},
  "part_b_lodha_pmc": {...},
  "status": "SUBMITTED",
  "allowed_values": {...},
  "created_at": "2026-03-12T10:00:00.000Z"
}

Error Responses
400
{
  "error": "project_id is required"
}

500
{
  "error": "Internal server error message"
}


Activity Log
On success, backend logs:
action: "created"
entity_type: "itr"
entity_name = itr_ref_no if available, else ITR #{id}

3) Get All ITRs by Project
GET /api/itr/project/{projectId}
Returns all ITRs for a project.
Path Params
Param
Type
Required
projectId
integer
Yes

Success Response
[
  {
    "itr_id": 1,
    "project_id": 5,
    "itr_ref_no": "UT-WIR-EWS-MAG C-MADH-PL-32",
    "status": "SUBMITTED"
  }
]


4) Get Single ITR
GET /api/itr/{id}
Fetches a single ITR by itr_id.
Path Params
Param
Type
Required
id
integer
Yes

Success Response
Returns full ITR object.
Error Response
{
  "error": "ITR not found"
}


5) Update ITR
PUT /api/itr/{id}
Updates an existing ITR.
Only the fields sent in request body are updated.
Path Params
Param
Type
Required
id
integer
Yes

Request Body
Any subset of these fields may be sent:
po_id
mir_id
project_info
itr_header
location
discipline
quantity
description_of_work
work_items
shaft_details
attachments
part_a_contractor
part_b_lodha_pmc
status
allowed_values
user_id
user_name
Example Request
{
  "status": "UNDER_INSPECTION",
  "description_of_work": "Updated work description",
  "user_id": 5,
  "user_name": "Aniket Jha"
}

Success Response
{
  "itr_id": 1,
  "status": "UNDER_INSPECTION",
  "description_of_work": "Updated work description",
  "updated_at": "2026-03-12T11:00:00.000Z"
}

Error Responses
400
{
  "error": "No fields to update"
}

404
{
  "error": "ITR not found"
}


Special Update Behavior
If itr_header is included:
backend also updates itr_ref_no using:
itr_header.itr_ref_no


Activity Log
On success, backend logs:
action: "updated"
entity_type: "itr"

6) Update ITR Status Only
PATCH /api/itr/{id}/status
Updates only:
status
part_b_lodha_pmc.inspection_code
part_b_lodha_pmc.comments
This is the best endpoint for approval/rejection workflow.
Path Params
Param
Type
Required
id
integer
Yes

Request Body
{
  "status": "APPROVED",
  "inspection_code": "CODE_1",
  "lodha_pmc_comments": "Inspection passed. Work may proceed.",
  "user_id": 5,
  "user_name": "Aniket Jha"
}

Required
Field
Type
Required
status
string
Yes

Success Response
{
  "itr_id": 1,
  "status": "APPROVED",
  "part_b_lodha_pmc": {
    "inspection_code": "CODE_1",
    "comments": "Inspection passed. Work may proceed."
  },
  "updated_at": "2026-03-12T11:15:00.000Z"
}

Error Responses
400
{
  "error": "status is required"
}

404
{
  "error": "ITR not found"
}


Activity Log
On success, backend logs:
action: "status_updated"
entity_type: "itr"
Meta includes:
{
  "status": "APPROVED",
  "inspection_code": "CODE_1"
}


7) Delete ITR
DELETE /api/itr/{id}
Deletes an ITR.
Path Params
Param
Type
Required
id
integer
Yes

Optional Request Body
{
  "user_id": 5,
  "user_name": "Aniket Jha"
}

Success Response
{
  "message": "ITR deleted successfully"
}

Error Response
{
  "error": "ITR not found"
}


Activity Log
On success, backend logs:
action: "deleted"
entity_type: "itr"

JSON Section Formats
project_info
{
  "project_name": "",
  "project_code": "",
  "client_employer": "",
  "pmc_engineer": "",
  "contractor": "",
  "vendor_code": "",
  "material_code": "",
  "work_order_no": ""
}

itr_header
{
  "itr_ref_no": "",
  "rev_no": "",
  "submission_datetime": "",
  "inspection_datetime": "",
  "submitted_to": "",
  "submitted_by": ""
}

location
{
  "tower_block_ref": "",
  "floor_level": "",
  "room_area_ref": "",
  "grid_reference": ""
}

quantity
{
  "previous_qty": 0,
  "current_qty": 0,
  "unit": ""
}

work_items
[
  {
    "item_description": "",
    "size": "",
    "quantity": 0,
    "unit": ""
  }
]

shaft_details
[
  {
    "shaft_no": 1,
    "staff_id": 1,
    "staff_name": "",
    "staff_number": ""
  }
]

attachments
{
  "drawing_attached": "YES",
  "drawing_ref_no": "",
  "method_statement_attached": "YES",
  "test_certificates_attached": "NO",
  "checklist_attached": "YES",
  "joint_measurement_attached": "NA"
}

part_a_contractor
{
  "comments": "",
  "ready_for_inspection_date": "",
  "ready_for_inspection_time": "",
  "signed_by": "",
  "other_section_signoffs": [
    {
      "section": "",
      "name": "",
      "designation": "",
      "signed_date": "",
      "signature_url": "",
      "comments": ""
    }
  ]
}

part_b_lodha_pmc
{
  "comments": "",
  "inspection_code": "",
  "signoffs": [
    {
      "role": "",
      "name": "",
      "signature_url": "",
      "signed_date": ""
    }
  ]
}


Frontend Integration Flow
Flow 1 — Upload file
Use:
POST /api/itr/upload

Store returned:
{
  "filePath": "/uploads/itr/..."
}

You can save this inside:
attachments
signoff signature_url
supporting docs object in your form state

Flow 2 — Create draft ITR
Use:
POST /api/itr

with:
{
  "project_id": 5,
  "status": "DRAFT"
}

Then progressively fill remaining sections.

Flow 3 — Edit ITR
Use:
PUT /api/itr/{id}

for regular section updates.

Flow 4 — Approval workflow
Use:
PATCH /api/itr/{id}/status

for:
SUBMITTED
UNDER_INSPECTION
APPROVED
REJECTED
RESUBMITTED
CLOSED
This endpoint is ideal for PMC review action.

Flow 5 — Project listing
Use:
GET /api/itr/project/{projectId}


Quick Endpoint Summary
Method
Endpoint
Purpose
POST
/api/itr/upload
Upload ITR file
POST
/api/itr
Create ITR
GET
/api/itr/project/:projectId
Get all ITRs for project
GET
/api/itr/:id
Get one ITR
PUT
/api/itr/:id
Update ITR
PATCH
/api/itr/:id/status
Update status only
DELETE
/api/itr/:id
Delete ITR


Notes for Frontend Developer
All nested sections are stored as JSON in DB
itr_ref_no is derived automatically from itr_header.itr_ref_no
PUT supports partial updates
PATCH /status should be used for approval workflow instead of full PUT
Upload endpoint can optionally log activity if user_id is passed
Create/update/delete/status update all trigger dashboard activity logs

If you want, I can also make this into a frontend integration prompt for your developer in the same style as your dashboard/posts/vendor-price-list prompts.

