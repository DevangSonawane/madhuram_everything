import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  HIRANANDANI_APPROVAL_CODES,
  LODHA_RESULT_CODES,
  MIR_TEMPLATE_TYPES,
  getMirTemplatePayload,
  getMirTemplateType,
} from "@/pages/mirShared";
import { downloadMirPdf } from "@/lib/mirPdf";

const toDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

const normalizeItems = (items) => {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseDynamicField = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getDynamicValue = (dynamicField, key) => {
  if (!Array.isArray(dynamicField)) return null;
  const entry = dynamicField.find((item) => item?.key === key);
  if (!entry) return null;
  const raw = entry.value;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export default function MIRView() {
  const navigate = useNavigate();
  const { projectId, mirId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [mir, setMir] = useState(null);

  useEffect(() => {
    const fetchMir = async () => {
      if (!mirId) return;
      try {
        setLoading(true);
        const result = await api.getMirById(mirId);
        if (!result.success || !result.data) {
          toast({
            title: "Failed to load MIR",
            description: result.error || "Could not fetch MIR details.",
            variant: "destructive",
          });
          return;
        }
        setMir(result.data);
      } catch {
        toast({
          title: "Failed to load MIR",
          description: "Could not fetch MIR details.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMir();
  }, [mirId, toast]);

  const dynamicField = useMemo(() => parseDynamicField(mir?.dynamic_field), [mir]);
  const items = useMemo(() => {
    const dynamicItems = getDynamicValue(dynamicField, "items");
    return normalizeItems(mir?.items || dynamicItems);
  }, [dynamicField, mir]);
  const inspectedCount = useMemo(() => items.filter((item) => Boolean(item?.inspected)).length, [items]);
  const allItemsInspected = items.length > 0 && inspectedCount === items.length;
  const challanNo = useMemo(() => {
    if (mir?.challan_no) return mir.challan_no;
    const dynamicChallanNo = getDynamicValue(dynamicField, "challan_no");
    return typeof dynamicChallanNo === "string" ? dynamicChallanNo : "-";
  }, [dynamicField, mir]);
  const templateType = useMemo(() => getMirTemplateType(mir), [mir]);
  const templatePayload = useMemo(() => getMirTemplatePayload(mir), [mir]);

  const handleDownload = async () => {
    if (!mir) return;
    await downloadMirPdf(mir, {
      templateType,
      templatePayload,
      fileName: `${templateType || "mir"}-${mir.mir_refrence_no || mir.mir_id || "download"}.pdf`,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MIR Preview</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review MIR details before editing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(`/${projectId}/mir`)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => navigate(`/${projectId}/mir/${mirId}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={!mir}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>MIR Details</CardTitle>
          <CardDescription>Read-only preview of MIR record.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading MIR...
              </div>
            </div>
          ) : !mir ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              MIR not found.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Info label="MIR Format" value={templateType === MIR_TEMPLATE_TYPES.HIRANANDANI ? "Hiranandani" : templateType === MIR_TEMPLATE_TYPES.LODHA ? "Lodha" : "-"} />
                <Info label="MIR Reference No" value={mir.mir_refrence_no} />
                <Info label="Project Name" value={mir.project_name} />
                <Info label="Project Code" value={mir.project_code} />
                <Info label="Client Name" value={mir.client_name} />
                <Info label="PMC" value={mir.pmc} />
                <Info label="Contractor" value={mir.contractor} />
                <Info label="Vendor Code" value={mir.vendor_code} />
                <Info label="Challan No" value={challanNo} />
                <Info label="Material Code" value={mir.material_code} />
                <Info label="Inspection Date" value={toDate(mir.inspection_date_time)} />
                <Info label="Client Submission Date" value={toDate(mir.client_submission_date)} />
                <Info label="Project ID" value={mir.project_id} />
              </div>

              {templateType === MIR_TEMPLATE_TYPES.HIRANANDANI ? (
                <HiranandaniReadOnly data={templatePayload} />
              ) : templateType === MIR_TEMPLATE_TYPES.LODHA ? (
                <LodhaReadOnly data={templatePayload} />
              ) : null}

              <div className="flex items-center gap-3">
                <Badge variant={mir.mir_submited ? "default" : "secondary"}>
                  {mir.mir_submited ? "Submitted" : "Draft"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(api.getApiFileUrl(mir.refrence_docs_attached), "_blank", "noopener,noreferrer")}
                  disabled={!mir.refrence_docs_attached}
                >
                  <FileText className="mr-2 h-4 w-4" /> View Attachment
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Items</div>
                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No items available.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sr No</TableHead>
                        <TableHead>HSN</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Remark</TableHead>
                        <TableHead>Inspected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={`preview-item-${index}`}>
                          <TableCell>{item?.srno ?? "-"}</TableCell>
                          <TableCell>{item?.hsn || "-"}</TableCell>
                          <TableCell>{item?.description || "-"}</TableCell>
                          <TableCell>{item?.name || "-"}</TableCell>
                          <TableCell>{item?.qty ?? "-"}</TableCell>
                          <TableCell>{item?.UOM || item?.uom || "-"}</TableCell>
                          <TableCell>{item?.Rate ?? item?.rate ?? "-"}</TableCell>
                          <TableCell>{item?.Amount ?? item?.amount ?? "-"}</TableCell>
                          <TableCell>{item?.remark || "-"}</TableCell>
                          <TableCell>
                            {allItemsInspected || item?.inspected ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "-"}</div>
    </div>
  );
}

function ReadOnlySection({ title, children }) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

function LodhaReadOnly({ data }) {
  return (
    <ReadOnlySection title="Lodha Format Details">
      <div className="grid gap-4 md:grid-cols-2">
        <Info label="Submitted To" value={data.requestSubmission.submittedTo} />
        <Info label="Discipline" value={(data.requestSubmission.discipline || []).join(", ")} />
        <Info label="Approval Ref No" value={data.contractorPart.approvalRefNo} />
        <Info label="Supplier" value={data.contractorPart.supplier} />
        <Info label="Delivery Note Number" value={data.contractorPart.deliveryNoteNumber} />
        <Info label="Storage Location" value={data.contractorPart.storageLocation} />
        <Info label="MTC Delivered" value={data.contractorPart.testCertificateDelivered} />
        <Info label="Inspection Result" value={data.lodhaPmc.resultCode} />
      </div>
      <Info label="Description of Supplied Materials" value={data.contractorPart.description} />
      <Info label="Comments" value={data.lodhaPmc.comments} />
      <div className="grid gap-2">
        {LODHA_RESULT_CODES.map((item) => (
          <div key={item.code} className="text-sm text-muted-foreground">
            {data.lodhaPmc.resultCode === item.code ? "[x] " : ""}
            {item.code} - {item.label}
          </div>
        ))}
      </div>
    </ReadOnlySection>
  );
}

function HiranandaniReadOnly({ data }) {
  return (
    <ReadOnlySection title="Hiranandani Format Details">
      <div className="grid gap-4 md:grid-cols-2">
        <Info label="Control Form" value={data.controlForm} />
        <Info label="Revision" value={data.revision} />
        <Info label="Location" value={data.location} />
        <Info label="Storage Location" value={data.storageLocation} />
        <Info label="Manufacturer" value={data.notes.manufacturer} />
        <Info label="Challan / Invoice Note No" value={data.notes.challanInvoiceNo} />
        <Info label="Delivery Date" value={data.notes.deliveryDate} />
        <Info label="Approval Code" value={data.approvalCode} />
      </div>
      <Info label="Material to be Inspected" value={data.materialToInspect} />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.materialRows || []).map((item, index) => (
              <TableRow key={`hiranandani-preview-${index}`}>
                <TableCell>{item.material || "-"}</TableCell>
                <TableCell>{item.size || "-"}</TableCell>
                <TableCell>{item.quantity || "-"}</TableCell>
                <TableCell>{item.unit || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-2">
        {HIRANANDANI_APPROVAL_CODES.map((item) => (
          <div key={item.code} className="text-sm text-muted-foreground">
            {data.approvalCode === item.code ? "[x] " : ""}
            {item.code} - {item.label}
          </div>
        ))}
      </div>
    </ReadOnlySection>
  );
}
