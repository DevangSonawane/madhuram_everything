import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Layers, Save, Copy, Upload, CheckCircle, FileText, Image as ImageIcon, ArrowRight, ArrowLeft, ChevronLeft, Eye, Loader2, Search, Filter, Download, Plus, Minus, Link2, Paperclip, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { extractImagesFromPdf, extractTextFromPdf } from "@/lib/pdfUtils";
import { downloadSamplePdf } from "@/lib/samplePdf";
import { extractCPVCData, mapCPVCItemsToSamples } from "@/lib/cpvcExtractor";
import { extractSuspendedWorkData, mapSuspendedWorkItemsToSamples } from "@/lib/suspendedWorkExtractor";
import { syncSampleBoqQuantities } from "@/lib/sampleBoqSync";
import { getSamplePrimaryIdentifier, getSamplePrimaryIdentifierLabel } from "@/lib/sampleDisplay";
// Diagram/other-doc preview removed from Samples create flow.
import { useProject } from "@/contexts/useProject";
import { api } from "@/lib/api";
import { formatCurrencyINR } from "@/lib/numberFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import InventoryPicker from "@/components/InventoryPicker";

// Mock Sample Data (Floor-wise distribution)
const MOCK_SAMPLES = [
  { id: 1, item: "CPVC Pipe 2 inch", unit: "Mtr", perFloorQty: 42, totalFloors: 117, totalQty: 4914, status: "Locked" },
  { id: 2, item: "Wall Mounted WC", unit: "Nos", perFloorQty: 4, totalFloors: 117, totalQty: 468, status: "Locked" },
  { id: 3, item: "Basin Mixer", unit: "Nos", perFloorQty: 4, totalFloors: 117, totalQty: 468, status: "Draft" },
  { id: 4, item: "Shower Head", unit: "Nos", perFloorQty: 4, totalFloors: 117, totalQty: 468, status: "Draft" },
];

export default function Samples() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams();
  const [step, setStep] = useState(1);
  const [floorCount, setFloorCount] = useState("");
  const [floorPlanFile, setFloorPlanFile] = useState(null);
  const [suspendedWorkFile, setSuspendedWorkFile] = useState(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [floorPlanPreview, setFloorPlanPreview] = useState(null);
  
  // PDF extraction state - CPVC
  const [extractedDiagrams, setExtractedDiagrams] = useState([]);
  const [extractedValues, setExtractedValues] = useState([]);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0, message: '' });
  
  // PDF extraction state - Suspended Work
  const [suspendedDiagrams, setSuspendedDiagrams] = useState([]);
  const [suspendedValues, setSuspendedValues] = useState([]);
  const [processingSuspendedPdf, setProcessingSuspendedPdf] = useState(false);
  const [suspendedExtractionProgress, setSuspendedExtractionProgress] = useState({ current: 0, total: 0, message: '' });
  
  // UI state
  // Diagram/document viewer removed from Samples page.
  const [samples, setSamples] = useState(MOCK_SAMPLES);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all", "cpvc", "suspended"
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.project_id || selectedProject?.id || routeProjectId || "";
  const isCreateRoute = /\/samples\/create\/?$/.test(String(location?.pathname || ""));
  const [serverSamples, setServerSamples] = useState([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [uploadFilePaths, setUploadFilePaths] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(() => isCreateRoute);
  const [linkingSampleId, setLinkingSampleId] = useState(null);
  const [linkedSampleIds, setLinkedSampleIds] = useState(() => new Set());
  const [selectedUploadedFile, setSelectedUploadedFile] = useState("");
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false);
  const [itemFieldDialogOpen, setItemFieldDialogOpen] = useState(false);
  const [itemFieldRowIndex, setItemFieldRowIndex] = useState(null);
  const [itemFieldKey, setItemFieldKey] = useState("");
  const [itemFieldValue, setItemFieldValue] = useState("");
  const [boqPickerOpen, setBoqPickerOpen] = useState(false);
  const [projectBoqItems, setProjectBoqItems] = useState([]);
  const [loadingProjectBoqItems, setLoadingProjectBoqItems] = useState(false);
  const [boqSearch, setBoqSearch] = useState("");
  const [activeBoqClient, setActiveBoqClient] = useState("");
  const [addingBoqKey, setAddingBoqKey] = useState(null);
  const [savingSample, setSavingSample] = useState(false);
  const [pendingBoqQty, setPendingBoqQty] = useState({});
  const [boqDescriptionPreview, setBoqDescriptionPreview] = useState(null);
  const [inventoryQtyStatus, setInventoryQtyStatus] = useState({});
  const [createForm, setCreateForm] = useState({
    sample_id: "",
    building_name: "",
    site_name: "",
    work_done: "",
    sample_file: "",
    flats: "",
    location: { floor: "", flat_no: "", block: "", wing: "", coordinates: "" },
    item_description: [],
    add_fields: []
  });

  const getSelectedProjectId = () => selectedProject?.project_id || selectedProject?.id;
  const projectIdForInventory = useMemo(() => {
    const pid = getSelectedProjectId();
    const n = Number(pid);
    return Number.isFinite(n) ? n : null;
  }, [selectedProject]);

  const getSampleApiId = (sample) => sample?.sample_id ?? sample?.id ?? null;

  useEffect(() => {
    // Keep UI in sync with route.
    setShowCreateForm(isCreateRoute);
  }, [isCreateRoute]);

  const extractUploadedFilePaths = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim());
    if (typeof data === "string") return data.trim() ? [data.trim()] : [];

    const candidates = [
      data.filePaths,
      data.file_paths,
      data.files,
      data.paths,
      data.filePath,
      data.file_path,
      data.path,
      data.url,
      data.data?.filePaths,
      data.data?.file_paths,
      data.data?.files,
      data.data?.paths,
      data.data?.filePath,
      data.data?.file_path,
      data.data?.path,
      data.data?.url,
    ].filter(Boolean);

    for (const candidate of candidates) {
      const extracted = extractUploadedFilePaths(candidate);
      if (extracted.length > 0) return extracted;
    }
    return [];
  };

  const isInsufficientStockError = (error) => /insufficient\s+stock/i.test(String(error || ""));

  const toIntOrNull = (value) => {
    const n = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  // BOQ in sample-management should display the BOQ rows "as-is" from the API.
  // We still derive a minimal set of fields for rendering/actions without mutating the original item.
  const toFiniteNumber = (value) => {
    const n = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const computeAmount = (qty, rate) => {
    const q = toFiniteNumber(qty);
    const r = toFiniteNumber(rate);
    if (q == null || r == null) return "";
    return String(q * r);
  };

  const pickFirst = (obj, keys) => {
    const source = obj && typeof obj === "object" ? obj : {};
    for (const key of keys) {
      const value = source?.[key];
      if (value == null) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      return value;
    }
    return "";
  };

  const deriveBoqFields = (item) => {
    const raw = item && typeof item === "object" ? item : {};
    const qtyRaw = pickFirst(raw, ["quantity", "qty", "order_qty", "orderQty"]);
    const rateRaw = pickFirst(raw, ["rate", "unit_price", "unitPrice"]);
    const amountRaw = pickFirst(raw, ["amount", "value"]);
    const computedAmount = computeAmount(qtyRaw, rateRaw);
    return {
      id: raw?.boq_id ?? raw?.id ?? "",
      item_no: pickFirst(raw, ["item_no", "itemNo"]),
      item_code: pickFirst(raw, ["item_code", "itemCode", "code"]),
      section: pickFirst(raw, ["category", "section", "section_name", "sectionName"]),
      description: pickFirst(raw, ["description", "item_description", "service_description"]),
      specification: pickFirst(raw, ["specification", "specifications", "spec", "specs", "model_specification", "modelSpecification"]),
      unit: pickFirst(raw, ["unit", "uom", "UOM"]),
      qty: qtyRaw,
      boq_qty: pickFirst(raw, ["boq_qty", "boqQty", "selected_qty", "total_qty"]) || qtyRaw,
      rate: rateRaw,
      amount: computedAmount || amountRaw,
      hsn: pickFirst(raw, ["hsn", "hsn_sac_code"]),
      sac_code: pickFirst(raw, ["sac_code"]),
      client: pickFirst(raw, ["client", "client_format", "boq_client"]),
    };
  };

  const normalizeBoqMatchKey = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const getBoqExactMatchKey = (item = {}) => {
    const rawExactKey = item?.boq_match_key ?? item?.boqMatchKey;
    const normalizedExact = normalizeBoqMatchKey(rawExactKey);
    if (normalizedExact) return normalizedExact;

    const rawBoqKey = item?.boq_key ?? item?.boqKey;
    const normalizedBoqKey = normalizeBoqMatchKey(rawBoqKey);
    if (normalizedBoqKey) return `key${normalizedBoqKey}`;

    const rawBoqId = item?.boq_id ?? item?.boqId ?? item?.id ?? "";
    const normalizedBoqId = normalizeBoqMatchKey(rawBoqId);
    if (normalizedBoqId) return `id${normalizedBoqId}`;
    return "";
  };

  const compareHiranandaniBoqOrder = (a, b) => {
    const toOrderValue = (item) => {
      const raw = String(deriveBoqFields(item).item_no || deriveBoqFields(item).item_code || "").trim();
      const match = raw.match(/\d+/);
      if (!match) return null;
      const n = Number(match[0]);
      return Number.isFinite(n) ? n : null;
    };

    const aOrder = toOrderValue(a);
    const bOrder = toOrderValue(b);
    if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder;
    if (aOrder != null && bOrder == null) return -1;
    if (aOrder == null && bOrder != null) return 1;

    const aId = toFiniteNumber(deriveBoqFields(a).id);
    const bId = toFiniteNumber(deriveBoqFields(b).id);
    if (aId != null && bId != null && aId !== bId) return aId - bId;
    return 0;
  };

  const boqItemKey = (item) => {
    const exactKey = getBoqExactMatchKey(item);
    if (exactKey) return exactKey;
    const derived = deriveBoqFields(item);
    const keyFromId = String(derived.id || "").trim();
    if (keyFromId) return keyFromId;
    const keyFromNo = String(derived.item_no || "").trim();
    const keyFromCode = String(derived.item_code || "").trim();
    if (keyFromNo) return keyFromNo;
    if (keyFromCode) return keyFromCode;
    return `${String(derived.description || "").trim()}__${String(derived.section || "").trim()}`;
  };

  const truncateWords = (value, maxWords = 10) => {
    const text = String(value || "").trim();
    if (!text) return "-";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length <= maxWords) return text;
    return `${parts.slice(0, maxWords).join(" ")}...`;
  };

  const formatMaybeCurrency = (value) => {
    if (value == null || value === "") return "-";
    const cleaned = String(value).replace(/,/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? formatCurrencyINR(n) : String(value);
  };

  const parsePositiveCount = (value) => {
    const text = String(value ?? "").replace(/,/g, "").trim();
    if (!text) return 0;
    const match = text.match(/\d+/);
    const n = match ? Number(match[0]) : Number(text);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  const getFlatCount = (value = createForm.flats) => parsePositiveCount(value);

  const getFloorCount = (value = createForm.location?.floor || floorCount) => parsePositiveCount(value);

  const getSampleItemFieldValue = (row, fieldKey) =>
    (row?.add_fields || []).find((f) => String(f?.key || "").trim() === fieldKey)?.value ?? "";

  const setSampleItemFieldValue = (row, fieldKey, value) => {
    const list = Array.isArray(row?.add_fields) ? [...row.add_fields] : [];
    const idx = list.findIndex((f) => String(f?.key || "").trim() === fieldKey);
    if (idx >= 0) list[idx] = { ...list[idx], value };
    else list.push({ key: fieldKey, value });
    return { ...row, add_fields: list };
  };

  const isManualLikeRow = (row = {}) => {
    if (String(row?._row_type || "").toLowerCase() === "manual") return true;
    const description = String(row?.description || row?.item_name || row?.itemName || row?.item_code || row?.code || "").trim();
    if (!description) return false;
    return !String(row?.boq_id || row?.boqId || row?.boq_key || row?.boqKey || row?.boq_match_key || row?.boqMatchKey || "").trim();
  };

  const syncSampleItemDerivedFields = (row, { flatCount = getFlatCount(), floorMultiplier = getFloorCount() } = {}) => {
    const base = row && typeof row === "object" ? row : {};
    const isBoqRow = String(base._row_type || "").toLowerCase() === "boq";
    const isManualRow = isManualLikeRow(base);
    const qtyPerFlat = Math.max(0, toFiniteNumber(base.quantity) || 0);
    const qtyText = qtyPerFlat ? String(qtyPerFlat) : "";
    const multiplier = parsePositiveCount(flatCount) * parsePositiveCount(floorMultiplier);
    const totalQty = qtyPerFlat > 0 ? qtyPerFlat * multiplier : isManualRow ? multiplier : 0;
    const boqQtyText =
      String(
        base.boq_qty ??
          getSampleItemFieldValue(base, "boq_qty") ??
          (isBoqRow ? totalQty || qtyPerFlat || 0 : totalQty || qtyPerFlat || 0)
      ).trim();

    const rate = toFiniteNumber(base.rate) || toFiniteNumber(getSampleItemFieldValue(base, "rate")) || 0;
    const baseAmount =
      toFiniteNumber(base.value) ||
      (rate && qtyPerFlat ? rate * qtyPerFlat : 0);
    const totalAmount = isBoqRow ? baseAmount : qtyPerFlat > 0 ? baseAmount * multiplier : isManualRow ? baseAmount : 0;

    let next = {
      ...base,
      quantity: qtyText,
      value: baseAmount ? String(baseAmount) : "",
    };

    next = setSampleItemFieldValue(next, "qty_per_flat", qtyText);
    next = setSampleItemFieldValue(next, "floors", String(parsePositiveCount(floorMultiplier)));
    next = setSampleItemFieldValue(next, "flat_count", String(parsePositiveCount(flatCount)));
    next = setSampleItemFieldValue(next, "qty", qtyText);
    next = setSampleItemFieldValue(next, "boq_qty", boqQtyText);
    next = setSampleItemFieldValue(next, "selected_qty", String(isBoqRow ? qtyPerFlat || 0 : totalQty || qtyPerFlat || 0));
    next = setSampleItemFieldValue(next, "total_qty", String(totalQty || 0));
    next = setSampleItemFieldValue(next, "per_flat_amount", baseAmount ? String(baseAmount) : "");
    next = setSampleItemFieldValue(next, "total_amount", totalAmount ? String(totalAmount) : "");
    next = setSampleItemFieldValue(next, "amount", totalAmount ? String(totalAmount) : "");
    if (rate) next = setSampleItemFieldValue(next, "rate", String(rate));

    return next;
  };

  const reindexSampleRows = (rows = []) =>
    (Array.isArray(rows) ? rows : []).map((row, index) => ({
      ...(row && typeof row === "object" ? row : {}),
      sr_no: String(index + 1),
    }));

  const getCalculatedSampleRows = (rows = createForm.item_description, { flatCount = getFlatCount(), floorMultiplier = getFloorCount() } = {}) => {
    return reindexSampleRows(rows).map((row, index) => {
      const isManualRow = isManualLikeRow(row);
      const perFlatQty = Math.max(0, toFiniteNumber(row?.quantity) || 0);
      const perFlatAmount =
        toFiniteNumber(row?.value) ||
        (toFiniteNumber(getSampleItemFieldValue(row, "rate")) && perFlatQty
          ? toFiniteNumber(getSampleItemFieldValue(row, "rate")) * perFlatQty
          : 0);
      const multiplier = parsePositiveCount(flatCount) * parsePositiveCount(floorMultiplier);
      const totalQty = perFlatQty > 0 ? perFlatQty * multiplier : isManualRow ? multiplier : 0;
      const totalAmount = perFlatAmount > 0 ? perFlatAmount * multiplier : 0;
      return {
        sr_no: row?.sr_no ?? row?.srno ?? row?.srNo ?? String(index + 1),
        item_name:
          getSamplePrimaryIdentifier(row, activeBoqClient) ||
          row?.item_name ||
          row?.itemName ||
          row?.description ||
          "",
        description: row?.description ?? "",
        item_code: row?.item_code ?? row?.itemCode ?? row?.code ?? row?.hsn ?? "",
        specification: row?.specification ?? "",
        brand_name: row?.brand_name ?? "",
        unit: row?.unit ?? "",
        qty_per_flat: perFlatQty,
        flats: String(parsePositiveCount(flatCount)),
        floors: parsePositiveCount(floorMultiplier),
        total_qty: totalQty,
        per_flat_amount: perFlatAmount,
        total_amount: totalAmount,
      };
    });
  };

  const buildSavedSampleItems = (rows = createForm.item_description) => {
    const flatCount = getFlatCount();
    const floorMultiplier = getFloorCount();
    const numberedRows = reindexSampleRows(rows);
    return getCalculatedSampleRows(numberedRows, { flatCount, floorMultiplier }).map((item, index) => {
      const source = Array.isArray(numberedRows) ? numberedRows[index] : null;
      let row = source && typeof source === "object" ? { ...source } : {};
      const isBoqRow = String(row._row_type || "").toLowerCase() === "boq";
      const boqId = String(
        row.boq_id ??
          getSampleItemFieldValue(row, "boq_id") ??
          "",
      ).trim();
      const boqQty = String(
        row.boq_qty ??
          getSampleItemFieldValue(row, "boq_qty") ??
          item.total_qty ??
          item.qty_per_flat ??
          ""
      ).trim();
      const boqIssuedQty = isBoqRow
        ? (row.boq_issued_qty ?? getSampleItemFieldValue(row, "boq_issued_qty") ?? item.total_qty ?? "")
        : (row.boq_issued_qty ?? getSampleItemFieldValue(row, "boq_issued_qty") ?? "");
      const sourceSpec =
        row.specification ??
        row.specifications ??
        row.spec ??
        getSampleItemFieldValue(row, "specification") ??
        getSampleItemFieldValue(row, "specifications") ??
        getSampleItemFieldValue(row, "spec") ??
        getSampleItemFieldValue(row, "specs") ??
        "";
      if (sourceSpec) {
        row.specification = String(sourceSpec);
        row = setSampleItemFieldValue(row, "specification", String(sourceSpec));
        row = setSampleItemFieldValue(row, "spec", String(sourceSpec));
      }
      row.item_name = String(
        getSamplePrimaryIdentifier(row, activeBoqClient) ||
          row.item_name ||
          row.itemName ||
          getSampleItemFieldValue(row, "item_name") ||
          getSampleItemFieldValue(row, "itemName") ||
          ""
      );
      row = setSampleItemFieldValue(row, "item_name", row.item_name);
      row.quantity = item.total_qty ? String(item.total_qty) : "";
      row.value = item.total_amount ? String(item.total_amount) : "";
      row.issued_qty = item.total_qty ? String(item.total_qty) : null;
      const rowBoqKey = String(row.boq_key || getSampleItemFieldValue(row, "boq_key") || boqId || "").trim();
      row.boq_key = rowBoqKey;
      row.item_code = String(row.item_code || row.itemCode || row.code || row.hsn || getSampleItemFieldValue(row, "item_code") || "");
      row.code = String(row.code || row.item_code || row.itemCode || getSampleItemFieldValue(row, "code") || "");
      if (boqQty) {
        row.boq_qty = boqQty;
        row = setSampleItemFieldValue(row, "boq_qty", boqQty);
      }
      row = setSampleItemFieldValue(row, "qty_per_flat", item.qty_per_flat ? String(item.qty_per_flat) : "");
      row = setSampleItemFieldValue(row, "flat_count", isBoqRow ? "" : String(item.flats || ""));
      row = setSampleItemFieldValue(row, "floors", isBoqRow ? "" : String(item.floors || 0));
      row = setSampleItemFieldValue(row, "total_qty", item.total_qty ? String(item.total_qty) : "");
      row = setSampleItemFieldValue(row, "per_flat_amount", item.per_flat_amount ? String(item.per_flat_amount) : "");
      row = setSampleItemFieldValue(row, "total_amount", item.total_amount ? String(item.total_amount) : "");
      row = setSampleItemFieldValue(row, "issued_qty", item.total_qty ? String(item.total_qty) : "");
      if (boqId) {
        row.boq_id = boqId;
        row = setSampleItemFieldValue(row, "boq_id", boqId);
      }
      if (rowBoqKey) {
        row = setSampleItemFieldValue(row, "boq_key", rowBoqKey);
      }
      if (boqIssuedQty !== "") {
        row.boq_issued_qty = String(item.total_qty || boqIssuedQty);
        row = setSampleItemFieldValue(row, "boq_issued_qty", String(item.total_qty || boqIssuedQty));
      }
      row = setSampleItemFieldValue(
        row,
        "selected_qty",
        isBoqRow
          ? String(
              toFiniteNumber(getSampleItemFieldValue(row, "boq_base_qty")) ||
                toFiniteNumber(getSampleItemFieldValue(row, "selected_qty")) ||
                item.qty_per_flat ||
                0,
            )
          : item.total_qty
            ? String(item.total_qty)
            : "",
      );
      row = setSampleItemFieldValue(row, "qty", item.total_qty ? String(item.total_qty) : "");
      row = setSampleItemFieldValue(row, "amount", item.total_amount ? String(item.total_amount) : "");
      return row;
    });
  };

  const getBoqAvailableQty = (boqItem) => {
    const remainingQty = toFiniteNumber(boqItem?.remaining_quantity);
    if (remainingQty != null) return remainingQty;
    const derived = deriveBoqFields(boqItem);
    const raw = String(derived?.qty ?? "").replace(/,/g, "").trim();
    const num = Number(raw);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, num);
  };

  const readActiveBoqClient = (projectId) => {
    if (typeof window === "undefined") return "";
    const pid = String(projectId || "").trim();
    if (!pid) return "";
    try {
      return (localStorage.getItem(`boqClient:${pid}`) || "").trim().toLowerCase();
    } catch {
      return "";
    }
  };

  const matchesBoqClient = (item, client) => {
    const c = String(client || "").toLowerCase();
    if (!c) return true;
    const derived = deriveBoqFields(item);
    const explicit = String(derived?.client || "").trim().toLowerCase();
    if (explicit && explicit === c) return true;

    const itemNo = String(derived?.item_no || derived?.item_code || "").trim();
    const hasHsn = String(derived?.hsn || "").trim() !== "";
    const hasSac = String(derived?.sac_code || "").trim() !== "";
    const isLodhaNo = /^\d+(\.\d+){1,3}$/.test(itemNo);
    const isHiraNo = /^\(\d+\)$/.test(itemNo);
    const hasAnySignal = hasHsn || hasSac || isLodhaNo || isHiraNo;

    if (c === "lodha") {
      if (hasHsn || isLodhaNo) return true;
      if (!hasAnySignal) return true;
      if (hasSac || isHiraNo) return false;
      return true;
    }
    if (c === "hiranandani") {
      if (hasSac || isHiraNo) return true;
      if (!hasAnySignal) return true;
      if (hasHsn || isLodhaNo) return false;
      return true;
    }
    return true;
  };

  const linkedSamplesStorageKey = (projectId) => `linked_sample_ids_${String(projectId || "").trim()}`;

  const readLinkedSampleIdsFromStorage = (projectId) => {
    if (typeof window === "undefined") return [];
    const pid = String(projectId || "").trim();
    if (!pid) return [];
    try {
      const raw = localStorage.getItem(linkedSamplesStorageKey(pid));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const persistLinkedSampleId = (projectId, sampleId) => {
    if (typeof window === "undefined") return;
    const pid = String(projectId || "").trim();
    const sid = String(sampleId || "").trim();
    if (!pid || !sid) return;
    const prev = readLinkedSampleIdsFromStorage(pid);
    const next = Array.from(new Set([...prev, sid]));
    try {
      localStorage.setItem(linkedSamplesStorageKey(pid), JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const normalizeInventory = (item = {}) => ({
    inventory_id: item.inventory_id || item.id,
    project_id: item.project_id,
    brand: item.brand || "",
    name: item.name || "",
    quantity: Number(item.current_quantity ?? item.quantity) || 0,
    price: Number(item.price) || 0,
    stockin: Boolean(item.stockin),
    billing: Boolean(item.billing),
  });

  const refreshProjectSamples = async () => {
    const pid = getSelectedProjectId();
    if (!pid) {
      setServerSamples([]);
      return [];
    }
    const res = await api.getSamplesByProject(pid);
    if (!res.success) {
      setServerSamples([]);
      return [];
    }
    const arr = Array.isArray(res.data) ? res.data : [];
    setServerSamples(arr);
    arr.forEach((sample) => {
      const sid = sample?.sample_id || sample?.id;
      if (!sid) return;
    });
    setLinkedSampleIds((prev) => {
      const stored = readLinkedSampleIdsFromStorage(pid);
      const next = new Set([...(prev || []), ...stored]);
      arr.forEach((sample) => {
        const sid = sample?.sample_id || sample?.id;
        if (!sid) return;
        if (sampleHasInventoryLinks(sample)) next.add(String(sid));
      });
      return next;
    });
    return arr;
  };

  const parseMaybeArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object") {
          const nested = parsed.items || parsed.item_description || parsed.rows || parsed.data;
          return Array.isArray(nested) ? nested : [];
        }
        return [];
      } catch {
        return [];
      }
    }
    if (value && typeof value === "object") {
      const candidates = [
        value.items,
        value.item_description,
        value.item_descriptions,
        value.data,
        value.rows,
      ];
      for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
        if (typeof candidate === "string") {
          try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === "object") {
              const nested = parsed.items || parsed.item_description || parsed.rows || parsed.data;
              if (Array.isArray(nested)) return nested;
            }
          } catch {
            // ignore
          }
        }
      }
    }
    return [];
  };

  const sampleHasInventoryLinks = (sample) => {
    const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const items = parseMaybeArray(sample?.item_description || sample?.items || sample?.item_descriptions);
    if (!Array.isArray(items)) return false;
    return items.some((item) => {
      const directInventoryId =
        item?.inventory_id ??
        item?.inventoryId ??
        item?.inventoryID ??
        item?.inventory?.inventory_id ??
        item?.inventory?.id;
      if (directInventoryId) return true;
      const fields = parseMaybeArray(item?.add_fields);
      if (!Array.isArray(fields)) return false;
      return fields.some((field) => {
        const key = normalizeKey(field?.key);
        return key === "inventoryid" || key === "inventory_id";
      });
    });
  };

  const handleLinkSampleInventory = async (sample) => {
    const sampleId = sample?.sample_id || sample?.id;
    if (!sampleId) return;
    setLinkingSampleId(sampleId);
    try {
      const res = await api.autoMatchSampleInventory(sampleId);
      if (!res.success) {
        toast({
          title: "Linking failed",
          description: res.error || "Could not link inventory items.",
          variant: "destructive",
        });
        return;
      }
      // Hide the action immediately even if the backend takes time to reflect the link.
      setLinkedSampleIds((prev) => {
        const next = new Set(prev);
        next.add(String(sampleId));
        return next;
      });
      persistLinkedSampleId(getSelectedProjectId(), sampleId);
      toast({ title: "Inventory linked successfully", description: "Review the matches." });
      await refreshProjectSamples();
    } catch (error) {
      toast({
        title: "Linking failed",
        description: error?.message || "Could not link inventory items.",
        variant: "destructive",
      });
    } finally {
      setLinkingSampleId(null);
    }
  };

  useEffect(() => {
    const pid = getSelectedProjectId();
    if (!pid) {
      setLinkedSampleIds(new Set());
      return;
    }
    const stored = readLinkedSampleIdsFromStorage(pid);
    setLinkedSampleIds(new Set(stored));
  }, [selectedProject]);

  const refreshProjectBoqItems = async () => {
    const pid = getSelectedProjectId();
    if (!pid) {
      setProjectBoqItems([]);
      return [];
    }

    let client = readActiveBoqClient(pid);

    // Fetch raw BOQ rows so the picker shows items exactly as stored on the server.
    const res = await api.getBOQsByProject(pid);
    if (!res.success) {
      setProjectBoqItems([]);
      return [];
    }

    const payload = res.data || {};
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.boqs)
        ? payload.boqs
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

    if (!client) {
      const derivedAll = items.map(deriveBoqFields);
      const hasLodhaSignal =
        derivedAll.some((it) => String(it.hsn || "").trim()) ||
        derivedAll.some((it) => /^\d+(\.\d+){1,3}$/.test(String(it.item_no || it.item_code || "").trim()));
      const hasHiraSignal =
        derivedAll.some((it) => String(it.sac_code || "").trim()) ||
        derivedAll.some((it) => /^\(\d+\)$/.test(String(it.item_no || it.item_code || "").trim()));
      if (hasHiraSignal && !hasLodhaSignal) client = "hiranandani";
      else if (hasLodhaSignal && !hasHiraSignal) client = "lodha";
    }

    setActiveBoqClient(client);
    const arr = items.filter((it) => matchesBoqClient(it, client));
    const rowsWithUsage = await Promise.all(
      arr.map(async (item) => {
        const id = item?.boq_id ?? item?.id;
        if (id == null || id === "") return item;
        try {
          const detailRes = await api.getBOQById(id);
          if (detailRes?.success && detailRes.data) {
            return { ...item, ...detailRes.data };
          }
        } catch {
          // fall back to the project payload
        }
        return item;
      }),
    );
    setProjectBoqItems(rowsWithUsage);
    return rowsWithUsage;
  };

  useEffect(() => {
    const load = async () => {
      setLoadingServer(true);
      try {
        await refreshProjectSamples();
      } catch {
        setServerSamples([]);
      } finally {
        setLoadingServer(false);
      }
    };
    load();
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    const projectFloorsRaw =
      selectedProject?.floors ??
      selectedProject?.floor ??
      selectedProject?.no_of_floors ??
      selectedProject?.total_floors ??
      selectedProject?.floor_count ??
      "";
    const projectFloors = projectFloorsRaw == null ? "" : String(projectFloorsRaw).trim();
    if (!projectFloors) return;
    setFloorCount((prev) => (prev ? prev : projectFloors));
  }, [selectedProject]);

  useEffect(() => {
    if (!showCreateForm) return;
    // Prefill commonly repeated fields from the selected project when opening the form.
    if (selectedProject) {
      const projectBuilding = String(
        selectedProject?.building_name ||
          selectedProject?.project_name ||
          selectedProject?.name ||
          ""
      ).trim();
      const projectSite = String(
        selectedProject?.site_name ||
          selectedProject?.location ||
          ""
      ).trim();
      const projectFlatsRaw =
        selectedProject?.flats ??
        selectedProject?.number_of_flats ??
        selectedProject?.numberOfFlats ??
        selectedProject?.flat_count ??
        selectedProject?.flatNo ??
        "";
      const projectFlats = projectFlatsRaw == null ? "" : String(projectFlatsRaw).trim();
      const projectFloorsRaw =
        selectedProject?.floors ??
        selectedProject?.floor ??
        selectedProject?.no_of_floors ??
        selectedProject?.total_floors ??
        selectedProject?.floor_count ??
        "";
      const projectFloors = projectFloorsRaw == null ? "" : String(projectFloorsRaw).trim();
      setCreateForm((prev) => ({
        ...prev,
        building_name: prev.building_name || projectBuilding,
        site_name: prev.site_name || projectSite,
        flats: prev.flats || projectFlats,
        location: {
          ...prev.location,
          floor: prev.location?.floor || projectFloors,
          flat_no: prev.location?.flat_no || projectFlats,
        },
      }));
    }
    const load = async () => {
      setLoadingProjectBoqItems(true);
      try {
        await refreshProjectBoqItems();
      } finally {
        setLoadingProjectBoqItems(false);
      }
    };
    load();
  }, [showCreateForm, selectedProject]);


  const saveCreate = async () => {
    if (savingSample) return;
    const pid = selectedProject?.project_id || selectedProject?.id;
    if (!pid) {
      toast({ title: "Select project", description: "Choose a project first.", variant: "destructive" });
      return;
    }

    const flatCount = getFlatCount();
    const floorMultiplier = getFloorCount();
    if (!flatCount || !floorMultiplier) {
      toast({
        title: "Missing values",
        description: "Please enter both flats and floor values before saving the sample.",
        variant: "destructive",
      });
      return;
    }

    const savedItems = buildSavedSampleItems(createForm.item_description);

    const invalidInventory = (savedItems || [])
      .map((item, index) => {
        const inventoryId = item?.inventory_id ? Number(item.inventory_id) : null;
        if (!inventoryId || !Number.isFinite(inventoryId)) return null;
        const status = inventoryQtyStatus?.[index];
        if (!status || status.valid !== false) return null;
        return { index, inventoryId, ...status };
      })
      .filter(Boolean);

    if (invalidInventory.length > 0) {
      const first = invalidInventory[0];
      toast({
        title: "Validation failed",
        description: `Row ${first.index + 1}: requested qty (${first.requestedQty}) exceeds available (${first.availableQty}).`,
        variant: "destructive",
      });
      return;
    }

    setSavingSample(true);
    try {
      const selectedFilePath = createForm.sample_file || "";
      const nextAddFields = [
        ...(Array.isArray(createForm.add_fields)
          ? createForm.add_fields.filter((field) => String(field?.key || "").trim() !== "sample_client")
          : []),
        ...(activeBoqClient ? [{ key: "sample_client", value: activeBoqClient }] : []),
      ];
      const basePayload = {
        sample_id: createForm.sample_id,
        project_id: pid,
        building_name: createForm.building_name,
        site_name: createForm.site_name,
        work_done: createForm.work_done,
        sample_file: selectedFilePath,
        flats: String(flatCount),
        flat_no: String(flatCount),
        location: {
          ...createForm.location,
          floor: String(floorMultiplier),
          flat_no: String(flatCount),
        },
        item_description: savedItems,
        // Some backend deployments expect `items` instead of `item_description`.
        items: savedItems,
        add_fields: nextAddFields
      };

      const res = await api.createSample(basePayload);
      if (res.success) {
        const created = res.data || {};
        const createdId = getSampleApiId(created);
        if (createdId && selectedFilePath && !created.sample_file) {
          try {
            await api.updateSample(createdId, { sample_file: selectedFilePath });
          } catch {
            // Non-blocking: user can still attach from the table actions.
          }
        }

        // After successful sample creation, deduct BOQ quantities for any BOQ-derived rows.
        try {
          const deductRes = await syncSampleBoqQuantities(api, pid, [], savedItems);
          if ((deductRes?.data?.updated || 0) > 0) {
            await refreshProjectBoqItems();
          }
          if (!deductRes?.success) {
            toast({
              title: "Sample created, BOQ not updated",
              description: deductRes?.error || `Could not deduct BOQ quantities${(deductRes?.data?.unmatched || 0) > 0 ? " for one or more rows." : "."}`,
              variant: "destructive",
            });
          } else if ((deductRes?.data?.failed || 0) > 0) {
            toast({
              title: "Sample created with partial BOQ updates",
              description: `${deductRes.data.updated || 0} updated, ${deductRes.data.failed} failed.`,
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Sample created, BOQ not updated",
            description: error?.message || "Could not deduct BOQ quantities.",
            variant: "destructive",
          });
        }

        clearBoqReservationsForProject(pid);
        await refreshProjectSamples();
        setCreateForm({
          sample_id: "",
          building_name: "",
          site_name: "",
          work_done: "",
          sample_file: "",
          flats: "",
          location: { floor: "", flat_no: "", block: "", wing: "", coordinates: "" },
          item_description: [],
          add_fields: []
        });
        setInventoryQtyStatus({});
        toast({ title: "Created", description: "Sample created" });
        if (isCreateRoute) {
          navigate(`/${pid}/samples`);
        } else {
          setShowCreateForm(false);
        }
      } else {
        toast({
          title: isInsufficientStockError(res.error) ? "Insufficient stock" : "Create failed",
          description: res.error || "Error",
          variant: "destructive",
        });
      }
    } finally {
      setSavingSample(false);
    }
  };

  const removeSample = async (sample) => {
    const id = sample?.sample_id ?? sample?.id;
    const res = await api.deleteSample(id);
    if (res.success) {
      await refreshProjectSamples();
      toast({ title: "Deleted", description: "Sample deleted" });
    } else {
      toast({ title: "Delete failed", description: res.error || "Error", variant: "destructive" });
    }
  };

  const openItemFieldDialog = (_target, rowIndex) => {
    setItemFieldRowIndex(rowIndex);
    setItemFieldKey("");
    setItemFieldValue("");
    setItemFieldDialogOpen(true);
  };

  const closeItemFieldDialog = () => {
    setItemFieldDialogOpen(false);
    setItemFieldRowIndex(null);
    setItemFieldKey("");
    setItemFieldValue("");
  };

  const addItemFieldToRow = () => {
    const key = itemFieldKey.trim();
    const value = itemFieldValue.trim();

    if (!key || !value || itemFieldRowIndex === null) {
      toast({ title: "Missing values", description: "Enter both key and value.", variant: "destructive" });
      return;
    }

    const next = [...createForm.item_description];
    const existingIndex = (next[itemFieldRowIndex].add_fields || []).findIndex(
      (field) => (field?.key || "").trim() === key
    );
    const nextFields = [...(next[itemFieldRowIndex].add_fields || [])];
    if (existingIndex >= 0) {
      nextFields[existingIndex] = { key, value };
    } else {
      nextFields.push({ key, value });
    }
    next[itemFieldRowIndex] = {
      ...next[itemFieldRowIndex],
      add_fields: nextFields
    };
    setCreateForm({ ...createForm, item_description: next });

    closeItemFieldDialog();
  };

  const removeItemFieldFromRow = (_target, rowIndex, fieldIndex) => {
    const next = [...createForm.item_description];
    next[rowIndex] = {
      ...next[rowIndex],
      add_fields: (next[rowIndex].add_fields || []).filter((_, idx) => idx !== fieldIndex)
    };
    setCreateForm({ ...createForm, item_description: next });
  };

  const hasIncompleteAdditionalFields = (fields = []) =>
    fields.some((field) => !(field.key || "").trim() || !(field.value || "").trim());

  const addAdditionalField = (_target) => {
    if (hasIncompleteAdditionalFields(createForm.add_fields)) {
      toast({
        title: "Complete existing fields",
        description: "Fill key and value before adding another additional info row.",
        variant: "destructive",
      });
      return;
    }
    setCreateForm({ ...createForm, add_fields: [...createForm.add_fields, { key: "", value: "" }] });
  };

  const removeAdditionalField = (_target, index) => {
    setCreateForm({ ...createForm, add_fields: createForm.add_fields.filter((_, idx) => idx !== index) });
  };

  const openPreview = (sample) => {
    const id = sample?.sample_id ?? sample?.id;
    navigate(`preview/${id}`);
  };

  const handleDownloadSample = async (sample) => {
    try {
      const sampleId = sample?.sample_id ?? sample?.id;
      if (!sampleId) {
        throw new Error("Missing sample id");
      }

      const result = await api.getSampleById(sampleId);
      if (!result.success) {
        throw new Error(result.error || "Could not load sample");
      }

      const raw = result.data;
      const loadedSample = Array.isArray(raw)
        ? raw.find((row) => String(row?.sample_id ?? row?.id ?? "") === String(sampleId)) || raw[0]
        : raw?.sample || raw?.data || raw;
      if (!loadedSample) {
        throw new Error("Sample not found");
      }

      await downloadSamplePdf(loadedSample);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error?.message || "Could not generate the sample PDF.",
        variant: "destructive",
      });
    }
  };

  const addBoqItemToSampleItems = (boqItem, selectedQty) => {
    const derived = deriveBoqFields(boqItem);
    const key = boqItemKey(boqItem);
    if (!key) return;
    const isHiranandaniClient = String(activeBoqClient || "").toLowerCase() === "hiranandani";

    const floorMultiplier = getFloorCount();
    const flatCount = getFlatCount();
    const qtyToAdd = Number(selectedQty) || 0;
    if (qtyToAdd <= 0) return;
    const rateNum = (() => {
      const cleaned = String(derived.rate ?? "").replace(/,/g, "").trim();
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    })();
    const selectedBaseAmount = rateNum && qtyToAdd ? rateNum * qtyToAdd : 0;
    const boqId = String(derived.id || "").trim();
    const boqMatchKey = getBoqExactMatchKey(boqItem) || (boqId ? `id${boqId}` : `key${String(key).trim()}`);
    const primaryCode = isHiranandaniClient
      ? String(derived.sac_code || derived.item_code || derived.code || derived.item_no || "-")
      : String(derived.item_code || derived.hsn || derived.item_no || derived.code || "-");
    const itemName = String(derived.item_no || derived.item_name || derived.itemName || derived.item_code || derived.sac_code || derived.code || "").trim();
    const itemNo = String(derived.item_no || derived.item_code || derived.sac_code || derived.code || "-");
    const nextRow = {
      _row_type: "boq",
      sr_no: String(createForm.item_description.length + 1),
      item_name: itemName,
      brand_name: "",
      description: String(derived.description || "-"),
      item_code: primaryCode,
      code: primaryCode,
      item_no: itemNo,
      hsn: String(derived.hsn || derived.item_code || ""),
      sac_code: String(derived.sac_code || ""),
      specification: String(derived.specification || ""),
      unit: String(derived.unit || ""),
      quantity: qtyToAdd ? String(qtyToAdd) : "",
      value: selectedBaseAmount ? String(selectedBaseAmount) : "",
      inventory_id: null,
      issued_qty: qtyToAdd ? String(qtyToAdd) : null,
      boq_id: boqId,
      boq_key: String(key),
      boq_match_key: boqMatchKey,
      boq_issued_qty: qtyToAdd ? String(qtyToAdd) : null,
      add_fields: [
        { key: "boq_id", value: boqId },
        { key: "boq_key", value: String(key) },
        { key: "boq_match_key", value: boqMatchKey },
        { key: "item_code", value: primaryCode },
        { key: "item_no", value: itemNo },
        { key: "section", value: String(derived.section || "-") },
        { key: "description", value: String(derived.description || "-") },
        { key: "unit", value: String(derived.unit || "-") },
        { key: "qty", value: qtyToAdd ? String(qtyToAdd) : "" },
        // Keep BOQ qty for reference (not shown in the main table by default).
        { key: "boq_qty", value: String(derived.qty || "") },
        { key: "rate", value: String(derived.rate || "") },
        { key: "boq_base_qty", value: qtyToAdd ? String(qtyToAdd) : "" },
        { key: "boq_floor_multiplier", value: String(floorMultiplier) },
        { key: "boq_flat_multiplier", value: String(flatCount || 0) },
        { key: "boq_base_amount", value: selectedBaseAmount ? String(selectedBaseAmount) : "" },
        { key: "amount", value: selectedBaseAmount ? String(selectedBaseAmount) : "" },
        { key: "hsn", value: String(derived.hsn || derived.item_code || "") },
        { key: "sac_code", value: String(derived.sac_code || "") },
        { key: "selected_qty", value: qtyToAdd ? String(qtyToAdd) : "" },
        { key: "project_id", value: String(getSelectedProjectId() || "") },
      ],
    };

    setCreateForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? [...prev.item_description] : [];
      const existingIndex = rows.findIndex((r) => {
        const rowExactKey = getBoqExactMatchKey(r) || String(getSampleItemFieldValue(r, "boq_match_key") || "").trim();
        return rowExactKey && String(rowExactKey) === String(boqMatchKey);
      });

      if (existingIndex < 0) {
        return { ...prev, item_description: [...rows, syncSampleItemDerivedFields(nextRow, { flatCount, floorMultiplier })] };
      }

      const existing = rows[existingIndex] || {};
      const existingQty =
        toFiniteNumber(existing?.quantity) ||
        toFiniteNumber(getSampleItemFieldValue(existing, "boq_base_qty")) ||
        toFiniteNumber(getSampleItemFieldValue(existing, "selected_qty")) ||
        toFiniteNumber(getSampleItemFieldValue(existing, "qty")) ||
        0;
      const nextQty = existingQty + qtyToAdd;
      const effectiveRate =
        toFiniteNumber(getSampleItemFieldValue(existing, "rate")) ||
        toFiniteNumber(derived.rate) ||
        0;

      let merged = {
        ...existing,
        _row_type: "boq",
        item_name: String(
          getSampleItemFieldValue(existing, "item_name") ||
            existing.item_name ||
            existing.itemName ||
            derived.item_no ||
            existing.item_name ||
            existing.itemName ||
            getSamplePrimaryIdentifier(derived, activeBoqClient) ||
            ""
        ).trim(),
        description: String(existing.description || derived.description || "-"),
        item_code: String(existing.item_code || existing.code || existing.hsn || derived.sac_code || derived.item_code || derived.hsn || derived.item_no || derived.code || "-"),
        code: String(existing.code || existing.item_code || existing.hsn || derived.sac_code || derived.item_code || derived.hsn || derived.item_no || derived.code || "-"),
        item_no: String(
          (derived.item_no || derived.item_code || derived.sac_code || derived.code) ||
            existing.item_no ||
            getSampleItemFieldValue(existing, "item_no") ||
            "-"
        ),
        hsn: String(existing.hsn || derived.hsn || derived.item_code || ""),
        sac_code: String(existing.sac_code || derived.sac_code || ""),
        specification: String(existing.specification || derived.specification || ""),
        quantity: nextQty ? String(nextQty) : "",
        value: effectiveRate && nextQty ? String(effectiveRate * nextQty) : "",
        boq_id: String(getSampleItemFieldValue(existing, "boq_id") || derived.id || "").trim(),
        boq_key: String(getSampleItemFieldValue(existing, "boq_key") || key || "").trim(),
        boq_match_key: String(getSampleItemFieldValue(existing, "boq_match_key") || (derived.id ? `id${derived.id}` : `key${key}`) || "").trim(),
        boq_issued_qty: nextQty ? String(nextQty) : "",
      };
      merged = setSampleItemFieldValue(merged, "qty", nextQty ? String(nextQty) : "");
      merged = setSampleItemFieldValue(merged, "boq_base_qty", nextQty ? String(nextQty) : "");
      merged = setSampleItemFieldValue(merged, "boq_floor_multiplier", String(floorMultiplier));
      merged = setSampleItemFieldValue(merged, "boq_flat_multiplier", String(flatCount || 0));
      merged = setSampleItemFieldValue(merged, "selected_qty", nextQty ? String(nextQty) : "");
      merged = setSampleItemFieldValue(merged, "boq_base_amount", effectiveRate && nextQty ? String(effectiveRate * nextQty) : "");
      merged = setSampleItemFieldValue(merged, "amount", effectiveRate && nextQty ? String(effectiveRate * nextQty) : "");
      if (effectiveRate) merged = setSampleItemFieldValue(merged, "rate", String(effectiveRate));
      if (derived.specification) merged = setSampleItemFieldValue(merged, "specification", String(derived.specification));
      if (derived.specification) merged = setSampleItemFieldValue(merged, "spec", String(derived.specification));
      merged = setSampleItemFieldValue(merged, "boq_id", String(getSampleItemFieldValue(existing, "boq_id") || derived.id || "").trim());
      merged = setSampleItemFieldValue(merged, "boq_key", String(getSampleItemFieldValue(existing, "boq_key") || key || "").trim());
      merged = setSampleItemFieldValue(merged, "boq_match_key", String(getSampleItemFieldValue(existing, "boq_match_key") || (derived.id ? `id${derived.id}` : `key${key}`) || "").trim());
      merged = setSampleItemFieldValue(merged, "boq_issued_qty", nextQty ? String(nextQty) : "");
      merged = setSampleItemFieldValue(
        merged,
        "item_no",
        String(
          (derived.item_no || derived.item_code || derived.sac_code || derived.code) ||
            existing.item_no ||
            getSampleItemFieldValue(existing, "item_no") ||
            "-"
        )
      );
        merged = setSampleItemFieldValue(
        merged,
        "item_name",
        String(
          getSampleItemFieldValue(existing, "item_name") ||
            getSampleItemFieldValue(existing, "item_name") ||
            getSampleItemFieldValue(existing, "itemName") ||
            derived.item_no ||
            getSamplePrimaryIdentifier(derived, activeBoqClient) ||
            ""
        ).trim()
      );

      rows[existingIndex] = syncSampleItemDerivedFields(merged, { flatCount, floorMultiplier });
      return { ...prev, item_description: rows };
    });
  };

  useEffect(() => {
    const floorMultiplier = getFloorCount();
    const flatCount = getFlatCount();
    setCreateForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? prev.item_description : [];
      if (rows.length === 0) return prev;

      let changed = false;
      const nextRows = rows.map((row) => {
        const nextRow = syncSampleItemDerivedFields(row, { flatCount, floorMultiplier });
        if (JSON.stringify(nextRow) !== JSON.stringify(row)) changed = true;
        return nextRow;
      });

      return changed ? { ...prev, item_description: nextRows } : prev;
    });
  }, [floorCount, createForm.flats]);

  const addManualSampleItemRow = () => {
    setCreateForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? prev.item_description : [];
      return {
        ...prev,
        item_description: [
          ...reindexSampleRows(rows),
          createBlankManualSampleItemRow(rows.length + 1),
        ],
      };
    });
  };

  const createBlankManualSampleItemRow = (rowNumber = 1) => ({
    _row_type: "manual",
    sr_no: String(rowNumber),
    item_name: "",
    brand_name: "",
    description: "",
    specification: "",
    unit: "",
    quantity: "",
    value: "",
    inventory_id: null,
    issued_qty: null,
  });

  const insertManualSampleItemRowAt = (index) => {
    setCreateForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? [...prev.item_description] : [];
      rows.splice(index + 1, 0, createBlankManualSampleItemRow(index + 2));
      return { ...prev, item_description: reindexSampleRows(rows) };
    });
    setInventoryQtyStatus((prev) => {
      const mapped = {};
      Object.entries(prev || {}).forEach(([key, value]) => {
        const idx = Number(key);
        if (!Number.isInteger(idx)) return;
        mapped[idx > index ? idx + 1 : idx] = value;
      });
      return mapped;
    });
  };

  const updateSampleItemRow = (index, patch) => {
    setCreateForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? [...prev.item_description] : [];
      const existing = rows[index] || {};
      rows[index] = syncSampleItemDerivedFields({ ...existing, ...patch });
      return { ...prev, item_description: rows };
    });
  };

  const updateManualSampleItemRow = updateSampleItemRow;

  const removeSampleItemRowAt = (index) => {
    setCreateForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? prev.item_description : [];
      return { ...prev, item_description: reindexSampleRows(rows.filter((_, i) => i !== index)) };
    });
    setInventoryQtyStatus((prev) => {
      const mapped = {};
      Object.entries(prev || {}).forEach(([key, value]) => {
        const idx = Number(key);
        if (!Number.isInteger(idx)) return;
        if (idx === index) return;
        mapped[idx > index ? idx - 1 : idx] = value;
      });
      return mapped;
    });
  };

  const openBoqQtySelector = (boqItem) => {
    const key = boqItemKey(boqItem);
    if (!key) return;
    setPendingBoqQty((prev) => {
      const existing = Number(prev[key]) || 1;
      const clamped = Math.max(1, existing);
      return { ...prev, [key]: String(clamped) };
    });
  };

  const adjustPendingBoqQty = (boqItem, delta) => {
    const key = boqItemKey(boqItem);
    if (!key) return;
    setPendingBoqQty((prev) => {
      const current = Number(prev[key]) || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [key]: String(next) };
    });
  };

  const setPendingBoqQtyValue = (boqItem, rawValue) => {
    const key = boqItemKey(boqItem);
    if (!key) return;
    const cleaned = String(rawValue || "").replace(/[^\d]/g, "");
    if (!cleaned) {
      setPendingBoqQty((prev) => ({ ...prev, [key]: "" }));
      return;
    }
    const numeric = Math.max(1, Number(cleaned) || 1);
    setPendingBoqQty((prev) => ({ ...prev, [key]: String(numeric) }));
  };

  const normalizePendingBoqQty = (boqItem) => {
    const key = boqItemKey(boqItem);
    if (!key) return;
    setPendingBoqQty((prev) => {
      const current = Number(prev[key]) || 1;
      const next = Math.max(1, current);
      return { ...prev, [key]: String(next) };
    });
  };

  const closeBoqQtySelector = (key) => {
    setPendingBoqQty((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const confirmAddBoqWithQuantity = async (boqItem) => {
    const key = boqItemKey(boqItem);
    const selectedQty = Number(pendingBoqQty[key]) || 0;

    if (!key || selectedQty <= 0) {
      toast({ title: "Invalid quantity", description: "Select a valid quantity.", variant: "destructive" });
      return;
    }

    setAddingBoqKey(key);
    try {
      addBoqItemToSampleItems(boqItem, selectedQty);
      closeBoqQtySelector(key);
      toast({
        title: "Item added",
        description: `Added ${selectedQty}.`,
      });
    } finally {
      setAddingBoqKey(null);
    }
  };

  const filteredProjectBoqItems = useMemo(() => {
    const query = boqSearch.trim().toLowerCase();
    const filtered = !query ? projectBoqItems : projectBoqItems.filter((item) => (
      String(deriveBoqFields(item).item_no || "").toLowerCase().includes(query)
      || String(deriveBoqFields(item).item_code || "").toLowerCase().includes(query)
      || String(deriveBoqFields(item).description || "").toLowerCase().includes(query)
      || String(deriveBoqFields(item).section || "").toLowerCase().includes(query)
      || String(deriveBoqFields(item).unit || "").toLowerCase().includes(query)
    ));
    if (activeBoqClient === "hiranandani") return [...filtered].sort(compareHiranandaniBoqOrder);
    return filtered;
  }, [projectBoqItems, boqSearch, activeBoqClient, compareHiranandaniBoqOrder, deriveBoqFields]);

  const inventoryTableKeys = useMemo(() => {
    // Show only the fields the user cares about in the "items added" table.
    // Order: Item Name -> Description -> Item Code -> Specification -> Brand -> Unit -> Qty
    const preferredOrder = [
      "item_name",
      "description",
      "item_code",
      "specification",
      "brand_name",
      "unit",
      "qty",
    ];
    const dynamicKeys = Array.from(
      new Set(
        createForm.item_description.flatMap((row) =>
          (row.add_fields || [])
            .map((field) => (field?.key || "").trim())
            .filter(Boolean)
        )
      )
    );
    if (createForm.item_description.length > 0) {
      ["item_name", "description", "item_code", "specification", "brand_name", "unit", "qty"].forEach((k) => {
        if (!dynamicKeys.includes(k)) dynamicKeys.push(k);
      });
    }
    const ordered = preferredOrder.filter((key) => dynamicKeys.includes(key));
    return ordered;
  }, [createForm.item_description]);

  const sampleItemNameLabel = getSamplePrimaryIdentifierLabel(activeBoqClient);

  const boqReservedQtyByKey = useMemo(() => {
    const rows = Array.isArray(createForm.item_description) ? createForm.item_description : [];
    const normalize = (v) => String(v || "").trim().toLowerCase();
    const normalizeEmptyLike = (v) => {
      const t = String(v ?? "").trim();
      if (!t) return "";
      const n = t.toLowerCase();
      if (n === "-" || n === "_" || n === "na" || n === "n/a" || n === "null" || n === "undefined") return "";
      return t;
    };
    const fieldVal = (row, key) =>
      (row?.add_fields || []).find((f) => String(f?.key || "").trim() === key)?.value ?? "";

    const deriveReserveKeyFromFields = (row) => {
      const boqMatchKey = normalize(normalizeEmptyLike(fieldVal(row, "boq_match_key") || row?.boq_match_key || row?.boqMatchKey));
      const boqId = normalize(normalizeEmptyLike(fieldVal(row, "boq_id")));
      const boqKey = normalize(normalizeEmptyLike(fieldVal(row, "boq_key") || row?.boq_key || row?.boqKey));
      const itemNo = normalize(normalizeEmptyLike(fieldVal(row, "item_no")));
      const itemCode = normalize(normalizeEmptyLike(fieldVal(row, "item_code")));
      const section = normalize(normalizeEmptyLike(fieldVal(row, "section")));
      const description = normalize(normalizeEmptyLike(fieldVal(row, "description")));
      return boqMatchKey || (boqId ? `id${boqId}` : "") || (boqKey ? `key${boqKey}` : "") || itemNo || itemCode || (description ? `${description}__${section}` : "");
    };

    const map = new Map();
    for (const row of rows) {
      const selectedQtyRaw = fieldVal(row, "selected_qty");
      const selectedQty = Number(String(selectedQtyRaw || "").replace(/,/g, "").trim()) || 0;
      if (selectedQty <= 0) continue;
      const key = deriveReserveKeyFromFields(row);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + selectedQty);
    }
    return map;
  }, [createForm.item_description]);

  const clearBoqReservationsForProject = (projectId) => {
    const pid = String(projectId || "").trim();
    if (!pid) return;
    try {
      localStorage.removeItem(`boqReservedQty:${pid}`);
    } catch {
      // ignore storage failures
    }
  };

  useEffect(() => {
    const pid = getSelectedProjectId();
    if (!pid) return;
    // Persist reserved BOQ quantities so BOQ screen can show remaining qty while drafting a sample.
    // Note: this is client-side reservation only; server-side deduction happens on sample save.
    try {
      const key = `boqReservedQty:${String(pid)}`;
      const entries = Array.from(boqReservedQtyByKey.entries()).map(([k, v]) => [k, v]);
      if (entries.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(entries));
    } catch {
      // ignore storage failures
    }
  }, [boqReservedQtyByKey, selectedProject, showCreateForm]);

  const getBoqRemainingQty = (boqItem) => {
    const baseQty = getBoqAvailableQty(boqItem);
    const derived = deriveBoqFields(boqItem);
    const key = getBoqExactMatchKey(boqItem) || String(derived?.id || derived?.item_no || derived?.item_code || "").trim().toLowerCase();
    const reserved = key ? Number(boqReservedQtyByKey.get(key) || 0) : 0;
    return baseQty - reserved;
  };


  const attachFileToSample = async (sample, path) => {
    const id = getSampleApiId(sample);
    const res = await api.updateSample(id, { sample_file: path });
    if (res.success) {
      await refreshProjectSamples();
      toast({ title: "Attached", description: "Document attached to sample" });
    } else {
      toast({ title: "Attach failed", description: res.error || "Error", variant: "destructive" });
    }
  };

  const uploadSampleFiles = async (files) => {
    if (!files.length) return;
    const res = await api.uploadSampleFiles(files);
    const paths = res.success ? extractUploadedFilePaths(res.data) : [];
    if (paths.length > 0) {
      setUploadFilePaths((prev) => Array.from(new Set([...prev, ...paths])));
      setCreateForm((prev) => ({
        ...prev,
        sample_file: prev.sample_file || paths[0] || "",
      }));
      toast({ title: "Uploaded", description: `${paths.length} file(s) uploaded` });
    } else {
      toast({ title: "Upload failed", description: res.error || "Error", variant: "destructive" });
    }
  };

  const handleSampleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    await uploadSampleFiles(files);
    e.target.value = "";
  };

  const handleAttachmentDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAttachmentDragActive(false);
    const files = Array.from(e.dataTransfer?.files || []);
    await uploadSampleFiles(files);
  };

  const handleFloorPlanUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setFloorPlanFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFloorPlanPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // Process PDF to extract diagrams and values
        setProcessingPdf(true);
        setExtractionProgress({ current: 0, total: 0, message: 'Loading PDF...' });
        try {
          // Validate file size (max 50MB)
          if (file.size > 50 * 1024 * 1024) {
            throw new Error('PDF file is too large (max 50MB)');
          }
          
          // Extract images from PDF (optimized: lower scale, fewer pages, parallel processing)
          setExtractionProgress({ current: 0, total: 1, message: 'Extracting diagrams...' });
          let images = [];
          try {
            images = await extractImagesFromPdf(file, { 
              scale: 1.5, // Reduced from 2 for faster processing
              maxPages: 30, // Reduced from 50
              batchSize: 3, // Process 3 pages in parallel
              quality: 0.85 // JPEG quality for smaller files
            });
            setExtractedDiagrams(images);
            console.log(`Extracted ${images.length} diagram pages`);
          } catch (imgError) {
            console.warn('Image extraction failed, continuing with text extraction:', imgError);
            // Continue even if image extraction fails
          }
          
          setExtractionProgress({ current: 1, total: 2, message: 'Extracting text and values...' });
          
          // Extract text and parse CPVC data (optimized: limit pages, parallel processing)
          let text = '';
          try {
            text = await extractTextFromPdf(file, { 
              fullDocument: true, 
              preserveLines: true,
              maxPages: 50, // Limit to 50 pages instead of 150
              batchSize: 5 // Process 5 pages in parallel
            });
            console.log(`Extracted ${text.length} characters of text`);
          } catch (textError) {
            console.error('Text extraction failed:', textError);
            throw new Error(`Text extraction failed: ${textError.message}`);
          }
          
          const cpvcData = extractCPVCData(text);
          setExtractedValues(cpvcData.items);
          console.log(`Parsed ${cpvcData.items.length} CPVC items from text`);
          
          // Update floor count if found in PDF
          if (cpvcData.metadata.totalFloors && !floorCount) {
            setFloorCount(cpvcData.metadata.totalFloors);
          }
          
          // Optionally auto-populate samples from extracted data
          if (cpvcData.items.length > 0) {
            const totalFloors = getFloorCount(floorCount) || getFloorCount(cpvcData.metadata.totalFloors) || 1;
            const mappedSamples = mapCPVCItemsToSamples(cpvcData.items, totalFloors);
            if (mappedSamples.length > 0) {
              // Replace mock samples with extracted ones, or merge if we want to keep existing
              const shouldReplace = samples.length === MOCK_SAMPLES.length && 
                                    samples.every((s, i) => s.id === MOCK_SAMPLES[i]?.id);
              
              if (shouldReplace) {
                setSamples(mappedSamples);
              } else {
                // Merge with existing, avoiding duplicates
                const existingIds = new Set(samples.map(s => s.id));
                const newSamples = mappedSamples.filter(s => !existingIds.has(s.id));
                setSamples([...samples, ...newSamples]);
              }
              
              toast({
                title: "CPVC Data Extracted",
                description: `Extracted ${mappedSamples.length} items from CPVC PDF`,
              });
            } else {
              toast({
                title: "No Items Found",
                description: "Could not extract items from CPVC PDF. Please check the PDF format.",
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "No Items Extracted",
              description: "No CPVC items found in the PDF. The PDF might not contain extractable data.",
              variant: "destructive",
            });
          }
          
          // Set first page as preview - ensure it's set properly
          if (images.length > 0) {
            const firstImage = images[0].imageDataUrl;
            setFloorPlanPreview(firstImage);
            // Force update by setting a small delay to ensure state updates
            setTimeout(() => {
              if (floorPlanPreview !== firstImage) {
                setFloorPlanPreview(firstImage);
              }
            }, 100);
          } else {
            // If no images extracted, show a placeholder or the PDF file icon
            setFloorPlanPreview(null);
          }
          
          // Log extraction results for debugging
          console.log('CPVC Extraction Results:', {
            diagrams: images.length,
            items: cpvcData.items.length,
            metadata: cpvcData.metadata,
            sampleItems: (Array.isArray(cpvcData.items) ? cpvcData.items.length : 0)
          });
          
          setExtractionProgress({ current: 2, total: 2, message: 'Complete!' });
        } catch (error) {
          console.error('Error processing CPVC PDF:', error);
          const errorMessage = error.message || 'Unknown error occurred';
          toast({
            title: "Extraction Error",
            description: `Failed to extract data from CPVC PDF: ${errorMessage}. Please check if the PDF is valid and not corrupted.`,
            variant: "destructive",
          });
          
          // Still set the file so user can proceed
          if (extractedDiagrams.length === 0) {
            setFloorPlanPreview(null);
          }
        } finally {
          setProcessingPdf(false);
          setTimeout(() => setExtractionProgress({ current: 0, total: 0, message: '' }), 1000);
        }
      } else {
        setFloorPlanPreview(null);
      }
    }
  };

  const handleSuspendedWorkUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSuspendedWorkFile(file);
      // Process suspended work PDF
      setProcessingSuspendedPdf(true);
      setSuspendedExtractionProgress({ current: 0, total: 0, message: 'Loading PDF...' });
      try {
        // Validate file size
        if (file.size > 50 * 1024 * 1024) {
          throw new Error('PDF file is too large (max 50MB)');
        }
        
        // Extract images from PDF (optimized: lower scale, fewer pages, parallel processing)
        setSuspendedExtractionProgress({ current: 0, total: 1, message: 'Extracting diagrams...' });
        let images = [];
        try {
          images = await extractImagesFromPdf(file, { 
            scale: 1.5, // Reduced from 2 for faster processing
            maxPages: 30, // Reduced from 50
            batchSize: 3, // Process 3 pages in parallel
            quality: 0.85 // JPEG quality for smaller files
          });
          setSuspendedDiagrams(images);
          console.log(`Extracted ${images.length} diagram pages from suspended work PDF`);
        } catch (imgError) {
          console.warn('Image extraction failed, continuing with text extraction:', imgError);
          // Continue even if image extraction fails
        }
        
        setSuspendedExtractionProgress({ current: 1, total: 2, message: 'Extracting text and values...' });
        
        // Extract text and parse suspended work data (optimized: limit pages, parallel processing)
        let text = '';
        try {
          text = await extractTextFromPdf(file, { 
            fullDocument: true, 
            preserveLines: true,
            maxPages: 50, // Limit to 50 pages instead of 150
            batchSize: 5 // Process 5 pages in parallel
          });
          console.log(`Extracted ${text.length} characters of text from suspended work PDF`);
        } catch (textError) {
          console.error('Text extraction failed:', textError);
          throw new Error(`Text extraction failed: ${textError.message}`);
        }
        
        const suspendedData = extractSuspendedWorkData(text);
        setSuspendedValues(suspendedData.items);
        console.log(`Parsed ${suspendedData.items.length} suspended work items from text`);
        
        // Update floor count if found in PDF
        if (suspendedData.metadata.totalFloors && !floorCount) {
          setFloorCount(suspendedData.metadata.totalFloors);
        }
        
        // Merge suspended work items with existing samples
        if (suspendedData.items.length > 0) {
          const totalFloors = getFloorCount(floorCount) || getFloorCount(suspendedData.metadata.totalFloors) || 1;
          const mappedSuspended = mapSuspendedWorkItemsToSamples(suspendedData.items, totalFloors);
          
          if (mappedSuspended.length > 0) {
            // Combine with existing samples (avoid duplicates)
            const existingIds = new Set(samples.map(s => s.id));
            const newSuspended = mappedSuspended.filter(s => !existingIds.has(s.id));
            setSamples([...samples, ...newSuspended]);
            toast({
              title: "Suspended Work Data Extracted",
              description: `Extracted ${mappedSuspended.length} items from suspended work PDF`,
            });
          } else {
            toast({
              title: "No Items Found",
              description: "Could not extract items from suspended work PDF. Please check the PDF format.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "No Items Extracted",
            description: "No suspended work items found in the PDF. The PDF might not contain extractable data.",
            variant: "destructive",
          });
        }
        
        setSuspendedExtractionProgress({ current: 2, total: 2, message: 'Complete!' });
        
        // Log extraction results for debugging
        console.log('Suspended Work Extraction Results:', {
          diagrams: images.length,
          items: suspendedData.items.length,
          metadata: suspendedData.metadata,
          sampleItems: (Array.isArray(suspendedData.items) ? suspendedData.items.length : 0)
        });
      } catch (error) {
        console.error('Error processing suspended work PDF:', error);
        const errorMessage = error.message || 'Unknown error occurred';
        toast({
          title: "Extraction Error",
          description: `Failed to extract data from suspended work PDF: ${errorMessage}. Please check if the PDF is valid and not corrupted.`,
          variant: "destructive",
        });
      } finally {
        setProcessingSuspendedPdf(false);
        setTimeout(() => setSuspendedExtractionProgress({ current: 0, total: 0, message: '' }), 1000);
      }
    } else if (file) {
      setSuspendedWorkFile(file);
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file for suspended work",
        variant: "destructive",
      });
    }
  };

  const handleNext = () => {
    if (step === 1 && floorCount && floorPlanFile) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleCheckFloorPlan = () => {
    // Proceed if we have floor plan file (CPVC or image)
    if (floorPlanFile) {
      setIsConfigured(true);
    }
  };

  const resetConfiguration = () => {
    setIsConfigured(false);
    setStep(1);
    setFloorCount("");
    setFloorPlanFile(null);
    setSuspendedWorkFile(null);
    setFloorPlanPreview(null);
    setExtractedDiagrams([]);
    setExtractedValues([]);
    setSuspendedDiagrams([]);
    setSuspendedValues([]);
    setSamples(MOCK_SAMPLES);
    setSearchQuery("");
    setFilterType("all");
  };

  // Filter and search samples
  const filteredSamples = samples.filter(item => {
    const matchesSearch = !searchQuery || 
      item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === "all" || 
      (filterType === "cpvc" && (!item.workType || item.workType !== "Suspended")) ||
      (filterType === "suspended" && item.workType === "Suspended");
    
    return matchesSearch && matchesFilter;
  });

  // Update sample quantity
  const updateSampleQty = (id, newQty) => {
    setSamples(samples.map(item => 
      item.id === id 
        ? { ...item, perFloorQty: parseFloat(newQty) || 0 }
        : item
    ));
  };

  // Add new sample
  const addNewSample = () => {
    const newId = Math.max(...samples.map(s => s.id), 0) + 1;
    const newSample = {
      id: newId,
      item: "New Item",
      unit: "Nos",
      perFloorQty: 0,
      totalFloors: getFloorCount(floorCount) || 1,
      totalQty: 0,
      status: "Draft",
      workType: "CPVC",
    };
    setSamples([...samples, newSample]);
    toast({
      title: "Item Added",
      description: "New item added to the list",
    });
  };

  // Delete sample
  const deleteSample = (id) => {
    setSamples(samples.filter(item => item.id !== id));
    toast({
      title: "Item Deleted",
      description: "Item removed from the list",
    });
  };

  // Calculate summary statistics
  const summaryStats = {
    totalItems: samples.length,
    cpvcItems: samples.filter(s => !s.workType || s.workType !== "Suspended").length,
    suspendedItems: samples.filter(s => s.workType === "Suspended").length,
    totalQuantity: samples.reduce((sum, item) => {
      const totalFloors = getFloorCount(floorCount) || item.totalFloors;
      return sum + (item.perFloorQty * totalFloors);
    }, 0),
    lockedItems: samples.filter(s => s.status === "Locked").length,
    draftItems: samples.filter(s => s.status === "Draft").length,
  };

  const availableUploadedFiles = useMemo(() => (
    Array.from(
      new Set(
        [...uploadFilePaths, ...serverSamples.map((s) => s.sample_file)]
          .filter(Boolean)
      )
    )
  ), [uploadFilePaths, serverSamples]);

  // Export to Excel
  const handleExportToExcel = () => {
    try {
      const data = filteredSamples.map(item => ({
        'Item Name': item.item,
        'Work Type': item.workType || 'CPVC',
        'Unit': item.unit,
        'Qty Per Floor': item.perFloorQty,
        'Total Floors': getFloorCount(floorCount) || item.totalFloors,
        'Total Quantity': (item.perFloorQty * (getFloorCount(floorCount) || item.totalFloors)),
        'Status': item.status,
        'Dimensions': item.dimensions || '',
        'Specifications': item.specifications || '',
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Samples');
      XLSX.writeFile(wb, `Sample_Configuration_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Export Successful",
        description: "Sample data exported to Excel",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isConfigured) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Sample Management Setup</h1>
          <p className="text-muted-foreground">Configure floor plans, CPVC, and suspended work for your project.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className={`flex flex-col items-center p-4 border rounded-lg ${step >= 1 ? 'border-primary bg-primary/5' : 'border-muted'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>1</div>
            <span className="text-sm font-medium">Floor Plan & Details</span>
          </div>
          <div className={`flex flex-col items-center p-4 border rounded-lg ${step >= 2 ? 'border-primary bg-primary/5' : 'border-muted'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
            <span className="text-sm font-medium">Suspended Work</span>
          </div>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Step 1: Project Details</CardTitle>
                <CardDescription>Enter the number of floors and upload the floor plan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="floor-count">Number of Floors</Label>
                  <Input 
                    id="floor-count" 
                    type="number" 
                    placeholder="Enter total floors (e.g., 117)" 
                    value={floorCount}
                    onChange={(e) => setFloorCount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="floor-plan">Floor Plan (Image or PDF)</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors text-center cursor-pointer relative">
                    <Input 
                      id="floor-plan" 
                      type="file" 
                      accept="image/*,application/pdf" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFloorPlanUpload}
                    />
                    <div className="flex flex-col items-center gap-2">
                      {processingPdf ? (
                        <>
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <span className="font-medium">Processing PDF...</span>
                          <span className="text-xs text-muted-foreground">
                            {extractionProgress.message || 'Extracting diagrams and values'}
                          </span>
                          {extractionProgress.total > 0 && (
                            <div className="w-full max-w-xs mt-2">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground mt-1 block text-center">
                                {extractionProgress.current} / {extractionProgress.total}
                              </span>
                            </div>
                          )}
                        </>
                      ) : floorPlanFile ? (
                        <>
                          {floorPlanFile.type.startsWith('image/') ? <ImageIcon className="h-8 w-8 text-primary" /> : <FileText className="h-8 w-8 text-primary" />}
                          <span className="font-medium">{floorPlanFile.name}</span>
                          <span className="text-xs text-muted-foreground">{(floorPlanFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          {extractedDiagrams.length > 0 && (
                            <span className="text-xs text-green-600 mt-1">
                              {extractedDiagrams.length} diagram(s) extracted
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Drag and drop or click to upload</span>
                        </>
                      )}
                    </div>
                  </div>
                  {floorPlanPreview && !processingPdf && (
                    <div className="mt-4 border rounded-lg overflow-hidden h-48 w-full bg-muted/20 flex items-center justify-center">
                      <img 
                        src={floorPlanPreview} 
                        alt="PDF Preview" 
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                        onError={(e) => {
                          console.error('Preview image failed to load:', e);
                          setFloorPlanPreview(null);
                        }}
                      />
                    </div>
                  )}
                  {processingPdf && (
                    <div className="mt-4 border rounded-lg p-4 bg-muted/20 flex items-center justify-center h-48">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{extractionProgress.message || 'Processing...'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleNext} disabled={!floorCount || !floorPlanFile || processingPdf}>
                  Next Step <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Step 2: Suspended Work</CardTitle>
                <CardDescription>Upload the suspended work PDF (e.g., 1-4 FLR.pdf).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="suspended-work">Suspended Work PDF</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors text-center cursor-pointer relative">
                    <Input 
                      id="suspended-work" 
                      type="file" 
                      accept="application/pdf" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleSuspendedWorkUpload}
                    />
                    <div className="flex flex-col items-center gap-2">
                      {processingSuspendedPdf ? (
                        <>
                          <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          <span className="font-medium">Processing Suspended Work PDF...</span>
                          <span className="text-xs text-muted-foreground">
                            {suspendedExtractionProgress.message || 'Extracting diagrams and values'}
                          </span>
                          {suspendedExtractionProgress.total > 0 && (
                            <div className="w-full max-w-xs mt-2">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all duration-300"
                                  style={{ width: `${(suspendedExtractionProgress.current / suspendedExtractionProgress.total) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground mt-1 block text-center">
                                {suspendedExtractionProgress.current} / {suspendedExtractionProgress.total}
                              </span>
                            </div>
                          )}
                        </>
                      ) : suspendedWorkFile ? (
                        <>
                          <FileText className="h-8 w-8 text-primary" />
                          <span className="font-medium">{suspendedWorkFile.name}</span>
                          <span className="text-xs text-muted-foreground">{(suspendedWorkFile.size / 1024 / 1024).toFixed(2)} MB</span>
                          {suspendedDiagrams.length > 0 && (
                            <span className="text-xs text-green-600 mt-1">
                              {suspendedDiagrams.length} diagram(s) extracted
                            </span>
                          )}
                          {suspendedValues.length > 0 && (
                            <span className="text-xs text-green-600">
                              {suspendedValues.length} item(s) extracted
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Drag and drop or click to upload PDF</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleCheckFloorPlan} disabled={processingSuspendedPdf}>
                  Check Floor Plan <CheckCircle className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Samples</h1>
          <p className="text-muted-foreground mt-2">Manage project samples from the list below.</p>
        </div>
        <div className="flex w-full sm:w-auto">
          {isCreateRoute ? (
            <Button variant="outline" onClick={() => navigate(`/${projectId}/samples`)} className="w-full sm:w-auto">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to List
            </Button>
          ) : (
            <Button onClick={() => navigate(`/${projectId}/samples/create`)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Create Sample
            </Button>
          )}
        </div>
      </div>

      {showCreateForm && (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Create Sample</CardTitle>
              <CardDescription>Fill the sample details and save them to the system.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Project ID</Label>
              <Input value={selectedProject ? (selectedProject.project_id || selectedProject.id) : ""} readOnly placeholder="Select a project" />
            </div>
            <div className="space-y-2">
              <Label>Sample ID</Label>
              <Input
                type="text"
                value={createForm.sample_id}
                onChange={(e) => setCreateForm({ ...createForm, sample_id: e.target.value })}
                placeholder="Enter sample ID (e.g. SAMPLE-001)"
              />
            </div>
            <div className="space-y-2">
              <Label>Building Name</Label>
              <Input value={createForm.building_name} onChange={(e) => setCreateForm({ ...createForm, building_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input value={createForm.site_name} onChange={(e) => setCreateForm({ ...createForm, site_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Work Done</Label>
              <Input value={createForm.work_done} onChange={(e) => setCreateForm({ ...createForm, work_done: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Floor/Shaft</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={createForm.location.floor}
                onChange={(e) => setCreateForm({ ...createForm, location: { ...createForm.location, floor: String(e.target.value || "").replace(/[^\d]/g, "") } })}
                placeholder="e.g. 10"
              />
            </div>
            <div className="space-y-2">
              <Label>Flat/Zone</Label>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                value={createForm.flats}
                onChange={(e) => setCreateForm({ ...createForm, flats: String(e.target.value || "").replace(/[^\d]/g, "") })}
                placeholder="e.g. 12"
              />
              <p className="text-xs text-muted-foreground">Enter the flat count as a number.</p>
            </div>
            <div className="space-y-2">
              <Label>Block</Label>
              <Input value={createForm.location.block} onChange={(e) => setCreateForm({ ...createForm, location: { ...createForm.location, block: e.target.value } })} />
            </div>
            <div className="space-y-2">
              <Label>Wing</Label>
              <Input value={createForm.location.wing} onChange={(e) => setCreateForm({ ...createForm, location: { ...createForm.location, wing: e.target.value } })} />
            </div>
            <div className="space-y-2">
              <Label>Coordinates</Label>
              <Input value={createForm.location.coordinates} onChange={(e) => setCreateForm({ ...createForm, location: { ...createForm.location, coordinates: e.target.value } })} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Other documents/diagrams</div>
            </div>
            <div
              className={`border rounded-md p-3 transition-colors ${isAttachmentDragActive ? 'border-primary bg-primary/5' : 'border-dashed'}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsAttachmentDragActive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsAttachmentDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsAttachmentDragActive(false);
              }}
              onDrop={handleAttachmentDrop}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Drag and drop files here, or select multiple files
                </div>
                <Label
                  htmlFor="sample-attachments-upload"
                  className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium cursor-pointer hover:bg-muted"
                >
                  Select Files
                </Label>
              </div>
              <Input
                id="sample-attachments-upload"
                type="file"
                multiple
                onChange={handleSampleUpload}
                className="hidden"
              />
              {uploadFilePaths.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs">Uploaded files</Label>
                  <Select
                    value={createForm.sample_file || ""}
                    onValueChange={(value) => setCreateForm({ ...createForm, sample_file: value })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select uploaded file" />
                    </SelectTrigger>
                    <SelectContent>
                      {uploadFilePaths.map((path) => (
                        <SelectItem key={path} value={path}>
                          {path.split('/').pop() || path}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>

              <div className="space-y-4">
            <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-background to-secondary/20 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
              <div className="space-y-1">
                <div className="text-sm font-semibold tracking-wide">Item Description</div>
                <div className="text-xs text-muted-foreground">
                  Editable per-flat rows. Preview shows calculated totals for flats x floors.
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="h-8 px-3 rounded-full border bg-background/80 backdrop-blur-sm">
                  {createForm.item_description.length} row(s)
                </Badge>
                <Button
                  size="sm"
                  variant="default"
                  className="rounded-full px-4 shadow-sm"
                  type="button"
                  onClick={async () => {
                    if (!getSelectedProjectId()) {
                      toast({ title: "Select project", description: "Choose a project first.", variant: "destructive" });
                      return;
                    }
                    setBoqPickerOpen(true);
                    setLoadingProjectBoqItems(true);
                    try {
                      await refreshProjectBoqItems();
                    } finally {
                      setLoadingProjectBoqItems(false);
                    }
                  }}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  View Items in BOQ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-4"
                  type="button"
                  onClick={addManualSampleItemRow}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-4"
                  type="button"
                  onClick={() => {
                    setCreateForm({ ...createForm, item_description: [] });
                    setInventoryQtyStatus({});
                  }}
                  disabled={createForm.item_description.length === 0}
                >
                  Clear Table
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              {createForm.item_description.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-10 text-sm text-muted-foreground text-center bg-gradient-to-b from-muted/20 to-background">
                  <div>
                    No items added yet. Use <span className="font-medium">View Items in BOQ</span> or add a manual row here.
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="rounded-full px-4"
                    type="button"
                    onClick={addManualSampleItemRow}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table className="min-w-[1900px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      {inventoryTableKeys.map((key) => (
                        <TableHead
                          key={key}
                          className={`whitespace-nowrap capitalize text-xs font-semibold tracking-wide text-muted-foreground ${
                            key === "item_name"
                              ? "w-[420px]"
                              : key === "description"
                                ? "w-[520px]"
                                : key === "specification"
                                  ? "w-[420px]"
                                  : key === "brand_name"
                                    ? "w-[260px]"
                                    : key === "unit"
                                      ? "w-[180px]"
                                      : key === "item_code"
                                        ? "w-[220px]"
                                        : ""
                          }`}
                        >
                          {key === "item_name"
                            ? sampleItemNameLabel
                            : key === "brand_name"
                            ? "Brand Name"
                            : key === "item_code"
                              ? "Item Code"
                            : key === "specification"
                              ? "Specification"
                            : key === "qty"
                              ? "Qty / Flat"
                            : key === "unit"
                                  ? "Unit"
                                  : "Description"}
                        </TableHead>
                      ))}
                      <TableHead className="w-[90px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createForm.item_description.map((row, idx) => (
                      <TableRow key={`${idx}-${row?.sr_no || "row"}`}>
                      {inventoryTableKeys.map((key) => {
                          const field = (row.add_fields || []).find((f) => (f?.key || "").trim() === key);
                          const rawValue = (() => {
                            if (key === "item_name") return row?.item_name || getSamplePrimaryIdentifier(row, activeBoqClient) || field?.value || "-";
                            if (key === "description") return row?.description ?? field?.value ?? "-";
                            if (key === "item_code") return row?.item_code ?? field?.value ?? "-";
                            if (key === "specification") return row?.specification ?? field?.value ?? "-";
                            if (key === "brand_name") return row?.brand_name ?? field?.value ?? "-";
                            if (key === "unit") return row?.unit ?? field?.value ?? "-";
                            if (key === "qty") return row?.quantity ?? field?.value ?? "-";
                            return field?.value ?? "-";
                          })();
                          const rawText = String(rawValue ?? "").trim();
                          const displayValue = (() => {
                            if (key === "description") return truncateWords(rawText, 14);
                            if (key === "specification") return truncateWords(rawText, 12);
                            return rawText || "-";
                          })();
                          return (
                            <TableCell
                              key={`${idx}-${key}`}
                              className={`text-sm font-medium ${
                                key === "item_name"
                                  ? "min-w-[420px]"
                                  : key === "description"
                                    ? "min-w-[520px]"
                                    : key === "specification"
                                      ? "min-w-[420px]"
                                      : key === "brand_name"
                                        ? "min-w-[260px]"
                                        : key === "unit"
                                          ? "min-w-[180px]"
                                          : key === "item_code"
                                            ? "min-w-[220px]"
                                            : ""
                              }`}
                            >
                              {key === "item_name" ? (
                                <Input
                                  className="h-9 w-full min-w-0 text-sm"
                                  placeholder={sampleItemNameLabel}
                                  value={row?.item_name || ""}
                                  onChange={(e) => updateSampleItemRow(idx, { item_name: e.target.value })}
                                />
                              ) : key === "description" ? (
                                <div className="space-y-2">
                                  <Textarea
                                    className="min-h-20 w-full resize-y text-sm"
                                    placeholder="Description"
                                    value={row?.description || ""}
                                    onChange={(e) => updateSampleItemRow(idx, { description: e.target.value })}
                                  />
                                  <InventoryPicker
                                    project_id={projectIdForInventory}
                                    initialValue={row?.description || ""}
                                    selectedId={row?.inventory_id}
                                    minQty={Number(row?.quantity) || 0}
                                    onValidityChange={(status) => {
                                      setInventoryQtyStatus((prev) => ({ ...(prev || {}), [idx]: status }));
                                    }}
                                    onSelect={(picked) => {
                                      const qty = Number(row?.quantity);
                                      updateSampleItemRow(idx, {
                                        inventory_id: picked.inventory_id,
                                        issued_qty: row?.issued_qty ?? (Number.isFinite(qty) ? qty : null),
                                      });
                                    }}
                                    onClear={() => updateSampleItemRow(idx, { inventory_id: null, issued_qty: null })}
                                  />
                                </div>
                              ) : key === "brand_name" ? (
                                <Input
                                  className="h-9 text-sm"
                                  placeholder="Brand Name"
                                  value={row?.brand_name || ""}
                                  onChange={(e) => updateSampleItemRow(idx, { brand_name: e.target.value })}
                                />
                              ) : key === "item_code" ? (
                                <Input
                                  className="h-9 text-sm"
                                  placeholder="Item Code"
                                  value={row?.item_code || ""}
                                  onChange={(e) => updateSampleItemRow(idx, { item_code: e.target.value })}
                                />
                              ) : key === "specification" ? (
                                <Textarea
                                  className="min-h-16 resize-y text-sm"
                                  placeholder="Specification"
                                  value={row?.specification || ""}
                                  onChange={(e) => updateSampleItemRow(idx, { specification: e.target.value })}
                                />
                              ) : key === "unit" ? (
                                <Input
                                  className="h-9 text-sm"
                                  placeholder="Unit"
                                  value={row?.unit || ""}
                                  onChange={(e) => updateSampleItemRow(idx, { unit: e.target.value })}
                                />
                              ) : key === "qty" ? (
                                <Input
                                  className="h-9 text-sm"
                                  placeholder="Qty / Flat"
                                  value={row?.quantity || ""}
                                  onChange={(e) => updateSampleItemRow(idx, { quantity: String(e.target.value || "").replace(/[^\d]/g, "") })}
                                />
                              ) : key === "description" ? (
                                <span className="block max-w-[520px] truncate" title={rawText}>
                                  {displayValue}
                                </span>
                              ) : (
                                displayValue
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10"
                              title="Add a row below"
                              onClick={() => insertManualSampleItemRowAt(idx)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-destructive/10"
                              title="Remove row"
                              onClick={() => {
                                removeSampleItemRowAt(idx);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                </Table>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                Add more rows or review the calculated totals below before saving.
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-4"
                  type="button"
                  onClick={addManualSampleItemRow}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full px-4"
                  type="button"
                  onClick={() => {
                    setCreateForm({ ...createForm, item_description: [] });
                    setInventoryQtyStatus({});
                  }}
                  disabled={createForm.item_description.length === 0}
                >
                  Clear Table
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-wide">Calculated Preview</div>
                  <div className="text-xs text-muted-foreground">
                    Read-only totals calculated from `flats count x floors x qty per flat`.
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border px-3 py-2">
                    <div className="uppercase text-muted-foreground">Flats Count</div>
                    <div className="mt-1 font-semibold">{getFlatCount() || "-"}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <div className="uppercase text-muted-foreground">Floors</div>
                    <div className="mt-1 font-semibold">{getFloorCount() || "-"}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2">
                    <div className="uppercase text-muted-foreground">Multiplier</div>
                    <div className="mt-1 font-semibold">{getFlatCount() > 0 && getFloorCount() > 0 ? getFlatCount() * getFloorCount() : "-"}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border overflow-hidden">
                <div className="overflow-x-auto">
                <Table className="min-w-[1750px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[420px]">{sampleItemNameLabel}</TableHead>
                      <TableHead className="w-[520px]">Description</TableHead>
                      <TableHead className="w-[220px]">Item Code</TableHead>
                      <TableHead className="w-[420px]">Specification</TableHead>
                      <TableHead className="w-[260px]">Brand Name</TableHead>
                      <TableHead className="w-[180px]">Unit</TableHead>
                      <TableHead className="text-right">Qty / Flat</TableHead>
                      <TableHead className="border-l border-border/70 text-center">Flats</TableHead>
                      <TableHead className="border-l border-border/70 text-center">Floors</TableHead>
                      <TableHead className="border-l border-border/70 text-center">Multiplier</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCalculatedSampleRows(createForm.item_description).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No rows to preview</TableCell>
                      </TableRow>
                    ) : (
                      getCalculatedSampleRows(createForm.item_description).map((row, index) => (
                        <TableRow key={`preview-${index}`}>
                          <TableCell>{row.item_name || getSamplePrimaryIdentifier(row, activeBoqClient) || "-"}</TableCell>
                          <TableCell>{row.description || "-"}</TableCell>
                          <TableCell>{row.item_code || "-"}</TableCell>
                          <TableCell>{row.specification || "-"}</TableCell>
                        <TableCell>{row.brand_name || "-"}</TableCell>
                        <TableCell>{row.unit || "-"}</TableCell>
                        <TableCell className="text-right">{row.qty_per_flat || "-"}</TableCell>
                        <TableCell className="border-l border-border/70 text-center font-medium">{row.flats || "-"}</TableCell>
                        <TableCell className="border-l border-border/70 text-center font-medium">{row.floors || "-"}</TableCell>
                        <TableCell className="border-l border-border/70 text-center font-semibold">
                          {row.flats && row.floors ? `${row.flats} x ${row.floors} = ${Number(row.flats) * Number(row.floors)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">{row.total_qty || "-"}</TableCell>
                      </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </div>
            </div>
          </div>
          {/* Additional Fields section hidden as requested */}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={saveCreate} disabled={savingSample || !getFlatCount() || !getFloorCount()}>
            {savingSample ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {savingSample ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
      )}

      {!isCreateRoute ? (
      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Sample List</CardTitle>
              <CardDescription>Loaded records {selectedProject ? `(Project ${selectedProject.project_id || selectedProject.id})` : ''}</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={selectedUploadedFile} onValueChange={setSelectedUploadedFile}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Select uploaded file" />
                </SelectTrigger>
                <SelectContent>
                  {availableUploadedFiles.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.split('/').pop() || p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!selectedUploadedFile}
                onClick={() => {
                  if (selectedUploadedFile) {
                    window.open(api.getApiFileUrl(selectedUploadedFile), "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Preview
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingServer ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : serverSamples.length === 0 ? (
            <div className="text-muted-foreground py-6">No samples found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>ID</TableHead>
                  <TableHead>Building</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Flats</TableHead>
                  <TableHead className="w-[160px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serverSamples.map((s) => (
                  <TableRow key={s.sample_id || s.id}>
                    <TableCell>{s.sample_id || s.id}</TableCell>
                    <TableCell>{s.building_name || '-'}</TableCell>
	                    <TableCell>{s.site_name || '-'}</TableCell>
	                    <TableCell>{s.flats || '-'}</TableCell>
	                    <TableCell>
	                      <div className="flex justify-end">
	                        <RowActionsMenu
	                          items={[
	                            {
	                              key: "link",
	                              label: linkingSampleId === (s.sample_id || s.id) ? "Linking..." : "Link to Inventory",
	                              icon: Link2,
	                              disabled: (() => {
	                                const sid = s.sample_id || s.id;
	                                const linked = sid ? linkedSampleIds.has(String(sid)) : false;
	                                const hasLinks = sampleHasInventoryLinks(s);
	                                return linked || hasLinks || linkingSampleId === (s.sample_id || s.id);
	                              })(),
	                              onSelect: () => handleLinkSampleInventory(s),
	                            },
	                            {
	                              key: "attach",
	                              label: "Attach other documents/diagrams",
	                              icon: Paperclip,
	                              disabled: !selectedUploadedFile,
	                              onSelect: () => {
	                                if (!selectedUploadedFile) return;
	                                attachFileToSample(s, selectedUploadedFile);
	                              },
	                            },
                            {
                              key: "download",
                              label: "Download PDF",
                              icon: Download,
                              disabled: !(s.sample_id || s.id),
                              onSelect: () => handleDownloadSample(s),
                            },
	                            { type: "separator" },
	                            { key: "preview", label: "Preview", icon: Eye, onSelect: () => openPreview(s) },
	                            { type: "separator" },
	                            { key: "delete", label: "Delete", icon: Trash2, destructive: true, onSelect: () => removeSample(s) },
	                          ]}
	                        />
	                      </div>
	                    </TableCell>
	                  </TableRow>
	                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      ) : null}

      <Dialog open={itemFieldDialogOpen} onOpenChange={(open) => {
        if (open) {
          setItemFieldDialogOpen(true);
        } else {
          closeItemFieldDialog();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item Field</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={itemFieldKey} onChange={(e) => setItemFieldKey(e.target.value)} placeholder="Enter key" />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={itemFieldValue} onChange={(e) => setItemFieldValue(e.target.value)} placeholder="Enter value" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeItemFieldDialog}>Cancel</Button>
            <Button onClick={addItemFieldToRow}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={boqPickerOpen}
        onOpenChange={(open) => {
          setBoqPickerOpen(open);
          if (!open) setBoqSearch("");
        }}
      >
        <DialogContent className="w-[98vw] max-w-[98vw] sm:!w-[98vw] sm:!max-w-[98vw] h-[94vh] sm:!max-h-[94vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/10 via-background to-secondary/20">
            <DialogTitle className="text-xl tracking-tight flex items-center gap-2">
              BOQ Items
              {activeBoqClient ? (
                <Badge variant="secondary" className="rounded-full">
                  {activeBoqClient === "lodha" ? "Lodha" : activeBoqClient === "hiranandani" ? "Hiranandani" : activeBoqClient}
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-6 h-[calc(94vh-86px)] overflow-auto">
            <div className="rounded-2xl border bg-card shadow-sm p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  className="pl-9 rounded-full bg-muted/30"
                  placeholder="Search by item no, section, unit, or description"
                  value={boqSearch}
                  onChange={(e) => setBoqSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 h-8">{filteredProjectBoqItems.length} item(s)</Badge>
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-4"
                onClick={async () => {
                  setLoadingProjectBoqItems(true);
                  try {
        await refreshProjectBoqItems();
      } finally {
        setLoadingProjectBoqItems(false);
      }
                }}
                disabled={loadingProjectBoqItems}
              >
                {loadingProjectBoqItems ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <div className={activeBoqClient ? "overflow-x-auto" : ""}>
            <div className={activeBoqClient ? "min-w-[1200px]" : ""}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs tracking-wide">Description</TableHead>
                  <TableHead className="w-[240px] text-xs tracking-wide">Section</TableHead>
                  <TableHead className="w-[120px] text-xs tracking-wide">Item No</TableHead>
                  {activeBoqClient === "lodha" ? (
                    <TableHead className="w-[120px] text-xs tracking-wide">HSN</TableHead>
                  ) : activeBoqClient === "hiranandani" ? (
                    <TableHead className="w-[120px] text-xs tracking-wide">SAC Code</TableHead>
                  ) : (
                    <TableHead className="w-[140px] text-xs tracking-wide">Item Code</TableHead>
                  )}
                  <TableHead className="w-[90px] text-xs tracking-wide">{activeBoqClient === "hiranandani" ? "UOM" : "Unit"}</TableHead>
                  <TableHead className="w-[110px] text-xs tracking-wide">{activeBoqClient === "hiranandani" ? "Order Qty" : "Qty"}</TableHead>
                  {activeBoqClient ? <TableHead className="w-[120px] text-xs tracking-wide text-right">{activeBoqClient === "hiranandani" ? "Unit Price" : "Rate"}</TableHead> : null}
                  {activeBoqClient ? <TableHead className="w-[120px] text-xs tracking-wide text-right">{activeBoqClient === "hiranandani" ? "Value" : "Amount"}</TableHead> : null}
                  <TableHead className="w-[240px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProjectBoqItems ? (
                  <TableRow>
                    <TableCell colSpan={activeBoqClient ? 9 : 7} className="text-center text-sm text-muted-foreground py-8">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading BOQ items...
                    </TableCell>
                  </TableRow>
                ) : filteredProjectBoqItems.length === 0 ? (
                  null
                ) : (
                  filteredProjectBoqItems.map((item) => {
                    const key = boqItemKey(item);
                    const derived = deriveBoqFields(item);
                    const availableQty = getBoqRemainingQty(item);
                    const reserveKey = getBoqExactMatchKey(item) || (() => {
                      const normalize = (v) => String(v || "").trim().toLowerCase();
                      const normalizeEmptyLike = (v) => {
                        const t = String(v ?? "").trim();
                        if (!t) return "";
                        const n = t.toLowerCase();
                        if (n === "-" || n === "_" || n === "na" || n === "n/a" || n === "null" || n === "undefined") return "";
                        return t;
                      };
                      const boqId = normalize(normalizeEmptyLike(derived?.id));
                      const itemNo = normalize(normalizeEmptyLike(derived?.item_no));
                      const itemCode = normalize(normalizeEmptyLike(derived?.item_code));
                      const description = normalize(normalizeEmptyLike(derived?.description));
                      const section = normalize(normalizeEmptyLike(derived?.section));
                      return boqId || itemNo || itemCode || (description ? `${description}__${section}` : "");
                    })();
                    const addedQty = reserveKey ? (boqReservedQtyByKey.get(reserveKey) || 0) : 0;
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="max-w-[520px] truncate text-left hover:underline"
                            title={String(derived.description || "")}
                            onClick={() =>
                              setBoqDescriptionPreview({
                                item_no: derived.item_no,
                                item_code: derived.item_code,
                                section: derived.section,
                                description: derived.description,
                                unit: derived.unit,
                                qty: derived.qty,
                                rate: derived.rate,
                                amount: derived.amount,
                                hsn: derived.hsn,
                                sac_code: derived.sac_code,
                              })
                            }
                          >
                            {truncateWords(derived.description, 10)}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{derived.section || "-"}</TableCell>
                        <TableCell className="font-medium">{derived.item_no || derived.item_code || "-"}</TableCell>
                        {activeBoqClient === "lodha" ? (
                          <TableCell className="font-mono text-xs">{derived.hsn || "-"}</TableCell>
                        ) : activeBoqClient === "hiranandani" ? (
                          <TableCell className="font-mono text-xs">{derived.sac_code || "-"}</TableCell>
                        ) : (
                          <TableCell className="font-medium">{derived.item_code || "-"}</TableCell>
                        )}
                        <TableCell className="font-medium">{derived.unit || "-"}</TableCell>
                        <TableCell className="font-medium">
                          {Number.isFinite(availableQty) ? String(availableQty) : "0"}
                        </TableCell>
                        {activeBoqClient ? (
                          <TableCell className="font-medium text-right">{formatMaybeCurrency(derived.rate)}</TableCell>
                        ) : null}
                        {activeBoqClient ? (
                          <TableCell className="font-medium text-right">{formatMaybeCurrency(derived.amount)}</TableCell>
                        ) : null}
                        <TableCell className="w-[240px] text-right">
                          {Object.prototype.hasOwnProperty.call(pendingBoqQty, key) ? (
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              <div className="h-9 rounded-full border bg-muted/20 p-1 flex items-center gap-1 shadow-inner">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full"
                                  onClick={() => adjustPendingBoqQty(item, -1)}
                                  disabled={addingBoqKey === key}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={pendingBoqQty[key]}
                                  onChange={(e) => setPendingBoqQtyValue(item, e.target.value)}
                                  onBlur={() => normalizePendingBoqQty(item)}
                                  className="h-7 w-14 rounded-full border-0 bg-background text-center text-sm font-semibold px-1 focus-visible:ring-1 focus-visible:ring-primary"
                                  disabled={addingBoqKey === key}
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-full"
                                  onClick={() => adjustPendingBoqQty(item, 1)}
                                  disabled={addingBoqKey === key}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full px-4 bg-primary text-primary-foreground"
                                onClick={() => confirmAddBoqWithQuantity(item)}
                                disabled={addingBoqKey === key || !Number(pendingBoqQty[key])}
                              >
                                {addingBoqKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="rounded-full px-3"
                                onClick={() => closeBoqQtySelector(key)}
                                disabled={addingBoqKey === key}
                              >
                                Cancel
                              </Button>
                              {addedQty > 0 ? (
                                <Badge variant="secondary" className="rounded-full px-3 h-8 whitespace-nowrap shrink-0">
                                  {addedQty} added
                                </Badge>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2 flex-nowrap">
                              {addedQty > 0 ? (
                                <Badge variant="secondary" className="rounded-full px-3 h-8 whitespace-nowrap shrink-0">
                                  {addedQty} added
                                </Badge>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full px-4 shrink-0"
                                onClick={() => openBoqQtySelector(item)}
                                disabled={addingBoqKey === key}
                              >
                                {addingBoqKey === key ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Add
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
            </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-muted/20">
            <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setBoqPickerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!boqDescriptionPreview} onOpenChange={(open) => !open && setBoqDescriptionPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>BOQ Item Description</DialogTitle>
          </DialogHeader>
          {boqDescriptionPreview ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Item Code</div>
                  <div className="font-medium">{boqDescriptionPreview.item_code || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Item No</div>
                  <div className="font-medium">{boqDescriptionPreview.item_no || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Section</div>
                  <div className="font-medium">{boqDescriptionPreview.section || "-"}</div>
                </div>
                {activeBoqClient === "lodha" ? (
                  <div>
                    <div className="text-xs text-muted-foreground">HSN</div>
                    <div className="font-medium font-mono">{boqDescriptionPreview.hsn || "-"}</div>
                  </div>
                ) : activeBoqClient === "hiranandani" ? (
                  <div>
                    <div className="text-xs text-muted-foreground">SAC Code</div>
                    <div className="font-medium font-mono">{boqDescriptionPreview.sac_code || "-"}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-muted-foreground">Unit</div>
                  <div className="font-medium">{boqDescriptionPreview.unit || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{activeBoqClient === "hiranandani" ? "Order Qty" : "Qty"}</div>
                  <div className="font-medium">{boqDescriptionPreview.qty || "-"}</div>
                </div>
                {activeBoqClient ? (
                  <div>
                    <div className="text-xs text-muted-foreground">{activeBoqClient === "hiranandani" ? "Unit Price" : "Rate"}</div>
                    <div className="font-medium">{formatMaybeCurrency(boqDescriptionPreview.rate)}</div>
                  </div>
                ) : null}
                {activeBoqClient ? (
                  <div>
                    <div className="text-xs text-muted-foreground">{activeBoqClient === "hiranandani" ? "Value" : "Amount"}</div>
                    <div className="font-medium">{formatMaybeCurrency(boqDescriptionPreview.amount)}</div>
                  </div>
                ) : null}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <div className="whitespace-pre-wrap text-sm font-medium">{boqDescriptionPreview.description || "-"}</div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoqDescriptionPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
