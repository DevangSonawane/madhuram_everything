import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { ArrowLeft, CheckCircle2, Loader2, Trash2, UploadCloud, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { parseComparisonWorkbook } from "@/lib/vendorComparisonParser";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { useProject } from "@/contexts/useProject";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { matchAgainstPrItems } from "@/lib/prItemMatcher";

const NAVY = "#1a3a6b";
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const formatInr = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return CURRENCY_FORMATTER.format(parsed);
};

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(parsed);
};

const toTrimmed = (value) => String(value ?? "").replace(/\u00A0/g, " ").trim();

const normalizeVendorKey = (value) =>
  toTrimmed(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const findExistingVendorByName = (vendors, vendorName) => {
  const targetKey = normalizeVendorKey(vendorName);
  if (!targetKey) return null;
  return (Array.isArray(vendors) ? vendors : []).find((row) => normalizeVendorKey(row?.vendor_name) === targetKey) || null;
};

const buildVendorDraft = (vendorName, vendor = null) => ({
  source_name: vendorName,
  vendor_name: String(vendor?.vendor_name || vendorName || "").trim(),
  vendor_company_name: String(vendor?.vendor_company_name || "").trim(),
  vendor_email: String(vendor?.vendor_email || "").trim(),
  mobile_number: String(vendor?.mobile_number || "").trim(),
  location: String(vendor?.location || "").trim(),
  status: String(vendor?.status || "active").trim() || "active",
});

const buildVendorPayload = (draft) => ({
  vendor_name: String(draft?.vendor_name || "").trim(),
  vendor_company_name: String(draft?.vendor_company_name || "").trim(),
  vendor_email: String(draft?.vendor_email || "").trim(),
  mobile_number: String(draft?.mobile_number || "").trim(),
  location: String(draft?.location || "").trim(),
  status: String(draft?.status || "active").trim() || "active",
});

const normalizePrDescription = (item) =>
  String(
    item?.material_description ??
      item?.item_description ??
      item?.description ??
      item?.item_name ??
      item?.itemName ??
      item?.name ??
      ""
  )
    .replace(/\u00A0/g, " ")
    .trim();

const extractUniquePrItems = (prs) => {
  const list = Array.isArray(prs) ? prs : [];
  const all = [];
  list.forEach((pr) => {
    (Array.isArray(pr?.items) ? pr.items : []).forEach((item) => {
      const material_description = normalizePrDescription(item);
      if (!material_description) return;
      all.push({
        material_description,
        unit: item?.unit ?? "",
        req_qty: item?.req_qty ?? null,
        make: item?.make ?? "",
        pr_id: item?.pr_id ?? item?.prId ?? pr?.pr_id ?? pr?.id ?? null,
      });
    });
  });

  return Array.from(
    new Map(
      all.map((i) => [
        i.material_description
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim(),
        i,
      ])
    ).values()
  );
};

const isXlsxFile = (file) => {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/octet-stream"
  );
};

const statusMeta = (statusRaw) => {
  const status = String(statusRaw || "pending").toLowerCase();
  if (status === "approved") return { label: "approved", badgeClass: "bg-emerald-600 text-white" };
  if (status === "rejected") return { label: "rejected", badgeClass: "bg-rose-600 text-white" };
  if (status === "draft") return { label: "draft", badgeClass: "bg-slate-700 text-white" };
  return { label: "pending", badgeClass: "bg-amber-500 text-white" };
};

export default function VendorComparisonUpload({ inLayout = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const resolvedProject = useResolvedProject();
  const { projects, selectedProject } = useProject();

  const fileInputRef = useRef(null);
  const initialProjectId = resolvedProject.projectId || String(selectedProject?.id || selectedProject?.project_id || "");
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("pending");
  const [uploadedAt, setUploadedAt] = useState(null);

  const [comparisonId, setComparisonId] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [matchedSections, setMatchedSections] = useState([]);
  const [unmatchedSections, setUnmatchedSections] = useState([]);
  const [prCount, setPrCount] = useState(0);
  const [prItemCount, setPrItemCount] = useState(0);
  const [totalParsedCount, setTotalParsedCount] = useState(0);
  const [vendorCheckLoading, setVendorCheckLoading] = useState(false);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDrafts, setVendorDrafts] = useState([]);
  const [pendingComparisonUpload, setPendingComparisonUpload] = useState(null);

  const isStandalone = !inLayout && location.pathname.includes("/vendor-comparison/upload");
  const containerClass = isStandalone
    ? "content-shell px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8"
    : "space-y-6";
  const getListPath = useCallback(() => {
    const pid = resolvedProject.projectId || projectId;
    return pid ? `/projects/${pid}/vendor-comparison` : "/vendor-comparison";
  }, [projectId, resolvedProject.projectId]);

  const projectOptions = useMemo(() => {
    const list = Array.isArray(projects) ? projects : [];
    return list
      .map((p) => ({
        id: String(p?.id || p?.project_id || "").trim(),
        label: p?.name || p?.project_name || `Project ${p?.id || p?.project_id || ""}`,
      }))
      .filter((p) => p.id);
  }, [projects]);

  useEffect(() => {
    if (activeProjectId) return;
    if (initialProjectId) setActiveProjectId(initialProjectId);
  }, [activeProjectId, initialProjectId]);

  const canUpload = Boolean(file) && Boolean(activeProjectId) && !uploading && !parsing;
  const statusBadge = statusMeta(status);
  const activeBlock = useMemo(
    () => parsed?.blocks?.[selectedBlockIndex] || parsed?.blocks?.[0] || null,
    [parsed, selectedBlockIndex]
  );

  const lowestRateByItem = useMemo(() => {
    const map = new Map();
    const sections = activeBlock?.sections || [];
    sections.forEach((section) => {
      (section.items || []).forEach((item) => {
        const rates = (item.vendorData || []).map((v) => v.rate).filter((v) => Number.isFinite(v));
        map.set(item.srNo, rates.length ? Math.min(...rates) : null);
      });
    });
    return map;
  }, [activeBlock]);

  const vendorTotals = useMemo(() => {
    const vendors = activeBlock?.vendors || [];
    const totalsArray = vendors.map(() => 0);
    const sections = activeBlock?.sections || [];

    sections.forEach((section) => {
      (section.items || []).forEach((item) => {
        (item.vendorData || []).forEach((vd) => {
          const idx = vd?.vendorIndex;
          const amount = vd?.amount;
          if (!Number.isInteger(idx) || idx < 0 || idx >= totalsArray.length) return;
          if (!Number.isFinite(amount)) return;
          totalsArray[idx] += amount;
        });
      });
    });

    const numericTotals = totalsArray.map((v) => (Number.isFinite(v) ? v : null));
    const candidates = numericTotals
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value != null);
    if (candidates.length === 0) return { totals: numericTotals, minIndex: -1, maxIndex: -1 };

    candidates.sort((a, b) => a.value - b.value);
    const minIndex = candidates[0].index;
    const maxIndex = candidates[candidates.length - 1].index;
    return { totals: numericTotals, minIndex, maxIndex };
  }, [activeBlock]);

  const summaryRows = useMemo(() => {
    const summary = activeBlock?.summary || {};
    return [
      { label: "Subtotal", key: "subtotal" },
      { label: "Discount", key: "discount" },
      { label: "GST", key: "gst" },
      { label: "Net Amount", key: "netAmount" },
      { label: "Total Value", key: "totalValue" },
    ].map((entry) => ({
      ...entry,
      values: Array.isArray(summary[entry.key]) ? summary[entry.key] : [],
    }));
  }, [activeBlock]);

  const handlePickFile = useCallback(() => {
    setError("");
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event) => {
    const next = event.target.files?.[0] || null;
    event.target.value = "";
    setError("");
    if (!next) return;
    if (!isXlsxFile(next)) {
      setError("Please upload a valid .xlsx file.");
      return;
    }
    setFile(next);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setParsed(null);
    setSelectedBlockIndex(0);
    setMatched([]);
    setUnmatched([]);
    setMatchedSections([]);
    setUnmatchedSections([]);
    setPrCount(0);
    setPrItemCount(0);
    setTotalParsedCount(0);
    setComparisonId(null);
    setStatus("pending");
    setUploadedAt(null);
    setError("");
    setVendorCheckLoading(false);
    setVendorDialogOpen(false);
    setVendorDrafts([]);
    setPendingComparisonUpload(null);
  }, []);

  const fetchVendorCompareMap = useCallback(async (vendorsOverride = null) => {
    try {
      const vendors = Array.isArray(vendorsOverride) ? vendorsOverride : (activeBlock?.vendors || []);
      if (vendors.length === 0) return {};

      const results = await Promise.all(
        vendors.map(async (vendor) => {
          const result = await api.compareVendorPriceListItems({
            limit: 500,
            offset: 0,
            project_id: activeProjectId ? Number(activeProjectId) : undefined,
            q: vendor.name,
          });
          const groups = Array.isArray(result?.data?.groups) ? result.data.groups : [];
          return { vendorName: vendor.name, success: Boolean(result?.success), groups };
        })
      );

      const vendorMap = {};
      results.forEach((entry) => {
        vendorMap[entry.vendorName] = { success: entry.success, groups: entry.groups };
      });
      return vendorMap;
    } finally {
      // no-op
    }
  }, [activeProjectId, activeBlock?.vendors]);

  const applyPrMatching = useCallback((parsedModel, prItems) => {
    const matchedFlat = [];
    const unmatchedFlat = [];
    const matchedGrouped = [];
    const unmatchedGrouped = [];

    const sections = Array.isArray(parsedModel?.sections) ? parsedModel.sections : [];
    let total = 0;

    sections.forEach((section) => {
      const items = Array.isArray(section?.items) ? section.items : [];
      const matchedItems = [];
      const unmatchedItems = [];

      items.forEach((item) => {
        total += 1;
        const match = matchAgainstPrItems(item, prItems);
        const enriched = { ...item, ...match };
        if (match.matchStatus === "matched") {
          matchedItems.push(enriched);
          matchedFlat.push({ ...enriched, sectionLabel: section.sectionLabel, sectionDescription: section.sectionDescription });
        } else {
          unmatchedItems.push(enriched);
          unmatchedFlat.push({ ...enriched, sectionLabel: section.sectionLabel, sectionDescription: section.sectionDescription });
        }
      });

      if (matchedItems.length > 0) {
        matchedGrouped.push({
          sectionLabel: section.sectionLabel,
          sectionDescription: section.sectionDescription,
          items: matchedItems,
        });
      }
      if (unmatchedItems.length > 0) {
        unmatchedGrouped.push({
          sectionLabel: section.sectionLabel,
          sectionDescription: section.sectionDescription,
          items: unmatchedItems,
        });
      }
    });

    setTotalParsedCount(total);
    setMatched(matchedFlat);
    setUnmatched(unmatchedFlat);
    setMatchedSections(matchedGrouped);
    setUnmatchedSections(unmatchedGrouped);
  }, []);

  const completeComparisonCreation = useCallback(
    async ({ parsedWorkbook = null, parsedModel, file }) => {
      const uploadResult = await api.uploadVendorComparisonFiles([file]);
      if (!uploadResult?.success) {
        throw new Error(uploadResult?.error || "Upload failed.");
      }
      const uploadedFiles = Array.isArray(uploadResult.data)
        ? uploadResult.data
        : Array.isArray(uploadResult.data?.data)
          ? uploadResult.data.data
          : [];
      const primary = uploadedFiles[0] || null;
      const fileUrl = primary?.file_url || primary?.url || "";
      const fileName = primary?.file_name || primary?.name || file?.name || "";
      if (!fileUrl) {
        throw new Error("Upload succeeded but server did not return a file URL.");
      }

      const createPayload = {
        project_id: Number(activeProjectId),
        pricelist: (Array.isArray(parsedModel?.sections) ? parsedModel.sections : [])
          .flatMap((section) => (Array.isArray(section?.items) ? section.items : []))
          .flatMap((item) => {
            const itemDescription = String(item?.description || "").trim();
            if (!itemDescription) return [];
            const vendorData = Array.isArray(item?.vendorData) ? item.vendorData : [];
            return vendorData
              .map((vd) => {
                const vendorName = String(vd?.vendorName || "").trim();
                if (!vendorName) return null;
                return {
                  vendor_name: vendorName,
                  item_description: itemDescription,
                  total_qty: item?.totalQty ?? null,
                  unit: String(item?.uom || "").trim(),
                  hsn: String(item?.hsnCode || "").trim(),
                  rate: vd?.rate ?? null,
                  amount: vd?.amount ?? null,
                };
              })
              .filter(Boolean);
          }),
        upload_document: [
          {
            file_name: fileName,
            file_url: fileUrl,
          },
        ],
        approved_vendor_name: "",
      };

      const approvedVendorName = (() => {
        const pricelist = Array.isArray(createPayload.pricelist) ? createPayload.pricelist : [];
        if (pricelist.length === 0) return "";
        const totals = new Map();
        pricelist.forEach((row) => {
          const vendorName = String(row?.vendor_name || "").trim();
          if (!vendorName) return;
          const amount = Number(row?.amount);
          const qty = Number(row?.total_qty);
          const rate = Number(row?.rate);
          const computed = Number.isFinite(amount) ? amount : Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0;
          totals.set(vendorName, (totals.get(vendorName) || 0) + (Number.isFinite(computed) ? computed : 0));
        });
        const entries = Array.from(totals.entries()).filter(([, total]) => Number.isFinite(total));
        if (entries.length === 0) return "";
        entries.sort((a, b) => a[1] - b[1]);
        return entries[0]?.[0] || "";
      })();

      const finalPayload = {
        ...createPayload,
        approved_vendor_name: approvedVendorName,
      };

      const createResult = await api.createVendorComparison(finalPayload);
      if (!createResult?.success) {
        throw new Error(createResult?.error || "Failed to create vendor comparison record.");
      }
      const created = createResult.data || {};
      const id = created?.id ?? created?.vendor_comparison_id ?? created?.comparison_id ?? null;
      if (id != null) setComparisonId(String(id));
      setStatus(String(created?.status || "pending"));
      setUploadedAt(created?.created_at || created?.createdAt || new Date().toISOString());
      if (parsedWorkbook) {
        setParsed(parsedWorkbook);
      } else {
        setParsed(parsedModel);
      }
      setSelectedBlockIndex(0);

      await fetchVendorCompareMap(parsedModel.vendors);

      const prResult = await api.getPrsByProject(Number(activeProjectId));
      const prList = Array.isArray(prResult?.data)
        ? prResult.data
        : Array.isArray(prResult?.data?.data)
          ? prResult.data.data
          : Array.isArray(prResult?.data?.rows)
            ? prResult.data.rows
            : [];
      setPrCount(prList.length);
      const uniquePrItems = extractUniquePrItems(prList);
      setPrItemCount(uniquePrItems.length);
      applyPrMatching(parsedModel, uniquePrItems);

      return { approvedVendorName, id };
    },
    [activeProjectId, applyPrMatching, fetchVendorCompareMap]
  );

  const handleVendorDraftChange = useCallback((index, field, value) => {
    setVendorDrafts((prev) =>
      prev.map((draft, currentIndex) => (currentIndex === index ? { ...draft, [field]: value } : draft))
    );
  }, []);

  const handleVendorDraftSubmit = useCallback(async () => {
    if (!pendingComparisonUpload) return;
    setUploading(true);
    setError("");
    try {
      const savedVendorMap = new Map(pendingComparisonUpload.resolvedVendorMap || []);
      for (const draft of vendorDrafts) {
        const payload = buildVendorPayload(draft);
        if (!payload.vendor_name) {
          throw new Error("Vendor name is required for every missing vendor.");
        }
        const result = await api.createVendor(payload);
        if (!result?.success) {
          throw new Error(result?.error || `Failed to create vendor ${payload.vendor_name}.`);
        }
        const createdVendor = result.data || {};
        savedVendorMap.set(payload.vendor_name, createdVendor);
      }

      const pending = pendingComparisonUpload;
      await completeComparisonCreation({
        parsedModel: pending.parsedModel,
        parsedWorkbook: pending.parsedWorkbook,
        file: pending.file,
        resolvedVendorMap: savedVendorMap,
      });
      setVendorDialogOpen(false);
      setVendorDrafts([]);
      setPendingComparisonUpload(null);
    } catch (e) {
      setError(e?.message || "Unable to save vendor details.");
    } finally {
      setUploading(false);
    }
  }, [completeComparisonCreation, pendingComparisonUpload, vendorDrafts]);

  const handleUploadAndParse = useCallback(async () => {
    if (!canUpload || !file) return;
    setError("");
    setParsing(true);
    setUploading(true);
    setVendorCheckLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedWorkbook = parseComparisonWorkbook(workbook);
      const parsedModel = Array.isArray(parsedWorkbook?.blocks) ? parsedWorkbook.blocks[0] || null : null;
      setParsed(parsedWorkbook);
      setSelectedBlockIndex(0);
      const vendorResult = await api.getVendors();
      if (!vendorResult?.success) {
        throw new Error(vendorResult?.error || "Unable to verify existing vendors.");
      }

      const backendVendors = Array.isArray(vendorResult.data) ? vendorResult.data : [];
      const missingVendorNames = [];
      const resolvedVendorMap = new Map();

      (Array.isArray(parsedModel?.vendors) ? parsedModel.vendors : []).forEach((vendorNameRaw) => {
        const vendorName = String(vendorNameRaw?.name || vendorNameRaw?.vendorName || vendorNameRaw || "").trim();
        if (!vendorName) return;
        const matchedVendor = findExistingVendorByName(backendVendors, vendorName);

        if (matchedVendor) {
          resolvedVendorMap.set(vendorName, matchedVendor);
          return;
        }
        missingVendorNames.push(vendorName);
      });

      if (missingVendorNames.length > 0) {
        setPendingComparisonUpload({
          file,
          parsedModel,
          parsedWorkbook,
          resolvedVendorMap,
        });
        setVendorDrafts(missingVendorNames.map((vendorName) => buildVendorDraft(vendorName)));
        setVendorDialogOpen(true);
        return;
      }

      await completeComparisonCreation({
        parsedWorkbook,
        parsedModel,
        file,
        resolvedVendorMap,
      });
    } catch (e) {
      setError(e?.message || "Unable to parse this Excel file.");
    } finally {
      setUploading(false);
      setParsing(false);
      setVendorCheckLoading(false);
    }
  }, [canUpload, completeComparisonCreation, file]);

  const updateStatus = useCallback(
    async (nextStatus) => {
      if (!comparisonId) return;
      setError("");
      try {
        const result = await api.updateVendorComparison(comparisonId, { status: nextStatus });
        if (!result?.success) {
          setError(result?.error || "Unable to update status.");
          return;
        }
        setStatus(nextStatus);
        navigate(getListPath());
      } catch {
        setError("Unable to update status.");
      }
    },
    [comparisonId, getListPath, navigate]
  );

  const deleteRecord = useCallback(async () => {
    if (!comparisonId) return;
    setError("");
    try {
      const result = await api.deleteVendorComparison(comparisonId);
      if (!result?.success) {
        setError(result?.error || "Unable to delete.");
        return;
      }
      clearFile();
    } catch {
      setError("Unable to delete.");
    }
  }, [clearFile, comparisonId]);

  const matchTypeBadge = useCallback((type) => {
    const t = String(type || "").toLowerCase();
    if (t === "exact") return { label: "Exact", className: "bg-emerald-100 text-emerald-900 border-emerald-200" };
    if (t === "normalized") return { label: "Normalized", className: "bg-sky-100 text-sky-900 border-sky-200" };
    if (t === "substring") return { label: "Partial", className: "bg-amber-100 text-amber-900 border-amber-200" };
    if (t === "token") return { label: "Token", className: "bg-amber-100 text-amber-900 border-amber-200" };
    return { label: "-", className: "bg-muted text-muted-foreground border-border" };
  }, []);

  return (
    <div className={`${containerClass} pb-24`}>
      <style>{`
        @media print {
          .vc-actionbar { display: none !important; }
          .vc-upload { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Comparison Upload</h1>
          <p className="text-muted-foreground mt-2">
            Upload an Excel vendor comparison sheet (.xlsx), review it exactly like the Excel, match items to catalog, then approve or reject.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {comparisonId ? (
            <Badge className={statusBadge.badgeClass}>Status: {statusBadge.label}</Badge>
          ) : (
            <Badge variant="outline">Project: {projectId || "All"}</Badge>
          )}
        </div>
      </div>

      <Card className="vc-upload">
        <CardHeader>
          <CardTitle>Upload Excel</CardTitle>
          <CardDescription>Accepts only `.xlsx` files in the defined vendor comparison format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Project</div>
              <Select value={activeProjectId || ""} onValueChange={(value) => setActiveProjectId(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((p) => (
                    <SelectItem key={`project-${p.id}`} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">File</div>
              <div
                className="group relative flex min-h-[108px] cursor-pointer items-center justify-center rounded-lg border border-dashed bg-background p-4 text-center transition hover:border-primary/60 hover:shadow-sm"
                onClick={handlePickFile}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0] || null;
                  if (!dropped) return;
                  if (!isXlsxFile(dropped)) {
                    setError("Please drop a valid .xlsx file.");
                    return;
                  }
                  setFile(dropped);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="space-y-1">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/15">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium">Drag & drop an .xlsx, or click to browse</div>
                  <div className="text-xs text-muted-foreground">Excel only · 1 file</div>
                </div>
              </div>
            </div>
          </div>

          {file ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="ghost" onClick={clearFile} className="w-full sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
                <Button
                  onClick={handleUploadAndParse}
                  disabled={!canUpload || vendorCheckLoading}
                  className="w-full sm:w-auto bg-gradient-to-r from-primary to-sky-500 text-white shadow hover:opacity-95"
                >
                  {parsing || uploading || vendorCheckLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="mr-2 h-4 w-4" />
                  )}
                  {vendorCheckLoading ? "Checking Vendors..." : "Upload & Parse"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {activeBlock ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div>
                <div className="text-xs text-muted-foreground">Company Name</div>
                <div className="font-medium">{activeBlock.meta.companyName || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Project Name</div>
                <div className="font-medium">{activeBlock.meta.projectName || "-"}</div>
                {activeBlock.subProjectName ? (
                  <div className="text-xs text-muted-foreground">{activeBlock.subProjectName}</div>
                ) : null}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Indent No</div>
                <div className="font-medium">{activeBlock.meta.indentNo || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Indent Date</div>
                <div className="font-medium">{activeBlock.meta.indentDate || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Comparison Date</div>
                <div className="font-medium">{activeBlock.meta.comparisonDate || "-"}</div>
              </div>
            </div>
          </div>

          {Array.isArray(parsed?.blocks) && parsed.blocks.length > 1 ? (
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Blocks</div>
                  <div className="text-xs text-muted-foreground">Switch between stacked comparison tables in the workbook.</div>
                </div>
                <Badge variant="outline">{parsed.blocks.length} blocks</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {parsed.blocks.map((block, index) => (
                  <Button
                    key={`block-btn-${index}`}
                    type="button"
                    variant={index === selectedBlockIndex ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedBlockIndex(index)}
                  >
                    Block {index + 1}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-background p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{matched.length}</span> of{" "}
                <span className="font-medium text-foreground">{totalParsedCount}</span> items matched to PR products ·{" "}
                <span className="font-medium text-foreground">{unmatched.length}</span> unmatched
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Project: {activeProjectId || "—"}</Badge>
                <Badge variant="outline">Matched against {prCount} PRs</Badge>
                <Badge variant="outline">Unique PR items: {prItemCount}</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Excel Summary</div>
                <div className="text-xs text-muted-foreground">Parsed directly from the fixed comparison sheet.</div>
              </div>
              <Badge variant="outline">{activeBlock.vendors.length} vendors</Badge>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border px-3 py-2 text-left font-semibold">Row</th>
                    {activeBlock.vendors.map((vendor, idx) => (
                      <th key={`summary-head-${vendor.name}-${idx}`} className="border px-3 py-2 text-right font-semibold">
                        {vendor.displayName || vendor.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row) => (
                    <tr key={`summary-row-${row.key}`}>
                      <td className="border px-3 py-2 font-medium">{row.label}</td>
                      {activeBlock.vendors.map((vendor, idx) => {
                        const value = row.values[idx] || {};
                        const display =
                          row.key === "discount" || row.key === "gst"
                            ? `${value.rate == null ? "-" : `${formatNumber(value.rate * 100)}%`} / ${value.amount == null ? "-" : formatInr(value.amount)}`
                            : value.amount == null
                              ? "-"
                              : formatInr(value.amount);
                        return (
                          <td key={`summary-cell-${row.key}-${vendor.name}-${idx}`} className="border px-3 py-2 text-right font-mono">
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/** Matched table */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold text-white" style={{ background: "#047857" }}>
              ✅ Matched Items ({matched.length}) — found in Purchase Requests
            </div>
            <div className="overflow-auto bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th colSpan={5} style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-left font-bold text-white">
                      &nbsp;
                    </th>
                    {activeBlock.vendors.map((vendor, i) => {
                      const isLowestTotal = vendorTotals.minIndex === i;
                      const isHighestTotal = vendorTotals.maxIndex === i;
                      const bg = isLowestTotal ? "#047857" : isHighestTotal ? "#be123c" : NAVY;
                      return (
                        <th
                          key={`matched-vendor-${vendor.name}-${i}`}
                          colSpan={2}
                          className="border px-3 py-2 text-center font-bold text-white"
                          style={{ background: bg }}
                        >
                          <div className="truncate">{vendor.name}</div>
                          {vendor.subLabel ? <div className="mt-0.5 text-xs italic text-white/80">{vendor.subLabel}</div> : null}
                        </th>
                      );
                    })}
                    <th rowSpan={2} style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-left font-bold text-white min-w-[280px]">
                      PR Match
                    </th>
                  </tr>
                  <tr>
                    {["Sr. No.", "HSN Code", "Item Description", "Total Qty", "UOM"].map((h) => (
                      <th
                        key={`matched-head-${h}`}
                        style={{ background: NAVY }}
                        className={`border border-white/10 px-3 py-2 text-left font-bold text-white ${
                          h === "Sr. No."
                            ? "sticky left-0 z-30 w-[76px]"
                            : h === "HSN Code"
                              ? "sticky left-[76px] z-30 w-[100px]"
                              : h === "Item Description"
                                ? "sticky left-[176px] z-30 min-w-[360px]"
                                : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                    {activeBlock.vendors.map((_, i) => (
                      <React.Fragment key={`matched-head-v-${i}`}>
                        <th style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-right font-bold text-white">
                          Rate
                        </th>
                        <th style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-right font-bold text-white">
                          Amount
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matchedSections.map((section, sIdx) => (
                    <React.Fragment key={`matched-sec-${section.sectionLabel || sIdx}`}>
                      {section.sectionLabel ? (
                        <tr>
                          <td colSpan={5 + activeBlock.vendors.length * 2 + 1} className="border px-3 py-2 font-semibold" style={{ color: NAVY, background: "rgba(26,58,107,0.06)" }}>
                            {section.sectionLabel} — {section.sectionDescription}
                          </td>
                        </tr>
                      ) : null}
                      {(section.items || []).map((item, idx) => {
                        const isOdd = idx % 2 === 1;
                        const lowestRate = lowestRateByItem.get(item.srNo) ?? null;
                        const badge = matchTypeBadge(item.matchType);
                        return (
                          <tr key={`matched-item-${section.sectionLabel}-${item.srNo}`} className={`${isOdd ? "bg-emerald-50/40" : "bg-white"} `}>
                            <td className={`border px-3 py-2 sticky left-0 z-10 w-[76px] font-medium ${isOdd ? "bg-emerald-50/40" : "bg-white"}`}>{item.srNo}</td>
                            <td className={`border px-3 py-2 sticky left-[76px] z-10 w-[100px] ${isOdd ? "bg-emerald-50/40" : "bg-white"}`}>{item.hsnCode || "-"}</td>
                            <td className={`border px-3 py-2 sticky left-[176px] z-10 min-w-[360px] ${isOdd ? "bg-emerald-50/40" : "bg-white"}`}>{item.description || "-"}</td>
                            <td className="border px-3 py-2 text-right font-mono">{item.totalQty == null ? "-" : formatNumber(item.totalQty)}</td>
                            <td className="border px-3 py-2">{item.uom || "-"}</td>
                            {(item.vendorData || []).map((v, vIdx) => {
                              const isLowest = lowestRate != null && v.rate != null && v.rate === lowestRate;
                              return (
                                <React.Fragment key={`matched-vd-${item.srNo}-${vIdx}`}>
                                  <td className={`border px-3 py-2 text-right font-mono ${isLowest ? "bg-emerald-100 text-emerald-900" : ""}`}>{v.rate == null ? "-" : formatInr(v.rate)}</td>
                                  <td className="border px-3 py-2 text-right font-mono">{v.amount == null ? "-" : formatInr(v.amount)}</td>
                                </React.Fragment>
                              );
                            })}
                            <td className="border px-3 py-2">
                              <div className="text-xs text-muted-foreground">PR #{item.matchedPrItem?.pr_id ?? "-"}</div>
                              <div className="mt-1 text-sm font-medium">{item.matchedPrItem?.material_description || "-"}</div>
                              <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${badge.className}`}>{badge.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/** Unmatched table */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold text-white" style={{ background: "#b45309" }}>
              ⚠️ Unmatched Items ({unmatched.length}) — not found in any Purchase Request
            </div>
            <div className="overflow-auto bg-white">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th colSpan={5} style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-left font-bold text-white">
                      &nbsp;
                    </th>
                    {activeBlock.vendors.map((vendor, i) => (
                      <th key={`unmatched-vendor-${vendor.name}-${i}`} colSpan={2} className="border px-3 py-2 text-center font-bold text-white" style={{ background: NAVY }}>
                        <div className="truncate">{vendor.name}</div>
                        {vendor.subLabel ? <div className="mt-0.5 text-xs italic text-white/80">{vendor.subLabel}</div> : null}
                      </th>
                    ))}
                    <th rowSpan={2} style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-left font-bold text-white min-w-[280px]">
                      PR Match
                    </th>
                  </tr>
                  <tr>
                    {["Sr. No.", "HSN Code", "Item Description", "Total Qty", "UOM"].map((h) => (
                      <th
                        key={`unmatched-head-${h}`}
                        style={{ background: NAVY }}
                        className={`border border-white/10 px-3 py-2 text-left font-bold text-white ${
                          h === "Sr. No."
                            ? "sticky left-0 z-30 w-[76px]"
                            : h === "HSN Code"
                              ? "sticky left-[76px] z-30 w-[100px]"
                              : h === "Item Description"
                                ? "sticky left-[176px] z-30 min-w-[360px]"
                                : ""
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                    {activeBlock.vendors.map((_, i) => (
                      <React.Fragment key={`unmatched-head-v-${i}`}>
                        <th style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-right font-bold text-white">
                          Rate
                        </th>
                        <th style={{ background: NAVY }} className="border border-white/10 px-3 py-2 text-right font-bold text-white">
                          Amount
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unmatchedSections.map((section, sIdx) => (
                    <React.Fragment key={`unmatched-sec-${section.sectionLabel || sIdx}`}>
                      {section.sectionLabel ? (
                        <tr>
                          <td colSpan={5 + activeBlock.vendors.length * 2 + 1} className="border px-3 py-2 font-semibold" style={{ color: NAVY, background: "rgba(26,58,107,0.06)" }}>
                            {section.sectionLabel} — {section.sectionDescription}
                          </td>
                        </tr>
                      ) : null}
                      {(section.items || []).map((item, idx) => {
                        const isOdd = idx % 2 === 1;
                        const lowestRate = lowestRateByItem.get(item.srNo) ?? null;
                        return (
                          <tr key={`unmatched-item-${section.sectionLabel}-${item.srNo}`} className={isOdd ? "bg-amber-50/40" : "bg-white"}>
                            <td className={`border px-3 py-2 sticky left-0 z-10 w-[76px] font-medium border-l-4 border-amber-400 ${isOdd ? "bg-amber-50/40" : "bg-white"}`}>{item.srNo}</td>
                            <td className={`border px-3 py-2 sticky left-[76px] z-10 w-[100px] ${isOdd ? "bg-amber-50/40" : "bg-white"}`}>{item.hsnCode || "-"}</td>
                            <td className={`border px-3 py-2 sticky left-[176px] z-10 min-w-[360px] ${isOdd ? "bg-amber-50/40" : "bg-white"}`}>{item.description || "-"}</td>
                            <td className="border px-3 py-2 text-right font-mono">{item.totalQty == null ? "-" : formatNumber(item.totalQty)}</td>
                            <td className="border px-3 py-2">{item.uom || "-"}</td>
                            {(item.vendorData || []).map((v, vIdx) => {
                              const isLowest = lowestRate != null && v.rate != null && v.rate === lowestRate;
                              return (
                                <React.Fragment key={`unmatched-vd-${item.srNo}-${vIdx}`}>
                                  <td className={`border px-3 py-2 text-right font-mono ${isLowest ? "bg-emerald-100 text-emerald-900" : ""}`}>{v.rate == null ? "-" : formatInr(v.rate)}</td>
                                  <td className="border px-3 py-2 text-right font-mono">{v.amount == null ? "-" : formatInr(v.amount)}</td>
                                </React.Fragment>
                              );
                            })}
                            <td className="border px-3 py-2 text-muted-foreground">
                              — No match found
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={vendorDialogOpen}
        onOpenChange={(open) => {
          if (open) return;
          clearFile();
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add Missing Vendors</DialogTitle>
            <DialogDescription>
              We matched the vendors that already exist in the backend. Add the missing ones below, then the vendor comparison will continue with the same Excel vendor names.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
            {vendorDrafts.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                No missing vendors found.
              </div>
            ) : (
              vendorDrafts.map((draft, index) => (
                <Card key={`${draft.source_name || "vendor"}-${index}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{draft.source_name}</CardTitle>
                    <CardDescription>Fill the remaining vendor details before continuing.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Vendor Name</Label>
                      <Input
                        value={draft.vendor_name}
                        onChange={(event) => handleVendorDraftChange(index, "vendor_name", event.target.value)}
                        placeholder="Vendor name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={draft.vendor_company_name}
                        onChange={(event) => handleVendorDraftChange(index, "vendor_company_name", event.target.value)}
                        placeholder="Company name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={draft.vendor_email}
                        onChange={(event) => handleVendorDraftChange(index, "vendor_email", event.target.value)}
                        placeholder="vendor@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mobile Number</Label>
                      <Input
                        value={draft.mobile_number}
                        onChange={(event) => handleVendorDraftChange(index, "mobile_number", event.target.value)}
                        placeholder="Mobile number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={draft.location}
                        onChange={(event) => handleVendorDraftChange(index, "location", event.target.value)}
                        placeholder="Location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={draft.status || "active"}
                        onValueChange={(value) => handleVendorDraftChange(index, "status", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearFile} disabled={uploading}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleVendorDraftSubmit}
              disabled={uploading || vendorDrafts.some((draft) => !String(draft.vendor_name || "").trim())}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Vendors & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="vc-actionbar fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Badge className={statusBadge.badgeClass}>Status: {statusBadge.label}</Badge>
            {comparisonId ? <Badge variant="outline">ID: {comparisonId}</Badge> : null}
            <div className="text-xs text-muted-foreground sm:ml-2">
              {file ? <span className="mr-2">File: {file.name}</span> : null}
              {uploadedAt ? <span>Uploaded: {new Date(uploadedAt).toLocaleString()}</span> : null}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              onClick={() => updateStatus("rejected")}
              disabled={!comparisonId}
              className="border border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
            >
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
            <Button
              onClick={() => updateStatus("approved")}
              disabled={!comparisonId}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button variant="outline" onClick={deleteRecord} disabled={!comparisonId}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
