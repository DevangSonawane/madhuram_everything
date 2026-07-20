import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Download,
  Eye,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Loader2,
  Link2,
  Mail,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  X,
  MoreHorizontal,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadMaterialRequestExcel } from "@/pages/createExcelMaterialRequest";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { extractImagesFromPdf } from "@/lib/pdfUtils";
import { UnitSelect, convertQuantity } from "@/components/forms/UnitSelect";
import { RowActionsMenu } from "@/components/RowActionsMenu";

const URGENCY_OPTIONS = ["High", "Medium", "Low"];

const createEmptyItem = () => ({
  item_no: "",
  item_name: "",
  material_description: "",
  unit: "NOS",
  req_qty: "",
  make: "",
  place_of_utilisation: "",
  inventory_id: null,
  issued_qty: null,
  boq_id: "",
  boq_qty: "",
  row_source: "manual",
});

const createEmptyForm = () => ({
  project_id: "",
  sample_id: "",
  pr_number: "",
  project_name: "",
  workorder_no: "",
  floor_no: "",
  flat_no: "",
  location: "",
  mirno: "",
  urgency: "Medium",
  date: new Date().toISOString().slice(0, 10),
  approved_by: "",
  remarks: "",
  pr_file_path: "",
  signature_file_path: "",
  prFile: null,
  signatureFile: null,
  items: [createEmptyItem()],
});

const parseIntegerOrNull = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const parseNumberOrZero = (value) => {
  if (value == null || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getAddFieldValue = (row, fieldKey) =>
  (Array.isArray(row?.add_fields) ? row.add_fields : []).find((field) => String(field?.key || "").trim() === fieldKey)?.value ?? "";

const getSampleQuantityMeta = (row) => {
  const sampleTotalQty = parseNumberOrZero(
    row?.total_qty ||
      row?.quantity ||
      row?.qty ||
      getAddFieldValue(row, "total_qty") ||
      getAddFieldValue(row, "selected_qty") ||
      getAddFieldValue(row, "boq_base_qty")
  );
  const sampleFlatCount = parseNumberOrZero(
    getAddFieldValue(row, "flat_count") || getAddFieldValue(row, "boq_flat_multiplier") || row?.flat_count || row?.flats
  );
  const sampleFloorCount = parseNumberOrZero(
    getAddFieldValue(row, "floors") || getAddFieldValue(row, "boq_floor_multiplier") || row?.floor_count || row?.floors
  );
  const sampleMultiplier = Math.max(1, sampleFlatCount * sampleFloorCount);
  const sampleQtyPerFlat = parseNumberOrZero(
    getAddFieldValue(row, "qty_per_flat") ||
      getAddFieldValue(row, "boq_qty_per_flat") ||
      row?.qty_per_flat ||
      row?.quantity_per_flat ||
      row?.per_flat_qty ||
      row?.perFlatQty ||
      sampleTotalQty
  );
  return {
    sampleTotalQty,
    sampleQtyPerFlat: sampleQtyPerFlat > 0 ? sampleQtyPerFlat : sampleTotalQty,
    sampleFlatCount,
    sampleFloorCount,
    sampleMultiplier,
  };
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateDmy = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
};

const formatPrNumber = (pr = {}) => {
  const explicit = String(pr.pr_number || "").trim();
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

const getPrListNumber = (pr = {}) => {
  const explicit = String(pr.pr_number || "").trim();
  if (explicit) return explicit;
  const id = pr.pr_id || pr.id;
  return id != null && id !== "" ? String(id) : "-";
};

const normalizeLocationText = (value) => {
  if (typeof value === "string") return value || "-";
  if (!value || typeof value !== "object") return value == null ? "-" : String(value);

  const parts = [
    value.floor_no ?? value.floor,
    value.flat_no ?? value.flatNo,
    value.block,
    value.wing,
    value.coordinates,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "-";
};

const normalizeLookupText = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const getSampleAddFieldValue = (row, fieldKey) =>
  (Array.isArray(row?.add_fields) ? row.add_fields : []).find((field) => String(field?.key || "").trim() === fieldKey)?.value ?? "";

const isLikelyItemCode = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (/^\(?\d+(\.\d+){0,3}\)?$/.test(text)) return true;
  if (/^[A-Z0-9][A-Z0-9._/-]{2,}$/.test(text) && !/\s/.test(text)) return true;
  return false;
};

const resolvePrItemNo = (row = {}) => {
  return String(
    row?.item_no ||
      getSampleAddFieldValue(row, "item_no") ||
      row?.itemNo ||
      row?.item_name ||
      row?.itemName ||
      row?.description ||
      row?.material_description ||
      row?.item_code ||
      row?.boq_item_code ||
      ""
  ).trim();
};

const resolvePrItemName = (row = {}, fallback = "") => {
  const candidates = [
    row?.item_name,
    getSampleAddFieldValue(row, "item_name"),
    row?.description,
    row?.material_description,
    row?.item,
    row?.name,
    row?.item_no,
    row?.itemNo,
  ];

  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text && !isLikelyItemCode(text)) return text;
  }

  return String(fallback || resolvePrItemNo(row)).trim();
};

const parseSampleItemsForPrPdf = (sample) => {
  const rawItems = parseMaybeJson(sample?.item_description ?? sample?.items ?? sample?.item_descriptions, []);
  const list = Array.isArray(rawItems) ? rawItems : [];
  const sampleId = String(sample?.sample_id ?? sample?.id ?? "").trim();

  return list.map((row, index) => ({
    sample_id: sampleId,
    boq_serial_no: String(row?.sr_no ?? row?.srno ?? row?.srNo ?? row?.item_no ?? row?.itemNo ?? index + 1),
    item_no: String(
      row?.item_no ??
        row?.itemNo ??
        getSampleAddFieldValue(row, "item_no") ??
        getSampleAddFieldValue(row, "itemNo") ??
        getSampleAddFieldValue(row, "item_code") ??
        getSampleAddFieldValue(row, "itemCode") ??
        row?.item_code ??
        row?.itemCode ??
        ""
    ).trim(),
    item_name: String(
      row?.item_name ??
        row?.itemName ??
        getSampleAddFieldValue(row, "item_name") ??
        getSampleAddFieldValue(row, "itemName") ??
        row?.description ??
        row?.material_description ??
        row?.item ??
        row?.name ??
        ""
    ).trim(),
    description: String(
      row?.description ??
        row?.material_description ??
        getSampleAddFieldValue(row, "description") ??
        row?.item ??
        row?.name ??
        row?.item_name ??
        ""
    ).trim(),
    item_code: String(row?.item_code ?? row?.itemCode ?? row?.code ?? row?.item_no ?? "").trim(),
  }));
};

const enrichPrItemsWithSampleData = (pr, sample) => {
  const items = Array.isArray(pr?.items) ? pr.items : [];
  const sampleItems = parseSampleItemsForPrPdf(sample);
  const sampleId = String(pr?.sample_id || sample?.sample_id || sample?.id || "").trim();

  return items.map((item, index) => {
    const descKey = normalizeLookupText(
      item?.make || item?.item_name || item?.itemName || item?.material_description || item?.description || item?.item || item?.name || ""
    );
    const codeKey = normalizeLookupText(item?.item_code || item?.itemCode || item?.code || "");
    const matched =
      sampleItems.find((row) => {
        const rowName = normalizeLookupText(row.item_name);
        const rowDesc = normalizeLookupText(row.description);
        const rowCode = normalizeLookupText(row.item_code);
        if (descKey && rowName && descKey === rowName) return true;
        if (descKey && rowDesc && descKey === rowDesc) return true;
        if (codeKey && rowCode && codeKey === rowCode) return true;
        return false;
      }) || sampleItems[index] || {};

    return {
      ...item,
      sample_id: sampleId || matched.sample_id || "",
      boq_serial_no: matched.boq_serial_no || String(index + 1),
      item_no: resolvePrItemNo(matched) || resolvePrItemNo(item),
      item_name: resolvePrItemName(matched, resolvePrItemName(item, item.item_name || item.item_no || "")),
      description: matched.description || item.description || item.material_description || "",
      make: item.make || "",
    };
  });
};

const isImageFile = (path = "") => /\.(png|jpg|jpeg|gif|webp)$/i.test(path);
const isPdfFile = (path = "") => /\.pdf$/i.test(path);

const getAuthHeadersForFile = () => {
  try {
    const user = JSON.parse(localStorage.getItem("inventory_user") || "null");
    const token = user?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const fetchFileAsBlob = async (url) => {
  if (!url) return null;
  // Some file endpoints are public; sending an Authorization header can trigger CORS preflight failures.
  // Try with auth first, then fall back to a plain fetch.
  try {
    const response = await fetch(url, { headers: getAuthHeadersForFile() });
    if (response.ok) return await response.blob();
  } catch {
    // continue to unauthenticated attempt
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
};

const getSignaturePreviewDataUrl = async (path = "") => {
  const url = path ? api.getApiFileUrl(path) : "";
  if (!url) return "";
  const blob = await fetchFileAsBlob(url);
  if (!blob || blob.size === 0) return "";

  const isPdf = blob.type === "application/pdf" || isPdfFile(path);
  if (isPdf) {
    const file = new File([blob], "signature.pdf", {
      type: blob.type || "application/pdf",
    });
    try {
      const images = await extractImagesFromPdf(file, {
        pageRange: { start: 1, end: 1 },
        maxPages: 1,
        batchSize: 1,
        scale: 1.2,
        quality: 0.9,
      });
      return images?.[0]?.imageDataUrl || "";
    } catch {
      return "";
    }
  }

  try {
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

const ensurePdfCompatibleImageDataUrl = async (dataUrl = "") => {
  const value = String(dataUrl || "");
  if (!value.startsWith("data:image/")) return value;
  if (value.startsWith("data:image/png") || value.startsWith("data:image/jpeg") || value.startsWith("data:image/jpg")) {
    return value;
  }

  // jsPDF addImage is most reliable with PNG/JPEG; convert other raster types via canvas.
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = value;
    });
    if (!loaded) return "";

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 0;
    canvas.height = img.naturalHeight || img.height || 0;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return "";
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png", 0.92);
  } catch {
    return "";
  }
};

const sniffFileKind = async (blob, path = "") => {
  const name = String(path || "");
  const ext = name.split(".").pop()?.toLowerCase() || "";
  try {
    const buf = await blob.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(buf);

    // PDF: %PDF-
    if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
      return { kind: "pdf", mime: "application/pdf" };
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { kind: "image", mime: "image/png" };
    }
    // JPEG: FF D8 FF
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { kind: "image", mime: "image/jpeg" };
    }
    // GIF: GIF8
    if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { kind: "image", mime: "image/gif" };
    }
    // WEBP: RIFF....WEBP
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { kind: "image", mime: "image/webp" };
    }
  } catch {
    // Ignore sniff errors; fall back to extension.
  }

  if (ext === "pdf") return { kind: "pdf", mime: "application/pdf" };
  if (ext === "png") return { kind: "image", mime: "image/png" };
  if (ext === "jpg" || ext === "jpeg") return { kind: "image", mime: "image/jpeg" };
  if (ext === "webp") return { kind: "image", mime: "image/webp" };
  if (ext === "gif") return { kind: "image", mime: "image/gif" };

  return { kind: "unknown", mime: blob.type || "application/octet-stream" };
};

const parseMaybeJson = (value, fallback) => {
  if (typeof value !== "string") return value ?? fallback;
  const t = value.trim();
  if (!t) return fallback;
  try {
    return JSON.parse(t);
  } catch {
    return fallback;
  }
};

const resolveSampleRef = (item = {}) => {
  const sample = item?.sample && typeof item.sample === "object" ? item.sample : {};
  const sampleId =
    item.sample_id ??
    item.sampleId ??
    item.sampleID ??
    sample.sample_id ??
    sample.sampleId ??
    sample.sampleID ??
    sample.id ??
    null;

  const sampleLabel =
    item.sample_label ??
    item.sampleLabel ??
    item.sample_name ??
    item.sampleName ??
    item.sample_code ??
    item.sampleCode ??
    sample.sample_label ??
    sample.sampleLabel ??
    sample.sample_name ??
    sample.sampleName ??
    sample.sample_code ??
    sample.sampleCode ??
    sample.work_done ??
    sample.site_name ??
    sample.building_name ??
    "";

  return {
    sampleId: sampleId == null || sampleId === "" ? null : sampleId,
    sampleLabel: String(sampleLabel || "").trim(),
  };
};

const normalizePr = (item = {}) => {
  const rawItems = parseMaybeJson(item.items ?? item.pr_items ?? item.prItems, []);
  const sampleRef = resolveSampleRef(item);
  return {
    ...item,
    pr_id: item.pr_id || item.id,
    project_id: item.project_id || item.projectId || null,
    pr_number: item.pr_number || "",
    sample_id: sampleRef.sampleId,
    sample_label: sampleRef.sampleLabel,
    project_name: item.project_name || "-",
    workorder_no: item.workorder_no || "-",
    floor_no:
      item.floor_no ||
      item.floorNo ||
      item.location?.floor_no ||
      item.location?.floorNo ||
      item.location?.floor ||
      "-",
    flat_no:
      item.flat_no ||
      item.flatNo ||
      item.location?.flat_no ||
      item.location?.flatNo ||
      item.location?.flat ||
      "-",
    location: normalizeLocationText(item.location),
    mirno: item.mirno || "-",
    urgency: item.urgency || "Medium",
    date: item.date || item.created_at || null,
    approved_by: item.approved_by || "-",
    pr_file_path: item.pr_file_path || "",
    signature_file_path: item.signature_file_path || "",
    remarks: item.remarks || "",
    items: Array.isArray(rawItems)
    ? rawItems.map((row) => {
          const rowTotalQty = parseNumberOrZero(
            row?.sample_total_qty ?? row?.total_qty ?? row?.quantity ?? row?.qty ?? row?.issued_qty
          );
          const rowFlatCount = parseNumberOrZero(row?.sample_flat_count ?? row?.flat_count ?? row?.flats);
          const rowFloorCount = parseNumberOrZero(row?.sample_floor_count ?? row?.floor_count ?? row?.floors);
          const rowMultiplier = Math.max(1, rowFlatCount * rowFloorCount);
          const rowQtyPerFlat = parseNumberOrZero(
            row?.sample_qty_per_flat ??
              row?.qty_per_flat ??
              row?.req_qty ??
              (rowTotalQty > 0 ? rowTotalQty / rowMultiplier : 0)
          );

          return {
            ...row,
            req_qty: row?.req_qty || row?.qty_per_flat || (rowQtyPerFlat > 0 ? String(rowQtyPerFlat) : ""),
            sample_total_qty: row?.sample_total_qty ?? row?.total_qty ?? (rowTotalQty > 0 ? rowTotalQty : ""),
            sample_qty_per_flat:
              row?.sample_qty_per_flat ?? row?.qty_per_flat ?? (rowQtyPerFlat > 0 ? String(rowQtyPerFlat) : ""),
            sample_flat_count: row?.sample_flat_count ?? row?.flat_count ?? (rowFlatCount > 0 ? rowFlatCount : ""),
            sample_floor_count: row?.sample_floor_count ?? row?.floor_count ?? (rowFloorCount > 0 ? rowFloorCount : ""),
            sample_multiplier: row?.sample_multiplier ?? row?.multiplier ?? (rowMultiplier > 1 ? rowMultiplier : ""),
            item_no: resolvePrItemNo(row),
            item_name: resolvePrItemName(row, row?.item_name || row?.item_no || ""),
            item_code: row?.item_code || getSampleAddFieldValue(row, "item_code") || row?.code || row?.boq_item_code || row?.item_no || "",
            boq_item_code: row?.boq_item_code || getSampleAddFieldValue(row, "boq_item_code") || row?.boqItemCode || row?.item_code || row?.item_no || "",
            make: row?.make || "",
            row_source: row?.boq_id || row?.boqId ? "sample" : "manual",
          };
        })
      : [],
  };
};

function PrFormDialog({
  open,
  onOpenChange,
  mode,
  form,
  setForm,
  setSelectedSampleId,
  onSubmit,
  submitting,
  selectedProject,
  sampleOptions,
  loadingSamples,
}) {
  const title = mode === "edit" ? "Edit Purchase Request" : "Create Purchase Request";
  const selectedSampleMissing = Boolean(
    form.sample_id && !sampleOptions.some((sample) => String(sample.sample_id || sample.id) === form.sample_id)
  );
  const selectedSample = sampleOptions.find((sample) => String(sample.sample_id || sample.id) === String(form.sample_id || ""));

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setItemField = (index, field, value) => {
    setForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], [field]: value };
      if (field === "item_no" || field === "item_name") {
        next[index] = { ...next[index], item_no: value, item_name: value, row_source: "manual" };
      } else if (field === "material_description" || field === "unit" || field === "place_of_utilisation" || field === "make") {
        next[index] = { ...next[index], row_source: "manual" };
      }
      if (field === "req_qty" && next[index]?.inventory_id) {
        next[index] = { ...next[index], issued_qty: value };
      }
      return { ...prev, items: next };
    });
  };

  const getSelectedSampleItems = () => parseMaybeJson(selectedSample?.item_description ?? selectedSample?.items ?? [], []);

  const resolveSampleQtyPerFlatForItem = (item, index) => {
    const directQtyPerFlat = parseNumberOrZero(item?.req_qty || item?.sample_qty_per_flat);
    if (directQtyPerFlat > 0) return directQtyPerFlat;

    const selectedSampleItems = getSelectedSampleItems();
    const normalizedItemName = String(item?.item_name || item?.item_no || item?.make || item?.material_description || "").trim().toLowerCase();
    const candidateSample =
      Array.isArray(selectedSampleItems) &&
      (selectedSampleItems.find((row) =>
        String(row?.item_name || row?.description || row?.material_description || "").trim().toLowerCase() === normalizedItemName
      ) ||
        selectedSampleItems[index] ||
        null);

    if (candidateSample) {
      const meta = getSampleQuantityMeta(candidateSample);
      if (meta.sampleQtyPerFlat > 0) return meta.sampleQtyPerFlat;
      if (meta.sampleTotalQty > 0) return meta.sampleTotalQty;
    }

    const totalQty = parseNumberOrZero(item?.sample_total_qty || item?.total_qty || item?.quantity || item?.qty);
    if (totalQty > 0) return totalQty;

    return 0;
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItem = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const getPreviewQtyForItem = (item, index) => {
    const rowSampleQtyPerFlat = resolveSampleQtyPerFlatForItem(item, index);
    if (rowSampleQtyPerFlat > 0) return rowSampleQtyPerFlat;

    return parseNumberOrZero(item?.req_qty || item?.sample_qty_per_flat || item?.sample_total_qty);
  };

  const getPreviewQtyPerFlatForItem = (item, index) => {
    return resolveSampleQtyPerFlatForItem(item, index);
  };

  useEffect(() => {
    setForm((prev) => {
      const rows = Array.isArray(prev.items) ? prev.items : [];
      let changed = false;
      const nextRows = rows.map((row) => {
        if (!(row?.sample_total_qty || row?.sample_qty_per_flat || row?.sample_multiplier)) return row;
        const nextQty = parseNumberOrZero(row?.req_qty || row?.sample_total_qty || row?.sample_qty_per_flat);
        const nextValue = Number.isFinite(nextQty) && nextQty > 0 ? String(nextQty) : "";
        if (String(row?.req_qty || "") === nextValue) return row;
        changed = true;
        return { ...row, req_qty: nextValue };
      });
      return changed ? { ...prev, items: nextRows } : prev;
    });
  }, [form.floor_no, form.flat_no]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Fill PR header details, upload optional files, and add item rows.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Project ID *</Label>
            <Input
              value={form.project_id}
              onChange={(e) => setField("project_id", e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input
              value={form.project_name}
              onChange={(e) => setField("project_name", e.target.value)}
              placeholder={selectedProject?.project_name || "Project name"}
            />
          </div>
          <div className="space-y-2">
            <Label>PR Number *</Label>
            <Input
              value={form.pr_number}
              onChange={(e) => setField("pr_number", e.target.value)}
              placeholder="Enter PR number"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Sample ID</Label>
            <Input
              inputMode="numeric"
              value={form.sample_id}
              onChange={(e) => {
                const next = e.target.value;
                setField("sample_id", next);
                setSelectedSampleId(next);
              }}
              placeholder="Enter sample id"
            />
            <Select
              value={form.sample_id || "none"}
              onValueChange={(value) => {
                const next = value === "none" ? "" : value;
                setField("sample_id", next);
                setSelectedSampleId(next);
              }}
              disabled={loadingSamples}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingSamples ? "Loading samples..." : "Pick from samples"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {selectedSampleMissing ? (
                  <SelectItem value={form.sample_id}>Sample #{form.sample_id} (current)</SelectItem>
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
          </div>
          <div className="space-y-2">
            <Label>Work Order No</Label>
            <Input
              value={form.workorder_no}
              onChange={(e) => setField("workorder_no", e.target.value)}
              placeholder="WO number"
            />
          </div>
          <div className="space-y-2">
            <Label>Floor No</Label>
            <Input
              value={form.floor_no}
              onChange={(e) => setField("floor_no", String(e.target.value || "").replace(/[^\d]/g, ""))}
              placeholder="e.g. 2"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label>Flat No</Label>
            <Input
              value={form.flat_no}
              onChange={(e) => setField("flat_no", String(e.target.value || "").replace(/[^\d]/g, ""))}
              placeholder="e.g. 7"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label>MIR No</Label>
            <Input
              value={form.mirno}
              onChange={(e) => setField("mirno", e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label>Urgency</Label>
            <Select value={form.urgency} onValueChange={(value) => setField("urgency", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select urgency" />
              </SelectTrigger>
              <SelectContent>
                {URGENCY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input value={form.date} onChange={(e) => setField("date", e.target.value)} type="date" />
          </div>
          <div className="space-y-2">
            <Label>Approved By</Label>
            <Input
              value={form.approved_by}
              onChange={(e) => setField("approved_by", e.target.value)}
              placeholder="Approver name"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="Site / location"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Remarks</Label>
            <Textarea
              value={form.remarks}
              onChange={(e) => setField("remarks", e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-base">PR Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" /> Add Row
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[72px]">Sr No</TableHead>
                  <TableHead className="min-w-[260px]">Material Description *</TableHead>
                  <TableHead className="w-[140px]">Unit</TableHead>
                  <TableHead className="w-[150px]">Qty / Flat *</TableHead>
                  <TableHead className="w-[140px]">Total Qty</TableHead>
                  <TableHead className="min-w-[180px]">Item No</TableHead>
                  <TableHead className="min-w-[220px]">Place of Utilisation</TableHead>
                  <TableHead className="w-[64px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No items yet. Add a row to continue.
                    </TableCell>
                  </TableRow>
                ) : (
                  form.items.map((item, index) => (
                    <TableRow key={`item-${index}`}>
                      <TableCell className="align-top font-medium">{index + 1}</TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={item.material_description}
                          onChange={(e) => setItemField(index, "material_description", e.target.value)}
                          placeholder="Material description"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <UnitSelect
                          value={item.unit}
                          onValueChange={(value) => {
                            const converted = convertQuantity(item.req_qty, item.unit, value);
                            setItemField(index, "unit", value);
                            if (converted != null) {
                              setItemField(index, "req_qty", converted);
                            }
                          }}
                          triggerClassName="h-9 w-full"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(getPreviewQtyPerFlatForItem(item, index) || "")}
                          onChange={(e) => setItemField(index, "req_qty", e.target.value)}
                          placeholder="0"
                          className="h-9 w-full"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={String(getPreviewQtyForItem(item, index) || "")}
                          readOnly
                          className="h-9 w-full bg-muted/40"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={item.item_name || item.item_no || item.itemName || ""}
                          onChange={(e) => setItemField(index, "item_no", e.target.value)}
                          placeholder="Item no."
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={item.place_of_utilisation}
                          onChange={(e) => setItemField(index, "place_of_utilisation", e.target.value)}
                          placeholder="Usage area"
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={form.items.length <= 1}
                          className="h-9 w-9 px-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : mode === "edit" ? (
              "Update PR"
            ) : (
              "Create PR"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrViewDialog({ open, onOpenChange, pr }) {
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState("");
  const [signatureLoadError, setSignatureLoadError] = useState(false);
  const [inventoryNameMap, setInventoryNameMap] = useState({});
  const [backpathLoading, setBackpathLoading] = useState(false);
  const [linkedPos, setLinkedPos] = useState([]);
  const [linkedDcs, setLinkedDcs] = useState([]);
  const prFileUrl = pr?.pr_file_path ? api.getApiFileUrl(pr.pr_file_path) : "";
  const signatureUrl = pr?.signature_file_path ? api.getApiFileUrl(pr.signature_file_path) : "";
  const hasSignatureFile = Boolean(pr?.signature_file_path);
  const signaturePath = String(pr?.signature_file_path || "");
  const signatureIsImage = hasSignatureFile && isImageFile(signaturePath);
  const signatureIsPdf = hasSignatureFile && isPdfFile(signaturePath);
  const extractMakeFromRemark = (value) => {
    const t = String(value || "").trim();
    if (!t) return "";
    const m = t.match(/\bmake\s*:\s*(.+)$/i);
    return m ? String(m[1] || "").trim() : "";
  };

  useEffect(() => {
    let mounted = true;
    const loadInventoryNames = async () => {
      if (!open || !pr) {
        if (mounted) setInventoryNameMap({});
        return;
      }
      const ids = Array.from(
        new Set(
          (Array.isArray(pr.items) ? pr.items : [])
            .map((item) => Number(item?.inventory_id))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      );
      if (ids.length === 0) {
        if (mounted) setInventoryNameMap({});
        return;
      }

      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await api.getInventoryChain(id);
            const item = res?.data?.item || {};
            const name = String(item.name || "").trim();
            return [id, name || null];
          } catch {
            return [id, null];
          }
        })
      );

      if (!mounted) return;
      const next = {};
      entries.forEach(([id, name]) => {
        if (name) next[id] = name;
      });
      setInventoryNameMap(next);
    };

    loadInventoryNames();
    return () => {
      mounted = false;
    };
  }, [open, pr?.pr_id]);

  useEffect(() => {
    let objectUrl = "";
    const loadSignature = async () => {
      if (!hasSignatureFile) {
        setSignaturePreviewUrl("");
        setSignatureLoadError(false);
        return;
      }
      setSignatureLoadError(false);

      // Images render fine via direct URL in <img>. Only attempt conversion for PDFs.
      if (signatureIsImage) {
        setSignaturePreviewUrl("");
        return;
      }

      const dataUrl = await getSignaturePreviewDataUrl(pr.signature_file_path);
      if (dataUrl) {
        setSignaturePreviewUrl(dataUrl);
        return;
      }
      const blob = await fetchFileAsBlob(signatureUrl);
      if (blob && blob.size > 0) {
        objectUrl = URL.createObjectURL(blob);
        setSignaturePreviewUrl(objectUrl);
      } else {
        setSignaturePreviewUrl("");
      }
    };
    loadSignature();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasSignatureFile, pr?.signature_file_path, signatureUrl, signatureIsImage]);

  useEffect(() => {
    let mounted = true;
    const loadBackpath = async () => {
      const prId = pr?.pr_id;
      if (!open || !prId) {
        if (mounted) {
          setLinkedPos([]);
          setLinkedDcs([]);
        }
        return;
      }
      setBackpathLoading(true);
      try {
        const res = await api.getBackpathByPr(prId, { page: 1, limit: 200 });
        const payload = res?.success ? (res.data ?? res) : null;
        const pos = Array.isArray(payload?.pos) ? payload.pos : [];
        const dcs = Array.isArray(payload?.dcs) ? payload.dcs : [];
        if (!mounted) return;
        setLinkedPos(pos);
        setLinkedDcs(dcs);
      } catch {
        if (!mounted) return;
        setLinkedPos([]);
        setLinkedDcs([]);
      } finally {
        if (mounted) setBackpathLoading(false);
      }
    };
    loadBackpath();
    return () => {
      mounted = false;
    };
  }, [open, pr?.pr_id]);

  if (!pr) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{formatPrNumber(pr)}</DialogTitle>
          <DialogDescription>Request details and uploaded documents.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Project</p>
            <p className="font-medium">{pr.project_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Work Order</p>
            <p className="font-medium">{pr.workorder_no}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Floor No</p>
            <p className="font-medium">{pr.floor_no}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Flat No</p>
            <p className="font-medium">{pr.flat_no}</p>
          </div>
          <div>
            <p className="text-muted-foreground">MIR No</p>
            <p className="font-medium">{pr.mirno}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(pr.date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Urgency</p>
            <p className="font-medium">{pr.urgency}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved By</p>
            <div className="mt-2 w-full max-w-[220px]">
              <div className="flex h-20 items-center justify-center rounded border border-border bg-background">
                {!hasSignatureFile ? (
                  pr.approved_by ? (
                    <span className="text-xs font-medium text-muted-foreground">{pr.approved_by}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No signature</span>
                  )
                ) : signatureIsImage ? (
                  signatureLoadError ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={signatureUrl} target="_blank" rel="noreferrer">
                        <FileSignature className="mr-2 h-4 w-4" /> View Signature
                      </a>
                    </Button>
                  ) : (
                    <img
                      src={signatureUrl}
                      alt="Signature"
                      className="h-16 w-full object-contain px-2"
                      onError={() => setSignatureLoadError(true)}
                    />
                  )
                ) : signaturePreviewUrl ? (
                  <img
                    src={signaturePreviewUrl}
                    alt="Signature"
                    className="h-16 w-full object-contain px-2"
                  />
                ) : signatureIsPdf ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={signatureUrl} target="_blank" rel="noreferrer">
                      <FileSignature className="mr-2 h-4 w-4" /> View Signature (PDF)
                    </a>
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <a href={signatureUrl} target="_blank" rel="noreferrer">
                      <FileSignature className="mr-2 h-4 w-4" /> View Signature
                    </a>
                  </Button>
                )}
              </div>
              <div className="mt-1 text-center text-xs font-semibold text-muted-foreground">Approved By</div>
            </div>
          </div>
          <div className="md:col-span-3">
            <p className="text-muted-foreground">Location</p>
            <p className="font-medium">{normalizeLocationText(pr.location)}</p>
          </div>
          {pr.remarks ? (
            <div className="md:col-span-3">
              <p className="text-muted-foreground">Remarks</p>
              <p className="font-medium">{pr.remarks}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {prFileUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={prFileUrl} target="_blank" rel="noreferrer">
                <FileText className="mr-2 h-4 w-4" /> View PR File
              </a>
            </Button>
          ) : null}
          {signatureUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={signatureUrl} target="_blank" rel="noreferrer">
                <FileSignature className="mr-2 h-4 w-4" /> View Signature
              </a>
            </Button>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items ({pr.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Item No</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Place</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pr.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      No items.
                    </TableCell>
                  </TableRow>
                ) : (
                  pr.items.map((item, idx) => (
                      <TableRow key={`${item.pr_item_id || idx}`}>
                      <TableCell className="font-medium">
                        {item.item_no || item.boq_item_code || item.item_code || item.item_name || item.itemName || item.make || item.Make || extractMakeFromRemark(item.remark) || "-"}
                      </TableCell>
                      <TableCell>
                        {inventoryNameMap?.[Number(item?.inventory_id)] || item.material_description || "-"}
                      </TableCell>
                      <TableCell>{item.unit || "-"}</TableCell>
                      <TableCell>{item.req_qty ?? "-"}</TableCell>
                      <TableCell>{item.place_of_utilisation || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Linked Purchase Orders</CardTitle>
                <Badge variant="secondary">{linkedPos.length} PO(s)</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {backpathLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading linked records…
                </div>
              ) : linkedPos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No PO linked to this PR.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">PO No</TableHead>
                      <TableHead className="w-[200px]">Created</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedPos.map((po, idx) => (
                      <TableRow key={String(po?.po_id ?? po?.id ?? idx)}>
                        <TableCell className="font-medium">{po?.order_no || po?.po_no || po?.po_id || po?.id || "-"}</TableCell>
                        <TableCell>{po?.created_at ? formatDate(po.created_at) : "-"}</TableCell>
                        <TableCell>{po?.status || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Linked Delivery Challans (DC)</CardTitle>
                <Badge variant="secondary">{linkedDcs.length} DC(s)</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {backpathLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading linked records…
                </div>
              ) : linkedDcs.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No DC linked to this PR.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">DC No</TableHead>
                      <TableHead className="w-[200px]">Created</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedDcs.map((dc, idx) => (
                      <TableRow key={String(dc?.dc_id ?? dc?.id ?? idx)}>
                        <TableCell className="font-medium">
                          {dc?.challan_number || dc?.dc_number || dc?.dc_no || dc?.dc_id || dc?.id || "-"}
                        </TableCell>
                        <TableCell>{dc?.created_at ? formatDate(dc.created_at) : "-"}</TableCell>
                        <TableCell>{dc?.status || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PurchaseRequests() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { selectedProject } = useProject();
  const { toast } = useToast();

  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingPrId, setEditingPrId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deletingPrId, setDeletingPrId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetPr, setDeleteTargetPr] = useState(null);
  const [linkingPrId, setLinkingPrId] = useState(null);
  const [selectedPr, setSelectedPr] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const [sampleOptions, setSampleOptions] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailPr, setEmailPr] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [poOfficerEmail, setPoOfficerEmail] = useState("");
  const [poOfficers, setPoOfficers] = useState([]);
  const [loadingPoOfficers, setLoadingPoOfficers] = useState(false);
  const [poOfficersError, setPoOfficersError] = useState("");
  const [selectedPoOfficerId, setSelectedPoOfficerId] = useState("");
  const [emailAttachments, setEmailAttachments] = useState([]);
  const [autoEmailAttachments, setAutoEmailAttachments] = useState([]);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [emailRemarks, setEmailRemarks] = useState("");
  const [emailLogs, setEmailLogs] = useState([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);

  const effectiveProjectId = useMemo(
    () => parseIntegerOrNull(projectId) || parseIntegerOrNull(selectedProject?.project_id || selectedProject?.id),
    [projectId, selectedProject]
  );

  const getResolvedSampleId = () => String(form.sample_id || selectedSampleId || "").trim();

  const getSampleDisplay = (sampleId) => {
    const id = String(sampleId ?? "").trim();
    if (!id) return "-";
    return id;
  };

  const getPrSampleDisplay = (pr) => {
    if (!pr) return "-";
    return getSampleDisplay(pr.sample_id);
  };

  const loadPrs = async ({ mode = "auto", sampleId } = {}) => {
    try {
      setLoading(true);

      let result;
      if (mode === "sample" && sampleId) {
        result = await api.getPrsBySample(sampleId);
      } else if (mode === "all") {
        result = effectiveProjectId ? await api.getPrsByProject(effectiveProjectId) : { success: true, data: [] };
      } else {
        result = effectiveProjectId ? await api.getPrsByProject(effectiveProjectId) : { success: true, data: [] };
      }

      if (!result.success) {
        setPrs([]);
        toast({
          title: "Failed to load PRs",
          description: result.error || "Could not fetch purchase requests.",
          variant: "destructive",
        });
        return;
      }

      const rows = Array.isArray(result.data) ? result.data : [];
      setPrs(rows.map(normalizePr));
    } catch {
      setPrs([]);
      toast({
        title: "Failed to load PRs",
        description: "Could not fetch purchase requests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrs();
  }, [projectId, effectiveProjectId]);

  const handleLinkInventory = async (pr) => {
    if (!pr?.pr_id) return;
    setLinkingPrId(pr.pr_id);
    try {
      const result = await api.autoMatchPrInventory(pr.pr_id);
      if (!result.success) {
        toast({
          title: "Linking failed",
          description: result.error || "Could not link inventory items.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Inventory linked successfully",
        description: "Review the matches.",
      });
      await loadPrs();
    } catch (error) {
      toast({
        title: "Linking failed",
        description: error?.message || "Could not link inventory items.",
        variant: "destructive",
      });
    } finally {
      setLinkingPrId(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSampleOptions = async () => {
      setLoadingSamples(true);
      try {
        const result = effectiveProjectId
          ? await api.getSamplesByProject(effectiveProjectId)
          : await api.getSamples();

        if (!mounted) return;
        if (!result.success || !Array.isArray(result.data)) {
          setSampleOptions([]);
          return;
        }

        const byId = new Map();
        result.data.forEach((sample) => {
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

    loadSampleOptions();
    return () => {
      mounted = false;
    };
  }, [effectiveProjectId]);

  const totalItems = useMemo(
    () => prs.reduce((sum, pr) => sum + (Array.isArray(pr.items) ? pr.items.length : 0), 0),
    [prs]
  );

  const highUrgencyCount = useMemo(
    () => prs.filter((pr) => String(pr.urgency).toLowerCase() === "high").length,
    [prs]
  );

  const filteredPrs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return prs.filter((pr) => {
      if (urgencyFilter !== "all" && String(pr.urgency).toLowerCase() !== urgencyFilter) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        pr.pr_id,
        pr.project_name,
        pr.workorder_no,
        pr.floor_no,
        pr.flat_no,
        normalizeLocationText(pr.location),
        pr.mirno,
        pr.approved_by,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [prs, query, urgencyFilter]);

  const openEditDialog = (pr) => {
    setEditingPrId(pr.pr_id);
    setSelectedSampleId(pr.sample_id != null && pr.sample_id !== "" ? String(pr.sample_id) : (pr.sampleId != null && pr.sampleId !== "" ? String(pr.sampleId) : ""));
    setForm({
      project_id: pr.project_id ? String(pr.project_id) : "",
      sample_id: pr.sample_id != null && pr.sample_id !== "" ? String(pr.sample_id) : (pr.sampleId != null && pr.sampleId !== "" ? String(pr.sampleId) : ""),
      pr_number: pr.pr_number || "",
      project_name: pr.project_name === "-" ? "" : pr.project_name,
      workorder_no: pr.workorder_no === "-" ? "" : pr.workorder_no,
      floor_no: pr.floor_no === "-" ? "" : String(pr.floor_no || pr.floorNo || ""),
      flat_no: pr.flat_no === "-" ? "" : String(pr.flat_no || pr.flatNo || ""),
      location: pr.location === "-" ? "" : normalizeLocationText(pr.location),
      mirno: pr.mirno === "-" ? "" : pr.mirno,
      urgency: pr.urgency || "Medium",
      date: pr.date ? String(pr.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      approved_by: pr.approved_by === "-" ? "" : pr.approved_by,
      remarks: pr.remarks || "",
      pr_file_path: pr.pr_file_path || "",
      signature_file_path: pr.signature_file_path || "",
      prFile: null,
      signatureFile: null,
      items: Array.isArray(pr.items) && pr.items.length > 0
          ? pr.items.map((item) => ({
            material_description: item.material_description || "",
            unit: item.unit || "NOS",
            req_qty: item.req_qty ?? "",
            item_no: item.item_name || item.item_no || item.itemName || "",
            item_name: item.item_name || item.item_no || item.itemName || "",
            item_code: item.item_code || item.code || item.item_no || "",
            boq_item_code: item.boq_item_code || item.boqItemCode || item.item_no || "",
            make: item.make || "",
            place_of_utilisation: item.place_of_utilisation || "",
            inventory_id: item.inventory_id ?? item.inventoryId ?? null,
            issued_qty: item.issued_qty ?? item.issuedQty ?? null,
            boq_id: item.boq_id ?? item.boqId ?? "",
            boq_qty: item.boq_qty ?? item.boqQty ?? "",
            row_source: item.boq_id || item.boqId ? "sample" : "manual",
            add_fields: Array.isArray(item.add_fields) ? item.add_fields : [
              { key: "item_no", value: item.item_no || item.item_name || item.itemName || "" },
              { key: "item_name", value: item.item_name || item.item_no || item.itemName || "" },
              { key: "item_code", value: item.item_code || item.code || item.item_no || "" },
              { key: "boq_item_code", value: item.boq_item_code || item.boqItemCode || item.item_no || "" },
            ],
            sample_total_qty: item.sample_total_qty ?? item.total_qty ?? "",
            sample_qty_per_flat: item.sample_qty_per_flat ?? item.qty_per_flat ?? "",
            sample_flat_count: item.sample_flat_count ?? item.flat_count ?? "",
            sample_floor_count: item.sample_floor_count ?? item.floor_count ?? "",
            sample_multiplier: item.sample_multiplier ?? item.multiplier ?? "",
          }))
        : [createEmptyItem()],
    });
    setFormOpen(true);
  };

  const openViewDialog = async (prId) => {
    const id = parseIntegerOrNull(prId);
    if (!id) return;

    const result = await api.getPrById(id);
    if (!result.success) {
      toast({
        title: "Failed to load PR",
        description: result.error || "Could not fetch PR details.",
        variant: "destructive",
      });
      return;
    }

    const normalizedPr = normalizePr(result.data || {});
    let displayPr = normalizedPr;

    if (normalizedPr.sample_id) {
      try {
        const sampleResult = await api.getSampleById(normalizedPr.sample_id);
        if (sampleResult?.success) {
          const samplePayload = sampleResult.data?.data ?? sampleResult.data ?? null;
          if (samplePayload) {
            displayPr = {
              ...normalizedPr,
              items: enrichPrItemsWithSampleData(normalizedPr, samplePayload),
            };
          }
        }
      } catch {
        // Keep the saved PR rows if the sample cannot be loaded.
      }
    }

    setSelectedPr(displayPr);
    setViewOpen(true);
  };

  const handleSubmitForm = async () => {
    const normalizedProjectId = parseIntegerOrNull(form.project_id);
    if (!normalizedProjectId) {
      toast({
        title: "Validation failed",
        description: "Project ID is required and must be a positive integer.",
        variant: "destructive",
      });
      return;
    }

    if (!String(form.project_name || "").trim()) {
      toast({
        title: "Validation failed",
        description: "Project name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!String(form.pr_number || "").trim()) {
      toast({
        title: "Validation failed",
        description: "PR Number is required.",
        variant: "destructive",
      });
      return;
    }

    const cleanedItems = form.items
      .map((item) => {
        const previewQty = Number(item.req_qty || item.sample_qty_per_flat || item.sample_total_qty || 0);
        const inventoryId = parseIntegerOrNull(item.inventory_id);
        const boqId = parseIntegerOrNull(item.boq_id);
        const itemNo = String(item.item_no || item.item_name || item.itemName || "").trim();
        const isSampleRow = String(item.row_source || "").toLowerCase() === "sample";
        const normalized = {
          item_no: itemNo,
          item_name: itemNo,
          item_code: itemNo,
          boq_item_code: itemNo,
          material_description: String(item.material_description || "").trim(),
          unit: String(item.unit || "").trim() || "NOS",
          req_qty: Number(previewQty),
          make: String(item.make || "").trim(),
          place_of_utilisation: String(item.place_of_utilisation || "").trim(),
          add_fields: [
            { key: "item_no", value: itemNo },
            { key: "item_name", value: itemNo },
            { key: "item_code", value: itemNo },
            { key: "boq_item_code", value: itemNo },
            { key: "material_description", value: String(item.material_description || "").trim() },
            { key: "unit", value: String(item.unit || "").trim() || "NOS" },
            { key: "req_qty", value: String(previewQty) },
            { key: "make", value: String(item.make || "").trim() },
            { key: "place_of_utilisation", value: String(item.place_of_utilisation || "").trim() },
          ],
        };
        if (inventoryId) {
          normalized.inventory_id = inventoryId;
          normalized.issued_qty = Number.isFinite(Number(item.issued_qty)) && Number(item.issued_qty) > 0 ? Number(item.issued_qty) : Number(previewQty);
        }
        if (isSampleRow && boqId) {
          normalized.boq_id = boqId;
          normalized.boq_qty = Number.isFinite(Number(item.boq_qty)) && Number(item.boq_qty) > 0 ? Number(item.boq_qty) : Number(previewQty);
        }
        return normalized;
      })
      .filter((item) => item.material_description && Number.isFinite(item.req_qty) && item.req_qty > 0);

    if (cleanedItems.length === 0) {
      toast({
        title: "Validation failed",
        description: "Add at least one item with description and quantity.",
        variant: "destructive",
      });
      return;
    }

    try {
      setFormSubmitting(true);

      let prFilePath = form.pr_file_path;
      let signatureFilePath = form.signature_file_path;

      if (form.prFile instanceof File) {
        const uploadResult = await api.uploadPrFile(form.prFile);
        if (!uploadResult.success) {
          toast({
            title: "PR file upload failed",
            description: uploadResult.error || "Could not upload PR file.",
            variant: "destructive",
          });
          return;
        }
        prFilePath = uploadResult.data?.filePath || "";
      }

      if (form.signatureFile instanceof File) {
        const signatureResult = await api.uploadPrSignature(form.signatureFile);
        if (!signatureResult.success) {
          toast({
            title: "Signature upload failed",
            description: signatureResult.error || "Could not upload signature file.",
            variant: "destructive",
          });
          return;
        }
        signatureFilePath = signatureResult.data?.filePath || "";
      }

      const payload = {
        project_id: normalizedProjectId,
        sample_id: getResolvedSampleId() || "",
        pr_number: String(form.pr_number || "").trim(),
        project_name: String(form.project_name || "").trim(),
        workorder_no: String(form.workorder_no || "").trim(),
        floor_no: String(form.floor_no || "").trim(),
        flat_no: String(form.flat_no || "").trim(),
        location: String(form.location || "").trim(),
        mirno: String(form.mirno || "").trim(),
        urgency: form.urgency || "Medium",
        date: form.date || new Date().toISOString().slice(0, 10),
        items: cleanedItems.map((item) => {
          const isSampleRow = String(item.row_source || "").toLowerCase() === "sample";
          const base = {
            material_description: item.material_description,
            unit: item.unit,
            req_qty: item.req_qty,
            make: item.make,
            place_of_utilisation: item.place_of_utilisation,
            item_no: item.item_no || "",
            item_name: item.item_no || "",
            item_code: item.item_no || "",
            boq_item_code: item.item_no || "",
          };
          if (item.inventory_id) {
            base.inventory_id = item.inventory_id;
            base.issued_qty = item.issued_qty ?? item.req_qty;
          }
          if (isSampleRow && item.boq_id) {
            base.boq_id = item.boq_id;
            base.boq_qty = item.boq_qty ?? item.req_qty;
          }
          return base;
        }),
      };

      if (editingPrId) {
        payload.approved_by = String(form.approved_by || "").trim();
        payload.remarks = String(form.remarks || "").trim();
        payload.pr_file_path = prFilePath;
        payload.signature_file_path = signatureFilePath;
      }

      const response = editingPrId
        ? await api.updatePr(editingPrId, payload)
        : await api.createPr(payload);

      if (!response.success) {
        toast({
          title: editingPrId ? "Update failed" : "Create failed",
          description: response.error || "Unable to save PR.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: editingPrId ? "PR updated" : "PR created",
        description: editingPrId
          ? "Purchase request updated successfully."
          : `Purchase request created successfully. ${String(response.data?.pr_number || payload.pr_number).trim()}`,
      });

      setFormOpen(false);
      setEditingPrId(null);
      await loadPrs();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeletePr = async (prId) => {
    const id = parseIntegerOrNull(prId);
    if (!id) return;

    try {
      setDeletingPrId(id);
      const result = await api.deletePr(id);
      if (!result.success) {
        toast({
          title: "Delete failed",
          description: result.error || "Could not delete PR.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "PR deleted", description: "Purchase request removed successfully." });
      await loadPrs();
    } finally {
      setDeletingPrId(null);
    }
  };

  const openDeleteConfirm = (pr) => {
    const id = parseIntegerOrNull(pr?.pr_id ?? pr?.id ?? pr);
    if (!id) return;
    const label =
      typeof pr === "object" && pr
        ? formatPrNumber(pr)
        : `PR #${id}`;
    setDeleteTargetPr({ id, label });
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (deletingPrId) return;
    setDeleteConfirmOpen(false);
    setDeleteTargetPr(null);
  };

  const confirmDeletePr = async () => {
    if (!deleteTargetPr?.id) return;
    await handleDeletePr(deleteTargetPr.id);
    setDeleteConfirmOpen(false);
    setDeleteTargetPr(null);
  };

  const openEmailDialog = async (pr) => {
    setEmailPr(pr);
    setEmailDialogOpen(true);
    setPoOfficerEmail("");
    setSelectedPoOfficerId("");
    setPoOfficers([]);
    setPoOfficersError("");
    setEmailAttachments([]);
    setAutoEmailAttachments([]);
    setIsFileDragActive(false);
    setEmailRemarks("");
    setEmailLogs([]);

    if (pr?.signature_file_path) {
      try {
        const signatureUrl = api.getApiFileUrl(pr.signature_file_path);
        const signatureName = String(pr.signature_file_path).split("/").pop() || "signature";
        const blob = await fetchFileAsBlob(signatureUrl);
        if (blob && blob.size > 0) {
          setAutoEmailAttachments([new File([blob], signatureName, { type: blob.type || "application/octet-stream" })]);
        }
      } catch {
        setAutoEmailAttachments([]);
      }
    }

    if (pr?.pr_id || pr?.id) {
      try {
        setLoadingEmailLogs(true);
        const logResult = await api.getPrEmailLogs(pr.pr_id || pr.id);
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
    }
  };

  useEffect(() => {
    let active = true;

    const loadPoOfficers = async () => {
      setLoadingPoOfficers(true);
      setPoOfficersError("");
      try {
        const result = await api.getUsers();
        if (!active) return;
        if (result.success && Array.isArray(result.data)) {
          const normalized = result.data
            .map((user) => ({
              id: String(user.user_id ?? user.id ?? user._id ?? user.email ?? user.name ?? ""),
              name: String(user.name || user.username || user.email || "PO Officer"),
              email: String(user.email || ""),
              role: String(user.role || user.role_id || user.roleId || ""),
            }))
            .filter((user) => {
              const role = user.role.toLowerCase().replace(/[_\s-]+/g, "_");
              return role === "po_officer";
            })
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

          setPoOfficers(normalized);

          if (normalized.length === 0) {
            setPoOfficerEmail("");
            setSelectedPoOfficerId("");
            return;
          }

          if (!selectedPoOfficerId && !poOfficerEmail.trim()) {
            const first = normalized[0];
            setSelectedPoOfficerId(first.id);
            setPoOfficerEmail(first.email || "");
          }
        } else if (result.success) {
          setPoOfficers([]);
          setPoOfficersError("No PO officers found.");
          setPoOfficerEmail("");
          setSelectedPoOfficerId("");
        } else {
          setPoOfficers([]);
          setPoOfficersError(result.error || "Failed to load PO officers.");
          setPoOfficerEmail("");
          setSelectedPoOfficerId("");
        }
      } catch {
        if (!active) return;
        setPoOfficers([]);
        setPoOfficersError("Failed to load PO officers.");
        setPoOfficerEmail("");
        setSelectedPoOfficerId("");
      } finally {
        if (active) setLoadingPoOfficers(false);
      }
    };

    if (emailDialogOpen) {
      loadPoOfficers();
    }

    return () => {
      active = false;
    };
  }, [emailDialogOpen]);


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
    setEmailAttachments(normalized);
  };

  const handleAttachmentDrop = (event) => {
    event.preventDefault();
    setIsFileDragActive(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) handleAttachmentSelect(files);
  };

  const handleSendPrEmail = async () => {
    if (!emailPr) return;

    const to = String(poOfficerEmail || "").trim();
    if (!to) {
      toast({
        title: "Add PO officer email",
        description: "Enter the PO officer email address.",
        variant: "destructive",
      });
      return;
    }

    const poId =
      emailPr?.po_id ||
      emailPr?.poId ||
      emailPr?.po?.po_id ||
      emailPr?.po?.id ||
      emailPr?.purchase_order_id;

    try {
      setEmailSending(true);
      const attachmentFiles = [...autoEmailAttachments, ...emailAttachments];

      const result = poId
        ? await api.sendPoEmail({
            poId: Number(poId),
            to,
            attachmentFiles,
            message: String(emailRemarks || "").trim(),
          })
        : await api.sendPrEmail({
            prId: emailPr?.pr_id || emailPr?.id,
            to,
            attachmentFiles,
            message: String(emailRemarks || "").trim(),
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
      setEmailPr(null);
      setPoOfficerEmail("");
      setEmailAttachments([]);
      setEmailRemarks("");
      setEmailLogs([]);
      toast({
        title: "Email sent",
        description: `PO sent to ${to}.`,
      });
    } finally {
      setEmailSending(false);
    }
  };

  const downloadMaterialRequestPdf = async (prInput, { signatureFile } = {}) => {
    if (!prInput) return;
    try {
      setPdfDownloading(true);
      const pr = normalizePr(prInput);
      const signatureUrl = pr.signature_file_path ? api.getApiFileUrl(pr.signature_file_path) : "";

      let signatureDataUrl = "";
      // Prefer the already-fetched signature file (auto attachment) if available.
      const autoSignatureFile = signatureFile instanceof File ? signatureFile : null;
      if (autoSignatureFile instanceof File && autoSignatureFile.size > 0) {
        try {
          const sniffed = await sniffFileKind(autoSignatureFile, autoSignatureFile.name);
          if (sniffed.kind === "pdf") {
            const images = await extractImagesFromPdf(autoSignatureFile, {
              pageRange: { start: 1, end: 1 },
              maxPages: 1,
              batchSize: 1,
              scale: 1.2,
              quality: 0.9,
            });
            signatureDataUrl = images?.[0]?.imageDataUrl || "";
          } else if (sniffed.kind === "image") {
            const typedBlob = autoSignatureFile.slice(0, autoSignatureFile.size, sniffed.mime);
            const dataUrl = await blobToDataUrl(typedBlob);
            signatureDataUrl = await ensurePdfCompatibleImageDataUrl(String(dataUrl || ""));
          }
        } catch {
          signatureDataUrl = "";
        }
      }

      if (!signatureDataUrl && signatureUrl && pr.signature_file_path) {
        try {
          const blob = await fetchFileAsBlob(signatureUrl);
          if (blob && blob.size > 0) {
            const sniffed = await sniffFileKind(blob, pr.signature_file_path);
            if (sniffed.kind === "pdf") {
              const file = new File([blob], "signature.pdf", { type: "application/pdf" });
              const images = await extractImagesFromPdf(file, {
                pageRange: { start: 1, end: 1 },
                maxPages: 1,
                batchSize: 1,
                scale: 1.2,
                quality: 0.9,
              });
              signatureDataUrl = images?.[0]?.imageDataUrl || "";
            } else if (sniffed.kind === "image") {
              const typedBlob = blob.slice(0, blob.size, sniffed.mime);
              const dataUrl = await blobToDataUrl(typedBlob);
              signatureDataUrl = await ensurePdfCompatibleImageDataUrl(String(dataUrl || ""));
            } else {
              // Last resort: try the existing helper (may still succeed for some cases).
              signatureDataUrl = await getSignaturePreviewDataUrl(pr.signature_file_path || "");
            }
          }
        } catch {
          signatureDataUrl = "";
        }
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setDrawColor(0);
      doc.setTextColor(0);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const frameX = margin;
      const frameY = margin;
      const frameW = pageWidth - margin * 2;
      const frameH = pageHeight - margin * 2;

      const titleH = 10;
      const headerRowH = 8;
      const splitW = 130;
      const splitX = frameX + splitW;

      const renderFrame = () => {
        doc.setLineWidth(0.5);
        doc.rect(frameX, frameY, frameW, frameH);
      };

      const renderTitleAndHeader = () => {
        renderFrame();

        doc.setLineWidth(0.5);
        doc.line(frameX, frameY + titleH, frameX + frameW, frameY + titleH);

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text("Material Request", frameX + frameW / 2, frameY + 7, { align: "center" });

        const leftX = frameX + 2.5;
        const rightX = splitX + 2.5;
        doc.setFont("times", "normal");
        doc.setFontSize(10.5);
        const locationLabel = "Location :-";
        const locationLabelW = doc.getTextWidth(locationLabel);
        const locationText = normalizeLocationText(pr.location);
        const locationMaxWidth = Math.max(30, splitX - (leftX + locationLabelW + 3));
        const locationLines = doc.splitTextToSize(locationText, locationMaxWidth);
        const locationRowH = Math.max(8, (Array.isArray(locationLines) ? locationLines.length : 1) * 4.2 + 4);
        const headerRowHeights = [headerRowH, headerRowH, locationRowH, headerRowH, headerRowH];
        const headerH = headerRowHeights.reduce((sum, height) => sum + height, 0);
        const headerY = frameY + titleH;
        doc.rect(frameX, headerY, frameW, headerH);
        doc.line(splitX, headerY, splitX, headerY + headerH);

        let runningY = headerY;
        for (let i = 0; i < headerRowHeights.length - 1; i += 1) {
          runningY += headerRowHeights[i];
          doc.line(frameX, runningY, frameX + frameW, runningY);
        }

        const drawLabelValue = (label, value, x, y, { maxWidth } = {}) => {
          doc.setFont("times", "bold");
          doc.setFontSize(10.5);
          doc.text(label, x, y);
          const labelW = doc.getTextWidth(label);
          doc.setFont("times", "normal");
          const text = String(value || "-");
          const textX = x + labelW + 1;

          if (maxWidth) {
            const wrapped = doc.splitTextToSize(text, maxWidth);
            doc.text(wrapped, textX, y);
            return Array.isArray(wrapped) ? wrapped.length : 1;
          }

          doc.text(text, textX, y);
          return 1;
        };

        const rowTop = (index) => {
          return headerY + headerRowHeights.slice(0, index).reduce((sum, height) => sum + height, 0);
        };
        const rowTextY = (index) => rowTop(index) + 5.4;

        drawLabelValue("Project Name :-", pr.project_name || "-", leftX, rowTextY(0));
        drawLabelValue("Date :-", formatDateDmy(pr.date), rightX, rowTextY(0));
        drawLabelValue("Work Order No.:-", pr.workorder_no || "-", leftX, rowTextY(1));
        drawLabelValue("Floor No.:-", pr.floor_no || pr.floorNo || "-", rightX, rowTextY(1));
        drawLabelValue("Location :-", locationText, leftX, rowTextY(2), { maxWidth: locationMaxWidth });
        drawLabelValue("Flat No.:-", pr.flat_no || pr.flatNo || "-", rightX, rowTextY(2));

        drawLabelValue("Sample ID :-", pr.sample_id || "-", leftX, rowTextY(3));
        drawLabelValue("Urgency :-", pr.urgency || "-", leftX, rowTextY(4));

        return { headerH };
      };

      const { headerH } = renderTitleAndHeader();

      const tableStartY = frameY + titleH + headerH;
      const sampleData = pr.sample_id ? await api.getSampleById(pr.sample_id).catch(() => null) : null;
      const samplePayload = sampleData?.success ? sampleData.data : sampleData?.data || sampleData || null;
      const items = enrichPrItemsWithSampleData(pr, samplePayload);
      const minRows = 15;
      const tableRows = Array.from({ length: Math.max(items.length, minRows) }, (_, idx) => {
        const item = items[idx] || {};
        return [
          String(item.boq_serial_no || ""),
          String(item.item_no || ""),
          String(item.description || item.material_description || ""),
          String(item.unit || ""),
          item.req_qty == null ? "" : String(item.req_qty),
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: frameX, right: frameX },
        tableWidth: frameW,
        theme: "grid",
        head: [["BOQ No.", "Item No.", "Description", "Unit", "Qty"]],
        body: tableRows,
        styles: {
          font: "times",
          fontSize: 9.5,
          cellPadding: 1.5,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fontStyle: "bold",
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 44 },
          2: { cellWidth: 82 },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 28, halign: "center" },
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            renderFrame();
          }
        },
      });

      const footerH = 20;
      const footerY = pageHeight - margin - footerH;
      const lastTableY = doc.lastAutoTable?.finalY || tableStartY;
      if (lastTableY > footerY - 3) {
        doc.addPage();
        renderFrame();
      }

      const lastPageNumber = doc.getNumberOfPages();
      doc.setPage(lastPageNumber);

      const colW = frameW / 3;
      doc.setLineWidth(0.5);
      doc.line(frameX, footerY, frameX + frameW, footerY);
      doc.line(frameX + colW, footerY, frameX + colW, frameY + frameH);
      doc.line(frameX + colW * 2, footerY, frameX + colW * 2, frameY + frameH);

      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.text("Requested BY :", frameX + colW / 2, footerY + footerH - 4, { align: "center" });
      doc.text("Checked By :", frameX + colW + colW / 2, footerY + footerH - 4, { align: "center" });
      doc.text("Approved By :", frameX + colW * 2 + colW / 2, footerY + footerH - 4, { align: "center" });

      // Draw signature box inside Approved By column
      const sigBoxW = colW - 16;
      const sigBoxH = 16;
      const sigBoxX = frameX + colW * 2 + 8;
      const sigBoxY = footerY + 2;
      doc.rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH);

      if (signatureDataUrl && String(signatureDataUrl).startsWith("data:image/")) {
        const isPng = signatureDataUrl.startsWith("data:image/png");
        const isJpeg = signatureDataUrl.startsWith("data:image/jpeg") || signatureDataUrl.startsWith("data:image/jpg");
        const type = isPng ? "PNG" : isJpeg ? "JPEG" : "JPEG";
        const imgW = sigBoxW - 4;
        const imgH = sigBoxH - 4;
        const imgX = sigBoxX + 2;
        const imgY = sigBoxY + 2;
        doc.addImage(signatureDataUrl, type, imgX, imgY, imgW, imgH);
      } else if (pr.signature_file_path) {
        doc.setFont("times", "normal");
        doc.setFontSize(8);
        doc.text("Signature attached", frameX + colW * 2 + colW / 2, footerY + 10, { align: "center" });
      } else if (pr.approved_by && pr.approved_by !== "-") {
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        doc.text(String(pr.approved_by), frameX + colW * 2 + colW / 2, footerY + 10, { align: "center" });
      }

      const filename = `Material-Request-${formatPrNumber(pr)}.pdf`;
      doc.save(filename);
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate the PDF.",
        variant: "destructive",
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const downloadMaterialRequestExcelFile = async (prInput) => {
    if (!prInput) return;
    try {
      setPdfDownloading(true);
      const pr = normalizePr(prInput);
      const filename = `Material-Request-${formatPrNumber(pr)}.xlsx`;
      await downloadMaterialRequestExcel(pr, filename);
    } catch {
      toast({
        title: "Download failed",
        description: "Could not generate the Excel file.",
        variant: "destructive",
      });
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleDownloadMaterialRequest = async () => {
    if (!emailPr) return;
    const signatureFile =
      Array.isArray(autoEmailAttachments) && autoEmailAttachments.length > 0 ? autoEmailAttachments[0] : null;
    await downloadMaterialRequestPdf(emailPr, { signatureFile });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Purchase Requests</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage PR lifecycle with project-scoped API endpoints.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:flex lg:w-auto">
            <Button variant="outline" onClick={() => loadPrs()}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => navigate("create")}>
              <Plus className="mr-2 h-4 w-4" /> Create PR
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/10">
            <CardDescription>Total PRs</CardDescription>
            <CardTitle className="text-2xl">{prs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/10">
            <CardDescription>High Urgency</CardDescription>
            <CardTitle className="text-2xl">{highUrgencyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="pb-2 bg-muted/10">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">{totalItems}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter purchase requests.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-9">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by PR ID, project, WO, location, MIR..."
            />
          </div>

          <div className="md:col-span-3">
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>PR List</CardTitle>
          <CardDescription>All purchase requests for the selected scope.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>PR</TableHead>
                <TableHead>Sample ID</TableHead>
                <TableHead>Work Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Files</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading purchase requests...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredPrs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No purchase requests found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPrs.map((pr) => {
                  const urgency = String(pr.urgency || "").toLowerCase();
                  const urgencyClass =
                    urgency === "high"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : urgency === "medium"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-sky-200 bg-sky-50 text-sky-700";
                  const needsInventoryLink = (pr.items || []).some((item) => !item?.inventory_id);

                  return (
                    <TableRow
                      key={pr.pr_id}
                      className="cursor-pointer"
                      onClick={() => openViewDialog(pr.pr_id)}
                    >
                      <TableCell className="font-medium">{getPrListNumber(pr)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{getPrSampleDisplay(pr)}</div>
                      </TableCell>
                      <TableCell>{pr.workorder_no}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {formatDate(pr.date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={urgencyClass}>
                          {pr.urgency}
                        </Badge>
                      </TableCell>
                      <TableCell>{pr.items.length}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pr.pr_file_path ? (
                            <Badge variant="secondary">
                              <FileText className="mr-1 h-3 w-3" /> PR
                            </Badge>
                          ) : null}
                          {pr.signature_file_path ? (
                            <Badge variant="secondary">
                              <FileSignature className="mr-1 h-3 w-3" /> Sign
                            </Badge>
                          ) : null}
                          {!pr.pr_file_path && !pr.signature_file_path ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <RowActionsMenu
                            items={[
                              { key: "view", label: "View", icon: Eye, onSelect: () => openViewDialog(pr.pr_id) },
                              { key: "edit", label: "Edit", icon: Pencil, onSelect: () => openEditDialog(pr) },
                              { type: "separator" },
                              { key: "email", label: "Email", icon: Mail, onSelect: () => openEmailDialog(pr) },
                              { key: "download-pdf", label: "Download PDF", icon: Download, onSelect: () => downloadMaterialRequestPdf(pr) },
                              { key: "download-excel", label: "Download Excel", icon: FileSpreadsheet, onSelect: () => downloadMaterialRequestExcelFile(pr) },
                              needsInventoryLink ? {
                                key: "link",
                                label: linkingPrId === pr.pr_id ? "Linking..." : "Link to Inventory",
                                icon: Link2,
                                disabled: linkingPrId === pr.pr_id,
                                onSelect: () => handleLinkInventory(pr),
                              } : null,
                              { type: "separator" },
                              {
                                key: "delete",
                                label: deletingPrId === pr.pr_id ? "Deleting..." : "Delete",
                                icon: Trash2,
                                destructive: true,
                                disabled: deletingPrId === pr.pr_id,
                                onSelect: () => openDeleteConfirm(pr),
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>

          <div className="space-y-4 md:hidden">
            {loading ? (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading purchase requests...
                </span>
              </div>
            ) : filteredPrs.length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                No purchase requests found.
              </div>
            ) : (
              filteredPrs.map((pr) => {
                const urgency = String(pr.urgency || "").toLowerCase();
                const urgencyClass =
                  urgency === "high"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : urgency === "medium"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-sky-200 bg-sky-50 text-sky-700";
                const needsInventoryLink = (pr.items || []).some((item) => !item?.inventory_id);

                return (
                  <div
                    key={pr.pr_id}
                    className="rounded-lg border p-4 space-y-3 cursor-pointer"
                    onClick={() => openViewDialog(pr.pr_id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="font-semibold break-words">{getPrListNumber(pr)}</div>
                        <div className="text-sm text-muted-foreground break-words">{getPrSampleDisplay(pr)}</div>
                      </div>
                      <Badge variant="outline" className={urgencyClass}>
                        {pr.urgency}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Work Order</span>
                        <span>{pr.workorder_no || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Date</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> {formatDate(pr.date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Items</span>
                        <span>{pr.items.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Files</span>
                        <div className="flex flex-wrap gap-1">
                          {pr.pr_file_path ? (
                            <Badge variant="secondary">
                              <FileText className="mr-1 h-3 w-3" /> PR
                            </Badge>
                          ) : null}
                          {pr.signature_file_path ? (
                            <Badge variant="secondary">
                              <FileSignature className="mr-1 h-3 w-3" /> Sign
                            </Badge>
                          ) : null}
                          {!pr.pr_file_path && !pr.signature_file_path ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <RowActionsMenu
                          items={[
                            { key: "view", label: "View", icon: Eye, onSelect: () => openViewDialog(pr.pr_id) },
                            { key: "edit", label: "Edit", icon: Pencil, onSelect: () => openEditDialog(pr) },
                            { type: "separator" },
                            { key: "email", label: "Email", icon: Mail, onSelect: () => openEmailDialog(pr) },
                            { key: "download-pdf", label: "Download PDF", icon: Download, onSelect: () => downloadMaterialRequestPdf(pr) },
                            { key: "download-excel", label: "Download Excel", icon: FileSpreadsheet, onSelect: () => downloadMaterialRequestExcelFile(pr) },
                            needsInventoryLink ? {
                              key: "link",
                              label: linkingPrId === pr.pr_id ? "Linking..." : "Link to Inventory",
                              icon: Link2,
                              disabled: linkingPrId === pr.pr_id,
                              onSelect: () => handleLinkInventory(pr),
                            } : null,
                            { type: "separator" },
                            {
                              key: "delete",
                              label: deletingPrId === pr.pr_id ? "Deleting..." : "Delete",
                              icon: Trash2,
                              destructive: true,
                              disabled: deletingPrId === pr.pr_id,
                              onSelect: () => openDeleteConfirm(pr),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <PrFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editingPrId ? "edit" : "create"}
        form={form}
        setForm={setForm}
        setSelectedSampleId={setSelectedSampleId}
        submitting={formSubmitting}
        onSubmit={handleSubmitForm}
        selectedProject={selectedProject}
        sampleOptions={sampleOptions}
        loadingSamples={loadingSamples}
      />

      <PrViewDialog open={viewOpen} onOpenChange={setViewOpen} pr={selectedPr} />

      <Dialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          setEmailDialogOpen(open);
          if (!open) {
            setEmailPr(null);
            setPdfDownloading(false);
            setPoOfficerEmail("");
            setEmailAttachments([]);
            setAutoEmailAttachments([]);
            setIsFileDragActive(false);
            setEmailRemarks("");
            setEmailLogs([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Purchase Request</DialogTitle>
            <DialogDescription>
              Enter the PO officer email address to send this PR.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <div><span className="font-medium">PR:</span> {emailPr ? formatPrNumber(emailPr) : "-"}</div>
              <div><span className="font-medium">Project:</span> {emailPr?.project_name || "-"}</div>
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
                <Upload className="mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Drag and drop files here, or click to upload</p>
                <p className="text-xs text-muted-foreground">Selected files will be uploaded and attached when you send the email.</p>
              </label>
              {emailAttachments.length > 0 ? (
                <div className="space-y-2">
                  {emailAttachments.map((file) => {
                    const key = `${file.name}-${file.size}-${file.lastModified}`;
                    return (
                      <div key={key} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
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
              {autoEmailAttachments.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Auto attached</div>
                  {autoEmailAttachments.map((file) => {
                    const key = `${file.name}-${file.size}-${file.lastModified}`;
                    return (
                      <div key={key} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                        <span className="truncate">{file.name}</span>
                        <Badge variant="secondary">Signature</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Signature</Label>
              {emailPr?.signature_file_path ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  {isImageFile(emailPr.signature_file_path) ? (
                    <img
                      src={api.getApiFileUrl(emailPr.signature_file_path)}
                      alt="Signature"
                      className="max-h-40 w-full object-contain"
                    />
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <a href={api.getApiFileUrl(emailPr.signature_file_path)} target="_blank" rel="noreferrer">
                        <FileSignature className="mr-2 h-4 w-4" /> View Signature
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No signature uploaded for this PR.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                value={emailRemarks}
                onChange={(event) => setEmailRemarks(event.target.value)}
                placeholder="Add any note for the PO officer..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>PO Officer Email</Label>
              <Select
                value={selectedPoOfficerId || ""}
                onValueChange={(value) => {
                  setSelectedPoOfficerId(value);
                  const selected = poOfficers.find((user) => user.id === value);
                  setPoOfficerEmail(selected?.email || "");
                }}
                disabled={loadingPoOfficers || poOfficers.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingPoOfficers ? "Loading PO officers..." : "Select PO officer"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {poOfficers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email || user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {poOfficersError ? (
                <p className="text-xs text-destructive">{poOfficersError}</p>
              ) : null}
              {!poOfficersError && !loadingPoOfficers && poOfficers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No PO officers found.</p>
              ) : null}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadMaterialRequest}
              disabled={emailSending || pdfDownloading || !emailPr}
            >
              {pdfDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Downloading
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download
                </>
              )}
            </Button>
            <Button onClick={handleSendPrEmail} disabled={emailSending || !poOfficerEmail.trim()}>
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

      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (open) setDeleteConfirmOpen(true);
          else closeDeleteConfirm();
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete purchase request?</DialogTitle>
            <DialogDescription>
              This will permanently delete {deleteTargetPr?.label || "this PR"}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteConfirm} disabled={Boolean(deletingPrId)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeletePr}
              disabled={Boolean(deletingPrId) || !deleteTargetPr?.id}
            >
              {deletingPrId === deleteTargetPr?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
