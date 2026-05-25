Hiranandani Invoice


POST
/api/hiranandani-invoice
Create a new Hiranandani Invoice with items

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
  "pan_number": "string",
  "pf_number": "string",
  "esic_number": "string",
  "ptr_number": "string",
  "mlwf_number": "string",
  "invoice_number": "string",
  "invoice_date": "2026-05-25",
  "reverse_charge": "string",
  "supplier_state_name": "string",
  "supplier_state_code": "string",
  "bill_to_name": "string",
  "bill_to_address": "string",
  "bill_to_gstin": "string",
  "bill_to_state": "string",
  "bill_to_state_code": "string",
  "ship_to_name": "string",
  "ship_to_address": "string",
  "ship_to_gstin": "string",
  "ship_to_state": "string",
  "ship_to_state_code": "string",
  "building_name": "string",
  "ra_number": "string",
  "work_description": "string",
  "work_order_number": "string",
  "service_date_from": "2026-05-25",
  "service_date_to": "2026-05-25",
  "total_before_tax": 0,
  "total_taxable_value": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "round_off": 0,
  "total_amount_after_tax": 0,
  "gst_on_reverse_charge": 0,
  "invoice_amount_words": "string",
  "bank_details": "string",
  "terms_and_conditions": "string",
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
  "pan_number": "string",
  "pf_number": "string",
  "esic_number": "string",
  "ptr_number": "string",
  "mlwf_number": "string",
  "invoice_number": "string",
  "invoice_date": "2026-05-25",
  "reverse_charge": "string",
  "supplier_state_name": "string",
  "supplier_state_code": "string",
  "bill_to_name": "string",
  "bill_to_address": "string",
  "bill_to_gstin": "string",
  "bill_to_state": "string",
  "bill_to_state_code": "string",
  "ship_to_name": "string",
  "ship_to_address": "string",
  "ship_to_gstin": "string",
  "ship_to_state": "string",
  "ship_to_state_code": "string",
  "building_name": "string",
  "ra_number": "string",
  "work_description": "string",
  "work_order_number": "string",
  "service_date_from": "2026-05-25",
  "service_date_to": "2026-05-25",
  "total_before_tax": 0,
  "total_taxable_value": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "round_off": 0,
  "total_amount_after_tax": 0,
  "gst_on_reverse_charge": 0,
  "invoice_amount_words": "string",
  "bank_details": "string",
  "terms_and_conditions": "string",
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
      "line_total": 0,
      "item_id": 0,
      "invoice_id": 0
    }
  ],
  "invoice_id": 0,
  "created_at": "2026-05-25T12:03:53.927Z",
  "updated_at": "2026-05-25T12:03:53.927Z"
}
No links
500	
Server error

No links

GET
/api/hiranandani-invoice
Get all Hiranandani Invoices


GET
/api/hiranandani-invoice/project/{projectId}
Get all Hiranandani Invoices for a specific project


GET
/api/hiranandani-invoice/{id}
Get a single Hiranandani Invoice with its items


PUT
/api/hiranandani-invoice/{id}
Update a Hiranandani Invoice and its items


DELETE
/api/hiranandani-invoice/{id}
Delete a Hiranandani Invoice