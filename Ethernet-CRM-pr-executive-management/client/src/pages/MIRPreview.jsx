import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { DISCIPLINE_OPTIONS, EMPTY_MIR, YES_NO_OPTIONS, parseMirAttachmentList } from "@/pages/mirShared";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { api } from "@/lib/api";

const STORAGE_KEY = "mirPreview";

function normalizeMirData(raw) {
  if (!raw) return EMPTY_MIR;
  return {
    ...EMPTY_MIR,
    ...raw,
    mir_id: raw.mir_id ?? raw.mirId ?? null,
    requestSubmission: {
      ...EMPTY_MIR.requestSubmission,
      ...raw.requestSubmission,
    },
    contractorPart: {
      ...EMPTY_MIR.contractorPart,
      ...raw.contractorPart,
    },
    lodhaPmc: {
      ...EMPTY_MIR.lodhaPmc,
      ...raw.lodhaPmc,
      inspectionReports: {
        ...EMPTY_MIR.lodhaPmc.inspectionReports,
        ...raw.lodhaPmc?.inspectionReports,
      },
      signOffs: {
        ...EMPTY_MIR.lodhaPmc.signOffs,
        ...raw.lodhaPmc?.signOffs,
      },
      distribution: {
        ...EMPTY_MIR.lodhaPmc.distribution,
        ...raw.lodhaPmc?.distribution,
      },
    },
    attachments: Array.isArray(raw.attachments) ? raw.attachments : raw.attachments || raw.requestSubmission?.attachments || raw.requestSubmission?.refDocAttached || "",
  };
}

function loadStoredMir() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function InfoItem({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  );
}

function MirCheckbox({ id, label, checked, onCheckedChange }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <span>{label}</span>
    </label>
  );
}

function YesNoToggle({ id, label, value, onChange }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-3">
        {YES_NO_OPTIONS.map((option) => (
          <MirCheckbox
            key={`${id}-${option}`}
            id={`${id}-${option}`}
            label={option}
            checked={value === option}
            onCheckedChange={(checked) => onChange(checked ? option : "")}
          />
        ))}
      </div>
    </div>
  );
}

const toTrimmedString = (value) => (value == null ? "" : String(value).trim());

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toIsoDateTime = (value) => {
  const raw = toTrimmedString(value);
  if (!raw) return "";
  if (raw.includes("T")) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const toDateOnly = (value) => {
  const raw = toTrimmedString(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeLookupText = (value) =>
  toTrimmedString(value)
    .replace(/^[\-\u2022\u00B7•\s]+/, "")
    .replace(/^\(?\d+[\).\-]\s*/, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

const buildItemNoLookupFromPo = (poItems = []) => {
  const lookup = new Map();
  (Array.isArray(poItems) ? poItems : []).forEach((item) => {
    const itemNo = toTrimmedString(item?.item_no ?? item?.itemNo ?? item?.boq_item_code ?? item?.boqItemCode ?? item?.item_code ?? item?.itemCode);
    if (!itemNo) return;
    [
      item?.description,
      item?.item_description,
      item?.material_description,
      item?.name,
      item?.item_name,
      item?.itemName,
    ]
      .map(normalizeLookupText)
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) lookup.set(key, itemNo);
      });
  });
  return lookup;
};

const normalizeItemsForPayload = (items = [], { poItems = [] } = {}) => {
  if (!Array.isArray(items)) return [];
  const itemNoLookup = buildItemNoLookupFromPo(poItems);
  return items.map((item, index) => {
    const srno = Number(item?.srno);
    const qty = Number(item?.qty);
    const rate = Number(item?.Rate);
    const amount = Number(item?.Amount);
    const normalizedUom = toTrimmedString(item?.UOM ?? item?.uom ?? item?.unit ?? item?.Unit);
    const sourceItemNo = toTrimmedString(item?.item_no ?? item?.itemNo ?? "");
    const sourceItemCode = toTrimmedString(item?.item_code ?? item?.itemCode ?? item?.code ?? "");
    const description = toTrimmedString(item?.description);
    const name = toTrimmedString(item?.name);
    const resolvedItemNo =
      sourceItemNo ||
      sourceItemCode ||
      itemNoLookup.get(normalizeLookupText(description)) ||
      itemNoLookup.get(normalizeLookupText(name)) ||
      itemNoLookup.get(normalizeLookupText(item?.material_description)) ||
      itemNoLookup.get(normalizeLookupText(item?.item_name)) ||
      "";
    return {
      srno: Number.isFinite(srno) && srno > 0 ? srno : index + 1,
      hsn: toTrimmedString(item?.hsn),
      item_no: resolvedItemNo,
      item_code: resolvedItemNo || sourceItemCode || toTrimmedString(item?.hsn),
      description,
      name,
      qty: Number.isFinite(qty) ? qty : 0,
      UOM: normalizedUom,
      Rate: Number.isFinite(rate) ? rate : 0,
      Amount: Number.isFinite(amount) ? amount : 0,
      remark: toTrimmedString(item?.remark),
      inspected: Boolean(item?.inspected),
      include_in_mir: item?.include_in_mir !== false,
    };
  });
};

export default function MIRPreview() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id ?? selectedProject?.project_id ?? null;
  const [mirData, setMirData] = useState(() => normalizeMirData(loadStoredMir()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mirData));
    }
  }, [mirData]);

  const hasPreview = useMemo(() => {
    return mirData.projectName || mirData.mirRefNo || mirData.requestSubmission.clientEmployer || (Array.isArray(mirData.items) && mirData.items.length > 0);
  }, [mirData]);
  const attachmentList = useMemo(() => parseMirAttachmentList(mirData.attachments || mirData.requestSubmission.refDocAttached), [mirData.attachments, mirData.requestSubmission.refDocAttached]);

  const setContractorPart = (key, value) => {
    setMirData((prev) => ({
      ...prev,
      contractorPart: { ...prev.contractorPart, [key]: value },
    }));
  };

  const setLodhaPmc = (key, value) => {
    setMirData((prev) => ({
      ...prev,
      lodhaPmc: { ...prev.lodhaPmc, [key]: value },
    }));
  };

  const setInspectionReport = (key, value) => {
    setMirData((prev) => ({
      ...prev,
      lodhaPmc: {
        ...prev.lodhaPmc,
        inspectionReports: { ...prev.lodhaPmc.inspectionReports, [key]: value },
      },
    }));
  };

  const setSignOff = (key, value) => {
    setMirData((prev) => ({
      ...prev,
      lodhaPmc: {
        ...prev.lodhaPmc,
        signOffs: { ...prev.lodhaPmc.signOffs, [key]: value },
      },
    }));
  };

  const handleDisciplineToggle = (item) => {
    setMirData((prev) => {
      const exists = prev.requestSubmission.discipline.includes(item);
      const next = exists
        ? prev.requestSubmission.discipline.filter((entry) => entry !== item)
        : [...prev.requestSubmission.discipline, item];
      return {
        ...prev,
        requestSubmission: { ...prev.requestSubmission, discipline: next },
      };
    });
  };

  const buildDynamicField = () => {
    const fields = [];
    const pushField = (key, value) => {
      if (value == null) return;
      if (typeof value === "string" && value.trim() === "") return;
      if (Array.isArray(value) && value.length === 0) return;
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return;
      const normalized = typeof value === "string" ? value : JSON.stringify(value);
      fields.push({ key, value: normalized });
    };

    pushField("Inspection Engineer", mirData.requestSubmission.engineer);
    pushField("MIR Submitted To", mirData.requestSubmission.submittedTo);
    pushField("Discipline", mirData.requestSubmission.discipline);
    pushField("Contractor Part", mirData.contractorPart);
    pushField("Lodha PMC", mirData.lodhaPmc);
    pushField("Template Ref", mirData.templateRef);
    pushField("Template Revision", mirData.templateRevision);
    pushField("Template Date", mirData.templateDate);
    pushField("Source", mirData.source);
    pushField("Source File", mirData.sourceFileName);
    pushField("Title", mirData.title);

    return fields;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
    const normalizedInspectionDateTime = toIsoDateTime(mirData.requestSubmission.engineerInspectionDateTime);
    const normalizedSubmissionDate = toDateOnly(mirData.requestSubmission.clientSubmissionDateTime);
    const normalizedPoId = toPositiveInteger(mirData.poId);
    const normalizedChallanNo = toTrimmedString(mirData.challanNo || mirData.challan_no);
    const normalizedMirRefNo = toTrimmedString(mirData.mirRefNo || mirData.mir_refrence_no);
      let resolvedProjectId = toPositiveInteger(
        projectId ?? mirData.project_id ?? mirData.projectId ?? selectedProject?.project_id ?? selectedProject?.id
      );

      if (!normalizedMirRefNo) {
        toast({ title: "MIR reference required", description: "Please enter MIR reference number.", variant: "destructive" });
        return;
      }
      if (!normalizedChallanNo) {
        toast({ title: "Challan required", description: "Please enter/select challan no.", variant: "destructive" });
        return;
      }
      if (!normalizedPoId) {
        toast({ title: "PO required", description: "Please enter/select a valid PO ID.", variant: "destructive" });
        return;
      }
      const poCheck = await api.getPoById(normalizedPoId);
      if (!poCheck.success || !poCheck.data) {
        toast({ title: "Invalid PO ID", description: "PO ID does not exist on server.", variant: "destructive" });
        return;
      }
      if (!resolvedProjectId) {
        resolvedProjectId = toPositiveInteger(poCheck.data.project_id);
      }
      const poItemNoLookup = [
        ...(Array.isArray(poCheck.data?.items) ? poCheck.data.items : []),
        ...(Array.isArray(poCheck.data?.item_description) ? poCheck.data.item_description : []),
      ];

      const payload = {
        project_name: toTrimmedString(mirData.projectName || selectedProject?.project_name || selectedProject?.name),
        project_code: toTrimmedString(mirData.projectCode || selectedProject?.project_code),
        client_name: toTrimmedString(mirData.requestSubmission.clientEmployer || selectedProject?.client_name),
        pmc: toTrimmedString(mirData.requestSubmission.pmc),
        contractor: toTrimmedString(mirData.requestSubmission.contractor),
        vendor_code: toTrimmedString(mirData.requestSubmission.vendorCode),
        challan_no: normalizedChallanNo,
        mir_refrence_no: normalizedMirRefNo,
        material_code: toTrimmedString(mirData.materialCode),
        inspection_date_time: normalizedInspectionDateTime,
        client_submission_date: normalizedSubmissionDate,
        refrence_docs_attached: toTrimmedString(mirData.requestSubmission.refDocAttached),
        mir_submited: true,
        dynamic_field: buildDynamicField(),
        project_id: resolvedProjectId,
        po_id: normalizedPoId,
        items: normalizeItemsForPayload(mirData.items, { poItems: poItemNoLookup }),
      };

      const res = mirData.mir_id ? await api.updateLodhaMir(mirData.mir_id, payload) : await api.createLodhaMir(payload);
      if (res.success) {
        toast({ title: "MIR saved", description: mirData.mir_id ? "Your MIR has been updated." : "Your MIR has been saved." });
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
        navigate(`/${projectId}/mir`);
      } else {
        toast({ title: "Error", description: res.error || "Failed to submit MIR.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to submit MIR.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">MIR Preview</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Review extracted fields and finalize inspection details.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={saving}>
            {saving ? "Submitting..." : "Submit MIR"}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(STORAGE_KEY);
              }
              navigate(-1);
            }}
          >
            Remove MIR
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>All fields are editable here before you submit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasPreview ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Upload a MIR or fill the form to see a structured preview here.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{mirData.title}</div>
                  <div className="text-xl font-semibold">{mirData.projectName || "Project Name"}</div>
                  <div className="text-sm text-muted-foreground">Project Code: {mirData.projectCode || "—"}</div>
                  <div className="text-sm text-muted-foreground">MIR Ref. No: {mirData.mirRefNo || "—"}</div>
                  <div className="text-sm text-muted-foreground">Material Code: {mirData.materialCode || "—"}</div>
                  {mirData.sourceFileName ? (
                    <div className="text-xs text-muted-foreground mt-1">Source file: {mirData.sourceFileName}</div>
                  ) : null}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  {mirData.source}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="text-sm font-semibold">Request Submission</div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Client / Employer" value={mirData.requestSubmission.clientEmployer} />
                  <InfoItem label="Client Submission Date & Time" value={mirData.requestSubmission.clientSubmissionDateTime} />
                  <InfoItem label="PMC" value={mirData.requestSubmission.pmc} />
                  <InfoItem label="Inspection Engineer" value={mirData.requestSubmission.engineer} />
                  <InfoItem label="Inspection Date & Time" value={mirData.requestSubmission.engineerInspectionDateTime} />
                  <InfoItem label="Contractor" value={mirData.requestSubmission.contractor} />
                  <InfoItem label="MIR Submitted To" value={mirData.requestSubmission.submittedTo} />
                  <InfoItem label="Vendor Code" value={mirData.requestSubmission.vendorCode} />
                  <InfoItem label="Ref. Doc Attached" value={mirData.requestSubmission.refDocAttached} />
                </div>
                {attachmentList.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Uploaded Files</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {attachmentList.map((file, index) => {
                        const fileUrl = file.path ? api.getApiFileUrl(file.path) : "";
                        return (
                          <a
                            key={`${file.path || file.name || index}`}
                            href={fileUrl || undefined}
                            target={fileUrl ? "_blank" : undefined}
                            rel={fileUrl ? "noreferrer" : undefined}
                            className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2 text-sm transition hover:bg-muted/40"
                          >
                            <span className="truncate font-medium">{file.name || `Attachment ${index + 1}`}</span>
                            <span className="truncate text-xs text-muted-foreground">{file.path || "Uploaded file"}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Discipline (tick applicable)</div>
                  <div className="flex flex-wrap gap-3">
                    {DISCIPLINE_OPTIONS.map((item) => (
                      <MirCheckbox
                        key={item}
                        id={`discipline-${item}`}
                        label={item}
                        checked={mirData.requestSubmission.discipline.includes(item)}
                        onCheckedChange={() => handleDisciplineToggle(item)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="text-sm font-semibold">Part A: By the Contractor</div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Approval Ref. No" value={mirData.contractorPart.approvalRefNo} />
                  <InfoItem label="Previous Quantity" value={mirData.contractorPart.previousQty} />
                  <InfoItem label="Current Quantity" value={mirData.contractorPart.currentQty} />
                  <InfoItem label="Cumulative Quantity" value={mirData.contractorPart.cumulativeQty} />
                  <InfoItem label="BOQ Reference" value={mirData.contractorPart.boqReference} />
                  <InfoItem label="Manufacturer - Country of Origin" value={mirData.contractorPart.manufacturerCountry} />
                  <InfoItem label="Supplier" value={mirData.contractorPart.supplier} />
                  <InfoItem label="Supplied Qty / Delivery Note No" value={mirData.contractorPart.deliveryNoteNumber} />
                  <InfoItem label="Receipt Date On Site" value={mirData.contractorPart.receiptDate} />
                  <InfoItem label="Storage Location" value={mirData.contractorPart.storageLocation} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <YesNoToggle
                    id="material-approved"
                    label="Material Submittal Approved"
                    value={mirData.contractorPart.materialSubmittalApproved}
                    onChange={(value) => setContractorPart("materialSubmittalApproved", value)}
                  />
                  <YesNoToggle
                    id="test-certificate"
                    label="MTC Delivered"
                    value={mirData.contractorPart.testCertificateDelivered}
                    onChange={(value) => setContractorPart("testCertificateDelivered", value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-3">
                  <YesNoToggle
                    id="field-test"
                    label="Field Test Conducted"
                    value={mirData.contractorPart.fieldTestConducted}
                    onChange={(value) => setContractorPart("fieldTestConducted", value)}
                  />
                  <Textarea
                    placeholder="Field test result / acceptance criteria"
                    value={mirData.contractorPart.fieldTestComplianceNote}
                    onChange={(event) => setContractorPart("fieldTestComplianceNote", event.target.value)}
                  />
                </div>
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="space-y-2">
                    <YesNoToggle
                      id="third-party-contractor"
                      label="Third Party Test Under Contractor Scope"
                      value={mirData.contractorPart.thirdPartyTestContractorScope}
                      onChange={(value) => setContractorPart("thirdPartyTestContractorScope", value)}
                    />
                    <Textarea
                      placeholder="Contractor scope compliance note"
                      value={mirData.contractorPart.thirdPartyTestContractorComplianceNote}
                      onChange={(event) => setContractorPart("thirdPartyTestContractorComplianceNote", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <YesNoToggle
                      id="third-party-lodha"
                      label="Third Party Test Under Lodha Scope"
                      value={mirData.contractorPart.thirdPartyTestLodhaScope}
                      onChange={(value) => setContractorPart("thirdPartyTestLodhaScope", value)}
                    />
                    <Textarea
                      placeholder="Lodha scope compliance note"
                      value={mirData.contractorPart.thirdPartyTestLodhaComplianceNote}
                      onChange={(event) => setContractorPart("thirdPartyTestLodhaComplianceNote", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  placeholder="Contractor Name"
                  value={mirData.contractorPart.contractorName}
                  onChange={(event) => setContractorPart("contractorName", event.target.value)}
                />
                <Input
                  placeholder="Signature"
                  value={mirData.contractorPart.contractorSignature}
                  onChange={(event) => setContractorPart("contractorSignature", event.target.value)}
                />
                <Input
                  placeholder="Date"
                  value={mirData.contractorPart.contractorDate}
                  onChange={(event) => setContractorPart("contractorDate", event.target.value)}
                />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Template Reference</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Template Ref" value={mirData.templateRef} />
                  <InfoItem label="Revision" value={mirData.templateRevision} />
                  <InfoItem label="Date" value={mirData.templateDate} />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="text-sm font-semibold">Part B: Lodha/PMC - Inspection Reports</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <YesNoToggle
                    id="inspection-physical-damage"
                    label="Physical Damage?"
                    value={mirData.lodhaPmc.inspectionReports.physicalDamage}
                    onChange={(value) => setInspectionReport("physicalDamage", value)}
                  />
                  <YesNoToggle
                    id="inspection-delivery-note"
                    label="Details in Delivery Note Correct? (Type, Size, Wt., Qty, etc.)"
                    value={mirData.lodhaPmc.inspectionReports.deliveryNoteCorrect}
                    onChange={(value) => setInspectionReport("deliveryNoteCorrect", value)}
                  />
                  <YesNoToggle
                    id="inspection-conform-submittal"
                    label="Conform with Approved Material Submittal"
                    value={mirData.lodhaPmc.inspectionReports.conformApprovedSubmittal}
                    onChange={(value) => setInspectionReport("conformApprovedSubmittal", value)}
                  />
                  <YesNoToggle
                    id="inspection-mtc"
                    label="Material requires test certificate delivered with MTC"
                    value={mirData.lodhaPmc.inspectionReports.mtcDelivered}
                    onChange={(value) => setInspectionReport("mtcDelivered", value)}
                  />
                  <YesNoToggle
                    id="inspection-field-test"
                    label="Field test conducted and results comply with acceptance criteria/values"
                    value={mirData.lodhaPmc.inspectionReports.fieldTestCompliance}
                    onChange={(value) => setInspectionReport("fieldTestCompliance", value)}
                  />
                  <YesNoToggle
                    id="inspection-third-party-contractor"
                    label="Third party test under contractor scope? (If yes, verify certificate)"
                    value={mirData.lodhaPmc.inspectionReports.thirdPartyContractorScope}
                    onChange={(value) => setInspectionReport("thirdPartyContractorScope", value)}
                  />
                  <YesNoToggle
                    id="inspection-third-party-lodha"
                    label="Third party test under Lodha's scope? (If yes, verify certificate)"
                    value={mirData.lodhaPmc.inspectionReports.thirdPartyLodhaScope}
                    onChange={(value) => setInspectionReport("thirdPartyLodhaScope", value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    placeholder="Civil & Finishing - Project Manager Sign"
                    value={mirData.lodhaPmc.signOffs.civilProjectManager}
                    onChange={(event) => setSignOff("civilProjectManager", event.target.value)}
                  />
                  <Input
                    placeholder="Civil & Finishing - Project Quality Manager Sign"
                    value={mirData.lodhaPmc.signOffs.civilQualityManager}
                    onChange={(event) => setSignOff("civilQualityManager", event.target.value)}
                  />
                  <Input
                    placeholder="Facade - Facade Manager Sign"
                    value={mirData.lodhaPmc.signOffs.facadeManager}
                    onChange={(event) => setSignOff("facadeManager", event.target.value)}
                  />
                  <Input
                    placeholder="Landscape - Landscape Architect Sign"
                    value={mirData.lodhaPmc.signOffs.landscapeArchitect}
                    onChange={(event) => setSignOff("landscapeArchitect", event.target.value)}
                  />
                  <Input
                    placeholder="MEP - MEP Manager Sign"
                    value={mirData.lodhaPmc.signOffs.mepManager}
                    onChange={(event) => setSignOff("mepManager", event.target.value)}
                  />
                </div>
                <Textarea
                  placeholder="Comments"
                  value={mirData.lodhaPmc.comments}
                  onChange={(event) => setLodhaPmc("comments", event.target.value)}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="text-sm font-semibold">Lodha/PMC - Inspection Result</div>
                <div className="text-xs text-muted-foreground">The above materials have been inspected on site and found, at time of inspection, to be:</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { code: "Code 1", label: "Approved - Material can be used" },
                    { code: "Code 2", label: "Conditionally approved. Material can be used, resubmit incorporating comments indicated" },
                    { code: "Code 3", label: "Revise & Resubmit. Material may not be used" },
                    { code: "Code 4", label: "For information and records only" },
                  ].map((item) => (
                    <MirCheckbox
                      key={item.code}
                      id={`result-${item.code}`}
                      label={`${item.code} - ${item.label}`}
                      checked={mirData.lodhaPmc.resultCode === item.code}
                      onCheckedChange={(checked) => setLodhaPmc("resultCode", checked ? item.code : "")}
                    />
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    placeholder="Name"
                    value={mirData.lodhaPmc.resultName}
                    onChange={(event) => setLodhaPmc("resultName", event.target.value)}
                  />
                  <Input
                    placeholder="Signature"
                    value={mirData.lodhaPmc.resultSignature}
                    onChange={(event) => setLodhaPmc("resultSignature", event.target.value)}
                  />
                  <Input
                    placeholder="Date"
                    value={mirData.lodhaPmc.resultDate}
                    onChange={(event) => setLodhaPmc("resultDate", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Distribution</div>
                  <div className="flex flex-wrap gap-3">
                    <MirCheckbox
                      id="distribution-lodha"
                      label="Lodha"
                      checked={mirData.lodhaPmc.distribution.lodha}
                      onCheckedChange={(checked) =>
                        setLodhaPmc("distribution", { ...mirData.lodhaPmc.distribution, lodha: !!checked })
                      }
                    />
                    <MirCheckbox
                      id="distribution-contractor"
                      label="Contractor"
                      checked={mirData.lodhaPmc.distribution.contractor}
                      onCheckedChange={(checked) =>
                        setLodhaPmc("distribution", { ...mirData.lodhaPmc.distribution, contractor: !!checked })
                      }
                    />
                    <Input
                      placeholder="Others"
                      value={mirData.lodhaPmc.distribution.others}
                      onChange={(event) =>
                        setLodhaPmc("distribution", { ...mirData.lodhaPmc.distribution, others: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
