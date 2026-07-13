# PO Field Names (po.pdf)

This document lists the field names used in the Purchase Order (PO) flow.

## Header / Basic Details
- title
- companyName
- companySubtitle
- companyAddress
- companyEmail
- companyGstNo
- source
- sourceFileName

## Order Metadata
- indentNo
- indentDate
- orderNo
- poDate

## Vendor / Recipient
- vendor.name
- vendor.site
- vendor.contactPerson
- vendor.address
- vendor.contacts.primary.name
- vendor.contacts.primary.phone
- vendor.contacts.secondary.name
- vendor.contacts.secondary.phone

## Items / Line Table
- itemsGroup.title
- itemsGroup.description

- items[].srNo
- items[].hsnCode
- items[].description
- items[].qty
- items[].uom
- items[].rate
- items[].amount
- items[].remarks

## Pricing / Taxes / Totals
- subtotalAmount
- discount.percent
- discount.amount
- afterDiscountAmount
- taxes.cgst.percent
- taxes.cgst.amount
- taxes.sgst.percent
- taxes.sgst.amount
- totalAmount

## Summary Footer
- summary.discountPercent
- summary.tax
- summary.delivery
- summary.payment

## Notes
- notes[]

## Terms & Conditions
- termsAndConditions[]

## Sign-off
- authorisedSignatory
