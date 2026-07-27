import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { downloadSamplePdf } from "@/lib/samplePdf";
import { useToast } from "@/hooks/use-toast";
import { getSamplePrimaryIdentifier, resolveSampleClient } from "@/lib/sampleDisplay";
import { Loader2, ArrowLeft, Download, Eye, FileText, Image as ImageIcon, Pencil } from "lucide-react";

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

const parseMaybeJson = (val, fallback) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val ?? fallback;
};

const getRowFieldValue = (row, key) => {
  const fields = parseMaybeJson(row?.add_fields, []);
  if (Array.isArray(fields)) {
    const found = fields.find((f) => String(f?.key || "").trim() === key);
    const value = found?.value;
    if (value != null && String(value).trim() !== "") return value;
  }
  return row?.[key] ?? "";
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};

const extractBackpathRecords = (payload, key, chainKey) => {
  const direct = payload?.[key] ?? payload?.data?.[key];
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === "object") return [direct];

  const chain = payload?.upstream_chain ?? payload?.data?.upstream_chain ?? payload?.chain ?? payload?.data?.chain ?? {};
  const chainValue = chain?.[chainKey] ?? chain?.[key] ?? chain?.[`${key.slice(0, -1)}`];
  return asArray(chainValue);
};

const getRecordId = (row) =>
  String(
    row?.id ??
      row?.sample_id ??
      row?.sampleId ??
      row?.po_id ??
      row?.poId ??
      row?.dc_id ??
      row?.dcId ??
      row?.mir_id ??
      row?.mirId ??
      row?.inventory_id ??
      row?.inventoryId ??
      row?.inventoryID ??
      row?.sr_no ??
      row?.srno ??
      row?.srNo ??
      ""
  ).trim();

const dedupeRecords = (records) => {
  const map = new Map();
  for (const record of asArray(records)) {
    const key = getRecordId(record) || JSON.stringify(record ?? {});
    if (!map.has(key)) map.set(key, record);
  }
  return Array.from(map.values());
};

const normalizeLookupKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isManualLikeRow = (row = {}) => {
  const description = String(
    row?.description || row?.material_description || row?.item_name || row?.itemName || row?.item_code || row?.code || ""
  ).trim();
  if (!description) return false;

  const boqSignals = [
    row?.boq_id,
    row?.boqId,
    row?.boq_key,
    row?.boqKey,
    row?.boq_match_key,
    row?.boqMatchKey,
    getRowFieldValue(row, "boq_id"),
    getRowFieldValue(row, "boq_key"),
    getRowFieldValue(row, "boq_match_key"),
  ];

  return !boqSignals.some((value) => String(value ?? "").trim() !== "");
};

const buildLookupKeys = (row) => {
  const keys = [
    row?.boq_id,
    row?.boqId,
    row?.boq_item_code,
    row?.boqItemCode,
    row?.item_code,
    row?.itemCode,
    row?.code,
    row?.material_description,
    row?.make,
    row?.description,
    row?.item_description,
    row?.itemDescription,
    row?.item_name,
    row?.itemName,
  ]
    .map(normalizeLookupKey)
    .filter(Boolean);

  return Array.from(new Set(keys));
};

const getEffectiveQty = (row) => {
  const isBoqRow = Boolean(
    row?.boq_id ||
    row?.boqId ||
    row?.boq_key ||
    row?.boqKey ||
    row?.boq_match_key ||
    row?.boqMatchKey ||
    getRowFieldValue(row, "boq_id") ||
    getRowFieldValue(row, "boq_key") ||
    getRowFieldValue(row, "boq_match_key")
  );
  const candidates = [
    row?.total_qty,
    row?.totalQty,
    getRowFieldValue(row, "total_qty"),
    getRowFieldValue(row, "totalQty"),
    row?.selected_qty,
    row?.selectedQty,
    getRowFieldValue(row, "selected_qty"),
    getRowFieldValue(row, "selectedQty"),
    row?.issued_qty,
    row?.issuedQty,
    getRowFieldValue(row, "issued_qty"),
    getRowFieldValue(row, "issuedQty"),
  ];
  for (const candidate of candidates) {
    const num = Number(String(candidate ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(num) && num > 0) return String(num);
  }

  const qtyPerFlat =
    row?.qty_per_flat ??
    row?.qtyPerFlat ??
    getRowFieldValue(row, "qty_per_flat") ??
    getRowFieldValue(row, "qtyPerFlat") ??
    row?.quantity ??
    row?.qty ??
    getRowFieldValue(row, "quantity") ??
    getRowFieldValue(row, "qty");
  const flats =
    row?.flat_count ??
    row?.flatCount ??
    row?.boq_flat_multiplier ??
    row?.boqFlatMultiplier ??
    getRowFieldValue(row, "flat_count") ??
    getRowFieldValue(row, "flatCount") ??
    getRowFieldValue(row, "boq_flat_multiplier") ??
    getRowFieldValue(row, "boqFlatMultiplier");
  const floors =
    row?.floors ??
    row?.floor_count ??
    row?.floorCount ??
    row?.boq_floor_multiplier ??
    row?.boqFloorMultiplier ??
    getRowFieldValue(row, "floors") ??
    getRowFieldValue(row, "floor_count") ??
    getRowFieldValue(row, "floorCount") ??
    getRowFieldValue(row, "boq_floor_multiplier") ??
    getRowFieldValue(row, "boqFloorMultiplier");

  const qty = Number(String(qtyPerFlat ?? "").replace(/,/g, "").trim());
  const flatNum = Number(String(flats ?? "").replace(/,/g, "").trim());
  const floorNum = Number(String(floors ?? "").replace(/,/g, "").trim());
  if (Number.isFinite(qty) && qty > 0 && Number.isFinite(flatNum) && flatNum > 0 && Number.isFinite(floorNum) && floorNum > 0) {
    return String(qty * flatNum * floorNum);
  }

  if (isBoqRow) {
    const rawBoqQty = Number(String(row?.quantity ?? row?.qty ?? getRowFieldValue(row, "quantity") ?? getRowFieldValue(row, "qty") ?? "").replace(/,/g, "").trim());
    if (Number.isFinite(rawBoqQty) && rawBoqQty > 0) return String(rawBoqQty);
  }

  const rawQty = Number(String(row?.quantity ?? row?.qty ?? "").replace(/,/g, "").trim());
  if (Number.isFinite(rawQty) && rawQty > 0) return String(rawQty);

  if (isManualLikeRow(row)) {
    const fallbackQty = flatNum > 0 ? flatNum : floorNum > 0 ? floorNum : 1;
    return String(fallbackQty);
  }

  return "";
};

const getSampleFloorValue = (sample = {}) =>
  sample?.location?.floor ??
  sample?.floors ??
  sample?.floor ??
  sample?.location?.floor_no ??
  sample?.location?.floorNo ??
  "";

export default function SamplePreview() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sample, setSample] = useState(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [displayItems, setDisplayItems] = useState([]);
  const [linkedPos, setLinkedPos] = useState([]);
  const [linkedPrs, setLinkedPrs] = useState([]);
  const [linkedDcs, setLinkedDcs] = useState([]);
  const [linkedMirs, setLinkedMirs] = useState([]);
  const [projectMirs, setProjectMirs] = useState([]);
  const [projectItrs, setProjectItrs] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const previewStateSample = location?.state?.sample ?? null;

  const resolveSampleRecord = (raw) => {
    if (Array.isArray(raw)) {
      return raw.find((row) => String(row?.sample_id ?? row?.id ?? "") === String(id)) || raw[0] || null;
    }
    return raw?.sample || raw?.data || raw || null;
  };

  const hydrateSample = (record) => {
    const s = resolveSampleRecord(record);
    if (!s) return;

    const loc = parseMaybeJson(s.location, {});
    const items = parseMaybeJson(s.item_description ?? s.items ?? s.item_descriptions, []);
    const adds = parseMaybeJson(s.add_fields, []);
    const sampleFileRaw =
      s.sample_file ??
      s.sample_file_path ??
      s.sample_files ??
      s.files ??
      s.file_path ??
      s.attachment ??
      s.attachment_path ??
      "";
    const sampleFile = pickSampleFilePath(sampleFileRaw);
    const sampleClient = resolveSampleClient(s, s.project_id);

    const toDisplayItems = (rawItems) => {
      const list = Array.isArray(rawItems) ? rawItems : [];
      if (list.length === 0) return [];

      const fieldVal = (row, key) => {
        const fields = parseMaybeJson(row?.add_fields, []);
        if (!Array.isArray(fields)) return "";
        const found = fields.find((f) => String(f?.key || "").trim() === key);
        return found?.value ?? "";
      };

      const looksLikeAddFields = list.some((row) => row && typeof row === "object" && Array.isArray(row.add_fields));
      if (looksLikeAddFields) {
        return list.map((row, index) => {
          const sr = row?.sr_no ?? row?.srno ?? row?.srNo ?? String(index + 1);
          const itemName =
            row?.item_name ??
            row?.itemName ??
            fieldVal(row, "item_name") ??
            fieldVal(row, "itemName") ??
            row?.name ??
            "";
          const itemCode =
            sampleClient === "rustomjee"
              ? (
                  row?.item_no ??
                  row?.itemNo ??
                  fieldVal(row, "item_no") ??
                  fieldVal(row, "itemNo") ??
                  row?.item_code ??
                  row?.itemCode ??
                  row?.code ??
                  fieldVal(row, "item_code") ??
                  fieldVal(row, "itemCode") ??
                  fieldVal(row, "code") ??
                  ""
                )
              : (
                  row?.item_code ??
                  row?.itemCode ??
                  row?.code ??
                  fieldVal(row, "item_code") ??
                  fieldVal(row, "itemCode") ??
                  fieldVal(row, "code") ??
                  ""
                );
          const brandName =
            row?.brand_name ??
            row?.brandName ??
            fieldVal(row, "brand_name") ??
            fieldVal(row, "brandName") ??
            "";
          const description =
            fieldVal(row, "description") ||
            fieldVal(row, "item") ||
            fieldVal(row, "material_description") ||
            fieldVal(row, "item_name") ||
            row?.description ||
            row?.item_name ||
            itemName ||
            "";
          const unit =
            (row?.unit ?? row?.uom ?? row?.UOM ?? "") ||
            fieldVal(row, "unit") ||
            fieldVal(row, "uom") ||
            fieldVal(row, "UOM") ||
            "";
          const qty =
            getEffectiveQty(row) ||
            fieldVal(row, "selected_qty") ||
            fieldVal(row, "qty") ||
            fieldVal(row, "quantity") ||
            "";
          const rate = fieldVal(row, "rate") || "";
          const amount = fieldVal(row, "amount") || fieldVal(row, "value") || "";
          const inventoryId =
            (row?.inventory_id ?? row?.inventoryId ?? row?.inventoryID ?? null) ||
            fieldVal(row, "inventory_id") ||
            fieldVal(row, "inventoryId") ||
            null;
          const boqId =
            (row?.boq_id ?? row?.boqId ?? "") ||
            fieldVal(row, "boq_id") ||
            fieldVal(row, "boqId") ||
            "";
          const issuedQty =
            (row?.issued_qty ?? row?.issuedQty ?? "") ||
            fieldVal(row, "issued_qty") ||
            fieldVal(row, "issuedQty") ||
            "";
          const boqIssuedQty =
            (row?.boq_issued_qty ?? row?.boqIssuedQty ?? "") ||
            fieldVal(row, "boq_issued_qty") ||
            fieldVal(row, "boqIssuedQty") ||
            "";
          const boqItemCode =
            sampleClient === "rustomjee"
              ? ""
              : (
                  (row?.boq_item_code ?? row?.boqItemCode ?? "") ||
                  fieldVal(row, "boq_item_code") ||
                  fieldVal(row, "boqItemCode") ||
                  ""
                );
          const boqRemainingQty =
            (row?.boq_remaining_quantity ?? row?.boqRemainingQuantity ?? "") ||
            fieldVal(row, "boq_remaining_quantity") ||
            fieldVal(row, "boqRemainingQuantity") ||
            "";
          const computedValue = (() => {
            const q = Number(String(qty).replace(/,/g, "").trim());
            const r = Number(String(rate).replace(/,/g, "").trim());
            if (Number.isFinite(q) && Number.isFinite(r)) return String(q * r);
            return "";
          })();
          return {
            sr_no: sr,
            item_no:
              row?.item_no ??
              row?.itemNo ??
              fieldVal(row, "item_no") ??
              fieldVal(row, "itemNo") ??
              "",
            item_name:
              getSamplePrimaryIdentifier(row, sampleClient) ||
              row?.item_name ||
              row?.itemName ||
              fieldVal(row, "item_name") ||
              fieldVal(row, "itemName") ||
              row?.name ||
              "",
            brand_name: brandName,
            description,
            item_code: itemCode,
            specification:
              row?.specification ??
              row?.spec ??
              fieldVal(row, "specification") ??
              fieldVal(row, "spec") ??
              "",
            unit,
            quantity: qty,
            value: computedValue || amount,
            inventory_id: inventoryId,
            issued_qty: issuedQty,
            boq_id: boqId,
            boq_issued_qty: boqIssuedQty,
            boq_item_code: boqItemCode,
            boq_remaining_quantity: boqRemainingQty,
          };
        });
      }

      return list.map((row, index) => ({
        sr_no: row?.sr_no ?? row?.srno ?? row?.srNo ?? String(index + 1),
        item_no: row?.item_no ?? row?.itemNo ?? "",
        item_name: getSamplePrimaryIdentifier(row, sampleClient) || row?.item_name || row?.itemName || row?.name || "",
        brand_name: row?.brand_name ?? row?.brandName ?? "",
        description: row?.description ?? row?.material_description ?? row?.item ?? row?.item_name ?? row?.itemName ?? "",
        item_code:
          sampleClient === "rustomjee"
            ? (
                row?.item_no ??
                row?.itemNo ??
                row?.item_code ??
                row?.itemCode ??
                row?.code ??
                ""
              )
            : (row?.item_code ?? row?.itemCode ?? row?.code ?? ""),
        specification: row?.specification ?? row?.spec ?? "",
        unit: row?.unit ?? row?.uom ?? row?.UOM ?? "",
        quantity: getEffectiveQty(row) || row?.quantity || row?.qty || row?.req_qty || "",
        value: row?.value ?? row?.amount ?? "",
        inventory_id: row?.inventory_id ?? row?.inventoryId ?? row?.inventoryID ?? null,
        issued_qty: row?.issued_qty ?? row?.issuedQty ?? "",
        boq_id: row?.boq_id ?? row?.boqId ?? "",
        boq_issued_qty: row?.boq_issued_qty ?? row?.boqIssuedQty ?? "",
        boq_item_code: sampleClient === "rustomjee" ? "" : (row?.boq_item_code ?? row?.boqItemCode ?? ""),
        boq_remaining_quantity: row?.boq_remaining_quantity ?? row?.boqRemainingQuantity ?? "",
      }));
    };

    const normalizedDisplayItems = toDisplayItems(items);
    setDisplayItems(normalizedDisplayItems);

    setSample({
      sample_id: s.sample_id || s.id,
      project_id: s.project_id,
      building_name: s.building_name || "",
      site_name: s.site_name || "",
      flats: s.flats || "",
      floors: s.floors || s.floor || loc?.floor || "",
      work_done: s.work_done || "",
      sample_file: sampleFile,
      location: loc && typeof loc === 'object' ? loc : {},
      item_description: Array.isArray(items) ? items : [],
      add_fields: Array.isArray(adds) ? adds : [],
      created_at: s.created_at,
      updated_at: s.updated_at,
    });
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (previewStateSample) {
          hydrateSample(previewStateSample);
        }
        const res = await api.getSampleById(id);
        if (!res.success) {
          if (!previewStateSample) {
            setSample(null);
            setDisplayItems([]);
          }
          return;
        }
        hydrateSample(res.data);
      } catch {
        if (!previewStateSample) {
          setSample(null);
          setDisplayItems([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, projectId, previewStateSample]);

  useEffect(() => {
    const loadBackpath = async () => {
      const sampleKey = String(sample?.sample_id ?? sample?.id ?? id ?? "").trim();
      if (!sampleKey) {
        setLinkedPos([]);
        setLinkedDcs([]);
        setLinkedMirs([]);
        return;
      }

      try {
        const [backpathRes, chainRes] = await Promise.all([
          api.getBackpathBySample(sampleKey, { page: 1, limit: 200 }).catch(() => null),
          api.getSampleChain(sampleKey).catch(() => null),
        ]);

        const backpathPayload = backpathRes?.success ? (backpathRes.data ?? backpathRes) : null;
        const chainPayload = chainRes?.success ? (chainRes.data ?? chainRes) : null;
        if (!backpathPayload && !chainPayload) {
          setLinkedPos([]);
          setLinkedDcs([]);
          setLinkedMirs([]);
          return;
        }

        const pos = dedupeRecords([
          ...extractBackpathRecords(backpathPayload, "pos", "po"),
          ...extractBackpathRecords(chainPayload, "pos", "po"),
        ]);
        const dcs = dedupeRecords([
          ...extractBackpathRecords(backpathPayload, "dcs", "dc"),
          ...extractBackpathRecords(chainPayload, "dcs", "dc"),
        ]);
        const mirs = dedupeRecords([
          ...extractBackpathRecords(backpathPayload, "mirs", "mir"),
          ...extractBackpathRecords(chainPayload, "mirs", "mir"),
        ]);
        setLinkedPos(pos);
        setLinkedDcs(dcs);
        setLinkedMirs(mirs);
      } catch {
        setLinkedPos([]);
        setLinkedDcs([]);
        setLinkedMirs([]);
      }
    };

    loadBackpath();
  }, [sample?.project_id, projectId]);

  useEffect(() => {
    const loadSamplePrs = async () => {
      const sampleKey = String(sample?.sample_id ?? sample?.id ?? id ?? "").trim();
      if (!sampleKey) {
        setLinkedPrs([]);
        return;
      }

      try {
        const res = await api.getPrsBySample(sampleKey);
        if (!res?.success || !Array.isArray(res.data)) {
          setLinkedPrs([]);
          return;
        }
        setLinkedPrs(dedupeRecords(res.data));
      } catch {
        setLinkedPrs([]);
      }
    };

    loadSamplePrs();
  }, [sample?.sample_id, sample?.id, id]);

  useEffect(() => {
    const loadProjectMirs = async () => {
      const pid = sample?.project_id ?? projectId;
      if (!pid) {
        setProjectMirs([]);
        return;
      }

      try {
        const res = await api.getMirsByProject(pid);
        if (!res?.success || !Array.isArray(res.data)) {
          setProjectMirs([]);
          return;
        }
        setProjectMirs(res.data);
      } catch {
        setProjectMirs([]);
      }
    };

    loadProjectMirs();
  }, [sample?.project_id, projectId]);

  useEffect(() => {
    const loadProjectItrs = async () => {
      const pid = sample?.project_id ?? projectId;
      if (!pid) {
        setProjectItrs([]);
        return;
      }

      try {
        const res = await api.getItrsByProject(pid);
        if (!res?.success || !Array.isArray(res.data)) {
          setProjectItrs([]);
          return;
        }
        setProjectItrs(res.data);
      } catch {
        setProjectItrs([]);
      }
    };

    loadProjectItrs();
  }, [sample?.project_id, projectId]);

  const sampleClient = resolveSampleClient(sample, sample?.project_id);
  const isHiranandani = sampleClient === "hiranandani";
  const isRustomjee = sampleClient === "rustomjee";

  const fileUrl = sample?.sample_file ? api.getApiFileUrl(sample.sample_file) : null;
  const lower = String(sample?.sample_file || "").toLowerCase();
  const fileName = sample?.sample_file ? String(sample.sample_file).split('/').pop() : '';
  const isImage = lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp');
  const isPdf = lower.endsWith('.pdf');
  const fileTypeLabel = isImage ? 'Image' : isPdf ? 'PDF' : 'File';
  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const toCount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const toPositiveNumber = (value) => {
    const num = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(num) && num > 0 ? num : 0;
  };

  const getUsageCount = (usage, key) => {
    const direct = usage?.usage_counts?.[key];
    if (Number.isFinite(Number(direct))) return toCount(direct);

    const pluralKey = `used_in_${key}`;
    const pluralValue = usage?.[pluralKey];
    if (Array.isArray(pluralValue)) return pluralValue.length;
    if (typeof pluralValue === "number") return pluralValue;
    if (typeof pluralValue === "string" && pluralValue.trim()) return 1;
    return 0;
  };

  const sumUsageQty = (usage, key) => {
    const list = Array.isArray(usage?.[`used_in_${key}`]) ? usage[`used_in_${key}`] : [];
    if (list.length === 0) return 0;

    const total = list.reduce((sum, entry) => {
      const raw =
        entry?.boq_qty ??
        entry?.boqQty ??
        entry?.qty ??
        entry?.quantity ??
        entry?.issued_qty ??
        entry?.issuedQty ??
        entry?.total_qty ??
        entry?.totalQty ??
        entry?.value ??
        0;
      const num = Number(String(raw).replace(/,/g, "").trim());
      return sum + (Number.isFinite(num) ? num : 0);
    }, 0);

    return total;
  };

  const poQtyByBoqKey = (() => {
    const map = new Map();
    const targetSampleId = String(sample?.sample_id ?? sample?.id ?? "").trim();
    const sampleIdFallback = String(sample?.id ?? "").trim();
    if (!targetSampleId && !sampleIdFallback) return map;

    const getPoItems = (po) => {
      const rawItems = po?.items;
      if (Array.isArray(rawItems)) return rawItems;
      const parsed = parseMaybeJson(rawItems, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    for (const po of Array.isArray(linkedPos) ? linkedPos : []) {
      for (const item of getPoItems(po)) {
        const qty = toPositiveNumber(item?.qty ?? item?.quantity ?? item?.total_qty ?? item?.selected_qty ?? item?.req_qty);
        if (!qty) continue;

        const keys = [
          item?.boq_id,
          item?.boqId,
          item?.boq_item_code,
          item?.boqItemCode,
          item?.item_code,
          item?.itemCode,
          item?.code,
          item?.description,
          item?.item_description,
          item?.item_name,
        ]
          .map(normalizeLookupKey)
          .filter(Boolean);

        keys.forEach((key) => {
          map.set(key, (map.get(key) || 0) + qty);
        });
      }
    }

    return map;
  })();

  const dcQtyByBoqKey = (() => {
    const map = new Map();
    const targetSampleId = String(sample?.sample_id ?? sample?.id ?? "").trim();
    const sampleIdFallback = String(sample?.id ?? "").trim();
    if (!targetSampleId && !sampleIdFallback) return map;

    const getDcItems = (dc) => {
      const rawItems = dc?.items;
      if (Array.isArray(rawItems)) return rawItems;
      const parsed = parseMaybeJson(rawItems, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    for (const dc of Array.isArray(linkedDcs) ? linkedDcs : []) {
      for (const item of getDcItems(dc)) {
        const qty = toPositiveNumber(item?.quantity ?? item?.qty ?? item?.total_qty ?? item?.selected_qty ?? item?.issued_qty);
        if (!qty) continue;

        const keys = [
          item?.boq_id,
          item?.boqId,
          item?.boq_item_code,
          item?.boqItemCode,
          item?.item_code,
          item?.itemCode,
          item?.code,
          item?.description,
          item?.item_description,
          item?.item_name,
        ]
          .map(normalizeLookupKey)
          .filter(Boolean);

        keys.forEach((key) => {
          map.set(key, (map.get(key) || 0) + qty);
        });
      }
    }

    return map;
  })();

  const mirQtyByBoqKey = (() => {
    const map = new Map();
    const targetSampleId = String(sample?.sample_id ?? sample?.id ?? "").trim();
    const sampleIdFallback = String(sample?.id ?? "").trim();
    if (!targetSampleId && !sampleIdFallback) return map;

    const getMirItems = (mir) => {
      const rawItems = mir?.items;
      if (Array.isArray(rawItems)) return rawItems;
      const parsed = parseMaybeJson(rawItems, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    const linkedChallanNos = new Set(
      (Array.isArray(linkedDcs) ? linkedDcs : [])
        .flatMap((dc) => [
          String(dc?.challan_number ?? dc?.challan_no ?? dc?.challanNo ?? dc?.challan ?? "").trim(),
          String(dc?.challan_number?.challan_no ?? "").trim(),
        ])
        .filter(Boolean)
    );

    const mirSource = Array.isArray(linkedMirs) && linkedMirs.length > 0 ? linkedMirs : projectMirs;

    for (const mir of Array.isArray(mirSource) ? mirSource : []) {
      const mirChallanNo = String(mir?.challan_no ?? mir?.challanNo ?? "").trim();
      if (linkedChallanNos.size > 0 && (!mirChallanNo || !linkedChallanNos.has(mirChallanNo))) continue;

      for (const item of getMirItems(mir)) {
        const qty = toPositiveNumber(item?.qty ?? item?.quantity ?? item?.total_qty ?? item?.selected_qty ?? item?.issued_qty);
        if (!qty) continue;

        const keys = buildLookupKeys(item);

        keys.forEach((key) => {
          map.set(key, (map.get(key) || 0) + qty);
        });
      }
    }

    return map;
  })();

  const prQtyByBoqKey = (() => {
    const map = new Map();
    const getPrItems = (pr) => {
      const rawItems = pr?.items;
      if (Array.isArray(rawItems)) return rawItems;
      const parsed = parseMaybeJson(rawItems, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    for (const pr of Array.isArray(linkedPrs) ? linkedPrs : []) {
      for (const item of getPrItems(pr)) {
        const qty = toPositiveNumber(item?.req_qty ?? item?.qty ?? item?.quantity ?? item?.sample_total_qty ?? item?.sample_qty_per_flat);
        if (!qty) continue;

        const keys = buildLookupKeys({
          ...item,
          description: item?.description ?? item?.material_description ?? item?.make ?? item?.item_name ?? item?.name ?? "",
          item_name: item?.item_name ?? item?.make ?? item?.description ?? "",
        });

        keys.forEach((key) => {
          map.set(key, (map.get(key) || 0) + qty);
        });
      }
    }

    return map;
  })();

  const itrQtyByBoqKey = (() => {
    const map = new Map();
    const targetSampleId = String(sample?.sample_id ?? sample?.id ?? "").trim();
    const sampleIdFallback = String(sample?.id ?? "").trim();
    if (!targetSampleId && !sampleIdFallback) return map;

    const getItrItems = (itr) => {
      const rawItems = itr?.work_items ?? itr?.workItems ?? itr?.items;
      if (Array.isArray(rawItems)) return rawItems;
      const parsed = parseMaybeJson(rawItems, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    for (const itr of Array.isArray(projectItrs) ? projectItrs : []) {
      const itrSampleId = String(itr?.sample_id ?? itr?.sampleId ?? itr?.sample?.sample_id ?? "").trim();
      if (!itrSampleId || itrSampleId !== targetSampleId) continue;

      for (const item of getItrItems(itr)) {
        const qty = toPositiveNumber(item?.quantity ?? item?.qty ?? item?.current_qty ?? item?.currentQty ?? item?.boq_issued_qty ?? item?.boqIssuedQty);
        if (!qty) continue;

        const keys = buildLookupKeys(item);

        keys.forEach((key) => {
          map.set(key, (map.get(key) || 0) + qty);
        });
      }
    }

    return map;
  })();

  const sourceSummaryItems = Array.isArray(sample?.item_description) ? sample.item_description : [];
  const boqSummaryRows = (Array.isArray(displayItems) ? displayItems : []).map((row, index) => {
    const sourceRow = sourceSummaryItems[index] && typeof sourceSummaryItems[index] === "object" ? sourceSummaryItems[index] : {};
    const usage = row?.boq_usage || {};
    const description =
      row?.boq_description ||
      row?.description ||
      row?.material_description ||
      row?.item_description ||
      row?.itemDescription ||
      row?.item_name ||
      row?.name ||
      "-";
    const normalizedItemNo = String(
      sourceRow?.item_no ??
      sourceRow?.itemNo ??
      getRowFieldValue(sourceRow, "item_no") ??
      getRowFieldValue(sourceRow, "itemNo") ??
      row?.item_no ??
      row?.itemNo ??
      getRowFieldValue(row, "item_no") ??
      getRowFieldValue(row, "itemNo") ??
      ""
    ).trim();
    const itemNo = normalizedItemNo || "-";
    const itemName =
      row?.item_name ||
      row?.itemName ||
      row?.name ||
      row?.boq_description ||
      row?.description ||
      getSamplePrimaryIdentifier(row, sampleClient) ||
      itemNo ||
      "-";
    const itemDescription =
      row?.description ||
      row?.item_description ||
      row?.itemDescription ||
      row?.material_description ||
      row?.item_name ||
      row?.itemName ||
      "-";

    const sampleUsageQty = sumUsageQty(usage, "samples") || getUsageCount(usage, "samples");
    const effectiveSampleQty = sampleUsageQty || getEffectiveQty(row);
    const sampleQtyNumber = toPositiveNumber(effectiveSampleQty);
    const boqQtyNumber = toPositiveNumber(row?.boq_qty ?? row?.boqQty ?? row?.quantity ?? row?.qty);
    const rowLookupKeys = buildLookupKeys(row);
    const lookupQty = (lookupMap) => {
      for (const key of rowLookupKeys) {
        const match = lookupMap.get(key);
        if (Number.isFinite(Number(match))) return Number(match);
      }
      return 0;
    };
    const poQtyNumber = lookupQty(poQtyByBoqKey);
    const prQtyNumber = lookupQty(prQtyByBoqKey);
    const dcQtyNumber = lookupQty(dcQtyByBoqKey);
    const mirQtyNumber = lookupQty(mirQtyByBoqKey);
    const itrQtyNumber = lookupQty(itrQtyByBoqKey);
    const issuedQtyNumber = sampleQtyNumber || toPositiveNumber(row?.boq_issued_qty ?? row?.boqIssuedQty ?? row?.issued_qty ?? row?.issuedQty);
    const remainingQty = boqQtyNumber > 0 && sampleQtyNumber > 0 ? boqQtyNumber - sampleQtyNumber : row?.boq_remaining_quantity ?? row?.boqRemainingQuantity ?? "-";
    return {
      key: String(row?.boq_id ?? row?.boqId ?? row?.sr_no ?? row?.srNo ?? index),
      rawItemNo: String(row?.item_no ?? row?.itemNo ?? "").trim(),
      rawItemCode: String(
        sourceRow?.item_code ??
        sourceRow?.itemCode ??
        sourceRow?.code ??
        getRowFieldValue(sourceRow, "item_code") ??
        getRowFieldValue(sourceRow, "itemCode") ??
        getRowFieldValue(sourceRow, "code") ??
        row?.item_code ??
        row?.itemCode ??
        row?.code ??
        getRowFieldValue(row, "item_code") ??
        getRowFieldValue(row, "itemCode") ??
        getRowFieldValue(row, "code") ??
        ""
      ).trim(),
      itemNo,
      itemCode:
        String(
          row?.item_code ??
          row?.itemCode ??
          row?.code ??
          getRowFieldValue(row, "item_code") ??
          getRowFieldValue(row, "itemCode") ??
          getRowFieldValue(row, "code") ??
          ""
        ).trim(),
      boqDescription: description,
      itemName,
      itemDescription,
      itr: itrQtyNumber || sumUsageQty(usage, "itr") || getUsageCount(usage, "itr"),
      pr: prQtyNumber || sumUsageQty(usage, "pr") || getUsageCount(usage, "pr"),
      po: poQtyNumber || sumUsageQty(usage, "po") || getUsageCount(usage, "po"),
      dc: dcQtyNumber || sumUsageQty(usage, "dc") || getUsageCount(usage, "dc"),
      mir: mirQtyNumber || sumUsageQty(usage, "mir") || getUsageCount(usage, "mir"),
      samples: effectiveSampleQty || sampleUsageQty,
      remaining: remainingQty,
      issued:
        issuedQtyNumber ||
        row?.boq_issued_qty ||
        row?.boqIssuedQty ||
        row?.issued_qty ||
        row?.issuedQty ||
        "-",
    };
  });

  const usageColumnClass = {
    itr: "border-l border-border/70 bg-sky-50 text-sky-900 dark:border-border/50 dark:bg-sky-950/35 dark:text-sky-100",
    pr: "border-l border-border/70 bg-violet-50 text-violet-900 dark:border-border/50 dark:bg-violet-950/35 dark:text-violet-100",
    po: "border-l border-border/70 bg-amber-50 text-amber-900 dark:border-border/50 dark:bg-amber-950/35 dark:text-amber-100",
    dc: "border-l border-border/70 bg-rose-50 text-rose-900 dark:border-border/50 dark:bg-rose-950/35 dark:text-rose-100",
    mir: "border-l border-border/70 bg-orange-50 text-orange-900 dark:border-border/50 dark:bg-orange-950/35 dark:text-orange-100",
    samples: "border-l border-border/70 bg-emerald-50 text-emerald-900 dark:border-border/50 dark:bg-emerald-950/35 dark:text-emerald-100",
  };
  const isLodha = sampleClient === "lodha";

  const handleDownloadSamplePdf = async () => {
    if (!sample) return;
    try {
      setDownloading(true);
      await downloadSamplePdf(sample);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error?.message || "Could not generate the sample PDF.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 sm:px-6 lg:px-10">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-r from-background via-background to-muted/40 p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/30 bg-primary/5 text-primary">Sample Management</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Sample Preview</h1>
            <p className="text-muted-foreground mt-2">Detailed view and attachment inspection</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button variant="outline" onClick={handleDownloadSamplePdf} className="w-full sm:w-auto" disabled={!sample || downloading}>
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
            <Button onClick={() => navigate(`/${projectId}/samples/edit/${id}`)} className="w-full sm:w-auto" disabled={!sample}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Sample #{id}</CardTitle>
              <CardDescription>Preview data synced from sample record</CardDescription>
            </div>
            {sample?.sample_id && (
              <Badge variant="secondary" className="px-3 py-1">ID: {sample.sample_id}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !sample ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Sample not found</div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Project</div>
                    <div className="mt-1 text-sm font-semibold">{sample.project_id || '-'}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Created</div>
                    <div className="mt-1 text-sm font-semibold">{formatDate(sample.created_at)}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Updated</div>
                    <div className="mt-1 text-sm font-semibold">{formatDate(sample.updated_at)}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Building</div>
                    <div className="mt-1 text-sm font-semibold">{sample.building_name || '-'}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Site</div>
                    <div className="mt-1 text-sm font-semibold">{sample.site_name || '-'}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Flats</div>
                    <div className="mt-1 text-sm font-semibold">{sample.flats || '-'}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Floors</div>
                    <div className="mt-1 text-sm font-semibold">{sample.floors || getSampleFloorValue(sample) || '-'}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Work Done</div>
                    <div className="mt-1 text-sm font-semibold">{sample.work_done || '-'}</div>
                  </div>
                </div>

              <div className="space-y-3">
                  <div className="text-sm font-medium">Location</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border p-3 text-sm">{sample?.location?.floor || sample?.location?.address_line1 || '-'}</div>
                    <div className="rounded-lg border p-3 text-sm">{sample?.location?.block || sample?.location?.city || '-'}</div>
                    <div className="rounded-lg border p-3 text-sm">{sample?.location?.wing || sample?.location?.state || '-'}</div>
                    <div className="rounded-lg border p-3 text-sm">{sample?.location?.coordinates || sample?.location?.country || '-'}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                      <div>
                        <div className="text-sm font-medium">BOQ Usage Summary</div>
                        <div className="text-xs text-muted-foreground">
                          PR, PO, DC, MIR, ITR, Sample usage, and total consumption for each BOQ item
                        </div>
                      </div>
                      <Badge variant="secondary">{boqSummaryRows.length} item(s)</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[140px]">BOQ Item No</TableHead>
                            {!isRustomjee && <TableHead className="w-[140px]">Item Code</TableHead>}
                            <TableHead className="min-w-[220px]">Item Description</TableHead>
                            <TableHead className="w-[102px] border-l border-border/70 text-center bg-emerald-100 text-emerald-900 dark:border-border/50 dark:bg-emerald-950/35 dark:text-emerald-100">
                              Samples
                            </TableHead>
                            <TableHead className="w-[92px] border-l border-border/70 text-center bg-violet-100 text-violet-900 dark:border-border/50 dark:bg-violet-950/35 dark:text-violet-100">
                              PR
                            </TableHead>
                            <TableHead className="w-[92px] border-l border-border/70 text-center bg-amber-100 text-amber-900 dark:border-border/50 dark:bg-amber-950/35 dark:text-amber-100">
                              PO
                            </TableHead>
                            <TableHead className="w-[92px] border-l border-border/70 text-center bg-rose-100 text-rose-900 dark:border-border/50 dark:bg-rose-950/35 dark:text-rose-100">
                              DC
                            </TableHead>
                            <TableHead className="w-[92px] border-l border-border/70 text-center bg-orange-100 text-orange-900 dark:border-border/50 dark:bg-orange-950/35 dark:text-orange-100">
                              MIR
                            </TableHead>
                            <TableHead className="w-[92px] border-l border-border/70 text-center bg-sky-100 text-sky-900 dark:border-border/50 dark:bg-sky-950/35 dark:text-sky-100">
                              ITR
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {boqSummaryRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={isRustomjee ? 8 : 9} className="py-10 text-center text-muted-foreground">
                                No BOQ items available for this sample.
                              </TableCell>
                            </TableRow>
                          ) : (
                            boqSummaryRows.map((row) => (
                            <TableRow key={row.key} className="align-top">
                                <TableCell className="font-medium">{row.rawItemNo || row.itemNo || "-"}</TableCell>
                                {!isRustomjee && (
                                  <TableCell className="font-medium text-primary">{row.rawItemCode || row.itemCode || "-"}</TableCell>
                                )}
                                <TableCell className="max-w-[280px] text-muted-foreground">
                                  {row.itemDescription || "-"}
                                </TableCell>
                                <TableCell className={`text-center font-semibold ${usageColumnClass.samples}`}>
                                  {row.samples}
                                </TableCell>
                                <TableCell className={`text-center font-semibold ${usageColumnClass.pr}`}>
                                  {row.pr}
                                </TableCell>
                                <TableCell className={`text-center font-semibold ${usageColumnClass.po}`}>
                                  {row.po}
                                </TableCell>
                                <TableCell className={`text-center font-semibold ${usageColumnClass.dc}`}>
                                  {row.dc}
                                </TableCell>
                                <TableCell className={`text-center font-semibold ${usageColumnClass.mir}`}>
                                  {row.mir}
                                </TableCell>
                                <TableCell className={`text-center font-semibold ${usageColumnClass.itr}`}>
                                  {row.itr}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isImage ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                  Attachment
                </div>
                {!fileUrl ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No attachment found</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => setAttachmentOpen(true)} className="w-full mt-2">
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Attachment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={attachmentOpen} onOpenChange={setAttachmentOpen}>
        <DialogContent className="h-[96vh] w-[96vw] max-w-[96vw]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>Attachment Preview</DialogTitle>
              <p className="text-sm text-muted-foreground truncate">{fileName || 'Attachment'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{fileTypeLabel}</Badge>
              <Button asChild variant="outline" size="sm">
                <a href={fileUrl} target="_blank" rel="noreferrer">Open in new tab</a>
              </Button>
            </div>
          </div>

          {!fileUrl ? (
            <div className="flex h-[78vh] items-center justify-center text-muted-foreground">No attachment</div>
          ) : (
            <div className="mt-4 rounded-xl border bg-muted/10 p-3">
              {isImage ? (
                <img src={fileUrl} alt="Sample File" className="max-h-[78vh] object-contain w-full rounded-lg" />
              ) : isPdf ? (
                <iframe src={fileUrl} className="h-[78vh] w-full rounded-lg" title="Sample Attachment Preview" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium">Preview not available for this file type.</div>
                  <Button asChild>
                    <a href={fileUrl} target="_blank" rel="noreferrer">Open Attachment</a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
