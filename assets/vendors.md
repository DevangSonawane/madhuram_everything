Vendors
Vendor management



POST
/api/vendors
Create a new vendor

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "vendor_name": "string",
  "vendor_company_name": "string",
  "vendor_email": "string",
  "mobile_number": "string",
  "location": "string",
  "status": "active"
}
Execute
Responses
Code	Description	Links
201	
Vendor created successfully

No links
500	
Internal server error

No links

GET
/api/vendors
Get all vendors

Parameters
Cancel
No parameters

Execute
Responses
Code	Description	Links
200	
List of vendors

No links
500	
Internal server error

No links

GET
/api/vendors/search
Search vendors by name (partial match, case-insensitive)

Parameters
Cancel
Name	Description
name *
string
(query)
Vendor name to search for

name
Execute
Responses
Code	Description	Links
200	
Matching vendors

No links
500	
Internal server error

No links

GET
/api/vendors/{id}
Get a single vendor by ID

Parameters
Cancel
Name	Description
id *
integer
(path)
id
Execute
Responses
Code	Description	Links
200	
Vendor details

No links
404	
Vendor not found

No links
500	
Internal server error

No links

PUT
/api/vendors/{id}
Update an existing vendor

Parameters
Cancel
Name	Description
id *
integer
(path)
id
Request body

application/json
Edit Value
Schema
{
  "vendor_name": "string",
  "vendor_company_name": "string",
  "vendor_email": "string",
  "mobile_number": "string",
  "location": "string",
  "status": "active"
}
Execute
Responses
Code	Description	Links
200	
Vendor updated successfully

No links
404	
Vendor not found

No links
500	
Internal server error

No links

DELETE
/api/vendors/{id}
Delete a vendor

Parameters
Cancel
Name	Description
id *
integer
(path)
id
Execute
Responses
Code	Description	Links
200	
Vendor deleted successfully

No links
404	
Vendor not found

No links
500	
Internal server error

No links

PATCH
/api/vendors/{id}/status
Update vendor status

Parameters
Cancel
Name	Description
id *
integer
(path)
id
Request body

application/json
Edit Value
Schema
{
  "status": "active"
}
Execute
Responses
Code	Description	Links
200	
Vendor status updated successfully

No links
404	
Vendor not found

No links
500	
Internal server error

No links
