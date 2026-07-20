import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, X } from "lucide-react";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/useProject";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UnitSelect, convertQuantity } from "@/components/forms/UnitSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const isLikelyItemCode = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (/^\(?\d+(\.\d+){0,3}\)?$/.test(text)) return true;
  if (/^[A-Z0-9][A-Z0-9._/-]{2,}$/.test(text) && !/\s/.test(text)) return true;
  return false;
};

const resolveSamplePrItemLabel = (item = {}) => {
  const candidates = [
    item?.item_name,
    item?.itemName,
    getAddFieldValue(item, "item_name"),
    getAddFieldValue(item, "itemName"),
    item?.description,
    item?.material_description,
    item?.item,
    item?.name,
  ];

  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text && !isLikelyItemCode(text)) return text;
  }

  return String(
    item?.item_no ||
      item?.itemNo ||
      getAddFieldValue(item, "item_no") ||
      getAddFieldValue(item, "itemNo") ||
      ""
  ).trim();
};

const resolveSamplePrItemNo = (item = {}) => {
  const candidates = [
    item?.item_no,
    item?.itemNo,
    getAddFieldValue(item, "item_no"),
    getAddFieldValue(item, "itemNo"),
  ];

  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text) return text;
  }

  return "";
};

const isManualLikeRow = (row = {}) => {
  const description = String(
    row?.description || row?.material_description || row?.item_no || row?.itemNo || row?.item_name || row?.itemName || row?.item_code || row?.code || ""
  ).trim();
  if (!description) return false;

  const boqSignals = [
    row?.boq_id,
    row?.boqId,
    row?.boq_key,
    row?.boqKey,
    row?.boq_match_key,
    row?.boqMatchKey,
    getAddFieldValue(row, "boq_id"),
    getAddFieldValue(row, "boq_key"),
    getAddFieldValue(row, "boq_match_key"),
  ];

  return !boqSignals.some((value) => String(value ?? "").trim() !== "");
};

const resolveManualRowQty = (row = {}, sample = {}) => {
  const rowFlatCount = parseNumberOrZero(
    row?.flat_count ||
      row?.flatCount ||
      getAddFieldValue(row, "flat_count") ||
      getAddFieldValue(row, "flatCount")
  );
  const rowFloorCount = parseNumberOrZero(
    row?.floors ||
      row?.floor_count ||
      row?.floorCount ||
      getAddFieldValue(row, "floors") ||
      getAddFieldValue(row, "floor_count") ||
      getAddFieldValue(row, "floorCount")
  );
  const sampleFlatCount = parseNumberOrZero(sample?.flats || sample?.location?.flat_no || sample?.location?.flats);
  const sampleFloorCount = parseNumberOrZero(sample?.location?.floor || sample?.location?.floor_no || sample?.location?.floors);
  const rowMultiplier = Math.max(1, rowFlatCount || sampleFlatCount || rowFloorCount || sampleFloorCount);

  const explicit =
    parseNumberOrZero(
      row?.total_qty ||
        row?.quantity ||
        row?.qty ||
        row?.issued_qty ||
        getAddFieldValue(row, "total_qty") ||
        getAddFieldValue(row, "selected_qty") ||
        getAddFieldValue(row, "boq_base_qty") ||
        getAddFieldValue(row, "boq_issued_qty")
    ) || 0;
  if (explicit > 0) return explicit;

  const perFlat =
    parseNumberOrZero(
      row?.qty_per_flat ||
        row?.quantity_per_flat ||
        row?.per_flat_qty ||
        getAddFieldValue(row, "qty_per_flat") ||
        getAddFieldValue(row, "boq_qty_per_flat")
    ) || 0;
  if (perFlat > 0) return perFlat * rowMultiplier;

  if (isManualLikeRow(row)) return rowMultiplier > 0 ? rowMultiplier : sampleFlatCount > 0 ? sampleFlatCount : sampleFloorCount > 0 ? sampleFloorCount : 0;
  return 0;
};

export default function PurchaseRequestCreate() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { selectedProject, projects } = useProject();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sampleOptions, setSampleOptions] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [loadingSampleItems, setLoadingSampleItems] = useState(false);
  const [prItemSearch, setPrItemSearch] = useState("");
  const [sampleCatalogItems, setSampleCatalogItems] = useState([]);
  const [prItemSearchOpen, setPrItemSearchOpen] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState("");
  const sampleOptionsScopeRef = React.useRef(null);
  const sampleLoadRequestRef = React.useRef(0);

  const defaultProjectId = useMemo(
    () => parseIntegerOrNull(projectId) || parseIntegerOrNull(selectedProject?.project_id || selectedProject?.id),
    [projectId, selectedProject]
  );

  const projectOptions = useMemo(() => {
    const byId = new Map();
    (Array.isArray(projects) ? projects : []).forEach((project) => {
      const id = project?.project_id ?? project?.id;
      if (id == null || id === "") return;
      byId.set(String(id), project);
    });
    return Array.from(byId.values());
  }, [projects]);

  const [form, setForm] = useState({
    project_id: defaultProjectId ? String(defaultProjectId) : "",
    sample_id: "",
    pr_number: "",
    project_name: selectedProject?.project_name || selectedProject?.name || "",
    workorder_no: "",
    floor_no: "",
    flat_no: "",
    location: "",
    mirno: "",
    urgency: "Medium",
    date: new Date().toISOString().slice(0, 10),
    approved_by: "",
    remarks: "",
    items: [createEmptyItem()],
  });

  const selectedSampleMissing = useMemo(
    () => form.sample_id && !sampleOptions.some((sample) => String(sample.sample_id || sample.id) === form.sample_id),
    [form.sample_id, sampleOptions]
  );

  const matchesPrItemSearch = (item) => {
    const q = String(prItemSearch || "").trim().toLowerCase();
    if (!q) return true;
    const desc = String(item?.material_description ?? "").toLowerCase();
    const itemNo = String(item?.item_name ?? item?.item_no ?? item?.make ?? "").toLowerCase();
    const make = String(item?.make ?? "").toLowerCase();
    const place = String(item?.place_of_utilisation ?? "").toLowerCase();
    const unit = String(item?.unit ?? "").toLowerCase();
    return desc.includes(q) || itemNo.includes(q) || make.includes(q) || place.includes(q) || unit.includes(q);
  };

  const prItemSuggestions = useMemo(() => {
    const q = String(prItemSearch || "").trim().toLowerCase();
    const keyFor = (v) => String(v || "").trim().toLowerCase();
    const unique = new Map(); // key -> item

    (Array.isArray(sampleCatalogItems) ? sampleCatalogItems : []).forEach((it) => {
      const k = keyFor(it?.material_description);
      if (!k) return;
      if (!unique.has(k)) unique.set(k, it);
    });

    const all = Array.from(unique.values());
    if (!q) return all.slice(0, 10);
    return all
      .filter((it) => {
        const desc = String(it?.material_description ?? "").toLowerCase();
        const itemNo = String(it?.item_name ?? it?.item_no ?? it?.make ?? "").toLowerCase();
        const make = String(it?.make ?? "").toLowerCase();
        const place = String(it?.place_of_utilisation ?? "").toLowerCase();
        const unit = String(it?.unit ?? "").toLowerCase();
        return desc.includes(q) || itemNo.includes(q) || make.includes(q) || place.includes(q) || unit.includes(q);
      })
      .slice(0, 10);
  }, [sampleCatalogItems, prItemSearch]);

  const effectiveProjectId = useMemo(
    () => parseIntegerOrNull(form.project_id) || defaultProjectId,
    [form.project_id, defaultProjectId]
  );

  const getResolvedSampleId = () => String(form.sample_id || selectedSampleId || "").trim();
  const selectedSample = useMemo(
    () => sampleOptions.find((sample) => String(sample.sample_id || sample.id) === String(form.sample_id || selectedSampleId || "")) || null,
    [form.sample_id, sampleOptions, selectedSampleId]
  );

  useEffect(() => {
    const currentProjectId = String(form.project_id || "").trim();
    if (!currentProjectId) return;

    const selectedFromOptions = projectOptions.find(
      (project) => String(project.project_id || project.id) === currentProjectId
    );
    const resolvedProjectName =
      selectedFromOptions?.project_name ||
      selectedFromOptions?.name ||
      selectedProject?.project_name ||
      selectedProject?.name ||
      "";
    const resolvedLocation =
      String(selectedFromOptions?.location || selectedProject?.location || "").trim();
    const resolvedWorkOrderNo =
      String(selectedFromOptions?.wo_number || selectedProject?.wo_number || "").trim();

    setForm((prev) => {
      let changed = false;
      const next = { ...prev };

      if (resolvedProjectName && String(prev.project_name || "") !== String(resolvedProjectName)) {
        next.project_name = resolvedProjectName;
        changed = true;
      }

      if (!String(prev.location || "").trim() && resolvedLocation) {
        next.location = resolvedLocation;
        changed = true;
      }

      if (!String(prev.workorder_no || "").trim() && resolvedWorkOrderNo) {
        next.workorder_no = resolvedWorkOrderNo;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [form.project_id, form.project_name, projectOptions, selectedProject]);

  const loadSamples = React.useCallback(
    async ({ force = false } = {}) => {
      const currentScope = effectiveProjectId ?? null;
      if (!force && sampleOptionsScopeRef.current === currentScope) {
        return;
      }

      const requestId = sampleLoadRequestRef.current + 1;
      sampleLoadRequestRef.current = requestId;
      setLoadingSamples(true);
      try {
        const result = effectiveProjectId
          ? await api.getSamplesByProject(effectiveProjectId)
          : await api.getSamples();

        if (sampleLoadRequestRef.current !== requestId) return;
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
        sampleOptionsScopeRef.current = currentScope;
      } catch {
        if (sampleLoadRequestRef.current === requestId) setSampleOptions([]);
      } finally {
        if (sampleLoadRequestRef.current === requestId) setLoadingSamples(false);
      }
    },
    [effectiveProjectId]
  );

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

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItem = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const goBackToList = () => {
    navigate(`/${projectId}/purchase-requests`);
  };

  const parseArrayField = (value) => {
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

  const mapSampleItemsToFormItems = (sample, itemDescription) => {
    const parsedItems = parseArrayField(itemDescription);
    if (parsedItems.length === 0) return [createEmptyItem()];

    const sampleFlatCount = parseNumberOrZero(sample?.flats || sample?.location?.flat_no || sample?.location?.flats);
    const sampleFloorCount = parseNumberOrZero(sample?.location?.floor || sample?.location?.floor_no || sample?.location?.floors);
    const sampleMultiplier = Math.max(1, sampleFlatCount * sampleFloorCount);

    const mapped = parsedItems
      .map((item) => {
        const itemTotalQty = resolveManualRowQty(item, sample);
        const resolvedQty = itemTotalQty > 0 ? itemTotalQty : parseNumberOrZero(item?.qty_per_flat || item?.sample_qty_per_flat || item?.req_qty);
        const explicitItemNo = resolveSamplePrItemNo(item) || resolveSamplePrItemLabel(item);
        const explicitItemName = resolveSamplePrItemLabel(item) || explicitItemNo;
        const explicitMake = String(item?.make || getAddFieldValue(item, "make") || "").trim();
        return {
          row_source: "sample",
          item_no: explicitItemNo,
          item_name: explicitItemName,
          material_description: String(
            item?.material_description || item?.description || item?.item || item?.name || ""
          ).trim(),
          unit: String(item?.unit || item?.uom || item?.UOM || "NOS").trim() || "NOS",
          req_qty: String(resolvedQty || itemTotalQty || parseNumberOrZero(item?.req_qty || item?.quantity || item?.qty)),
          make: explicitMake,
          place_of_utilisation: String(item?.place_of_utilisation || item?.place || "").trim(),
          inventory_id: item?.inventory_id ?? item?.inventoryId ?? null,
          issued_qty: item?.issued_qty ?? item?.issuedQty ?? null,
          boq_id: item?.boq_id ?? item?.boqId ?? "",
          boq_item_code: item?.boq_item_code ?? item?.boqItemCode ?? explicitItemNo,
          boq_description: item?.boq_description ?? item?.boqDescription ?? "",
          boq_remaining_quantity: item?.boq_remaining_quantity ?? item?.boqRemainingQuantity ?? "",
          boq_total_usage_count: item?.boq_total_usage_count ?? item?.boqTotalUsageCount ?? "",
          boq_usage: item?.boq_usage ?? item?.boqUsage ?? null,
          boq_qty: item?.boq_qty ?? item?.boqQty ?? (resolvedQty || itemTotalQty || parseNumberOrZero(item?.qty) || ""),
          sample_total_qty: itemTotalQty || resolvedQty || "",
          sample_qty_per_flat: resolvedQty || itemTotalQty || "",
          sample_flat_count: sampleFlatCount || "",
          sample_floor_count: sampleFloorCount || "",
          sample_multiplier: sampleMultiplier || "",
        };
      })
      .filter((item) => item.material_description || item.req_qty);

    return mapped.length > 0 ? mapped : [createEmptyItem()];
  };

  const applySelectedSampleToForm = (sample) => {
    if (!sample) return;

    const sampleId = String(sample.sample_id || sample.id || "");
    const mappedItems = mapSampleItemsToFormItems(sample, sample.item_description);
    setForm((prev) => ({ ...prev, sample_id: sampleId || prev.sample_id, items: mappedItems }));
    setSelectedSampleId(sampleId);
    setSampleCatalogItems(mappedItems);
    toast({
      title: "Sample items loaded",
      description: `${mappedItems.length} item${mappedItems.length === 1 ? "" : "s"} loaded into PR Items.`,
    });
  };

  const getPreviewQtyForItem = (item) => {
    return parseNumberOrZero(item?.req_qty || item?.sample_total_qty || item?.sample_qty_per_flat);
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

  const addCatalogItemToPr = (catalogItem) => {
    if (!catalogItem) return;
    const resolvedItemNo = resolveSamplePrItemNo(catalogItem) || resolveSamplePrItemLabel(catalogItem);
    const resolvedItemName = resolveSamplePrItemLabel(catalogItem) || resolvedItemNo;
    setForm((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            ...createEmptyItem(),
            ...catalogItem,
            row_source: "sample",
            item_no: resolvedItemNo,
            item_name: resolvedItemName,
            make: String(catalogItem?.make || "").trim(),
          },
        ],
    }));
  };

  const handleSampleChange = async (value) => {
    if (value === "none") {
      setField("sample_id", "");
      setSelectedSampleId("");
      return;
    }

    await loadSamples();
    setField("sample_id", value);
    setSelectedSampleId(String(value));

    setLoadingSampleItems(true);
    try {
      const result = await api.getSampleById(value);
      if (!result.success) {
        toast({
          title: "Failed to load sample items",
          description: result.error || "Could not fetch selected sample details.",
          variant: "destructive",
        });
        return;
      }

      const fetched = result.data || {};
      setForm((prev) => {
        const nextProjectId = fetched?.project_id ?? fetched?.projectId ?? prev.project_id;
        const resolvedProject =
          projectOptions.find((p) => String(p?.project_id ?? p?.id ?? "") === String(nextProjectId)) || null;
        return {
          ...prev,
          project_id: nextProjectId != null && nextProjectId !== "" ? String(nextProjectId) : prev.project_id,
          project_name: resolvedProject?.project_name || resolvedProject?.name || prev.project_name,
          location: prev.location || String(fetched?.site_name || "").trim(),
          workorder_no: String(prev.workorder_no || "").trim()
            ? prev.workorder_no
            : String(resolvedProject?.wo_number || "").trim(),
        };
      });
      applySelectedSampleToForm(fetched);
    } catch {
      toast({
        title: "Failed to load sample items",
        description: "Could not fetch selected sample details.",
        variant: "destructive",
      });
    } finally {
      setLoadingSampleItems(false);
    }
  };

  const handleProjectChange = (value) => {
    if (value === "none") {
      sampleOptionsScopeRef.current = null;
      setSampleOptions([]);
      setSelectedSampleId("");
      setForm((prev) => ({ ...prev, project_id: "", project_name: "", sample_id: "" }));
      return;
    }
    const selected = projectOptions.find((project) => String(project.project_id || project.id) === String(value));
    sampleOptionsScopeRef.current = null;
    setSampleOptions([]);
    setSelectedSampleId("");
    setForm((prev) => ({
      ...prev,
      project_id: String(value),
      project_name: selected?.project_name || selected?.name || prev.project_name,
      sample_id: "",
      location: prev.location || String(selected?.location || "").trim(),
      workorder_no: String(selected?.wo_number || "").trim() || prev.workorder_no,
    }));
  };

  const handleSubmit = async () => {
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

    if (!String(form.floor_no || "").trim()) {
      toast({
        title: "Validation failed",
        description: "Floor No is required.",
        variant: "destructive",
      });
      return;
    }

    if (!String(form.flat_no || "").trim()) {
      toast({
        title: "Validation failed",
        description: "Flat No is required.",
        variant: "destructive",
      });
      return;
    }

    const cleanedItems = form.items
      .map((item) => {
        const reqQty = Number(
          item?.req_qty ||
            item?.sample_total_qty ||
            item?.sample_qty_per_flat ||
            (isManualLikeRow(item) ? resolveManualRowQty(item, selectedSample || {}) : 0)
        );
        const inventoryId = parseIntegerOrNull(item.inventory_id);
        const boqId = parseIntegerOrNull(item.boq_id);
        const itemNo = String(item.item_no || item.item_name || item.itemName || "").trim();
        const itemName = String(item.item_name || item.material_description || item.description || itemNo || "").trim();
        const isSampleRow = String(item.row_source || "").toLowerCase() === "sample";
        const payload = {
          item_no: itemNo,
          item_name: itemName,
          item_code: itemNo,
          boq_item_code: itemNo,
          material_description: String(item.material_description || "").trim(),
          unit: String(item.unit || "").trim() || "NOS",
          req_qty: reqQty,
          make: String(item.make || "").trim(),
          place_of_utilisation: String(item.place_of_utilisation || "").trim(),
          add_fields: [
            { key: "item_no", value: itemNo },
            { key: "item_name", value: itemName },
            { key: "item_code", value: itemNo },
            { key: "boq_item_code", value: itemNo },
            { key: "material_description", value: String(item.material_description || "").trim() },
            { key: "unit", value: String(item.unit || "").trim() || "NOS" },
            { key: "req_qty", value: String(reqQty) },
            { key: "make", value: String(item.make || "").trim() },
            { key: "place_of_utilisation", value: String(item.place_of_utilisation || "").trim() },
          ],
        };
        if (inventoryId) {
          payload.inventory_id = inventoryId;
          payload.issued_qty = Number.isFinite(Number(item.issued_qty)) && Number(item.issued_qty) > 0 ? Number(item.issued_qty) : reqQty;
        }
        if (isSampleRow && boqId) {
          payload.boq_id = boqId;
          payload.boq_qty = Number.isFinite(reqQty) && reqQty > 0 ? reqQty : parseNumberOrZero(item.boq_qty);
        }
        return payload;
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
      setSubmitting(true);

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
        items: cleanedItems.map((item) => ({
          material_description: item.material_description,
          unit: item.unit,
          req_qty: item.req_qty,
          make: item.make,
          place_of_utilisation: item.place_of_utilisation,
          inventory_id: item.inventory_id ?? 0,
          issued_qty: item.issued_qty ?? 0,
          boq_id: item.boq_id ?? 0,
          boq_qty: item.boq_qty ?? 0,
          item_no: item.item_no || "",
          item_name: item.item_no || "",
          item_code: item.item_no || "",
          boq_item_code: item.item_no || "",
          add_fields: [
            { key: "item_no", value: item.item_no || "" },
            { key: "item_name", value: item.item_name || item.material_description || item.item_no || "" },
            { key: "item_code", value: item.item_no || "" },
            { key: "boq_item_code", value: item.item_no || "" },
            { key: "material_description", value: item.material_description || "" },
            { key: "unit", value: item.unit || "NOS" },
            { key: "req_qty", value: String(item.req_qty ?? "") },
            { key: "make", value: item.make || "" },
            { key: "place_of_utilisation", value: item.place_of_utilisation || "" },
          ],
        })),
      };

      const result = await api.createPr(payload);
      if (!result.success) {
        toast({
          title: "Create failed",
          description: result.error || "Unable to create PR.",
          variant: "destructive",
        });
        return;
      }

      const createdPr = result.data || {};
      toast({
        title: "PR created",
        description: `Purchase request created successfully. ${String(createdPr.pr_number || form.pr_number).trim()}`,
      });
      goBackToList();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Create Purchase Request</h1>
            <p className="mt-1 text-sm text-muted-foreground">Create PR in a dedicated page flow.</p>
          </div>
          <Button variant="outline" onClick={goBackToList} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to PR List
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>PR Header</CardTitle>
          <CardDescription>Fill required project details and optional attachments.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Project ID *</Label>
            <Select value={form.project_id || "none"} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Project ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {projectOptions.map((project) => {
                  const id = String(project.project_id || project.id);
                  const label = project.project_name || project.name || `Project ${id}`;
                  return (
                    <SelectItem key={id} value={id}>
                      {`${id} - ${label}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Project Name *</Label>
            <Input value={form.project_name} readOnly />
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
              onValueChange={handleSampleChange}
              onOpenChange={(open) => {
                if (open) loadSamples();
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
            <Input value={form.workorder_no} onChange={(e) => setField("workorder_no", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Floor No *</Label>
            <Input
              value={form.floor_no}
              onChange={(e) => setField("floor_no", String(e.target.value || "").replace(/[^\d]/g, ""))}
              placeholder="e.g. 2"
              inputMode="numeric"
              required
              aria-required="true"
            />
          </div>
          <div className="space-y-2">
            <Label>Flat No *</Label>
            <Input
              value={form.flat_no}
              onChange={(e) => setField("flat_no", String(e.target.value || "").replace(/[^\d]/g, ""))}
              placeholder="e.g. 7"
              inputMode="numeric"
              required
              aria-required="true"
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
            <Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Approved By</Label>
            <Input value={form.approved_by} onChange={(e) => setField("approved_by", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setField("location", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PR Items</CardTitle>
          <CardDescription>
            {loadingSampleItems
              ? "Loading items from selected sample..."
              : "Items can be loaded from a selected sample or entered manually."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2 relative">
              <Label>Search Items</Label>
              <Input
                value={prItemSearch}
                onChange={(e) => setPrItemSearch(e.target.value)}
                onFocus={() => setPrItemSearchOpen(true)}
                onBlur={() => setTimeout(() => setPrItemSearchOpen(false), 120)}
                placeholder="Search by description, make, place, or unit…"
              />
              {prItemSearchOpen && prItemSuggestions.length > 0 ? (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <div className="max-h-56 overflow-auto p-1">
                    {prItemSuggestions.map((sug, idx) => {
                      const title = String(sug?.material_description || "").trim();
                      const subtitleParts = [
                        (sug?.item_no || sug?.itemName || sug?.make) ? `Item No: ${sug.item_no || sug.itemName || sug.make}` : "",
                        sug?.unit ? `Unit: ${sug.unit}` : "",
                        sug?.place_of_utilisation ? `Place: ${sug.place_of_utilisation}` : "",
                      ].filter(Boolean);
                      const subtitle = subtitleParts.join(" • ");
                      return (
                        <button
                          key={`${title || "item"}-${idx}`}
                          type="button"
                          className="w-full text-left rounded-sm px-2 py-2 hover:bg-muted focus:bg-muted focus:outline-none"
                          onMouseDown={(e) => {
                            e.preventDefault();
                          }}
                          onClick={() => {
                            addCatalogItemToPr(sug);
                            setPrItemSearch(title);
                            setPrItemSearchOpen(false);
                          }}
                        >
                          <div className="text-sm font-medium truncate">{title || "-"}</div>
                          {subtitle ? (
                            <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={addItem} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add Row
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[180px]">Item No.</TableHead>
                  <TableHead className="min-w-[260px]">Material Description *</TableHead>
                  <TableHead className="w-[140px]">Unit</TableHead>
                  <TableHead className="w-[150px]">Qty / Flat *</TableHead>
                  <TableHead className="w-[140px]">Total Qty</TableHead>
                  <TableHead className="min-w-[220px]">Place of Utilisation</TableHead>
                  <TableHead className="w-[64px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.items.filter((item) => matchesPrItemSearch(item)).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No matching items. Add a row to continue.
                    </TableCell>
                  </TableRow>
                ) : (
                  form.items.map((item, index) =>
                    matchesPrItemSearch(item) ? (
                        <TableRow key={`item-${index}`}>
                        <TableCell className="align-top">
                        <Input
                          value={item.item_no || item.item_name || item.itemName || item.make}
                          onChange={(e) => setItemField(index, "item_no", e.target.value)}
                          placeholder="Item no."
                          className="h-9"
                          />
                        </TableCell>
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
                            value={item.req_qty}
                            onChange={(e) => setItemField(index, "req_qty", e.target.value)}
                            placeholder="0"
                          className="h-9 w-full"
                        />
                      </TableCell>
                        <TableCell className="align-top">
                          <Input
                            value={String(getPreviewQtyForItem(item) || "")}
                            readOnly
                            className="h-9 w-full bg-muted/40"
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
                    ) : null
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={goBackToList} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" /> Create PR
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
