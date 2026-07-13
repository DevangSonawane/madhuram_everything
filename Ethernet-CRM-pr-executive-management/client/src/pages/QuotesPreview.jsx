import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileSpreadsheet, Pencil, Save, X, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import QuoteLineItemsExcel from '@/components/quotes/QuoteLineItemsExcel';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function QuotesPreview({ inLayout = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftMeta, setDraftMeta] = useState(null);
  const [draftItems, setDraftItems] = useState([]);

  const flattenDynamicValues = (item) => {
    const row = { ...(item || {}) };
    const dv = item?.dynamic_values ?? item?.dynamicValues;
    if (!dv) return row;
    if (Array.isArray(dv)) {
      dv.forEach((entry) => {
        const key = entry?.field_key ?? entry?.fieldKey;
        if (!key) return;
        row[String(key)] = entry?.value ?? "";
      });
      return row;
    }
    if (dv && typeof dv === "object") {
      Object.entries(dv).forEach(([key, value]) => {
        if (!key) return;
        if (value && typeof value === "object" && "value" in value) {
          row[String(key)] = value?.value ?? "";
        } else {
          row[String(key)] = value;
        }
      });
    }
    return row;
  };

  useEffect(() => {
    let active = true;
    const loadFields = async () => {
      const result = await api.getQuotationFields({ active_only: true });
      if (!active) return;
      if (result?.success) {
        const payload = result.data?.data ?? result.data ?? {};
        const list = Array.isArray(payload?.fields) ? payload.fields : (Array.isArray(payload) ? payload : []);
        setFieldDefinitions(Array.isArray(list) ? list : []);
        return;
      }
      setFieldDefinitions([]);
    };
    loadFields();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const normalizedId = Number(id);
      if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        if (active) {
          setQuote(null);
          setLoading(false);
          // If the user lands here with a non-numeric id (e.g. route mismatch),
          // send them back to the quotations list without showing an error toast.
          navigate('/projects/quotes/add', { replace: true });
        }
        return;
      }

      const result = await api.getQuotationById(normalizedId);
      if (!active) return;
      if (result.success) {
        setQuote(result.data || null);
      } else {
        toast({
          title: 'Failed to load quotation',
          description: result.error || 'Unable to fetch quotation.',
          variant: 'destructive',
        });
      }
      setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [id, navigate, toast]);

  const items = useMemo(() => {
    const raw = Array.isArray(quote?.items) ? quote.items : [];
    return raw.map((row) => flattenDynamicValues(row));
  }, [quote]);

  const columnLabels = useMemo(() => {
    const labels = {};
    (Array.isArray(fieldDefinitions) ? fieldDefinitions : []).forEach((f) => {
      if (f?.field_key && f?.label) labels[String(f.field_key)] = String(f.label);
    });
    return labels;
  }, [fieldDefinitions]);

  const itemColumns = useMemo(() => {
    const fieldList = Array.isArray(fieldDefinitions) ? fieldDefinitions : [];
    const orderedFieldKeys = fieldList.length
      ? [...fieldList]
          .slice()
          .sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
          .map((f) => String(f.field_key))
          .filter(Boolean)
      : [];

    const seen = new Set(orderedFieldKeys);
    const extras = [];
    items.forEach((row) => {
      if (row && typeof row === "object") {
        Object.keys(row).forEach((k) => {
          if (seen.has(k)) return;
          seen.add(k);
          extras.push(k);
        });
      }
    });
    const derivedFirst = orderedFieldKeys.length ? orderedFieldKeys : [];
    return derivedFirst.length ? [...derivedFirst, ...extras] : extras;
  }, [fieldDefinitions, items]);

  const readOnlyColumns = useMemo(() => {
    const derived = new Set(
      (Array.isArray(fieldDefinitions) ? fieldDefinitions : [])
        .filter((f) => String(f?.field_role || "").toLowerCase() === "derived")
        .map((f) => String(f?.field_key || "").trim())
        .filter(Boolean)
    );
    ["total_rate", "amount", "final_rate_after_discount"].forEach((k) => derived.add(k));
    return Array.from(derived);
  }, [fieldDefinitions]);

  const normalizeKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const coreItemKeys = useMemo(() => new Set([
    "item_no",
    "sub_head",
    "description",
    "unit",
    "quantity",
    "basic_rate",
    "rate",
    "discount",
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "total_material_price",
    "labour",
    "material_plus_labour",
    "profit",
    "sort_order",
  ].map(normalizeKey)), []);
  const coreCanonicalByNormalized = useMemo(() => ([
    "item_no",
    "sub_head",
    "description",
    "unit",
    "quantity",
    "basic_rate",
    "rate",
    "discount",
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "total_material_price",
    "labour",
    "material_plus_labour",
    "profit",
    "sort_order",
  ].reduce((acc, key) => {
    acc[normalizeKey(key)] = key;
    return acc;
  }, {})), []);
  const derivedItemKeys = useMemo(() => new Set([
    "total_rate",
    "amount",
    "final_rate_after_discount",
  ].map(normalizeKey)), []);

  const normalizeListToArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
    if (typeof value === "string") {
      return value.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return [String(value)].filter(Boolean);
  };

  const beginEdit = () => {
    if (!quote) return;
    setDraftItems(items.map((row) => ({ ...(row || {}) })));
    setDraftMeta({
      project_name: quote?.project_name ?? "",
      client_name: quote?.client_name ?? "",
      quotation_no: quote?.quotation_no ?? "",
      quotation_date: quote?.quotation_date ?? "",
      gst_percentage: String(quote?.gst_percentage ?? quote?.gstPercentage ?? ""),
      last_date_revised_offer: quote?.last_date_revised_offer ?? "",
      is_revised_offer: Boolean(quote?.is_revised_offer),
      notes: quote?.notes ?? "",
      created_by: quote?.created_by ?? "",
      created_by_name: quote?.created_by_name ?? "",
      status: quote?.status ?? quote?.quotation_status ?? undefined,
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraftMeta(null);
    setDraftItems([]);
  };

  const updateDraftCell = (rowIndex, col, value) => {
    setDraftItems((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      if (!next[rowIndex]) next[rowIndex] = {};
      next[rowIndex] = { ...(next[rowIndex] || {}), [col]: value };
      return next;
    });
  };

  const handleSave = async () => {
    const normalizedId = Number(id);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      toast({ title: "Missing quotation id", variant: "destructive" });
      return;
    }
    if (!quote) return;

    const fieldList = Array.isArray(fieldDefinitions) ? fieldDefinitions : [];
    const fieldsByKey = fieldList.reduce((acc, f) => {
      const key = f?.field_key;
      if (!key) return acc;
      acc[String(key)] = f;
      return acc;
    }, {});
    const hasFieldsContract = fieldList.length > 0 && Object.keys(fieldsByKey).length > 0;

    const normalizeItemValue = (key, value) => {
      const k = normalizeKey(key);
      if (value == null) return "";
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return "";
        if (/(quantity|rate|amount|discount|fittings|transportation|support|miscellaneous|totalmaterialprice|labour|materialpluslabour|profit|totalrate)/i.test(k)) {
          const asNumber = Number(trimmed);
          return Number.isFinite(asNumber) ? asNumber : trimmed;
        }
        return trimmed;
      }
      return value;
    };
    const normalizeDynamicFieldValue = (def, value) => {
      if (value == null) return "";
      const type = String(def?.data_type || def?.dataType || "").toLowerCase();
      if (type === "number" || type === "percent") {
        const n = typeof value === "string" ? Number(value.trim()) : Number(value);
        return Number.isFinite(n) ? n : "";
      }
      const text = String(value).trim();
      return text;
    };

    const activeMeta = draftMeta || {};
    const workingRows = Array.isArray(draftItems) && draftItems.length ? draftItems : items;
    const workingColumns = Array.isArray(itemColumns) ? itemColumns : [];

    const nextItems = workingRows.map((rawRow) => {
      const row = rawRow && typeof rawRow === "object" ? rawRow : {};
      if (!hasFieldsContract) {
        const mapped = {};
        workingColumns.forEach((col) => {
          mapped[col] = normalizeItemValue(col, row?.[col]);
        });
        return mapped;
      }

      const item = {};
      workingColumns.forEach((col) => {
        const normalized = normalizeKey(col);
        if (derivedItemKeys.has(normalized)) return;
        if (coreItemKeys.has(normalized)) {
          const canonicalKey = coreCanonicalByNormalized?.[normalized] || col;
          item[canonicalKey] = normalizeItemValue(canonicalKey, row?.[col]);
        }
      });

      const dynamicValues = [];
      workingColumns.forEach((col) => {
        const normalized = normalizeKey(col);
        if (coreItemKeys.has(normalized)) return;
        if (derivedItemKeys.has(normalized)) return;
        const def = fieldsByKey[col];
        if (!def) return;
        if (String(def?.field_role || "").toLowerCase() === "derived") return;
        const value = normalizeDynamicFieldValue(def, row?.[col]);
        if (value === "" || value == null) return;
        const hasFormula = Boolean(String(def?.formula || def?.formula_description || "").trim());
        dynamicValues.push({
          field_key: String(def?.field_key || col),
          value,
          computed: hasFormula,
        });
      });
      if (dynamicValues.length) item.dynamic_values = dynamicValues;
      return item;
    });

    const payload = {
      project_name: activeMeta.project_name ?? quote?.project_name ?? "",
      client_name: activeMeta.client_name ?? quote?.client_name ?? "",
      quotation_no: activeMeta.quotation_no ?? quote?.quotation_no ?? "",
      quotation_date: (activeMeta.quotation_date ?? quote?.quotation_date ?? "") || new Date().toISOString().slice(0, 10),
      gst_percentage: Number(activeMeta.gst_percentage ?? quote?.gst_percentage ?? 0) || 0,
      last_date_revised_offer: activeMeta.last_date_revised_offer || quote?.last_date_revised_offer || undefined,
      is_revised_offer: Boolean(activeMeta.is_revised_offer ?? quote?.is_revised_offer),
      notes: activeMeta.notes ?? quote?.notes ?? "",
      created_by: activeMeta.created_by ?? quote?.created_by ?? "",
      created_by_name: activeMeta.created_by_name ?? quote?.created_by_name ?? "",
      status: activeMeta.status ?? quote?.status ?? quote?.quotation_status ?? undefined,
      boq_files: normalizeListToArray(quote?.boq_files ?? quote?.boq_file ?? quote?.boqFiles ?? quote?.boqFile),
      drawing_files: normalizeListToArray(quote?.drawing_files ?? quote?.drawing_file ?? quote?.drawingFiles ?? quote?.drawingFile),
      items: nextItems,
    };

    setIsSaving(true);
    const result = await api.updateQuotation(normalizedId, payload);
    setIsSaving(false);
    if (!result?.success) {
      toast({
        title: "Save failed",
        description: result?.error || "Unable to save quotation.",
        variant: "destructive",
      });
      return;
    }

    const updated = result?.data?.quotation ?? result?.data?.data?.quotation ?? result?.data?.quotation_data ?? null;
    if (updated) setQuote(updated);
    else {
      const refreshed = await api.getQuotationById(normalizedId);
      if (refreshed?.success) setQuote(refreshed.data || null);
    }
    toast({ title: "Saved", description: "Quotation updated successfully." });
    cancelEdit();
  };

  const saveOnEnter = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!isSaving) handleSave();
  };

  const formatOfferDate = (value) => {
    if (!value) return "-";
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = String(value);
    if (text.includes("T")) return text.split("T")[0];
    return text.trim() || "-";
  };
  const normalizeList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
    if (typeof value === "string") {
      return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [String(value)].filter(Boolean);
  };
  const splitFilesAndUrls = (list) => {
    const files = [];
    const urls = [];
    list.forEach((entry) => {
      const text = String(entry);
      const isUrl = /^https?:\/\//i.test(text) || text.startsWith("/uploads") || text.startsWith("/");
      if (isUrl) {
        urls.push(text);
        const name = text.split("/").pop();
        if (name) files.push(name);
      } else {
        files.push(text);
      }
    });
    return { files, urls };
  };

  const boqRaw = normalizeList(
    quote?.boq_files ?? quote?.boq_file ?? quote?.boqFiles ?? quote?.boqFile
  );
  const boqUrlRaw = normalizeList(
    quote?.boq_file_urls ?? quote?.boq_files_urls ?? quote?.boq_file_url ?? quote?.boq_files_url ?? quote?.boq_urls ?? quote?.boq_links
  );
  const drawingRaw = normalizeList(
    quote?.drawing_files ?? quote?.drawing_file ?? quote?.drawingFiles ?? quote?.drawingFile
  );
  const drawingUrlRaw = normalizeList(
    quote?.drawing_file_urls ?? quote?.drawing_files_urls ?? quote?.drawing_file_url ?? quote?.drawing_files_url ?? quote?.drawing_urls ?? quote?.drawing_links
  );

  const boqSplit = splitFilesAndUrls([...boqRaw, ...boqUrlRaw]);
  const drawingSplit = splitFilesAndUrls([...drawingRaw, ...drawingUrlRaw]);

  const boqFiles = boqSplit.files.length ? boqSplit.files : [];
  const boqUrls = boqSplit.urls.length ? boqSplit.urls : [];
  const drawingFiles = drawingSplit.files.length ? drawingSplit.files : [];
  const drawingUrls = drawingSplit.urls.length ? drawingSplit.urls : [];

  const revisedOfferDate = formatOfferDate(quote?.last_date_revised_offer || quote?.quotation_date);
  const quotationDate = formatOfferDate(quote?.quotation_date);
  const gstPercentage = quote?.gst_percentage ?? quote?.gstPercentage;
  const gstDisplay = gstPercentage == null || gstPercentage === "" ? "-" : String(gstPercentage);
  const isRevisedOffer =
    typeof quote?.is_revised_offer === "boolean"
      ? quote.is_revised_offer
        ? "Yes"
        : "No"
      : quote?.is_revised_offer != null
      ? String(quote.is_revised_offer)
      : "-";
  const notes = quote?.notes || "-";
  const createdBy = quote?.created_by || "-";
  const createdByName = quote?.created_by_name || "-";

  const handleDownloadExcel = () => {
    if (!quote) return;
    try {
      setDownloading(true);
      const headerRows = [
        { field: "Project Name", value: quote.project_name || "" },
        { field: "Client Name", value: quote.client_name || "" },
        { field: "Quotation No", value: quote.quotation_no || "" },
        { field: "Quotation Date", value: quotationDate === "-" ? "" : quotationDate },
        { field: "Gst Percentage", value: gstDisplay === "-" ? "" : gstDisplay },
        { field: "Boq Files", value: boqFiles.join(", ") },
        { field: "Boq File Urls", value: boqUrls.join(", ") },
        { field: "Drawing Files", value: drawingFiles.join(", ") },
        { field: "Drawing File Urls", value: drawingUrls.join(", ") },
        { field: "Last Date Revised Offer", value: revisedOfferDate === "-" ? "" : revisedOfferDate },
        { field: "Is Revised Offer", value: isRevisedOffer === "-" ? "" : isRevisedOffer },
        { field: "Notes", value: notes === "-" ? "" : notes },
        { field: "Created By", value: createdBy === "-" ? "" : createdBy },
        { field: "Created By Name", value: createdByName === "-" ? "" : createdByName },
      ];

      const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const getItemValue = (item, keys) => {
        if (!item || !keys?.length) return "";
        const direct = keys.find((k) => item[k] != null && item[k] !== "");
        if (direct) return item[direct];
        const normalizedMap = Object.keys(item).reduce((acc, key) => {
          acc[normalizeKey(key)] = item[key];
          return acc;
        }, {});
        const match = keys.find((k) => normalizedMap[normalizeKey(k)] != null && normalizedMap[normalizeKey(k)] !== "");
        return match ? normalizedMap[normalizeKey(match)] : "";
      };

      const itemColumns = [
        { label: "Item Nos.", keys: ["item_no", "itemNo"] },
        { label: "Description", keys: ["description", "item_description"] },
        { label: "Unit", keys: ["unit"] },
        { label: "Qty.", keys: ["quantity", "qty"] },
        { label: "Rate", keys: ["basic_rate", "basicRate", "rate"] },
        { label: "Amount", keys: ["amount", "total_amount", "totalAmount"] },
        { label: "BASIC RATE", keys: ["basic_rate", "basicRate"] },
        { label: "DISCOUNT", keys: ["discount"] },
        { label: "FINAL RATE AFTER DISCOUNT", keys: ["final_rate_after_discount", "finalRateAfterDiscount", "final_rate"] },
        { label: "FITTINGS", keys: ["fittings"] },
        { label: "TRANSPORTATION", keys: ["transportation", "transport"] },
        { label: "SUPPORT", keys: ["support"] },
        { label: "PROFIT", keys: ["profit"] },
        { label: "MISCELLANIOUS", keys: ["miscellaneous", "miscellaneous_cost", "miscellaneousCost", "misc"] },
        { label: "TOTAL MATERIAL PRICE", keys: ["total_material_price", "totalMaterialPrice"] },
        { label: "LABOUR", keys: ["labour", "labor"] },
        { label: "Material + Labour", keys: ["material_plus_labour", "materialPlusLabour"] },
        { label: "Total rate", keys: ["total_rate", "totalRate"] },
      ];

      const itemRows = items.map((item, idx) => {
        const row = {};
        itemColumns.forEach((col) => {
          const value = getItemValue(item, col.keys);
          row[col.label] = value ?? "";
        });
        if (!row["Item Nos."]) row["Item Nos."] = idx + 1;
        return row;
      });

      const wb = XLSX.utils.book_new();
      const detailsAoa = [];
      detailsAoa.push(["Quotation Details", ""]);
      detailsAoa.push(["", ""]);
      detailsAoa.push(["Field", "Value"]);
      headerRows.forEach((row) => {
        detailsAoa.push([row.field, row.value]);
      });

      const wsHeader = XLSX.utils.aoa_to_sheet(detailsAoa);
      wsHeader["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      wsHeader["!cols"] = [{ wch: 28 }, { wch: 90 }];
      wsHeader["!rows"] = wsHeader["!rows"] || [];

      // Basic styling for readability (style support depends on SheetJS build).
      const titleStyle = { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } };
      const headStyle = { font: { bold: true }, alignment: { horizontal: "left", vertical: "center" } };
      const valueWrapStyle = { alignment: { wrapText: true, vertical: "top" } };
      const setStyle = (r, c, style) => {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = wsHeader[addr];
        if (!cell) return;
        cell.s = cell.s ? { ...cell.s, ...style } : style;
      };

      setStyle(0, 0, titleStyle);
      setStyle(2, 0, headStyle);
      setStyle(2, 1, headStyle);

      // Wrap all values and increase row height for long text/urls.
      for (let r = 3; r < detailsAoa.length; r += 1) {
        setStyle(r, 1, valueWrapStyle);
        const value = detailsAoa[r]?.[1];
        const text = value == null ? "" : String(value);
        const newlineCount = (text.match(/\n/g) || []).length + 1;
        const approxLines = Math.ceil(text.length / 95);
        const lines = Math.max(newlineCount, approxLines, 1);
        wsHeader["!rows"][r] = { hpt: 14 * Math.min(12, lines) };
      }
      wsHeader["!rows"][0] = { hpt: 22 };

      XLSX.utils.book_append_sheet(wb, wsHeader, "Details");
      const aoa = [];
      const totalCols = itemColumns.length;
      aoa.push(["SCHEDULE OF QUANTITIES", ...Array(totalCols - 1).fill("")]);
      aoa.push(Array(totalCols).fill(""));
      aoa.push(itemColumns.map((col) => col.label));
      if (itemRows.length === 0) {
        aoa.push(Array(totalCols).fill(""));
      } else {
        itemRows.forEach((row) => {
          aoa.push(itemColumns.map((col) => row[col.label]));
        });
      }

      const wsItems = XLSX.utils.aoa_to_sheet(aoa);
      wsItems["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
      wsItems["!cols"] = itemColumns.map((col, idx) => {
        if (idx === 1) return { wch: 50 };
        if (idx === 0) return { wch: 10 };
        if (idx === 2) return { wch: 8 };
        return { wch: 12 };
      });

      // Prevent long descriptions from overflowing into adjacent cells by wrapping text
      // and giving rows a reasonable height. (Styling support depends on SheetJS build.)
      const descriptionCol = 1; // "Description"
      wsItems["!rows"] = wsItems["!rows"] || [];
      const wrapStyle = { alignment: { wrapText: true, vertical: "top" } };
      const setCellWrap = (r, c) => {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = wsItems[addr];
        if (!cell) return;
        cell.s = cell.s ? { ...cell.s, ...wrapStyle } : wrapStyle;
      };

      // Wrap header cell too
      setCellWrap(2, descriptionCol);

      // Data rows start at r=3
      for (let r = 3; r < aoa.length; r += 1) {
        setCellWrap(r, descriptionCol);
        const desc = aoa[r]?.[descriptionCol];
        const text = desc == null ? "" : String(desc);
        // Heuristic: ~60 chars per line at wch ~50, cap to avoid huge rows.
        const lines = Math.max(1, Math.min(10, Math.ceil(text.length / 60)));
        wsItems["!rows"][r] = { hpt: 14 * lines };
      }

      XLSX.utils.book_append_sheet(wb, wsItems, "BOQ");

      const safeNo = String(quote.quotation_no || "quotation").replace(/[^\w-]+/g, "_");
      XLSX.writeFile(wb, `${safeNo}_preview.xlsx`);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error?.message || "Could not generate Excel.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const isStandalone = !inLayout && location.pathname.startsWith("/projects/quotes");
  const containerClass = isStandalone
    ? "w-full max-w-none px-3 sm:px-4 md:px-8 pt-3 sm:pt-4 md:pt-8 space-y-6"
    : "space-y-6";

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotation Preview</h1>
          <p className="text-muted-foreground mt-2">Details and BOQ items.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadExcel}
            disabled={loading || !quote || downloading}
            className="w-full sm:w-auto"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {downloading ? "Preparing..." : "Download Excel"}
          </Button>
          {quote ? (
            isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={beginEdit}
                disabled={loading || !quote}
                className="w-full sm:w-auto"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )
          ) : null}
          <Button variant="ghost" onClick={() => navigate('/projects/quotes/add')} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quotes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quotation Details</CardTitle>
          <CardDescription>Review the quotation header and line items.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading quotation...</div>
          ) : quote ? (
            <>
              {isEditing && draftMeta ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Project Name</div>
                      <Input
                        value={draftMeta.project_name}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), project_name: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Client Name</div>
                      <Input
                        value={draftMeta.client_name}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), client_name: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Quotation No</div>
                      <Input
                        value={draftMeta.quotation_no}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), quotation_no: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Quotation Date</div>
                      <Input
                        type="date"
                        value={String(draftMeta.quotation_date || "").includes("T") ? String(draftMeta.quotation_date).split("T")[0] : String(draftMeta.quotation_date || "")}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), quotation_date: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">GST Percentage</div>
                      <Input
                        inputMode="decimal"
                        value={draftMeta.gst_percentage}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), gst_percentage: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Last Date Revised Offer</div>
                      <Input
                        type="date"
                        value={String(draftMeta.last_date_revised_offer || "").includes("T") ? String(draftMeta.last_date_revised_offer).split("T")[0] : String(draftMeta.last_date_revised_offer || "")}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), last_date_revised_offer: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Is Revised Offer</div>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={draftMeta.is_revised_offer ? "yes" : "no"}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), is_revised_offer: e.target.value === "yes" }))}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <div className="text-xs text-muted-foreground">Notes</div>
                      <Textarea
                        value={draftMeta.notes}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), notes: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Created By</div>
                      <Input
                        value={draftMeta.created_by}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), created_by: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Created By Name</div>
                      <Input
                        value={draftMeta.created_by_name}
                        onChange={(e) => setDraftMeta((prev) => ({ ...(prev || {}), created_by_name: e.target.value }))}
                        onKeyDown={saveOnEnter}
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Tip: In the BOQ grid, values update only when you press Enter.
                  </div>
                </div>
              ) : null}
              {!isEditing ? (
                <div className="grid gap-2 md:grid-cols-2">
                  <div><strong>Project Name:</strong> {quote.project_name || '-'}</div>
                  <div><strong>Client Name:</strong> {quote.client_name || '-'}</div>
                  <div><strong>Quotation No:</strong> {quote.quotation_no || '-'}</div>
                  <div><strong>Quotation Date:</strong> {quotationDate}</div>
                  <div><strong>Gst Percentage:</strong> {gstDisplay}</div>
                  <div><strong>Boq Files:</strong> {boqFiles.length ? boqFiles.join(", ") : "-"}</div>
                  <div><strong>Boq File Urls:</strong> {boqUrls.length ? boqUrls.join(", ") : "-"}</div>
                  <div><strong>Drawing Files:</strong> {drawingFiles.length ? drawingFiles.join(", ") : "-"}</div>
                  <div><strong>Drawing File Urls:</strong> {drawingUrls.length ? drawingUrls.join(", ") : "-"}</div>
                  <div><strong>Last Date Revised Offer:</strong> {revisedOfferDate}</div>
                  <div><strong>Is Revised Offer:</strong> {isRevisedOffer}</div>
                  <div><strong>Notes:</strong> {notes}</div>
                  <div><strong>Created By:</strong> {createdBy}</div>
                  <div><strong>Created By Name:</strong> {createdByName}</div>
                </div>
              ) : null}
              <QuoteLineItemsExcel
                mode={isEditing ? "edit" : "view"}
                items={isEditing ? draftItems : items}
                columns={itemColumns}
                columnLabels={columnLabels}
                readOnlyColumns={readOnlyColumns}
                onCellChange={isEditing ? updateDraftCell : undefined}
                className="border border-border"
              />
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Quotation not found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
