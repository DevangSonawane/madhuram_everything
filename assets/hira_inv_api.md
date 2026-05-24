Madhuram API
 1.0.0 
OAS 3.0
Full api list


Hiranandani Invoice


POST
/api/hiranandani-invoice
Create a new Hiranandani Invoice with items

Parameters
Cancel
No parameters
Request body
{
  "company_name": "string",
  "project_id": 0,
  "company_address": "string",
  "company_contact_number": "string",
  "company_email": "string",
  "company_website": "string",
  "supplier_gstin": "string",
  "invoice_number": "string",
  "invoice_date": "2026-05-22",
  "bill_to_company_name": "string",
  "bill_to_address": "string",
  "bill_to_gstin": "string",
  "bill_to_state": "string",
  "bill_to_state_code": "string",
  "ship_to_company_name": "string",
  "ship_to_address": "string",
  "ship_to_gstin": "string",
  "ship_to_state": "string",
  "ship_to_state_code": "string",
  "building_name": "string",
  "reference_ra_number": "string",
  "work_description": "string",
  "work_order_number": "string",
  "work_order_date": "2026-05-22",
  "service_date_from": "2026-05-22",
  "service_date_to": "2026-05-22",
  "total_value_before_tax": 0,
  "total_taxable_value": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "round_off": 0,
  "total_amount_after_tax": 0,
  "gst_on_reverse_charge": 0,
  "invoice_amount_in_words": "string",
  "bank_details": "string",
  "terms_and_conditions": "string",
  "authorised_signatory": "string",
  "items": [
    {
      "serial_number": 0,
      "goods_or_service_description": "string",
      "sac_code": "string",
      "value_of_supply": 0,
      "discount": 0,
      "taxable_value": 0,
      "cgst_rate": 0,
      "cgst_amount": 0,
      "sgst_rate": 0,
      "sgst_amount": 0,
      "igst_rate": 0,
      "igst_amount": 0,
      "cess_rate": 0,
      "cess_amount": 0
    }
  ]
}



Edit Value
Schema

Execute

GET
/api/hiranandani-invoice
Get all Hiranandani Invoices

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
/api/hiranandani-invoice/project/{projectId}
Get all Hiranandani Invoices for a specific project

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
/api/hiranandani-invoice/{id}
Get a single Hiranandani Invoice with its items

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
/api/hiranandani-invoice/{id}
Update a Hiranandani Invoice and its items

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
/api/hiranandani-invoice/{id}
Delete a Hiranandani Invoice

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
No links