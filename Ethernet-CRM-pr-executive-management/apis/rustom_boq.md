POST
/api/boq/rustomjee
Create a Rustomjee BOQ item

Creates a BOQ entry using the Rustomjee work order field layout: sr_no, description, unit, qty, rate, amount.

These are mapped internally to the boqs table as:

sr_no → item_no
description → description
unit → unit
qty → quantity
rate → rate
amount → amount
Parameters
Cancel
Reset
No parameters

Request body

multipart/form-data
sr_no
string
Sr No as per Rustomjee BOQ

string
Send empty value
description *
string
Description as per Rustomjee BOQ

string
unit
string
Unit of measurement

string
Send empty value
qty
number
Quantity

0
Send empty value
rate
number
Rate per unit

0
Send empty value
amount
number
Total amount

0
Send empty value
project_id *
integer
Project ID (required)

0
project_name
string
string
Send empty value
floor
string
string
Send empty value
boq_file
string($binary)
No file chosen
Send empty value
Execute
Responses
Code	Description	Links
201	
Rustomjee BOQ item created

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "sr_no": "1",
  "description": "string",
  "unit": "Sqft",
  "qty": "150.00",
  "rate": "120.00",
  "amount": "18000.00"
}
No links
400	
Missing required fields or invalid project_id

No links
500	
Server error

No links
