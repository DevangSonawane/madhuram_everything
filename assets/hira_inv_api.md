
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
  "invoice": {
    "invoiceNo": "string",
    "invoiceDate": "2026-05-27",
    "reverseCharge": "string",
    "state": "string",
    "stateCode": "string",
    "seller": {
      "name": "string",
      "gstin": "string",
      "panNo": "string"
    },
    "complianceDetails": {
      "pfNo": "string",
      "esicNo": "string",
      "ptrNo": "string",
      "mlwfNo": "string"
    },
    "billToParty": {
      "coAccountName": "string",
      "address": "string",
      "gstin": "string",
      "state": "string",
      "stateCode": "string"
    },
    "shipToPartySite": {
      "coAccountName": "string",
      "gstin": "string",
      "state": "string",
      "stateCode": "string",
      "buildingName": "string"
    },
    "referenceDetails": {
      "raNo": "string",
      "workDescription": "string",
      "woNo": "string",
      "woDate": "2026-05-27",
      "serviceDateFrom": "2026-05-27",
      "serviceDateTo": "2026-05-27"
    },
    "lineItems": [
      {
        "sNo": 0,
        "goodsServiceDescription": "string",
        "sacCode": "string",
        "valueOfSupply": 0,
        "discount": 0,
        "taxableValue": 0,
        "cgst": {
          "rate": 0,
          "amount": 0
        },
        "sgst": {
          "rate": 0,
          "amount": 0
        },
        "total": 0
      }
    ],
    "totals": {
      "totalValueOfSupply": 0,
      "totalDiscount": 0,
      "totalTaxableValue": 0,
      "totalCgstAmount": 0,
      "totalSgstAmount": 0,
      "totalAmount": 0
    },
    "summary": {
      "totalInvoiceAmountInWords": "string",
      "totalAmountBeforeTax": 0,
      "addCgst": 0,
      "addSgst": 0,
      "roundOff": 0,
      "totalAmountAfterTax": 0,
      "gstOnReverseCharge": 0,
      "eAndOE": true
    },
    "bankDetails": "string",
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
    "reverseCharge": "string",
    "state": "string",
    "stateCode": "string",
    "seller": {
      "name": "string",
      "gstin": "string",
      "panNo": "string"
    },
    "complianceDetails": {
      "pfNo": "string",
      "esicNo": "string",
      "ptrNo": "string",
      "mlwfNo": "string"
    },
    "billToParty": {
      "coAccountName": "string",
      "address": "string",
      "gstin": "string",
      "state": "string",
      "stateCode": "string"
    },
    "shipToPartySite": {
      "coAccountName": "string",
      "gstin": "string",
      "state": "string",
      "stateCode": "string",
      "buildingName": "string"
    },
    "referenceDetails": {
      "raNo": "string",
      "workDescription": "string",
      "woNo": "string",
      "woDate": "2026-05-27",
      "serviceDateFrom": "2026-05-27",
      "serviceDateTo": "2026-05-27"
    },
    "lineItems": [
      {
        "sNo": 0,
        "goodsServiceDescription": "string",
        "sacCode": "string",
        "valueOfSupply": 0,
        "discount": 0,
        "taxableValue": 0,
        "cgst": {
          "rate": 0,
          "amount": 0
        },
        "sgst": {
          "rate": 0,
          "amount": 0
        },
        "total": 0
      }
    ],
    "totals": {
      "totalValueOfSupply": 0,
      "totalDiscount": 0,
      "totalTaxableValue": 0,
      "totalCgstAmount": 0,
      "totalSgstAmount": 0,
      "totalAmount": 0
    },
    "summary": {
      "totalInvoiceAmountInWords": "string",
      "totalAmountBeforeTax": 0,
      "addCgst": 0,
      "addSgst": 0,
      "roundOff": 0,
      "totalAmountAfterTax": 0,
      "gstOnReverseCharge": 0,
      "eAndOE": true
    },
    "bankDetails": "string",
    "authorisedSignatory": "string"
  },
  "project_id": 0,
  "user_id": "string",
  "user_name": "string",
  "invoice_id": 0,
  "created_at": "2026-05-27T09:56:13.655Z",
  "updated_at": "2026-05-27T09:56:13.655Z",
  "items": [
    {
      "sNo": 0,
      "goodsServiceDescription": "string",
      "sacCode": "string",
      "valueOfSupply": 0,
      "discount": 0,
      "taxableValue": 0,
      "cgst": {
        "rate": 0,
        "amount": 0
      },
      "sgst": {
        "rate": 0,
        "amount": 0
      },
      "total": 0,
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
