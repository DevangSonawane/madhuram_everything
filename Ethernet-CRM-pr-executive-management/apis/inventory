📘 Madhuram API Documentation – Inventory Module (Updated Version)
Overview
The Inventory API in Madhuram is used to manage project inventory items.
It supports:
Create inventory item
Get all inventory items
Get inventory item by ID
Get inventory items by project
Update inventory item
Delete inventory item
Update only stockin status
Update only billing status
✅ Base URL: /api/inventory
✅ Database Table: inventories

Inventory Object Schema
Field
Type
Description
inventory_id
integer
Unique inventory ID
project_id
integer
Linked project ID
brand
string
Brand name
quantity
number
Quantity of item
name
string
Inventory item name
price
number
Price of item
stockin
boolean
Stock-in status
billing
boolean
Billing status
created_at
string (date-time)
Created timestamp
updated_at
string (date-time)
Updated timestamp


1) Create Inventory Item
POST /api/inventory
Creates a new inventory item.
Request Body
{
  "project_id": 1,
  "brand": "Asian Paints",
  "quantity": 50,
  "name": "Wall Paint",
  "price": 1200,
  "stockin": true,
  "billing": false
}

Success Response (201)
{
  "inventory_id": 1,
  "project_id": 1,
  "brand": "Asian Paints",
  "quantity": 50,
  "name": "Wall Paint",
  "price": 1200,
  "stockin": true,
  "billing": false,
  "created_at": "2026-03-09T10:00:00.000Z"
}

Error Responses
400
{ "error": "Invalid project_id: Project does not exist" }

500
{ "error": "Internal Server Error" }


2) Get All Inventory Items
GET /api/inventory
Fetches all inventory items ordered by latest first.
Success Response (200)
[
  {
    "inventory_id": 1,
    "project_id": 1,
    "brand": "Asian Paints",
    "quantity": 50,
    "name": "Wall Paint",
    "price": 1200,
    "stockin": true,
    "billing": false,
    "created_at": "2026-03-09T10:00:00.000Z"
  }
]


3) Get Inventory Item by ID
GET /api/inventory/{id}
Fetch a single inventory item by inventory_id.
Path Parameter
Name
Type
Required
id
integer
Yes

Success Response (200)
{
  "inventory_id": 1,
  "project_id": 1,
  "brand": "Asian Paints",
  "quantity": 50,
  "name": "Wall Paint",
  "price": 1200,
  "stockin": true,
  "billing": false
}

Error Response
404
{ "error": "Inventory item not found" }


4) Get Inventory Items by Project ID
GET /api/inventory/project/{projectId}
Fetches all inventory items for a specific project.
Path Parameter
Name
Type
Required
projectId
integer
Yes

Success Response (200)
[
  {
    "inventory_id": 2,
    "project_id": 1,
    "brand": "Berger",
    "quantity": 20,
    "name": "Primer",
    "price": 950,
    "stockin": false,
    "billing": true
  }
]


5) Update Inventory Item
PUT /api/inventory/{id}
Updates full inventory item details.
Request Body
All fields are optional.
{
  "brand": "Asian Paints Premium",
  "quantity": 60,
  "name": "Wall Paint Deluxe",
  "price": 1350,
  "stockin": true,
  "billing": true
}

Success Response (200)
{
  "inventory_id": 1,
  "project_id": 1,
  "brand": "Asian Paints Premium",
  "quantity": 60,
  "name": "Wall Paint Deluxe",
  "price": 1350,
  "stockin": true,
  "billing": true,
  "updated_at": "2026-03-09T10:30:00.000Z"
}

Error Response
404
{ "error": "Inventory item not found" }


6) Delete Inventory Item
DELETE /api/inventory/{id}
Deletes an inventory item.
Success Response (200)
{ "message": "Inventory item deleted successfully" }

Error Response
404
{ "error": "Inventory item not found" }


7) Update Stockin Status Only
PATCH /api/inventory/{id}/stockin
Updates only the stockin status of an inventory item.
Request Body
{
  "stockin": true
}

Validation
stockin must be a boolean
Success Response (200)
{
  "inventory_id": 1,
  "project_id": 1,
  "brand": "Asian Paints",
  "quantity": 50,
  "name": "Wall Paint",
  "price": 1200,
  "stockin": true,
  "billing": false,
  "updated_at": "2026-03-09T11:00:00.000Z"
}

Error Responses
400
{ "error": "stockin must be a boolean" }

404
{ "error": "Inventory item not found" }


8) Update Billing Status Only
PATCH /api/inventory/{id}/billing
Updates only the billing status of an inventory item.
Request Body
{
  "billing": true
}

Validation
billing must be a boolean
Success Response (200)
{
  "inventory_id": 1,
  "project_id": 1,
  "brand": "Asian Paints",
  "quantity": 50,
  "name": "Wall Paint",
  "price": 1200,
  "stockin": true,
  "billing": true,
  "updated_at": "2026-03-09T11:05:00.000Z"
}

Error Responses
400
{ "error": "billing must be a boolean" }

404
{ "error": "Inventory item not found" }


Notes for Frontend Developer
Suggested Usage
Use these endpoints like this in UI:
Create page / modal → POST /api/inventory
Inventory listing page → GET /api/inventory or GET /api/inventory/project/:projectId
Edit form → PUT /api/inventory/:id
Delete action → DELETE /api/inventory/:id
Quick toggle for stock in/out → PATCH /api/inventory/:id/stockin
Quick toggle for billing done/pending → PATCH /api/inventory/:id/billing
UI Recommendation
Since stockin and billing now have separate patch routes, frontend can use:
Toggle switch for Stockin
Toggle switch for Billing
without submitting the full edit form.
Example:
Toggle stock status → call /api/inventory/:id/stockin
Toggle billing status → call /api/inventory/:id/billing

Quick Endpoint Summary
Method
Endpoint
Purpose
POST
/api/inventory
Create inventory item
GET
/api/inventory
Get all inventory items
GET
/api/inventory/:id
Get inventory item by ID
GET
/api/inventory/project/:projectId
Get inventory by project
PUT
/api/inventory/:id
Update inventory item
DELETE
/api/inventory/:id
Delete inventory item
PATCH
/api/inventory/:id/stockin
Update stockin status
PATCH
/api/inventory/:id/billing
Update billing status



