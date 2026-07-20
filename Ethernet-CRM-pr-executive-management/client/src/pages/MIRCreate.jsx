import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useProject } from "@/contexts/useProject";
import { useResolvedProject } from "@/hooks/useResolvedProject";
import {
  DISCIPLINE_OPTIONS,
  EMPTY_HIRANANDANI_MIR,
  EMPTY_LODHA_MIR,
  HIRANANDANI_APPROVAL_CODES,
  LODHA_RESULT_CODES,
  MIR_TEMPLATE_OPTIONS,
  MIR_TEMPLATE_TYPES,
  YES_NO_OPTIONS,
  buildMirDynamicField,
  buildMirAttachmentValue,
  getMirTemplatePayload,
  getMirTemplateType,
  parseMirAttachmentList,
  normalizeHiranandaniMir,
  normalizeLodhaMir,
} from "@/pages/mirShared";
import {
  buildHiranandaniPayloadFromMir,
  buildLodhaPayloadFromMir,
} from "@/lib/mirPdf";

const getEmptyForm = (projectId = "") => ({
  project_name: "",
  project_code: "",
  client_name: "",
  pmc: "",
  contractor: "",
  vendor_code: "",
  po_id: "",
  challan_no: "",
  mir_refrence_no: "",
  material_code: "",
  inspection_date_time: "",
  client_submission_date: "",
  add_attachment: "",
  attachment_files: [],
  project_id: projectId ? Number(projectId) : "",
  template_type: "",
  lodha_form: normalizeLodhaMir(EMPTY_LODHA_MIR),
  hiranandani_form: normalizeHiranandaniMir(EMPTY_HIRANANDANI_MIR),
  items: [],
});

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value) => (value == null ? "" : String(value).trim());

const mapChallanItemsToMirItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const qty = toNumber(item?.qty ?? item?.quantity, 0);
    const rate = toNumber(item?.Rate ?? item?.rate ?? item?.price, 0);
    const hsn = toText(item?.hsn ?? item?.hsnCode ?? item?.hsn_code ?? item?.HSN);
    const itemNo = toText(
      item?.item_no ??
        item?.itemNo ??
        item?.boq_item_code ??
        item?.boqItemCode ??
        item?.item_code ??
        item?.itemCode ??
        item?.code ??
        hsn
    );
    const itemCode = toText(item?.item_code ?? item?.itemCode ?? item?.code ?? item?.boq_item_code ?? item?.boqItemCode ?? itemNo ?? hsn);
    const uom = toText(item?.UOM ?? item?.uom ?? item?.unit ?? item?.Unit);
    return {
      srno: toNumber(item?.srno, index + 1),
      hsn,
      item_no: itemNo,
      item_code: itemCode,
      description: item?.description ?? item?.name ?? "",
      name: item?.name ?? "",
      qty,
      UOM: uom,
      Rate: rate,
      Amount: toNumber(item?.Amount ?? item?.amount, qty * rate),
      remark: item?.remark ?? "",
      inspected: false,
      include_in_mir: true,
    };
  });
};

const enrichMirItemsFromPo = (mirItems, poItems) => {
  if (!Array.isArray(mirItems) || !Array.isArray(poItems) || poItems.length === 0) return mirItems || [];

  const poItemsByDescription = new Map();
  poItems.forEach((item) => {
    const key = toText(item?.description ?? item?.name).toLowerCase();
    if (key && !poItemsByDescription.has(key)) poItemsByDescription.set(key, item);
  });

  return mirItems.map((item, index) => {
    const descriptionKey = toText(item?.description).toLowerCase();
    const poMatch = (descriptionKey && poItemsByDescription.get(descriptionKey)) || poItems[index] || null;
    if (!poMatch) return item;

    const poItemNo = toText(
      poMatch?.item_no ??
        poMatch?.itemNo ??
        poMatch?.boq_item_code ??
        poMatch?.boqItemCode ??
        poMatch?.item_code ??
        poMatch?.itemCode ??
        poMatch?.code ??
        poMatch?.hsn
    );
    const poItemCode = toText(poMatch?.item_code ?? poMatch?.itemCode ?? poMatch?.code ?? poItemNo);
    const poHsn = toText(poMatch?.hsn ?? poMatch?.hsnCode ?? poMatch?.hsn_code ?? poMatch?.HSN);
    const poUom = toText(poMatch?.UOM ?? poMatch?.uom ?? poMatch?.unit ?? poMatch?.Unit);

    return {
      ...item,
      item_no: item?.item_no ? item.item_no : poItemNo,
      item_code: item?.item_code ? item.item_code : poItemCode,
      hsn: item?.hsn ? item.hsn : poHsn,
      UOM: item?.UOM ? item.UOM : poUom,
      inspected: Boolean(item?.inspected),
    };
  });
};

  const toPayloadNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toPositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseDynamicField = (value) => {
  if (!value) return [];
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

const getDynamicValue = (dynamicField, key) => {
  if (!Array.isArray(dynamicField)) return null;
  const entry = dynamicField.find((item) => item?.key === key);
  if (!entry) return null;
  const raw = entry.value;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const extractChallanItems = (challan) => {
  if (!challan || typeof challan !== "object") return [];

  const candidates = [
    challan.items,
    challan.item_description,
    challan.item_descriptions,
    challan.deliveryItems,
    challan.delivery_items,
  ];

  const parseCandidate = (value) => {
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
  };

  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (parsed.length > 0) return parsed;
  }

  const dynamicField = parseDynamicField(challan.dynamic_field);
  const dynamicItems = getDynamicValue(dynamicField, "items");
  if (Array.isArray(dynamicItems) && dynamicItems.length > 0) return dynamicItems;

  return [];
};

export default function MIRCreate() {
  const navigate = useNavigate();
  const { projectId: _projectSlug, mirId } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { selectedProject, projects } = useProject();
  const resolvedProject = useResolvedProject();
  const projectId = resolvedProject.projectId || "";
  const attachmentInputRef = useRef(null);
  const projectPrefillRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [form, setForm] = useState(getEmptyForm(projectId));
  const [challans, setChallans] = useState([]);
  const [usedChallanNos, setUsedChallanNos] = useState(new Set());
  const [projectPos, setProjectPos] = useState([]);
  const [loadingMir, setLoadingMir] = useState(false);
  const isEditMode = Boolean(mirId);
  const preselectChallan = (searchParams.get("challan") || "").trim();
  const preselectTemplate = (searchParams.get("template") || "").trim();

  const projectFromContext = useMemo(() => {
    if (resolvedProject.project) return resolvedProject.project;
    if (!projectId) return null;
    const asString = String(projectId);
    const selectedMatches =
      selectedProject &&
      (String(selectedProject.project_id ?? selectedProject.id ?? "") === asString ||
        String(selectedProject.id ?? "") === asString);
    if (selectedMatches) return selectedProject;
    const list = Array.isArray(projects) ? projects : [];
    return list.find((p) => String(p?.project_id ?? p?.id ?? "") === asString) || null;
  }, [projectId, resolvedProject.project, selectedProject, projects]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, project_id: projectId ? Number(projectId) : "" }));
  }, [projectId]);

  useEffect(() => {
    if (isEditMode) return;
    if (preselectTemplate !== MIR_TEMPLATE_TYPES.LODHA && preselectTemplate !== MIR_TEMPLATE_TYPES.HIRANANDANI) return;
    setForm((prev) => {
      if (prev.template_type === preselectTemplate) return prev;
      return {
        ...prev,
        template_type: preselectTemplate,
      };
    });
  }, [isEditMode, preselectTemplate]);

  useEffect(() => {
    if (!projectId) return;
    if (isEditMode) return;
    if (!projectFromContext) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!String(prev.project_name || "").trim()) {
        next.project_name = projectFromContext.project_name || projectFromContext.name || prev.project_name;
      }
      return next;
    });
  }, [projectId, isEditMode, projectFromContext]);

  useEffect(() => {
    if (!projectId) return;
    if (isEditMode) return;
    if (projectPrefillRef.current === projectId) return;
    projectPrefillRef.current = projectId;

    let mounted = true;
    const prefillProjectFields = async () => {
      try {
        if (projectFromContext) return;
        const res = await api.getProjectById(projectId);
        if (!mounted) return;
        if (!res.success || !res.data) return;
        const data = res.data;
        const project = Array.isArray(data)
          ? data.find((p) => String(p?.project_id ?? p?.id ?? "") === String(projectId)) || null
          : data?.project || data;
        if (!project) return;
        setForm((prev) => {
          const next = { ...prev };
          const currentName = String(prev.project_name || "").trim();

          if (!currentName) next.project_name = project.project_name || project.name || prev.project_name;
          return next;
        });
      } catch {
        // Non-blocking: user can still fill project name manually.
      }
    };

    prefillProjectFields();
    return () => {
      mounted = false;
    };
  }, [projectId, isEditMode, projectFromContext]);

  useEffect(() => {
    const fetchChallans = async () => {
      if (!projectId) {
        setChallans([]);
        setUsedChallanNos(new Set());
        return;
      }
      try {
        const [dcRes, mirRes] = await Promise.all([
          api.getDcsByProject(projectId),
          api.getMirsByProject(projectId),
        ]);
        const dcRows = dcRes.success && Array.isArray(dcRes.data) ? dcRes.data : [];
        const mirRows = mirRes.success && Array.isArray(mirRes.data) ? mirRes.data : [];
        const used = new Set();
        mirRows.forEach((row) => {
          const dynamicField = parseDynamicField(row?.dynamic_field);
          const dynamicChallanNo = getDynamicValue(dynamicField, "challan_no");
          const challanNo = row?.challan_no || dynamicChallanNo;
          if (challanNo) used.add(String(challanNo).trim());
        });
        setChallans(dcRows);
        setUsedChallanNos(used);
      } catch {
        setChallans([]);
        setUsedChallanNos(new Set());
      }
    };

    fetchChallans();
  }, [projectId]);

  useEffect(() => {
    if (isEditMode) return;
    if (!preselectChallan) return;
    if (form.challan_no) return;
    const exists = challans.some(
      (row) => String(row?.challan_number || "").trim() === preselectChallan
    );
    if (!exists) return;
    if (usedChallanNos.has(preselectChallan)) {
      toast({
        title: "Challan already used",
        description: "An MIR already exists for this challan.",
        variant: "destructive",
      });
      return;
    }
    handleChallanChange(preselectChallan);
  }, [challans, usedChallanNos, preselectChallan, form.challan_no, isEditMode, toast]);

  useEffect(() => {
    const fetchPos = async () => {
      if (!projectId) {
        setProjectPos([]);
        return;
      }
      try {
        const result = await api.getPosByProject(projectId);
        if (!result.success) {
          setProjectPos([]);
          return;
        }
        setProjectPos(Array.isArray(result.data) ? result.data : []);
      } catch {
        setProjectPos([]);
      }
    };

    fetchPos();
  }, [projectId]);

  useEffect(() => {
    const fetchMir = async () => {
      if (!mirId) return;
      try {
        setLoadingMir(true);
        const result = await api.getMirById(mirId);
        if (!result.success || !result.data) {
          toast({
            title: "Failed to load MIR",
            description: result.error || "Could not load MIR details.",
            variant: "destructive",
          });
          return;
        }
        const row = result.data;
        const dynamicField = parseDynamicField(row.dynamic_field);
        const dynamicItems = getDynamicValue(dynamicField, "items");
        const dynamicChallanNo = getDynamicValue(dynamicField, "challan_no");
        const dynamicPoId = getDynamicValue(dynamicField, "po_id");
        const sourceItems = Array.isArray(row.items) ? row.items : (Array.isArray(dynamicItems) ? dynamicItems : []);
        const mappedItems = mapChallanItemsToMirItems(sourceItems);
        const templateType = getMirTemplateType(row) || "";
        const templatePayload = getMirTemplatePayload(row);
        const inspectionDate = row.inspection_date_time
          ? String(row.inspection_date_time).slice(0, 10)
          : "";
        const submissionDate = row.client_submission_date
          ? String(row.client_submission_date).slice(0, 10)
          : "";

        setForm({
          project_name: row.project_name || "",
          project_code: row.project_code || "",
          client_name: row.client_name || "",
          pmc: row.pmc || "",
          contractor: row.contractor || "",
          vendor_code: row.vendor_code || "",
          po_id: row.po_id != null ? String(row.po_id) : (dynamicPoId != null ? String(dynamicPoId) : ""),
          challan_no: row.challan_no || (typeof dynamicChallanNo === "string" ? dynamicChallanNo : ""),
          mir_refrence_no: row.mir_refrence_no || "",
          material_code: row.material_code || "",
          inspection_date_time: inspectionDate,
          client_submission_date: submissionDate,
          add_attachment: row.refrence_docs_attached || row.attachments || "",
          attachment_files: parseMirAttachmentList(
            row.refrence_docs_attached || row.attachments || row.add_attachment || row?.requestSubmission?.refDocAttached || ""
          ),
          project_id: row.project_id != null ? Number(row.project_id) : (projectId ? Number(projectId) : ""),
          template_type: templateType,
          lodha_form: templateType === MIR_TEMPLATE_TYPES.HIRANANDANI
            ? normalizeLodhaMir(EMPTY_LODHA_MIR)
            : normalizeLodhaMir(templatePayload),
          hiranandani_form: templateType === MIR_TEMPLATE_TYPES.HIRANANDANI
            ? normalizeHiranandaniMir({ ...templatePayload, attachments: row.refrence_docs_attached || row.attachments || row.add_attachment || "" })
            : normalizeHiranandaniMir(EMPTY_HIRANANDANI_MIR),
          items: mappedItems,
        });
      } catch {
        toast({
          title: "Failed to load MIR",
          description: "Could not load MIR details.",
          variant: "destructive",
        });
      } finally {
        setLoadingMir(false);
      }
    };

    fetchMir();
  }, [mirId, projectId, toast]);

  const challanOptions = useMemo(() => {
    const seen = new Set();
    return challans.filter((row) => {
      const key = row?.challan_number;
      if (!key || seen.has(key)) return false;
      const keyValue = String(key).trim();
      if (usedChallanNos.has(keyValue) && keyValue !== String(form.challan_no || "").trim()) return false;
      seen.add(key);
      return true;
    });
  }, [challans, usedChallanNos, form.challan_no]);

  const handleChallanChange = async (value) => {
    const selected = challans.find((row) => row?.challan_number === value);
    let challanSource = selected || null;
    let mappedItems = mapChallanItemsToMirItems(extractChallanItems(challanSource));
    const effectiveProjectIdValue =
      toPositiveInteger(selected?.project_id) ??
      toPositiveInteger(form.project_id) ??
      toPositiveInteger(projectId);

    if (mappedItems.length === 0 && (selected?.dc_id != null || selected?.id != null)) {
      try {
        const challanId = selected?.dc_id ?? selected?.id;
        const challanRes = await api.getDcById(challanId);
        if (challanRes.success && challanRes.data) {
          challanSource = challanRes.data;
          mappedItems = mapChallanItemsToMirItems(extractChallanItems(challanSource));
        }
      } catch {
        // Keep the list row values if the detail fetch fails.
      }
    }

    const needsPoEnrichment = mappedItems.some((item) => !item.hsn || !item.UOM);
    if (needsPoEnrichment && (challanSource?.po_id ?? selected?.po_id)) {
      try {
        const poRes = await api.getPoById(challanSource?.po_id ?? selected.po_id);
        if (poRes.success && poRes.data?.items) {
          mappedItems = enrichMirItemsFromPo(mappedItems, poRes.data.items);
        }
      } catch {
        // Keep challan-derived values if PO fetch fails.
      }
    } else if (needsPoEnrichment && form.po_id) {
      try {
        const poRes = await api.getPoById(form.po_id);
        if (poRes.success && poRes.data?.items) {
          mappedItems = enrichMirItemsFromPo(mappedItems, poRes.data.items);
        }
      } catch {
        // Keep challan-derived values if PO fetch fails.
      }
    } else if (needsPoEnrichment && projectId) {
      try {
        const recentPoRes = await api.getRecentPoByProject(projectId);
        if (recentPoRes.success && recentPoRes.data?.items) {
          mappedItems = enrichMirItemsFromPo(mappedItems, recentPoRes.data.items);
        }
      } catch {
        // Keep challan-derived values if latest PO fetch fails.
      }
    }

    setForm((prev) => ({
      ...prev,
      challan_no: value,
      po_id: challanSource?.po_id != null ? String(challanSource.po_id) : prev.po_id,
      project_name: challanSource?.project_name ?? prev.project_name,
      project_code: challanSource?.project_code ?? prev.project_code,
      pmc: challanSource?.pmc ?? prev.pmc,
      contractor: challanSource?.contractor ?? prev.contractor,
      vendor_code: challanSource?.vendor_code ?? prev.vendor_code,
      material_code: challanSource?.material_code ?? prev.material_code,
      project_id: effectiveProjectIdValue ?? prev.project_id,
      items: mappedItems,
    }));
  };

  const handleTemplateSelect = (templateType) => {
    setForm((prev) => ({
      ...prev,
      template_type: templateType,
    }));
  };

  const setLodhaForm = (path, value) => {
    setForm((prev) => {
      const next = normalizeLodhaMir(prev.lodha_form);
      const keys = Array.isArray(path) ? path : [path];
      let target = next;
      keys.slice(0, -1).forEach((key) => {
        target[key] = { ...(target[key] || {}) };
        target = target[key];
      });
      target[keys[keys.length - 1]] = value;
      return { ...prev, lodha_form: next };
    });
  };

  const setHiranandaniForm = (path, value) => {
    setForm((prev) => {
      const next = normalizeHiranandaniMir(prev.hiranandani_form);
      const keys = Array.isArray(path) ? path : [path];
      let target = next;
      keys.slice(0, -1).forEach((key) => {
        target[key] = { ...(target[key] || {}) };
        target = target[key];
      });
      target[keys[keys.length - 1]] = value;
      return { ...prev, hiranandani_form: next };
    });
  };

  const toggleLodhaDiscipline = (item) => {
    const current = form.lodha_form.requestSubmission.discipline || [];
    const next = current.includes(item)
      ? current.filter((entry) => entry !== item)
      : [...current, item];
    setLodhaForm(["requestSubmission", "discipline"], next);
  };

  const updateHiranandaniMaterialRow = (index, key, value) => {
    setForm((prev) => {
      const nextForm = normalizeHiranandaniMir(prev.hiranandani_form);
      const rows = [...nextForm.materialRows];
      rows[index] = { ...(rows[index] || {}), [key]: value };
      nextForm.materialRows = rows;
      return { ...prev, hiranandani_form: nextForm };
    });
  };

  const updateMirItemRow = (index, patch) => {
    setForm((prev) => {
      const rows = Array.isArray(prev.items) ? [...prev.items] : [];
      if (!rows[index]) return prev;
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, items: rows };
    });
  };

  const addHiranandaniMaterialRow = () => {
    setForm((prev) => {
      const nextForm = normalizeHiranandaniMir(prev.hiranandani_form);
      nextForm.materialRows = [
        ...nextForm.materialRows,
        { material: "", size: "", quantity: "", unit: "" },
      ];
      return { ...prev, hiranandani_form: nextForm };
    });
  };

  const removeHiranandaniMaterialRow = (index) => {
    setForm((prev) => {
      const nextForm = normalizeHiranandaniMir(prev.hiranandani_form);
      nextForm.materialRows = nextForm.materialRows.filter((_, rowIndex) => rowIndex !== index);
      if (nextForm.materialRows.length === 0) {
        nextForm.materialRows = [{ material: "", size: "", quantity: "", unit: "" }];
      }
      return { ...prev, hiranandani_form: nextForm };
    });
  };

  const buildCurrentTemplatePayload = () => {
    if (form.template_type === MIR_TEMPLATE_TYPES.HIRANANDANI) {
      return buildHiranandaniPayloadFromMir(form, form.hiranandani_form);
    }
    return buildLodhaPayloadFromMir(form, form.lodha_form);
  };

  const handleCreateMir = async () => {
    if (!form.template_type) {
      toast({
        title: "MIR format required",
        description: "Please select Lodha or Hiranandani.",
        variant: "destructive",
      });
      return;
    }
    if (!form.mir_refrence_no.trim()) {
      toast({
        title: "MIR reference required",
        description: "Please enter MIR reference number.",
        variant: "destructive",
      });
      return;
    }
    if (!form.challan_no.trim()) {
      toast({
        title: "Challan required",
        description: "Select a delivery challan before creating MIR.",
        variant: "destructive",
      });
      return;
    }
    if (form.po_id === "" || Number.isNaN(Number(form.po_id))) {
      toast({
        title: "PO required",
        description: "Select a valid PO ID before creating MIR.",
        variant: "destructive",
      });
      return;
    }

    const items = (form.items || []).map((item, index) => {
      const qty = toPayloadNumber(item.qty);
      const rate = toPayloadNumber(item.Rate);
      const amountValue = item.Amount === "" ? qty * rate : toPayloadNumber(item.Amount);
      const itemNo = String(
        item.item_no ||
          item.itemNo ||
          item.item_code ||
          item.itemCode ||
          item.code ||
          item.hsn ||
          ""
      ).trim();
      const itemCode = String(item.item_code || item.itemCode || item.code || item.item_no || item.itemNo || item.hsn || "").trim();
      return {
        srno: toPayloadNumber(item.srno || index + 1),
        hsn: String(item.hsn || ""),
        item_no: itemNo,
        item_code: itemCode,
        description: String(item.description || ""),
        name: String(item.name || ""),
        qty,
        UOM: String(item.UOM || ""),
        Rate: rate,
        Amount: amountValue,
        remark: String(item.remark || ""),
        inspected: Boolean(item.inspected),
        include_in_mir: item.include_in_mir !== false,
      };
    });

    const templatePayload = buildCurrentTemplatePayload();
    const dynamicField = buildMirDynamicField(form.template_type, templatePayload);
    let projectIdValue = toPositiveInteger(form.project_id) ?? toPositiveInteger(projectId);

    try {
      setSubmitting(true);
      if (!isEditMode && !projectIdValue) {
        const poCheck = await api.getPoById(Number(form.po_id));
        if (!poCheck.success || !poCheck.data) {
          toast({
            title: "Invalid PO ID",
            description: "PO ID does not exist on server.",
            variant: "destructive",
          });
          return;
        }
        projectIdValue = toPositiveInteger(poCheck.data.project_id);
      }

      const payload = {
        project_name: form.project_name.trim(),
        project_code: form.project_code.trim(),
        client_name: form.client_name.trim(),
        pmc: form.pmc.trim(),
        contractor: form.contractor.trim(),
        vendor_code: form.vendor_code.trim(),
        challan_no: form.challan_no.trim(),
        mir_refrence_no: form.mir_refrence_no.trim(),
        material_code: form.material_code.trim(),
        inspection_date_time: form.inspection_date_time ? `${form.inspection_date_time}T00:00:00.000Z` : "",
        client_submission_date: form.client_submission_date || "",
        refrence_docs_attached: buildMirAttachmentValue(form.attachment_files?.length ? form.attachment_files : parseMirAttachmentList(form.add_attachment)),
        mir_submited: true,
        dynamic_field: dynamicField,
        project_id: projectIdValue,
        po_id: Number(form.po_id),
        items,
      };

      let result;
      if (isEditMode) {
        if (form.template_type === MIR_TEMPLATE_TYPES.LODHA) {
          result = await api.updateLodhaMir(mirId, payload);
        } else {
          result = await api.updateHiranandaniMir(mirId, payload);
        }
      } else if (form.template_type === MIR_TEMPLATE_TYPES.LODHA) {
        result = await api.createLodhaMir(payload);
      } else {
        result = await api.createHiranandaniMir(payload);
      }
      if (!result.success) {
        console.error("MIR submit failed payload:", payload);
        toast({
          title: isEditMode ? "Failed to update MIR" : "Failed to create MIR",
          description: result.error || (isEditMode ? "Could not update MIR." : "Could not create MIR."),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isEditMode ? "MIR updated" : "MIR created",
        description: isEditMode ? "MIR updated successfully." : "New MIR record saved successfully.",
      });
      navigate(`/${projectId}/mir`);
    } catch {
      toast({
        title: isEditMode ? "Failed to update MIR" : "Failed to create MIR",
        description: isEditMode ? "Could not update MIR." : "Could not create MIR.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const syncAttachmentFiles = (files) => {
    const normalized = parseMirAttachmentList(files);
    const attachmentValue = buildMirAttachmentValue(normalized);
    setForm((prev) => ({
      ...prev,
      attachment_files: normalized,
      add_attachment: attachmentValue,
      hiranandani_form: {
        ...prev.hiranandani_form,
        attachments: attachmentValue,
      },
    }));
  };

  const uploadAttachmentFiles = async (files) => {
    const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [files].filter(Boolean);
    if (normalizedFiles.length === 0) return;
    try {
      setUploadingAttachment(true);
      const result = await api.uploadMirAttachments(normalizedFiles);
      if (!result.success || !Array.isArray(result.data?.attachments)) {
        toast({
          title: "Upload failed",
          description: result.error || "Could not upload attachment.",
          variant: "destructive",
        });
        return;
      }
      setForm((prev) => {
        const nextFiles = [
          ...(Array.isArray(prev.attachment_files) ? prev.attachment_files : []),
          ...result.data.attachments.filter((entry) => entry?.path),
        ];
        const attachmentValue = buildMirAttachmentValue(nextFiles);
        return {
          ...prev,
          attachment_files: nextFiles,
          add_attachment: attachmentValue,
          hiranandani_form: {
            ...prev.hiranandani_form,
            attachments: attachmentValue,
          },
        };
      });
      toast({
        title: normalizedFiles.length > 1 ? "Attachments uploaded" : "Attachment uploaded",
        description: normalizedFiles.length > 1 ? "Files attached to MIR." : "File attached to MIR.",
      });
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not upload attachment.",
        variant: "destructive",
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleUploadAttachment = async (event) => {
    const files = Array.from(event.target.files || []);
    await uploadAttachmentFiles(files);
    event.target.value = "";
  };

  const toggleItemInspection = (index, checked) => {
    setForm((prev) => {
      const nextItems = [...(prev.items || [])];
      if (!nextItems[index]) return prev;
      nextItems[index] = { ...nextItems[index], inspected: !!checked };
      return { ...prev, items: nextItems };
    });
  };

  const toggleAllInspection = (checked) => {
    setForm((prev) => ({
      ...prev,
      items: (prev.items || []).map((item) => ({ ...item, inspected: !!checked })),
    }));
  };

  const inspectedCount = (form.items || []).filter((item) => item?.inspected).length;
  const allItemsInspected = (form.items || []).length > 0 && inspectedCount === (form.items || []).length;
  const attachmentFiles = Array.isArray(form.attachment_files) ? form.attachment_files : parseMirAttachmentList(form.add_attachment);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-gradient-to-r from-cyan-50 via-sky-50 to-white p-6 md:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create MIR</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEditMode ? "Edit material inspection request." : "Add a new material inspection request."}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/${projectId}/mir`)} className="w-full lg:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to MIR List
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? "Edit MIR" : "MIR Details"}</CardTitle>
          <CardDescription>Select the client format first. Only that format's fields will be shown.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMir ? (
            <div className="py-8 text-center text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading MIR...
              </div>
            </div>
          ) : (
          <>
          <div className="mb-6 space-y-3">
            <Label>MIR Format</Label>
            {form.template_type ? (
              <div className="flex flex-col gap-3 rounded-lg border border-primary bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {form.template_type === MIR_TEMPLATE_TYPES.LODHA ? "Lodha" : "Hiranandani"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    The selected client format is active. Other format fields are hidden.
                  </div>
                </div>
                {!isEditMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((prev) => ({ ...prev, template_type: "" }))}
                  >
                    Change Format
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {MIR_TEMPLATE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleTemplateSelect(option.value)}
                      className="rounded-lg border border-border p-4 text-left transition hover:bg-muted/50"
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                    </button>
                ))}
              </div>
            )}
          </div>
          {!form.template_type ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Select Lodha or Hiranandani to continue.
            </div>
          ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project_name">Project Name</Label>
              <Input id="project_name" value={form.project_name} onChange={(event) => setForm((prev) => ({ ...prev, project_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project_code">Project Code</Label>
              <Input id="project_code" value={form.project_code} onChange={(event) => setForm((prev) => ({ ...prev, project_code: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name</Label>
              <Input id="client_name" value={form.client_name} onChange={(event) => setForm((prev) => ({ ...prev, client_name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pmc">PMC</Label>
              <Input id="pmc" value={form.pmc} onChange={(event) => setForm((prev) => ({ ...prev, pmc: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractor">Contractor</Label>
              <Input id="contractor" value={form.contractor} onChange={(event) => setForm((prev) => ({ ...prev, contractor: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor_code">Vendor Code</Label>
              <Input id="vendor_code" value={form.vendor_code} onChange={(event) => setForm((prev) => ({ ...prev, vendor_code: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po_id">PO ID</Label>
              <Select
                value={form.po_id || undefined}
                onValueChange={(value) => setForm((prev) => ({ ...prev, po_id: value }))}
              >
                <SelectTrigger id="po_id">
                  <SelectValue placeholder={projectPos.length ? "Select PO ID" : "No POs found"} />
                </SelectTrigger>
                <SelectContent>
                  {projectPos.map((po) => (
                    <SelectItem key={po.po_id} value={String(po.po_id)}>
                      {String(po.po_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="challan_no">Challan No</Label>
              <Select value={form.challan_no || undefined} onValueChange={handleChallanChange}>
                <SelectTrigger id="challan_no">
                  <SelectValue placeholder={challanOptions.length ? "Select challan no" : "No challans found"} />
                </SelectTrigger>
                <SelectContent>
                  {challanOptions.map((row) => (
                    <SelectItem key={row.dc_id || row.challan_number} value={row.challan_number}>
                      {row.challan_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Showing challans without MIR. Used challans are hidden.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mir_refrence_no">MIR Reference No *</Label>
              <Input id="mir_refrence_no" value={form.mir_refrence_no} onChange={(event) => setForm((prev) => ({ ...prev, mir_refrence_no: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material_code">Material Code</Label>
              <Input id="material_code" value={form.material_code} onChange={(event) => setForm((prev) => ({ ...prev, material_code: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspection_date_time">Inspection Date</Label>
              <Input id="inspection_date_time" type="date" value={form.inspection_date_time} onChange={(event) => setForm((prev) => ({ ...prev, inspection_date_time: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_submission_date">Client Submission Date</Label>
              <Input id="client_submission_date" type="date" value={form.client_submission_date} onChange={(event) => setForm((prev) => ({ ...prev, client_submission_date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project_id">Project ID</Label>
              <Input id="project_id" type="number" value={form.project_id} onChange={(event) => setForm((prev) => ({ ...prev, project_id: event.target.value }))} />
            </div>
            {form.template_type === MIR_TEMPLATE_TYPES.LODHA ? (
              <LodhaFormSections
                data={form.lodha_form}
                onChange={setLodhaForm}
                onDisciplineToggle={toggleLodhaDiscipline}
              />
            ) : (
              <HiranandaniFormSections
                data={form.hiranandani_form}
                onChange={setHiranandaniForm}
                onMaterialRowChange={updateHiranandaniMaterialRow}
                onAddMaterialRow={addHiranandaniMaterialRow}
                onRemoveMaterialRow={removeHiranandaniMaterialRow}
              />
            )}

            <div className="mt-6 md:col-span-2 rounded-lg border p-4">
              <SectionTitle>Item Preview</SectionTitle>
              <p className="text-sm text-muted-foreground">
                Review the challan items here, edit the fields if needed, and tick the items you want to print in the MIR.
              </p>

              <div className="mt-3 rounded-lg border overflow-hidden">
                <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="sticky top-0 z-10 w-[90px] bg-muted/40 whitespace-nowrap">Print</TableHead>
                      <TableHead className="sticky top-0 z-10 w-[80px] bg-muted/40">Sr No</TableHead>
                      <TableHead className="sticky top-0 z-10 w-[140px] bg-muted/40 whitespace-nowrap">Item Code</TableHead>
                      <TableHead className="sticky top-0 z-10 min-w-[420px] bg-muted/40">Product</TableHead>
                      <TableHead className="sticky top-0 z-10 min-w-[220px] bg-muted/40">Name</TableHead>
                      <TableHead className="sticky top-0 z-10 w-[110px] bg-muted/40 whitespace-nowrap">UOM</TableHead>
                      <TableHead className="sticky top-0 z-10 w-[130px] bg-muted/40 whitespace-nowrap text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(form.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No challan items selected.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (form.items || []).map((item, index) => {
                        const challanQty = toNumber(item?.qty, 0);
                        const printChecked = item?.include_in_mir !== false;
                        const nameFromRemark = (() => {
                          const remark = toText(item?.remark);
                          const match = remark.match(/make\s*:\s*(.+)/i);
                          return match?.[1]?.trim() || "";
                        })();
                        return (
                          <TableRow key={`issue-item-${index}`} className="align-top">
                            <TableCell className="align-top">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={printChecked}
                                  onCheckedChange={(checked) => updateMirItemRow(index, { include_in_mir: Boolean(checked) })}
                                />
                                <span className="text-xs text-muted-foreground">Print</span>
                              </div>
                            </TableCell>
                            <TableCell>{toNumber(item?.srno, index + 1)}</TableCell>
                            <TableCell>
                              <Input
                                value={item?.item_code || ""}
                                onChange={(event) => updateMirItemRow(index, { item_code: event.target.value, item_no: event.target.value, hsn: event.target.value })}
                                placeholder="Item code / HSN"
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                {nameFromRemark ? (
                                  <div className="text-xs font-medium text-muted-foreground">{nameFromRemark}</div>
                                ) : null}
                                <Input
                                  value={item?.description || ""}
                                  onChange={(event) => updateMirItemRow(index, { description: event.target.value })}
                                  placeholder="Product / description"
                                  className="h-9"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item?.name || ""}
                                onChange={(event) => updateMirItemRow(index, { name: event.target.value })}
                                placeholder="Name"
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item?.UOM || ""}
                                onChange={(event) => updateMirItemRow(index, { UOM: event.target.value })}
                                placeholder="UOM"
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                className="h-9 w-[120px] ml-auto text-right"
                                value={String(challanQty || "")}
                                onChange={(event) => {
                                  const raw = event.target.value;
                                  const nextQty = raw === "" ? "" : Number(raw);
                                  if (raw !== "" && !Number.isFinite(nextQty)) return;
                                  updateMirItemRow(index, { qty: raw === "" ? "" : nextQty });
                                }}
                              />
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
          )}

            <div className="mt-6 rounded-lg border p-4 md:col-span-2">
              <SectionTitle>Uploaded Files</SectionTitle>
              <p className="text-sm text-muted-foreground">
                Upload one or more reference files for this MIR. They will be stored with the request and can be reopened later.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleUploadAttachment}
                    disabled={uploadingAttachment}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingAttachment}
                    onClick={(event) => {
                      event.stopPropagation();
                      attachmentInputRef.current?.click();
                    }}
                  >
                    {uploadingAttachment ? "Uploading..." : "Choose Files"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {attachmentFiles.length ? `${attachmentFiles.length} file(s) attached` : "No files attached yet"}
                  </span>
                </div>
                <div className="grid gap-2">
                  {attachmentFiles.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No uploaded files yet.
                    </div>
                  ) : (
                    attachmentFiles.map((file, index) => {
                      const fileUrl = file.path ? api.getApiFileUrl(file.path) : "";
                      return (
                        <div key={`${file.path || file.name || index}`} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{file.name || `Attachment ${index + 1}`}</div>
                            <div className="truncate text-xs text-muted-foreground">{file.path || "Uploaded file"}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {fileUrl ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={fileUrl} target="_blank" rel="noreferrer">Open</a>
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = attachmentFiles.filter((_, itemIndex) => itemIndex !== index);
                                syncAttachmentFiles(next);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 md:col-span-2">
              <Button variant="outline" onClick={() => navigate(`/${projectId}/mir`)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateMir} disabled={submitting || loadingMir}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditMode ? "Saving..." : "Creating..."}
                </>
              ) : (
                isEditMode ? "Save Changes" : "Create MIR"
              )}
            </Button>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isInspectionOpen} onOpenChange={setIsInspectionOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[95vh] sm:w-[95vw] sm:max-w-[95vw] sm:h-[90vh] sm:max-h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Inspection Checklist</DialogTitle>
            <DialogDescription>
              Review all items and tick each checkbox after inspection.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Done</TableHead>
                  <TableHead>Sr No</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(form.items || []).map((item, index) => (
                  <TableRow key={`inspection-item-${index}`}>
                    <TableCell>
                      {allItemsInspected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!item.inspected}
                          onChange={(event) => toggleItemInspection(index, event.target.checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell>{item.srno}</TableCell>
                    <TableCell>{item.hsn || "-"}</TableCell>
                    <TableCell>{item.description || "-"}</TableCell>
                    <TableCell>{item.qty}</TableCell>
                    <TableCell>{item.UOM || "-"}</TableCell>
                    <TableCell>{item.Rate}</TableCell>
                    <TableCell>{item.Amount}</TableCell>
                    <TableCell>{item.remark || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {inspectedCount} / {(form.items || []).length} items inspected
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => toggleAllInspection(true)}>
                Mark All
              </Button>
              <Button type="button" variant="outline" onClick={() => toggleAllInspection(false)}>
                Clear All
              </Button>
              <Button type="button" onClick={() => setIsInspectionOpen(false)}>
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, className = "", type = "text" }) {
  return (
    <Field label={label} className={className}>
      <Input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function LongField({ label, value, onChange, className = "" }) {
  return (
    <Field label={label} className={className}>
      <Textarea value={value || ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function OptionCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
      <span>{label}</span>
    </label>
  );
}

function YesNoField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-4">
        {YES_NO_OPTIONS.map((option) => (
          <OptionCheckbox
            key={`${label}-${option}`}
            label={option}
            checked={value === option}
            onChange={(checked) => onChange(checked ? option : "")}
          />
        ))}
      </div>
    </Field>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="md:col-span-2 border-b pb-2 pt-2 text-sm font-semibold">
      {children}
    </div>
  );
}

function LodhaFormSections({ data, onChange, onDisciplineToggle }) {
  return (
    <>
      <SectionTitle>Lodha Request Submission</SectionTitle>
      <TextField
        label="MIR Submitted To"
        value={data.requestSubmission.submittedTo}
        onChange={(value) => onChange(["requestSubmission", "submittedTo"], value)}
      />
      <Field label="Discipline" className="md:col-span-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DISCIPLINE_OPTIONS.map((item) => (
            <OptionCheckbox
              key={item}
              label={item}
              checked={(data.requestSubmission.discipline || []).includes(item)}
              onChange={() => onDisciplineToggle(item)}
            />
          ))}
        </div>
      </Field>

      <SectionTitle>Part A: By the Contractor</SectionTitle>
      <YesNoField
        label="Material Submittal Approved"
        value={data.contractorPart.materialSubmittalApproved}
        onChange={(value) => onChange(["contractorPart", "materialSubmittalApproved"], value)}
      />
      <TextField
        label="Approval Reference No"
        value={data.contractorPart.approvalRefNo}
        onChange={(value) => onChange(["contractorPart", "approvalRefNo"], value)}
      />
      <TextField label="Previous Quantity" value={data.contractorPart.previousQty} onChange={(value) => onChange(["contractorPart", "previousQty"], value)} />
      <TextField label="Current Qty" value={data.contractorPart.currentQty} onChange={(value) => onChange(["contractorPart", "currentQty"], value)} />
      <TextField label="Cumulative Qty" value={data.contractorPart.cumulativeQty} onChange={(value) => onChange(["contractorPart", "cumulativeQty"], value)} />
      <TextField label="BOQ Reference" value={data.contractorPart.boqReference} onChange={(value) => onChange(["contractorPart", "boqReference"], value)} />
      <TextField label="Manufacturer - Country of Origin" value={data.contractorPart.manufacturerCountry} onChange={(value) => onChange(["contractorPart", "manufacturerCountry"], value)} />
      <TextField label="Supplier" value={data.contractorPart.supplier} onChange={(value) => onChange(["contractorPart", "supplier"], value)} />
      <TextField label="Supplied Quantity and Delivery Note Number" value={data.contractorPart.deliveryNoteNumber} onChange={(value) => onChange(["contractorPart", "deliveryNoteNumber"], value)} />
      <TextField label="Date of Receipt of Material On Site" value={data.contractorPart.receiptDate} onChange={(value) => onChange(["contractorPart", "receiptDate"], value)} />
      <TextField label="Storage Location" value={data.contractorPart.storageLocation} onChange={(value) => onChange(["contractorPart", "storageLocation"], value)} />
      <YesNoField label="MTC Delivered" value={data.contractorPart.testCertificateDelivered} onChange={(value) => onChange(["contractorPart", "testCertificateDelivered"], value)} />
      <LongField label="Field Test Compliance" value={data.contractorPart.fieldTestComplianceNote} onChange={(value) => onChange(["contractorPart", "fieldTestComplianceNote"], value)} className="md:col-span-2" />
      <LongField label="Third Party Test Under Contractor Scope" value={data.contractorPart.thirdPartyTestContractorComplianceNote} onChange={(value) => onChange(["contractorPart", "thirdPartyTestContractorComplianceNote"], value)} />
      <LongField label="Third Party Test Under Lodha Scope" value={data.contractorPart.thirdPartyTestLodhaComplianceNote} onChange={(value) => onChange(["contractorPart", "thirdPartyTestLodhaComplianceNote"], value)} />
      <TextField label="Contractor Name" value={data.contractorPart.contractorName} onChange={(value) => onChange(["contractorPart", "contractorName"], value)} />
      <TextField label="Contractor Signature" value={data.contractorPart.contractorSignature} onChange={(value) => onChange(["contractorPart", "contractorSignature"], value)} />
      <TextField label="Contractor Date" value={data.contractorPart.contractorDate} onChange={(value) => onChange(["contractorPart", "contractorDate"], value)} />

      <SectionTitle>Part B: Lodha/PMC</SectionTitle>
      <YesNoField label="Physical Damage" value={data.lodhaPmc.inspectionReports.physicalDamage} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "physicalDamage"], value)} />
      <YesNoField label="Delivery Note Details Correct" value={data.lodhaPmc.inspectionReports.deliveryNoteCorrect} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "deliveryNoteCorrect"], value)} />
      <YesNoField label="Conform with Approved Material Submittal" value={data.lodhaPmc.inspectionReports.conformApprovedSubmittal} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "conformApprovedSubmittal"], value)} />
      <YesNoField label="MTC Delivered with Material" value={data.lodhaPmc.inspectionReports.mtcDelivered} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "mtcDelivered"], value)} />
      <YesNoField label="Field Test Results Comply" value={data.lodhaPmc.inspectionReports.fieldTestCompliance} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "fieldTestCompliance"], value)} />
      <YesNoField label="Third Party Test Contractor Scope" value={data.lodhaPmc.inspectionReports.thirdPartyContractorScope} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "thirdPartyContractorScope"], value)} />
      <YesNoField label="Third Party Test Lodha Scope" value={data.lodhaPmc.inspectionReports.thirdPartyLodhaScope} onChange={(value) => onChange(["lodhaPmc", "inspectionReports", "thirdPartyLodhaScope"], value)} />
      <TextField label="Civil Project Manager Sign" value={data.lodhaPmc.signOffs.civilProjectManager} onChange={(value) => onChange(["lodhaPmc", "signOffs", "civilProjectManager"], value)} />
      <TextField label="Civil Quality Manager Sign" value={data.lodhaPmc.signOffs.civilQualityManager} onChange={(value) => onChange(["lodhaPmc", "signOffs", "civilQualityManager"], value)} />
      <TextField label="Facade Manager Sign" value={data.lodhaPmc.signOffs.facadeManager} onChange={(value) => onChange(["lodhaPmc", "signOffs", "facadeManager"], value)} />
      <TextField label="Landscape Architect Sign" value={data.lodhaPmc.signOffs.landscapeArchitect} onChange={(value) => onChange(["lodhaPmc", "signOffs", "landscapeArchitect"], value)} />
      <TextField label="MEP Manager Sign" value={data.lodhaPmc.signOffs.mepManager} onChange={(value) => onChange(["lodhaPmc", "signOffs", "mepManager"], value)} />
      <LongField label="Comments" value={data.lodhaPmc.comments} onChange={(value) => onChange(["lodhaPmc", "comments"], value)} className="md:col-span-2" />
      <Field label="Inspection Result" className="md:col-span-2">
        <div className="grid gap-3">
          {LODHA_RESULT_CODES.map((item) => (
            <OptionCheckbox
              key={item.code}
              label={`${item.code} - ${item.label}`}
              checked={data.lodhaPmc.resultCode === item.code}
              onChange={(checked) => onChange(["lodhaPmc", "resultCode"], checked ? item.code : "")}
            />
          ))}
        </div>
      </Field>
      <TextField label="Result Name" value={data.lodhaPmc.resultName} onChange={(value) => onChange(["lodhaPmc", "resultName"], value)} />
      <TextField label="Result Signature" value={data.lodhaPmc.resultSignature} onChange={(value) => onChange(["lodhaPmc", "resultSignature"], value)} />
      <TextField label="Result Date" value={data.lodhaPmc.resultDate} onChange={(value) => onChange(["lodhaPmc", "resultDate"], value)} />
      <Field label="Distribution" className="md:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <OptionCheckbox label="Lodha" checked={data.lodhaPmc.distribution.lodha} onChange={(checked) => onChange(["lodhaPmc", "distribution"], { ...data.lodhaPmc.distribution, lodha: checked })} />
          <OptionCheckbox label="Contractor" checked={data.lodhaPmc.distribution.contractor} onChange={(checked) => onChange(["lodhaPmc", "distribution"], { ...data.lodhaPmc.distribution, contractor: checked })} />
          <Input value={data.lodhaPmc.distribution.others || ""} placeholder="Others" onChange={(event) => onChange(["lodhaPmc", "distribution"], { ...data.lodhaPmc.distribution, others: event.target.value })} />
        </div>
      </Field>
      <TextField label="Template Ref" value={data.templateRef} onChange={(value) => onChange("templateRef", value)} />
      <TextField label="Template Revision" value={data.templateRevision} onChange={(value) => onChange("templateRevision", value)} />
      <TextField label="Template Date" value={data.templateDate} onChange={(value) => onChange("templateDate", value)} />
    </>
  );
}

function HiranandaniFormSections({
  data,
  onChange,
  onMaterialRowChange,
  onAddMaterialRow,
  onRemoveMaterialRow,
}) {
  return (
    <>
      <SectionTitle>Hiranandani Header</SectionTitle>
      <TextField label="Control Form" value={data.controlForm} onChange={(value) => onChange("controlForm", value)} />
      <TextField label="Revision" value={data.revision} onChange={(value) => onChange("revision", value)} />
      <TextField label="Location" value={data.location} onChange={(value) => onChange("location", value)} />
      <TextField label="Material to be Inspected" value={data.materialToInspect} onChange={(value) => onChange("materialToInspect", value)} />
      <TextField label="Location of Storage" value={data.storageLocation} onChange={(value) => onChange("storageLocation", value)} />
      <LongField label="Attachments" value={data.attachments} onChange={(value) => onChange("attachments", value)} />

      <SectionTitle>Notes / Details</SectionTitle>
      <TextField label="Manufacturer" value={data.notes.manufacturer} onChange={(value) => onChange(["notes", "manufacturer"], value)} />
      <TextField label="Purchase Order No" value={data.notes.purchaseOrderNo} onChange={(value) => onChange(["notes", "purchaseOrderNo"], value)} />
      <TextField label="Manufacturer Date" value={data.notes.manufacturerDate} onChange={(value) => onChange(["notes", "manufacturerDate"], value)} />
      <TextField label="Challan / Invoice Note No" value={data.notes.challanInvoiceNo} onChange={(value) => onChange(["notes", "challanInvoiceNo"], value)} />
      <TextField label="Expiry Date" value={data.notes.expiryDate} onChange={(value) => onChange(["notes", "expiryDate"], value)} />
      <TextField label="Delivery Date" value={data.notes.deliveryDate} onChange={(value) => onChange(["notes", "deliveryDate"], value)} />
      <TextField label="Batch No" value={data.notes.batchNo} onChange={(value) => onChange(["notes", "batchNo"], value)} />
      <TextField label="Material Submittal Ref" value={data.notes.materialSubmittalRef} onChange={(value) => onChange(["notes", "materialSubmittalRef"], value)} />
      <TextField label="Source / Country of Origin" value={data.notes.sourceCountry} onChange={(value) => onChange(["notes", "sourceCountry"], value)} />
      <TextField label="Specification Ref" value={data.notes.specificationRef} onChange={(value) => onChange(["notes", "specificationRef"], value)} />
      <TextField label="Quantity Delivered" value={data.notes.quantityDelivered} onChange={(value) => onChange(["notes", "quantityDelivered"], value)} />
      <TextField label="Drawings Ref" value={data.notes.drawingsRef} onChange={(value) => onChange(["notes", "drawingsRef"], value)} />

      <SectionTitle>Material Rows</SectionTitle>
      <div className="md:col-span-2 space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.materialRows.map((row, index) => (
              <TableRow key={`hiranandani-material-${index}`}>
                <TableCell>
                  <Input value={row.material || ""} onChange={(event) => onMaterialRowChange(index, "material", event.target.value)} />
                </TableCell>
                <TableCell>
                  <Input value={row.size || ""} onChange={(event) => onMaterialRowChange(index, "size", event.target.value)} />
                </TableCell>
                <TableCell>
                  <Input value={row.quantity || ""} onChange={(event) => onMaterialRowChange(index, "quantity", event.target.value)} />
                </TableCell>
                <TableCell>
                  <Input value={row.unit || ""} onChange={(event) => onMaterialRowChange(index, "unit", event.target.value)} />
                </TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveMaterialRow(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button type="button" variant="outline" size="sm" onClick={onAddMaterialRow}>
          <Plus className="mr-2 h-4 w-4" /> Add Material Row
        </Button>
      </div>

      <SectionTitle>Signatures And Approvals</SectionTitle>
      <TextField label="MIR Raised By Name" value={data.mirRaisedByName} onChange={(value) => onChange("mirRaisedByName", value)} />
      <TextField label="MIR Raised By Date & Signature" value={data.mirRaisedByDateSignature} onChange={(value) => onChange("mirRaisedByDateSignature", value)} />
      <TextField label="Received By Name" value={data.receivedByName} onChange={(value) => onChange("receivedByName", value)} />
      <TextField label="Received By Date & Signature" value={data.receivedByDateSignature} onChange={(value) => onChange("receivedByDateSignature", value)} />
      <LongField label="Inspection Engineer Comments" value={data.inspectionEngineerComments} onChange={(value) => onChange("inspectionEngineerComments", value)} className="md:col-span-2" />
      <Field label="Approval Code" className="md:col-span-2">
        <div className="grid gap-3 sm:grid-cols-2">
          {HIRANANDANI_APPROVAL_CODES.map((item) => (
            <OptionCheckbox
              key={item.code}
              label={`${item.code} - ${item.label}`}
              checked={data.approvalCode === item.code}
              onChange={(checked) => onChange("approvalCode", checked ? item.code : "")}
            />
          ))}
        </div>
      </Field>

      <SectionTitle>Follow Up / Close-Out Report</SectionTitle>
      <TextField label="Checked By Client Representative" value={data.checkedByClientRepresentative} onChange={(value) => onChange("checkedByClientRepresentative", value)} />
      <TextField label="Checked By Date & Signature" value={data.checkedByDateSignature} onChange={(value) => onChange("checkedByDateSignature", value)} />
      <TextField label="Issued By Name" value={data.issuedByName} onChange={(value) => onChange("issuedByName", value)} />
      <TextField label="Issued By Date & Signature" value={data.issuedByDateSignature} onChange={(value) => onChange("issuedByDateSignature", value)} />
      <LongField label="Action Taken" value={data.closeOut.actionTaken} onChange={(value) => onChange(["closeOut", "actionTaken"], value)} />
      <TextField label="Close-Out Checked By" value={data.closeOut.checkedBy} onChange={(value) => onChange(["closeOut", "checkedBy"], value)} />
      <Field label="Status">
        <div className="flex flex-wrap gap-4">
          {["Completed", "Ongoing"].map((item) => (
            <OptionCheckbox
              key={item}
              label={item}
              checked={data.closeOut.status === item}
              onChange={(checked) => onChange(["closeOut", "status"], checked ? item : "")}
            />
          ))}
        </div>
      </Field>
      <TextField label="Close-Out Date & Signature" value={data.closeOut.dateSignature} onChange={(value) => onChange(["closeOut", "dateSignature"], value)} />
    </>
  );
}
