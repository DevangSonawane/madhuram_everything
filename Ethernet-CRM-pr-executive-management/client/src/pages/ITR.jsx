import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Upload, FileUp, PencilLine, Eye, Save, MoreHorizontal, Download, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadItrPdf } from "@/lib/itrPdf";
import { useToast } from "@/hooks/use-toast";
import { extractTextFromPdf } from "@/lib/pdfUtils";
import { DISCIPLINE_OPTIONS, EMPTY_ITR, YES_NO_NA_OPTIONS } from "@/pages/itrShared";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/useProject";
import { useAuth } from "@/contexts/useAuth";
import { UnitSelect, convertQuantity } from "@/components/forms/UnitSelect";

const STORAGE_KEY = "itrPreview";
const RECENT_KEY = "itrRecent";
const todayDateOnly = () => new Date().toISOString().slice(0, 10);
const API_STATUS_OPTIONS = ["DRAFT", "SUBMITTED", "UNDER_INSPECTION", "APPROVED", "REJECTED", "RESUBMITTED", "CLOSED"];
const API_INSPECTION_CODE_OPTIONS = [
  { value: "CODE_1", label: "Work may proceed" },
  { value: "CODE_2", label: "Conditionally approved. Work may proceed and resubmit incorporating comments" },
  { value: "CODE_3", label: "Revise and Resubmit. Work may NOT proceed" },
  { value: "CODE_4", label: "For information and records only. Work may proceed" },
];
const DISCIPLINE_LABEL_TO_API = {
  "Structural / Civil": "STRUCTURAL_CIVIL",
  "Arch / Finishing": "ARCH_FINISHING",
  Mechanical: "MECHANICAL",
  Electrical: "ELECTRICAL",
  Landscape: "LANDSCAPE",
  Plumbing: "PLUMBING",
  Facade: "FACADE",
  Others: "OTHERS",
  ID: "ID",
  Surveying: "SURVEYING",
};

const SAMPLE_EXTRACTED = {
  ...EMPTY_ITR,
  projectName: "Premier Signet Tow 1 - Plumbing",
  projectCode: "",
  clientEmployer: "Macrotech Developers Limited",
  pmcEngineer: "Mr. Vikas Pawale",
  contractor: "Madhuram Enterprises",
  vendorCode: "30010937",
  materialCode: "995462",
  itrRefNo: "ITR-SIGNET-1-ME-PR-PL-047",
  submittedBy: "Madhuram Enterprises",
  contractorPart: {
    ...EMPTY_ITR.contractorPart,
    locationRef: "Signet 1 - Plumbing",
    floorLevel: "G/Floor",
    areaRef: "Shaft",
    descriptionOfWorks: "Extra work done - rainwater pipe\n75 MM SWR pipe type 'B' = 3 MTR\n110 MM SWR pipe type 'B' = 14 MTR",
  },
  source: "Extracted",
  sourceFileName: "WIR 47- EXTRA WRK .pdf",
};

const LABEL_MAP = [
  { re: /project\s*name/i, path: "projectName" },
  { re: /project\s*code/i, path: "projectCode" },
  { re: /client\s*\/\s*employer/i, path: "clientEmployer" },
  { re: /pmc\s*\/\s*engineer/i, path: "pmcEngineer" },
  { re: /contractor/i, path: "contractor" },
  { re: /vendor\s*code/i, path: "vendorCode" },
  { re: /material\s*code/i, path: "materialCode" },
  { re: /(wir\s*\/\s*itr\s*ref\.?\s*no|itr\s*ref\.?\s*no)/i, path: "itrRefNo" },
  { re: /wir\s*\/\s*itr\s*submission/i, path: "wirItrSubmissionDateTime" },
  { re: /inspection\s*\(date\s*&\s*time\)/i, path: "inspectionDateTime" },
  { re: /wir\s*\/\s*itr\s*submitted\s*to/i, path: "submittedTo" },
  { re: /wir\s*\/\s*itr\s*submitted\s*by/i, path: "submittedBy" },
  { re: /tower\s*\/\s*block\s*ref/i, path: "contractorPart.locationRef" },
  { re: /floor\s*level/i, path: "contractorPart.floorLevel" },
  { re: /grid\s*reference/i, path: "contractorPart.gridReference" },
  { re: /room\s*\/\s*area\s*ref/i, path: "contractorPart.areaRef" },
  { re: /previous\s*qty/i, path: "contractorPart.measurement.previousQty" },
  { re: /current\s*qty/i, path: "contractorPart.measurement.currentQty" },
  { re: /cumulative\s*qty/i, path: "contractorPart.measurement.cumulativeQty" },
];

const ATTACHMENT_LABELS = [
  { re: /drawing\s*attached/i, path: "contractorPart.attachments.drawingAttached" },
  { re: /attached\s*test\s*certificates/i, path: "contractorPart.attachments.attachedTestCerts" },
  { re: /specific\s*drawing\s*ref/i, path: "contractorPart.attachments.specificDrawingRefNo" },
  { re: /method\s*statement\s*att/i, path: "contractorPart.attachments.methodStatementAttached" },
  { re: /checklist\s*sheet\s*att/i, path: "contractorPart.attachments.checklistAttached" },
  { re: /joint\s*measurement\s*sheet\s*att/i, path: "contractorPart.attachments.jointMeasurementAttached" },
];

const normalizeSnakeKeys = (value) => {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => (entry && typeof entry === "object" ? normalizeSnakeKeys(entry) : entry));
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      acc[camelKey] = normalizeSnakeKeys(val);
      return acc;
    }, {});
  }
  return value;
};

const convertToSnakeKeys = (value) => {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map(convertToSnakeKeys);
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      const snakeKey = key.replace(/([A-Z])/g, (_, char) => `_${char.toLowerCase()}`);
      acc[snakeKey] = convertToSnakeKeys(val);
      return acc;
    }, {});
  }
  return value;
};

const buildDynamicField = (itrData) => {
  const fields = [];
  const pushField = (key, value) => {
    if (value == null) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return;
    fields.push({ key, value: typeof value === "object" ? JSON.stringify(value) : value });
  };

  pushField("Contractor Part", itrData.contractorPart);
  pushField("Lodha PMC", itrData.lodhaPmc);
  pushField("Source", itrData.source);
  pushField("Source File", itrData.sourceFileName);
  return fields;
};

const yesNoNaToApi = (value) => {
  const v = (value ?? "").toString().trim().toUpperCase();
  if (v === "YES") return "YES";
  if (v === "NO") return "NO";
  if (v === "NA" || v === "N/A") return "NA";
  return v ? v : "NO";
};

const apiYesNoNaToUi = (value) => {
  const v = (value ?? "").toString().trim().toUpperCase();
  if (v === "YES") return "Yes";
  if (v === "NO") return "No";
  if (v === "NA" || v === "N/A") return "N/A";
  return value ?? "";
};

const buildItrPayload = (itrData, projectId, user) => {
  const selectedDisciplineLabel = Array.isArray(itrData.contractorPart.discipline)
    ? itrData.contractorPart.discipline[0]
    : itrData.contractorPart.discipline;
  const selectedDisciplineApi = DISCIPLINE_LABEL_TO_API[selectedDisciplineLabel] || selectedDisciplineLabel || "OTHERS";
  const poIdNum = Number(itrData.po_id);
  const mirIdNum = Number(itrData.mir_id);

  const signoffRows = [
    {
      section: "MEP Clearance",
      ...convertToSnakeKeys(itrData.contractorPart.clearances.mep),
      signed_date: itrData.contractorPart.clearances.mep?.date || "",
      signature_url: itrData.contractorPart.clearances.mep?.signature || "",
    },
    {
      section: "Surveyor Clearance",
      ...convertToSnakeKeys(itrData.contractorPart.clearances.surveyor),
      signed_date: itrData.contractorPart.clearances.surveyor?.date || "",
      signature_url: itrData.contractorPart.clearances.surveyor?.signature || "",
    },
    {
      section: "Interface Clearance",
      ...convertToSnakeKeys(itrData.contractorPart.clearances.interface),
      signed_date: itrData.contractorPart.clearances.interface?.date || "",
      signature_url: itrData.contractorPart.clearances.interface?.signature || "",
    },
  ];

  return {
    project_id: projectId,
    po_id: Number.isFinite(poIdNum) && poIdNum > 0 ? poIdNum : undefined,
    mir_id: Number.isFinite(mirIdNum) && mirIdNum > 0 ? mirIdNum : undefined,
    sample_id: String(itrData.sample_id || "").trim() || undefined,
    project_info: {
      project_name: itrData.projectName || "",
      project_code: itrData.projectCode || "",
      client_employer: itrData.clientEmployer || "",
      pmc_engineer: itrData.pmcEngineer || "",
      contractor: itrData.contractor || "",
      vendor_code: itrData.vendorCode || "",
      material_code: itrData.materialCode || "",
      work_order_no: itrData.workOrderNo || "",
    },
    itr_header: {
      itr_ref_no: itrData.itrRefNo || "",
      rev_no: itrData.revNo || "",
      submission_datetime: itrData.wirItrSubmissionDateTime || "",
      inspection_datetime: itrData.inspectionDateTime || "",
      submitted_to: itrData.submittedTo || "",
      submitted_by: itrData.submittedBy || "",
    },
    location: {
      tower_block_ref: itrData.contractorPart.locationRef || "",
      floor_level: itrData.contractorPart.floorLevel || "",
      room_area_ref: itrData.contractorPart.areaRef || "",
      grid_reference: itrData.contractorPart.gridReference || "",
    },
    discipline: selectedDisciplineApi,
    quantity: {
      previous_qty: Number(itrData.contractorPart.measurement.previousQty || 0),
      current_qty: Number(itrData.contractorPart.measurement.currentQty || 0),
      unit: itrData.contractorPart.measurement.unit || "",
    },
    description_of_work: itrData.contractorPart.descriptionOfWorks || "",
    work_items: (Array.isArray(itrData.workItems) ? itrData.workItems : []).map((item) => ({
      ...item,
      boq_id: item?.boq_id ?? item?.boqId ?? "",
      boq_qty: item?.boq_qty ?? item?.boqQty ?? item?.quantity ?? "",
    })),
    shaft_details: Array.isArray(itrData.shaftDetails) ? itrData.shaftDetails : [],
    attachments: {
      drawing_attached: yesNoNaToApi(itrData.contractorPart.attachments.drawingAttached),
      drawing_ref_no: itrData.contractorPart.attachments.specificDrawingRefNo || "",
      method_statement_attached: yesNoNaToApi(itrData.contractorPart.attachments.methodStatementAttached),
      test_certificates_attached: yesNoNaToApi(itrData.contractorPart.attachments.attachedTestCerts),
      checklist_attached: yesNoNaToApi(itrData.contractorPart.attachments.checklistAttached),
      joint_measurement_attached: yesNoNaToApi(itrData.contractorPart.attachments.jointMeasurementAttached),
    },
    part_a_contractor: {
      comments: itrData.contractorPart.contractorManagerComments || "",
      ready_for_inspection_date: itrData.contractorPart.readyForInspectionDate || "",
      ready_for_inspection_time: itrData.contractorPart.readyForInspectionTime || "",
      signed_by: itrData.contractorPart.readySignedBy || "",
      other_section_signoffs: signoffRows,
    },
    part_b_lodha_pmc: {
      comments: itrData.lodhaPmc.comments || "",
      inspection_code: itrData.lodhaPmc.resultCode || "",
      signoffs: [
        {
          role: "Engineer/Manager-CIVIL",
          name: itrData.lodhaPmc.signOffs.engineerManagerCivil?.name || "",
          signature_url: itrData.lodhaPmc.signOffs.engineerManagerCivil?.signature || "",
          signed_date: itrData.lodhaPmc.signOffs.engineerManagerCivil?.date || "",
        },
        {
          role: "Engineer/Manager-MEP",
          name: itrData.lodhaPmc.signOffs.engineerManagerMep?.name || "",
          signature_url: itrData.lodhaPmc.signOffs.engineerManagerMep?.signature || "",
          signed_date: itrData.lodhaPmc.signOffs.engineerManagerMep?.date || "",
        },
        {
          role: "Tower Incharge",
          name: itrData.lodhaPmc.signOffs.towerIncharge?.name || "",
          signature_url: itrData.lodhaPmc.signOffs.towerIncharge?.signature || "",
          signed_date: itrData.lodhaPmc.signOffs.towerIncharge?.date || "",
        },
        {
          role: "QAA Department",
          name: itrData.lodhaPmc.signOffs.qaaDepartment?.name || "",
          signature_url: itrData.lodhaPmc.signOffs.qaaDepartment?.signature || "",
          signed_date: itrData.lodhaPmc.signOffs.qaaDepartment?.date || "",
        },
      ],
    },
    dynamic_field: buildDynamicField(itrData),
    status: itrData.status || "DRAFT",
    allowed_values: {
      discipline: Object.values(DISCIPLINE_LABEL_TO_API),
      status: API_STATUS_OPTIONS,
      attachments: ["YES", "NO", "NA"],
      inspection_code: {
        CODE_1: "Work may proceed",
        CODE_2: "Conditionally approved. Work may proceed and resubmit incorporating comments",
        CODE_3: "Revise and Resubmit. Work may NOT proceed",
        CODE_4: "For information and records only. Work may proceed",
      },
    },
    user_id: user?.id ?? user?.user_id ?? user?.userId ?? null,
    user_name: user?.name ?? user?.full_name ?? user?.username ?? user?.email ?? "",
  };
};

const mapApiItrToForm = (rawItem = {}, normalizedItem = null) => {
  const normalized = normalizedItem || normalizeSnakeKeys(rawItem);
  const resolvedItrId =
    normalized.itrId ??
    normalized.itrID ??
    normalized.itr_id ??
    rawItem?.itr_id ??
    rawItem?.itrId ??
    normalized.id ??
    rawItem?.id ??
    null;
  const projectInfo = normalized.projectInfo || {};
  const itrHeader = normalized.itrHeader || {};
  const location = normalized.location || {};
  const quantity = normalized.quantity || {};
  const attachments = normalized.attachments || {};
  const partAContractor = normalized.partAContractor || {};
  const partBLodhaPmc = normalized.partBLodhaPmc || {};
  const contractorPart = normalized.contractorPart || {};
  const contractorClearances = contractorPart.clearances || {};
  const disciplineSource = contractorPart.discipline || normalized.discipline;
  const disciplineField = Array.isArray(disciplineSource)
    ? disciplineSource
    : typeof disciplineSource === "string" && disciplineSource.includes(",")
    ? disciplineSource.split(",").map((entry) => entry.trim()).filter(Boolean)
    : disciplineSource
    ? [disciplineSource]
    : Array.isArray(contractorPart.discipline)
    ? contractorPart.discipline
    : contractorPart.discipline
    ? [contractorPart.discipline]
    : [];

  const clearances = {
    ...EMPTY_ITR.contractorPart.clearances,
    ...contractorClearances,
    mep: { ...EMPTY_ITR.contractorPart.clearances.mep, ...contractorClearances.mep, ...normalized.mepClearance },
    surveyor: { ...EMPTY_ITR.contractorPart.clearances.surveyor, ...contractorClearances.surveyor, ...normalized.surveyorClearance },
    interface: { ...EMPTY_ITR.contractorPart.clearances.interface, ...contractorClearances.interface, ...normalized.interfaceClearance },
  };

  const contractorSection = {
    ...EMPTY_ITR.contractorPart,
    ...contractorPart,
    locationRef: contractorPart.locationRef || location.towerBlockRef || "",
    floorLevel: contractorPart.floorLevel || location.floorLevel || "",
    gridReference: contractorPart.gridReference || location.gridReference || "",
    areaRef: contractorPart.areaRef || location.roomAreaRef || "",
    discipline: disciplineField,
    measurement: {
      ...EMPTY_ITR.contractorPart.measurement,
      ...contractorPart.measurement,
      previousQty: contractorPart.measurement?.previousQty || quantity.previousQty || "",
      currentQty: contractorPart.measurement?.currentQty || quantity.currentQty || "",
      cumulativeQty:
        contractorPart.measurement?.cumulativeQty || quantity.cumulativeQty || String((Number(quantity.previousQty) || 0) + (Number(quantity.currentQty) || 0) || ""),
      unit: contractorPart.measurement?.unit || quantity.unit || "",
    },
    attachments: {
      ...EMPTY_ITR.contractorPart.attachments,
      ...contractorPart.attachments,
      drawingAttached: apiYesNoNaToUi(contractorPart.attachments?.drawingAttached || attachments.drawingAttached || ""),
      attachedTestCerts: apiYesNoNaToUi(contractorPart.attachments?.attachedTestCerts || attachments.testCertificatesAttached || ""),
      methodStatementAttached:
        apiYesNoNaToUi(
          contractorPart.attachments?.methodStatementAttached ||
            attachments.methodStatementAttached ||
            "",
        ),
      checklistAttached: apiYesNoNaToUi(contractorPart.attachments?.checklistAttached || attachments.checklistAttached || ""),
      jointMeasurementAttached: apiYesNoNaToUi(contractorPart.attachments?.jointMeasurementAttached || attachments.jointMeasurementAttached || ""),
      specificDrawingRefNo: contractorPart.attachments?.specificDrawingRefNo || attachments.drawingRefNo || "",
    },
    clearances,
    descriptionOfWorks: contractorPart.descriptionOfWorks || normalized.descriptionOfWork || "",
    contractorManagerComments: contractorPart.contractorManagerComments || partAContractor.comments || normalized.contractManager?.comments || "",
    readyForInspectionDate: contractorPart.readyForInspectionDate || partAContractor.readyForInspectionDate || normalized.contractManager?.readyForInspectionDate || "",
    readyForInspectionTime: contractorPart.readyForInspectionTime || partAContractor.readyForInspectionTime || normalized.contractManager?.readyForInspectionTime || "",
    readySignedBy: contractorPart.readySignedBy || partAContractor.signedBy || normalized.contractManager?.signedBy || "",
  };

  const lodhaRaw = normalized.lodhaPmc || {};
  const lodhaSignOffs = {
    ...EMPTY_ITR.lodhaPmc.signOffs,
    ...lodhaRaw.signOffs,
    engineerManagerCivil: { ...EMPTY_ITR.lodhaPmc.signOffs.engineerManagerCivil, ...lodhaRaw.signOffs?.engineerManagerCivil, ...normalized.engineerCivil },
    engineerManagerMep: { ...EMPTY_ITR.lodhaPmc.signOffs.engineerManagerMep, ...lodhaRaw.signOffs?.engineerManagerMep, ...normalized.engineerMep },
    towerIncharge: { ...EMPTY_ITR.lodhaPmc.signOffs.towerIncharge, ...lodhaRaw.signOffs?.towerIncharge, ...normalized.towerIncharge },
    qaaDepartment: { ...EMPTY_ITR.lodhaPmc.signOffs.qaaDepartment, ...lodhaRaw.signOffs?.qaaDepartment, ...normalized.qaaDepartment },
  };

  const lodhaSection = {
    ...EMPTY_ITR.lodhaPmc,
    ...lodhaRaw,
    comments: lodhaRaw.comments || partBLodhaPmc.comments || normalized.pmcComments || "",
    resultCode: lodhaRaw.resultCode || partBLodhaPmc.inspectionCode || normalized.resultCode || "",
    signOffs: lodhaSignOffs,
  };

  return {
    ...EMPTY_ITR,
    itr_id: resolvedItrId,
    project_id: normalized.projectId || normalized.project_id || projectInfo.projectId || "",
    po_id: normalized.poId || normalized.po_id || "",
    mir_id: normalized.mirId || normalized.mir_id || "",
    projectName: normalized.projectName || projectInfo.projectName || normalized.project || "",
    projectCode: normalized.projectCode || projectInfo.projectCode || "",
    clientEmployer: normalized.clientEmployer || normalized.clientName || normalized.client || projectInfo.clientEmployer || "",
    pmcEngineer: normalized.pmcEngineer || normalized.pmc || projectInfo.pmcEngineer || "",
    contractor: normalized.contractor || projectInfo.contractor || "",
    vendorCode: normalized.vendorCode || projectInfo.vendorCode || "",
    materialCode: normalized.materialCode || projectInfo.materialCode || "",
    workOrderNo: normalized.workOrderNo || projectInfo.workOrderNo || "",
    sample_id: normalized.sampleId || normalized.sample_id || rawItem?.sample_id || rawItem?.sampleId || "",
    itrRefNo: normalized.itrRefNo || normalized.itrRef || itrHeader.itrRefNo || "",
    revNo: normalized.revNo || itrHeader.revNo || "",
    wirItrSubmissionDateTime: normalized.wirItrSubmissionDateTime || itrHeader.submissionDatetime || "",
    inspectionDateTime: normalized.inspectionDateTime || normalized.inspectionDate || itrHeader.inspectionDatetime || "",
    submittedTo: normalized.submittedTo || itrHeader.submittedTo || "",
    submittedBy: normalized.submittedBy || itrHeader.submittedBy || "",
    workItems: Array.isArray(normalized.workItems) ? normalized.workItems : [],
    shaftDetails: Array.isArray(normalized.shaftDetails) ? normalized.shaftDetails : [],
    contractorPart: contractorSection,
    lodhaPmc: lodhaSection,
    source: normalized.source || "Manual",
    sourceFileName: normalized.sourceFileName || normalized.sourceFile || "",
    sourceFilePath: normalized.sourceFilePath || normalized.sourceFileName || normalized.sourceFile || "",
    status: normalized.status || "DRAFT",
    inspectionCode: normalized.inspectionCode || lodhaSection.resultCode || "",
    title: normalized.title || EMPTY_ITR.title,
  };
};

const mapStatusFromApi = (normalizedItem = {}) => {
  if (normalizedItem.status) return normalizedItem.status;
  const resultCode = normalizedItem.resultCode;
  if (resultCode) return resultCode;
  const status = normalizedItem.status || normalizedItem.statusCode || normalizedItem.state || normalizedItem.itrStatus;
  if (status) return status;
  const submitted = normalizedItem.itrSubmitted ?? normalizedItem.submitted ?? normalizedItem.itrSubmited;
  if (submitted === true || submitted === "true") return "Submitted";
  if (submitted === false || submitted === "false") return "Draft";
  return "Submitted";
};

const mapApiItrToListItem = (rawItem) => {
  const normalized = normalizeSnakeKeys(rawItem);
  const formData = mapApiItrToForm(rawItem, normalized);
  const id = formData.itrRefNo || formData.itr_id || `ITR-${formData.itr_id || Date.now()}`;
  const inspectionCode = normalized.partBLodhaPmc?.inspectionCode || formData.lodhaPmc?.resultCode || "";
  return {
    id,
    date: formData.inspectionDateTime || formData.wirItrSubmissionDateTime || normalized.createdAt || "",
    project: formData.projectName || "",
    location: formData.contractorPart.areaRef || formData.contractorPart.floorLevel || formData.contractorPart.locationRef || "",
    status: mapStatusFromApi(normalized),
    inspectionCode,
    itr_id: formData.itr_id,
    payload: formData,
  };
};

function loadStoredItr() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadRecentItrs() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentItrs(items) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(items));
}

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function setPathValue(base, path, value) {
  const parts = path.split('.');
  const next = { ...base };
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    cursor[key] = Array.isArray(cursor[key]) ? [...cursor[key]] : { ...cursor[key] };
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

function extractValueFromLine(line, regex) {
  const match = line.match(new RegExp(`${regex.source}\\s*[:-]?\\s*(.+)$`, regex.flags));
  if (match && match[1]) return match[1].trim();
  return "";
}

function normalizeText(text) {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parsePdfText(text) {
  if (!text) return null;
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let next = { ...EMPTY_ITR, source: "Extracted" };

  for (const line of lines) {
    LABEL_MAP.forEach(({ re, path }) => {
      if (re.test(line)) {
        const value = extractValueFromLine(line, re);
        if (value) {
          next = setPathValue(next, path, value);
        }
      }
    });

    if (/description\s*of\s*works|description\s*of\s*works\s*\/\s*activity/i.test(line)) {
      const value = line.replace(/.*description\s*of\s*works\s*\/\s*activity\s*for\s*which\s*inspection\s*is\s*requested\s*for\s*:?/i, '').trim();
      if (value) {
        next = setPathValue(next, "contractorPart.descriptionOfWorks", value);
      }
    }
  }

  if (!next.contractorPart.descriptionOfWorks) {
    const descIndex = lines.findIndex((line) => /description\s*of\s*works|description\s*of\s*works\s*\/\s*activity/i.test(line));
    if (descIndex !== -1) {
      const tail = lines.slice(descIndex + 1, descIndex + 5).join("\n").trim();
      if (tail) {
        next = setPathValue(next, "contractorPart.descriptionOfWorks", tail);
      }
    }
  }

  ATTACHMENT_LABELS.forEach(({ re, path }) => {
    const match = lines.find((line) => re.test(line));
    if (match) {
      const value = extractValueFromLine(match, re);
      if (value) {
        next = setPathValue(next, path, value);
      }
    }
  });

  return next;
}

function parseSheetToFields(rows) {
  if (!rows || rows.length === 0) return null;
  let next = { ...EMPTY_ITR, source: "Extracted" };

  rows.forEach((row) => {
    if (!row || row.length === 0) return;
    const [label, value] = row;
    if (!label || value == null) return;
    LABEL_MAP.forEach(({ re, path }) => {
      if (re.test(String(label))) {
        next = setPathValue(next, path, String(value).trim());
      }
    });
    if (/description\s*of\s*works|description\s*of\s*works\s*\/\s*activity/i.test(String(label))) {
      next = setPathValue(next, "contractorPart.descriptionOfWorks", String(value).trim());
    }
    ATTACHMENT_LABELS.forEach(({ re, path }) => {
      if (re.test(String(label))) {
        next = setPathValue(next, path, String(value).trim());
      }
    });
  });

  return next;
}

export default function ITR() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const [itrData, setItrData] = useState(() => loadStoredItr() || EMPTY_ITR);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recentItrs, setRecentItrs] = useState(() => loadRecentItrs());
  const [loadingItrs, setLoadingItrs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [updatingStatusIds, setUpdatingStatusIds] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingClearanceSignature, setUploadingClearanceSignature] = useState({});
  const [uploadingSignOffSignature, setUploadingSignOffSignature] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingItr, setDeletingItr] = useState(false);
  const [projectOptions, setProjectOptions] = useState([]);
  const [poOptions, setPoOptions] = useState([]);
  const [mirOptions, setMirOptions] = useState([]);
  const [sampleOptions, setSampleOptions] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const { selectedProject, projects } = useProject();
  const { user } = useAuth();
  const projectId = selectedProject?.id ?? selectedProject?.project_id ?? routeProjectId ?? null;
  const effectiveProjectId = Number(itrData.project_id || projectId || 0) || null;
  const resolvedProjectRouteId = String(
    selectedProject?.project_id ?? selectedProject?.id ?? itrData.project_id ?? routeProjectId ?? ""
  ).trim();
  const isManualEntryPage = useMemo(() => String(location.pathname || '').endsWith('/itr/manual'), [location.pathname]);
  const [createTab, setCreateTab] = useState(() => (isManualEntryPage ? 'manual' : 'upload'));
  const showLegacyCreateSection = useMemo(() => String(location.pathname || '').includes('__legacy__'), [location.pathname]);

  const navigateToPreview = useCallback(
    (options = undefined) => {
      if (resolvedProjectRouteId) {
        navigate(`/${resolvedProjectRouteId}/itr/create`, options);
      } else {
        // Fallback: relative navigation (should be rare, but avoids hard crash).
        navigate("preview", options);
      }
    },
    [navigate, resolvedProjectRouteId]
  );

  useEffect(() => {
    if (isManualEntryPage) setCreateTab('manual');
    else setCreateTab('upload');
  }, [isManualEntryPage]);

  // Default clearance dates to today for new/manual ITRs so the date picker is pre-filled.
  useEffect(() => {
    if (createTab !== "manual") return;
    const today = todayDateOnly();
    setItrData((prev) => {
      const clearances = prev?.contractorPart?.clearances || {};
      const keys = ["mep", "surveyor", "interface"];
      const nextClearances = { ...clearances };
      let changed = false;
      keys.forEach((k) => {
        const current = nextClearances[k] || {};
        if (!String(current.date || "").trim()) {
          nextClearances[k] = { ...current, date: today };
          changed = true;
        }
      });
      if (!changed) return prev;
      return {
        ...prev,
        contractorPart: { ...prev.contractorPart, clearances: nextClearances },
      };
    });
  }, [createTab]);

  // Default Lodha PMC sign-off dates to today in manual mode.
  useEffect(() => {
    if (createTab !== "manual") return;
    const today = todayDateOnly();
    setItrData((prev) => {
      const signOffs = prev?.lodhaPmc?.signOffs || {};
      const keys = ["engineerManagerCivil", "engineerManagerMep", "towerIncharge", "qaaDepartment"];
      const nextSignOffs = { ...signOffs };
      let changed = false;
      keys.forEach((k) => {
        const current = nextSignOffs[k] || {};
        if (!String(current.date || "").trim()) {
          nextSignOffs[k] = { ...current, date: today };
          changed = true;
        }
      });
      if (!changed) return prev;
      return {
        ...prev,
        lodhaPmc: { ...prev.lodhaPmc, signOffs: nextSignOffs },
      };
    });
  }, [createTab]);

  useEffect(() => {
    if (!selectedProject) return;
    const resolvedId = selectedProject?.project_id ?? selectedProject?.id ?? "";
    if (!resolvedId) return;
    setItrData((prev) => {
      // Keep project id in sync with the selected project (manual ITRs should auto-pick the project).
      if (String(prev.project_id || "").trim() === String(resolvedId).trim()) return prev;
      return {
        ...prev,
        project_id: String(resolvedId),
        projectName: prev.projectName || selectedProject.project_name || selectedProject.name || "",
        projectCode: prev.projectCode || selectedProject.project_code || selectedProject.projectCode || "",
        sample_id: "",
        workItems: [],
        source: prev.source || "Manual",
      };
    });
  }, [selectedProject]);

  const handleDownloadItr = useCallback(
    async (item) => {
      const itrId = item?.itr_id;
      if (!itrId) {
        toast({
          title: "Download unavailable",
          description: "This ITR doesn't have an ID yet.",
          variant: "destructive",
        });
        return;
      }

      try {
        await downloadItrPdf(item?.payload || item, { itrId });
      } catch (e) {
        console.error(e);
        toast({
          title: "Download failed",
          description: "Could not generate the ITR PDF.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    saveRecentItrs(recentItrs);
  }, [recentItrs]);

  const fetchItrs = useCallback(async () => {
    setLoadingItrs(true);
    try {
      const res = projectId ? await api.getItrsByProject(projectId) : await api.getItrs();
      const data =
        Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.rows)
          ? res.data.rows
          : Array.isArray(res.data?.itrs)
          ? res.data.itrs
          : null;

      if (res.success && Array.isArray(data)) {
        const mapped = data.map(mapApiItrToListItem);
        setRecentItrs(mapped);
        setStatusDrafts((prev) => {
          const next = { ...prev };
          mapped.forEach((item) => {
            if (!item?.itr_id) return;
            const key = String(item.itr_id);
            next[key] = {
              status: next[key]?.status || item.status || "DRAFT",
              inspectionCode: next[key]?.inspectionCode || item.inspectionCode || "",
              lodhaPmcComments: next[key]?.lodhaPmcComments || "",
            };
          });
          return next;
        });
      } else {
        if (res?.error && res?.status !== 404 && !/not found/i.test(String(res.error))) {
          toast({ title: "Error", description: res.error, variant: "destructive" });
        }
        setRecentItrs(loadRecentItrs());
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load ITRs.", variant: "destructive" });
      setRecentItrs(loadRecentItrs());
    } finally {
      setLoadingItrs(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchItrs();
  }, [fetchItrs]);

  useEffect(() => {
    setProjectOptions(Array.isArray(projects) ? projects : []);
  }, [projects]);

  const filteredRecentItrs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return recentItrs;
    return recentItrs.filter((item) => {
      const haystack = [
        item?.id,
        item?.itr_id,
        item?.date,
        item?.project,
        item?.location,
        item?.status,
        item?.inspectionCode,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [recentItrs, searchQuery]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!effectiveProjectId) {
        setPoOptions([]);
        setMirOptions([]);
        return;
      }

      try {
        const [poRes, mirRes] = await Promise.all([
          api.getPosByProject(effectiveProjectId),
          api.getMirsByProject(effectiveProjectId),
        ]);
        if (!active) return;
        setPoOptions(poRes?.success && Array.isArray(poRes.data) ? poRes.data : []);
        setMirOptions(mirRes?.success && Array.isArray(mirRes.data) ? mirRes.data : []);
      } catch {
        if (!active) return;
        setPoOptions([]);
        setMirOptions([]);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [effectiveProjectId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!effectiveProjectId) {
        setSampleOptions([]);
        return;
      }
      setLoadingSamples(true);
      try {
        const res = await api.getSamplesByProject(effectiveProjectId);
        if (!active) return;
        setSampleOptions(res?.success && Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!active) return;
        setSampleOptions([]);
      } finally {
        if (active) setLoadingSamples(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [effectiveProjectId]);

  const hasPreview = useMemo(() => {
    return itrData.projectName || itrData.itrRefNo || itrData.contractorPart.descriptionOfWorks;
  }, [itrData]);

  const setContractorPart = (key, value) => {
    setItrData((prev) => ({
      ...prev,
      contractorPart: { ...prev.contractorPart, [key]: value },
    }));
  };

  const setMeasurement = (key, value) => {
    setItrData((prev) => ({
      ...prev,
      contractorPart: {
        ...prev.contractorPart,
        measurement: { ...prev.contractorPart.measurement, [key]: value },
      },
    }));
  };

  const setAttachment = (key, value) => {
    setItrData((prev) => ({
      ...prev,
      contractorPart: {
        ...prev.contractorPart,
        attachments: { ...prev.contractorPart.attachments, [key]: value },
      },
    }));
  };

  const setClearance = (key, field, value) => {
    setItrData((prev) => ({
      ...prev,
      contractorPart: {
        ...prev.contractorPart,
        clearances: {
          ...prev.contractorPart.clearances,
          [key]: { ...prev.contractorPart.clearances[key], [field]: value },
        },
      },
    }));
  };

  const uploadClearanceSignature = async (clearanceKey, file) => {
    if (!file) return;
    setUploadingClearanceSignature((prev) => ({ ...prev, [clearanceKey]: true }));
    try {
      const uploadRes = await api.uploadItrReference(file, {
        user_id: user?.id ?? user?.user_id ?? user?.userId ?? "",
        user_name: user?.name ?? user?.username ?? user?.full_name ?? user?.fullName ?? user?.email ?? "",
      });
      if (!uploadRes?.success) {
        toast({ title: "Upload failed", description: uploadRes?.error || "Could not upload signature.", variant: "destructive" });
        return;
      }
      const path = uploadRes?.data?.filePath || uploadRes?.data?.path || "";
      if (!path) {
        toast({ title: "Upload failed", description: "No file path returned for signature.", variant: "destructive" });
        return;
      }
      setClearance(clearanceKey, "signature", path);
      toast({ title: "Uploaded", description: "Signature uploaded." });
    } catch (e) {
      toast({ title: "Upload failed", description: e?.message || "Could not upload signature.", variant: "destructive" });
    } finally {
      setUploadingClearanceSignature((prev) => ({ ...prev, [clearanceKey]: false }));
    }
  };

  const uploadSignOffSignature = async (signOffKey, file) => {
    if (!file) return;
    setUploadingSignOffSignature((prev) => ({ ...prev, [signOffKey]: true }));
    try {
      const uploadRes = await api.uploadItrReference(file, {
        user_id: user?.id ?? user?.user_id ?? user?.userId ?? "",
        user_name: user?.name ?? user?.username ?? user?.full_name ?? user?.fullName ?? user?.email ?? "",
      });
      if (!uploadRes?.success) {
        toast({ title: "Upload failed", description: uploadRes?.error || "Could not upload signature.", variant: "destructive" });
        return;
      }
      const path = uploadRes?.data?.filePath || uploadRes?.data?.path || "";
      if (!path) {
        toast({ title: "Upload failed", description: "No file path returned for signature.", variant: "destructive" });
        return;
      }
      setSignOff(signOffKey, "signature", path);
      toast({ title: "Uploaded", description: "Signature uploaded." });
    } catch (e) {
      toast({ title: "Upload failed", description: e?.message || "Could not upload signature.", variant: "destructive" });
    } finally {
      setUploadingSignOffSignature((prev) => ({ ...prev, [signOffKey]: false }));
    }
  };

  const setSignOff = (key, field, value) => {
    setItrData((prev) => ({
      ...prev,
      lodhaPmc: {
        ...prev.lodhaPmc,
        signOffs: {
          ...prev.lodhaPmc.signOffs,
          [key]: { ...prev.lodhaPmc.signOffs[key], [field]: value },
        },
      },
    }));
  };

  const setInspectionCode = (value) => {
    setItrData((prev) => ({
      ...prev,
      inspectionCode: value,
      lodhaPmc: { ...prev.lodhaPmc, resultCode: value },
    }));
  };

  const updateWorkItem = (index, field, value) => {
    setItrData((prev) => {
      const current = Array.isArray(prev.workItems) ? [...prev.workItems] : [];
      current[index] = { ...(current[index] || {}), [field]: value };
      return { ...prev, workItems: current };
    });
  };

  const addWorkItem = () => {
    setItrData((prev) => ({
      ...prev,
      workItems: [...(Array.isArray(prev.workItems) ? prev.workItems : []), { item_description: "", size: "", quantity: 0, unit: "", boq_id: "", boq_qty: "" }],
    }));
  };

  const removeWorkItem = (index) => {
    setItrData((prev) => ({
      ...prev,
      workItems: (Array.isArray(prev.workItems) ? prev.workItems : []).filter((_, idx) => idx !== index),
    }));
  };

  const updateShaftDetail = (index, field, value) => {
    setItrData((prev) => {
      const current = Array.isArray(prev.shaftDetails) ? [...prev.shaftDetails] : [];
      current[index] = { ...(current[index] || {}), [field]: value };
      return { ...prev, shaftDetails: current };
    });
  };

  const addShaftDetail = () => {
    setItrData((prev) => ({
      ...prev,
      shaftDetails: [...(Array.isArray(prev.shaftDetails) ? prev.shaftDetails : []), { shaft_no: "", staff_id: "", staff_name: "", staff_number: "" }],
    }));
  };

  const removeShaftDetail = (index) => {
    setItrData((prev) => ({
      ...prev,
      shaftDetails: (Array.isArray(prev.shaftDetails) ? prev.shaftDetails : []).filter((_, idx) => idx !== index),
    }));
  };

  const getSampleItemLabel = (row = {}) =>
    String(
      row?.item_name ||
        row?.itemName ||
        row?.description ||
        row?.item_description ||
        row?.itemDescription ||
        row?.material_description ||
        row?.name ||
        "-"
    ).trim();

  const getSampleItemCode = (row = {}) =>
    String(row?.item_code || row?.itemCode || row?.code || row?.boq_id || row?.boqId || "").trim();

  const getSampleItemQty = (row = {}) =>
    String(row?.quantity ?? row?.qty ?? row?.selected_qty ?? row?.total_qty ?? row?.boq_qty ?? "").trim();

  const getSampleItemUnit = (row = {}) =>
    String(row?.unit || row?.uom || row?.measurement_unit || "").trim();

  const mapSampleRowToWorkItem = (row = {}) => ({
    item_description: getSampleItemLabel(row),
    size: String(row?.specification || row?.spec || row?.brand_name || row?.brandName || "").trim(),
    quantity: getSampleItemQty(row),
    unit: getSampleItemUnit(row),
    boq_id: String(row?.boq_id ?? row?.boqId ?? "").trim(),
    boq_qty: String(row?.boq_qty ?? row?.boqQty ?? row?.quantity ?? row?.qty ?? "").trim(),
    boq_issued_qty: String(row?.boq_issued_qty ?? row?.boqIssuedQty ?? row?.issued_qty ?? row?.issuedQty ?? "").trim(),
    boq_remaining_quantity: String(row?.boq_remaining_quantity ?? row?.boqRemainingQuantity ?? "").trim(),
    boq_code: getSampleItemCode(row),
    boq_description: String(row?.boq_description || row?.description || "").trim(),
  });

  const mapSampleToWorkItems = (sample = {}) => {
    const rows = Array.isArray(sample?.item_description)
      ? sample.item_description
      : Array.isArray(sample?.items)
        ? sample.items
        : Array.isArray(sample?.item_descriptions)
          ? sample.item_descriptions
          : [];
    return rows.map((row) => mapSampleRowToWorkItem(row));
  };

  const selectedSample = useMemo(
    () => sampleOptions.find((sample) => String(sample?.sample_id ?? sample?.id ?? "") === String(itrData.sample_id || "")) || null,
    [itrData.sample_id, sampleOptions]
  );

  const sampleWorkItems = useMemo(() => mapSampleToWorkItems(selectedSample || {}), [selectedSample]);
  const sampleWorkItemKeys = useMemo(
    () => sampleWorkItems.map((_, index) => `${String(itrData.sample_id || "")}-${index}`),
    [itrData.sample_id, sampleWorkItems]
  );
  const selectedSampleItemKeys = Array.isArray(itrData.selectedSampleItemKeys) ? itrData.selectedSampleItemKeys : [];
  const selectedSampleItems = useMemo(
    () =>
      sampleWorkItems.filter((_, index) => selectedSampleItemKeys.includes(`${String(itrData.sample_id || "")}-${index}`)),
    [itrData.sample_id, sampleWorkItems, selectedSampleItemKeys]
  );
  const buildSampleDescription = (rows = []) =>
    rows
      .map((row, index) => {
        const parts = [];
        const label = row.item_description || row.boq_id || row.boq_code || `Item ${index + 1}`;
        parts.push(`${index + 1}. ${label}`);
        if (row.size) parts.push(`Size: ${row.size}`);
        if (row.quantity) parts.push(`Qty: ${row.quantity}${row.unit ? ` ${row.unit}` : ""}`);
        return parts.join(" - ");
      })
      .join("\n");

  useEffect(() => {
    const selectedKeys = Array.isArray(itrData.selectedSampleItemKeys) ? itrData.selectedSampleItemKeys : [];
    const nextDescription = buildSampleDescription(selectedSampleItems);
    if (itrData.contractorPart.descriptionOfWorks !== nextDescription) {
      setContractorPart("descriptionOfWorks", nextDescription);
    }
    if (!itrData.sample_id || sampleWorkItems.length === 0) {
      if (selectedKeys.length > 0) {
        setItrData((prev) => ({ ...prev, selectedSampleItemKeys: [] }));
      }
      return;
    }
    setItrData((prev) => {
      const currentSampleId = String(prev.sample_id || "");
      if (currentSampleId !== String(itrData.sample_id || "")) return prev;
      const nextWorkItems = selectedSampleItems.length ? selectedSampleItems : [];
      const nextKeys = Array.isArray(prev.selectedSampleItemKeys) ? prev.selectedSampleItemKeys : [];
      if (JSON.stringify(prev.workItems || []) === JSON.stringify(nextWorkItems) && JSON.stringify(nextKeys) === JSON.stringify(selectedKeys)) return prev;
      return { ...prev, workItems: nextWorkItems, selectedSampleItemKeys: selectedKeys };
    });
  }, [itrData.sample_id, itrData.contractorPart.descriptionOfWorks, sampleWorkItems, selectedSampleItems]);

  const handleSampleChange = (value) => {
    const nextSampleId = String(value || "").trim();
    const nextSample = sampleOptions.find((sample) => String(sample?.sample_id ?? sample?.id ?? "") === nextSampleId) || null;
    setItrData((prev) => ({
      ...prev,
      sample_id: nextSampleId,
      workItems: [],
      selectedSampleItemKeys: [],
      contractorPart: { ...prev.contractorPart, descriptionOfWorks: "" },
    }));
  };

  const getSampleRowKey = (index) => `${String(itrData.sample_id || "")}-${index}`;
  const isSampleRowSelected = (index) => selectedSampleItemKeys.includes(getSampleRowKey(index));
  const toggleSampleRowSelection = (index, checked) => {
    const key = getSampleRowKey(index);
    setItrData((prev) => {
      const currentKeys = Array.isArray(prev.selectedSampleItemKeys) ? prev.selectedSampleItemKeys : [];
      const nextKeys = checked ? [...new Set([...currentKeys, key])] : currentKeys.filter((item) => item !== key);
      const nextRows = sampleWorkItems.filter((_, rowIndex) => nextKeys.includes(getSampleRowKey(rowIndex)));
      return {
        ...prev,
        selectedSampleItemKeys: nextKeys,
        workItems: nextRows,
        contractorPart: { ...prev.contractorPart, descriptionOfWorks: buildSampleDescription(nextRows) },
      };
    });
  };

  const toggleAllSampleRows = (checked) => {
    const nextKeys = checked ? sampleWorkItemKeys : [];
    const nextRows = checked ? sampleWorkItems : [];
    setItrData((prev) => ({
      ...prev,
      selectedSampleItemKeys: nextKeys,
      workItems: nextRows,
      contractorPart: { ...prev.contractorPart, descriptionOfWorks: buildSampleDescription(nextRows) },
    }));
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const isSample = file.name.toLowerCase().includes("wir 47");
      let next = isSample ? { ...SAMPLE_EXTRACTED } : { ...EMPTY_ITR, source: "Extracted", sourceFileName: file.name };
      let uploadedPath = "";

      const uploadRes = await api.uploadItrReference(file, {
        user_id: user?.id ?? user?.user_id ?? user?.userId ?? "",
        user_name: user?.name ?? user?.username ?? user?.full_name ?? user?.fullName ?? user?.email ?? "",
      });
      if (uploadRes?.success) {
        uploadedPath = uploadRes?.data?.filePath || uploadRes?.data?.path || "";
      }

      const ext = file.name.toLowerCase();
      if (ext.endsWith(".pdf")) {
        const raw = await extractTextFromPdf(file, { preserveLines: true, fullDocument: true, maxPages: 2 });
        const parsed = parsePdfText(normalizeText(raw));
        if (parsed) next = { ...next, ...parsed };
      } else if (ext.endsWith(".xlsx") || ext.endsWith(".xls") || ext.endsWith(".csv")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
        const parsed = parseSheetToFields(rows);
        if (parsed) next = { ...next, ...parsed };
      }

      next = {
        ...next,
        source: "Extracted",
        sourceFileName: file.name,
        sourceFilePath: uploadedPath || next.sourceFilePath || "",
      };

      setItrData(next);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      navigateToPreview();
    } catch (error) {
      toast({ title: "Upload failed", description: error?.message || "Could not extract ITR document.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const [file] = Array.from(event.dataTransfer.files || []);
    handleFile(file);
  };

  const handlePreview = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(itrData));
    }
    navigateToPreview();
  };

  const handleSubmit = async () => {
    if (!effectiveProjectId) {
      toast({
        title: "Select project",
        description: "Choose a project before submitting an ITR.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = buildItrPayload(itrData, effectiveProjectId, user);
      const updateId = itrData.itr_id ?? null;
      let didFallbackCreate = false;
      let response = updateId ? await api.updateItr(updateId, payload) : await api.createItr(payload);

      // If the client has a stale/non-existent itr_id, updating returns 404.
      // In that case, fall back to creating a new ITR.
      if (!response?.success && response?.status === 404 && updateId) {
        didFallbackCreate = true;
        response = await api.createItr({ ...payload, itr_id: undefined, id: undefined });
      }

      if (!response.success) {
        toast({ title: "Error", description: response.error || "Failed to submit ITR.", variant: "destructive" });
        return;
      }

      const savedItrId = response?.data?.itr_id ?? response?.data?.id ?? updateId ?? null;
      setItrData((prev) => ({
        ...prev,
        itr_id: savedItrId,
        status: prev.status || "DRAFT",
      }));

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...itrData,
            itr_id: savedItrId,
            status: itrData.status || "DRAFT",
          }),
        );
      }

      toast({
        title: "ITR saved",
        description: updateId && !didFallbackCreate ? "Your ITR has been updated." : "Your ITR has been submitted.",
      });
      await fetchItrs();
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || "Failed to submit ITR.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setItrData(EMPTY_ITR);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    clearStoredItrDraft();
  };

  const clearStoredItrDraft = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const requestDeleteItr = (item) => {
    if (!item) return;
    setDeleteTarget(item);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteItr = async () => {
    const item = deleteTarget;
    if (!item || deletingItr) return;
    setDeletingItr(true);
    try {
      if (item.itr_id) {
        const res = await api.deleteItr(item.itr_id);
        if (res?.success) {
          toast({ title: "ITR deleted", description: "The ITR entry was removed." });
          clearStoredItrDraft();
          await fetchItrs();
          setDeleteDialogOpen(false);
          setDeleteTarget(null);
          return;
        }
        toast({ title: "Error", description: res?.error || "Failed to delete ITR.", variant: "destructive" });
        return;
      }

      setRecentItrs((prev) => prev.filter((entry) => entry.id !== item.id));
      clearStoredItrDraft();
      toast({ title: "ITR removed", description: "The local ITR record was removed." });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to delete ITR.", variant: "destructive" });
    } finally {
      setDeletingItr(false);
    }
  };

  const handleStatusDraftChange = (itrId, field, value) => {
    if (!itrId) return;
    const key = String(itrId);
    setStatusDrafts((prev) => ({
      ...prev,
      [key]: {
        status: prev[key]?.status || "DRAFT",
        inspectionCode: prev[key]?.inspectionCode || "",
        lodhaPmcComments: prev[key]?.lodhaPmcComments || "",
        [field]: value,
      },
    }));
  };

  const handleUpdateStatus = async (item) => {
    const itrId = item?.itr_id;
    if (!itrId) return;
    const key = String(itrId);
    const draft = statusDrafts[key] || {};

    if (!draft.status) {
      toast({ title: "Missing status", description: "Select a workflow status first.", variant: "destructive" });
      return;
    }

    setUpdatingStatusIds((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await api.updateItrStatus(itrId, {
        status: draft.status,
        inspection_code: draft.inspectionCode || "",
        lodha_pmc_comments: draft.lodhaPmcComments || "",
        user_id: user?.id ?? user?.user_id ?? user?.userId ?? null,
        user_name: user?.name ?? user?.full_name ?? user?.username ?? user?.email ?? "",
      });
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to update ITR status.", variant: "destructive" });
        return;
      }
      toast({ title: "Status updated", description: "Approval workflow status updated." });
      await fetchItrs();
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to update ITR status.", variant: "destructive" });
    } finally {
      setUpdatingStatusIds((prev) => ({ ...prev, [key]: false }));
    }
  };


  const handleEditRecent = async (item) => {
    if (!item) return;

    if (item.itr_id) {
      try {
        const res = await api.getItrById(item.itr_id);
        if (!res.success) {
          toast({ title: "Error", description: res.error || "Failed to load ITR.", variant: "destructive" });
          return;
        }
        const formData = mapApiItrToForm(res.data);
        setItrData(formData);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        }
        navigateToPreview({ state: { itrId: formData.itr_id } });
        return;
      } catch (error) {
        toast({
          title: "Error",
          description: error?.message || "Failed to load ITR.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!item?.payload) {
      toast({ title: "Cannot edit", description: "Saved ITR data is not available.", variant: "destructive" });
      return;
    }
    setItrData(item.payload);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(item.payload));
    }
    navigateToPreview({ state: { itrId: item.payload?.itr_id ?? null } });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setItrData(JSON.parse(raw));
      } catch {
        setItrData(EMPTY_ITR);
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete ITR</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {deleteTarget?.itr_id
                ? `ITR #${deleteTarget.itr_id}`
                : deleteTarget?.id
                  ? `this local ITR (${deleteTarget.id})`
                  : "this ITR"}
            </span>
            ?
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deletingItr}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteItr} disabled={deletingItr}>
              {deletingItr ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Installation Test Reports (ITR)</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">View, edit, and manage work inspection requests.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            className="w-full lg:w-auto"
            disabled={!resolvedProjectRouteId}
            onClick={() => navigate(`/${resolvedProjectRouteId}/itr/create`)}
          >
            <PencilLine className="mr-2 h-4 w-4" /> Create ITR
          </Button>
        </div>
      </div>

      {showLegacyCreateSection ? (
      <Card>
        <CardHeader>
          <CardTitle>Create / Extract ITR</CardTitle>
          <CardDescription>Upload a WIR/ITR file for extraction or fill the form manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={createTab} onValueChange={setCreateTab} className="w-full">
            <TabsList className={`w-full grid border-b bg-transparent p-0 ${isManualEntryPage ? "grid-cols-1" : "grid-cols-2"}`}>
              {!isManualEntryPage ? (
                <TabsTrigger
                  value="upload"
                  className="gap-2 w-full justify-center rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
                >
                  <FileUp className="h-4 w-4" /> Upload & Extract
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                value="manual"
                onClick={(event) => {
                  if (!isManualEntryPage) {
                    event.preventDefault();
                    navigate('manual');
                  }
                }}
                className="gap-2 w-full justify-center rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
              >
                <PencilLine className="h-4 w-4" /> Manual Entry
              </TabsTrigger>
            </TabsList>

            {!isManualEntryPage ? (
            <TabsContent value="upload">
              <div
                className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsDragging(false);
                  }
                }}
                onDrop={handleDrop}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="text-sm font-medium">Upload ITR PDF/XLSX/CSV</div>
                <div className="text-xs text-muted-foreground">Drag and drop or click to upload</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={uploading}
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {uploading ? "Extracting..." : "Choose File"}
                </Button>
                {itrData.sourceFileName ? (
                  <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                    <div>Selected: {itrData.sourceFileName}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleClear();
                      }}
                    >
                      Remove File
                    </Button>
                  </div>
                ) : null}
              </div>
            </TabsContent>
            ) : null}

            <TabsContent value="manual">
                <div className="manual-entry-panel">
                  <div className="manual-entry-grid md:grid-cols-2">
                  <Field label="Project ID">
                    {selectedProject?.project_id || selectedProject?.id ? (
                      <Input value={String(selectedProject?.project_id ?? selectedProject?.id)} readOnly />
                    ) : (
                      <Select
                        value={itrData.project_id ? String(itrData.project_id) : undefined}
                        onValueChange={(value) => {
                          const selected = projectOptions.find((item) => String(item.project_id ?? item.id) === value);
                          setItrData((prev) => ({
                            ...prev,
                            project_id: value,
                            po_id: "",
                            mir_id: "",
                            sample_id: "",
                            workItems: [],
                            projectName: selected?.project_name || selected?.projectName || prev.projectName,
                            projectCode: selected?.project_code || selected?.projectCode || prev.projectCode,
                            source: "Manual",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Project ID" />
                        </SelectTrigger>
                        <SelectContent>
                          {projectOptions.map((item) => {
                            const id = item.project_id ?? item.id;
                            const name = item.project_name || item.projectName || `Project ${id}`;
                            return (
                              <SelectItem key={`itr-project-${id}`} value={String(id)}>
                                {id} - {name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label="PO ID">
                    <Select
                      value={itrData.po_id ? String(itrData.po_id) : undefined}
                      onValueChange={(value) => setItrData((prev) => ({ ...prev, po_id: value, source: "Manual" }))}
                      disabled={!effectiveProjectId || poOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={effectiveProjectId ? "Select PO ID" : "Select project first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {poOptions.map((item) => {
                          const id = item.po_id ?? item.id;
                          const label = item.order_no || item.indent_no || item.vendor_name || `PO ${id}`;
                          return (
                            <SelectItem key={`itr-po-${id}`} value={String(id)}>
                              {id} - {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="MIR ID">
                    <Select
                      value={itrData.mir_id ? String(itrData.mir_id) : undefined}
                      onValueChange={(value) => setItrData((prev) => ({ ...prev, mir_id: value, source: "Manual" }))}
                      disabled={!effectiveProjectId || mirOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={effectiveProjectId ? "Select MIR ID" : "Select project first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {mirOptions.map((item) => {
                          const id = item.mir_id ?? item.id;
                          const label = item.mir_refrence_no || item.challan_no || `MIR ${id}`;
                          return (
                            <SelectItem key={`itr-mir-${id}`} value={String(id)}>
                              {id} - {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Sample ID">
                    <Select
                      value={itrData.sample_id ? String(itrData.sample_id) : undefined}
                      onValueChange={handleSampleChange}
                      disabled={!effectiveProjectId || loadingSamples}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={effectiveProjectId ? (loadingSamples ? "Loading samples..." : "Select sample") : "Select project first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleOptions.map((item) => {
                          const id = String(item?.sample_id ?? item?.id ?? "").trim();
                          if (!id) return null;
                          const label = item?.work_done || item?.site_name || item?.building_name || `Sample ${id}`;
                          return (
                            <SelectItem key={`itr-sample-${id}`} value={id}>
                              {id} - {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select
                      value={itrData.status || "DRAFT"}
                      onValueChange={(value) => setItrData((prev) => ({ ...prev, status: value, source: "Manual" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {API_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={`manual-status-${status}`} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Project Name">
                    <Input
                      value={itrData.projectName}
                      onChange={(event) => setItrData((prev) => ({ ...prev, projectName: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Project Code">
                    <Input
                      value={itrData.projectCode}
                      onChange={(event) => setItrData((prev) => ({ ...prev, projectCode: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Client / Employer">
                    <Input
                      value={itrData.clientEmployer}
                      onChange={(event) => setItrData((prev) => ({ ...prev, clientEmployer: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="PMC / Engineer">
                    <Input
                      value={itrData.pmcEngineer}
                      onChange={(event) => setItrData((prev) => ({ ...prev, pmcEngineer: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Contractor">
                    <Input
                      value={itrData.contractor}
                      onChange={(event) => setItrData((prev) => ({ ...prev, contractor: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Vendor Code">
                    <Input
                      value={itrData.vendorCode}
                      onChange={(event) => setItrData((prev) => ({ ...prev, vendorCode: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Material Code">
                    <Input
                      value={itrData.materialCode}
                      onChange={(event) => setItrData((prev) => ({ ...prev, materialCode: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Work Order No">
                    <Input
                      value={itrData.workOrderNo || ""}
                      onChange={(event) => setItrData((prev) => ({ ...prev, workOrderNo: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="WIR/ITR Ref. No">
                    <Input
                      value={itrData.itrRefNo}
                      onChange={(event) => setItrData((prev) => ({ ...prev, itrRefNo: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Revision No">
                    <Input
                      value={itrData.revNo || ""}
                      onChange={(event) => setItrData((prev) => ({ ...prev, revNo: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="WIR/ITR Submission (Date & Time)">
                    <Input
                      value={itrData.wirItrSubmissionDateTime}
                      onChange={(event) => setItrData((prev) => ({ ...prev, wirItrSubmissionDateTime: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="Inspection (Date & Time)">
                    <Input
                      value={itrData.inspectionDateTime}
                      onChange={(event) => setItrData((prev) => ({ ...prev, inspectionDateTime: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="WIR/ITR Submitted To">
                    <Input
                      value={itrData.submittedTo}
                      onChange={(event) => setItrData((prev) => ({ ...prev, submittedTo: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                  <Field label="WIR/ITR Submitted By">
                    <Input
                      value={itrData.submittedBy}
                      onChange={(event) => setItrData((prev) => ({ ...prev, submittedBy: event.target.value, source: "Manual" }))}
                    />
                  </Field>
                </div>

                <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Tower / Block Ref">
                    <Input
                      value={itrData.contractorPart.locationRef}
                      onChange={(event) => setContractorPart("locationRef", event.target.value)}
                    />
                  </Field>
                  <Field label="Floor / Level">
                    <Input
                      value={itrData.contractorPart.floorLevel}
                      onChange={(event) => setContractorPart("floorLevel", event.target.value)}
                    />
                  </Field>
                  <Field label="Grid Reference">
                    <Input
                      value={itrData.contractorPart.gridReference}
                      onChange={(event) => setContractorPart("gridReference", event.target.value)}
                    />
                  </Field>
                  <Field label="Room / Area Ref">
                    <Input
                      value={itrData.contractorPart.areaRef}
                      onChange={(event) => setContractorPart("areaRef", event.target.value)}
                    />
                  </Field>
                </div>

                <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Previous Qty">
                    <Input
                      value={itrData.contractorPart.measurement.previousQty}
                      onChange={(event) => setMeasurement("previousQty", event.target.value)}
                    />
                  </Field>
                  <Field label="Current Qty">
                    <Input
                      value={itrData.contractorPart.measurement.currentQty}
                      onChange={(event) => setMeasurement("currentQty", event.target.value)}
                    />
                  </Field>
                  <Field label="Quantity Unit">
                    <UnitSelect
                      value={itrData.contractorPart.measurement.unit || ""}
                      onValueChange={(value) => {
                        const prevUnit = itrData.contractorPart.measurement.unit || "";
                        const prev = itrData.contractorPart.measurement;
                        const nextPrev = convertQuantity(prev.previousQty, prevUnit, value);
                        const nextCurrent = convertQuantity(prev.currentQty, prevUnit, value);
                        const nextCumulative = convertQuantity(prev.cumulativeQty, prevUnit, value);
                        setMeasurement("unit", value);
                        if (nextPrev != null) setMeasurement("previousQty", nextPrev);
                        if (nextCurrent != null) setMeasurement("currentQty", nextCurrent);
                        if (nextCumulative != null) setMeasurement("cumulativeQty", nextCumulative);
                      }}
                    />
                  </Field>
                </div>

                <Field label="Description of works / activity for which inspection is requested">
                  <Textarea
                    value={itrData.contractorPart.descriptionOfWorks}
                    readOnly
                    placeholder="Select sample items to generate the description"
                  />
                </Field>

                <div className="manual-entry-grid md:grid-cols-2">
                  <Field label="Discipline">
                    <Select
                      value={
                        Array.isArray(itrData.contractorPart.discipline) &&
                        itrData.contractorPart.discipline.length
                          ? String(itrData.contractorPart.discipline[0] || "")
                          : ""
                      }
                      onValueChange={(value) =>
                        setItrData((prev) => ({
                          ...prev,
                          contractorPart: { ...prev.contractorPart, discipline: value ? [value] : [] },
                          source: "Manual",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select discipline" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...new Set(Object.values(DISCIPLINE_LABEL_TO_API))].map((value) => (
                          <SelectItem key={`itr-discipline-${value}`} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(itrData.contractorPart.attachments).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                      {key === "specificDrawingRefNo" ? (
                        <Input
                          value={String(value ?? "")}
                          placeholder="Enter drawing reference number"
                          onChange={(event) => setAttachment(key, event.target.value)}
                        />
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {YES_NO_NA_OPTIONS.map((option) => (
                            <Button
                              key={`${key}-${option}`}
                              type="button"
                              size="sm"
                              variant={value === option ? "default" : "outline"}
                              onClick={() => setAttachment(key, option)}
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="manual-section-title">Sample Items</div>
                    {itrData.sample_id ? (
                      <div className="text-xs text-muted-foreground">
                        {selectedSample?.work_done || selectedSample?.site_name || selectedSample?.building_name || `Sample ${itrData.sample_id}`}
                      </div>
                    ) : null}
                  </div>
                  {!itrData.sample_id ? (
                    <div className="text-sm text-muted-foreground">Select a sample to load its items here.</div>
                  ) : sampleWorkItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No items found for the selected sample.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[64px]">
                              <Checkbox
                                checked={sampleWorkItems.length > 0 && selectedSampleItemKeys.length === sampleWorkItems.length}
                                onCheckedChange={(value) => toggleAllSampleRows(Boolean(value))}
                              />
                            </TableHead>
                            <TableHead className="w-[70px]">Sr No</TableHead>
                            <TableHead className="w-[140px]">BOQ Code</TableHead>
                            <TableHead className="min-w-[220px]">Item Description</TableHead>
                            <TableHead className="w-[140px]">Size</TableHead>
                            <TableHead className="w-[100px] text-right">Qty</TableHead>
                            <TableHead className="w-[100px]">Unit</TableHead>
                            <TableHead className="w-[120px] text-right">Issued</TableHead>
                            <TableHead className="w-[120px] text-right">Remaining</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleWorkItems.map((row, index) => (
                            <TableRow key={`sample-item-${itrData.sample_id}-${index}`}>
                              <TableCell>
                                <Checkbox checked={isSampleRowSelected(index)} onCheckedChange={(value) => toggleSampleRowSelection(index, Boolean(value))} />
                              </TableCell>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className="font-medium text-primary">{row.boq_id || row.boq_code || "-"}</TableCell>
                              <TableCell>{row.item_description || "-"}</TableCell>
                              <TableCell>{row.size || "-"}</TableCell>
                              <TableCell className="text-right font-medium">{row.quantity || "-"}</TableCell>
                              <TableCell>{row.unit || "-"}</TableCell>
                              <TableCell className="text-right">{row.boq_issued_qty || "-"}</TableCell>
                              <TableCell className="text-right">{row.boq_remaining_quantity || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="manual-section-title">Shaft Details</div>
                    <Button type="button" size="sm" variant="outline" onClick={addShaftDetail}>Add Shaft Row</Button>
                  </div>
                  {(Array.isArray(itrData.shaftDetails) ? itrData.shaftDetails : []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No shaft rows added.</div>
                  ) : (
                    (Array.isArray(itrData.shaftDetails) ? itrData.shaftDetails : []).map((row, index) => (
                      <div key={`manual-shaft-row-${index}`} className="rounded-md border p-3 space-y-3">
                        <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-4">
                          <Field label="Shaft No"><Input value={row.shaft_no ?? ""} onChange={(event) => updateShaftDetail(index, "shaft_no", event.target.value)} /></Field>
                          <Field label="Staff ID"><Input value={row.staff_id ?? ""} onChange={(event) => updateShaftDetail(index, "staff_id", event.target.value)} /></Field>
                          <Field label="Staff Name"><Input value={row.staff_name || ""} onChange={(event) => updateShaftDetail(index, "staff_name", event.target.value)} /></Field>
                          <Field label="Staff Number"><Input value={row.staff_number || ""} onChange={(event) => updateShaftDetail(index, "staff_number", event.target.value)} /></Field>
                        </div>
                        <div className="flex justify-end">
                          <Button type="button" size="sm" variant="destructive" onClick={() => removeShaftDetail(index)}>Remove</Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4">
                  <div className="manual-section-title">Clearances & Sign-off (Part A)</div>
                  {[
                    { key: "mep", label: "MEP Clearance" },
                    { key: "surveyor", label: "Surveyor Clearance" },
                    { key: "interface", label: "Interface Clearance" },
                  ].map((item) => (
                    <div key={item.key} className="space-y-3">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-5">
                        <Field label="Name"><Input value={itrData.contractorPart.clearances[item.key].name} onChange={(event) => setClearance(item.key, "name", event.target.value)} /></Field>
                        <Field label="Date">
                          <Input
                            type="date"
                            value={itrData.contractorPart.clearances[item.key].date || todayDateOnly()}
                            onChange={(event) => setClearance(item.key, "date", event.target.value)}
                          />
                        </Field>
                        <Field label="Designation"><Input value={itrData.contractorPart.clearances[item.key].designation} onChange={(event) => setClearance(item.key, "designation", event.target.value)} /></Field>
                        <Field label="Signature">
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              disabled={Boolean(uploadingClearanceSignature[item.key])}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) uploadClearanceSignature(item.key, file);
                              }}
                            />
                            {uploadingClearanceSignature[item.key] ? (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
                              </div>
                            ) : null}
                            {String(itrData.contractorPart.clearances[item.key].signature || "").trim() ? (
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-muted-foreground truncate">
                                  {String(itrData.contractorPart.clearances[item.key].signature)}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setClearance(item.key, "signature", "")}
                                >
                                  Clear
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </Field>
                        <Field label="Comments"><Input value={itrData.contractorPart.clearances[item.key].comments} onChange={(event) => setClearance(item.key, "comments", event.target.value)} /></Field>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="manual-section-title">Contractor Part</div>
                  <Field label="Contractor Manager / Engineer Comments">
                    <Textarea
                      value={itrData.contractorPart.contractorManagerComments}
                      onChange={(event) => setContractorPart("contractorManagerComments", event.target.value)}
                    />
                  </Field>
                  <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-3">
                    <Field label="Ready for Inspection Date">
                      <Input
                        value={itrData.contractorPart.readyForInspectionDate}
                        onChange={(event) => setContractorPart("readyForInspectionDate", event.target.value)}
                      />
                    </Field>
                    <Field label="Ready for Inspection Time">
                      <Input
                        value={itrData.contractorPart.readyForInspectionTime}
                        onChange={(event) => setContractorPart("readyForInspectionTime", event.target.value)}
                      />
                    </Field>
                    <Field label="Signed By">
                      <Input
                        value={itrData.contractorPart.readySignedBy}
                        onChange={(event) => setContractorPart("readySignedBy", event.target.value)}
                      />
                    </Field>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="manual-section-title">Lodha PMC Part</div>
                  <Field label="Comments">
                    <Textarea
                      value={itrData.lodhaPmc.comments}
                      onChange={(event) => setItrData((prev) => ({ ...prev, lodhaPmc: { ...prev.lodhaPmc, comments: event.target.value } }))}
                    />
                  </Field>
                  {[
                    { key: "engineerManagerCivil", label: "Engineer/Manager - Civil" },
                    { key: "engineerManagerMep", label: "Engineer/Manager - MEP" },
                    { key: "towerIncharge", label: "Tower Incharge" },
                    { key: "qaaDepartment", label: "QAA Department" },
                  ].map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="manual-entry-grid md:grid-cols-2 lg:grid-cols-3">
                        <Field label="Name"><Input value={itrData.lodhaPmc.signOffs[item.key].name} onChange={(event) => setSignOff(item.key, "name", event.target.value)} /></Field>
                        <Field label="Signature">
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              disabled={Boolean(uploadingSignOffSignature[item.key])}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) uploadSignOffSignature(item.key, file);
                              }}
                            />
                            {uploadingSignOffSignature[item.key] ? (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
                              </div>
                            ) : null}
                            {String(itrData.lodhaPmc.signOffs[item.key].signature || "").trim() ? (
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-muted-foreground truncate">
                                  {String(itrData.lodhaPmc.signOffs[item.key].signature)}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSignOff(item.key, "signature", "")}
                                >
                                  Clear
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </Field>
                        <Field label="Date">
                          <Input
                            type="date"
                            value={itrData.lodhaPmc.signOffs[item.key].date || todayDateOnly()}
                            onChange={(event) => setSignOff(item.key, "date", event.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Inspection Code</div>
                    <div className="mt-2">
                      <Select
                        value={itrData.lodhaPmc.resultCode || itrData.inspectionCode || ""}
                        onValueChange={setInspectionCode}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select inspection code" />
                        </SelectTrigger>
                        <SelectContent className="max-w-[min(92vw,40rem)]">
                          {API_INSPECTION_CODE_OPTIONS.map((option) => (
                            <SelectItem
                              key={`manual-inspection-code-${option.value}`}
                              value={option.value}
                              className="whitespace-normal break-words leading-snug"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="manual-entry-actions">
                  <Button onClick={handleSubmit} disabled={saving || !hasPreview} className="w-full sm:w-auto">
                    {saving ? "Submitting..." : "Submit ITR"}
                  </Button>
                  <Button variant="outline" onClick={handlePreview} className="w-full sm:w-auto">
                    <Eye className="mr-2 h-4 w-4" /> Preview
                  </Button>
                  {!hasPreview ? (
                    <div className="text-xs text-muted-foreground sm:self-center">
                      Add details to enable a richer preview.
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      ) : null}

      {!isManualEntryPage ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent ITRs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by ITR no, project, location, status, or code"
              />
            </div>
            {!loadingItrs && filteredRecentItrs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {searchQuery.trim() ? "No matching ITRs found." : "No ITRs yet."}
              </div>
            ) : null}
            {loadingItrs || filteredRecentItrs.length > 0 ? (
              <>
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {loadingItrs ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Loading ITRs…
                  </div>
                ) : (
                  filteredRecentItrs.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{item.id}</div>
                          <div className="text-xs text-muted-foreground">{item.date}</div>
                        </div>
                        <Badge variant={String(item.status || "").toUpperCase() === "SUBMITTED" ? "default" : "secondary"}>{item.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                        <div className="col-span-2">
                          <div className="text-muted-foreground text-xs">Project</div>
                          <div>{item.project}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground text-xs">Location</div>
                          <div>{item.location}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground text-xs">Inspection Code</div>
                          <div>{statusDrafts[String(item.itr_id)]?.inspectionCode || item.inspectionCode || "-"}</div>
                        </div>
                      </div>
                      {item.itr_id ? (
                        <div className="grid grid-cols-1 gap-2 border-t pt-2">
                          <Select
                            value={statusDrafts[String(item.itr_id)]?.status || item.status || "DRAFT"}
                            onValueChange={(value) => handleStatusDraftChange(item.itr_id, "status", value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {API_STATUS_OPTIONS.map((status) => (
                                <SelectItem key={`${item.id}-${status}`} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={statusDrafts[String(item.itr_id)]?.inspectionCode || ""}
                            onValueChange={(value) => handleStatusDraftChange(item.itr_id, "inspectionCode", value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Inspection code" />
                            </SelectTrigger>
                            <SelectContent>
                              {API_INSPECTION_CODE_OPTIONS.map((option) => (
                                <SelectItem key={`${item.id}-${option.value}`} value={option.value} className="whitespace-normal break-words leading-snug">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="PMC comments"
                            value={statusDrafts[String(item.itr_id)]?.lodhaPmcComments || ""}
                            onChange={(event) => handleStatusDraftChange(item.itr_id, "lodhaPmcComments", event.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUpdateStatus(item)}
                            disabled={Boolean(updatingStatusIds[String(item.itr_id)])}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {updatingStatusIds[String(item.itr_id)] ? "Updating..." : "Update Status"}
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Open actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditRecent(item)}>
                              <PencilLine className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadItr(item)}>
                              <Download className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => requestDeleteItr(item)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>ITR No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Inspection Code</TableHead>
                    <TableHead>Status Update</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingItrs ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        Loading ITRs…
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecentItrs.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id}</TableCell>
                        <TableCell>{item.date}</TableCell>
                        <TableCell>{item.project}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell>
                          <Badge variant={String(item.status || "").toUpperCase() === "SUBMITTED" ? "default" : "secondary"}>{item.status}</Badge>
                        </TableCell>
                        <TableCell>{statusDrafts[String(item.itr_id)]?.inspectionCode || item.inspectionCode || "-"}</TableCell>
                        <TableCell>
                          {item.itr_id ? (
                            <div className="flex items-center gap-2">
                              <Select
                                value={statusDrafts[String(item.itr_id)]?.status || item.status || "DRAFT"}
                                onValueChange={(value) => handleStatusDraftChange(item.itr_id, "status", value)}
                              >
                                <SelectTrigger className="h-8 w-[160px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {API_STATUS_OPTIONS.map((status) => (
                                    <SelectItem key={`${item.id}-desktop-${status}`} value={status}>
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={statusDrafts[String(item.itr_id)]?.inspectionCode || ""}
                                onValueChange={(value) => handleStatusDraftChange(item.itr_id, "inspectionCode", value)}
                              >
                                <SelectTrigger className="h-8 w-[120px]">
                                  <SelectValue placeholder="Code" />
                                </SelectTrigger>
                                <SelectContent>
                                  {API_INSPECTION_CODE_OPTIONS.map((option) => (
                                    <SelectItem key={`${item.id}-code-${option.value}`} value={option.value} className="whitespace-normal break-words leading-snug">
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                className="h-8 w-[180px]"
                                placeholder="PMC comments"
                                value={statusDrafts[String(item.itr_id)]?.lodhaPmcComments || ""}
                                onChange={(event) => handleStatusDraftChange(item.itr_id, "lodhaPmcComments", event.target.value)}
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleUpdateStatus(item)}
                                disabled={Boolean(updatingStatusIds[String(item.itr_id)])}
                              >
                                {updatingStatusIds[String(item.itr_id)] ? "..." : "Save"}
                              </Button>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Open actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditRecent(item)}>
                                  <PencilLine className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadItr(item)}>
                                  <Download className="mr-2 h-4 w-4" /> Download
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => requestDeleteItr(item)}>
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
