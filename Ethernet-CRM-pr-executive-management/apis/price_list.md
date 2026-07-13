📘 Madhuram API Documentation – Vendor Price List Module
Overview
The Vendor Price List API in Madhuram is used to manage vendor price list files, versions, items, and history.
It supports:
Uploading a price list file
Creating a new vendor price list with items
Fetching all price lists for a vendor
Fetching a single price list with all items
Updating a price list and replacing its items
Deleting a price list
Updating only the status of a price list
✅ Base URL: /api/vendor-price-list
✅ Upload Folder: /uploads/price_lists
✅ Related Tables:
vendor_price_lists
vendor_price_list_items
vendors

Data Model
Vendor Price List
Field
Type
Description
price_list_id
integer
Unique price list ID
vendor_id
integer
Linked vendor ID
version_name
string
Version label for the price list
status
string
active, inactive, or archived
file_path
string
Uploaded file path
created_at
datetime
Created timestamp
updated_at
datetime
Updated timestamp

Vendor Price List Item
Field
Type
Description
item_id
integer
Unique item ID
price_list_id
integer
Parent price list ID
items_name
string
Item name
hsn_code
string
HSN code
item_code
string
Item code
category
string
Category
product_name
string
Product name
size_inch
string
Size in inch
size_mm
string
Size in mm
price_per_pic
number
Price per piece
discount_price
number
Discounted price
net_price
number
Net price


1) Upload Price List File
POST /api/vendor-price-list/upload
Uploads a file for a vendor price list.
Request Type
multipart/form-data
Form Field
Field
Type
Required
file
file
Yes

Success Response
{
  "success": true,
  "filename": "1710000000000-123456789.xlsx",
  "filePath": "/uploads/price_lists/1710000000000-123456789.xlsx"
}

Error Response
{
  "error": "No file uploaded"
}

Frontend Note
Use either:
filename in create API, or
directly pass filePath if your backend/UI logic prefers storing full path.

2) Get All Price Lists for a Vendor
GET /api/vendor-price-list/vendor/{vendorId}
Returns all price lists for a specific vendor, sorted by latest first.
Path Param
Name
Type
Required
vendorId
integer
Yes

Success Response
[
  {
    "price_list_id": 1,
    "vendor_id": 20,
    "version_name": "April 2026",
    "status": "active",
    "file_path": "/uploads/price_lists/file1.xlsx",
    "created_at": "2026-03-09T10:00:00.000Z"
  }
]


3) Get One Price List with Items
GET /api/vendor-price-list/{id}
Returns a single price list and all its items.
Path Param
Name
Type
Required
id
integer
Yes

Success Response
{
  "price_list_id": 1,
  "vendor_id": 20,
  "version_name": "April 2026",
  "status": "active",
  "file_path": "/uploads/price_lists/file1.xlsx",
  "created_at": "2026-03-09T10:00:00.000Z",
  "items": [
    {
      "item_id": 1,
      "price_list_id": 1,
      "items_name": "Tile A",
      "hsn_code": "6907",
      "item_code": "TILE001",
      "category": "Tiles",
      "product_name": "Glossy Tile",
      "size_inch": "12x12",
      "size_mm": "300x300",
      "price_per_pic": 100,
      "discount_price": 90,
      "net_price": 85
    }
  ]
}

Error Response
{
  "error": "Price list not found"
}


4) Create New Vendor Price List
POST /api/vendor-price-list
Creates a new price list and bulk inserts its items.
Request Body
{
  "vendor_id": 20,
  "version_name": "April 2026",
  "status": "active",
  "filename": "1710000000000-123456789.xlsx",
  "items": [
    {
      "items_name": "Tile A",
      "hsn_code": "6907",
      "item_code": "TILE001",
      "category": "Tiles",
      "product_name": "Glossy Tile",
      "SIZE_INCH": "12x12",
      "SIZE_MM": "300x300",
      "price_per-pic": 100,
      "discountprice": 90,
      "net_price": 85
    }
  ]
}

Required Fields
Field
Type
Required
vendor_id
integer
Yes
items
array
Yes for actual item insertion, though backend only hard-checks vendor_id

Notes
filename can be:
a raw filename from upload API, or
a full /uploads/... path
If only filename is passed, backend converts it to:
/uploads/price_lists/{filename}
Success Response
{
  "message": "Price list created successfully",
  "price_list": {
    "price_list_id": 1,
    "vendor_id": 20,
    "version_name": "April 2026",
    "status": "active",
    "file_path": "/uploads/price_lists/1710000000000-123456789.xlsx"
  },
  "items_count": 1
}

Error Responses
{
  "error": "vendor_id is required"
}

or
{
  "error": "some database error"
}

Important Backend Behavior
After creating the price list:
its price_list_id is appended to vendors.price_list_ids

5) Update Existing Price List
PUT /api/vendor-price-list/{id}
Updates price list header fields and optionally replaces all existing items.
Path Param
Name
Type
Required
id
integer
Yes

Request Body
{
  "version_name": "May 2026",
  "status": "inactive",
  "items": [
    {
      "items_name": "Tile B",
      "hsn_code": "6908",
      "item_code": "TILE002",
      "category": "Tiles",
      "product_name": "Matte Tile",
      "SIZE_INCH": "24x24",
      "SIZE_MM": "600x600",
      "price_per-pic": 120,
      "discountprice": 110,
      "net_price": 100
    }
  ]
}

Update Logic
version_name and status are updated if provided
If items is provided as an array:
all existing items for that price list are deleted
the new items are bulk inserted
Success Response
{
  "message": "Price list updated successfully",
  "price_list": {
    "price_list_id": 1,
    "vendor_id": 20,
    "version_name": "May 2026",
    "status": "inactive"
  }
}

Error Response
{
  "error": "Price list not found"
}


6) Delete Price List
DELETE /api/vendor-price-list/{id}
Deletes a price list and tries to remove its uploaded file from disk.
Path Param
Name
Type
Required
id
integer
Yes

Success Response
{
  "message": "Price list deleted successfully"
}

Error Response
{
  "error": "Price list not found"
}

Important Note
This route:
deletes the DB record
attempts to delete the associated file if file_path exists

7) Update Price List Status Only
PATCH /api/vendor-price-list/{id}/status
Updates only the status of a price list.
Allowed Status Values
active
inactive
archived
Request Body
{
  "status": "archived"
}

Success Response
{
  "message": "Status updated successfully",
  "price_list": {
    "price_list_id": 1,
    "vendor_id": 20,
    "version_name": "April 2026",
    "status": "archived"
  }
}

Error Responses
Invalid status:
{
  "error": "Invalid status. Allowed values are: active, inactive, archived"
}

Not found:
{
  "error": "Price list not found"
}


Item Input Mapping Rules
Your backend supports multiple key styles while inserting items.
Accepted request keys
Accepted Key
Stored As
items_name
items_name
hsn_code
hsn_code
item_code
item_code
category
category
product_name
product_name
SIZE_INCH or size_inch
size_inch
SIZE_MM or size_mm
size_mm
price_per-pic or price_per_pic
price_per_pic
discountprice or discount_price
discount_price
net_price
net_price

This is very useful if frontend is reading Excel/CSV headers directly.

Suggested Frontend Flow
Flow A — Upload file + create price list
Upload file using:
POST /api/vendor-price-list/upload
Get response:
filename
filePath
Parse/import items in frontend
Create price list using:
POST /api/vendor-price-list
Example frontend payload
{
  "vendor_id": 20,
  "version_name": "April 2026",
  "status": "active",
  "filename": "1710000000000-123456789.xlsx",
  "items": [...]
}


Flow B — Fetch vendor history
Use:
GET /api/vendor-price-list/vendor/{vendorId}

Show:
version name
status
file path
created date

Flow C — Open one price list in detail
Use:
GET /api/vendor-price-list/{id}

Render:
price list header
full item table

Flow D — Change only status
Use:
PATCH /api/vendor-price-list/{id}/status

Useful for:
activating latest version
archiving old versions

Quick Endpoint Summary
Method
Endpoint
Purpose
POST
/api/vendor-price-list/upload
Upload price list file
GET
/api/vendor-price-list/vendor/:vendorId
Get all price lists of a vendor
GET
/api/vendor-price-list/:id
Get one price list with items
POST
/api/vendor-price-list
Create new price list
PUT
/api/vendor-price-list/:id
Update price list and replace items
DELETE
/api/vendor-price-list/:id
Delete price list
PATCH
/api/vendor-price-list/:id/status
Update price list status only


Frontend Notes
Backend supports large item lists through bulk insert in batches of 1000
On PUT, if items is passed, old items are fully replaced
Use PATCH /status for lightweight status updates instead of full PUT
For file preview/download, frontend can use:
returned filePath
prepend domain if needed
Example:
const fullUrl = `${BASE_URL}${filePath}`;


