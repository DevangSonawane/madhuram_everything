import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { PencilLine, Plus, Minus, Mail, ChevronDown, Loader2, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { api } from "@/lib/api";
import { downloadPurchaseOrderPdf } from "@/lib/poPdf";
import { matchAgainstPrItems } from "@/lib/prItemMatcher";
import { EMPTY_PO, normalizePoData, sanitizeNumberInput, sanitizePhoneInput } from "@/pages/poShared";
import { RowActionsMenu } from "@/components/RowActionsMenu";

const NONE_VALUE = "__none__";

const parseIntegerOrNull = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeProjectAssignments = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => String(item).trim())
        .filter(Boolean);
    }
  }
  return [];
};

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

const parseDecimalValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).replace(/,/g, "").trim();
  if (normalized === "") return undefined;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const normalizeDateForApi = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const inlineDayFirstMatch = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (inlineDayFirstMatch) {
    const [, day, month, year] = inlineDayFirstMatch;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const inlineIsoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (inlineIsoMatch) {
    const [, year, month, day] = inlineIsoMatch;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
};

const buildItemPayloads = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const boqItemCode = String(
        item.boq_item_code ||
          item.boqItemCode ||
          item.item_no ||
          item.itemNo ||
          item.item_code ||
          item.itemCode ||
          item.code ||
          item.itemName ||
          item.item_name ||
          item.description ||
          ""
      ).trim();
      const itemName = String(item.item_name || item.itemName || item.material_description || item.description || boqItemCode || "").trim();
      const description = String(item.description || item.material_description || itemName || boqItemCode).trim();
      const payload = {
        srno: item.srNo || item.srno || index + 1,
        hsn: item.hsnCode || item.hsn || "",
        description,
        item_name: itemName || boqItemCode || description,
        qty: item.qty || item.quantity || "",
        UOM: item.uom || item.UOM || "",
        Rate: item.rate || item.Rate || "",
        Amount: item.amount || item.Amount || "",
        remark: item.remarks || item.remark || "",
        boq_id: item.boq_id || item.boqId || "",
        boq_qty: item.boq_qty || item.boqQty || item.qty || item.quantity || "",
        boq_item_code: boqItemCode || itemName || description || "",
      };
      const hasContent = payload.description || payload.hsn || payload.qty || payload.Rate || payload.Amount;
      return hasContent ? payload : null;
    })
    .filter(Boolean);
};

const renumberItems = (items) =>
  (Array.isArray(items) ? items : []).map((item, index) => ({
    ...item,
    srNo: String(index + 1),
  }));

const buildPoPayload = (poData, projectId) => ({
  project_id: projectId,
  sample_id: poData.sampleId === "" ? undefined : poData.sampleId,
  vendor_comparison_id: poData.vendorComparisonId || undefined,
  company_name: poData.companyName || "",
  company_subtitle: poData.companySubtitle || "",
  company_email: poData.companyEmail || "",
  company_gst: poData.companyGstNo || "",
  indent_no: poData.indentNo || "",
  indent_date: normalizeDateForApi(poData.indentDate),
  order_no: poData.orderNo || "",
  po_date: normalizeDateForApi(poData.poDate),
  vendor_name: poData.vendor.name || "",
  site: poData.vendor.site || "",
  site_address: poData.site_address || poData.vendor.siteAddress || "",
  primary_contact_name: poData.vendor.contacts.primary.name || "",
  primary_contact_number: poData.vendor.contacts.primary.phone || "",
  secondary_contact_name: poData.vendor.contacts.secondary.name || "",
  secondary_contact_number: poData.vendor.contacts.secondary.phone || "",
  items: buildItemPayloads(poData.items),
  discount: parseDecimalValue(poData.discount.percent),
  discount_amount: parseDecimalValue(poData.discount.amount),
  after_discount: parseDecimalValue(poData.afterDiscountAmount),
  cgst: parseDecimalValue(poData.taxes.cgst.percent),
  cgst_amount: parseDecimalValue(poData.taxes.cgst.amount),
  sgst: parseDecimalValue(poData.taxes.sgst.percent),
  sgst_amount: parseDecimalValue(poData.taxes.sgst.amount),
  total_amount: parseDecimalValue(poData.totalAmount),
  delivery: poData.summary.delivery || "",
  payment: poData.summary.payment || "",
  notes: poData.notes.length ? poData.notes.join("\\n") : "",
  status: poData.status || "created",
});

const formatPrNumber = (pr = {}) => {
  const explicit = String(pr.pr_number || pr.pr_no || pr.prNo || "").trim();
  if (explicit) return explicit;
  const sourceDate = pr.date || pr.created_at || new Date().toISOString();
  const parsed = new Date(sourceDate);
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const datePart = Number.isNaN(parsed.getTime()) ? "0000-00-00" : `${yyyy}-${mm}-${dd}`;
  const sequence = pr.pr_id || pr.id || "0";
  const project = pr.project_id || pr.projectId || "0";
  return `PR-${datePart}-${sequence}-${project}`;
};

const keepRawText = (value) => (value == null ? "" : String(value));

export default function PurchaseOrders() {
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.project_id ?? selectedProject?.id ?? routeProjectId ?? null;
  const isManualRoute = /\/purchase-orders\/manual\/?$/.test(String(location?.pathname || ""));
  const [poData, setPoData] = useState(EMPTY_PO);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recentPos, setRecentPos] = useState([]);
  const [poViewItem, setPoViewItem] = useState(null);
  const [poViewLinkedDcs, setPoViewLinkedDcs] = useState([]);
  const [poViewBackpathLoading, setPoViewBackpathLoading] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);
  const [sampleOptions, setSampleOptions] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [vcOptions, setVcOptions] = useState([]);
  const [loadingVcOptions, setLoadingVcOptions] = useState(false);
  const [prOptions, setPrOptions] = useState([]);
  const [loadingPrOptions, setLoadingPrOptions] = useState(false);
  const [loadingPrItems, setLoadingPrItems] = useState(false);
  const [loadingVcItems, setLoadingVcItems] = useState(false);
  const [selectedPrId, setSelectedPrId] = useState("");
  const [selectedVcId, setSelectedVcId] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailPo, setEmailPo] = useState(null);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [emailAttachments, setEmailAttachments] = useState([]);
  const [emailRemarks, setEmailRemarks] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [poDownloadingId, setPoDownloadingId] = useState(null);
  const [approvedVendorPrMap, setApprovedVendorPrMap] = useState(() => new Map());

  useEffect(() => {
    let active = true;
    const loadLinkedDcs = async () => {
      const poId = poViewItem?.po_id ?? poViewItem?.id;
      if (!poViewItem || !poId) {
        setPoViewLinkedDcs([]);
        return;
      }

      setPoViewBackpathLoading(true);
      try {
        const res = await api.getBackpathByPo(poId, { page: 1, limit: 200 });
        const payload = res?.success ? (res.data ?? res) : null;
        const dcs = Array.isArray(payload?.dcs) ? payload.dcs : (Array.isArray(payload?.data?.dcs) ? payload.data.dcs : []);
        if (!active) return;
        setPoViewLinkedDcs(dcs);
      } catch {
        if (!active) return;
        setPoViewLinkedDcs([]);
      } finally {
        if (active) setPoViewBackpathLoading(false);
      }
    };

    loadLinkedDcs();
    return () => {
      active = false;
    };
  }, [poViewItem?.po_id, poViewItem?.id]);

  const selectedSampleMissing = Boolean(
    poData.sampleId && !sampleOptions.some((sample) => String(sample.sample_id || sample.id) === poData.sampleId)
  );
  const selectedVcMissing = Boolean(
    selectedVcId && !vcOptions.some((vc) => String(vc?.id ?? vc?.comparison_id ?? vc?.vendor_comparison_id ?? vc?.comparisonId ?? "") === selectedVcId)
  );
  const selectedPrMissing = Boolean(
    selectedPrId && !prOptions.some((pr) => String(pr.pr_id || pr.id) === selectedPrId)
  );

  const getVendorId = (vendor) => String(vendor?.vendor_id ?? vendor?.id ?? "");

  const resolveEmailPo = (item) => {
    if (!item) return null;
    return item;
  };

  const openEmailDialog = async (item) => {
    const poId = parseIntegerOrNull(item?.po_id);
    if (!poId) {
      toast({ title: "Missing PO Id", description: "Save the PO before emailing.", variant: "destructive" });
      return;
    }

    setEmailPo(resolveEmailPo(item));
    setEmailDialogOpen(true);
    setVendorDropdownOpen(false);
    setVendorSearch("");
    setVendorOptions([]);
    setSelectedVendorIds([]);
    setEmailAttachments([]);
    setEmailRemarks("");
    setIsFileDragActive(false);
    setEmailLogs([]);

    try {
      setLoadingVendors(true);
      const result = await api.getVendorsByProject(projectId);
      if (!result.success || !Array.isArray(result.data)) {
        toast({
          title: "Failed to load vendors",
          description: result.error || "Could not load vendor list.",
          variant: "destructive",
        });
        return;
      }

      const vendorsWithEmail = result.data.filter((vendor) => String(vendor?.vendor_email || "").trim());
      setVendorOptions(vendorsWithEmail);
    } catch {
      toast({
        title: "Failed to load vendors",
        description: "Could not load vendor list.",
        variant: "destructive",
      });
    } finally {
      setLoadingVendors(false);
    }

    try {
      setLoadingEmailLogs(true);
      const logResult = await api.getPoEmailLogs(poId);
      if (logResult.success && Array.isArray(logResult.data)) {
        setEmailLogs(logResult.data);
      } else {
        setEmailLogs([]);
      }
    } catch {
      setEmailLogs([]);
    } finally {
      setLoadingEmailLogs(false);
    }
  };

  const toggleVendorSelection = (vendorId, checked) => {
    if (!vendorId) return;
    setSelectedVendorIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(vendorId);
      else next.delete(vendorId);
      return Array.from(next);
    });
  };

  const handleAttachmentSelect = (file) => {
    const normalized = [];

    if (file instanceof File) {
      normalized.push(file);
    } else if (file && typeof FileList !== "undefined" && file instanceof FileList) {
      Array.from(file).forEach((entry) => {
        if (entry instanceof File) normalized.push(entry);
      });
    } else if (Array.isArray(file)) {
      file.forEach((entry) => {
        if (entry instanceof File) normalized.push(entry);
      });
    }

    if (normalized.length === 0) return;
    setEmailAttachments((prev) => {
      const next = [...(Array.isArray(prev) ? prev : []), ...normalized];
      const seen = new Set();
      return next.filter((entry) => {
        const key = `${entry.name}-${entry.size}-${entry.lastModified}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  };

  const handleAttachmentDrop = (event) => {
    event.preventDefault();
    setIsFileDragActive(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) handleAttachmentSelect(files);
  };

  const handleSendPoEmail = async () => {
    if (!emailPo) return;
    const poId = parseIntegerOrNull(emailPo?.po_id);
    if (!poId) return;

    const selectedVendors = vendorOptions.filter((vendor) =>
      selectedVendorIds.includes(getVendorId(vendor))
    );
    if (selectedVendors.length === 0) {
      toast({
        title: "Select vendors",
        description: "Choose at least one vendor with a valid email.",
        variant: "destructive",
      });
      return;
    }

    try {
      setEmailSending(true);
      const to = selectedVendors
        .map((vendor) => String(vendor?.vendor_email || vendor?.email || "").trim())
        .filter(Boolean)
        .join(", ");
      const composedMessage = String(emailRemarks || "").trim();

      const result = await api.sendPoEmail({
        poId,
        to,
        attachmentFiles: emailAttachments,
        message: composedMessage,
      });

      if (!result.success) {
        toast({
          title: "Email failed",
          description: result.error || "Could not send PO email.",
          variant: "destructive",
        });
        return;
      }

      setEmailDialogOpen(false);
      setEmailPo(null);
      setEmailAttachments([]);
      setEmailRemarks("");
      setEmailLogs([]);
      toast({
        title: "Email sent",
        description: `PO sent to ${selectedVendors.length} vendor(s).`,
      });
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    if (!projectId) {
      setLoadingPos(false);
      setRecentPos([]);
      return;
    }

    const fetchPos = async () => {
      setLoadingPos(true);
      try {
        const result = await api.getPosByProject(projectId);
        if (result.success && Array.isArray(result.data)) {
          const mapped = result.data.map((record) => {
            const normalized = normalizePoData(record);
            const id = normalized.orderNo || `PO-${record.po_id || Date.now()}`;
            const date = normalized.poDate || normalized.indentDate || record.created_at || "";
            const vendorName = normalized.vendor?.name || "";
            const totalAmount = normalized.totalAmount || record.total_amount || "";
            const status = normalized.status || record.status || "created";
            return {
              id,
              date,
              vendor: vendorName,
              totalAmount,
              status,
              payload: normalized,
              po_id: record.po_id,
            };
          });
          setRecentPos(mapped);
        } else {
          if (result?.error) {
            toast({ title: "Error", description: result.error || "Failed to load purchase orders.", variant: "destructive" });
          }
          setRecentPos([]);
        }
      } catch (error) {
        toast({ title: "Error", description: error?.message || "Failed to load purchase orders.", variant: "destructive" });
        setRecentPos([]);
      } finally {
        setLoadingPos(false);
      }
    };

    fetchPos();
  }, [projectId, toast]);

  useEffect(() => {
    let mounted = true;
    const loadSamples = async () => {
      setLoadingSamples(true);
      try {
        const response = projectId ? await api.getSamplesByProject(projectId) : await api.getSamples();
        if (!mounted) return;
        if (!response.success || !Array.isArray(response.data)) {
          setSampleOptions([]);
          return;
        }
        const byId = new Map();
        response.data.forEach((sample) => {
          const id = sample?.sample_id ?? sample?.id;
          if (id == null || id === "") return;
          byId.set(String(id), sample);
        });
        setSampleOptions(Array.from(byId.values()));
      } catch {
        if (mounted) setSampleOptions([]);
      } finally {
        if (mounted) setLoadingSamples(false);
      }
    };

    loadSamples();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    const loadPrs = async () => {
      setLoadingPrOptions(true);
      try {
        const response = projectId ? await api.getPrsByProject(projectId) : await api.getPrs();
        if (!mounted) return;
        if (!response.success || !Array.isArray(response.data)) {
          setPrOptions([]);
          return;
        }
        const byId = new Map();
        response.data.forEach((pr) => {
          const id = pr?.pr_id ?? pr?.id;
          if (id == null || id === "") return;
          byId.set(String(id), pr);
        });
        setPrOptions(Array.from(byId.values()));
      } catch {
        if (mounted) setPrOptions([]);
      } finally {
        if (mounted) setLoadingPrOptions(false);
      }
    };

    loadPrs();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    const loadVcOptions = async () => {
      setLoadingVcOptions(true);
      try {
        const response = projectId ? await api.listVendorComparisons({ project_id: projectId }) : await api.listVendorComparisons();
        if (!mounted) return;
        if (!response.success || !Array.isArray(response.data)) {
          setVcOptions([]);
          return;
        }
        const byId = new Map();
        response.data.forEach((vc) => {
          const id = vc?.id ?? vc?.comparison_id ?? vc?.vendor_comparison_id ?? vc?.comparisonId;
          if (id == null || id === "") return;
          byId.set(String(id), vc);
        });
        setVcOptions(Array.from(byId.values()));
      } catch {
        if (mounted) setVcOptions([]);
      } finally {
        if (mounted) setLoadingVcOptions(false);
      }
    };

    loadVcOptions();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    let mounted = true;
    const loadApprovedVendorPrMap = async () => {
      if (!projectId) {
        if (mounted) setApprovedVendorPrMap(new Map());
        return;
      }

      try {
        const result = await api.listVendorComparisons({ project_id: projectId });
        const list = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.data?.data)
            ? result.data.data
            : Array.isArray(result?.data?.rows)
              ? result.data.rows
              : [];

        const score = (row) => {
          const updated = row?.updated_at ?? row?.updatedAt ?? row?.created_at ?? row?.createdAt ?? null;
          const t = updated ? new Date(updated).getTime() : 0;
          return Number.isFinite(t) ? t : 0;
        };

        const toNumberOrNull = (value) => {
          if (value === undefined || value === null || value === "") return null;
          const parsed = Number(String(value).replace(/,/g, "").trim());
          return Number.isNaN(parsed) ? null : parsed;
        };

        const computeTotal = (pricelist) => {
          const rows = Array.isArray(pricelist) ? pricelist : [];
          return rows.reduce((acc, item) => {
            const amount = toNumberOrNull(item?.amount);
            if (amount !== null) return acc + amount;
            const qty = toNumberOrNull(item?.total_qty ?? item?.qty ?? item?.quantity);
            const rate = toNumberOrNull(item?.rate);
            if (qty === null || rate === null) return acc;
            return acc + qty * rate;
          }, 0);
        };

        const byPrNo = new Map();
        list.forEach((row) => {
          const prNo = row?.pr_no;
          if (prNo == null || prNo === "") return;
          const pricelist = (() => {
            const raw =
              row?.pricelist ??
              row?.price_list ??
              row?.priceList ??
              row?.items ??
              [];
            return Array.isArray(raw) ? raw : [];
          })();
          if (pricelist.length === 0) return;

          const vendors = Array.from(
            new Set(
              pricelist
                .map((item) => String(item?.vendor_name ?? item?.vendorName ?? item?.vendor ?? "").trim())
                .filter(Boolean)
            )
          );
          if (vendors.length !== 1) return;
          const vendorName = vendors[0] || "";
          if (!vendorName) return;

          const prNoKey = String(prNo);
          const next = { vendorName, total: computeTotal(pricelist), _score: score(row) };
          const prev = byPrNo.get(prNoKey);
          if (!prev || next._score >= prev._score) byPrNo.set(prNoKey, next);
        });

        const map = new Map();
        byPrNo.forEach((value, key) => {
          map.set(key, { vendorName: value.vendorName, total: value.total });
        });
        if (mounted) setApprovedVendorPrMap(map);
      } catch {
        if (mounted) setApprovedVendorPrMap(new Map());
      }
    };

    loadApprovedVendorPrMap();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  const hasPreview = useMemo(() => {
    return poData.vendor?.name || poData.orderNo || poData.poDate || poData.totalAmount;
  }, [poData]);

  const poStats = useMemo(() => {
    const total = recentPos.length;
    const submitted = recentPos.filter((item) => String(item.status || "").toLowerCase() === "submitted").length;
    const created = recentPos.filter((item) => String(item.status || "").toLowerCase() !== "submitted").length;
    return { total, submitted, created };
  }, [recentPos]);

  const toNumberOrNull = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isNaN(parsed) ? null : parsed;
  };

  const formatCalculatedNumber = (value) => {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  };

  const recalculatePoAmounts = (
    nextPoData,
    { discountMode = "auto", cgstMode = "auto", sgstMode = "auto" } = {}
  ) => {
    const subtotal = (nextPoData.items || []).reduce((sum, item) => {
      const amount = toNumberOrNull(item.amount);
      return sum + (amount ?? 0);
    }, 0);

    const discountPercentInput = toNumberOrNull(nextPoData.discount?.percent);
    const discountAmountInput = toNumberOrNull(nextPoData.discount?.amount);

    let discountPercent = discountPercentInput;
    let discountAmount = 0;

    if (discountMode === "amount") {
      discountAmount = discountAmountInput ?? 0;
      discountPercent = subtotal > 0 ? (discountAmount * 100) / subtotal : undefined;
    } else if (discountMode === "percent") {
      discountAmount = discountPercentInput != null ? (subtotal * discountPercentInput) / 100 : 0;
    } else if (discountPercentInput != null) {
      discountAmount = (subtotal * discountPercentInput) / 100;
    } else if (discountAmountInput != null) {
      discountAmount = discountAmountInput;
      discountPercent = subtotal > 0 ? (discountAmount * 100) / subtotal : undefined;
    }

    const afterDiscountAmount = subtotal - discountAmount;

    const calculateTax = (tax, mode) => {
      const percentInput = toNumberOrNull(tax?.percent);
      const amountInput = toNumberOrNull(tax?.amount);

      if (mode === "amount") {
        const amount = amountInput ?? 0;
        const percent = afterDiscountAmount !== 0 ? (amount * 100) / afterDiscountAmount : undefined;
        return { percent, amount };
      }

      if (mode === "percent") {
        const percent = percentInput;
        const amount = percent != null ? (afterDiscountAmount * percent) / 100 : 0;
        return { percent, amount };
      }

      if (percentInput != null) {
        return { percent: percentInput, amount: (afterDiscountAmount * percentInput) / 100 };
      }

      if (amountInput != null) {
        return {
          amount: amountInput,
          percent: afterDiscountAmount !== 0 ? (amountInput * 100) / afterDiscountAmount : undefined,
        };
      }

      return { percent: undefined, amount: 0 };
    };

    const cgst = calculateTax(nextPoData.taxes?.cgst, cgstMode);
    const sgst = calculateTax(nextPoData.taxes?.sgst, sgstMode);
    const totalAmount = afterDiscountAmount + cgst.amount + sgst.amount;

    const toValue = (value) => (value != null ? formatCalculatedNumber(value) : "");

    return {
      ...nextPoData,
      subtotalAmount: subtotal > 0 ? formatCalculatedNumber(subtotal) : "",
      discount: {
        ...nextPoData.discount,
        percent: toValue(discountPercent),
        amount: discountAmount > 0 ? formatCalculatedNumber(discountAmount) : "",
      },
      afterDiscountAmount: subtotal > 0 ? formatCalculatedNumber(afterDiscountAmount) : "",
      taxes: {
        ...nextPoData.taxes,
        cgst: {
          ...nextPoData.taxes.cgst,
          percent: toValue(cgst.percent),
          amount: cgst.amount > 0 ? formatCalculatedNumber(cgst.amount) : "",
        },
        sgst: {
          ...nextPoData.taxes.sgst,
          percent: toValue(sgst.percent),
          amount: sgst.amount > 0 ? formatCalculatedNumber(sgst.amount) : "",
        },
      },
      totalAmount: totalAmount > 0 ? formatCalculatedNumber(totalAmount) : "",
    };
  };

  const updateLinkedTax = (taxKey, field, value, mode) => {
    const linkedTaxKey = taxKey === "cgst" ? "sgst" : "cgst";
    setPoData((prev) =>
      recalculatePoAmounts({
        ...prev,
        taxes: {
          ...prev.taxes,
          [taxKey]: { ...prev.taxes[taxKey], [field]: value },
          [linkedTaxKey]: { ...prev.taxes[linkedTaxKey], [field]: value },
        },
        source: "Manual",
      }, {
        [`${taxKey}Mode`]: mode,
        [`${linkedTaxKey}Mode`]: mode,
      })
    );
  };

  const updateDiscountField = (field, value, mode = "auto") => {
    setPoData((prev) =>
      recalculatePoAmounts({
        ...prev,
        discount: {
          ...prev.discount,
          [field]: value,
        },
        source: "Manual",
      }, {
        discountMode: mode,
      })
    );
  };

  const updateTaxField = (taxKey, field, value, mode = "auto") => {
    setPoData((prev) =>
      recalculatePoAmounts({
        ...prev,
        taxes: {
          ...prev.taxes,
          [taxKey]: {
            ...prev.taxes[taxKey],
            [field]: value,
          },
        },
        source: "Manual",
      }, {
        ...(taxKey === "cgst" ? { cgstMode: mode } : { sgstMode: mode }),
      })
    );
  };

  const updateSummaryField = (field, value) => {
    setPoData((prev) => ({
      ...prev,
      summary: {
        ...prev.summary,
        [field]: value,
      },
      source: "Manual",
    }));
  };

  const updateVendor = (key, value) => {
    setPoData((prev) => ({
      ...prev,
      site_address: key === "siteAddress" ? value : prev.site_address,
      vendor: { ...prev.vendor, [key]: value },
      source: "Manual",
    }));
  };

  const updateVendorContact = (key, field, value) => {
    const nextValue = field === "phone" ? sanitizePhoneInput(value) : value;
    setPoData((prev) => ({
      ...prev,
      vendor: {
        ...prev.vendor,
        contacts: {
          ...prev.vendor.contacts,
          [key]: { ...prev.vendor.contacts[key], [field]: nextValue },
        },
      },
      source: "Manual",
    }));
  };

  const updateItem = (index, field, value) => {
    if (field === "rate") return;
    const numericIntegerFields = new Set(["srNo"]);
    const numericDecimalFields = new Set(["qty", "rate", "amount"]);
    const nextValue = numericIntegerFields.has(field)
      ? sanitizeNumberInput(value, { allowDecimal: false })
      : numericDecimalFields.has(field)
        ? sanitizeNumberInput(value)
        : value;
    setPoData((prev) => {
      const nextItems = [...prev.items];
      const nextItem = { ...nextItems[index], [field]: nextValue };

      if (field === "item_name") {
        nextItem.description = nextValue;
        if (!String(nextItem.boq_item_code || "").trim()) {
          nextItem.boq_item_code = nextValue;
        }
      }
      if (field === "description") {
        nextItem.item_name = nextValue;
        if (!String(nextItem.boq_item_code || "").trim()) {
          nextItem.boq_item_code = nextValue;
        }
      }
      if (field === "boq_item_code" && !String(nextItem.item_name || "").trim()) {
        nextItem.item_name = nextValue;
      }

      if (field === "qty" || field === "rate") {
        const qty = Number(nextItem.qty);
        const rate = Number(nextItem.rate);
        const hasQty = nextItem.qty !== "" && !Number.isNaN(qty);
        const hasRate = nextItem.rate !== "" && !Number.isNaN(rate);
        nextItem.amount = hasQty && hasRate ? String(qty * rate) : "";
      }

      nextItems[index] = nextItem;
      return recalculatePoAmounts({ ...prev, items: nextItems, source: "Manual" });
    });
  };

  const addItem = () => {
    setPoData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          srNo: String(prev.items.length + 1),
          hsnCode: "",
          item_name: "",
          boq_item_code: "",
          description: "",
          qty: "",
          uom: "",
          rate: "",
          amount: "",
          remarks: "",
          boq_id: "",
          boq_qty: "",
        },
      ],
      source: "Manual",
    }));
  };

  const removeItem = (index) => {
    setPoData((prev) => {
      const nextItems = renumberItems(prev.items.filter((_, i) => i !== index));
      return recalculatePoAmounts({ ...prev, items: nextItems, source: "Manual" });
    });
  };

  const mapPrItemsToPoItems = (items, { inventoryDetailsById = new Map() } = {}) => {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      const inventoryId = item?.inventory_id ?? item?.inventoryId ?? null;
      const inv = inventoryId != null ? inventoryDetailsById.get(String(inventoryId)) : null;
      const make = String(item?.make || "").trim();
      const place = String(item?.place_of_utilisation || "").trim();
      const remarks = [make ? `Make: ${make}` : "", place ? `Place: ${place}` : ""]
        .filter(Boolean)
        .join(" | ");
      const qtyRaw = item?.req_qty ?? item?.qty ?? item?.quantity ?? "";
      const qtyNum = Number(String(qtyRaw ?? "").replace(/,/g, "").trim());
      const qty = qtyRaw == null ? "" : String(qtyRaw);

      const hsn =
        String(item?.hsn ?? item?.hsnCode ?? item?.hsn_code ?? "").trim() ||
        String(inv?.hsn ?? inv?.hsn_code ?? inv?.hsn_sac_code ?? "").trim() ||
        "";

      const uom =
        keepRawText(item?.unit) ||
        keepRawText(item?.uom) ||
        keepRawText(item?.UOM) ||
        keepRawText(inv?.unit) ||
        keepRawText(inv?.units) ||
        keepRawText(inv?.uom) ||
        keepRawText(inv?.UOM) ||
        "";

      const rateRaw =
        item?.rate ??
        item?.Rate ??
        inv?.price ??
        inv?.rate ??
        inv?.unit_price ??
        inv?.unitPrice ??
        "";
      const rateNum = Number(String(rateRaw ?? "").replace(/,/g, "").trim());
      const rate = rateRaw == null || rateRaw === "" ? "" : String(rateRaw);

      const computedAmount =
        Number.isFinite(qtyNum) && qtyNum > 0 && Number.isFinite(rateNum) && rateNum >= 0
          ? String(qtyNum * rateNum)
          : "";
      const itemName = String(
        item?.item_name ??
          item?.itemName ??
          item?.material_description ??
          item?.item_description ??
          item?.description ??
          ""
      ).trim();
      const boqItemCode = String(
        item?.boq_item_code ??
          item?.boqItemCode ??
          item?.item_code ??
          item?.itemCode ??
          item?.code ??
          itemName
      ).trim();
      return {
        srNo: String(index + 1),
        hsnCode: hsn,
        item_name: itemName || boqItemCode,
        description: String(item?.material_description || item?.item_description || item?.description || itemName || boqItemCode || "").trim(),
        qty,
        uom,
        rate,
        amount: computedAmount,
        remarks,
        boq_id: item?.boq_id ?? item?.boqId ?? "",
        boq_qty: item?.boq_qty ?? item?.boqQty ?? qty,
        boq_item_code: boqItemCode || itemName,
      };
    });
  };

  const parseArrayLike = (value, fallback = []) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    if (value && typeof value === "object") {
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.rows)) return value.rows;
      if (Array.isArray(value.items)) return value.items;
    }
    return fallback;
  };

  const getComparisonId = (comparison) =>
    comparison?.id ?? comparison?.comparison_id ?? comparison?.vendor_comparison_id ?? comparison?.comparisonId ?? null;

  const getPricelistRows = (comparison) =>
    parseArrayLike(
      comparison?.pricelist ??
        comparison?.price_list ??
        comparison?.priceList ??
        comparison?.items ??
        [],
      []
    );

  const getVendorName = (row) => String(row?.vendor_name ?? row?.vendorName ?? row?.vendor ?? "").trim();
  const getApprovedVendorName = (comparison) =>
    (() => {
      const explicitName = String(comparison?.approved_vendor_name ?? comparison?.approvedVendorName ?? "").trim();
      if (explicitName) return explicitName;
      const fallback = String(comparison?.approved_vendor ?? "").trim();
      if (!fallback) return "";
      return /^\d+$/.test(fallback) ? "" : fallback;
    })();
  const getUniqueVendors = (pricelist) =>
    Array.from(new Set((Array.isArray(pricelist) ? pricelist : []).map((row) => getVendorName(row)).filter(Boolean)));
  const getApprovedPricelistRows = (comparison, { fallbackVendorName = "" } = {}) => {
    const rows = getPricelistRows(comparison);
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const approvedVendorName = getApprovedVendorName(comparison) || String(fallbackVendorName || "").trim();
    const uniqueVendors = getUniqueVendors(rows);
    if (approvedVendorName) {
      const filtered = rows.filter((row) => getVendorName(row) === approvedVendorName);
      if (filtered.length > 0) return filtered;
    }

    if (uniqueVendors.length === 1) {
      const singleVendor = uniqueVendors[0];
      const filtered = rows.filter((row) => getVendorName(row) === singleVendor);
      if (filtered.length > 0) return filtered;
    }

    return rows;
  };

  const getVendorComparisonLabel = (comparison) => {
    const id = comparison?.id ?? comparison?.comparison_id ?? comparison?.vendor_comparison_id ?? comparison?.comparisonId ?? "";
    const prNo = comparison?.pr_no ?? comparison?.pr_number ?? comparison?.prNo ?? "";
    const vendorRows = getPricelistRows(comparison);
    const uniqueVendors = getUniqueVendors(vendorRows);
    const vendorLabel = getApprovedVendorName(comparison) || (uniqueVendors.length === 1 ? uniqueVendors[0] : "");
    return [
      id ? `VC ${id}` : "VC",
      prNo ? `PR ${prNo}` : "",
      vendorLabel ? `Vendor ${vendorLabel}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  };

  const mapVendorComparisonItemsToPoItems = (comparison, { inventoryDetailsById = new Map(), fallbackVendorName = "" } = {}) => {
    const rows = getApprovedPricelistRows(comparison, { fallbackVendorName });
    return rows.map((item, index) => {
      const qtyRaw = item?.total_qty ?? item?.qty ?? item?.quantity ?? "";
      const qty = qtyRaw == null ? "" : String(qtyRaw);
      const rateRaw = item?.rate ?? item?.unit_rate ?? item?.unitRate ?? "";
      const rate = rateRaw == null || rateRaw === "" ? "" : String(rateRaw);
      const amountRaw = item?.amount ?? "";
      const computedAmount =
        Number.isFinite(Number(qty)) && Number.isFinite(Number(rate)) ? String(Number(qty) * Number(rate)) : "";
      const itemDescription = String(item?.item_description ?? item?.description ?? item?.item_name ?? "").trim();
      const boqItemCode = String(
        item?.boq_item_code ??
          item?.boqItemCode ??
          item?.item_no ??
          item?.itemNo ??
          item?.item_code ??
          item?.itemCode ??
          item?.code ??
          itemDescription
      ).trim();
      const uom = keepRawText(item?.unit) || keepRawText(item?.uom) || keepRawText(item?.UOM) || "";
      const hsn = String(item?.hsn ?? item?.hsn_code ?? item?.hsnCode ?? "").trim();
      const vendorName = String(item?.vendor_name ?? item?.vendorName ?? item?.vendor ?? "").trim();
      return {
        srNo: String(index + 1),
        hsnCode: hsn,
        item_name: itemDescription || boqItemCode,
        description: itemDescription,
        qty,
        uom,
        rate,
        amount: computedAmount || (amountRaw == null ? "" : String(amountRaw)),
        remarks: vendorName ? `Vendor: ${vendorName}` : "",
        boq_item_code: boqItemCode || itemDescription,
      };
    });
  };

  const fetchApprovedVendorItemsForPr = async ({ prNo, prId }, projectIdValue, prItems = []) => {
    if ((!prNo && !prId) || !projectIdValue) return { items: [], approvedVendorName: "" };
    try {
      const makeByDescription = new Map();
      const boqItemCodeByDescription = new Map();
      (Array.isArray(prItems) ? prItems : []).forEach((prItem) => {
        const desc = String(prItem?.material_description ?? prItem?.description ?? "").trim();
        if (!desc) return;
        const key = desc.toLowerCase().replace(/\s+/g, " ").trim();
        const make = String(prItem?.make ?? "").trim();
        const boqItemCode = String(prItem?.boq_item_code ?? prItem?.boqItemCode ?? prItem?.item_name ?? prItem?.itemName ?? "").trim();
        if (!make) return;
        if (!makeByDescription.has(key)) makeByDescription.set(key, make);
        if (boqItemCode && !boqItemCodeByDescription.has(key)) boqItemCodeByDescription.set(key, boqItemCode);
      });

      const unwrapList = (res) => {
        if (!res?.success) return [];
        const raw = res.data;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.rows)) return raw.rows;
        if (Array.isArray(raw?.comparisons)) return raw.comparisons;
        return [];
      };

      const prNoValue = prNo ?? "";
      const prIdValue = prId ?? "";

      let list = [];
      if (prNoValue !== "" && prNoValue != null) {
        const res = await api.listVendorComparisons({ project_id: projectIdValue, pr_no: prNoValue });
        list = unwrapList(res);
      }
      if (list.length === 0 && prIdValue !== "" && prIdValue != null) {
        const res = await api.listVendorComparisons({ project_id: projectIdValue, pr_no: prIdValue });
        list = unwrapList(res);
      }
      if (list.length === 0) {
        const res = await api.listVendorComparisons({ project_id: projectIdValue });
        list = unwrapList(res);
      }

      // Backend may ignore pr_no filter; do client-side match as fallback.
      const prNoCandidates = [prNo, prId].filter((v) => v != null && v !== "").map((v) => String(v));
      const matching = list.filter((row) => {
        const rowPrNo = String(row?.pr_no ?? row?.prNo ?? "");
        return prNoCandidates.includes(rowPrNo);
      });
      const candidates = matching.length > 0 ? matching : list;

      const sortedCandidates = [...candidates].sort((a, b) => {
        const aTime = new Date(a?.updated_at ?? a?.updatedAt ?? a?.created_at ?? a?.createdAt ?? 0).getTime();
        const bTime = new Date(b?.updated_at ?? b?.updatedAt ?? b?.created_at ?? b?.createdAt ?? 0).getTime();
        const aScore = Number.isFinite(aTime) ? aTime : 0;
        const bScore = Number.isFinite(bTime) ? bTime : 0;
        return bScore - aScore;
      });

      let approvedComparison = null;
      let approvedVendorName = "";
      let approvedItems = [];

      for (const row of sortedCandidates) {
        let pricelist = getPricelistRows(row);
        if (!Array.isArray(pricelist) || pricelist.length === 0) {
          const comparisonId = getComparisonId(row);
          if (comparisonId != null && comparisonId !== "") {
            try {
              const detail = await api.getVendorComparisonById(comparisonId);
              if (detail?.success) pricelist = getPricelistRows(detail.data || {});
            } catch {
              // ignore
            }
          }
        }
        if (!Array.isArray(pricelist) || pricelist.length === 0) continue;
        const uniqueVendors = getUniqueVendors(pricelist);
        approvedVendorName = getApprovedVendorName(row) || (uniqueVendors.length === 1 ? uniqueVendors[0] : "");
        if (!approvedVendorName) continue;
        approvedItems = pricelist.filter((item) => getVendorName(item) === approvedVendorName);
        if (approvedItems.length === 0) continue;
        approvedComparison = row;
        break;
      }

      if (!approvedComparison) return { items: [], approvedVendorName: "" };

      const items = approvedItems.map((item, index) => {
        const itemDescriptionRaw = String(item?.item_description || item?.description || "").trim();
        const makeKey = itemDescriptionRaw.toLowerCase().replace(/\s+/g, " ").trim();
        const make = makeByDescription.get(makeKey) || "";
        const boqItemCode = boqItemCodeByDescription.get(makeKey) || "";
        const prMatch = matchAgainstPrItems(item, prItems);
        const matchedPrItem = prMatch?.matchedPrItem || null;
        const matchedPrName = String(
          matchedPrItem?.item_name ??
            matchedPrItem?.itemName ??
            matchedPrItem?.material_description ??
            matchedPrItem?.item_description ??
            matchedPrItem?.description ??
            ""
        ).trim();
        const matchedPrCode = String(
          matchedPrItem?.boq_item_code ??
            matchedPrItem?.boqItemCode ??
            matchedPrItem?.item_code ??
            matchedPrItem?.itemCode ??
            matchedPrItem?.code ??
            ""
        ).trim();
        const qtyRaw = item?.total_qty ?? item?.qty ?? item?.quantity ?? "";
        const rateRaw = item?.rate ?? "";
        const amountRaw = item?.amount ?? "";
        const remarks = [make ? `Make: ${make}` : ""].filter(Boolean).join(" | ");
        return {
          srNo: String(index + 1),
          hsnCode: String(item?.hsn ?? item?.hsn_code ?? item?.hsnCode ?? "").trim() || "",
          item_name: matchedPrName || boqItemCode || itemDescriptionRaw,
          description: String(item?.item_description || item?.description || matchedPrName || boqItemCode || itemDescriptionRaw || "").trim(),
          qty: qtyRaw == null ? "" : String(qtyRaw),
          uom: keepRawText(item?.unit) || keepRawText(item?.uom) || keepRawText(item?.UOM) || "",
          rate: rateRaw == null || rateRaw === "" ? "" : String(rateRaw),
          amount: amountRaw == null || amountRaw === "" ? "" : String(amountRaw),
          remarks,
          boq_id: item?.boq_id ?? item?.boqId ?? "",
          boq_qty: item?.boq_qty ?? item?.boqQty ?? (qtyRaw == null ? "" : String(qtyRaw)),
          boq_item_code: matchedPrCode || boqItemCode || matchedPrName || itemDescriptionRaw,
        };
      });
      return { items, approvedVendorName };
    } catch {
      return { items: [], approvedVendorName: "" };
    }
  };

  const parseArrayField = (value, fallback = []) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }
    if (value && typeof value === "object") {
      // Some APIs wrap arrays under `items` / `data`.
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.data)) return value.data;
    }
    return value ?? fallback;
  };

  const unwrapSampleResponse = (raw, sampleId) => {
    if (!raw) return null;
    if (Array.isArray(raw)) {
      const hit = raw.find((row) => String(row?.sample_id ?? row?.id ?? "") === String(sampleId));
      return hit || raw[0] || null;
    }
    if (raw.sample) return raw.sample;
    if (raw.data) return raw.data;
    return raw;
  };

  const mapSampleItemsToPoItems = (sample, { boqLookup = null } = {}) => {
    const rows = parseArrayField(sample?.item_description ?? sample?.items ?? sample?.item_descriptions, []);
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const fieldVal = (row, key) => {
      const fields = parseArrayField(row?.add_fields ?? row?.addFields, []);
      if (!Array.isArray(fields)) return "";
      const hit = fields.find((f) => String(f?.key || "").trim() === key);
      return hit?.value ?? "";
    };

    const toNumberMaybe = (v) => {
      const n = Number(String(v ?? "").replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : null;
    };

    return rows
      .map((row, index) => {
        const boqId = String(fieldVal(row, "boq_id") || "").trim();
        const lookupItemNo = String(fieldVal(row, "item_no") || "").trim();
        const itemCode = String(fieldVal(row, "item_code") || fieldVal(row, "itemCode") || "").trim();
        const boqMatch = (() => {
          if (!boqLookup) return null;
          if (boqId) return boqLookup.byId.get(boqId) || null;
          if (lookupItemNo) return boqLookup.byItemNo.get(lookupItemNo) || null;
          if (itemCode) return boqLookup.byItemCode.get(itemCode) || null;
          return null;
        })();

        const srNo = String(row?.sr_no ?? row?.srNo ?? row?.srno ?? row?.sr ?? index + 1);
        const description =
          String(row?.description ?? "").trim() ||
          String(fieldVal(row, "description") || "").trim();
        const itemNo = String(row?.item_no ?? row?.itemNo ?? fieldVal(row, "item_no") ?? fieldVal(row, "itemNo") ?? "").trim();
        const uom =
          keepRawText(row?.unit) ||
          keepRawText(row?.uom) ||
          keepRawText(row?.UOM) ||
          keepRawText(fieldVal(row, "unit")) ||
          keepRawText(fieldVal(row, "UOM")) ||
          keepRawText(fieldVal(row, "uom"));
        const qtyRaw =
          row?.quantity ??
          fieldVal(row, "selected_qty") ??
          fieldVal(row, "qty") ??
          fieldVal(row, "quantity") ??
          "";
        const rateRaw =
          row?.rate ??
          row?.unit_price ??
          row?.unitPrice ??
          fieldVal(row, "rate") ??
          fieldVal(row, "Rate") ??
          fieldVal(row, "unit_price") ??
          fieldVal(row, "unitPrice") ??
          (boqMatch ? (boqMatch.rate ?? boqMatch.unit_price ?? "") : "") ??
          "";
        const amountRaw =
          row?.value ??
          row?.amount ??
          fieldVal(row, "amount") ??
          fieldVal(row, "value") ??
          fieldVal(row, "Amount") ??
          (boqMatch ? (boqMatch.amount ?? boqMatch.value ?? "") : "") ??
          "";
        const hsn =
          String(row?.hsn ?? "").trim() ||
          String(fieldVal(row, "hsn") || fieldVal(row, "HSN") || fieldVal(row, "item_code") || fieldVal(row, "itemCode") || "").trim() ||
          String(boqMatch?.hsn ?? boqMatch?.hsn_sac_code ?? boqMatch?.sac_code ?? "").trim();

        const qty = qtyRaw == null ? "" : String(qtyRaw);
        const rate = rateRaw == null ? "" : String(rateRaw);
        const computed = (() => {
          const q = toNumberMaybe(qtyRaw);
          const r = toNumberMaybe(rateRaw);
          if (q == null || r == null) return "";
          return String(q * r);
        })();

        const amount = computed || (amountRaw == null ? "" : String(amountRaw));

        const hasContent = description || qty || rate || amount || hsn;
        if (!hasContent) return null;

        return {
          srNo,
          hsnCode: hsn,
          description,
          qty,
          uom,
          rate,
          amount,
          remarks: "",
          boq_id: boqMatch?.boq_id ?? boqMatch?.id ?? row?.boq_id ?? row?.boqId ?? "",
          boq_qty: row?.boq_qty ?? row?.boqQty ?? qty,
          boq_item_code: itemNo || boqMatch?.item_no || boqMatch?.itemNo || boqMatch?.item_code || boqMatch?.itemCode || "",
        };
      })
      .filter(Boolean);
  };

  const handleSampleSelect = async (value) => {
    const nextSampleId = value === NONE_VALUE ? "" : value;
    setPoData((prev) => ({ ...prev, sampleId: nextSampleId, source: "Manual" }));
    if (!nextSampleId) return;

    try {
      let boqLookup = null;
      try {
        const boqRes = await api.getBOQsByProject(projectId);
        const rows = boqRes?.success
          ? (Array.isArray(boqRes.data)
              ? boqRes.data
              : Array.isArray(boqRes.data?.boqs)
                ? boqRes.data.boqs
                : Array.isArray(boqRes.data?.data)
                  ? boqRes.data.data
                  : [])
          : [];
        const byId = new Map();
        const byItemNo = new Map();
        const byItemCode = new Map();
        rows.forEach((r) => {
          const id = r?.boq_id ?? r?.id;
          if (id != null) byId.set(String(id), r);
          const itemNo = r?.item_no ?? r?.itemNo;
          const itemCode = r?.item_code ?? r?.itemCode ?? r?.code;
          if (itemNo) byItemNo.set(String(itemNo).trim(), r);
          if (itemCode) byItemCode.set(String(itemCode).trim(), r);
        });
        boqLookup = { byId, byItemNo, byItemCode };
      } catch {
        boqLookup = null;
      }

      const res = await api.getSampleById(nextSampleId);
      if (!res?.success) {
        toast({ title: "Error", description: res?.error || "Failed to load sample items.", variant: "destructive" });
        return;
      }
      const unwrapped = unwrapSampleResponse(res.data, nextSampleId);
      const mapped = mapSampleItemsToPoItems(unwrapped || {}, { boqLookup });
      setPoData((prev) => {
        const nextItems = Array.isArray(prev.items) && prev.items.length > 0 ? prev.items : mapped;
        return recalculatePoAmounts({
          ...prev,
          sampleId: nextSampleId,
          items: nextItems,
          source: "Manual",
        });
      });
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to load sample items.", variant: "destructive" });
    }
  };

  const applySelectedPrToPo = async (selectedPr) => {
    if (!selectedPr) return;
    const rawItems = Array.isArray(selectedPr.items) ? selectedPr.items : [];
    const inventoryIds = Array.from(
      new Set(
        rawItems
          .map((it) => it?.inventory_id ?? it?.inventoryId)
          .filter((id) => id != null && String(id).trim() !== "")
          .map((id) => String(id))
      )
    );

    const inventoryDetailsById = new Map();
    if (inventoryIds.length > 0) {
      const results = await Promise.all(
        inventoryIds.map(async (id) => {
          try {
            const res = await api.getInventoryChain(id);
            const item = res?.success ? (res?.data?.item || {}) : {};
            return [id, item];
          } catch {
            return [id, null];
          }
        })
      );
      results.forEach(([id, item]) => {
        if (item) inventoryDetailsById.set(String(id), item);
      });
    }

    const mappedItems = mapPrItemsToPoItems(rawItems, { inventoryDetailsById });
    setPoData((prev) =>
      recalculatePoAmounts({
        ...prev,
        sampleId: selectedPr.sample_id != null && selectedPr.sample_id !== "" ? String(selectedPr.sample_id) : prev.sampleId,
        items: mappedItems,
        source: "Manual",
      })
    );
  };

  const applySelectedVcToPo = async (selectedVc) => {
    if (!selectedVc) return;

    const vcPrNo = String(selectedVc?.pr_no ?? selectedVc?.pr_number ?? selectedVc?.prNo ?? "").trim();
    const approvedVendorNameFromMap = vcPrNo ? String(approvedVendorPrMap.get(vcPrNo)?.vendorName || "").trim() : "";
    const approvedVendorName = getApprovedVendorName(selectedVc) || approvedVendorNameFromMap;
    const rawItems = getApprovedPricelistRows(selectedVc, { fallbackVendorName: approvedVendorName });
    const matchedPr = vcPrNo
      ? prOptions.find((pr) => {
          const prId = String(pr?.pr_id ?? pr?.id ?? "").trim();
          const prNo = String(pr?.pr_no ?? pr?.pr_number ?? pr?.prNo ?? "").trim();
          return prId === vcPrNo || prNo === vcPrNo;
        }) || null
      : null;
    const inventoryIds = Array.from(
      new Set(
        rawItems
          .map((it) => it?.inventory_id ?? it?.inventoryId)
          .filter((id) => id != null && String(id).trim() !== "")
          .map((id) => String(id))
      )
    );

    const inventoryDetailsById = new Map();
    if (inventoryIds.length > 0) {
      const results = await Promise.all(
        inventoryIds.map(async (id) => {
          try {
            const res = await api.getInventoryChain(id);
            const item = res?.success ? (res?.data?.item || {}) : {};
            return [id, item];
          } catch {
            return [id, null];
          }
        })
      );
      results.forEach(([id, item]) => {
        if (item) inventoryDetailsById.set(String(id), item);
      });
    }

    const mappedItems = mapVendorComparisonItemsToPoItems(selectedVc, {
      inventoryDetailsById,
      fallbackVendorName: approvedVendorName,
    });
    const vendorName = approvedVendorName || getUniqueVendors(rawItems)[0] || "";
    const vcId = selectedVc?.id ?? selectedVc?.comparison_id ?? selectedVc?.vendor_comparison_id ?? selectedVc?.comparisonId ?? "";
    setPoData((prev) =>
      recalculatePoAmounts({
        ...prev,
        vendorComparisonId: vcId ? String(vcId) : prev.vendorComparisonId,
        indentNo: matchedPr?.pr_number || matchedPr?.pr_no || matchedPr?.prNo || vcPrNo || prev.indentNo || "",
        vendor: {
          ...prev.vendor,
          name: vendorName || prev.vendor?.name || "",
        },
        items: mappedItems,
      source: "Manual",
      })
    );
    setSelectedPrId(matchedPr ? String(matchedPr?.pr_id ?? matchedPr?.id ?? "") : "");
  };

  const handleVcSelect = async (value) => {
    if (value === NONE_VALUE) {
      setSelectedVcId("");
      setPoData((prev) => ({ ...prev, items: [], vendorComparisonId: "", indentNo: "", source: "Manual" }));
      return;
    }

    setSelectedVcId(value);
    setSelectedPrId("");
    setLoadingVcItems(true);
    try {
      let vcData = vcOptions.find((vc) => String(vc?.id ?? vc?.comparison_id ?? vc?.vendor_comparison_id ?? vc?.comparisonId ?? "") === String(value));
      if (!vcData) {
        const response = await api.getVendorComparisonById(value);
        if (!response?.success) {
          toast({ title: "Error", description: response?.error || "Failed to load vendor comparison items.", variant: "destructive" });
          return;
        }
        vcData = response.data || {};
      }

      if (getPricelistRows(vcData).length === 0) {
        const detail = await api.getVendorComparisonById(value);
        if (detail?.success && detail.data) {
          vcData = detail.data;
        }
      }

      await applySelectedVcToPo(vcData);
      const comparisonLabel = getVendorComparisonLabel(vcData);
      toast({ title: "VC loaded", description: comparisonLabel || `Loaded VC ${value}.` });
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to load vendor comparison items.", variant: "destructive" });
    } finally {
      setLoadingVcItems(false);
    }
  };

  const handlePrNumberSelect = async (value) => {
    if (value === NONE_VALUE) {
      setSelectedPrId("");
      return;
    }

    setSelectedPrId(value);
    setSelectedVcId("");
    setPoData((prev) => ({ ...prev, vendorComparisonId: "", source: "Manual" }));
    const selectedPr = prOptions.find((pr) => String(pr.pr_id || pr.id) === String(value));
    const fallbackPrNo = selectedPr?.pr_no ?? selectedPr?.pr_number ?? null;

    setLoadingPrItems(true);
    try {
      let prData = selectedPr;
      if (!(prData && Array.isArray(prData.items) && prData.items.length > 0)) {
        const response = await api.getPrById(value);
        if (!response.success) {
          toast({ title: "Error", description: response.error || "Failed to load PR items.", variant: "destructive" });
          return;
        }
        prData = response.data || {};
      }

      await applySelectedPrToPo(prData);

      const prItems = Array.isArray(prData?.items) ? prData.items : [];
      const prNo =
        prData?.pr_no ??
        prData?.pr_number ??
        prData?.prNo ??
        fallbackPrNo ??
        null;
      const { items: approvedItems, approvedVendorName } = await fetchApprovedVendorItemsForPr(
        { prNo, prId: value },
        projectId,
        prItems
      );
      if (approvedItems.length > 0) {
        setPoData((prev) =>
          recalculatePoAmounts(
            {
              ...prev,
              vendor: {
                ...prev.vendor,
                name: approvedVendorName || prev.vendor?.name || "",
              },
              items: approvedItems,
              source: "Manual",
            }
          )
        );
        toast({ title: "Approved vendor items loaded", description: approvedVendorName ? `Vendor: ${approvedVendorName}` : undefined });
      } else {
        toast({ title: "No approved vendor found, using PR items" });
      }
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to load PR items.", variant: "destructive" });
    } finally {
      setLoadingPrItems(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({ title: "Invalid file", description: "Please upload a PO PDF file.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const result = await api.parsePoFile(file);
      if (!result.success) {
        throw new Error(result.error || "Could not parse PO document.");
      }

      const parsedPayload = result?.data?.data || {};
      const normalized = normalizePoData(parsedPayload);
      const next = {
        ...normalized,
        source: "Extracted",
        sourceFileName: result?.data?.filename || file.name,
      };

      const recalculated = recalculatePoAmounts(next);
      setPoData(recalculated);
      navigate("preview", { state: { poData: recalculated, mode: "create" } });
    } catch (error) {
      toast({ title: "Upload failed", description: error?.message || "Could not extract PO document.", variant: "destructive" });
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

  const handleSubmitPo = async () => {
    if (!projectId) {
      toast({ title: "Select project", description: "Choose a project before submitting a PO.", variant: "destructive" });
      return;
    }

    if (!poData.sampleId) {
      toast({ title: "Select sample", description: "Sample ID is required for purchase order.", variant: "destructive" });
      return;
    }

    const numericProjectId = Number(projectId);
    if (Number.isNaN(numericProjectId)) {
      toast({ title: "Select project", description: "Invalid project selected.", variant: "destructive" });
      return;
    }

    const payload = buildPoPayload(poData, numericProjectId);
    setSubmitting(true);
    try {
      const response = await api.createPo(payload);
      if (response.success) {
        toast({ title: "PO submitted", description: "Purchase order saved successfully." });
        setPoData(EMPTY_PO);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        const result = await api.getPosByProject(numericProjectId);
        if (result.success && Array.isArray(result.data)) {
          const mapped = result.data.map((record) => {
            const normalized = normalizePoData(record);
            const id = normalized.orderNo || `PO-${record.po_id || Date.now()}`;
            const date = normalized.poDate || normalized.indentDate || record.created_at || "";
            const vendorName = normalized.vendor?.name || "";
            const totalAmount = normalized.totalAmount || record.total_amount || "";
            const status = normalized.status || record.status || "created";
            return {
              id,
              date,
              vendor: vendorName,
              totalAmount,
              status,
              payload: normalized,
              po_id: record.po_id,
            };
          });
          setRecentPos(mapped);
        }
        navigate(`/${numericProjectId}/purchase-orders`);
      } else {
        toast({ title: "Error", description: response.error || "Failed to submit PO.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to submit PO.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setPoData(EMPTY_PO);
    setSelectedPrId("");
    setSelectedVcId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteRecent = async (item) => {
    if (!item) return;
    if (!item.po_id) {
      setRecentPos((prev) => prev.filter((entry) => entry.id !== item.id));
      return;
    }

    try {
      const res = await api.deletePo(item.po_id);
      if (res.success) {
        toast({ title: "PO deleted", description: "Purchase order removed successfully." });
        setRecentPos((prev) => prev.filter((entry) => entry.po_id !== item.po_id));
      } else {
        toast({ title: "Error", description: res.error || "Failed to delete purchase order.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Failed to delete purchase order.", variant: "destructive" });
    }
  };

  const handleEditRecent = (item) => {
    if (!item?.payload) return;
    const normalized = normalizePoData(item.payload);
    const recalculated = recalculatePoAmounts(normalized);
    setPoData(recalculated);
    navigate("preview", {
      state: {
        poData: recalculated,
        poId: item.po_id ?? recalculated.po_id ?? null,
        mode: "edit",
      },
    });
  };

  const handleDownloadPoPdf = async (item) => {
    if (!item) return;
    try {
      setPoDownloadingId(item.po_id || item.id || "po");
      const poPayload = item.payload ? normalizePoData(item.payload) : normalizePoData(item);
      await downloadPurchaseOrderPdf(poPayload, {
        fileName: `Purchase-Order-${String(poPayload.orderNo || item.id || "PO")}.pdf`,
      });
      toast({
        title: "Downloaded",
        description: `Purchase-Order-${String(poPayload.orderNo || item.id || "PO")}.pdf`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error?.message || "Could not generate the PO PDF.",
        variant: "destructive",
      });
    } finally {
      setPoDownloadingId(null);
    }
  };

  const prettyKey = (key) => {
    const raw = String(key || "").trim();
    if (!raw) return "";
    const withSpaces = raw
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  };

  const renderSimpleLines = (lines = []) => {
    const normalized = lines
      .map((line) => String(line || "").trim())
      .filter(Boolean);
    if (normalized.length === 0) return "-";
    return (
      <div className="space-y-1">
        {normalized.map((line, idx) => (
          <div key={`${idx}-${line}`} className="break-words">
            {line}
          </div>
        ))}
      </div>
    );
  };

  const renderPoValue = (key, value) => {
    if (value == null || value === "") return "-";

    const normalizedKey = String(key || "")
      .toLowerCase()
      .replace(/[_\s-]+/g, "_")
      .trim();

    if (Array.isArray(value)) {
      if (value.length === 0) return "-";
      const primitives = value.every((entry) => entry == null || ["string", "number", "boolean"].includes(typeof entry));
      if (primitives) {
        const joined = value
          .map((entry) => (entry == null ? "" : String(entry).trim()))
          .filter(Boolean)
          .join(", ");
        return joined || "-";
      }

      if (normalizedKey === "items") {
        const lines = value.map((item, idx) => {
          const srNo = item?.srNo ?? item?.sr_no ?? item?.srno ?? idx + 1;
          const description = String(item?.description || "").trim() || "-";
          const hsn = String(item?.hsnCode ?? item?.hsn ?? "").trim();
          const qty = String(item?.qty ?? item?.quantity ?? "").trim();
          const uom = String(item?.uom ?? item?.UOM ?? "").trim();
          const rate = String(item?.rate ?? item?.Rate ?? "").trim();
          const amount = String(item?.amount ?? item?.Amount ?? "").trim();
          const remark = String(item?.remarks ?? item?.remark ?? "").trim();

          const parts = [
            `${srNo}. ${description}`,
            hsn ? `HSN ${hsn}` : "",
            qty ? `Qty ${qty}${uom ? ` ${uom}` : ""}` : "",
            rate ? `Rate ${rate}` : "",
            amount ? `Amount ${amount}` : "",
            remark ? `Remark ${remark}` : "",
          ].filter(Boolean);

          return parts.join(" | ");
        });
        return renderSimpleLines(lines);
      }

      // Generic array of objects: show one line per entry without JSON braces.
      const lines = value.map((entry) => {
        if (entry == null) return "";
        if (typeof entry !== "object") return String(entry);
        const flat = Object.entries(entry)
          .map(([k, v]) => {
            if (v == null || v === "") return "";
            if (typeof v === "object") return "";
            return `${prettyKey(k)}: ${String(v).trim()}`;
          })
          .filter(Boolean);
        return flat.join(" | ");
      });
      return renderSimpleLines(lines);
    }

    if (typeof value === "object") {
      if (normalizedKey === "vendor") {
        const name = String(value?.name ?? value?.vendor_name ?? "").trim();
        const site = String(value?.site ?? "").trim();
        const siteAddress = String(value?.siteAddress ?? value?.site_address ?? value?.vendor_address ?? "").trim();
        const contacts = value?.contacts ?? {};
        const primaryName = String(contacts?.primary?.name ?? "").trim();
        const primaryPhone = String(contacts?.primary?.phone ?? "").trim();
        const secondaryName = String(contacts?.secondary?.name ?? "").trim();
        const secondaryPhone = String(contacts?.secondary?.phone ?? "").trim();

        return renderSimpleLines([
          name ? `Name: ${name}` : "",
          site ? `Site: ${site}` : "",
          siteAddress ? `Site Address: ${siteAddress}` : "",
          primaryName || primaryPhone ? `Primary Contact: ${[primaryName, primaryPhone].filter(Boolean).join(" - ")}` : "",
          secondaryName || secondaryPhone ? `Secondary Contact: ${[secondaryName, secondaryPhone].filter(Boolean).join(" - ")}` : "",
        ]);
      }

      if (normalizedKey === "items_group") {
        const title = String(value?.title ?? "").trim();
        const description = String(value?.description ?? "").trim();
        return renderSimpleLines([title ? `Title: ${title}` : "", description ? `Description: ${description}` : ""]);
      }

      if (normalizedKey === "discount") {
        const percent = String(value?.percent ?? "").trim();
        const amount = String(value?.amount ?? "").trim();
        return renderSimpleLines([percent ? `Percent: ${percent}` : "", amount ? `Amount: ${amount}` : ""]);
      }

      if (normalizedKey === "taxes") {
        const cgstPercent = String(value?.cgst?.percent ?? "").trim();
        const cgstAmount = String(value?.cgst?.amount ?? "").trim();
        const sgstPercent = String(value?.sgst?.percent ?? "").trim();
        const sgstAmount = String(value?.sgst?.amount ?? "").trim();
        return renderSimpleLines([
          cgstPercent || cgstAmount ? `CGST: ${cgstPercent ? `${cgstPercent}%` : "-"}${cgstAmount ? ` (${cgstAmount})` : ""}` : "",
          sgstPercent || sgstAmount ? `SGST: ${sgstPercent ? `${sgstPercent}%` : "-"}${sgstAmount ? ` (${sgstAmount})` : ""}` : "",
        ]);
      }

      if (normalizedKey === "summary") {
        const lines = Object.entries(value || {})
          .map(([k, v]) => {
            if (v == null || v === "") return "";
            if (typeof v === "object") return "";
            const cleaned = String(v).trim();
            if (!cleaned) return "";
            return `${prettyKey(k)}: ${cleaned}`;
          })
          .filter(Boolean);
        return renderSimpleLines(lines);
      }

      // Generic object: show key/value pairs without braces/quotes.
      const lines = Object.entries(value || {})
        .map(([k, v]) => {
          if (v == null || v === "") return "";
          if (typeof v === "object") return "";
          const cleaned = String(v).trim();
          if (!cleaned) return "";
          return `${prettyKey(k)}: ${cleaned}`;
        })
        .filter(Boolean);
      return renderSimpleLines(lines);
    }

    return String(value);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-slate-50 via-white to-emerald-50 p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage purchase orders and create new ones when needed.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <Button variant="outline" onClick={() => projectId ? navigate(`/${projectId}/purchase-orders`) : navigate("/purchase-orders")}>
              Refresh
            </Button>
            {isManualRoute ? (
              <Button onClick={() => navigate(projectId ? `/${projectId}/purchase-orders` : "/purchase-orders")}>
                Back to List
              </Button>
            ) : (
              <Button onClick={() => navigate(projectId ? `/${projectId}/purchase-orders/manual` : "/purchase-orders/manual")}>
                <Plus className="mr-2 h-4 w-4" /> Create PO
              </Button>
            )}
          </div>
        </div>
      </section>

      {!isManualRoute ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-2 bg-muted/10">
                <CardDescription>Total POs</CardDescription>
                <CardTitle className="text-2xl">{poStats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-2 bg-muted/10">
                <CardDescription>Submitted</CardDescription>
                <CardTitle className="text-2xl">{poStats.submitted}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
              <CardHeader className="pb-2 bg-muted/10">
                <CardDescription>Draft / Other</CardDescription>
                <CardTitle className="text-2xl">{poStats.created}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle>PO List</CardTitle>
              <CardDescription>All purchase orders for the selected project.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {recentPos.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 space-y-3 cursor-pointer"
                    onClick={() => setPoViewItem(item)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{item.id}</div>
                        <div className="text-xs text-muted-foreground">{item.date}</div>
                      </div>
                      <Badge variant={item.status === "Submitted" ? "default" : "secondary"}>{item.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                      <div className="col-span-2">
                        <div className="text-muted-foreground text-xs">Vendor</div>
                        <div>{item.vendor}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground text-xs">Total</div>
                        <div>{item.totalAmount || "—"}</div>
                      </div>
                    </div>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        items={[
                          { key: "email", label: "Email", icon: Mail, onSelect: () => openEmailDialog(item) },
                          {
                            key: "download",
                            label: poDownloadingId === (item.po_id || item.id) ? "Downloading..." : "Download",
                            icon: Download,
                            disabled: poDownloadingId === (item.po_id || item.id),
                            onSelect: () => handleDownloadPoPdf(item),
                          },
                          { type: "separator" },
                          { key: "edit", label: "Edit", icon: PencilLine, onSelect: () => handleEditRecent(item) },
                          { key: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => handleDeleteRecent(item) },
                        ]}
                      />
                    </div>
                  </div>
                ))}
                {loadingPos ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Loading purchase orders...
                  </div>
                ) : recentPos.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No purchase orders found. Create one to get started.
                  </div>
                ) : null}
              </div>

              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>PO No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPos.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setPoViewItem(item)}
                    >
                      <TableCell className="font-medium">{item.id}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{item.vendor}</TableCell>
                      <TableCell>{item.totalAmount || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Submitted" ? "default" : "secondary"}>{item.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <RowActionsMenu
                            items={[
                              { key: "email", label: "Email", icon: Mail, onSelect: () => openEmailDialog(item) },
                              {
                                key: "download",
                                label: poDownloadingId === (item.po_id || item.id) ? "Downloading..." : "Download",
                                icon: Download,
                                disabled: poDownloadingId === (item.po_id || item.id),
                                onSelect: () => handleDownloadPoPdf(item),
                              },
                              { type: "separator" },
                              { key: "edit", label: "Edit", icon: PencilLine, onSelect: () => handleEditRecent(item) },
                              { key: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => handleDeleteRecent(item) },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {loadingPos ? (
                <div className="hidden md:block rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Loading purchase orders...
                </div>
              ) : recentPos.length === 0 ? (
                <div className="hidden md:block rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No purchase orders found. Create one to get started.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create PO</CardTitle>
            <CardDescription>Fill the purchase order form manually.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="manual-entry-panel">
            <div className="manual-entry-grid sm:grid-cols-2">
              <Field label="Sample ID">
                <Select
                  value={poData.sampleId || NONE_VALUE}
                  onValueChange={handleSampleSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSamples ? "Loading samples..." : "Select sample (required)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {selectedSampleMissing ? (
                      <SelectItem value={poData.sampleId}>Sample #{poData.sampleId} (current)</SelectItem>
                    ) : null}
                    {sampleOptions.map((sample) => {
                      const id = String(sample.sample_id || sample.id);
                      const label = sample.work_done || sample.site_name || sample.building_name || `Sample #${id}`;
                      return (
                        <SelectItem key={id} value={id}>
                          {`#${id} - ${label}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Vendor Source (Vendor ID)">
                <Select
                  value={selectedVcId || NONE_VALUE}
                  onValueChange={handleVcSelect}
                  disabled={!projectId || loadingVcOptions || loadingVcItems}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingVcOptions ? "Loading VC..." : "Select VC"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {selectedVcMissing ? (
                      <SelectItem value={selectedVcId}>VC #{selectedVcId} (current)</SelectItem>
                    ) : null}
                    {vcOptions.map((vc) => {
                      const id = String(vc?.id ?? vc?.comparison_id ?? vc?.vendor_comparison_id ?? vc?.comparisonId ?? "");
                      if (!id) return null;
                      return (
                        <SelectItem key={id} value={id}>
                          {getVendorComparisonLabel(vc)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {loadingVcItems ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading VC items...
                  </div>
                ) : selectedVcId ? (
                  <div className="text-xs text-muted-foreground">Vendor selection is the source of truth for the PO lines below.</div>
                ) : null}
              </Field>
              <Field label="Indent No (Auto)">
                <Input value={poData.indentNo} readOnly placeholder="Auto-filled from selected vendor source" />
                <div className="text-xs text-muted-foreground">
                  Locked to the selected vendor source. It cannot be edited manually.
                </div>
              </Field>
              <Field label="Indent Date">
                <Input type="date" value={poData.indentDate} onChange={(event) => setPoData((prev) => ({ ...prev, indentDate: event.target.value, source: "Manual" }))} />
              </Field>
              <Field label="Order No">
                <Input
                  type="text"
                  value={poData.orderNo}
                  onChange={(event) => setPoData((prev) => ({ ...prev, orderNo: event.target.value, source: "Manual" }))}
                />
              </Field>
              <Field label="PO Date">
                <Input type="date" value={poData.poDate} onChange={(event) => setPoData((prev) => ({ ...prev, poDate: event.target.value, source: "Manual" }))} />
              </Field>
            </div>

            <div className="manual-entry-grid sm:grid-cols-2">
              <Field label="Vendor Name">
                <Input value={poData.vendor.name} onChange={(event) => updateVendor("name", event.target.value)} />
              </Field>
              <Field label="Site">
                <Input value={poData.vendor.site} onChange={(event) => updateVendor("site", event.target.value)} />
              </Field>
              <Field label="Site Address">
                <Input value={poData.vendor.siteAddress} onChange={(event) => updateVendor("siteAddress", event.target.value)} />
              </Field>
            </div>

            <div className="manual-entry-grid sm:grid-cols-2">
              <Field label="Primary Contact Name">
                <Input value={poData.vendor.contacts.primary.name} onChange={(event) => updateVendorContact("primary", "name", event.target.value)} />
              </Field>
              <Field label="Primary Contact Phone">
                <Input type="tel" inputMode="numeric" maxLength={15} value={poData.vendor.contacts.primary.phone} onChange={(event) => updateVendorContact("primary", "phone", event.target.value)} />
              </Field>
              <Field label="Secondary Contact Name">
                <Input value={poData.vendor.contacts.secondary.name} onChange={(event) => updateVendorContact("secondary", "name", event.target.value)} />
              </Field>
              <Field label="Secondary Contact Phone">
                <Input type="tel" inputMode="numeric" maxLength={15} value={poData.vendor.contacts.secondary.phone} onChange={(event) => updateVendorContact("secondary", "phone", event.target.value)} />
              </Field>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Items</div>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="mr-2 h-3 w-3" /> Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {poData.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
                    No items added yet.
                  </div>
                ) : (
                  <>
                    <div className="hidden sm:grid sm:grid-cols-9 gap-2 text-xs font-medium text-muted-foreground px-1">
                      <div>Sr No</div>
                      <div>BOQ Item Code</div>
                      <div>HSN</div>
                      <div className="sm:col-span-2">Description</div>
                      <div>Qty</div>
                      <div>UOM</div>
                      <div>Rate</div>
                      <div>Amount</div>
                    </div>
                    {poData.items.map((item, idx) => (
                      <div key={`${item.srNo}-${idx}`} className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3 sm:p-4">
                        <div className="grid gap-2 sm:grid-cols-9 items-center">
                          <Input
                            type="number"
                            inputMode="numeric"
                            step="1"
                            className="sm:col-span-1"
                            value={item.srNo}
                            onChange={(event) => updateItem(idx, "srNo", event.target.value)}
                          />
                          <Input
                            type="text"
                            className="sm:col-span-1"
                            value={item.boq_item_code || item.item_name || item.description}
                            onChange={(event) => updateItem(idx, "boq_item_code", event.target.value)}
                          />
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="sm:col-span-1"
                            value={item.hsnCode}
                            onChange={(event) => updateItem(idx, "hsnCode", sanitizeNumberInput(event.target.value, { allowDecimal: false }))}
                          />
                          <Input
                            className="sm:col-span-2"
                            value={item.description}
                            onChange={(event) => updateItem(idx, "description", event.target.value)}
                          />
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            className="sm:col-span-1"
                            value={item.qty}
                            onChange={(event) => updateItem(idx, "qty", event.target.value)}
                          />
                          <Input
                            className="sm:col-span-1"
                            value={item.uom}
                            onChange={(event) => updateItem(idx, "uom", event.target.value)}
                          />
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            className="sm:col-span-1"
                            value={item.rate}
                            readOnly
                            placeholder="Fixed"
                          />
                          <div className="flex items-center gap-2 sm:col-span-1">
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={item.amount}
                              readOnly
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Field label="Remarks">
                          <Textarea
                            placeholder="Add notes for this line item"
                            value={item.remarks}
                            onChange={(event) => updateItem(idx, "remarks", event.target.value)}
                            rows={2}
                            className="resize-y"
                          />
                        </Field>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="text-sm font-medium">Amounts & Delivery</div>
              <div className="manual-entry-grid sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Subtotal">
                  <Input value={poData.subtotalAmount} readOnly />
                </Field>
                <Field label="Discount %">
                  <Input
                    inputMode="decimal"
                    value={poData.discount.percent}
                    onChange={(event) => updateDiscountField("percent", event.target.value, "percent")}
                  />
                </Field>
                <Field label="Discount Amount">
                  <Input
                    inputMode="decimal"
                    value={poData.discount.amount}
                    onChange={(event) => updateDiscountField("amount", event.target.value, "amount")}
                  />
                </Field>
                <Field label="After Discount">
                  <Input value={poData.afterDiscountAmount} readOnly />
                </Field>
                <Field label="CGST %">
                  <Input
                    inputMode="decimal"
                    value={poData.taxes.cgst.percent}
                    onChange={(event) => updateTaxField("cgst", "percent", event.target.value, "percent")}
                  />
                </Field>
                <Field label="CGST Amount">
                  <Input
                    inputMode="decimal"
                    value={poData.taxes.cgst.amount}
                    onChange={(event) => updateTaxField("cgst", "amount", event.target.value, "amount")}
                  />
                </Field>
                <Field label="SGST %">
                  <Input
                    inputMode="decimal"
                    value={poData.taxes.sgst.percent}
                    onChange={(event) => updateTaxField("sgst", "percent", event.target.value, "percent")}
                  />
                </Field>
                <Field label="SGST Amount">
                  <Input
                    inputMode="decimal"
                    value={poData.taxes.sgst.amount}
                    onChange={(event) => updateTaxField("sgst", "amount", event.target.value, "amount")}
                  />
                </Field>
                <Field label="Total Amount">
                  <Input value={poData.totalAmount} readOnly />
                </Field>
                <Field label="Delivery">
                  <Input
                    value={poData.summary.delivery}
                    onChange={(event) => updateSummaryField("delivery", event.target.value)}
                  />
                </Field>
                <Field label="Payment">
                  <Input
                    value={poData.summary.payment}
                    onChange={(event) => updateSummaryField("payment", event.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={poData.status || "created"}
                    onValueChange={(value) => setPoData((prev) => ({ ...prev, status: value, source: "Manual" }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created">created</SelectItem>
                      <SelectItem value="submitted">submitted</SelectItem>
                      <SelectItem value="approved">approved</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="manual-entry-grid sm:grid-cols-2">
              <Field label="Notes">
                <Textarea
                  value={poData.notes.join("\n")}
                  onChange={(event) => setPoData((prev) => ({ ...prev, notes: event.target.value.split(/\n+/).map((line) => line.trim()).filter(Boolean), source: "Manual" }))}
                />
              </Field>
              <Field label="Terms & Conditions (one per line)">
                <Textarea
                  value={poData.termsAndConditions.join("\n")}
                  onChange={(event) => setPoData((prev) => ({ ...prev, termsAndConditions: event.target.value.split(/\n+/).map((line) => line.trim()).filter(Boolean), source: "Manual" }))}
                />
              </Field>
            </div>

            <div className="manual-entry-actions">
              <Button onClick={handleSubmitPo} className="w-full sm:w-auto" disabled={submitting || !poData.sampleId}>
                {submitting ? "Submitting..." : "Submit PO"}
              </Button>
              {!hasPreview ? (
                <div className="text-xs text-muted-foreground sm:self-center">
                  Add PO details and submit directly.
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <Dialog open={!!poViewItem} onOpenChange={(open) => !open && setPoViewItem(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
          </DialogHeader>
          {poViewItem ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="grid gap-2">
                {Object.entries(poViewItem)
                  .filter(([key]) => key !== "payload")
                  .map(([key, value]) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground font-medium break-words">{prettyKey(key)}</div>
                      <div className="sm:col-span-2 break-words">
                        {renderPoValue(key, value)}
                      </div>
                    </div>
                  ))}
                <div className="mt-2 text-sm font-medium">Payload</div>
                {Object.entries(poViewItem.payload || {})
                  .map(([key, value]) => (
                    <div key={`payload-${key}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground font-medium break-words">{prettyKey(key)}</div>
                      <div className="sm:col-span-2 break-words">
                        {renderPoValue(key, value)}
                      </div>
                    </div>
                  ))}

                <div className="mt-2 text-sm font-medium">Linked Delivery Challans (DC)</div>
                {poViewBackpathLoading ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Loading linked DCs...
                  </div>
                ) : poViewLinkedDcs.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No DC linked to this PO.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>DC No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poViewLinkedDcs.map((dc, idx) => (
                        <TableRow key={String(dc?.dc_id ?? dc?.id ?? idx)}>
                          <TableCell className="font-medium">
                            {dc?.challan_number || dc?.dc_number || dc?.dc_no || dc?.dc_id || dc?.id || "-"}
                          </TableCell>
                          <TableCell>{dc?.created_at ? new Date(dc.created_at).toLocaleString("en-IN") : "-"}</TableCell>
                          <TableCell>{dc?.status || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoViewItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          setEmailDialogOpen(open);
          if (!open) {
            setEmailPo(null);
            setVendorOptions([]);
            setSelectedVendorIds([]);
            setVendorDropdownOpen(false);
            setVendorSearch("");
            setEmailAttachments([]);
            setEmailRemarks("");
            setIsFileDragActive(false);
            setEmailLogs([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Purchase Order</DialogTitle>
            <DialogDescription>
              Select vendors. The selected PO will be sent to their email addresses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vendors</Label>
              {loadingVendors ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading vendors...
                </div>
              ) : vendorOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vendors with email found for this project.</p>
              ) : (
                <Popover open={vendorDropdownOpen} onOpenChange={setVendorDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {selectedVendorIds.length > 0
                        ? `${selectedVendorIds.length} vendor(s) selected`
                        : "Select Vendors"}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-70" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[430px] max-w-[90vw] p-3" align="start">
                    <div className="space-y-3">
                      <Input
                        placeholder="Search vendor name or email..."
                        value={vendorSearch}
                        onChange={(event) => setVendorSearch(event.target.value)}
                      />
                      <div className="max-h-64 space-y-2 overflow-auto">
                        {vendorOptions
                          .filter((vendor) => {
                            const name = String(vendor.vendor_name || vendor.name || "").toLowerCase();
                            const email = String(vendor.vendor_email || vendor.email || "").toLowerCase();
                            const query = String(vendorSearch || "").toLowerCase().trim();
                            if (!query) return true;
                            return name.includes(query) || email.includes(query);
                          })
                          .map((vendor) => {
                            const vendorId = getVendorId(vendor);
                            const checked = selectedVendorIds.includes(vendorId);
                            const label = vendor.vendor_name || vendor.name || "Vendor";
                            return (
                              <button
                                key={vendorId}
                                type="button"
                                className="flex w-full items-start gap-2 rounded-md border p-2 text-left hover:bg-accent/40"
                                onClick={() => toggleVendorSelection(vendorId, !checked)}
                              >
                                <Checkbox checked={checked} onCheckedChange={(value) => toggleVendorSelection(vendorId, Boolean(value))} />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">{label}</div>
                                  <span className="block truncate text-xs text-muted-foreground">{vendor.vendor_email || vendor.email}</span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="space-y-2">
              <Label>Attachment (optional)</Label>
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center transition-colors ${
                  isFileDragActive ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsFileDragActive(true);
                }}
                onDragLeave={() => setIsFileDragActive(false)}
                onDrop={handleAttachmentDrop}
              >
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onClick={(event) => {
                    event.currentTarget.value = "";
                  }}
                  onChange={(event) => handleAttachmentSelect(event.target.files)}
                />
                <Mail className="mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Drag and drop files here, or click to upload</p>
                <p className="text-xs text-muted-foreground">
                  Selected files will be uploaded and attached when you send the email.
                </p>
              </label>
              {emailAttachments.length > 0 ? (
                <div className="space-y-2">
                  {emailAttachments.map((file) => {
                    const key = `${file.name}-${file.size}-${file.lastModified}`;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEmailAttachments((prev) =>
                              prev.filter((entry) => `${entry.name}-${entry.size}-${entry.lastModified}` !== key)
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setEmailAttachments([])}>
                      Clear All
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                value={emailRemarks}
                onChange={(event) => setEmailRemarks(event.target.value)}
                placeholder="Add any note for the vendor(s)..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>
              Cancel
            </Button>
            <Button
              onClick={handleSendPoEmail}
              disabled={emailSending || loadingVendors || selectedVendorIds.length === 0}
            >
              {emailSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" /> Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
