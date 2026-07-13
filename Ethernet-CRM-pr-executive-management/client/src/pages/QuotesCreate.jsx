import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilePlus2, Plus, Upload, Loader2, ArrowLeft, FileText, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import QuotesSearch from "@/pages/QuotesSearch";
import VendorComparison from "@/pages/VendorComparison";
import { formatNumberIN } from "@/lib/numberFormat";
import QuoteLineItemsExcel from "@/components/quotes/QuoteLineItemsExcel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuotesCreate({ inLayout = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams();
  const { toast } = useToast();
  const boqInputRef = useRef(null);
  const drawingInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fieldDefinitions, setFieldDefinitions] = useState([]);
  const [fieldDefinitionsLoaded, setFieldDefinitionsLoaded] = useState(false);
  const [readOnlyColumns, setReadOnlyColumns] = useState([
    "total_rate",
    "amount",
    "final_rate_after_discount",
  ]);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [columnLabels, setColumnLabels] = useState({});
  const [percentAddonColumns, setPercentAddonColumns] = useState([
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "total_material_price",
    "labour",
    "material_plus_labour",
    "profit",
  ]);
  const [derivedFormulas, setDerivedFormulas] = useState({});
  const [addColumnDialog, setAddColumnDialog] = useState({
    open: false,
    insertAfter: null, // column key or null
    label: "",
    field_key: "",
    data_type: "number", // "number" | "text" | "percent"
    field_role: "input", // "input" | "text" | "percent_addon"
    // Formula builder (optional). When present, the column is treated as derived/read-only.
    logic_base: "",
    logic_base_value: "",
    logic_op: "+", // "+", "-", "*", "/", "%"
    logic_next: "",
    logic_next_value: "",
    logic_steps: [], // [{ op: "+", col: "quantity" }]
    description: "",
    sort_order: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [drawingFiles, setDrawingFiles] = useState([]);
  const [uploadedBoqLinks, setUploadedBoqLinks] = useState([]);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchMode, setSearchMode] = useState("inventory");
  const isEditMode = Boolean(editId);
  const [quotationMeta, setQuotationMeta] = useState({
    project_name: "",
    client_name: "",
    quotation_no: "",
    quotation_date: "",
    gst_percentage: "18",
    boq_files: "",
    drawing_files: "",
    last_date_revised_offer: "",
    is_revised_offer: false,
    notes: "",
    created_by: "",
    created_by_name: "",
  });

  const normalizeKey = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const readOnlyKeySet = useRef(new Set());

  useEffect(() => {
    readOnlyKeySet.current = new Set((readOnlyColumns || []).map((c) => normalizeKey(c)));
  }, [readOnlyColumns]);

  const coreItemKeys = useRef(
    new Set([
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
    ].map(normalizeKey))
  );
  const coreCanonicalByNormalized = useRef(
    [
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
    }, {})
  );
  const derivedItemKeys = useRef(
    new Set([
      "total_rate",
      "amount",
      "final_rate_after_discount",
    ].map(normalizeKey))
  );

  const buildFieldMaps = (fields) => {
    const list = Array.isArray(fields) ? fields : [];
    const byKey = {};
    list.forEach((f) => {
      const key = f?.field_key;
      if (!key) return;
      byKey[String(key)] = f;
    });
    return { list, byKey };
  };

  const applyFieldDefinitionsToSheet = ({ fields, columns }) => {
    const fieldList = Array.isArray(fields) ? fields : [];
    if (!fieldList.length) {
      return {
        columns: Array.isArray(columns) ? columns : [],
        labels: {},
        percentAddonKeys: percentAddonColumns,
        readOnly: readOnlyColumns,
      };
    }

    const orderedFieldKeys = [...fieldList]
      .slice()
      .sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
      .map((f) => String(f.field_key))
      .filter(Boolean);

    const labels = fieldList.reduce((acc, f) => {
      if (f?.field_key && f?.label) acc[String(f.field_key)] = String(f.label);
      return acc;
    }, {});

    const derivedKeys = new Set(
      fieldList
        .filter((f) => String(f?.field_role || "").toLowerCase() === "derived")
        .map((f) => normalizeKey(f.field_key))
    );
    // Always treat these as derived/read-only per docs.
    ["total_rate", "amount", "final_rate_after_discount"].forEach((k) => derivedKeys.add(normalizeKey(k)));

    const percentAddonKeys = [
      ...new Set(
        fieldList
          .filter((f) => String(f?.field_role || "").toLowerCase() === "percent_addon")
          .map((f) => String(f.field_key))
          .concat(percentAddonColumns || [])
      ),
    ];

    // Keep any extra columns that arrived from import/edit payload but aren’t in fields (append at end).
    const inputCols = Array.isArray(columns) ? columns : [];
    const extras = inputCols.filter((c) => !orderedFieldKeys.includes(c));
    const nextColumns = [...orderedFieldKeys, ...extras];

    return {
      columns: nextColumns,
      labels,
      percentAddonKeys,
      readOnly: Array.from(derivedKeys),
    };
  };

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
      setFieldDefinitionsLoaded(false);
      const result = await api.getQuotationFields({ active_only: true });
      if (!active) return;
      if (result?.success) {
        const payload = result.data?.data ?? result.data ?? {};
        const list = Array.isArray(payload?.fields) ? payload.fields : (Array.isArray(payload) ? payload : []);
        setFieldDefinitions(Array.isArray(list) ? list : []);
        setFieldDefinitionsLoaded(true);
        return;
      }
      // No toast: fields API may not exist in some environments; keep UI functional.
      setFieldDefinitions([]);
      setFieldDefinitionsLoaded(true);
    };
    loadFields();
    return () => {
      active = false;
    };
  }, []);

  const initSheetIfNeeded = useCallback(() => {
    if (previewColumns.length > 0) return previewColumns;
    const fallbackColumns = [
      "item_no",
      "sub_head",
      "description",
      "unit",
      "quantity",
      "basic_rate",
      "discount",
      "fittings",
      "transportation",
      "support",
      "miscellaneous",
      "total_rate",
      "amount",
      "final_rate_after_discount",
      "sort_order",
    ];
    const { columns: nextColumns, labels, percentAddonKeys, readOnly } = applyFieldDefinitionsToSheet({
      fields: fieldDefinitions,
      columns: fallbackColumns,
    });
    const cols = nextColumns.length ? nextColumns : fallbackColumns;
    setPreviewColumns(cols);
    if (labels && Object.keys(labels).length) {
      setColumnLabels(labels);
    }
    if (percentAddonKeys) setPercentAddonColumns(percentAddonKeys);
    if (readOnly) setReadOnlyColumns(readOnly);
    return cols;
  }, [fieldDefinitions, previewColumns, readOnlyColumns, percentAddonColumns]);

  useEffect(() => {
    if (!fieldDefinitionsLoaded) return;
    if (isEditMode) return;
    initSheetIfNeeded();
  }, [fieldDefinitionsLoaded, isEditMode, initSheetIfNeeded]);

  const handleImportBoqClick = () => {
    boqInputRef.current?.click();
  };

  const handleDrawingClick = () => {
    drawingInputRef.current?.click();
  };

  const handleDrawingFiles = (files) => {
    if (!files?.length) return;
    const next = Array.from(files);
    setDrawingFiles(next);
    setQuotationMeta((prev) => ({
      ...prev,
      drawing_files: next.map((file) => file.name).join(", "),
    }));
  };

  const removeDrawingFile = (index) => {
    setDrawingFiles((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setQuotationMeta((metaPrev) => ({
        ...metaPrev,
        drawing_files: next.map((file) => file.name).join(", "),
      }));
      if (drawingInputRef.current) drawingInputRef.current.value = "";
      return next;
    });
  };

  const clearDrawingFiles = () => {
    setDrawingFiles([]);
    setQuotationMeta((prev) => ({ ...prev, drawing_files: "" }));
    if (drawingInputRef.current) drawingInputRef.current.value = "";
  };

  const handleBoqFile = async (file) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await api.importQuotationExcel({
        file,
        save: false,
        drawingFiles,
        drawing_files: drawingFiles.map((f) => f.name).join(", "),
      });
      if (result.success) {
        const payload = result.data?.data ?? result.data ?? {};
        const normalizeLinks = (value) => {
          if (!value) return [];
          if (Array.isArray(value)) return value.filter(Boolean);
          if (typeof value === "string") {
            return value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          }
          return [];
        };
        const linkCandidates = [
          payload?.boq_file,
          payload?.boq_files,
          payload?.boqFile,
          payload?.boqFiles,
          payload?.file,
          payload?.file_url,
          payload?.fileUrl,
          payload?.url,
        ];
        const links = linkCandidates.flatMap(normalizeLinks);
        setUploadedBoqLinks(links);
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.rows)
            ? payload.rows
            : Array.isArray(payload.items)
              ? payload.items
              : Array.isArray(payload.data)
                ? payload.data
                : [];
        const columns = (() => {
          if (Array.isArray(payload.columns) && payload.columns.length) return payload.columns;
          if (!rows.length) return [];
          const ordered = [];
          const seen = new Set();
          rows.forEach((row) => {
            if (!row || typeof row !== "object") return;
            Object.keys(row).forEach((key) => {
              if (seen.has(key)) return;
              seen.add(key);
              ordered.push(key);
            });
          });
          return ordered;
        })();

        const { columns: nextColumns, labels, percentAddonKeys, readOnly } = applyFieldDefinitionsToSheet({
          fields: fieldDefinitions,
          rows,
          columns,
        });

        setPreviewColumns(nextColumns);
        setColumnLabels(labels);
        setPercentAddonColumns(percentAddonKeys);
        setReadOnlyColumns(readOnly);

        const recalculatedRows = rows.map((row) => {
          const basicKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("basic_rate"));
          const rateKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("rate"));
          const discountKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("discount"));
          const qtyKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("quantity"));
          const totalRateKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("total_rate"));
          const finalRateKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("final_rate_after_discount"));
          const amountKey = nextColumns.find((col) => normalizeKey(col) === normalizeKey("amount"));
          const percentKeys = percentAddonKeys || percentAddonColumns;
          if (!basicKey && !rateKey && !totalRateKey && !amountKey) return row;
          const rawBasic = toNumber(row?.[basicKey]);
          const rawRate = toNumber(row?.[rateKey]);
          const basicRate = rawBasic > 0 ? rawBasic : rawRate;
          const discount = toNumber(row?.[discountKey]);
          const percentSum = percentKeys.reduce((sum, key) => {
            const k = nextColumns.find((col) => normalizeKey(col) === normalizeKey(key));
            return k ? sum + toNumber(row?.[k]) : sum;
          }, 0);
          const totalRate = basicRate
            + (basicRate * percentSum) / 100
            - (basicRate * discount) / 100;
          const nextRow = { ...row };
          if (totalRateKey) nextRow[totalRateKey] = totalRate;
          const qty = toNumber(row?.[qtyKey]);
          const amount = totalRate * qty;
          if (amountKey) nextRow[amountKey] = amount;
          if (finalRateKey) nextRow[finalRateKey] = amount;
          return nextRow;
        });
        setPreviewRows(recalculatedRows);
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          setQuotationMeta((prev) => ({
            ...prev,
            project_name: payload.project_name || prev.project_name,
            client_name: payload.client_name || prev.client_name,
            quotation_no: payload.quotation_no || prev.quotation_no,
            quotation_date: payload.quotation_date || prev.quotation_date,
            gst_percentage: payload.gst_percentage != null ? String(payload.gst_percentage) : prev.gst_percentage,
            boq_files: payload.boq_files || prev.boq_files,
            drawing_files: payload.drawing_files || prev.drawing_files,
            last_date_revised_offer: payload.last_date_revised_offer || prev.last_date_revised_offer,
            notes: payload.notes || prev.notes,
            created_by: payload.created_by || prev.created_by,
            created_by_name: payload.created_by_name || prev.created_by_name,
          }));
        }
        toast({
          title: "BOQ imported",
          description: "Preview generated from the uploaded Excel.",
        });
      } else {
        toast({
          title: "Import failed",
          description: result.error || "Unable to import BOQ file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: error?.message || "Unable to import BOQ file.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (boqInputRef.current) boqInputRef.current.value = "";
    }
  };

  const handleBoqFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleBoqFile(file);
  };

  const handleDrawingChange = (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    handleDrawingFiles(files);
  };
  const getColumnKey = (target) =>
    previewColumns.find((col) => normalizeKey(col) === normalizeKey(target));
  const toNumber = (value) => {
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '');
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : 0;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const evaluateDerivedFormula = (row, formula) => {
    const base = String(formula?.base || "").trim();
    const baseValueRaw = formula?.base_value;
    const hasBaseValue = baseValueRaw !== undefined && baseValueRaw !== null;
    if (!base && !hasBaseValue) return 0;
    let current = base ? toNumber(row?.[base]) : toNumber(baseValueRaw ?? "");
    const steps = Array.isArray(formula?.steps) ? formula.steps : [];
    for (const step of steps) {
      const op = String(step?.op || "").trim();
      const col = String(step?.col || "").trim();
      const hasValue = step?.value !== undefined && step?.value !== null;
      const rhs = col ? toNumber(row?.[col]) : (hasValue ? toNumber(step?.value ?? "") : null);
      if (rhs === null) continue;
      if (op === "+") current += rhs;
      else if (op === "-") current -= rhs;
      else if (op === "*") current *= rhs;
      else if (op === "/") current = rhs === 0 ? 0 : current / rhs;
      else if (op === "%") current = (current * rhs) / 100;
    }
    return current;
  };

  const amountColumn =
    previewColumns.find((col) => normalizeKey(col) === "amount") ||
    previewColumns.find((col) => normalizeKey(col).includes("amount"));
  const totalAmount = amountColumn
    ? previewRows.reduce((sum, row) => {
        const raw = row?.[amountColumn];
        const num = Number(raw);
        return Number.isFinite(num) ? sum + num : sum;
      }, 0)
    : 0;

  const totalFields = [
    "basic_rate",
    "discount",
    "final_rate_after_discount",
    "fittings",
    "transportation",
    "support",
    "miscellaneous",
    "total_material_price",
    "labour",
    "material_plus_labour",
    "profit",
    "total_rate",
  ];

  const prettyLabel = (value) =>
    String(value)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const getColumnDisplayLabel = useCallback(
    (key) => {
      const k = String(key || "");
      return String((columnLabels || {})[k] || prettyLabel(k) || k);
    },
    [columnLabels],
  );

  const buildDerivedFormulaPreview = useCallback(
    (formula) => {
      const base = String(formula?.base || "").trim();
      const baseValueRaw = formula?.base_value;
      const hasBaseValue = baseValueRaw !== undefined && baseValueRaw !== null;
      if (!base && !hasBaseValue) return "";
      const steps = Array.isArray(formula?.steps) ? formula.steps : [];
      const baseLabel = String(baseValueRaw ?? "").trim();
      let out = base ? getColumnDisplayLabel(base) : (baseLabel === "" ? "0" : baseLabel);
      for (const step of steps) {
        const op = String(step?.op || "").trim();
        const col = String(step?.col || "").trim();
        const hasValue = step?.value !== undefined && step?.value !== null;
        const otherLabelRaw = String(step?.value ?? "").trim();
        const rhsLabel = col ? getColumnDisplayLabel(col) : (hasValue ? (otherLabelRaw === "" ? "0" : otherLabelRaw) : "");
        if (!rhsLabel) continue;
        if (op === "%") out += ` × (${rhsLabel} / 100)`;
        else if (op === "*") out += ` × ${rhsLabel}`;
        else if (op === "/") out += ` ÷ ${rhsLabel}`;
        else out += ` ${op} ${rhsLabel}`;
      }
      return out;
    },
    [getColumnDisplayLabel],
  );

  const totalsByField = totalFields.reduce((acc, field) => {
    const sum = previewRows.reduce((total, row) => {
      const raw = row?.[field];
      const num = Number(raw);
      return Number.isFinite(num) ? total + num : total;
    }, 0);
    acc[field] = sum;
    return acc;
  }, {});

  const updatePreviewCell = (rowIndex, column, value) => {
    if (readOnlyKeySet.current.has(normalizeKey(column))) return;
    setPreviewRows((prev) => {
      const next = [...prev];
      const row = { ...(next[rowIndex] || {}) };
      row[column] = value;
      // Recalculate derived fields based on percentage logic
      const basicKey = getColumnKey("basic_rate");
      const rateKey = getColumnKey("rate");
      const discountKey = getColumnKey("discount");
      const qtyKey = getColumnKey("quantity");
      const totalRateKey = getColumnKey("total_rate");
      const amountKey = getColumnKey("amount");
      const finalRateKey = getColumnKey("final_rate_after_discount");
      const percentKeys = percentAddonColumns;

      if (basicKey || totalRateKey || amountKey) {
        const rawBasic = toNumber(row[basicKey]);
        const rawRate = toNumber(row[rateKey]);
        const basicRate = rawBasic > 0 ? rawBasic : rawRate;
        const discount = toNumber(row[discountKey]);
        const percentSum = percentKeys.reduce((sum, key) => {
          const k = getColumnKey(key);
          return k ? sum + toNumber(row[k]) : sum;
        }, 0);
        const totalRate = basicRate
          + (basicRate * percentSum) / 100
          - (basicRate * discount) / 100;
        if (totalRateKey) row[totalRateKey] = totalRate;
        const qty = toNumber(row[qtyKey]);
        const amount = totalRate * qty;
        if (amountKey) row[amountKey] = amount;
        if (finalRateKey) row[finalRateKey] = amount;
      }

      if (normalizeKey(column) === normalizeKey("amount")) {
        if (finalRateKey) row[finalRateKey] = toNumber(value);
      }

      // Recalculate any ad-hoc derived formula columns created in this session.
      if (derivedFormulas && typeof derivedFormulas === "object") {
        Object.entries(derivedFormulas).forEach(([fieldKey, formula]) => {
          if (!fieldKey) return;
          row[fieldKey] = evaluateDerivedFormula(row, formula);
        });
      }

      next[rowIndex] = row;
      return next;
    });
  };

  const handleAddLine = () => {
    const columns = previewColumns.length > 0 ? previewColumns : initSheetIfNeeded();
    const emptyRow = columns.reduce((acc, col) => {
      acc[col] = "";
      return acc;
    }, {});
    if (derivedFormulas && typeof derivedFormulas === "object") {
      Object.entries(derivedFormulas).forEach(([fieldKey, formula]) => {
        if (!fieldKey) return;
        emptyRow[fieldKey] = evaluateDerivedFormula(emptyRow, formula);
      });
    }
    setPreviewRows((prev) => [...prev, emptyRow]);
  };

  const handleRemoveLine = (rowIndex) => {
    setPreviewRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
  };

  const handleInsertLine = (rowIndex) => {
    const columns = previewColumns.length > 0 ? previewColumns : initSheetIfNeeded();
    const emptyRow = columns.reduce((acc, col) => {
      acc[col] = "";
      return acc;
    }, {});
    if (derivedFormulas && typeof derivedFormulas === "object") {
      Object.entries(derivedFormulas).forEach(([fieldKey, formula]) => {
        if (!fieldKey) return;
        emptyRow[fieldKey] = evaluateDerivedFormula(emptyRow, formula);
      });
    }
    setPreviewRows((prev) => {
      const next = [...prev];
      next.splice(rowIndex, 0, emptyRow);
      return next;
    });
  };

  const makeUniqueColumnName = (columns, base) => {
    const existing = new Set((columns || []).map((c) => normalizeKey(c)));
    let candidate = base;
    let i = 1;
    while (existing.has(normalizeKey(candidate))) {
      i += 1;
      candidate = `${base}_${i}`;
    }
    return candidate;
  };

  const slugToKey = (text) => {
    const raw = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const base = raw || "custom_field";
    return /^[a-z]/.test(base) ? base : `field_${base}`;
  };

  const openAddColumnDialog = (insertAfter) => {
    setAddColumnDialog({
      open: true,
      insertAfter: insertAfter ?? null,
      label: "",
      field_key: "",
      data_type: "number",
      field_role: "input",
      logic_base: "",
      logic_base_value: "",
      logic_op: "+",
      logic_next: "",
      logic_next_value: "",
      logic_steps: [],
      description: "",
      sort_order: "",
    });
  };

  const isValidFieldKey = (value) => /^[a-z][a-z0-9_]*$/.test(String(value || ""));

  const insertColumnLocally = ({ fieldKey, label, fieldRole, insertAfter }) => {
    const nextKey = String(fieldKey || "").trim();
    if (!nextKey) return;
    setPreviewColumns((prev) => {
      const uniqueKey = makeUniqueColumnName(prev, nextKey);
      const next = [...prev];
      const idx = insertAfter ? next.findIndex((c) => c === insertAfter) : -1;
      if (idx >= 0) next.splice(idx + 1, 0, uniqueKey);
      else next.push(uniqueKey);

      setPreviewRows((rowsPrev) =>
        rowsPrev.map((row) => ({
          ...(row || {}),
          [uniqueKey]: "",
        }))
      );

      if (label) {
        setColumnLabels((labelsPrev) => ({ ...(labelsPrev || {}), [uniqueKey]: label }));
      }
      if (String(fieldRole || "").toLowerCase() === "percent_addon") {
        setPercentAddonColumns((prevKeys) => {
          const normalized = new Set((prevKeys || []).map(normalizeKey));
          if (normalized.has(normalizeKey(uniqueKey))) return prevKeys;
          return [...(prevKeys || []), uniqueKey];
        });
      }
      if (String(fieldRole || "").toLowerCase() === "derived") {
        setReadOnlyColumns((prevKeys) => {
          const normalized = new Set((prevKeys || []).map(normalizeKey));
          if (normalized.has(normalizeKey(uniqueKey))) return prevKeys;
          return [...(prevKeys || []), uniqueKey];
        });
      }

      return next;
    });
  };

  const applyAddColumn = async () => {
    let label = String(addColumnDialog.label || "").trim();
    const rawKey = String(addColumnDialog.field_key || "").trim();
    const insertAfter = addColumnDialog.insertAfter;
    const dataType = String(addColumnDialog.data_type || "number").trim();
    const selectedFieldRole = String(addColumnDialog.field_role || "input").trim();
    const description = String(addColumnDialog.description || "").trim();
    const sortOrderRaw = String(addColumnDialog.sort_order || "").trim();
    const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);

    const logicBase = String(addColumnDialog.logic_base || "").trim();
    const logicBaseValue = String(addColumnDialog.logic_base_value ?? "").trim();
    const logicSteps = Array.isArray(addColumnDialog.logic_steps) ? addColumnDialog.logic_steps : [];
    const logicNext = String(addColumnDialog.logic_next || "").trim();
    const logicNextValue = String(addColumnDialog.logic_next_value ?? "").trim();
    const logicOp = String(addColumnDialog.logic_op || "").trim();
    const effectiveLogicSteps =
      logicSteps.length > 0
        ? logicSteps
        : (logicBase && logicNext
            ? [
                ...(logicNext === "__other__"
                  ? [{ op: logicOp, value: logicNextValue }]
                  : [{ op: logicOp, col: logicNext }]),
              ]
            : []);
    const hasLogicBase = Boolean(logicBase);
    const hasLogicBaseValue = logicBase === "__other__";
    const derivedFormula =
      hasLogicBase || hasLogicBaseValue
        ? {
            base: logicBase === "__other__" ? "" : logicBase,
            base_value: logicBase === "__other__" ? logicBaseValue : undefined,
            steps: effectiveLogicSteps
              .map((s) => ({
                op: String(s?.op || "").trim(),
                col: String(s?.col || "").trim(),
                value: s?.value,
              }))
              .filter((s) => s.op && (s.col || (s.value !== undefined && s.value !== null))),
          }
        : null;
    const hasDerivedFormula = Boolean(derivedFormula && (derivedFormula.base || derivedFormula.base_value !== undefined));
    const formulaDescription = hasDerivedFormula ? buildDerivedFormulaPreview(derivedFormula) : "";
    const fieldRole = hasDerivedFormula ? "derived" : selectedFieldRole;

    if (!label) {
      label =
        String(formulaDescription || "").trim() ||
        (logicBase === "__other__"
          ? (String(logicBaseValue || "").trim() ? `Other ${String(logicBaseValue || "").trim()}` : "Other Value")
          : (logicBase ? getColumnDisplayLabel(logicBase) : "")) ||
        "New Column";
    }

    const baseKey = rawKey || slugToKey(label);
    const nextKey = makeUniqueColumnName(previewColumns, baseKey);

    if (!isValidFieldKey(nextKey)) {
      toast({
        title: "Invalid field_key",
        description: "Use lowercase letters, digits, underscores only (must start with a letter).",
        variant: "destructive",
      });
      return;
    }

    // Best-effort: create the field on the server (docs v2). If unavailable, fall back to local-only column.
    try {
      const result = await api.createQuotationField({
        field_key: nextKey,
        label,
        data_type: dataType,
        field_role: fieldRole,
        formula_description: formulaDescription || null,
        description: description || null,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : undefined,
        created_by: quotationMeta.created_by || undefined,
      });

      if (result?.success) {
        const saved =
          result.data?.data?.field ||
          result.data?.field ||
          result.data?.data ||
          result.data;
        if (saved && typeof saved === "object") {
          setFieldDefinitions((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const without = list.filter((f) => String(f?.field_key || "") !== String(saved?.field_key || nextKey));
            return [...without, saved];
          });
        }
        insertColumnLocally({
          fieldKey: nextKey,
          label,
          fieldRole,
          insertAfter,
        });
      } else {
        // If server rejects or endpoint missing, keep UI usable.
        insertColumnLocally({
          fieldKey: nextKey,
          label,
          fieldRole,
          insertAfter,
        });
        toast({
          title: "Column added locally",
          description: result?.error || "Fields API not available; column saved only in the current quote payload.",
        });
      }
    } catch (e) {
      insertColumnLocally({
        fieldKey: nextKey,
        label,
        fieldRole,
        insertAfter,
      });
      toast({
        title: "Column added locally",
        description: e?.message || "Fields API not available; column saved only in the current quote payload.",
      });
    }

    if (hasDerivedFormula) {
      setDerivedFormulas((prev) => ({ ...(prev || {}), [nextKey]: derivedFormula }));
      setReadOnlyColumns((prevKeys) => {
        const normalized = new Set((prevKeys || []).map(normalizeKey));
        if (normalized.has(normalizeKey(nextKey))) return prevKeys;
        return [...(prevKeys || []), nextKey];
      });
      setPreviewRows((prev) =>
        (prev || []).map((row) => ({
          ...(row || {}),
          [nextKey]: evaluateDerivedFormula(row, derivedFormula),
        }))
      );
    }

    setAddColumnDialog((prev) => ({ ...prev, open: false }));
  };

  const handleAddColumn = () => {
    openAddColumnDialog(null);
  };

  const handleInsertColumnAfter = (columnName) => {
    openAddColumnDialog(columnName);
  };

  const handleRemoveColumn = (columnName) => {
    const protectedKeys = new Set([
      "basic_rate",
      "rate",
      "discount",
      "quantity",
      "total_rate",
      "amount",
      "final_rate_after_discount",
    ].map(normalizeKey));
    if (protectedKeys.has(normalizeKey(columnName))) return;
    setPreviewColumns((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((c) => c !== columnName);
    });
    setPreviewRows((prev) =>
      prev.map((row) => {
        const next = { ...(row || {}) };
        delete next[columnName];
        return next;
      })
    );
    setColumnLabels((prev) => {
      const next = { ...(prev || {}) };
      delete next[columnName];
      return next;
    });
    setPercentAddonColumns((prev) => (prev || []).filter((k) => normalizeKey(k) !== normalizeKey(columnName)));
    setDerivedFormulas((prev) => {
      const next = { ...(prev || {}) };
      delete next[columnName];
      return next;
    });
    setReadOnlyColumns((prev) => (prev || []).filter((k) => normalizeKey(k) !== normalizeKey(columnName)));
  };

  const handleRenameColumn = (columnName, nextLabel) => {
    setColumnLabels((prev) => {
      const next = { ...(prev || {}) };
      const cleaned = String(nextLabel ?? "").trim();
      if (!cleaned) {
        delete next[columnName];
      } else {
        next[columnName] = cleaned;
      }
      return next;
    });
  };

  const handleMoveColumn = (fromIndex, toIndex) => {
    setPreviewColumns((prev) => {
      if (!Array.isArray(prev) || prev.length < 2) return prev;
      const from = Number(fromIndex);
      const to = Number(toIndex);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return prev;
      if (from === to) return prev;
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const insertAt = to > from ? to - 1 : to;
      next.splice(insertAt, 0, moved);
      return next;
    });
  };

  const handleMoveRow = (fromRowIndex, toRowIndex) => {
    setPreviewRows((prev) => {
      if (!Array.isArray(prev) || prev.length < 2) return prev;
      const from = Number(fromRowIndex);
      const to = Number(toRowIndex);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return prev;
      if (from === to) return prev;
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      const insertAt = to > from ? to - 1 : to;
      next.splice(insertAt, 0, moved);
      return next;
    });
  };

  const normalizeItemValue = (key, value) => {
    const numericKeys = new Set([
      "quantity",
      "rate",
      "amount",
      "basic_rate",
      "discount",
      "final_rate_after_discount",
      "fittings",
      "transportation",
      "support",
      "miscellaneous",
      "total_material_price",
      "labour",
      "material_plus_labour",
      "profit",
      "total_rate",
    ]);
    if (numericKeys.has(key)) {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    }
    return value ?? "";
  };

  const normalizeDynamicFieldValue = (fieldDef, value) => {
    const dataType = String(fieldDef?.data_type || "").toLowerCase();
    const role = String(fieldDef?.field_role || "").toLowerCase();
    const shouldBeNumber = dataType === "number" || dataType === "percent" || role === "percent_addon";
    if (!shouldBeNumber) return value ?? "";
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const handleCreateQuotation = async () => {
    if (!previewRows.length) {
      toast({
        title: "No items to create",
        description: "Add at least one line item (manually or by importing a BOQ file).",
        variant: "destructive",
      });
      return;
    }
    setIsCreating(true);
    try {
      if (!previewColumns.length) initSheetIfNeeded();
      const { byKey: fieldsByKey } = buildFieldMaps(fieldDefinitions);
      const hasFieldsContract = fieldDefinitionsLoaded && Object.keys(fieldsByKey).length > 0;

      const items = previewRows.map((rawRow) => {
        const row = rawRow && typeof rawRow === "object" ? rawRow : {};
        // If fields contract is available, build API v2 shape (core keys + dynamic_values).
        if (hasFieldsContract) {
          const item = {};
          previewColumns.forEach((col) => {
            const normalized = normalizeKey(col);
            if (derivedItemKeys.current.has(normalized)) return;
            if (coreItemKeys.current.has(normalized)) {
              const canonicalKey = coreCanonicalByNormalized.current?.[normalized] || col;
              item[canonicalKey] = normalizeItemValue(canonicalKey, row?.[col]);
            }
          });

          const dynamicValues = [];
          previewColumns.forEach((col) => {
            const normalized = normalizeKey(col);
            if (coreItemKeys.current.has(normalized)) return;
            if (derivedItemKeys.current.has(normalized)) return;
            const def = fieldsByKey[col];
            // Only send dynamic values that correspond to a known field definition.
            if (!def) return;
            if (String(def?.field_role || "").toLowerCase() === "derived") return;
            const rawValue = row?.[col];
            const value = normalizeDynamicFieldValue(def, rawValue);
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
        }

        // Fallback (older servers): keep previous behavior (flat row object).
        const mapped = {};
        previewColumns.forEach((col) => {
          mapped[col] = normalizeItemValue(col, row?.[col]);
        });
        return mapped;
      });

      const payload = {
        ...quotationMeta,
        quotation_date:
          quotationMeta.quotation_date || new Date().toISOString().slice(0, 10),
        last_date_revised_offer:
          quotationMeta.last_date_revised_offer || undefined,
        gst_percentage: Number(quotationMeta.gst_percentage) || 0,
        boq_files: String(quotationMeta.boq_files || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        drawing_files: String(quotationMeta.drawing_files || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        is_revised_offer: Boolean(quotationMeta.is_revised_offer),
        items,
      };
      const result = isEditMode
        ? await api.updateQuotation(editId, payload)
        : await api.createQuotation(payload);
      if (result.success) {
        const savedQuote = result.data || payload;
        toast({
          title: isEditMode ? "Quotation updated" : "Quotation created",
          description: isEditMode ? "Quotation updated successfully." : "Quotation saved successfully.",
        });
        navigate('/projects/quotes/add', { state: { createdQuotation: savedQuote } });
      } else {
        toast({
          title: "Create failed",
          description: result.error || "Unable to create quotation.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Create failed",
        description: error?.message || "Unable to create quotation.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const openSearchDialog = (mode) => {
    setSearchMode(mode);
    setSearchDialogOpen(true);
  };


  useEffect(() => {
    if (!isEditMode) return;
    let active = true;
    const loadQuote = async () => {
      const result = await api.getQuotationById(editId);
      if (!active) return;
      if (!result.success) {
        toast({
          title: "Failed to load quotation",
          description: result.error || "Unable to fetch quotation.",
          variant: "destructive",
        });
        return;
      }
      const quote = result.data || {};
      const items = Array.isArray(quote.items) ? quote.items : [];
      const flattenedItems = items.map((item) => flattenDynamicValues(item));
      const columns = (() => {
        if (!flattenedItems.length) return [];
        const ordered = [];
        const seen = new Set();
        flattenedItems.forEach((row) => {
          if (!row || typeof row !== "object") return;
          Object.keys(row).forEach((key) => {
            if (seen.has(key)) return;
            seen.add(key);
            ordered.push(key);
          });
        });
        return ordered;
      })();

      const { columns: nextColumns, labels, percentAddonKeys, readOnly } = applyFieldDefinitionsToSheet({
        fields: fieldDefinitions,
        rows: flattenedItems,
        columns,
      });
      setPreviewColumns(nextColumns);
      setColumnLabels(labels);
      setPercentAddonColumns(percentAddonKeys);
      setReadOnlyColumns(readOnly);
      setPreviewRows(flattenedItems);
      setQuotationMeta((prev) => ({
        ...prev,
        project_name: quote.project_name || "",
        client_name: quote.client_name || "",
        quotation_no: quote.quotation_no || "",
        quotation_date: quote.quotation_date || "",
        gst_percentage: String(quote.gst_percentage ?? prev.gst_percentage),
        boq_files: Array.isArray(quote.boq_files) ? quote.boq_files.join(", ") : (quote.boq_files || ""),
        drawing_files: Array.isArray(quote.drawing_files) ? quote.drawing_files.join(", ") : (quote.drawing_files || ""),
        last_date_revised_offer: quote.last_date_revised_offer || "",
        is_revised_offer: Boolean(quote.is_revised_offer),
        notes: quote.notes || "",
        created_by: quote.created_by || "",
        created_by_name: quote.created_by_name || "",
      }));
    };
    loadQuote();
    return () => {
      active = false;
    };
  }, [editId, isEditMode, toast, fieldDefinitions]);

  const isStandalone = !inLayout && location.pathname.startsWith("/projects/quotes");
  const containerClass = isStandalone
    ? "w-full max-w-none px-1 sm:px-2 md:px-4 pt-3 sm:pt-4 md:pt-6 space-y-6"
    : "space-y-6";

  return (
    <div className={containerClass}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? "Edit Quote" : "Add a Quote"}</h1>
          <p className="text-muted-foreground mt-2">
            Build quotations with BOQ imports, line items, and totals.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap w-full sm:w-auto gap-2">
          <Button variant="ghost" onClick={() => navigate("/projects/quotes/add")} className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quotes
          </Button>
          <Button variant="outline" onClick={() => openSearchDialog("inventory")} className="w-full sm:w-auto">
            <Search className="mr-2 h-4 w-4" />
            Inventory Search
          </Button>
          <Button variant="outline" onClick={() => openSearchDialog("vendor")} className="w-full sm:w-auto">
            <Search className="mr-2 h-4 w-4" />
            Vendor Price Search
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Quotation Builder</CardTitle>
              <CardDescription>Review imported BOQ items and create quotations.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

            <input
              ref={boqInputRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleBoqFileChange}
            />
            <input
              ref={drawingInputRef}
              type="file"
              className="hidden"
              onChange={handleDrawingChange}
              multiple
            />

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Additional Files (Optional)</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload drawings to attach them to the quotation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {drawingFiles.length > 0 ? (
                    <Button type="button" variant="ghost" size="sm" onClick={clearDrawingFiles}>
                      Clear
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" onClick={handleDrawingClick}>
                    Upload Drawing
                  </Button>
                </div>
              </div>
              {drawingFiles.length > 0 ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {drawingFiles.map((file, idx) => (
                    <span
                      key={`${file.name}-${file.lastModified || idx}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1"
                    >
                      <span>{file.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                        onClick={() => removeDrawingFile(idx)}
                        aria-label={`Remove ${file.name}`}
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No drawings selected.</p>
              )}
            </div>

            {uploadedBoqLinks.length === 0 && (
              <div
                className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-6 transition-colors hover:border-primary/60 hover:bg-muted/40"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const file = event.dataTransfer?.files?.[0];
                  if (file) handleBoqFile(file);
                }}
                role="button"
                tabIndex={0}
                onClick={handleImportBoqClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleImportBoqClick();
                  }
                }}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {isImporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {isImporting ? "Importing BOQ..." : "Drop BOQ Excel here"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drag and drop `.xls` or `.xlsx`, or click to browse.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={isImporting}>
                    {isImporting ? "Please wait..." : "Select BOQ File"}
                  </Button>
                </div>
              </div>
            )}

            {uploadedBoqLinks.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Uploaded BOQ File</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {uploadedBoqLinks.map((link, idx) => {
                      const href = api.getApiFileUrl(link);
                      const label = typeof link === "string" ? link.split("/").pop() || link : `BOQ File ${idx + 1}`;
                      return (
                        <a
                          key={`${link}-${idx}`}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-primary hover:bg-muted/40"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="max-w-[220px] truncate">{label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {fieldDefinitionsLoaded && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Line Items</h2>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handleAddLine}>
                      <Plus className="mr-2 h-4 w-4" /> Add Line
                    </Button>
                    <Button onClick={handleCreateQuotation} disabled={isCreating || previewRows.length === 0}>
                      {isCreating ? "Creating..." : "Create Quotation"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-sm font-semibold">Additional Fields</h3>
                    <p className="text-xs text-muted-foreground">
                      Fill these before creating the quotation.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{prettyLabel("project_name")}</TableHead>
                        <TableHead>{prettyLabel("client_name")}</TableHead>
                        <TableHead>{prettyLabel("quotation_no")}</TableHead>
                        <TableHead>{prettyLabel("quotation_date")}</TableHead>
                        <TableHead>{prettyLabel("gst_percentage")}</TableHead>
                        <TableHead>{prettyLabel("boq_files")}</TableHead>
                        <TableHead>{prettyLabel("drawing_files")}</TableHead>
                        <TableHead>{prettyLabel("last_date_revised_offer")}</TableHead>
                        <TableHead>{prettyLabel("is_revised_offer")}</TableHead>
                        <TableHead>{prettyLabel("notes")}</TableHead>
                        <TableHead>{prettyLabel("created_by")}</TableHead>
                        <TableHead>{prettyLabel("created_by_name")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="min-w-[180px]">
                          <Input
                            placeholder="Project name"
                            value={quotationMeta.project_name}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, project_name: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Input
                            placeholder="Client name"
                            value={quotationMeta.client_name}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, client_name: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <Input
                            placeholder="Quotation no."
                            value={quotationMeta.quotation_no}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, quotation_no: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <Input
                            type="date"
                            value={quotationMeta.quotation_date}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, quotation_date: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <Input
                            placeholder="GST %"
                            value={quotationMeta.gst_percentage}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, gst_percentage: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Input
                            placeholder="boq file names (comma separated)"
                            value={quotationMeta.boq_files}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, boq_files: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Input
                            placeholder="drawing file names (comma separated)"
                            value={quotationMeta.drawing_files}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, drawing_files: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Input
                            type="date"
                            value={quotationMeta.last_date_revised_offer}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, last_date_revised_offer: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(quotationMeta.is_revised_offer)}
                              onChange={(event) =>
                                setQuotationMeta((prev) => ({ ...prev, is_revised_offer: event.target.checked }))
                              }
                            />
                            <span className="text-sm">Yes</span>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <Textarea
                            placeholder="Notes"
                            value={quotationMeta.notes}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, notes: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <Input
                            placeholder="Created by"
                            value={quotationMeta.created_by}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, created_by: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <Input
                            placeholder="Created by name"
                            value={quotationMeta.created_by_name}
                            onChange={(event) =>
                              setQuotationMeta((prev) => ({ ...prev, created_by_name: event.target.value }))
                            }
                          />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <QuoteLineItemsExcel
                  mode="edit"
                  items={previewRows}
                  columns={previewColumns}
                  columnLabels={columnLabels}
                  readOnlyColumns={readOnlyColumns}
                  onCellChange={updatePreviewCell}
                  onAddRow={handleAddLine}
                  onAddColumn={handleAddColumn}
                  onInsertColumnAfter={handleInsertColumnAfter}
                  onRemoveColumn={handleRemoveColumn}
                  onMoveColumn={handleMoveColumn}
                  onRenameColumn={handleRenameColumn}
                  onInsertRow={handleInsertLine}
                  onRemoveRow={handleRemoveLine}
                  onMoveRow={handleMoveRow}
                  className="border border-border"
                />
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <div className="flex flex-wrap gap-3 text-sm">
                    {totalFields.map((field) => (
                      <div key={field} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                        <span className="text-muted-foreground">{prettyLabel(field)}:</span>
                        <span className="font-semibold text-foreground">
                          {formatNumberIN(totalsByField[field], { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    <div className="ml-auto flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                      <span className="text-muted-foreground">Total Amount:</span>
                      <span className="font-semibold text-foreground">
                        {formatNumberIN(totalAmount, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
      </Card>

      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-[95vw] h-[90vh] max-w-none max-h-none overflow-hidden rounded-lg p-0 sm:inset-0 sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[92vw] sm:h-[88vh] sm:max-w-none sm:max-h-none sm:rounded-xl sm:p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Quick Search</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 overflow-auto max-h-[calc(90vh-92px)] sm:max-h-[calc(88vh-92px)]">
            {searchMode === "inventory" ? <QuotesSearch inLayout /> : <VendorComparison inLayout />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(addColumnDialog.open)}
        onOpenChange={(open) => setAddColumnDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="w-[98vw] max-w-7xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Column Name</div>
                <Input
                  placeholder="e.g. Erection Cost"
                  value={addColumnDialog.label}
                  onChange={(e) => {
                    const nextLabel = e.target.value;
                    setAddColumnDialog((prev) => ({ ...prev, label: nextLabel }));
                  }}
                />
                <div className="text-xs text-muted-foreground">This is the column header shown in the grid.</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Connections</div>
                  <div className="text-xs text-muted-foreground">
                    Build the formula for this new column using existing columns.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAddColumnDialog((prev) => ({
                        ...prev,
                        logic_base: "",
                        logic_op: "+",
                        logic_steps: [],
                        logic_next: "",
                      }))
                    }
                    disabled={
                      (!String(addColumnDialog.logic_base || "").trim()) &&
                      (!Array.isArray(addColumnDialog.logic_steps) || addColumnDialog.logic_steps.length === 0)
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-border bg-background p-4">
                <div className="text-xs font-medium text-muted-foreground">Connection Builder</div>

                <div className="mt-3 grid grid-cols-1 items-end gap-2 sm:grid-cols-12">
                  <div className="space-y-1 sm:col-span-5">
                    <div className="text-xs text-muted-foreground">Column 1</div>
                    <Select
                      value={addColumnDialog.logic_base}
                      onValueChange={(value) =>
                        setAddColumnDialog((prev) => ({
                          ...prev,
                          logic_base: value,
                          logic_base_value: value === "__other__" ? prev.logic_base_value : "",
                          logic_steps: [],
                          logic_next: "",
                          logic_next_value: "",
                          logic_op: "+",
                        }))
                      }
                      disabled={Array.isArray(addColumnDialog.logic_steps) && addColumnDialog.logic_steps.length > 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {(previewColumns || []).map((col) => (
                          <SelectItem key={col} value={col}>
                            {getColumnDisplayLabel(col)}
                          </SelectItem>
                        ))}
                        <SelectItem value="__other__">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {String(addColumnDialog.logic_base || "").trim() === "__other__" ? (
                    <div className="space-y-1 sm:col-span-4">
                      <div className="text-xs text-muted-foreground">Other value</div>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter value"
                        value={addColumnDialog.logic_base_value}
                        onChange={(e) =>
                          setAddColumnDialog((prev) => ({ ...prev, logic_base_value: e.target.value }))
                        }
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Calculation</div>
                    <Select
                      value={addColumnDialog.logic_op}
                      onValueChange={(value) => setAddColumnDialog((prev) => ({ ...prev, logic_op: value }))}
                      disabled={!String(addColumnDialog.logic_base || "").trim()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Op" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="+">+</SelectItem>
                        <SelectItem value="-">-</SelectItem>
                        <SelectItem value="*">×</SelectItem>
                        <SelectItem value="/">÷</SelectItem>
                        <SelectItem value="%">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 sm:col-span-4">
                    <div className="text-xs text-muted-foreground">Column 2</div>
                    <Select
                      value={addColumnDialog.logic_next}
                      onValueChange={(value) =>
                        setAddColumnDialog((prev) => ({
                          ...prev,
                          logic_next: value,
                          logic_next_value: value === "__other__" ? prev.logic_next_value : "",
                        }))
                      }
                      disabled={!String(addColumnDialog.logic_base || "").trim()}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {(previewColumns || [])
                          .filter((col) => {
                            const used = new Set([
                              String(addColumnDialog.logic_base || "").trim(),
                              ...(Array.isArray(addColumnDialog.logic_steps)
                                ? addColumnDialog.logic_steps.map((s) => String(s?.col || "").trim())
                                : []),
                            ].filter(Boolean));
                            return !used.has(col);
                          })
                          .map((col) => (
                            <SelectItem key={col} value={col}>
                              {getColumnDisplayLabel(col)}
                            </SelectItem>
                          ))}
                        <SelectItem value="__other__">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {String(addColumnDialog.logic_next || "").trim() === "__other__" ? (
                    <div className="space-y-1 sm:col-span-4">
                      <div className="text-xs text-muted-foreground">Other value</div>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Enter value"
                        value={addColumnDialog.logic_next_value}
                        onChange={(e) =>
                          setAddColumnDialog((prev) => ({ ...prev, logic_next_value: e.target.value }))
                        }
                      />
                    </div>
                  ) : null}

                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      size="icon"
                      title="Add connection"
                      onClick={() => {
                        setAddColumnDialog((prev) => {
                          const base = String(prev.logic_base || "").trim();
                          const op = String(prev.logic_op || "").trim();
                          const nextCol = String(prev.logic_next || "").trim();
                          const nextVal = String(prev.logic_next_value || "").trim();
                          const isOther = nextCol === "__other__";
                          if (!base) return prev;
                          if (!nextCol) return prev;
                          const steps = Array.isArray(prev.logic_steps) ? prev.logic_steps : [];
                          return {
                            ...prev,
                            field_role: "derived",
                            logic_steps: [...steps, ...(isOther ? [{ op, value: nextVal }] : [{ op, col: nextCol }])],
                            logic_op: "+",
                            logic_next: "",
                            logic_next_value: "",
                          };
                        });
                      }}
                      disabled={
                        !String(addColumnDialog.logic_base || "").trim() ||
                        !String(addColumnDialog.logic_next || "").trim()
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {Array.isArray(addColumnDialog.logic_steps) && addColumnDialog.logic_steps.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-medium text-muted-foreground">Connections</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAddColumnDialog((prev) => ({
                            ...prev,
                            logic_steps: [],
                            logic_next: "",
                            logic_op: "+",
                          }))
                        }
                      >
                        Change Column 1
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {addColumnDialog.logic_steps.map((step, idx) => {
                        const used = new Set([
                          String(addColumnDialog.logic_base || "").trim(),
                          ...(Array.isArray(addColumnDialog.logic_steps)
                            ? addColumnDialog.logic_steps
                                .map((s, i) => (i === idx ? "" : String(s?.col || "").trim()))
                                .filter(Boolean)
                            : []),
                        ].filter(Boolean));
                        const availableColumns = (previewColumns || []).filter((col) => !used.has(col) || col === step?.col);
                        return (
                          <div
                            key={`connection-row-${idx}`}
                            className="grid grid-cols-1 items-end gap-2 sm:grid-cols-12"
                          >
                            <div className="space-y-1 sm:col-span-3">
                              <div className="text-xs text-muted-foreground">Calculation</div>
                              <Select
                                value={String(step?.op || "+")}
                                onValueChange={(value) =>
                                  setAddColumnDialog((prev) => {
                                    const steps = Array.isArray(prev.logic_steps) ? [...prev.logic_steps] : [];
                                    steps[idx] = { ...(steps[idx] || {}), op: value };
                                    return { ...prev, logic_steps: steps };
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Op" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="+">+</SelectItem>
                                  <SelectItem value="-">-</SelectItem>
                                  <SelectItem value="*">×</SelectItem>
                                  <SelectItem value="/">÷</SelectItem>
                                  <SelectItem value="%">%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1 sm:col-span-8">
                              <div className="text-xs text-muted-foreground">Column</div>
                              <Select
                                value={String(step?.col ? step.col : "__other__")}
                                onValueChange={(value) =>
                                  setAddColumnDialog((prev) => {
                                    const steps = Array.isArray(prev.logic_steps) ? [...prev.logic_steps] : [];
                                    if (value === "__other__") {
                                      const existing = steps[idx] || {};
                                      steps[idx] = { ...existing, col: undefined, value: existing?.value ?? "" };
                                    } else {
                                      const existing = steps[idx] || {};
                                      steps[idx] = { ...existing, col: value, value: undefined };
                                    }
                                    return { ...prev, field_role: "derived", logic_steps: steps };
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableColumns.map((col) => (
                                    <SelectItem key={`${col}-${idx}`} value={col}>
                                      {getColumnDisplayLabel(col)}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="__other__">Others</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="sm:col-span-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                title="Remove connection"
                                onClick={() =>
                                  setAddColumnDialog((prev) => {
                                    const steps = Array.isArray(prev.logic_steps) ? prev.logic_steps : [];
                                    return { ...prev, logic_steps: steps.filter((_, i) => i !== idx) };
                                  })
                                }
                              >
                                ×
                              </Button>
                            </div>

                            {(!step?.col && (step?.value !== undefined && step?.value !== null)) ? (
                              <div className="sm:col-span-12">
                                <div className="text-xs text-muted-foreground">Other value</div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="Enter value"
                                  value={String(step?.value ?? "")}
                                  onChange={(e) =>
                                    setAddColumnDialog((prev) => {
                                      const steps = Array.isArray(prev.logic_steps) ? [...prev.logic_steps] : [];
                                      steps[idx] = { ...(steps[idx] || {}), value: e.target.value, col: undefined };
                                      return { ...prev, logic_steps: steps };
                                    })
                                  }
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

              {Array.isArray(addColumnDialog.logic_steps) && addColumnDialog.logic_steps.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <div className="text-xs font-medium text-muted-foreground">Formula Preview</div>
                    <div className="mt-1 font-medium text-foreground">
                      {buildDerivedFormulaPreview({
                        base: addColumnDialog.logic_base,
                        steps: addColumnDialog.logic_steps,
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            </div>

            <details className="rounded-lg border border-border bg-background">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
                Advanced
              </summary>
              <div className="space-y-4 px-4 pb-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Data Type</div>
                    <Select
                      value={addColumnDialog.data_type}
                      onValueChange={(value) => setAddColumnDialog((prev) => ({ ...prev, data_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="percent">Percent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Field Role</div>
                    <Select
                      value={
                        String(addColumnDialog.logic_base || "").trim() &&
                        Array.isArray(addColumnDialog.logic_steps) &&
                        addColumnDialog.logic_steps.length > 0
                          ? "derived"
                          : addColumnDialog.field_role
                      }
                      onValueChange={(value) => setAddColumnDialog((prev) => ({ ...prev, field_role: value }))}
                      disabled={
                        String(addColumnDialog.logic_base || "").trim() &&
                        Array.isArray(addColumnDialog.logic_steps) &&
                        addColumnDialog.logic_steps.length > 0
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="input">Input</SelectItem>
                        <SelectItem value="percent_addon">% Add-on</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="derived">Derived (read-only)</SelectItem>
                      </SelectContent>
                    </Select>
                    {String(addColumnDialog.logic_base || "").trim() &&
                    Array.isArray(addColumnDialog.logic_steps) &&
                    addColumnDialog.logic_steps.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        This column becomes derived because it has a formula.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Description (optional)</div>
                  <Textarea
                    placeholder="Extra notes for users."
                    value={addColumnDialog.description}
                    onChange={(e) => setAddColumnDialog((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
            </details>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddColumnDialog((prev) => ({ ...prev, open: false }))}
              >
                Cancel
              </Button>
              <Button type="button" onClick={applyAddColumn}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
