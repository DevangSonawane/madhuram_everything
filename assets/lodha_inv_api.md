Lodha Invoice


POST
/api/lodha-invoice
Create a new Lodha Invoice with items

Parameters
Cancel
No parameters

Request body

application/json
Edit Value
Schema
{
  "project_id": 0,
  "company_name": "string",
  "company_address": "string",
  "company_phone": "string",
  "company_email": "string",
  "company_website": "string",
  "supplier_gstin": "string",
  "invoice_number": "string",
  "invoice_date": "2026-05-25",
  "buyer_name": "string",
  "buyer_address": "string",
  "buyer_state_name": "string",
  "buyer_state_code": "string",
  "buyer_gstin": "string",
  "receiver_name": "string",
  "receiver_address": "string",
  "place_of_supply": "string",
  "work_order_number": "string",
  "plant_name": "string",
  "bill_no": "string",
  "total_taxable_value": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "total_value": 0,
  "total_invoice_value": 0,
  "total_invoice_value_words": "string",
  "declaration": "string",
  "electronic_ref_number": "string",
  "electronic_ref_date": "2026-05-25",
  "authorised_signatory": "string",
  "user_id": "string",
  "user_name": "string",
  "items": [
    {
      "sn": 0,
      "description": "string",
      "sac_code": "string",
      "value_of_supply": 0,
      "discount": 0,
      "taxable_value": 0,
      "cgst_rate": 0,
      "cgst_amount": 0,
      "sgst_rate": 0,
      "sgst_amount": 0,
      "igst_amount": 0,
      "line_total": 0
    }
  ]
}
Execute
Responses
Code	Description	Links
201	
Invoice created successfully

Media type

application/json
Controls Accept header.
Example Value
Schema
{
  "project_id": 0,
  "company_name": "string",
  "company_address": "string",
  "company_phone": "string",
  "company_email": "string",
  "company_website": "string",
  "supplier_gstin": "string",
  "invoice_number": "string",
  "invoice_date": "2026-05-25",
  "buyer_name": "string",
  "buyer_address": "string",
  "buyer_state_name": "string",
  "buyer_state_code": "string",
  "buyer_gstin": "string",
  "receiver_name": "string",
  "receiver_address": "string",
  "place_of_supply": "string",
  "work_order_number": "string",
  "plant_name": "string",
  "bill_no": "string",
  "total_taxable_value": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "total_value": 0,
  "total_invoice_value": 0,
  "total_invoice_value_words": "string",
  "declaration": "string",
  "electronic_ref_number": "string",
  "electronic_ref_date": "2026-05-25",
  "authorised_signatory": "string",
  "user_id": "string",
  "user_name": "string",
  "items": [
    {
      "sn": 0,
      "description": "string",
      "sac_code": "string",
      "value_of_supply": 0,
      "discount": 0,
      "taxable_value": 0,
      "cgst_rate": 0,
      "cgst_amount": 0,
      "sgst_rate": 0,
      "sgst_amount": 0,
      "igst_amount": 0,
      "line_total": 0,
      "item_id": 0,
      "invoice_id": 0
    }
  ],
  "invoice_id": 0,
  "created_at": "2026-05-25T12:02:34.769Z",
  "updated_at": "2026-05-25T12:02:34.769Z"
}
No links
500	
Server error

No links

GET
/api/lodha-invoice
Get all Lodha Invoices


GET
/api/lodha-invoice/project/{projectId}
Get all Lodha Invoices for a specific project


GET
/api/lodha-invoice/{id}
Get a single Lodha Invoice with its items


PUT
/api/lodha-invoice/{id}
Update a Lodha Invoice and its items


DELETE
/api/lodha-invoice/{id}
Delete a Lodha Invoice