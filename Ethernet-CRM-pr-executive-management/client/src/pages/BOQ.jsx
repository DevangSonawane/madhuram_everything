import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useProject } from '@/contexts/useProject';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Plus, CheckCircle2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Trash2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrencyINR, formatNumberIN } from "@/lib/numberFormat";
import { UnitSelect, convertQuantity } from "@/components/forms/UnitSelect";
import { extractRawTextFromPdfFile } from "@/lib/boqExtractor";

const NO_FILE_KEY = "__NO_FILE__";

function inferSavedFilePath(res) {
  const data = res?.data ?? res;
  if (!data) return "";
  const candidate =
    data?.boq_file ||
    data?.boqFile ||
    data?.file ||
    data?.file_path ||
    data?.filePath ||
    data?.url ||
    data?.path ||
    "";
  return typeof candidate === "string" ? candidate : "";
}

function normalizeBoqItem(apiItem) {
  const itemCode = apiItem.item_code ?? apiItem.code ?? apiItem.item_no;
  const toNumber = (value) => {
    const n = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const toNumberOrNull = (value) => {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: apiItem.boq_id,
    boq_id: apiItem.boq_id,
    code: apiItem.item_no ?? itemCode,
    item_no: apiItem.item_no ?? apiItem.itemNo,
    item_code: apiItem.item_code,
    category: apiItem.category,
    description: apiItem.description ?? apiItem.item_description ?? apiItem.service_description,
    floor: apiItem.floor,
    unit: apiItem.unit ?? apiItem.uom,
    quantity: toNumber(apiItem.quantity ?? apiItem.qty ?? apiItem.order_qty),
    rate: apiItem.rate ?? apiItem.unit_price,
    amount: toNumber(apiItem.amount ?? apiItem.value),
    boq_file: apiItem.boq_file,
    project_id: apiItem.project_id,
    project_name: apiItem.project_name,
    created_at: apiItem.created_at,
    hsn: apiItem.hsn ?? apiItem.hsn_sac_code ?? (typeof itemCode === "string" ? itemCode : undefined),
    sac_code: apiItem.sac_code ?? (typeof itemCode === "string" ? itemCode : undefined),
    client: (apiItem.client ?? apiItem.boq_client ?? apiItem.client_format ?? "").toString().trim().toLowerCase(),
    used_quantity: toNumberOrNull(apiItem.used_quantity),
    remaining_quantity: toNumberOrNull(apiItem.remaining_quantity),
  };
}

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function calculateBoqAmount(quantity, rate) {
  const qty = toFiniteNumber(quantity);
  const unitRate = toFiniteNumber(rate);
  if (qty == null || unitRate == null) return null;
  const amount = qty * unitRate;
  return Number.isFinite(amount) ? amount : null;
}

function syncBoqAmount(form) {
  return {
    ...form,
    amount: calculateBoqAmount(form.quantity, form.rate)?.toString() ?? "",
  };
}

function getBoqSequenceParts(item) {
  const raw = String(item?.item_no ?? item?.code ?? item?.item_code ?? "").trim();
  if (!raw) return [];
  const parts = raw.match(/\d+/g);
  return Array.isArray(parts) ? parts.map((part) => Number(part)).filter((part) => Number.isFinite(part)) : [];
}

function compareBoqDisplayOrder(a, b) {
  const aParts = getBoqSequenceParts(a);
  const bParts = getBoqSequenceParts(b);

  if (aParts.length > 0 || bParts.length > 0) {
    const maxLength = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i];
      const bPart = bParts[i];
      if (aPart == null && bPart == null) break;
      if (aPart == null) return 1;
      if (bPart == null) return -1;
      if (aPart !== bPart) return aPart - bPart;
    }
  }

  const aId = toFiniteNumber(a?.boq_id ?? a?.id);
  const bId = toFiniteNumber(b?.boq_id ?? b?.id);
  if (aId != null && bId != null && aId !== bId) return aId - bId;
  return 0;
}

function sumUsedSampleQty(usedInSamples) {
  if (!Array.isArray(usedInSamples)) return 0;
  return usedInSamples.reduce((sum, sample) => sum + (toFiniteNumber(sample?.issued_qty) ?? 0), 0);
}

function getSampleRowMultiplier(row = {}) {
  const getFieldValue = (fieldKey) =>
    (Array.isArray(row?.add_fields) ? row.add_fields : []).find((field) => String(field?.key || "").trim() === fieldKey)?.value ?? "";

  const flatCount =
    toFiniteNumber(getFieldValue("flat_count")) ??
    toFiniteNumber(getFieldValue("boq_flat_multiplier")) ??
    toFiniteNumber(row?.flat_count) ??
    toFiniteNumber(row?.flats) ??
    1;
  const floorCount =
    toFiniteNumber(getFieldValue("floors")) ??
    toFiniteNumber(getFieldValue("boq_floor_multiplier")) ??
    toFiniteNumber(row?.floor_count) ??
    toFiniteNumber(row?.floors) ??
    1;

  return Math.max(1, (flatCount || 1) * (floorCount || 1));
}

function getSampleRowTotalQty(row = {}) {
  const getFieldValue = (fieldKey) =>
    (Array.isArray(row?.add_fields) ? row.add_fields : []).find((field) => String(field?.key || "").trim() === fieldKey)?.value ?? "";

  const explicitTotal =
    toFiniteNumber(row?.total_qty) ??
    toFiniteNumber(row?.quantity) ??
    toFiniteNumber(row?.qty) ??
    toFiniteNumber(row?.issued_qty) ??
    toFiniteNumber(getFieldValue("total_qty")) ??
    toFiniteNumber(getFieldValue("selected_qty")) ??
    toFiniteNumber(getFieldValue("boq_base_qty")) ??
    toFiniteNumber(row?.boq_issued_qty) ??
    0;
  if (explicitTotal > 0) return explicitTotal;

  const perFlat =
    toFiniteNumber(row?.qty_per_flat) ??
    toFiniteNumber(row?.quantity_per_flat) ??
    toFiniteNumber(row?.per_flat_qty) ??
    toFiniteNumber(getFieldValue("qty_per_flat")) ??
    toFiniteNumber(getFieldValue("boq_qty_per_flat")) ??
    0;
  if (perFlat > 0) return perFlat * getSampleRowMultiplier(row);

  return 0;
}

function normalizeBoqMatchKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getBoqExactMatchKey(item = {}) {
  const rawExactKey = item?.boq_match_key ?? item?.boqMatchKey;
  const normalizedExact = normalizeBoqMatchKey(rawExactKey);
  if (normalizedExact) return normalizedExact;

  const rawBoqId = item?.boq_id ?? item?.boqId ?? item?.id ?? "";
  const normalizedBoqId = normalizeBoqMatchKey(rawBoqId);
  if (normalizedBoqId) return `id${normalizedBoqId}`;
  return "";
}

function getUsedQtyForSampleRecord(sampleRecord = {}, boqItem = {}, projectSamples = []) {
  const sampleId = String(sampleRecord?.sample_id ?? sampleRecord?.sampleId ?? sampleRecord?.id ?? "").trim();
  const matchedSample = (Array.isArray(projectSamples) ? projectSamples : []).find((sample) => {
    const sid = String(sample?.sample_id ?? sample?.sampleId ?? sample?.id ?? "").trim();
    return sid && sampleId && sid === sampleId;
  });

  if (!matchedSample) return toFiniteNumber(sampleRecord?.issued_qty) ?? 0;

  const rows = parseMaybeJsonArray(matchedSample?.item_description || matchedSample?.items || matchedSample?.item_descriptions);
  const boqExactKey = getBoqExactMatchKey(boqItem);
  const computed = rows.reduce((sum, row) => {
    const rowExactKey = getBoqExactMatchKey(row);
    if (boqExactKey && rowExactKey && boqExactKey === rowExactKey) {
      return sum + getSampleRowTotalQty(row);
    }
    const rowBoqId = normalizeBoqMatchKey(row?.boq_id ?? row?.boqId ?? row?.add_fields?.find?.((f) => String(f?.key || "").trim() === "boq_id")?.value);
    const boqId = normalizeBoqMatchKey(boqItem?.boq_id ?? boqItem?.id);
    if (rowBoqId && boqId && rowBoqId === boqId) return sum + getSampleRowTotalQty(row);
    return sum;
  }, 0);

  return computed > 0 ? computed : (toFiniteNumber(sampleRecord?.issued_qty) ?? 0);
}

function getComputedUsedQtyForBoqItem(boqItem = {}, projectSamples = []) {
  const boqExactKey = getBoqExactMatchKey(boqItem);
  return (Array.isArray(projectSamples) ? projectSamples : []).reduce((sum, sample) => {
    const rows = parseMaybeJsonArray(sample?.item_description || sample?.items || sample?.item_descriptions);
    return (
      sum +
      rows.reduce((rowSum, row) => {
        const rowExactKey = getBoqExactMatchKey(row);
        if (boqExactKey && rowExactKey && boqExactKey === rowExactKey) {
          return rowSum + getSampleRowTotalQty(row);
        }
        const rowBoqId = normalizeBoqMatchKey(row?.boq_id ?? row?.boqId ?? row?.add_fields?.find?.((f) => String(f?.key || "").trim() === "boq_id")?.value);
        const boqId = normalizeBoqMatchKey(boqItem?.boq_id ?? boqItem?.id);
        if (rowBoqId && boqId && rowBoqId === boqId) return rowSum + getSampleRowTotalQty(row);
        return rowSum;
      }, 0)
    );
  }, 0);
}

function parseMaybeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeUsedSampleRows(value) {
  const rows = parseMaybeJsonArray(value);
  return rows.map((row) => ({
    sample_id: row?.sample_id ?? row?.sampleId ?? row?.id ?? "",
    building_name: row?.building_name ?? row?.buildingName ?? "",
    site_name: row?.site_name ?? row?.siteName ?? "",
    project_id: row?.project_id ?? row?.projectId ?? "",
    issued_qty: row?.issued_qty ?? row?.issuedQty ?? "",
  }));
}

function formatDetailValue(value) {
  if (value == null || value === "") return "-";
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v != null && v !== "")
      .map(([key, v]) => `${key}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    return entries.length > 0 ? entries.join(" | ") : "-";
  }
  return String(value);
}

function matchesActiveClient(item, activeClient) {
  const client = String(item?.client || "").toLowerCase();
  if (client && client === activeClient) return true;

  const code = String(item?.code || "").trim();
  const hasHsn = String(item?.hsn || "").trim() !== "";
  const hasSac = String(item?.sac_code || "").trim() !== "";

  if (activeClient === "lodha") {
    // Lodha typically has numeric dot notation item numbers like 1.01.1 and an HSN/SAC code.
    if (hasHsn) return true;
    if (/^\d+(\.\d+){1,3}$/.test(code)) return true;
    return false;
  }

  if (activeClient === "hiranandani") {
    // Hiranandani item numbers are usually like "(1)" and have SAC code.
    if (hasSac) return true;
    if (/^\(\d+\)$/.test(code)) return true;
    return false;
  }

  return true;
}

const EMPTY_FORM = { category: '', item_no: '', item_code: '', description: '', floor: '', unit: '', quantity: '', rate: '', amount: '' };

export default function BOQ() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const [searchParams] = useSearchParams();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id ?? selectedProject?.project_id ?? routeProjectId ?? null;
  const activeFileKey = (searchParams.get("file") || "").trim();
  const isNewBoqMode = (searchParams.get("new") || "").trim() === "1";
  const urlClient = (searchParams.get("client") || "").trim().toLowerCase();
  const [activeClient, setActiveClient] = useState(() => {
    if (urlClient) return urlClient;
    try {
      const key = projectId ? `boqClient:${projectId}` : "";
      const stored = key ? (localStorage.getItem(key) || "").trim().toLowerCase() : "";
      return stored || "";
    } catch {
      return "";
    }
  });

  // Keep client selection persistent per project, even if URL doesn't include `client`.
  useEffect(() => {
    const next = urlClient || (() => {
      try {
        const key = projectId ? `boqClient:${projectId}` : "";
        const stored = key ? (localStorage.getItem(key) || "").trim().toLowerCase() : "";
        return stored || "";
      } catch {
        return "";
      }
    })();
    setActiveClient(next);
  }, [urlClient, projectId]);

  useEffect(() => {
    if (!projectId) return;
    try {
      const key = `boqClient:${projectId}`;
      if (activeClient) localStorage.setItem(key, activeClient);
      else localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  }, [activeClient, projectId]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [extractedProjectName, setExtractedProjectName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [boqFile, setBoqFile] = useState(null);
  const boqInputRef = useRef(null);
  const boqTableScrollRef = useRef(null);
  const canImportBoqPdf = Boolean(projectId && activeClient);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState(EMPTY_FORM);
  const [formFile, setFormFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const addFormRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [viewItemDetail, setViewItemDetail] = useState(null);
  const [viewItemLoading, setViewItemLoading] = useState(false);
  const [newBoqDialogOpen, setNewBoqDialogOpen] = useState(false);
  const [projectSamples, setProjectSamples] = useState([]);
  const [loadingProjectSamples, setLoadingProjectSamples] = useState(false);

  const getRemainingQtyForItem = (item) => {
    const base = Number(String(item?.quantity ?? "").replace(/,/g, "").trim());
    const safeBase = Number.isFinite(base) ? base : 0;
    return safeBase;
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;

      const target = event.target;
      const tagName = String(target?.tagName || "").toLowerCase();
      const isTypingField =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target?.isContentEditable;
      if (isTypingField) return;

      const container = boqTableScrollRef.current;
      if (!container) return;

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      if (maxScrollLeft <= 0) return;

      event.preventDefault();
      const step = Math.max(240, Math.floor(container.clientWidth * 0.6));
      const nextScrollLeft = container.scrollLeft + (event.key === "ArrowLeft" ? -step : step);
      container.scrollTo({
        left: Math.max(0, Math.min(maxScrollLeft, nextScrollLeft)),
        behavior: "smooth",
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchItems = async () => {
    if (!projectId) {
      setItems([]);
      setSelectedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const res = projectId ? await api.getBOQsByProject(projectId) : await api.getBOQs();
      const errorText = String(res?.error || "").toLowerCase();
      const isNoBoq =
        errorText.includes("no boq") ||
        errorText.includes("no boq product") ||
        (errorText.includes("boq") && errorText.includes("not found"));
      const isInternalServerError =
        errorText.includes("internal server error") ||
        errorText.includes("server error") ||
        errorText.includes("status code 500") ||
        errorText.includes("500");
      const rows = res?.success
        ? (Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.boqs)
              ? res.data.boqs
              : Array.isArray(res.data?.data)
                ? res.data.data
                : [])
        : [];

      const filteredRows = rows
        .map(normalizeBoqItem)
        .filter((item) => String(item?.project_id ?? "") === String(projectId));

      const orderedRows = [...filteredRows].sort(compareBoqDisplayOrder);

      if (orderedRows.length > 0) {
        const rowsWithUsage = await Promise.all(
          orderedRows.map(async (item) => {
            try {
              const detailRes = await api.getBOQById(item.id);
              if (!detailRes?.success || !detailRes.data) return item;

              const detail = detailRes.data;
              const usedFromSamples = sumUsedSampleQty(detail.used_in_samples);
              const usedFromApi = toFiniteNumber(detail.used_quantity);
              const quantity = toFiniteNumber(detail.quantity ?? item.quantity) ?? item.quantity ?? 0;

              if (Array.isArray(detail.used_in_samples)) {
                const used = usedFromSamples;
                return {
                  ...item,
                  ...normalizeBoqItem(detail),
                  used_quantity: used,
                  remaining_quantity: quantity - used,
                };
              }

              if (usedFromApi != null) {
                return {
                  ...item,
                  ...normalizeBoqItem(detail),
                  used_quantity: usedFromApi,
                  remaining_quantity: toFiniteNumber(detail.remaining_quantity),
                };
              }

              return { ...item, ...normalizeBoqItem(detail) };
            } catch {
              return item;
            }
          }),
        );

        setItems(rowsWithUsage);
        setSelectedIds(new Set());
      } else {
        setItems([]);
        setSelectedIds(new Set());
        if (!res?.success && !isNoBoq && !isInternalServerError) {
          toast({ title: "Error", description: res?.error || "Failed to load BOQ items.", variant: "destructive" });
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load BOQ items.", variant: "destructive" });
      setItems([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [projectId]);

  useEffect(() => {
    const fetchSamples = async () => {
      if (!projectId) {
        setProjectSamples([]);
        return;
      }
      setLoadingProjectSamples(true);
      try {
        const res = await api.getSamplesByProject(projectId);
        if (res?.success) {
          const data = res.data;
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.samples)
              ? data.samples
              : Array.isArray(data?.sample)
                ? data.sample
                : Array.isArray(data?.rows)
                  ? data.rows
                  : Array.isArray(data?.data)
                    ? data.data
                    : [];
          setProjectSamples(list);
        } else {
          setProjectSamples([]);
        }
      } catch {
        setProjectSamples([]);
      } finally {
        setLoadingProjectSamples(false);
      }
    };
    fetchSamples();
  }, [projectId]);

  const scopedItems = useMemo(() => {
    const byFile = (() => {
      // Explicit "new BOQ" mode starts with a clean slate.
      if (isNewBoqMode && !activeFileKey) return [];
      if (!activeFileKey) return items;
      if (activeFileKey === NO_FILE_KEY) return items.filter((i) => !i?.boq_file);
      return items.filter((i) => String(i?.boq_file || "") === activeFileKey);
    })();

    if (!activeClient) return byFile;
    // When a client format is selected, prefer matching items for that client,
    // but allow heuristic matching when backend doesn't return a client field.
    const matched = byFile.filter((i) => matchesActiveClient(i, activeClient));
    // Never show an empty table purely due to missing client metadata.
    const next = matched.length > 0 ? matched : byFile;
    return [...next].sort(compareBoqDisplayOrder);
  }, [items, activeFileKey, activeClient, isNewBoqMode]);

  // If the project already has any BOQ items, allow both "Add" and "Replace".
  // "Replace" will wipe either the currently opened BOQ file (when selected) or the entire project's BOQ items.
  const canReplaceCurrentBOQ = Boolean(projectId && items.length > 0);

  const getBoqQuantityBreakdown = (item) => {
    const originalQty = getRemainingQtyForItem(item);
    const usedFromSamples = getComputedUsedQtyForBoqItem(item, projectSamples);
    const usedFromApi = toFiniteNumber(item?.used_quantity);
    const computedUsed = usedFromSamples > 0 ? usedFromSamples : (usedFromApi ?? 0);
    const remaining = originalQty - computedUsed;
    return {
      used: computedUsed,
      remaining,
      total: originalQty,
    };
  };

  const isPdf = (f) => f && (f.type === "application/pdf" || (f.name || "").toLowerCase().endsWith(".pdf"));

  const runExtract = async (file) => {
    setExtractError(null);
    setExtracting(true);
    try {
      const rawText = await extractRawTextFromPdfFile(file);

      if (activeClient === 'lodha') {
        const { parseLodhaBoq } = await import('@/lib/boqParser');
        const parsed = parseLodhaBoq(rawText);
        const mapped = parsed.items.map((it, idx) => ({
          id: idx + 1 + Date.now(),
          category: it.section || 'General',
          code: it.item_no || '',
          item_no: it.item_no || '',
          item_code: it.hsn || '',
          description: it.description || '',
          unit: it.unit || '',
          quantity: it.qty_text || (it.qty != null ? String(it.qty) : ''),
          rate: it.rate_text || (it.rate != null ? String(it.rate) : ''),
          amount: it.amount_text || (it.amount != null ? String(it.amount) : ''),
          floor: '',
          hsn: it.hsn || '',
        }));
        setExtractedItems(mapped);
      } else if (activeClient === 'hiranandani') {
        const { parseHiranandaniBoq } = await import('@/lib/boqParser');
        const parsed = parseHiranandaniBoq(rawText);
        const mapped = parsed.items.map((it, idx) => ({
          id: idx + 1 + Date.now(),
          category: it.section || 'General',
          code: it.item_no || '',
          item_no: it.item_no || '',
          item_code: it.sac_code || '',
          description: it.description || '',
          unit: it.unit || '',
          quantity: it.qty_text || (Number.isFinite(it.qty) ? String(it.qty) : ''),
          rate: it.rate_text || (Number.isFinite(it.rate) ? String(it.rate) : ''),
          amount: it.amount_text || (Number.isFinite(it.amount) ? String(it.amount) : ''),
          floor: '',
          sac_code: it.sac_code || '',
        }));
        setExtractedItems(mapped);
      } else {
        // fallback to server-side for unknown clients
        const res = await api.parseBoqPdf({ boq_file: file, project_id: projectId || '', save: false });
        if (res.success && res.data && Array.isArray(res.data.items)) {
          const mapped = res.data.items.map((it, idx) => ({
            id: idx + 1 + Date.now(),
            category: it.section || 'General',
            code: it.item_no || '',
            item_code: it.item_no || '',
            description: it.description || '',
            unit: it.unit || '',
            quantity: it.qty ? String(it.qty) : '',
            rate: '',
            amount: '',
            floor: '',
          }));
          setExtractedItems(mapped);
        } else {
          throw new Error(res.error || 'Failed to parse BOQ PDF from server.');
        }
      }

      setExtractedProjectName('');
      setImportPreviewOpen(true);
    } catch (err) {
      console.error(err);
      setExtractError(err?.message || "Could not read BOQ PDF.");
      toast({
        title: "BOQ extraction failed",
        description: "We couldn't parse this PDF. You can still import via Excel or add items manually.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!projectId) {
      toast({ title: "Select project first", description: "Please select a project before importing a BOQ PDF.", variant: "destructive" });
      if (boqInputRef.current) boqInputRef.current.value = "";
      return;
    }
    if (!activeClient) {
      toast({ title: "Select BOQ format first", description: "Choose a BOQ format (e.g., Lodha/Hiranandani) to enable PDF import.", variant: "destructive" });
      if (boqInputRef.current) boqInputRef.current.value = "";
      return;
    }
    setBoqFile(file);
    // Once a file is selected, exit "new BOQ" mode so saved items can be visible/scoped.
    if (projectId) {
      const params = new URLSearchParams(searchParams);
      if (params.get("new") === "1") {
        params.delete("new");
        navigate(`/${projectId}/boq/manage?${params.toString()}`);
      }
    }
    if (isPdf(file)) runExtract(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!projectId) {
      toast({ title: "Select project first", description: "Please select a project before importing a BOQ PDF.", variant: "destructive" });
      return;
    }
    if (!activeClient) {
      toast({ title: "Select BOQ format first", description: "Choose a BOQ format (e.g., Lodha/Hiranandani) to enable PDF import.", variant: "destructive" });
      return;
    }
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!isPdf(file)) {
      toast({ title: "Invalid file", description: "Please use a BOQ PDF.", variant: "destructive" });
      return;
    }
    setBoqFile(file);
    if (projectId) {
      const params = new URLSearchParams(searchParams);
      if (params.get("new") === "1") {
        params.delete("new");
        navigate(`/${projectId}/boq/manage?${params.toString()}`);
      }
    }
    runExtract(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const addExtractedToBOQ = async () => {
    if (!projectId) {
      const maxId = items.length ? Math.max(...items.map((i) => i.id)) : 0;
      const withIds = extractedItems.map((it, i) => ({ ...it, id: maxId + i + 1 }));
      setItems((prev) => [...prev, ...withIds]);
      setSearchTerm("");
      setCurrentPage(1);
      setImportPreviewOpen(false);
      setBoqFile(null);
      if (boqInputRef.current) boqInputRef.current.value = "";
      toast({ title: "Added to BOQ", description: `${withIds.length} item(s) added. Select a project to save to server.` });
      return;
    }

    setSaving(true);
    try {
      const targetItems = activeFileKey ? scopedItems : items;
      for (const item of targetItems) {
        await api.deleteBOQ(item.id);
      }
      const res = await api.saveBOQItems({
        project_id: projectId || "",
        items: extractedItems,
        boq_file_name: boqFile?.name,
        client: activeClient || undefined,
      });
      if (!res?.success) throw new Error(res?.error || "Failed to save BOQ");
      const savedPath = inferSavedFilePath(res);

      // Required: refresh via GET /api/boq/project/{projectId}
      await fetchItems();
      setSearchTerm('');
      setCurrentPage(1);
      setImportPreviewOpen(false);
      setBoqFile(null);
      if (boqInputRef.current) boqInputRef.current.value = '';
      if (savedPath) {
        const next = `/${projectId}/boq/manage?file=${encodeURIComponent(savedPath)}${activeClient ? `&client=${encodeURIComponent(activeClient)}` : ""}`;
        navigate(next);
      } else {
        // If backend doesn't return a stable file path (or we didn't attach a file), ensure the user still sees all imported rows.
        const next = `/${projectId}/boq/manage${activeClient ? `?client=${encodeURIComponent(activeClient)}` : ""}`;
        navigate(next);
      }
      toast({ title: 'BOQ saved', description: 'BOQ imported successfully.' });
    } catch (e) {
      toast({ title: 'Error', description: e?.message || 'Failed to save BOQ.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const replaceBOQWithExtracted = async () => {
    if (projectId) {
      const targetItems = activeFileKey ? scopedItems : items;
      if (targetItems.length === 0) {
        toast({
          title: "No BOQ to replace",
          description: "There are no existing BOQ items for this project.",
          variant: "destructive",
        });
        return;
      }
      setSaving(true);
      try {
        for (const item of targetItems) {
          await api.deleteBOQ(item.id);
        }
        const res = await api.saveBOQItems({
          project_id: projectId || "",
          items: extractedItems,
          boq_file_name: boqFile?.name,
          client: activeClient || undefined,
        });
        if (!res?.success) throw new Error(res?.error || "Failed to save BOQ");
        const savedPath = inferSavedFilePath(res);

        await fetchItems();
        setSearchTerm("");
        setCurrentPage(1);
        setImportPreviewOpen(false);
        setBoqFile(null);
        if (boqInputRef.current) boqInputRef.current.value = "";
        if (savedPath) {
          const next = `/${projectId}/boq/manage?file=${encodeURIComponent(savedPath)}${activeClient ? `&client=${encodeURIComponent(activeClient)}` : ""}`;
          navigate(next);
        } else {
          const next = `/${projectId}/boq/manage${activeClient ? `?client=${encodeURIComponent(activeClient)}` : ""}`;
          navigate(next);
        }
        toast({ title: "BOQ replaced", description: "BOQ replaced successfully." });
      } catch (e) {
        toast({ title: "Error", description: e?.message || "Failed to replace BOQ.", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    } else {
      const withIds = extractedItems.map((it, i) => ({ ...it, id: i + 1 }));
      setItems(withIds);
      setSearchTerm("");
      setCurrentPage(1);
      setImportPreviewOpen(false);
      setBoqFile(null);
      if (boqInputRef.current) boqInputRef.current.value = "";
      toast({ title: "BOQ replaced", description: `${withIds.length} item(s) loaded from PDF. Select a project to save to server.` });
    }
  };

  const openAddDialog = () => {
    setItemForm(EMPTY_FORM);
    setFormFile(null);
    setAddDialogOpen(true);
  };

  const handleAddItem = async (e) => {
    e?.preventDefault();
    if (!projectId) {
      toast({ title: "Select project", description: "Choose a project first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...itemForm,
        project_id: projectId,
        amount: calculateBoqAmount(itemForm.quantity, itemForm.rate)?.toString() ?? itemForm.amount,
      };
      if (formFile instanceof File) payload.boq_file = formFile;
      let res;
      if (activeClient === 'lodha') {
        res = await api.createBOQLodha({
          ...payload,
          description: payload.description,
          section: payload.category,
          item_no: payload.item_no || '',
          hsn: payload.item_code || '',
          qty: payload.quantity,
        });
      } else if (activeClient === 'hiranandani') {
        res = await api.createBOQHiranandani({
          ...payload,
          description: payload.description,
          section: payload.category,
          item_no: payload.item_no || '',
          sac_code: payload.item_code || '',
          order_qty: payload.quantity,
          uom: payload.unit,
          unit_price: payload.rate,
          value: payload.amount,
        });
      } else {
        res = await api.createBOQ(payload);
      }
      if (res.success) {
        await fetchItems();
        setAddDialogOpen(false);
        setItemForm(EMPTY_FORM);
        setFormFile(null);
        setSearchTerm("");
        setCurrentPage(1);
        toast({ title: "Item added", description: "BOQ item created." });
      } else {
        toast({ title: "Error", description: res.error || "Failed to add item.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message || "Failed to add item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (item) => {
    setEditItem(item);
    setItemForm({
      category: item.category ?? '',
      item_no: item.item_no ?? item.code ?? '',
      item_code: item.hsn ?? item.sac_code ?? item.item_code ?? '',
      description: item.description ?? '',
      floor: item.floor ?? '',
      unit: item.unit ?? '',
      quantity: item.quantity ?? '',
      rate: item.rate ?? '',
      amount: calculateBoqAmount(item.quantity, item.rate)?.toString() ?? (item.amount ?? ''),
    });
    setFormFile(null);
  };

  const openViewDialog = async (item) => {
    if (!item) return;
    setViewItem(item);
    setViewItemDetail(item);
    setViewItemLoading(true);
    try {
      const res = await api.getBOQById(item.id);
      if (res?.success && res.data) {
        setViewItemDetail(res.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setViewItemLoading(false);
    }
  };

  const handleEditItem = async (e) => {
    e?.preventDefault();
    if (!editItem) return;
    setSaving(true);
    try {
      const payload = {
        ...itemForm,
        item_code: itemForm.item_code || undefined,
        amount: calculateBoqAmount(itemForm.quantity, itemForm.rate)?.toString() ?? itemForm.amount,
      };
      if (formFile instanceof File) payload.boq_file = formFile;
      const res = await api.updateBOQ(editItem.id, payload);
      if (res.success) {
        await fetchItems();
        setEditItem(null);
        setItemForm(EMPTY_FORM);
        setFormFile(null);
        toast({ title: "Item updated", description: "BOQ item saved." });
      } else {
        toast({ title: "Error", description: res.error || "Failed to update item.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message || "Failed to update item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item) => {
    if (!item) return;
    setDeleteTarget(item);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    const item = deleteTarget;
    if (!item) return;
    setSaving(true);
    try {
      const res = await api.deleteBOQ(item.id);
      if (res.success) {
        await fetchItems();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } else {
        toast({ title: "Error", description: res.error || "Failed to delete item.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message || "Failed to delete item.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = scopedItems.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(item.category ?? "").toLowerCase().includes(term) ||
      String(item.code ?? "").toLowerCase().includes(term) ||
      String(item.description ?? "").toLowerCase().includes(term) ||
      String(item.unit ?? "").toLowerCase().includes(term) ||
      String(item.floor ?? "").toLowerCase().includes(term) ||
      String(item.quantity).includes(term) ||
      String(item.rate).includes(term) ||
      String(item.amount).includes(term)
    );
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);
  const pageIds = paginatedItems.map((i) => i?.id).filter((id) => id != null);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const pageSomeSelected = pageIds.some((id) => selectedIds.has(id));
  const pageCheckboxState = pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false;

  const totalAmount = filteredItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const prettyKey = (key) => {
    const raw = String(key || "").trim();
    if (!raw) return "";
    if (raw.toLowerCase() === "category" || raw.toLowerCase() === "categories") return "Section";
    const withSpaces = raw
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
  };

  const toggleItemSelection = (id, checked) => {
    if (id == null) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const togglePageSelection = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        pageIds.forEach((id) => next.add(id));
      } else {
        pageIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  const handleMassDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!projectId || ids.length === 0) return;

    setSaving(true);
    try {
      let deleted = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          const res = await api.deleteBOQ(id);
          if (res?.success) deleted += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      await fetchItems();
      setSelectedIds(new Set());
      setMassDeleteOpen(false);
      toast({
        title: "Mass delete complete",
        description: failed > 0 ? `${deleted} deleted, ${failed} failed.` : `${deleted} item(s) deleted.`,
        variant: failed > 0 ? "destructive" : undefined,
      });
    } finally {
      setSaving(false);
    }
  };


  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">BOQ</h1>
            {activeClient === 'lodha' ? (
              <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Lodha Format</Badge>
            ) : activeClient === 'hiranandani' ? (
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Hiranandani Format</Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-2">
            {activeFileKey
              ? `Managing ${activeFileKey === NO_FILE_KEY ? "manual BOQ" : "BOQ file"} items.`
              : "Upload a BOQ PDF or open one from the BOQ list."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap w-full lg:w-auto gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeClient ? "outline" : "default"}
            className="shrink-0 w-full lg:w-auto"
            onClick={() => setNewBoqDialogOpen(true)}
            disabled={!projectId}
          >
            {activeClient ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                {activeClient === "lodha" ? "Lodha Format" : activeClient === "hiranandani" ? "Hiranandani Format" : activeClient}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Select BOQ Format
              </>
            )}
          </Button>
          <div
            className={[
              "relative border-2 border-dashed rounded-lg px-4 py-2 flex items-center gap-2 text-sm transition-colors w-full sm:col-span-2 lg:w-auto",
              canImportBoqPdf ? "hover:bg-muted/50" : "opacity-60 cursor-not-allowed",
            ].join(" ")}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={boqInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={!canImportBoqPdf}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {extracting ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate min-w-0">
              {!projectId
                ? "Select project first"
                : !activeClient
                  ? "Select BOQ format first"
                  : boqFile
                    ? (extracting ? "Extracting…" : boqFile.name)
                    : "Import BOQ PDF"}
            </span>
            {extractError && <span className="text-destructive text-xs">{extractError}</span>}
          </div>
          <Button
            size="sm"
            className="shrink-0 w-full lg:w-auto bg-sky-200 text-sky-950 hover:bg-sky-300 dark:bg-sky-300 dark:text-sky-950 dark:hover:bg-sky-400"
            onClick={openAddDialog}
            disabled={!projectId}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
          {selectedIds.size > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0 w-full lg:w-auto"
              onClick={() => setMassDeleteOpen(true)}
              disabled={!projectId || saving}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({selectedIds.size})
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="shrink-0 w-full lg:w-auto" onClick={fetchItems} disabled={loading}>
            {loading || loadingProjectSamples ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>BOQ Items</CardTitle>
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by section, code, description..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {filteredItems.length} of {items.length} item(s)
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <div ref={boqTableScrollRef} className="overflow-x-auto">
              <div className={activeClient ? "min-w-[1200px]" : "min-w-[1100px]"}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pageCheckboxState}
                      onCheckedChange={(v) => togglePageSelection(Boolean(v))}
                      disabled={paginatedItems.length === 0}
                    />
                  </TableHead>
                  {activeClient === 'hiranandani' ? (
                    <>
                      <TableHead>Item No</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>SAC Code</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Org Qty</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Description</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>{activeClient ? "Item No" : "Item Code"}</TableHead>
                      {activeClient === 'lodha' ? <TableHead>HSN</TableHead> : null}
                      {!activeClient ? <TableHead>Floor</TableHead> : null}
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Org Qty</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                      Loading BOQ items…
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                      {!projectId ? "Select a project to load BOQ items." : searchTerm ? "No items found matching your search." : "No BOQ items. Import a PDF or add items manually."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => {
                    const breakdown = getBoqQuantityBreakdown(item);
                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => openViewDialog(item)}
                      >
                        <TableCell>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(v) => toggleItemSelection(item.id, Boolean(v))}
                            />
                          </div>
                        </TableCell>
                        {activeClient === 'hiranandani' ? (
                          <>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{item.code}</TableCell>
                            <TableCell className="font-medium max-w-[560px] whitespace-normal break-words">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-muted-foreground">{item.category}</TableCell>
                            <TableCell className="font-mono text-xs">{item.sac_code || item.item_code || ''}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(item.quantity, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(breakdown.used, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(breakdown.remaining, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{item.rate ? formatCurrencyINR(item.rate) : "–"}</TableCell>
                            <TableCell className="text-right">{item.amount ? formatCurrencyINR(item.amount) : "–"}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium max-w-[560px] whitespace-normal break-words">
                              {item.description}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-muted-foreground">{item.category}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{item.code}</TableCell>
                            {activeClient === 'lodha' ? <TableCell className="font-mono text-xs">{item.hsn || item.item_code || ''}</TableCell> : null}
                            {!activeClient ? <TableCell>{item.floor}</TableCell> : null}
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(item.quantity, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(breakdown.used, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(breakdown.remaining, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{item.rate ? formatCurrencyINR(item.rate) : "–"}</TableCell>
                            <TableCell className="text-right">{item.amount ? formatCurrencyINR(item.amount) : "–"}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(item)} title="Delete">
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {paginatedItems.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={10}>Total</TableCell>
                    <TableCell className="text-right">{formatCurrencyINR(totalAmount)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
              </div>
            </div>
            {filteredItems.length > itemsPerPage && (
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mt-4 pt-4 border-t gap-3">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">Rows per page</p>
                  <Select
                    value={`${itemsPerPage}`}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50, 100].map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 md:hidden">
            {paginatedItems.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? "No items found matching your search." : "No BOQ items. Import a PDF or add items manually."}
              </div>
            ) : (
              paginatedItems.map((item) => (
              <div
                key={item.id}
                className="p-4 border rounded-lg space-y-3 cursor-pointer"
                onClick={() => openViewDialog(item)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-semibold text-muted-foreground">{item.category}</div>
                    <div className="font-medium break-words">{item.description}</div>
                    <div className="text-xs font-mono text-muted-foreground break-all">
                      {activeClient ? `Item No: ${item.code || "-"}` : `Item Code: ${item.code || "-"}`}
                    </div>
                    {activeClient === "lodha" ? (
                      <div className="text-xs text-muted-foreground">HSN: <span className="font-mono">{item.hsn || item.item_code || "-"}</span></div>
                    ) : activeClient === "hiranandani" ? (
                      <div className="text-xs text-muted-foreground">SAC: <span className="font-mono">{item.sac_code || item.item_code || "-"}</span></div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={(v) => toggleItemSelection(item.id, Boolean(v))}
                      />
                    </div>
                    <div className="font-bold">{item.amount ? formatCurrencyINR(item.amount) : "–"}</div>
                    {item.rate ? (
                      <div className="text-xs text-muted-foreground">
                        {formatCurrencyINR(item.rate)}/{item.unit}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground block">Used:</span>
                    <span>{formatNumberIN(getBoqQuantityBreakdown(item).used)} {item.unit}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Remaining:</span>
                    <span>{formatNumberIN(getBoqQuantityBreakdown(item).remaining)} {item.unit}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Org Qty:</span>
                    <span>{formatNumberIN(item.quantity, { maximumFractionDigits: 3 })} {item.unit}</span>
                  </div>
                  {!activeClient ? (
                    <div>
                      <span className="text-muted-foreground block">Floor:</span>
                      <span>{item.floor}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-muted-foreground block">{activeClient === "hiranandani" ? "Unit Price:" : "Rate:"}</span>
                      <span>{item.rate ? formatCurrencyINR(item.rate) : "–"}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(item)}>
                    Delete
                  </Button>
                </div>
              </div>
              ))
            )}
            {paginatedItems.length > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg flex justify-between items-center font-bold">
                <span>Total Amount</span>
                <span>{formatCurrencyINR(totalAmount)}</span>
              </div>
            )}
            {filteredItems.length > itemsPerPage && (
              <div className="flex flex-col gap-3 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">Rows per page</p>
                  <Select
                    value={`${itemsPerPage}`}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50, 100].map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete BOQ item</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-mono">{deleteTarget?.code || deleteTarget?.item_code || "this item"}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={saving || !deleteTarget}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massDeleteOpen} onOpenChange={setMassDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected BOQ items</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            This will permanently delete {selectedIds.size} item(s).
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleMassDelete} disabled={saving || selectedIds.size === 0}>
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && (setViewItem(null), setViewItemDetail(null))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>BOQ Item Details</DialogTitle>
          </DialogHeader>
          {viewItemLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : viewItemDetail ? (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="grid gap-2">
                {Object.entries(viewItemDetail)
                  .filter(([key]) => !key.startsWith("__"))
                  .filter(([key]) => key !== "used_in_samples")
                  .map(([key, value]) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-md border p-3 text-sm">
                      <div className="text-muted-foreground font-medium break-words">{prettyKey(key)}</div>
                      <div className="sm:col-span-2 break-words">
                        {formatDetailValue(value)}
                      </div>
                    </div>
                  ))}
                {normalizeUsedSampleRows(viewItemDetail.used_in_samples).length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">Used In Samples</div>
                      <Badge variant="secondary" className="rounded-full px-3">
                        {normalizeUsedSampleRows(viewItemDetail.used_in_samples).length} record(s)
                      </Badge>
                    </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sample ID</TableHead>
                            <TableHead>Building</TableHead>
                            <TableHead>Site</TableHead>
                            <TableHead className="text-right">Used Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                        {normalizeUsedSampleRows(viewItemDetail.used_in_samples).map((sample, index) => (
                          <TableRow key={`${sample?.sample_id || index}`}>
                            <TableCell>{sample?.sample_id || "-"}</TableCell>
                            <TableCell>{sample?.building_name || "-"}</TableCell>
                            <TableCell>{sample?.site_name || "-"}</TableCell>
                            <TableCell className="text-right">
                              {formatNumberIN(getUsedQtyForSampleRecord(sample, viewItemDetail, projectSamples), { maximumFractionDigits: 3 }) || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setViewItem(null); setViewItemDetail(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add BOQ Item</DialogTitle>
            </DialogHeader>
          <form ref={addFormRef} onSubmit={handleAddItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section *</Label>
                <Input
                  value={itemForm.category}
                  onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Civil, Plumbing"
                  required
                />
              </div>
              {activeClient ? (
                <div className="space-y-2">
                  <Label>Item No *</Label>
                  <Input
                    value={itemForm.item_no}
                    onChange={(e) => setItemForm((f) => ({ ...f, item_no: e.target.value }))}
                    placeholder={activeClient === "lodha" ? "e.g. 1.01.1" : "e.g. (1)"}
                    required
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>
                  {activeClient === 'lodha' ? 'HSN/SAC Code' : activeClient === 'hiranandani' ? 'SAC Code' : 'Item Code'}
                </Label>
                <Input
                  value={itemForm.item_code}
                  onChange={(e) => setItemForm((f) => ({ ...f, item_code: e.target.value }))}
                  placeholder={activeClient ? 'e.g. 995462' : 'e.g. C-101'}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{activeClient === 'hiranandani' ? 'Service Description *' : 'Item Description *'}</Label>
              <Input
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Item description"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input
                  value={itemForm.floor}
                  onChange={(e) => setItemForm((f) => ({ ...f, floor: e.target.value }))}
                  placeholder="e.g. Ground"
                />
              </div>
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'UOM' : 'Unit'}</Label>
                <UnitSelect
                  value={itemForm.unit}
                  onValueChange={(value) =>
                    setItemForm((f) => {
                      const converted = convertQuantity(f.quantity, f.unit, value);
                      return syncBoqAmount({
                        ...f,
                        unit: value,
                        quantity: converted ?? f.quantity,
                      });
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'Order Qty' : 'Qty'}</Label>
                <Input
                  type="number"
                  step="any"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((f) => syncBoqAmount({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'Unit Price' : 'Rate'}</Label>
                <Input
                  type="number"
                  step="any"
                  value={itemForm.rate}
                  onChange={(e) => setItemForm((f) => syncBoqAmount({ ...f, rate: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'Value' : 'Amount'}</Label>
                <Input
                  type="number"
                  step="any"
                  value={itemForm.amount}
                  readOnly
                  tabIndex={-1}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Item"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit BOQ Item</DialogTitle>
            </DialogHeader>
          <form onSubmit={handleEditItem} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Section *</Label>
                <Input
                  value={itemForm.category}
                  onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Civil, Plumbing"
                  required
                />
              </div>
              {activeClient ? (
                <div className="space-y-2">
                  <Label>Item No *</Label>
                  <Input
                    value={itemForm.item_no}
                    onChange={(e) => setItemForm((f) => ({ ...f, item_no: e.target.value }))}
                    placeholder={activeClient === "lodha" ? "e.g. 1.01.1" : "e.g. (1)"}
                    required
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>
                  {activeClient === 'lodha' ? 'HSN/SAC Code' : activeClient === 'hiranandani' ? 'SAC Code' : 'Item Code'}
                </Label>
                <Input
                  value={itemForm.item_code}
                  onChange={(e) => setItemForm((f) => ({ ...f, item_code: e.target.value }))}
                  placeholder={activeClient ? 'e.g. 995462' : 'e.g. C-101'}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{activeClient === 'hiranandani' ? 'Service Description *' : 'Item Description *'}</Label>
              <Input
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Item description"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input
                  value={itemForm.floor}
                  onChange={(e) => setItemForm((f) => ({ ...f, floor: e.target.value }))}
                  placeholder="e.g. Ground"
                />
              </div>
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'UOM' : 'Unit'}</Label>
                <UnitSelect
                  value={itemForm.unit}
                  onValueChange={(value) =>
                    setItemForm((f) => {
                      const converted = convertQuantity(f.quantity, f.unit, value);
                      return syncBoqAmount({
                        ...f,
                        unit: value,
                        quantity: converted ?? f.quantity,
                      });
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'Order Qty' : 'Qty'}</Label>
                <Input
                  type="number"
                  step="any"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((f) => syncBoqAmount({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'Unit Price' : 'Rate'}</Label>
                <Input
                  type="number"
                  step="any"
                  value={itemForm.rate}
                  onChange={(e) => setItemForm((f) => syncBoqAmount({ ...f, rate: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{activeClient === 'hiranandani' ? 'Value' : 'Amount'}</Label>
                <Input
                  type="number"
                  step="any"
                  value={itemForm.amount}
                  readOnly
                  tabIndex={-1}
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importPreviewOpen} onOpenChange={setImportPreviewOpen}>
        <DialogContent className="sm:max-w-[90vw] h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Preview BOQ from PDF
              <Badge variant="secondary" className="ml-2">
                {extractedItems.length} item(s)
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {extractedProjectName && (
            <p className="text-sm text-muted-foreground">Project: <strong>{extractedProjectName}</strong></p>
          )}
          <p className="text-sm text-muted-foreground">
            {extractedItems.length} item(s) extracted. {canReplaceCurrentBOQ ? "Add to existing BOQ or replace all." : "Add to BOQ."}
          </p>
          <div className="flex-1 overflow-auto border rounded-md">
            <div className="min-w-[640px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {activeClient === 'hiranandani' ? (
                    <>
                      <TableHead>Item No</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>SAC Code</TableHead>
                      <TableHead>UOM</TableHead>
                      <TableHead className="text-right">Order Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Description</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>{activeClient === 'lodha' ? 'Item No' : 'Code'}</TableHead>
                      {activeClient === 'lodha' ? <TableHead>HSN</TableHead> : null}
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      {activeClient ? <TableHead className="text-right">Rate</TableHead> : null}
                      {activeClient ? <TableHead className="text-right">Amount</TableHead> : null}
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const groups = extractedItems.reduce((acc, it) => {
                    const key = String(it.category || 'General');
                    if (!acc.has(key)) acc.set(key, []);
                    acc.get(key).push(it);
                    return acc;
                  }, new Map());
                  return Array.from(groups.entries()).flatMap(([section, rows]) => [
                    (
                      <TableRow key={`section-${section}`}>
                        <TableCell colSpan={activeClient ? 8 : 5} className="bg-muted/40 font-medium">
                          {section}
                        </TableCell>
                      </TableRow>
                    ),
                    ...rows.map((it, i) => (
                      <TableRow key={`${section}-${i}`}>
                        {activeClient === 'hiranandani' ? (
                          <>
                            <TableCell className="font-mono text-xs">{it.code}</TableCell>
                            <TableCell className="max-w-[560px] whitespace-normal break-words">
                              {it.description}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <Badge variant="outline">{it.category}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{it.sac_code || ''}</TableCell>
                            <TableCell>{it.unit}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(it.quantity, { maximumFractionDigits: 3 })}</TableCell>
                            <TableCell className="text-right">{it.rate ? formatCurrencyINR(it.rate) : '–'}</TableCell>
                            <TableCell className="text-right">{it.amount ? formatCurrencyINR(it.amount) : '–'}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="max-w-[560px] whitespace-normal break-words">
                              {it.description}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <Badge variant="outline">{it.category}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{it.code}</TableCell>
                            {activeClient === 'lodha' ? <TableCell className="font-mono text-xs">{it.hsn || ''}</TableCell> : null}
                            <TableCell>{it.unit}</TableCell>
                            <TableCell className="text-right">{formatNumberIN(it.quantity, { maximumFractionDigits: 3 })}</TableCell>
                            {activeClient ? <TableCell className="text-right">{it.rate ? formatCurrencyINR(it.rate) : '–'}</TableCell> : null}
                            {activeClient ? <TableCell className="text-right">{it.amount ? formatCurrencyINR(it.amount) : '–'}</TableCell> : null}
                          </>
                        )}
                      </TableRow>
                    )),
                  ]);
                })()}
              </TableBody>
            </Table>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setImportPreviewOpen(false); setBoqFile(null); setExtractError(null); if (boqInputRef.current) boqInputRef.current.value = ""; }} disabled={saving}>
              Cancel
            </Button>
            <Button variant="outline" onClick={addExtractedToBOQ} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                `Add to BOQ (${extractedItems.length})`
              )}
            </Button>
            {canReplaceCurrentBOQ ? (
              <Button onClick={replaceBOQWithExtracted} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Replacing…
                  </>
                ) : (
                  `Replace BOQ (${extractedItems.length})`
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newBoqDialogOpen} onOpenChange={setNewBoqDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select BOQ Format</DialogTitle>
            <DialogDescription>Choose the client format before creating the BOQ.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Lodha", value: "lodha", description: "Lodha BOQ format" },
              { label: "Hiranandani", value: "hiranandani", description: "Hiranandani BOQ format" },
            ].map((opt) => (
              <button
                key={`boq-new-${opt.value}`}
                type="button"
                onClick={() => {
                  setNewBoqDialogOpen(false);
                  if (!projectId) return;
                  setActiveClient(opt.value);
                  setBoqFile(null);
                  setExtractedItems([]);
                  setExtractError(null);
                  if (boqInputRef.current) boqInputRef.current.value = "";
                  navigate(`/${projectId}/boq/manage?client=${encodeURIComponent(opt.value)}&new=1`);
                }}
                className="rounded-lg border border-border p-4 text-left transition hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div className="text-base font-semibold">{opt.label}</div>
                <div className="mt-2 text-sm text-muted-foreground">{opt.description}</div>
                {activeClient === opt.value ? (
                  <div className="mt-3">
                    <Badge variant="secondary">Selected</Badge>
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
