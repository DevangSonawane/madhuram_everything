GET
/api/attendance/blocked-users
Get list of blocked users

Parameters
Cancel
No parameters

Execute
Responses
Code	Description	Links
200	
List of blocked users with absent count and block history

No links

PATCH
/api/attendance/unblock/{user_id}
Unblock a user

Parameters
Cancel
Name	Description
user_id *
string($uuid)
(path)
user_id
Request body

application/json
Edit Value
Schema
{
  "reason": "string",
  "performed_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "performed_by_name": "string"
}
Execute
Responses
Code	Description	Links
200	
User unblocked successfully

No links
404	
User not found

No links

PATCH
/api/attendance/block/{user_id}
Block a user

Parameters
Cancel
Name	Description
user_id *
string($uuid)
(path)
user_id
Request body

application/json
Edit Value
Schema
{
  "reason": "string",
  "performed_by": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "performed_by_name": "string"
}
Execute
Responses
Code	Description	Links
200	
User blocked successfully

No links
404	
User not found

No links

GET
/api/attendance/user/{user_id}/block-history
Get block history for a specific user

Parameters
Cancel
Name	Description
user_id *
string($uuid)
(path)
user_id
Execute
Responses
Code	Description	Links
200	
Block history for the user

No links
