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
import { api } from "@/lib/api";
import { syncSampleBoqQuantities } from "@/lib/sampleBoqSync";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Plus, Eye, Search, Minus } from "lucide-react";
import InventoryPicker from "@/components/InventoryPicker";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import { getSamplePrimaryIdentifier, resolveSampleClient } from "@/lib/sampleDisplay";

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

  const normalizeEmptyLike = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const lower = text.toLowerCase();
    if (lower === "-" || lower === "_" || lower === "na" || lower === "n/a" || lower === "null" || lower === "undefined") {
      return "";
    }
    return text;
  };

  const toFiniteNumber = (value) => {
    if (value == null || value === "") return null;
    const n = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
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
      const nextQty = String(qtyToAdd);
      const nextValue = "";
      const nextRow = {
        _row_type: "boq",
        sr_no: matchIndex >= 0 ? rows[matchIndex]?.sr_no || String(matchIndex + 1) : String(rows.length + 1),
        item_name: normalizeBoqRowName(derived),
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
        add_fields: [
          { key: "boq_id", value: String(derived.id || "") },
          { key: "boq_key", value: key },
          { key: "boq_match_key", value: key },
          { key: "item_no", value: normalizeBoqRowName(derived) },
          { key: "item_code", value: String(derived.item_code || derived.item_no || derived.hsn || derived.sac_code || "") },
          { key: "description", value: String(derived.description || "-") },
          { key: "unit", value: String(derived.unit || "") },
          { key: "selected_qty", value: nextQty },
          { key: "boq_issued_qty", value: nextQty },
        ],
      };

      if (matchIndex >= 0) {
        const existing = rows[matchIndex] || {};
        const existingQty = Number(String(existing.quantity ?? existing.qty ?? 0).replace(/,/g, "").trim()) || 0;
        nextRow.quantity = String(existingQty + qtyToAdd);
        nextRow.value = existing.value ?? "";
        nextRow.issued_qty = String(existingQty + qtyToAdd);
        nextRow.boq_issued_qty = String(existingQty + qtyToAdd);
        nextRow.sr_no = existing.sr_no || nextRow.sr_no;
        nextRow.item_name = existing.item_no || existing.item_name || nextRow.item_name;
        nextRow.item_no = existing.item_no || nextRow.item_no;
        nextRow.item_code = existing.item_code || nextRow.item_code;
        nextRow.code = existing.code || nextRow.code;
        nextRow.description = existing.description || nextRow.description;
        nextRow.specification = existing.specification || nextRow.specification;
        nextRow.brand_name = existing.brand_name || nextRow.brand_name;
        nextRow.unit = existing.unit || nextRow.unit;
        nextRow.inventory_id = existing.inventory_id ?? null;
        nextRow.add_fields = Array.isArray(existing.add_fields) ? existing.add_fields : nextRow.add_fields;
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

  const closeBoqQtySelector = (key) => {
    setPendingBoqQty((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
            ? normalizedItems.map((it) => {
              const itemFields = parseMaybe(it?.add_fields, []);
              const inventoryField = Array.isArray(itemFields)
                  ? itemFields.find((field) => String(field?.key || "") === "inventory_id")
                  : null;
                const itemName = String(
                  it.item_name ||
                    it.itemName ||
                    it.item_no ||
                    it.itemNo ||
                    it.code ||
                    it.item_code ||
                    getSamplePrimaryIdentifier(it, resolvedClient) ||
                    ""
                ).trim();
                const brandName = it.brand_name || it.brandName || "";
                return {
                  sr_no: it.sr_no || "",
                  item_name: itemName,
                  item_code: it.item_code || it.itemCode || it.code || it.boq_item_code || it.hsn || "",
                  code: it.code || it.item_code || it.itemCode || it.boq_item_code || it.hsn || "",
                  brand_name: brandName,
                  description: it.description || "",
                  specification: it.specification || it.spec || "",
                  unit: it.unit || it.uom || it.UOM || "",
                  quantity: it.quantity || "",
                  value: it.value || "",
                  inventory_id: it.inventory_id ?? (inventoryField?.value ? Number(inventoryField.value) : null),
                  issued_qty: it.issued_qty ?? null,
                  boq_id: it.boq_id ?? (Array.isArray(itemFields) ? Number(itemFields.find((field) => String(field?.key || "") === "boq_id")?.value || null) : null),
                  boq_qty: it.boq_qty ?? (Array.isArray(itemFields) ? Number(itemFields.find((field) => String(field?.key || "") === "boq_qty")?.value || null) : null),
                  boq_issued_qty: it.boq_issued_qty ?? null,
                };
              })
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
      const normalizedItems = (Array.isArray(form.item_description) ? form.item_description : []).map((row) => {
        const isBoqRow = Boolean(
          String(row?._row_type || "").toLowerCase() === "boq" ||
          row?.boq_id ||
          row?.boqId ||
          row?.boq_key ||
          row?.boqKey ||
          row?.boq_match_key ||
          row?.boqMatchKey
        );
        if (!isBoqRow) return row;
        const itemNo = String(
          row?.item_no ||
            row?.itemNo ||
            row?.item_code ||
            row?.itemCode ||
            row?.code ||
            row?.boq_item_code ||
            row?.boqItemCode ||
            "-"
        ).trim() || "-";
        return {
          ...row,
          item_name: itemNo,
          item_no: itemNo,
        };
      });
      const nextAddFields = [
        ...(Array.isArray(form.add_fields) ? form.add_fields.filter((field) => String(field?.key || "").trim() !== "sample_client") : []),
        ...(sampleClient ? [{ key: "sample_client", value: sampleClient }] : []),
      ];
      const res = await api.updateSample(id, {
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
      });
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
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Sample</h1>
          <p className="text-muted-foreground mt-2">Update sample details and save changes.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`/${projectId}/samples/preview/${id}`, { replace: true })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Preview
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample #{id}</CardTitle>
          <CardDescription>Editing project sample data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.location.floor}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        location: { ...form.location, floor: String(e.target.value || "").replace(/[^\d]/g, "") },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flats</Label>
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
              <div className="space-y-2">
                <Label>Attachment</Label>
                {fileUrl ? (
                  <Button type="button" variant="outline" onClick={() => setAttachmentOpen(true)} className="mt-1">
                    <Eye className="mr-2 h-4 w-4" /> Preview Attachment
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground">No attachment found</div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Item Description</Label>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setBoqPickerOpen(true)}>
                      View Items from BOQ
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...form, item_description: [...form.item_description, { sr_no: "", item_name: "", brand_name: "", description: "", specification: "", unit: "", quantity: "", value: "", inventory_id: null, issued_qty: null, boq_id: null, boq_qty: null, boq_issued_qty: null }] })}>
                      <Plus className="mr-2 h-4 w-4" /> Add Row
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {form.item_description.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-10 gap-3">
                      <Input placeholder="Sr No" value={row.sr_no} onChange={(e) => {
                        const next = [...form.item_description]; next[idx] = { ...next[idx], sr_no: e.target.value }; setForm({ ...form, item_description: next });
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
                <div className="flex justify-between items-center">
                  <Label>Additional Fields</Label>
                  <Button size="sm" variant="outline" type="button" onClick={() => setForm({ ...form, add_fields: [...form.add_fields, { key: "", value: "" }] })}>
                    <Plus className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.add_fields.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <Input placeholder="Key" value={f.key} onChange={(e) => {
                        const next = [...form.add_fields]; next[idx] = { ...next[idx], key: e.target.value }; setForm({ ...form, add_fields: next });
                      }} />
                      <Input placeholder="Value" value={f.value} onChange={(e) => {
                        const next = [...form.add_fields]; next[idx] = { ...next[idx], value: e.target.value }; setForm({ ...form, add_fields: next });
                      }} />
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setForm({ ...form, add_fields: form.add_fields.filter((_, i) => i !== idx) })}
                        className="md:w-auto w-full"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => navigate(`/${projectId}/samples/preview/${id}`, { replace: true })}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
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
