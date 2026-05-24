Lodha Invoice


POST
/api/lodha-invoice
Create a new Lodha Invoice with items

Parameters
Cancel
No parameters

{
  "company_name": "string",
  "company_address": "string",
  "company_contact_number": "string",
  "company_email": "string",
  "company_website": "string",
  "invoice_title": "string",
  "invoice_number": "string",
  "supplier_gstin": "string",
  "pan_no": "string",
  "pf_number": "string",
  "esic_number": "string",
  "ptr_number": "string",
  "mlwf_number": "string",
  "reverse_charge": true,
  "state_name": "string",
  "state_code": "string",
  "receiver_name": "string",
  "receiver_address": "string",
  "buyer_gstin": "string",
  "ship_to_name": "string",
  "ship_to_state": "string",
  "ship_to_state_code": "string",
  "ship_to_gstin": "string",
  "project_id": 0,
  "building_name": "string",
  "ra_number": "string",
  "work_description": "string",
  "work_order_number": "string",
  "service_date_from": "2026-05-22",
  "service_date_to": "2026-05-22",
  "total_taxable_value": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "total_invoice_value": 0,
  "round_off": 0,
  "total_invoice_value_words": "string",
  "gst_on_reverse_charge": 0,
  "terms": "string",
  "authorised_signatory": "string",
  "items": [
    {
      "sr": 0,
      "description": "string",
      "sac_code": "string",
      "value_of_supply": 0,
      "discount": 0,
      "taxable_value": 0,
      "cgst_rate": 0,
      "cgst_amount": 0,
      "sgst_rate": 0,
      "sgst_amount": 0,
      "total": 0
    }
  ]
}
Request body

Edit Value
Schema

Execute

GET
/api/lodha-invoice
Get all Lodha Invoices

Parameters
Cancel
No parameters
Execute
Responses
Code	Description	Links
200	
List of invoices
No links

GET
/api/lodha-invoice/project/{projectId}
Get all Lodha Invoices for a specific project

Parameters
Cancel
Name	Description
projectId *
integer
(path)

Execute
Responses
Code	Description	Links
200	
List of invoices for the project
No links

GET
/api/lodha-invoice/{id}
Get a single Lodha Invoice with its items

Parameters
Cancel
Name	Description
id *
integer
(path)

Execute
Responses
Code	Description	Links
200	
Invoice details with items
No links

PUT
/api/lodha-invoice/{id}
Update a Lodha Invoice and its items

Parameters
Cancel
Name	Description
id *
integer
(path)

Request body

Edit Value
Schema

Execute

DELETE
/api/lodha-invoice/{id}
Delete a Lodha Invoice

Parameters
Cancel
Name	Description
id *
integer
(path)

Execute
Responses
Code	Description	Links
200	
Deleted successfully