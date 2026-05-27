

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
  "invoice": {
    "invoiceNo": "string",
    "invoiceDate": "2026-05-27",
    "gstin": "string",
    "website": "string",
    "buyer": {
      "name": "string",
      "address": "string",
      "stateName": "string",
      "stateCode": "string",
      "gstin": "string"
    },
    "receiverDetails": {
      "name": "string",
      "address": "string",
      "placeOfSupply": "string"
    },
    "workOrderDetails": {
      "woNo": "string",
      "woDate": "2026-05-27",
      "plantName": "string",
      "billNo": "string"
    },
    "lineItems": [
      {
        "sn": 0,
        "descriptionOfServiceGoods": "string",
        "sacHsnCode": "string",
        "uom": "string",
        "qty": 0,
        "rate": 0,
        "totalValueOfGoods": 0,
        "discountIf": 0,
        "taxableValue": 0,
        "cgst": {
          "rate": 0,
          "amount": 0
        },
        "sgst": {
          "rate": 0,
          "amount": 0
        },
        "igst": {
          "rate": 0,
          "amount": 0
        },
        "cess": {
          "rate": 0,
          "amount": 0
        },
        "line_total": 0
      }
    ],
    "totals": {
      "totalTaxableValue": 0,
      "totalCgstAmount": 0,
      "totalSgstAmount": 0,
      "totalIgstAmount": 0,
      "totalCessAmount": 0,
      "totalInvoiceValueFigure": 0,
      "totalInvoiceValueWords": "string"
    },
    "declaration": "string",
    "electronicReferenceNumber": "string",
    "authorisedSignatory": "string"
  },
  "project_id": 0,
  "user_id": "string",
  "user_name": "string"
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
  "invoice": {
    "invoiceNo": "string",
    "invoiceDate": "2026-05-27",
    "gstin": "string",
    "website": "string",
    "buyer": {
      "name": "string",
      "address": "string",
      "stateName": "string",
      "stateCode": "string",
      "gstin": "string"
    },
    "receiverDetails": {
      "name": "string",
      "address": "string",
      "placeOfSupply": "string"
    },
    "workOrderDetails": {
      "woNo": "string",
      "woDate": "2026-05-27",
      "plantName": "string",
      "billNo": "string"
    },
    "lineItems": [
      {
        "sn": 0,
        "descriptionOfServiceGoods": "string",
        "sacHsnCode": "string",
        "uom": "string",
        "qty": 0,
        "rate": 0,
        "totalValueOfGoods": 0,
        "discountIf": 0,
        "taxableValue": 0,
        "cgst": {
          "rate": 0,
          "amount": 0
        },
        "sgst": {
          "rate": 0,
          "amount": 0
        },
        "igst": {
          "rate": 0,
          "amount": 0
        },
        "cess": {
          "rate": 0,
          "amount": 0
        },
        "line_total": 0
      }
    ],
    "totals": {
      "totalTaxableValue": 0,
      "totalCgstAmount": 0,
      "totalSgstAmount": 0,
      "totalIgstAmount": 0,
      "totalCessAmount": 0,
      "totalInvoiceValueFigure": 0,
      "totalInvoiceValueWords": "string"
    },
    "declaration": "string",
    "electronicReferenceNumber": "string",
    "authorisedSignatory": "string"
  },
  "project_id": 0,
  "user_id": "string",
  "user_name": "string",
  "invoice_id": 0,
  "created_at": "2026-05-27T09:55:08.386Z",
  "updated_at": "2026-05-27T09:55:08.386Z",
  "items": [
    {
      "sn": 0,
      "descriptionOfServiceGoods": "string",
      "sacHsnCode": "string",
      "uom": "string",
      "qty": 0,
      "rate": 0,
      "totalValueOfGoods": 0,
      "discountIf": 0,
      "taxableValue": 0,
      "cgst": {
        "rate": 0,
        "amount": 0
      },
      "sgst": {
        "rate": 0,
        "amount": 0
      },
      "igst": {
        "rate": 0,
        "amount": 0
      },
      "cess": {
        "rate": 0,
        "amount": 0
      },
      "line_total": 0,
      "item_id": 0,
      "invoice_id": 0
    }
  ]
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
