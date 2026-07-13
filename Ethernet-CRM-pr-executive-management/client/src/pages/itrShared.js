export const DISCIPLINE_OPTIONS = [
  "Structural / Civil",
  "Arch / Finishing",
  "Landscape",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Facade",
  "Others",
  "ID",
];

export const YES_NO_NA_OPTIONS = ["Yes", "No", "N/A"];

export const RESULT_CODE_OPTIONS = [
  { value: "Code 1", label: "Code 1 - Work may proceed" },
  { value: "Code 2", label: "Code 2 - Conditionally approved. Work may proceed after resubmitting incorporating comments" },
  { value: "Code 3", label: "Code 3 - Revise & resubmit. Work may not proceed" },
  { value: "Code 4", label: "Code 4 - For information and records only. Work may not proceed" },
];

const EMPTY_CLEARANCE = {
  name: "",
  date: "",
  designation: "",
  signature: "",
  comments: "",
};

const EMPTY_SIGNOFF = {
  name: "",
  signature: "",
  date: "",
};

export const EMPTY_ITR = {
  title: "Work Inspection Request (WIR)",
  project_id: "",
  po_id: "",
  mir_id: "",
  sample_id: "",
  projectName: "",
  projectCode: "",
  clientEmployer: "",
  pmcEngineer: "",
  contractor: "",
  vendorCode: "",
  materialCode: "",
  workOrderNo: "",
  itrRefNo: "",
  revNo: "",
  wirItrSubmissionDateTime: "",
  inspectionDateTime: "",
  submittedTo: "",
  submittedBy: "",
  contractorPart: {
    locationRef: "",
    floorLevel: "",
    gridReference: "",
    areaRef: "",
    measurement: {
      previousQty: "",
      currentQty: "",
      cumulativeQty: "",
      unit: "",
    },
    discipline: [],
    descriptionOfWorks: "",
    attachments: {
      drawingAttached: "",
      attachedTestCerts: "",
      specificDrawingRefNo: "",
      methodStatementAttached: "",
      checklistAttached: "",
      jointMeasurementAttached: "",
    },
    clearances: {
      mep: { ...EMPTY_CLEARANCE },
      surveyor: { ...EMPTY_CLEARANCE },
      interface: { ...EMPTY_CLEARANCE },
    },
    contractorManagerComments: "",
    readyForInspectionDate: "",
    readyForInspectionTime: "",
    readySignedBy: "",
  },
  lodhaPmc: {
    comments: "",
    signOffs: {
      engineerManagerCivil: { ...EMPTY_SIGNOFF },
      engineerManagerMep: { ...EMPTY_SIGNOFF },
      towerIncharge: { ...EMPTY_SIGNOFF },
      qaaDepartment: { ...EMPTY_SIGNOFF },
    },
    resultCode: "",
  },
  source: "Manual",
  sourceFileName: "",
  sourceFilePath: "",
  status: "",
  inspectionCode: "",
  workItems: [],
  selectedSampleItemKeys: [],
  shaftDetails: [],
};
