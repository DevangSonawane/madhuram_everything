export const DISCIPLINE_OPTIONS = [
  "Structural / Civil",
  "Arch / Finishing",
  "Landscape",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Facade",
  "Others",
];

export const YES_NO_OPTIONS = ["Yes", "No"];

export const MIR_TEMPLATE_TYPES = {
  LODHA: "lodha",
  HIRANANDANI: "hiranandani",
};

export const MIR_TEMPLATE_OPTIONS = [
  {
    value: MIR_TEMPLATE_TYPES.LODHA,
    label: "Lodha",
    description: "Two-page Lodha/PMC material inspection format.",
  },
  {
    value: MIR_TEMPLATE_TYPES.HIRANANDANI,
    label: "Hiranandani",
    description: "Hiranandani control form with notes, approvals, and close-out.",
  },
];

export const EMPTY_MIR = {
  title: "Material Inspection Request (MIR)",
  projectName: "",
  projectCode: "",
  mirRefNo: "",
  materialCode: "",
  requestSubmission: {
    clientEmployer: "",
    clientSubmissionDateTime: "",
    pmc: "",
    engineer: "",
    engineerInspectionDateTime: "",
    contractor: "",
    submittedTo: "",
    vendorCode: "",
    refDocAttached: "",
    discipline: [],
  },
  contractorPart: {
    materialSubmittalApproved: "",
    approvalRefNo: "",
    description: "",
    previousQty: "",
    currentQty: "",
    cumulativeQty: "",
    boqReference: "",
    manufacturerCountry: "",
    supplier: "",
    deliveryNoteNumber: "",
    receiptDate: "",
    storageLocation: "",
    testCertificateDelivered: "",
    fieldTestConducted: "",
    fieldTestComplianceNote: "",
    thirdPartyTestContractorScope: "",
    thirdPartyTestContractorComplianceNote: "",
    thirdPartyTestLodhaScope: "",
    thirdPartyTestLodhaComplianceNote: "",
    contractorName: "",
    contractorSignature: "",
    contractorDate: "",
  },
  lodhaPmc: {
    inspectionReports: {
      physicalDamage: "",
      deliveryNoteCorrect: "",
      conformApprovedSubmittal: "",
      mtcDelivered: "",
      fieldTestCompliance: "",
      thirdPartyContractorScope: "",
      thirdPartyLodhaScope: "",
    },
    signOffs: {
      civilProjectManager: "",
      civilQualityManager: "",
      facadeManager: "",
      landscapeArchitect: "",
      mepManager: "",
    },
    comments: "",
    resultCode: "",
    resultName: "",
    resultSignature: "",
    resultDate: "",
    distribution: {
      lodha: false,
      contractor: false,
      others: "",
    },
  },
  templateRef: "",
  templateRevision: "",
  templateDate: "",
  source: "Manual",
  sourceFileName: "",
};

export const EMPTY_LODHA_MIR = {
  title: "Material Inspection Request - (MIR)",
  projectName: "",
  projectCode: "",
  mirRefNo: "",
  materialCode: "",
  requestSubmission: {
    clientEmployer: "",
    clientSubmissionDateTime: "",
    pmcEngineer: "",
    inspectionDateTime: "",
    contractor: "",
    submittedTo: "",
    vendorCode: "",
    refDocAttached: "",
    discipline: [],
  },
  contractorPart: {
    materialSubmittalApproved: "",
    approvalRefNo: "",
    description: "",
    previousQty: "",
    currentQty: "",
    cumulativeQty: "",
    boqReference: "",
    manufacturerCountry: "",
    supplier: "",
    deliveryNoteNumber: "",
    receiptDate: "",
    storageLocation: "",
    testCertificateDelivered: "",
    fieldTestConducted: "",
    fieldTestComplianceNote: "",
    thirdPartyTestContractorScope: "",
    thirdPartyTestContractorComplianceNote: "",
    thirdPartyTestLodhaScope: "",
    thirdPartyTestLodhaComplianceNote: "",
    contractorName: "",
    contractorSignature: "",
    contractorDate: "",
  },
  lodhaPmc: {
    inspectionReports: {
      physicalDamage: "",
      deliveryNoteCorrect: "",
      conformApprovedSubmittal: "",
      mtcDelivered: "",
      fieldTestCompliance: "",
      thirdPartyContractorScope: "",
      thirdPartyLodhaScope: "",
    },
    signOffs: {
      civilProjectManager: "",
      civilQualityManager: "",
      facadeManager: "",
      landscapeArchitect: "",
      mepManager: "",
    },
    comments: "",
    resultCode: "",
    resultName: "",
    resultSignature: "",
    resultDate: "",
    distribution: {
      lodha: false,
      contractor: false,
      others: "",
    },
  },
  templateRef: "CO-LOD-GENE-QU-CN-TMT-004",
  templateRevision: "01",
  templateDate: "04-10-2023",
};

export const EMPTY_HIRANANDANI_MIR = {
  companyTitle: "Hiranandani Group Of Companies.",
  controlForm: "CF / MIR / 001",
  title: "Material Inspection Request - MIR",
  revision: "Rev.0, Dated 29/07/2022",
  projectName: "",
  location: "",
  supplierName: "",
  materialToInspect: "",
  storageLocation: "",
  inspectionDate: "",
  mirNo: "",
  attachments: "",
  notes: {
    manufacturer: "",
    purchaseOrderNo: "",
    manufacturerDate: "",
    challanInvoiceNo: "",
    expiryDate: "",
    deliveryDate: "",
    batchNo: "",
    materialSubmittalRef: "",
    sourceCountry: "",
    specificationRef: "",
    quantityDelivered: "",
    drawingsRef: "",
  },
  materialRows: [
    { material: "", size: "", quantity: "", unit: "" },
  ],
  mirRaisedByName: "",
  mirRaisedByDateSignature: "",
  receivedByName: "",
  receivedByDateSignature: "",
  inspectionEngineerComments: "",
  approvalCode: "",
  checkedByClientRepresentative: "",
  checkedByDateSignature: "",
  issuedByName: "",
  issuedByDateSignature: "",
  closeOut: {
    actionTaken: "",
    status: "",
    checkedBy: "",
    dateSignature: "",
  },
};

export const HIRANANDANI_APPROVAL_CODES = [
  { code: "Code A", label: "Approved" },
  { code: "Code B", label: "Approved as noted" },
  { code: "Code C", label: "Not approved" },
  { code: "Code D", label: "For info & Records only" },
];

export const LODHA_RESULT_CODES = [
  { code: "Code 1", label: "Approved - Material can be used" },
  { code: "Code 2", label: "Conditionally approved. Material can be used, Resubmit incorporating comments indicated" },
  { code: "Code 3", label: "Revise & Resubmit. Material may not be used" },
  { code: "Code 4", label: "For information and records only." },
];

const isPlainObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

const parseMaybeJson = (value, fallback = null) => {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const parseMirDynamicField = (value) => {
  const parsed = parseMaybeJson(value, value);
  return Array.isArray(parsed) ? parsed : [];
};

const getAttachmentNameFromPath = (path) => {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  const clean = raw.split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts[parts.length - 1] || raw;
};

const parseAttachmentStrings = (value) => {
  const parsed = parseMaybeJson(value, value);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed !== "string") return [];
  return parsed
    .split(/\r?\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseMirAttachmentList = (value) => {
  const list = Array.isArray(value) ? value : parseAttachmentStrings(value);
  return list
    .map((entry, index) => {
      if (entry == null) return null;
      if (isPlainObject(entry)) {
        const path = String(entry.path || entry.filePath || entry.url || entry.value || "").trim();
        if (!path) return null;
        return {
          key: String(entry.key || path || index),
          path,
          name: String(entry.name || entry.file_name || entry.fileName || getAttachmentNameFromPath(path)),
        };
      }
      const path = String(entry).trim();
      if (!path) return null;
      return {
        key: `${path}-${index}`,
        path,
        name: getAttachmentNameFromPath(path),
      };
    })
    .filter(Boolean);
};

export const buildMirAttachmentValue = (attachments = []) => {
  const list = Array.isArray(attachments) ? attachments : [];
  return list
    .map((entry) => {
      if (entry == null) return "";
      if (isPlainObject(entry)) return String(entry.path || entry.filePath || entry.url || "").trim();
      return String(entry).trim();
    })
    .filter(Boolean)
    .join("\n");
};

export const getMirDynamicValue = (dynamicField, key, fallback = null) => {
  const list = parseMirDynamicField(dynamicField);
  const entry = list.find((item) => item?.key === key);
  if (!entry) return fallback;
  return parseMaybeJson(entry.value, entry.value ?? fallback);
};

export const buildMirDynamicField = (templateType, templatePayload, extraFields = []) => {
  const fields = [
    { key: "template_type", value: templateType },
    { key: "template_payload", value: JSON.stringify(templatePayload || {}) },
  ];
  extraFields.forEach((entry) => {
    if (!entry?.key) return;
    const value = typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value ?? "");
    fields.push({ key: entry.key, value });
  });
  return fields;
};

const mergeDeep = (base, incoming) => {
  if (!isPlainObject(base)) return incoming ?? base;
  const source = isPlainObject(incoming) ? incoming : {};
  const result = { ...base };
  Object.keys(source).forEach((key) => {
    if (isPlainObject(base[key])) {
      result[key] = mergeDeep(base[key], source[key]);
    } else if (Array.isArray(base[key])) {
      result[key] = Array.isArray(source[key]) ? source[key] : base[key];
    } else {
      result[key] = source[key] ?? base[key];
    }
  });
  return result;
};

const normalizeMirItemNo = (item) => {
  if (!isPlainObject(item)) return item;
  const itemNo = String(
    item.item_no ??
      item.itemNo ??
      item.item_code ??
      item.itemCode ??
      item.code ??
      item.hsn ??
      ""
  ).trim();
  if (!itemNo) return item;
  return {
    ...item,
    item_no: item.item_no ?? itemNo,
    item_code: item.item_code ?? itemNo,
  };
};

export const normalizeLodhaMir = (value) => {
  const normalized = mergeDeep(EMPTY_LODHA_MIR, value);
  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map(normalizeMirItemNo);
  }
  if (Array.isArray(normalized.materialRows)) {
    normalized.materialRows = normalized.materialRows.map(normalizeMirItemNo);
  }
  return normalized;
};

export const normalizeHiranandaniMir = (value) => {
  const normalized = mergeDeep(EMPTY_HIRANANDANI_MIR, value);
  normalized.materialRows = Array.isArray(normalized.materialRows) && normalized.materialRows.length
    ? normalized.materialRows
    : [{ material: "", size: "", quantity: "", unit: "" }];
  return normalized;
};

export const getMirTemplateType = (mir) => {
  const topLevel = String(mir?.template_type || mir?.templateType || "").trim().toLowerCase();
  if (topLevel === MIR_TEMPLATE_TYPES.LODHA || topLevel === MIR_TEMPLATE_TYPES.HIRANANDANI) return topLevel;
  const fromDynamic = getMirDynamicValue(mir?.dynamic_field, "template_type", "");
  if (fromDynamic === MIR_TEMPLATE_TYPES.LODHA || fromDynamic === MIR_TEMPLATE_TYPES.HIRANANDANI) return fromDynamic;
  const client = String(mir?.client_name || "").toLowerCase();
  if (client.includes("hiranandani")) return MIR_TEMPLATE_TYPES.HIRANANDANI;
  if (client.includes("lodha") || client.includes("macrotech")) return MIR_TEMPLATE_TYPES.LODHA;
  return "";
};

export const getMirTemplatePayload = (mir) => {
  const templateType = getMirTemplateType(mir);
  const payload = getMirDynamicValue(mir?.dynamic_field, "template_payload", {});
  if (templateType === MIR_TEMPLATE_TYPES.HIRANANDANI) return normalizeHiranandaniMir(payload);
  return normalizeLodhaMir(payload);
};
