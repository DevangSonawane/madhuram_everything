POST
/api/boq/lodha
Create a Lodha BOQ item

Creates a BOQ entry using the Lodha work order field layout: description, section, item_no, hsn, unit, qty, rate, amount.

These are mapped internally to the boqs table as:

description → description
section → category
item_no → item_no
hsn → item_code
qty → quantity
Parameters
Cancel
Reset
No parameters

Request body

multipart/form-data
description *
string
Description as per Lodha BOQ

string
section
string
Section as per Lodha BOQ

string
Send empty value
item_no
string
Item No as per Lodha BOQ

string
Send empty value
hsn
string
HSN/SAC code

string
Send empty value
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
Lodha BOQ item created

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "item_no": "1.01.1",
  "description": "string",
  "section": "string",
  "hsn": "995468",
  "unit": "SET",
  "qty": "1.000",
  "rate": "186000.00",
  "amount": "186000.00"
}
No links
400	
Missing required fields or invalid project_id

No links
500	
Server error

No links

POST
/api/boq/hiranandani
Create a Hiranandani BOQ item

Creates a BOQ entry using the Hiranandani work order field layout: description, section, item_no, sac_code, uom, order_qty, unit_price, value.

These are mapped internally to the boqs table as:

description → description
section → category
item_no → item_no
sac_code → item_code
order_qty → quantity
uom → unit
unit_price → rate
value → amount
Parameters
Cancel
Reset
No parameters

Request body

multipart/form-data
description *
string
Description as per Hiranandani BOQ

string
section
string
Section as per Hiranandani BOQ

string
Send empty value
item_no
string
Item No as per Hiranandani BOQ

string
Send empty value
sac_code
string
SAC Code

string
Send empty value
uom
string
Unit of measurement (e.g. NOS, AU, M)

string
Send empty value
order_qty
number
Order quantity

0
Send empty value
unit_price
number
Unit price

0
Send empty value
value
number
Total value (order_qty × unit_price)

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
Hiranandani BOQ item created

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "item_no": "1",
  "description": "string",
  "section": "string",
  "sac_code": "9954",
  "uom": "NOS",
  "order_qty": "340",
  "unit_price": "522.50",
  "value": "177650.00"
}
No links
400	
Missing required fields or invalid project_id

No links
500	
Server error