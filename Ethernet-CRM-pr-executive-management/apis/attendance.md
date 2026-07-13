Attendance
Attendance management API



POST
/api/attendance/upload
Upload an image for attendance (selfie or site photo)

Parameters
Try it out
No parameters
Request body

file
string($binary)
Responses
Code	Description	Links
200	
File uploaded successfully
Media type

Controls Accept header.
Example Value
Schema
{
  "filePath": "string"
}
No links
400	
No file uploaded
No links

POST
/api/attendance
Create a new attendance record

Parameters
Try it out
No parameters
Request body

Example Value
Schema
{
  "photo_selfie": "string",
  "photo_site": "string",
  "location": "string",
  "latitude": 0,
  "longitude": 0,
  "user_name": "string",
  "phone_number": "string",
  "date": "2026-03-27",
  "day": "string",
  "project_id": 0,
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
Responses
Code	Description	Links
201	
Attendance record created
No links
500	
Server error
No links

GET
/api/attendance
Get all attendance records

Parameters
Try it out
No parameters
Responses
Code	Description	Links
200	
List of attendance records
Media type

Controls Accept header.
Example Value
Schema
[
  {
    "attendance_id": 0,
    "photo_selfie": "string",
    "photo_site": "string",
    "location": "string",
    "latitude": 0,
    "longitude": 0,
    "user_name": "string",
    "phone_number": "string",
    "date": "2026-03-27",
    "day": "string",
    "project_id": 0,
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "pending",
    "created_at": "2026-03-27T08:44:35.117Z",
    "updated_at": "2026-03-27T08:44:35.117Z"
  }
]
No links

GET
/api/attendance/project/{project_id}
Get all attendance records for a specific project

Parameters
Try it out
Name	Description
project_id *
integer
(path)
Project ID

Responses
Code	Description	Links
200	
List of attendance records for the project
No links

GET
/api/attendance/user/{user_id}
Get all attendance records for a specific user

Parameters
Try it out
Name	Description
user_id *
string($uuid)
(path)
User ID

Responses
Code	Description	Links
200	
List of attendance records for the user
No links

GET
/api/attendance/{id}
Get an attendance record by ID

Parameters
Try it out
Name	Description
id *
integer
(path)

Responses
Code	Description	Links
200	
Attendance record
No links
404	
Record not found
No links

PUT
/api/attendance/{id}
Update an attendance record

Parameters
Try it out
Name	Description
id *
integer
(path)

Request body

Example Value
Schema
{
  "attendance_id": 0,
  "photo_selfie": "string",
  "photo_site": "string",
  "location": "string",
  "latitude": 0,
  "longitude": 0,
  "user_name": "string",
  "phone_number": "string",
  "date": "2026-03-27",
  "day": "string",
  "project_id": 0,
  "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "pending",
  "created_at": "2026-03-27T08:44:35.100Z",
  "updated_at": "2026-03-27T08:44:35.100Z"
}
Responses
Code	Description	Links
200	
Attendance record updated
No links

DELETE
/api/attendance/{id}
Delete an attendance record

Parameters
Try it out
Name	Description
id *
integer
(path)

Responses
Code	Description	Links
200	
Attendance record deleted
No links

PATCH
/api/attendance/{id}/status
Update attendance status (present/absent)

Parameters
Try it out
Name	Description
id *
integer
(path)
Attendance ID

Request body

Example Value
Schema
{
  "status": "present"
}
Responses
Code	Description	Links
200	
Status updated successfully
No links
400	
Invalid status
No links
404	
Record not found
No links
500	
Server error