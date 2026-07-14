import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { syncSampleBoqQuantities } from "@/lib/sampleBoqSync";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Eye, Search, Minus, Layers, Save, Trash2 } from "lucide-react";
import InventoryPicker from "@/components/InventoryPicker";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { getSamplePrimaryIdentifier, getSamplePrimaryIdentifierLabel, resolveSampleClient } from "@/lib/sampleDisplay";

const pickSampleFilePath = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      return pickSampleFilePath(parsed);
    } catch {
      return trimmed;
    }
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return first ? first.trim() : "";
  }
  if (typeof value === "object") {
    const candidates = [
      value.filePath,
      value.file_path,
      value.path,
      value.url,
      value.sample_file,
      value.sampleFile,
    ];
    return pickSampleFilePath(candidates.find(Boolean));
  }
  return "";
};

export default function SampleEdit() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const resolvedProject = useResolvedProject();
  const effectiveProjectId = resolvedProject.projectId ? Number(resolvedProject.projectId) : null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inventoryQtyStatus, setInventoryQtyStatus] = useState({});
  const [originalItemDescription, setOriginalItemDescription] = useState([]);
  const [sampleProjectId, setSampleProjectId] = useState("");
  const [sampleClient, setSampleClient] = useState("");
  const [boqPickerOpen, setBoqPickerOpen] = useState(false);
  const [projectBoqItems, setProjectBoqItems] = useState([]);
  const [loadingProjectBoqItems, setLoadingProjectBoqItems] = useState(false);
  const [boqSearch, setBoqSearch] = useState("");
  const [activeBoqClient, setActiveBoqClient] = useState("");
  const [pendingBoqQty, setPendingBoqQty] = useState({});
  const [uploadFilePaths, setUploadFilePaths] = useState([]);
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false);
  const [form, setForm] = useState({
    building_name: "",
    site_name: "",
    work_done: "",
    sample_file: "",
    flats: "",
    location: { floor: "", flat_no: "", block: "", wing: "", coordinates: "" },
    item_description: [{ sr_no: "", item_name: "", item_code: "", code: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }],
    add_fields: []
  });
  const [attachmentOpen, setAttachmentOpen] = useState(false);

  const parseMaybe = (val, fallback) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    }
    return val ?? fallback;
  };

  const toFiniteNumber = (value) => {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  };

  const parsePositiveCount = (value) => {
    const n = toFiniteNumber(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  const getBoqMultiplier = (flatValue, floorValue) => {
    const flatCount = parsePositiveCount(flatValue);
    const floorCount = parsePositiveCount(floorValue);
    return {
      flatCount,
      floorCount,
      multiplier: flatCount > 0 && floorCount > 0 ? flatCount * floorCount : 0,
    };
  };

  const mapLoadedSampleRow = (row) => {
    const raw = row && typeof row === "object" ? row : {};
    const itemFields = parseMaybe(raw?.add_fields, []);
    const fieldVal = (key) => {
      if (!Array.isArray(itemFields)) return "";
      const found = itemFields.find((field) => String(field?.key || "").trim() === key);
      return found?.value ?? "";
    };
    const isBoqRow = Boolean(
      raw?.boq_id ||
        raw?.boqId ||
        raw?.boq_key ||
        raw?.boqKey ||
        raw?.boq_match_key ||
        raw?.boqMatchKey ||
        raw?.boq_item_code ||
        raw?.boqItemCode ||
        fieldVal("boq_id") ||
        fieldVal("boqId") ||
        fieldVal("boq_key") ||
        fieldVal("boqKey") ||
        fieldVal("boq_match_key") ||
        fieldVal("boqMatchKey")
    );
    const itemNo =
      raw?.item_no ??
      raw?.itemNo ??
      fieldVal("item_no") ??
      fieldVal("itemNo") ??
      "";
    const itemCode =
      raw?.item_code ??
      raw?.itemCode ??
      raw?.code ??
      fieldVal("item_code") ??
      fieldVal("itemCode") ??
      fieldVal("code") ??
      raw?.boq_item_code ??
      raw?.boqItemCode ??
      "";
    const boqDescription =
      raw?.boq_description ??
      raw?.boqDescription ??
      raw?.description ??
      fieldVal("boq_description") ??
      fieldVal("boqDescription") ??
      fieldVal("description") ??
      "";
    const resolvedItemName = (() => {
      const candidate = String(
        raw?.item_name ??
          raw?.itemName ??
          fieldVal("item_name") ??
          fieldVal("itemName") ??
          raw?.name ??
          ""
      ).trim();
      if (isBoqRow) return itemNo || candidate || "";
      return candidate || itemNo || String(boqDescription || raw?.description || "").trim();
    })();
    return {
      sr_no: raw?.sr_no ?? raw?.srNo ?? raw?.srno ?? "",
      item_name: resolvedItemName,
      item_no: itemNo,
      item_code: itemCode,
      code: raw?.code ?? itemCode,
      brand_name: raw?.brand_name ?? raw?.brandName ?? fieldVal("brand_name") ?? fieldVal("brandName") ?? "",
      description: raw?.description ?? fieldVal("description") ?? fieldVal("item_description") ?? "",
      boq_description: boqDescription,
      specification: raw?.specification ?? raw?.spec ?? fieldVal("specification") ?? fieldVal("spec") ?? "",
      unit: raw?.unit ?? raw?.uom ?? raw?.UOM ?? fieldVal("unit") ?? fieldVal("uom") ?? fieldVal("UOM") ?? "",
      quantity: raw?.quantity ?? raw?.qty ?? fieldVal("quantity") ?? fieldVal("qty") ?? fieldVal("selected_qty") ?? "",
      value: raw?.value ?? fieldVal("value") ?? fieldVal("amount") ?? "",
      inventory_id: raw?.inventory_id ?? raw?.inventoryId ?? raw?.inventoryID ?? null,
      issued_qty: raw?.issued_qty ?? raw?.issuedQty ?? fieldVal("issued_qty") ?? fieldVal("issuedQty") ?? null,
      boq_id: raw?.boq_id ?? raw?.boqId ?? fieldVal("boq_id") ?? fieldVal("boqId") ?? null,
      boq_qty: raw?.boq_qty ?? raw?.boqQty ?? fieldVal("boq_qty") ?? fieldVal("boqQty") ?? null,
      boq_issued_qty: raw?.boq_issued_qty ?? raw?.boqIssuedQty ?? fieldVal("boq_issued_qty") ?? fieldVal("boqIssuedQty") ?? null,
      qty_per_flat: raw?.qty_per_flat ?? raw?.qtyPerFlat ?? fieldVal("qty_per_flat") ?? fieldVal("qtyPerFlat") ?? "",
      total_qty: raw?.total_qty ?? raw?.totalQty ?? fieldVal("total_qty") ?? fieldVal("totalQty") ?? "",
      selected_qty: raw?.selected_qty ?? raw?.selectedQty ?? fieldVal("selected_qty") ?? fieldVal("selectedQty") ?? "",
      flat_count: raw?.flat_count ?? raw?.flatCount ?? fieldVal("flat_count") ?? fieldVal("flatCount") ?? "",
      floors: raw?.floors ?? raw?.floor_count ?? raw?.floorCount ?? fieldVal("floors") ?? fieldVal("floor_count") ?? fieldVal("floorCount") ?? "",
      boq_flat_multiplier: raw?.boq_flat_multiplier ?? raw?.boqFlatMultiplier ?? fieldVal("boq_flat_multiplier") ?? fieldVal("boqFlatMultiplier") ?? "",
      boq_floor_multiplier: raw?.boq_floor_multiplier ?? raw?.boqFloorMultiplier ?? fieldVal("boq_floor_multiplier") ?? fieldVal("boqFloorMultiplier") ?? "",
      boq_base_qty: raw?.boq_base_qty ?? raw?.boqBaseQty ?? fieldVal("boq_base_qty") ?? fieldVal("boqBaseQty") ?? "",
      boq_key: raw?.boq_key ?? raw?.boqKey ?? fieldVal("boq_key") ?? fieldVal("boqKey") ?? "",
      boq_match_key: raw?.boq_match_key ?? raw?.boqMatchKey ?? fieldVal("boq_match_key") ?? fieldVal("boqMatchKey") ?? "",
      boq_item_code: raw?.boq_item_code ?? raw?.boqItemCode ?? fieldVal("boq_item_code") ?? fieldVal("boqItemCode") ?? "",
      add_fields: Array.isArray(itemFields) ? itemFields : [],
    };
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
    const qty = toFiniteNumber(qtyRaw);
    const rate = toFiniteNumber(rateRaw);
    return {
      id: raw?.boq_id ?? raw?.id ?? "",
      item_no: pickFirst(raw, ["item_no", "itemNo"]),
      item_code: pickFirst(raw, ["item_code", "itemCode", "code"]),
      description: pickFirst(raw, ["description", "item_description", "service_description"]),
      unit: pickFirst(raw, ["unit", "uom", "UOM"]),
      qty: qtyRaw,
      available_qty: qty ?? 0,
      rate: rateRaw,
      amount: amountRaw || (qty != null && rate != null ? String(qty * rate) : ""),
      hsn: pickFirst(raw, ["hsn", "hsn_code", "hsnCode"]),
      sac_code: pickFirst(raw, ["sac_code", "sacCode"]),
      client: pickFirst(raw, ["client", "client_format", "boq_client"]),
    };
  };

  const boqItemKey = (item) => {
    const derived = deriveBoqFields(item);
    return String(derived.id || derived.item_no || derived.item_code || derived.description || "").trim();
  };

  const matchesBoqClient = (item, client) => {
    const c = String(client || "").toLowerCase();
    if (!c) return true;
    const derived = deriveBoqFields(item);
    const explicit = String(derived.client || "").trim().toLowerCase();
    if (explicit && explicit === c) return true;
    const itemNo = String(derived.item_no || derived.item_code || "").trim();
    const hasHsn = String(derived.hsn || "").trim() !== "";
    const hasSac = String(derived.sac_code || "").trim() !== "";
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

  const refreshProjectBoqItems = async () => {
    const pid = sampleProjectId || effectiveProjectId;
    if (!pid) {
      setProjectBoqItems([]);
      return [];
    }

    let client = String(sampleClient || "").toLowerCase();
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
    const filtered = items.filter((it) => matchesBoqClient(it, client));
    if (client === "hiranandani") {
      filtered.sort(compareHiranandaniBoqOrder);
    }
    setProjectBoqItems(filtered);
    return filtered;
  };

  const normalizeBoqRowName = (row) => {
    const itemNo = String(
      row?.item_no ||
        row?.itemNo ||
        row?.item_code ||
        row?.itemCode ||
        row?.code ||
        row?.boq_item_code ||
        row?.boqItemCode ||
        ""
    ).trim();
    return itemNo || "-";
  };

  const addBoqItemToForm = (boqItem, qtyInput) => {
    const derived = deriveBoqFields(boqItem);
    const key = boqItemKey(boqItem);
    if (!key) return;
    const qtySource = qtyInput ?? pendingBoqQty[key];
    const qtyToAdd = Number(String(qtySource ?? "").replace(/,/g, "").trim()) || 0;
    if (qtyToAdd <= 0) {
      toast({ title: "Invalid quantity", description: "Select a valid quantity.", variant: "destructive" });
      return;
    }

    setForm((prev) => {
      const rows = Array.isArray(prev.item_description) ? [...prev.item_description] : [];
      const { flatCount, floorCount, multiplier } = getBoqMultiplier(prev.flats, prev.location?.floor);
      const matchIndex = rows.findIndex((row) => {
        const rowKey = String(
          row?.boq_match_key ||
            row?.boqKey ||
            row?.boq_key ||
            row?.boq_id ||
            row?.boqId ||
            row?.item_no ||
            ""
        ).trim();
        return rowKey && rowKey === key;
      });
      const existing = matchIndex >= 0 ? rows[matchIndex] || {} : {};
      const existingBaseQty = Number(
        String(
          existing?.qty_per_flat ??
            existing?.selected_qty ??
            existing?.boq_base_qty ??
            existing?.quantity ??
            existing?.qty ??
            existing?.issued_qty ??
            existing?.boq_issued_qty ??
            0
        ).replace(/,/g, "").trim()
      ) || 0;
      const nextBaseQty = existingBaseQty + qtyToAdd;
      const nextTotalQty = multiplier > 0 ? nextBaseQty * multiplier : nextBaseQty;
      const nextValue = "";
      const nextQty = String(nextTotalQty);
      const nextRow = {
        _row_type: "boq",
        sr_no: matchIndex >= 0 ? rows[matchIndex]?.sr_no || String(matchIndex + 1) : String(rows.length + 1),
        item_name: existing.item_name || derived.description || normalizeBoqRowName(derived),
        item_no: normalizeBoqRowName(derived),
        item_code: derived.item_code || derived.item_no || derived.hsn || derived.sac_code || "",
        code: derived.item_code || derived.item_no || derived.hsn || derived.sac_code || "",
        description: derived.description || "-",
        specification: "",
        brand_name: "",
        unit: derived.unit || "",
        quantity: nextQty,
        value: nextValue,
        inventory_id: null,
        issued_qty: nextQty,
        boq_id: String(derived.id || ""),
        boq_key: key,
        boq_match_key: key,
        boq_issued_qty: nextQty,
        qty_per_flat: String(nextBaseQty),
        selected_qty: String(nextBaseQty),
        total_qty: nextQty,
        flat_count: String(flatCount || 0),
        floors: String(floorCount || 0),
        boq_flat_multiplier: String(flatCount || 0),
        boq_floor_multiplier: String(floorCount || 0),
        boq_base_qty: String(nextBaseQty),
        add_fields: [
          { key: "boq_id", value: String(derived.id || "") },
          { key: "boq_key", value: key },
          { key: "boq_match_key", value: key },
          { key: "item_no", value: normalizeBoqRowName(derived) },
          { key: "item_code", value: String(derived.item_code || derived.item_no || derived.hsn || derived.sac_code || "") },
          { key: "description", value: String(derived.description || "-") },
          { key: "unit", value: String(derived.unit || "") },
          { key: "selected_qty", value: String(nextBaseQty) },
          { key: "qty_per_flat", value: String(nextBaseQty) },
          { key: "boq_base_qty", value: String(nextBaseQty) },
          { key: "boq_issued_qty", value: nextQty },
          { key: "total_qty", value: nextQty },
          { key: "flat_count", value: String(flatCount || 0) },
          { key: "floors", value: String(floorCount || 0) },
          { key: "boq_flat_multiplier", value: String(flatCount || 0) },
          { key: "boq_floor_multiplier", value: String(floorCount || 0) },
        ],
      };

      if (matchIndex >= 0) {
        nextRow.quantity = nextQty;
        nextRow.value = existing.value ?? "";
        nextRow.issued_qty = nextQty;
        nextRow.boq_issued_qty = nextQty;
        nextRow.sr_no = existing.sr_no || nextRow.sr_no;
        nextRow.item_name = existing.item_name || nextRow.item_name;
        nextRow.item_no = existing.item_no || nextRow.item_no;
        nextRow.item_code = existing.item_code || nextRow.item_code;
        nextRow.code = existing.code || nextRow.code;
        nextRow.description = existing.description || nextRow.description;
        nextRow.specification = existing.specification || nextRow.specification;
        nextRow.brand_name = existing.brand_name || nextRow.brand_name;
        nextRow.unit = existing.unit || nextRow.unit;
        nextRow.inventory_id = existing.inventory_id ?? null;
        nextRow.add_fields = Array.isArray(existing.add_fields) && existing.add_fields.length > 0 ? existing.add_fields : nextRow.add_fields;
        rows[matchIndex] = nextRow;
      } else {
        rows.push(nextRow);
      }

      return { ...prev, item_description: rows };
    });

    setPendingBoqQty((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setBoqPickerOpen(false);
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

  const flatCount = parsePositiveCount(form.flats);
  const floorCount = parsePositiveCount(form.location?.floor);
  const floorFlatMultiplier = flatCount > 0 && floorCount > 0 ? flatCount * floorCount : 0;
  const sampleItemNameLabel = getSamplePrimaryIdentifierLabel(sampleClient);
  const calculatedSampleRows = useMemo(() => {
    return (Array.isArray(form.item_description) ? form.item_description : []).map((row) => {
      const qtyPerFlat = toFiniteNumber(row?.qty_per_flat ?? row?.selected_qty ?? row?.quantity ?? row?.qty ?? row?.issued_qty ?? row?.boq_issued_qty) || 0;
      const totalQty = qtyPerFlat > 0 && floorFlatMultiplier > 0 ? qtyPerFlat * floorFlatMultiplier : toFiniteNumber(row?.total_qty ?? row?.quantity ?? row?.qty) || "";
      const displayItemName = row?.item_name || row?.item_no || row?.boq_description || row?.description || getSamplePrimaryIdentifier(row, sampleClient) || "";
      return {
        ...row,
        item_name: displayItemName,
        qty_per_flat: qtyPerFlat > 0 ? String(qtyPerFlat) : row?.qty_per_flat || "",
        total_qty: totalQty ? String(totalQty) : row?.total_qty || "",
        flats: String(flatCount || ""),
        floors: String(floorCount || ""),
      };
    });
  }, [form.item_description, floorFlatMultiplier, flatCount, floorCount]);

  const closeBoqQtySelector = (key) => {
    setPendingBoqQty((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const extractUploadedFilePaths = (value) => {
    const list = [];
    const pushPath = (item) => {
      if (!item) return;
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed) list.push(trimmed);
        return;
      }
      if (Array.isArray(item)) {
        item.forEach(pushPath);
        return;
      }
      if (typeof item === "object") {
        [
          item.path,
          item.filePath,
          item.file_path,
          item.url,
          item.sample_file,
          item.sampleFile,
          item.attachment,
        ].forEach(pushPath);
      }
    };
    pushPath(value?.paths ?? value?.files ?? value?.data ?? value?.result ?? value);
    return Array.from(new Set(list));
  };

  const uploadSampleFiles = async (files) => {
    if (!files.length) return;
    const res = await api.uploadSampleFiles(files);
    const paths = res.success ? extractUploadedFilePaths(res.data) : [];
    if (paths.length > 0) {
      setUploadFilePaths((prev) => Array.from(new Set([...prev, ...paths])));
      setForm((prev) => ({ ...prev, sample_file: prev.sample_file || paths[0] || "" }));
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getSampleById(id);
        if (!res.success) return;

        const raw = res.data;
        const sample = Array.isArray(raw)
          ? raw.find((row) => String(row?.sample_id ?? row?.id ?? "") === String(id)) || raw[0]
          : raw?.sample || raw?.data || raw;
        if (!sample) return;

        const loc = parseMaybe(sample.location, {});
        const items = parseMaybe(sample.item_description, []);
        const adds = parseMaybe(sample.add_fields, []);
        const sampleFileRaw =
          sample.sample_file ??
          sample.sample_file_path ??
          sample.sample_files ??
          sample.files ??
          sample.file_path ??
          sample.attachment ??
          sample.attachment_path ??
          "";
        const sampleFile = pickSampleFilePath(sampleFileRaw);
        const normalizedItems = Array.isArray(items) ? items : [];
        const resolvedClient = resolveSampleClient(sample, sample.project_id);
        setSampleProjectId(String(sample.project_id || ""));
        setSampleClient(resolvedClient);
        setOriginalItemDescription(normalizedItems);

        setForm({
          building_name: sample.building_name || "",
          site_name: sample.site_name || "",
          work_done: sample.work_done || "",
          sample_file: sampleFile,
          flats: sample.flats || "",
          location: {
            floor: loc?.floor || "",
            flat_no: loc?.flat_no || loc?.flatNo || "",
            block: loc?.block || "",
            wing: loc?.wing || "",
            coordinates: loc?.coordinates || "",
          },
          item_description: normalizedItems.length
            ? normalizedItems.map((it) => mapLoadedSampleRow(it))
            : [{ sr_no: "", item_name: "", item_code: "", code: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }],
          add_fields: Array.isArray(adds)
            ? adds.map((f) => ({ key: f.key || "", value: f.value || "" }))
            : [],
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const loadBoqs = async () => {
      if (!boqPickerOpen) return;
      setLoadingProjectBoqItems(true);
      try {
        await refreshProjectBoqItems();
      } finally {
        setLoadingProjectBoqItems(false);
      }
    };
    loadBoqs();
  }, [boqPickerOpen, sampleProjectId, sampleClient, effectiveProjectId]);

  const filteredProjectBoqItems = useMemo(() => {
    const query = boqSearch.trim().toLowerCase();
    const filtered = !query
      ? projectBoqItems
      : projectBoqItems.filter((item) => {
          const derived = deriveBoqFields(item);
          return (
            String(derived.item_no || "").toLowerCase().includes(query) ||
            String(derived.item_code || "").toLowerCase().includes(query) ||
            String(derived.description || "").toLowerCase().includes(query) ||
            String(derived.unit || "").toLowerCase().includes(query)
          );
        });
    if (activeBoqClient === "hiranandani") return [...filtered].sort(compareHiranandaniBoqOrder);
    return filtered;
  }, [projectBoqItems, boqSearch, activeBoqClient]);

  const save = async () => {
    const invalidInventory = (form.item_description || [])
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

    setSaving(true);
    try {
      const normalizedItems = (Array.isArray(form.item_description) ? form.item_description : []).map((row) => ({
        ...row,
        sr_no: row?.sr_no ?? "",
        item_name: row?.item_name ?? row?.itemName ?? "",
        item_code: row?.item_code ?? row?.itemCode ?? row?.code ?? "",
        code: row?.code ?? row?.item_code ?? row?.itemCode ?? "",
        brand_name: row?.brand_name ?? row?.brandName ?? "",
        description: row?.description ?? "",
        specification: row?.specification ?? row?.spec ?? "",
        unit: row?.unit ?? row?.uom ?? row?.UOM ?? "",
        quantity: row?.quantity ?? "",
        value: row?.value ?? "",
        inventory_id: row?.inventory_id ?? null,
        issued_qty: row?.issued_qty ?? null,
        boq_id: row?.boq_id ?? null,
        boq_qty: row?.boq_qty ?? null,
        boq_issued_qty: row?.boq_issued_qty ?? null,
        qty_per_flat: row?.qty_per_flat ?? "",
        total_qty: row?.total_qty ?? "",
        selected_qty: row?.selected_qty ?? "",
        flat_count: row?.flat_count ?? "",
        floors: row?.floors ?? "",
        boq_flat_multiplier: row?.boq_flat_multiplier ?? "",
        boq_floor_multiplier: row?.boq_floor_multiplier ?? "",
        boq_base_qty: row?.boq_base_qty ?? "",
        boq_key: row?.boq_key ?? "",
        boq_match_key: row?.boq_match_key ?? "",
        boq_item_code: row?.boq_item_code ?? "",
      }));
      const nextAddFields = [
        ...(Array.isArray(form.add_fields) ? form.add_fields.filter((field) => String(field?.key || "").trim() !== "sample_client") : []),
        ...(sampleClient ? [{ key: "sample_client", value: sampleClient }] : []),
      ];
      const nextProjectId = sampleProjectId || effectiveProjectId || resolvedProject.projectId || "";
      const updatePayload = {
        sample_id: form.sample_id || id,
        building_name: form.building_name,
        site_name: form.site_name,
        work_done: form.work_done,
        sample_file: form.sample_file,
        flats: form.flats,
        flat_no: form.location?.flat_no || form.flats || "",
        location: {
          ...form.location,
          // Preserve a saved flat number when available; otherwise reuse the entered flat count.
          flat_no: form.location?.flat_no || form.flats || "",
        },
        item_description: normalizedItems,
        add_fields: nextAddFields,
      };
      if (nextProjectId) updatePayload.project_id = nextProjectId;

      const res = await api.updateSample(id, updatePayload);
      if (!res.success) {
        toast({ title: "Update failed", description: res.error || "Error", variant: "destructive" });
        return;
      }

      const boqSyncRes = await syncSampleBoqQuantities(api, sampleProjectId || effectiveProjectId, originalItemDescription, normalizedItems);
      if (!boqSyncRes?.success) {
        toast({
          title: "Updated with BOQ warning",
          description: boqSyncRes?.error || "Could not sync BOQ quantities.",
          variant: "destructive",
        });
      }

      const refreshedSampleRes = await api.getSampleById(id).catch(() => null);
      const refreshedRaw = refreshedSampleRes?.success ? refreshedSampleRes.data : null;
      const refreshedSample = Array.isArray(refreshedRaw)
        ? refreshedRaw.find((row) => String(row?.sample_id ?? row?.id ?? "") === String(id)) || refreshedRaw[0]
        : refreshedRaw?.sample || refreshedRaw?.data || refreshedRaw || null;

      toast({ title: "Updated", description: "Sample updated" });
      navigate(`/${projectId}/samples/preview/${id}`, {
        replace: true,
        state: { sample: refreshedSample || { ...form, item_description: normalizedItems } },
      });
    } finally {
      setSaving(false);
    }
  };

  const fileUrl = form?.sample_file ? api.getApiFileUrl(form.sample_file) : null;
  const lower = String(form?.sample_file || "").toLowerCase();
  const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
  const isPdf = lower.endsWith('.pdf');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-8 sm:px-6 lg:px-10">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Edit Sample</CardTitle>
              <CardDescription>Fill the sample details and save them to the system.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate(`/${projectId}/samples/preview/${id}`, { replace: true })} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Preview
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Project ID</Label>
                  <Input value={sampleProjectId || effectiveProjectId || projectId || ""} readOnly placeholder="Select a project" />
                </div>
                <div className="space-y-2">
                  <Label>Sample ID</Label>
                  <Input type="text" value={form.sample_id || id} onChange={(e) => setForm({ ...form, sample_id: e.target.value })} placeholder="Enter sample ID (e.g. SAMPLE-001)" />
                </div>
                <div className="space-y-2">
                  <Label>Building Name</Label>
                  <Input value={form.building_name} onChange={(e) => setForm({ ...form, building_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Site Name</Label>
                  <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Work Done</Label>
                  <Input value={form.work_done} onChange={(e) => setForm({ ...form, work_done: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label>Floor/Shaft</Label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.location.floor}
                    onChange={(e) => setForm({ ...form, location: { ...form.location, floor: String(e.target.value || "").replace(/[^\d]/g, "") } })}
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flat/Zone</Label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.flats}
                    onChange={(e) => setForm({ ...form, flats: String(e.target.value || "").replace(/[^\d]/g, "") })}
                    placeholder="e.g. 12"
                  />
                  <p className="text-xs text-muted-foreground">Enter the flat count as a number.</p>
                </div>
                <div className="space-y-2">
                  <Label>Block</Label>
                  <Input value={form.location.block} onChange={(e) => setForm({ ...form, location: { ...form.location, block: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Wing</Label>
                  <Input value={form.location.wing} onChange={(e) => setForm({ ...form, location: { ...form.location, wing: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <Label>Coordinates</Label>
                  <Input value={form.location.coordinates} onChange={(e) => setForm({ ...form, location: { ...form.location, coordinates: e.target.value } })} />
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-wide">Calculated Preview</div>
                    <div className="text-xs text-muted-foreground">Read-only totals calculated from `flats count x floors`.</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <div className="uppercase text-muted-foreground">Flats Count</div>
                      <div className="mt-1 font-semibold">{flatCount || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <div className="uppercase text-muted-foreground">Floors</div>
                      <div className="mt-1 font-semibold">{floorCount || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <div className="uppercase text-muted-foreground">Multiplier</div>
                      <div className="mt-1 font-semibold">{floorFlatMultiplier || "-"}</div>
                    </div>
                  </div>
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
                        value={form.sample_file || ""}
                        onValueChange={(value) => setForm({ ...form, sample_file: value })}
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
                {fileUrl ? (
                  <Button type="button" variant="outline" onClick={() => setAttachmentOpen(true)} className="mt-1">
                    <Eye className="mr-2 h-4 w-4" /> Preview Attachment
                  </Button>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Item Description</Label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setBoqPickerOpen(true)}>
                      View Items from BOQ
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...form, item_description: [...form.item_description, { sr_no: "", item_name: "", item_code: "", code: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }] })}>
                      <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {form.item_description.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <Input placeholder="Sr No" value={row.sr_no} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], sr_no: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder={sampleItemNameLabel} value={row.item_name || row.item_no || row.boq_description || row.description || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], item_name: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <div className="flex flex-col gap-2 md:col-span-3">
                        <Textarea className="min-h-20 resize-y" placeholder="Description" value={row.description} onChange={(e) => {
                          const next = [...form.item_description]; next[idx] = { ...next[idx], description: e.target.value }; setForm({ ...form, item_description: next });
                        }} />
                        <InventoryPicker
                          project_id={effectiveProjectId}
                          initialValue={row.description || ""}
                          selectedId={row.inventory_id}
                          minQty={Number(row.quantity) || 0}
                          onValidityChange={(status) => {
                            setInventoryQtyStatus((prev) => ({ ...(prev || {}), [idx]: status }));
                          }}
                          onSelect={(picked) => {
                            const next = [...form.item_description];
                            const qty = Number(next[idx]?.quantity);
                            next[idx] = {
                              ...next[idx],
                              inventory_id: picked.inventory_id,
                              issued_qty: next[idx]?.issued_qty ?? (Number.isFinite(qty) ? qty : null),
                            };
                            setForm({ ...form, item_description: next });
                          }}
                          onClear={() => {
                            const next = [...form.item_description];
                            next[idx] = { ...next[idx], inventory_id: null, issued_qty: null };
                            setForm({ ...form, item_description: next });
                          }}
                        />
                      </div>
                      <Input placeholder="Item Code" value={row.item_code || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], item_code: e.target.value, code: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Brand Name" value={row.brand_name || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], brand_name: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Specification" value={row.specification || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], specification: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Unit" value={row.unit || ""} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], unit: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Quantity" value={row.quantity} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], quantity: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Input placeholder="Value" value={row.value} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], value: e.target.value }; setForm({ ...form, item_description: next });
                      }} />
                      <Button size="sm" variant="destructive" onClick={() => {
                        const next = form.item_description.filter((_, i) => i !== idx);
                        setForm({ ...form, item_description: next });
                        setInventoryQtyStatus((prev) => {
                          const mapped = {};
                          Object.entries(prev || {}).forEach(([key, value]) => {
                            const index = Number(key);
                            if (!Number.isInteger(index)) return;
                            if (index === idx) return;
                            const nextIndex = index > idx ? index - 1 : index;
                            mapped[nextIndex] = value;
                          });
                          return mapped;
                        });
                      }}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-wide">Calculated Preview</div>
                    <div className="text-xs text-muted-foreground">Read-only totals calculated from `flats count x floors x qty per flat`.</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <div className="uppercase text-muted-foreground">Flats Count</div>
                      <div className="mt-1 font-semibold">{flatCount || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <div className="uppercase text-muted-foreground">Floors</div>
                      <div className="mt-1 font-semibold">{floorCount || "-"}</div>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <div className="uppercase text-muted-foreground">Multiplier</div>
                      <div className="mt-1 font-semibold">{floorFlatMultiplier || "-"}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[1750px]">
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-[220px]">{sampleItemNameLabel}</TableHead>
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
                        {calculatedSampleRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">No rows to preview</TableCell>
                          </TableRow>
                        ) : (
                          calculatedSampleRows.map((row, index) => (
                            <TableRow key={`preview-${index}`}>
                              <TableCell>{row.item_name || row.item_no || row.boq_description || row.description || getSamplePrimaryIdentifier(row, sampleClient) || "-"}</TableCell>
                              <TableCell>{row.description || "-"}</TableCell>
                              <TableCell>{row.item_code || "-"}</TableCell>
                              <TableCell>{row.specification || "-"}</TableCell>
                              <TableCell>{row.brand_name || "-"}</TableCell>
                              <TableCell>{row.unit || "-"}</TableCell>
                              <TableCell className="text-right">{row.qty_per_flat || row.quantity || "-"}</TableCell>
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

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => navigate(`/${projectId}/samples/preview/${id}`, { replace: true })}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
                  placeholder="Search by item no, code, description, or unit"
                  value={boqSearch}
                  onChange={(e) => setBoqSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 h-8">
                  {filteredProjectBoqItems.length} item(s)
                </Badge>
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
                <div className={activeBoqClient ? "min-w-[1100px]" : ""}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs tracking-wide">Description</TableHead>
                        <TableHead className="w-[220px] text-xs tracking-wide">Item No</TableHead>
                        {activeBoqClient === "lodha" ? (
                          <TableHead className="w-[120px] text-xs tracking-wide">HSN</TableHead>
                        ) : activeBoqClient === "hiranandani" ? (
                          <TableHead className="w-[120px] text-xs tracking-wide">SAC Code</TableHead>
                        ) : (
                          <TableHead className="w-[140px] text-xs tracking-wide">Item Code</TableHead>
                        )}
                        <TableHead className="w-[110px] text-xs tracking-wide">{activeBoqClient === "hiranandani" ? "UOM" : "Unit"}</TableHead>
                        <TableHead className="w-[110px] text-xs tracking-wide">{activeBoqClient === "hiranandani" ? "Order Qty" : "Qty"}</TableHead>
                        {activeBoqClient ? (
                          <TableHead className="w-[120px] text-xs tracking-wide text-right">
                            {activeBoqClient === "hiranandani" ? "Unit Price" : "Rate"}
                          </TableHead>
                        ) : null}
                        {activeBoqClient ? (
                          <TableHead className="w-[120px] text-xs tracking-wide text-right">
                            {activeBoqClient === "hiranandani" ? "Value" : "Amount"}
                          </TableHead>
                        ) : null}
                        <TableHead className="w-[220px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingProjectBoqItems ? (
                        <TableRow>
                          <TableCell colSpan={activeBoqClient ? 8 : 6} className="text-center text-sm text-muted-foreground py-8">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading BOQ items...
                          </TableCell>
                        </TableRow>
                      ) : filteredProjectBoqItems.length > 0 ? (
                        filteredProjectBoqItems.map((item) => {
                          const derived = deriveBoqFields(item);
                          const key = boqItemKey(item);
                          const availableQty = Number(derived.available_qty || 0);
                          return (
                            <TableRow key={key}>
                              <TableCell className="font-medium">
                                <button
                                  type="button"
                                  className="max-w-[520px] truncate text-left hover:underline"
                                  title={String(derived.description || "")}
                                >
                                  {derived.description || "-"}
                                </button>
                              </TableCell>
                              <TableCell className="font-medium">{derived.item_no || "-"}</TableCell>
                              {activeBoqClient === "lodha" ? (
                                <TableCell className="font-mono text-xs">{derived.hsn || "-"}</TableCell>
                              ) : activeBoqClient === "hiranandani" ? (
                                <TableCell className="font-mono text-xs">{derived.sac_code || "-"}</TableCell>
                              ) : (
                                <TableCell className="font-medium">{derived.item_code || "-"}</TableCell>
                              )}
                              <TableCell className="font-medium">{derived.unit || "-"}</TableCell>
                              <TableCell className="font-medium">{Number.isFinite(availableQty) ? String(availableQty) : "0"}</TableCell>
                              {activeBoqClient ? (
                                <TableCell className="font-medium text-right">{String(derived.rate ?? "").trim() || "-"}</TableCell>
                              ) : null}
                              {activeBoqClient ? (
                                <TableCell className="font-medium text-right">{String(derived.amount ?? "").trim() || "-"}</TableCell>
                              ) : null}
                              <TableCell className="w-[220px] text-right">
                                {Object.prototype.hasOwnProperty.call(pendingBoqQty, key) ? (
                                  <div className="flex items-center justify-end gap-2 flex-nowrap">
                                    <div className="h-9 rounded-full border bg-muted/20 p-1 flex items-center gap-1 shadow-inner">
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-full"
                                        onClick={() => adjustPendingBoqQty(item, -1)}
                                        disabled={saving}
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
                                        disabled={saving}
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-full"
                                        onClick={() => adjustPendingBoqQty(item, 1)}
                                        disabled={saving}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="rounded-full px-4 bg-primary text-primary-foreground"
                                      onClick={() => addBoqItemToForm(item, pendingBoqQty[key])}
                                      disabled={saving || !Number(pendingBoqQty[key])}
                                    >
                                      Apply
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-full px-3"
                                      onClick={() => closeBoqQtySelector(key)}
                                      disabled={saving}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-full px-4 shrink-0"
                                    onClick={() => openBoqQtySelector(item)}
                                    disabled={saving}
                                  >
                                    Add
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={activeBoqClient ? 8 : 6} className="py-10 text-center text-muted-foreground">
                            No BOQ items found.
                          </TableCell>
                        </TableRow>
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
      {fileUrl && (
        <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
          <DialogContent className="h-[98vh] w-[99vw] max-w-[99vw]">
            <DialogHeader>
              <DialogTitle>Attachment Preview</DialogTitle>
            </DialogHeader>
            <div className="rounded-xl border bg-muted/10 p-3">
              {isImage ? (
                <img src={fileUrl} alt="Sample File" className="max-h-[92vh] object-contain w-full rounded-md" />
              ) : isPdf ? (
                <iframe src={fileUrl} className="h-[92vh] w-full rounded-md" title="Sample Attachment Preview" />
              ) : (
                <div className="flex justify-center">
                  <Button asChild>
                    <a href={fileUrl} target="_blank" rel="noreferrer">Open Attachment</a>
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setAttachmentOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
