# ITR Field Names (WIR 47 - Extra Work)

This document lists the field names used in the ITR (WIR 47) flow.

## Header / Basic Details
- title
- projectName
- projectCode
- clientEmployer
- pmcEngineer
- contractor
- vendorCode
- materialCode
- itrRefNo
- wirItrSubmissionDateTime
- inspectionDateTime
- submittedTo
- submittedBy
- source
- sourceFileName

## Part A: Contractor
### Location & Reference
- contractorPart.locationRef
- contractorPart.floorLevel
- contractorPart.gridReference
- contractorPart.areaRef

### Measurement Qty Update
- contractorPart.measurement.previousQty
- contractorPart.measurement.currentQty
- contractorPart.measurement.cumulativeQty

### Discipline
- contractorPart.discipline

### Description of Works
- contractorPart.descriptionOfWorks

### Attachments / Checklist
- contractorPart.attachments.drawingAttached
- contractorPart.attachments.attachedTestCerts
- contractorPart.attachments.specificDrawingRefNo
- contractorPart.attachments.methodStatementAttached
- contractorPart.attachments.checklistAttached
- contractorPart.attachments.jointMeasurementAttached

### Clearances & Sign-off (Part A)
- contractorPart.clearances.mep.name
- contractorPart.clearances.mep.date
- contractorPart.clearances.mep.designation
- contractorPart.clearances.mep.signature
- contractorPart.clearances.mep.comments

- contractorPart.clearances.surveyor.name
- contractorPart.clearances.surveyor.date
- contractorPart.clearances.surveyor.designation
- contractorPart.clearances.surveyor.signature
- contractorPart.clearances.surveyor.comments

- contractorPart.clearances.interface.name
- contractorPart.clearances.interface.date
- contractorPart.clearances.interface.designation
- contractorPart.clearances.interface.signature
- contractorPart.clearances.interface.comments

### Contractor Manager / Engineer Readiness
- contractorPart.contractorManagerComments
- contractorPart.readyForInspectionDate
- contractorPart.readyForInspectionTime
- contractorPart.readySignedBy

## Part B: Lodha / PMC
### Comments
- lodhaPmc.comments

### Signatures
- lodhaPmc.signOffs.engineerManagerCivil.name
- lodhaPmc.signOffs.engineerManagerCivil.signature
- lodhaPmc.signOffs.engineerManagerCivil.date

- lodhaPmc.signOffs.engineerManagerMep.name
- lodhaPmc.signOffs.engineerManagerMep.signature
- lodhaPmc.signOffs.engineerManagerMep.date

- lodhaPmc.signOffs.towerIncharge.name
- lodhaPmc.signOffs.towerIncharge.signature
- lodhaPmc.signOffs.towerIncharge.date

- lodhaPmc.signOffs.qaaDepartment.name
- lodhaPmc.signOffs.qaaDepartment.signature
- lodhaPmc.signOffs.qaaDepartment.date

### Result Code
- lodhaPmc.resultCode
