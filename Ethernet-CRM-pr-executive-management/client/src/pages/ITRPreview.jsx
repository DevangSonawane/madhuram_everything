import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { DISCIPLINE_OPTIONS, EMPTY_ITR, YES_NO_NA_OPTIONS } from "@/pages/itrShared";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/useProject";
import { useAuth } from "@/contexts/useAuth";
import { UnitSelect, convertQuantity } from "@/components/forms/UnitSelect";

const STORAGE_KEY = "itrPreview";
const RECENT_KEY = "itrRecent";
const API_STATUS_OPTIONS = ["DRAFT", "SUBMITTED", "UNDER_INSPECTION", "APPROVED", "REJECTED", "RESUBMITTED", "CLOSED"];
const API_INSPECTION_CODE_OPTIONS = [
  { value: "CODE_1", label: "CODE_1 - Work may proceed" },
  { value: "CODE_2", label: "CODE_2 - Conditionally approved" },
  { value: "CODE_3", label: "CODE_3 - Revise and resubmit" },
  { value: "CODE_4", label: "CODE_4 - For information and records only" },
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

const ATTACHMENT_LABELS = {
  drawingAttached: "Drawing Attached",
  attachedTestCerts: "Test Certificates Attached",
  specificDrawingRefNo: "Specific Drawing Reference No",
  methodStatementAttached: "Method Statement Attached",
  checklistAttached: "Checklist Attached",
  jointMeasurementAttached: "Joint Measurement Attached",
};

function normalizeItrData(raw) {
  if (!raw) return EMPTY_ITR;
  const normalized = normalizeSnakeKeys(raw);
  const resolvedItrId =
    normalized.itrId ??
    normalized.itrID ??
    normalized.itr_id ??
    raw?.itr_id ??
    raw?.itrId ??
    normalized.id ??
    raw?.id ??
    null;
  const projectInfo = normalized.projectInfo || {};
  const itrHeader = normalized.itrHeader || {};
  const location = normalized.location || {};
  const quantity = normalized.quantity || {};
  const attachments = normalized.attachments || {};
  const partAContractor = normalized.partAContractor || {};
  const partBLodhaPmc = normalized.partBLodhaPmc || {};
  const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

  return {
    ...EMPTY_ITR,
    ...normalized,
    itr_id: resolvedItrId,
    sample_id: normalized.sampleId ?? normalized.sample_id ?? raw?.sample_id ?? raw?.sampleId ?? "",
    po_id: normalized.po_id ?? normalized.poId ?? raw?.po_id ?? raw?.poId ?? "",
    mir_id: normalized.mir_id ?? normalized.mirId ?? raw?.mir_id ?? raw?.mirId ?? "",
    projectName: normalized.projectName || projectInfo.projectName || "",
    projectCode: normalized.projectCode || projectInfo.projectCode || "",
    clientEmployer: normalized.clientEmployer || projectInfo.clientEmployer || normalized.clientName || "",
    pmcEngineer: normalized.pmcEngineer || projectInfo.pmcEngineer || "",
    contractor: normalized.contractor || projectInfo.contractor || "",
    vendorCode: normalized.vendorCode || projectInfo.vendorCode || "",
    materialCode: normalized.materialCode || projectInfo.materialCode || "",
    workOrderNo: normalized.workOrderNo || projectInfo.workOrderNo || "",
    itrRefNo: normalized.itrRefNo || itrHeader.itrRefNo || normalized.itrRefNo || "",
    revNo: normalized.revNo || itrHeader.revNo || "",
    wirItrSubmissionDateTime: normalized.wirItrSubmissionDateTime || itrHeader.submissionDatetime || "",
    inspectionDateTime: normalized.inspectionDateTime || itrHeader.inspectionDatetime || "",
    submittedTo: normalized.submittedTo || itrHeader.submittedTo || "",
    submittedBy: normalized.submittedBy || itrHeader.submittedBy || "",
    status: normalized.status || "DRAFT",
    workItems: Array.isArray(normalized.workItems) ? normalized.workItems : [],
    shaftDetails: Array.isArray(normalized.shaftDetails) ? normalized.shaftDetails : [],
    sourceFilePath: normalized.sourceFilePath || normalized.sourceFileName || "",
    contractorPart: {
      ...EMPTY_ITR.contractorPart,
      ...normalized.contractorPart,
      locationRef: normalized.contractorPart?.locationRef || location.towerBlockRef || "",
      floorLevel: normalized.contractorPart?.floorLevel || location.floorLevel || "",
      gridReference: normalized.contractorPart?.gridReference || location.gridReference || "",
      areaRef: normalized.contractorPart?.areaRef || location.roomAreaRef || "",
      discipline: normalized.contractorPart?.discipline || toArray(normalized.discipline),
      descriptionOfWorks: normalized.contractorPart?.descriptionOfWorks || normalized.descriptionOfWork || "",
      measurement: {
        ...EMPTY_ITR.contractorPart.measurement,
        ...normalized.contractorPart?.measurement,
        previousQty: normalized.contractorPart?.measurement?.previousQty || quantity.previousQty || "",
        currentQty: normalized.contractorPart?.measurement?.currentQty || quantity.currentQty || "",
        cumulativeQty:
          normalized.contractorPart?.measurement?.cumulativeQty || quantity.cumulativeQty || String((Number(quantity.previousQty) || 0) + (Number(quantity.currentQty) || 0) || ""),
        unit: normalized.contractorPart?.measurement?.unit || quantity.unit || "",
      },
      attachments: {
        ...EMPTY_ITR.contractorPart.attachments,
        ...normalized.contractorPart?.attachments,
        drawingAttached: apiYesNoNaToUi(normalized.contractorPart?.attachments?.drawingAttached || attachments.drawingAttached || ""),
        attachedTestCerts: apiYesNoNaToUi(normalized.contractorPart?.attachments?.attachedTestCerts || attachments.testCertificatesAttached || ""),
        methodStatementAttached:
          apiYesNoNaToUi(
            normalized.contractorPart?.attachments?.methodStatementAttached ||
              attachments.methodStatementAttached ||
              "",
          ),
        checklistAttached: apiYesNoNaToUi(normalized.contractorPart?.attachments?.checklistAttached || attachments.checklistAttached || ""),
        jointMeasurementAttached: apiYesNoNaToUi(normalized.contractorPart?.attachments?.jointMeasurementAttached || attachments.jointMeasurementAttached || ""),
        specificDrawingRefNo: normalized.contractorPart?.attachments?.specificDrawingRefNo || attachments.drawingRefNo || "",
      },
      clearances: {
        ...EMPTY_ITR.contractorPart.clearances,
        ...normalized.contractorPart?.clearances,
        mep: { ...EMPTY_ITR.contractorPart.clearances.mep, ...normalized.contractorPart?.clearances?.mep, ...normalized.mepClearance },
        surveyor: { ...EMPTY_ITR.contractorPart.clearances.surveyor, ...normalized.contractorPart?.clearances?.surveyor, ...normalized.surveyorClearance },
        interface: { ...EMPTY_ITR.contractorPart.clearances.interface, ...normalized.contractorPart?.clearances?.interface, ...normalized.interfaceClearance },
      },
      contractorManagerComments:
        normalized.contractorPart?.contractorManagerComments || partAContractor.comments || normalized.contractManager?.comments || "",
      readyForInspectionDate:
        normalized.contractorPart?.readyForInspectionDate || partAContractor.readyForInspectionDate || normalized.contractManager?.readyForInspectionDate || "",
      readyForInspectionTime:
        normalized.contractorPart?.readyForInspectionTime || partAContractor.readyForInspectionTime || normalized.contractManager?.readyForInspectionTime || "",
      readySignedBy:
        normalized.contractorPart?.readySignedBy || partAContractor.signedBy || normalized.contractManager?.signedBy || "",
    },
    lodhaPmc: {
      ...EMPTY_ITR.lodhaPmc,
      ...normalized.lodhaPmc,
      comments: normalized.lodhaPmc?.comments || partBLodhaPmc.comments || normalized.pmcComments || "",
      resultCode: normalized.lodhaPmc?.resultCode || partBLodhaPmc.inspectionCode || normalized.resultCode || "",
      signOffs: {
        ...EMPTY_ITR.lodhaPmc.signOffs,
        ...normalized.lodhaPmc?.signOffs,
        engineerManagerCivil: {
          ...EMPTY_ITR.lodhaPmc.signOffs.engineerManagerCivil,
          ...normalized.lodhaPmc?.signOffs?.engineerManagerCivil,
          ...normalized.engineerCivil,
        },
        engineerManagerMep: {
          ...EMPTY_ITR.lodhaPmc.signOffs.engineerManagerMep,
          ...normalized.lodhaPmc?.signOffs?.engineerManagerMep,
          ...normalized.engineerMep,
        },
        towerIncharge: {
          ...EMPTY_ITR.lodhaPmc.signOffs.towerIncharge,
          ...normalized.lodhaPmc?.signOffs?.towerIncharge,
          ...normalized.towerIncharge,
        },
        qaaDepartment: {
          ...EMPTY_ITR.lodhaPmc.signOffs.qaaDepartment,
          ...normalized.lodhaPmc?.signOffs?.qaaDepartment,
          ...normalized.qaaDepartment,
        },
      },
    },
  };
}

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
    work_items: Array.isArray(itrData.workItems) ? itrData.workItems : [],
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

function InfoItem({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export default function ITRPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const [itrData, setItrData] = useState(() => normalizeItrData(loadStoredItr()));
  const [saving, setSaving] = useState(false);
  const [sampleOptions, setSampleOptions] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const { user } = useAuth();
  const projectId = selectedProject?.id ?? selectedProject?.project_id ?? routeProjectId ?? null;
  const resolvedProjectId = routeProjectId || projectId;
  const effectiveProjectId = Number(itrData.project_id || projectId || 0) || null;
  const previewRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(itrData));
    }
  }, [itrData]);

  const hasPreview = useMemo(() => {
    return itrData.projectName || itrData.itrRefNo || itrData.contractorPart.descriptionOfWorks;
  }, [itrData]);

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
      workItems: [...(Array.isArray(prev.workItems) ? prev.workItems : []), { item_description: "", size: "", quantity: 0, unit: "" }],
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
      if (String(prev.sample_id || "") !== String(itrData.sample_id || "")) return prev;
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

  const handleSubmit = async () => {
    if (!projectId) {
      toast({
        title: "Select project",
        description: "Choose a project before submitting an ITR.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = buildItrPayload(itrData, projectId, user);
      const updateId = itrData.itr_id ?? location.state?.itrId ?? null;
      let response = updateId ? await api.updateItr(updateId, payload) : await api.createItr(payload);
      let didFallbackCreate = false;

      // If the ITR id is stale or the backend no longer has that row, retry as a create.
      if (!response?.success && response?.status === 404 && updateId) {
        didFallbackCreate = true;
        response = await api.createItr({ ...payload, itr_id: undefined, id: undefined });
      }

      if (!response.success) {
        toast({ title: "Error", description: response.error || "Failed to submit ITR.", variant: "destructive" });
        return;
      }

      toast({
        title: "ITR saved",
        description: updateId && !didFallbackCreate ? "Your ITR has been updated." : "Your ITR has been submitted.",
      });

      const recent = loadRecentItrs();
      const savedItrId = response?.data?.itr_id ?? response?.data?.id ?? (didFallbackCreate ? null : updateId) ?? null;
      setItrData((prev) => ({ ...prev, itr_id: savedItrId }));
      const id = itrData.itrRefNo || (savedItrId ? `ITR-${savedItrId}` : `ITR-${Date.now()}`);
      const date = itrData.inspectionDateTime || itrData.wirItrSubmissionDateTime || new Date().toISOString().split("T")[0];
      const locationLabel = itrData.contractorPart.areaRef || itrData.contractorPart.floorLevel || itrData.contractorPart.locationRef || "";
      const nextRecent = [
        {
          id,
          itr_id: savedItrId || itrData.itr_id || null,
          date,
          project: itrData.projectName,
          location: locationLabel,
          status: itrData.status || "DRAFT",
          payload: { ...itrData },
        },
        ...recent.filter((item) => {
          if (savedItrId && item?.itr_id) return item.itr_id !== savedItrId;
          return item.id !== id;
        }),
      ].slice(0, 25);
      saveRecentItrs(nextRecent);

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
      navigate(resolvedProjectId ? `/${resolvedProjectId}/itr` : "/projects");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create ITR</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Fill the installation test report manually and submit it to the project.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Preview
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(resolvedProjectId ? `/${resolvedProjectId}/itr` : "/projects")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to ITR List
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Info and ITR Header</CardTitle>
          <CardDescription>Fields aligned with the project info and ITR header payload.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="PO ID">
              <Input
                inputMode="numeric"
                value={itrData.po_id || ""}
                onChange={(event) => setItrData((prev) => ({ ...prev, po_id: event.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="MIR ID">
              <Input
                inputMode="numeric"
                value={itrData.mir_id || ""}
                onChange={(event) => setItrData((prev) => ({ ...prev, mir_id: event.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Sample ID">
              <Select value={itrData.sample_id ? String(itrData.sample_id) : undefined} onValueChange={handleSampleChange} disabled={!effectiveProjectId || loadingSamples}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={effectiveProjectId ? (loadingSamples ? "Loading samples..." : "Select sample") : "Select project first"} />
                </SelectTrigger>
                <SelectContent>
                  {sampleOptions.map((item) => {
                    const id = String(item?.sample_id ?? item?.id ?? "").trim();
                    if (!id) return null;
                    const label = item?.work_done || item?.site_name || item?.building_name || `Sample ${id}`;
                    return (
                      <SelectItem key={`itr-preview-sample-${id}`} value={id}>
                        {id} - {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project Name"><Input value={itrData.projectName} onChange={(event) => setItrData((prev) => ({ ...prev, projectName: event.target.value }))} /></Field>
            <Field label="Project Code"><Input value={itrData.projectCode} onChange={(event) => setItrData((prev) => ({ ...prev, projectCode: event.target.value }))} /></Field>
            <Field label="Client / Employer"><Input value={itrData.clientEmployer} onChange={(event) => setItrData((prev) => ({ ...prev, clientEmployer: event.target.value }))} /></Field>
            <Field label="PMC Engineer"><Input value={itrData.pmcEngineer} onChange={(event) => setItrData((prev) => ({ ...prev, pmcEngineer: event.target.value }))} /></Field>
            <Field label="Contractor"><Input value={itrData.contractor} onChange={(event) => setItrData((prev) => ({ ...prev, contractor: event.target.value }))} /></Field>
            <Field label="Vendor Code"><Input value={itrData.vendorCode} onChange={(event) => setItrData((prev) => ({ ...prev, vendorCode: event.target.value }))} /></Field>
            <Field label="Material Code"><Input value={itrData.materialCode} onChange={(event) => setItrData((prev) => ({ ...prev, materialCode: event.target.value }))} /></Field>
            <Field label="Work Order No."><Input value={itrData.workOrderNo || ""} onChange={(event) => setItrData((prev) => ({ ...prev, workOrderNo: event.target.value }))} /></Field>
            <Field label="ITR Reference No."><Input value={itrData.itrRefNo} onChange={(event) => setItrData((prev) => ({ ...prev, itrRefNo: event.target.value }))} /></Field>
            <Field label="Revision No."><Input value={itrData.revNo || ""} onChange={(event) => setItrData((prev) => ({ ...prev, revNo: event.target.value }))} /></Field>
            <Field label="WIR / ITR Submission Date & Time"><Input value={itrData.wirItrSubmissionDateTime} onChange={(event) => setItrData((prev) => ({ ...prev, wirItrSubmissionDateTime: event.target.value }))} /></Field>
            <Field label="Inspection Date & Time"><Input value={itrData.inspectionDateTime} onChange={(event) => setItrData((prev) => ({ ...prev, inspectionDateTime: event.target.value }))} /></Field>
            <Field label="Submitted To"><Input value={itrData.submittedTo} onChange={(event) => setItrData((prev) => ({ ...prev, submittedTo: event.target.value }))} /></Field>
            <Field label="Submitted By"><Input value={itrData.submittedBy} onChange={(event) => setItrData((prev) => ({ ...prev, submittedBy: event.target.value }))} /></Field>
            <Field label="Workflow Status">
              <div className="flex flex-wrap gap-2">
                {API_STATUS_OPTIONS.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    size="sm"
                    variant={itrData.status === status ? "default" : "outline"}
                    onClick={() => setItrData((prev) => ({ ...prev, status }))}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location, Quantity, and Description of Work</CardTitle>
          <CardDescription>Core work location and quantity details from ITR endpoints.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Tower / Block Ref"><Input value={itrData.contractorPart.locationRef} onChange={(event) => setContractorPart("locationRef", event.target.value)} /></Field>
            <Field label="Floor / Level"><Input value={itrData.contractorPart.floorLevel} onChange={(event) => setContractorPart("floorLevel", event.target.value)} /></Field>
            <Field label="Grid Reference"><Input value={itrData.contractorPart.gridReference} onChange={(event) => setContractorPart("gridReference", event.target.value)} /></Field>
            <Field label="Room / Area Ref"><Input value={itrData.contractorPart.areaRef} onChange={(event) => setContractorPart("areaRef", event.target.value)} /></Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Previous Qty"><Input value={itrData.contractorPart.measurement.previousQty} onChange={(event) => setMeasurement("previousQty", event.target.value)} /></Field>
            <Field label="Current Qty"><Input value={itrData.contractorPart.measurement.currentQty} onChange={(event) => setMeasurement("currentQty", event.target.value)} /></Field>
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

          <Field label="Description of Works / Activity for Inspection">
            <Textarea
              value={itrData.contractorPart.descriptionOfWorks}
              readOnly
              placeholder="Select sample items to generate the description"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select discipline" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(Object.values(DISCIPLINE_LABEL_TO_API))].map((value) => (
                    <SelectItem key={`itr-preview-discipline-${value}`} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(itrData.contractorPart.attachments).map(([key, value]) => (
              <div key={key} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">{ATTACHMENT_LABELS[key] || key}</div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work Items and Shaft Details</CardTitle>
          <CardDescription>Line items and shaft or staff rows as documented in the API notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Sample Items</div>
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
              <div className="text-sm font-medium">Shaft Details</div>
              <Button type="button" size="sm" variant="outline" onClick={addShaftDetail}>Add Shaft Row</Button>
            </div>
            {(Array.isArray(itrData.shaftDetails) ? itrData.shaftDetails : []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No shaft rows added.</div>
            ) : (
              (Array.isArray(itrData.shaftDetails) ? itrData.shaftDetails : []).map((row, index) => (
                <div key={`shaft-row-${index}`} className="rounded-md border p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clearances and Sign-off - Part A</CardTitle>
          <CardDescription>MEP, Surveyor, and Interface clearance details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            { key: "mep", label: "MEP Clearance" },
            { key: "surveyor", label: "Surveyor Clearance" },
            { key: "interface", label: "Interface Clearance" },
          ].map((item) => (
            <div key={item.key} className="space-y-3">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Name"><Input value={itrData.contractorPart.clearances[item.key].name} onChange={(event) => setClearance(item.key, "name", event.target.value)} /></Field>
                <Field label="Date"><Input value={itrData.contractorPart.clearances[item.key].date} onChange={(event) => setClearance(item.key, "date", event.target.value)} /></Field>
                <Field label="Designation"><Input value={itrData.contractorPart.clearances[item.key].designation} onChange={(event) => setClearance(item.key, "designation", event.target.value)} /></Field>
                <Field label="Signature"><Input value={itrData.contractorPart.clearances[item.key].signature} onChange={(event) => setClearance(item.key, "signature", event.target.value)} /></Field>
                <Field label="Comments"><Input value={itrData.contractorPart.clearances[item.key].comments} onChange={(event) => setClearance(item.key, "comments", event.target.value)} /></Field>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contractor Part</CardTitle>
          <CardDescription>Contractor comments and readiness metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Contractor Manager / Engineer Comments">
            <Textarea
              value={itrData.contractorPart.contractorManagerComments}
              onChange={(event) => setContractorPart("contractorManagerComments", event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ready for Inspection Date"><Input value={itrData.contractorPart.readyForInspectionDate} onChange={(event) => setContractorPart("readyForInspectionDate", event.target.value)} /></Field>
            <Field label="Ready for Inspection Time"><Input value={itrData.contractorPart.readyForInspectionTime} onChange={(event) => setContractorPart("readyForInspectionTime", event.target.value)} /></Field>
            <Field label="Signed By"><Input value={itrData.contractorPart.readySignedBy} onChange={(event) => setContractorPart("readySignedBy", event.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lodha PMC Part</CardTitle>
          <CardDescription>PMC comments, inspection code, and signoffs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Field label="Comments">
            <Textarea
              value={itrData.lodhaPmc.comments}
              onChange={(event) => setItrData((prev) => ({ ...prev, lodhaPmc: { ...prev.lodhaPmc, comments: event.target.value } }))}
            />
          </Field>

          <div className="space-y-4">
            {[
              { key: "engineerManagerCivil", label: "Engineer/Manager - Civil" },
              { key: "engineerManagerMep", label: "Engineer/Manager - MEP" },
              { key: "towerIncharge", label: "Tower Incharge" },
              { key: "qaaDepartment", label: "QAA Department" },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name"><Input value={itrData.lodhaPmc.signOffs[item.key].name} onChange={(event) => setSignOff(item.key, "name", event.target.value)} /></Field>
                  <Field label="Signature"><Input value={itrData.lodhaPmc.signOffs[item.key].signature} onChange={(event) => setSignOff(item.key, "signature", event.target.value)} /></Field>
                  <Field label="Date"><Input value={itrData.lodhaPmc.signOffs[item.key].date} onChange={(event) => setSignOff(item.key, "date", event.target.value)} /></Field>
                </div>
              </div>
            ))}
          </div>

          <div>
                    <div className="text-xs font-medium text-muted-foreground">Inspection Code</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {API_INSPECTION_CODE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={itrData.lodhaPmc.resultCode === option.value ? "default" : "outline"}
                  onClick={() => setItrData((prev) => ({ ...prev, lodhaPmc: { ...prev.lodhaPmc, resultCode: option.value } }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasPreview ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Fill the form to build the ITR summary before submitting.
          </CardContent>
        </Card>
      ) : (
        <Card ref={previewRef}>
          <CardHeader>
            <CardTitle>ITR Summary Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Project Name" value={itrData.projectName} />
              <InfoItem label="ITR Reference No." value={itrData.itrRefNo} />
              <InfoItem label="Sample ID" value={itrData.sample_id} />
              <InfoItem label="Submitted By" value={itrData.submittedBy} />
              <InfoItem label="Inspection Date & Time" value={itrData.inspectionDateTime} />
              <InfoItem label="Tower / Block Ref" value={itrData.contractorPart.locationRef} />
              <InfoItem label="Description of Work" value={itrData.contractorPart.descriptionOfWorks} />
              <InfoItem label="Status" value={itrData.status} />
              <InfoItem label="Inspection Code" value={itrData.lodhaPmc.resultCode} />
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col sm:flex-row justify-end gap-3">
        <Button onClick={handleSubmit} disabled={saving || !hasPreview} className="w-full sm:w-auto">
          {saving ? "Submitting..." : "Submit ITR"}
        </Button>
      </div>
    </div>
  );
}
