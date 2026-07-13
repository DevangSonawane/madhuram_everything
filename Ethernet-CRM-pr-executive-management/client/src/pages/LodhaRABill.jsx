import React, { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

import { api } from "@/lib/api";
import { COMMON_COMPANY_HEADER, withCommonCompanyHeader } from "@/lib/companyDefaults";
import { formatCurrencyINR } from "@/lib/numberFormat";
import { amountToWords } from "@/lib/amountToWords";
import { lodhaApiToFormData, lodhaFormToApiPayload } from "@/lib/invoiceTransforms";

import LodhaCheckListSheet from "@/components/billing/LodhaCheckListSheet";
import LodhaCummBOQSheet from "@/components/billing/LodhaCummBOQSheet";
import LodhaChallanSummarySheet from "@/components/billing/LodhaChallanSummarySheet";
import LodhaMirSummarySheet from "@/components/billing/LodhaMirSummarySheet";
import LodhaITRSummarySheet from "@/components/billing/LodhaITRSummarySheet";
import LodhaAmendBOQSheet from "@/components/billing/LodhaAmendBOQSheet";

import { downloadInvoiceExcel } from "@/pages/createExcelInvoice";
import { downloadInvoicePdf } from "@/pages/createHtmlInvoice";
import { downloadMirPdf } from "@/lib/mirPdf";
import { downloadItrPdf } from "@/lib/itrPdf";
import { useProject } from "@/contexts/useProject";

const PHASE_WEIGHTS = { supply: 0.6, install: 0.25, tc: 0.1, handover: 0.05 };
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;
const PLUMBING_SAC_CODE = "998322";

const generateInvoiceNumber = (projectCode, raNumber) => `ME/${projectCode}-PL/${raNumber}`;
const extractProjectCode = (buildingName) => String(buildingName || "").replace(/\s+/g, "").toUpperCase().slice(0, 8);
const todayDateOnly = () => new Date().toISOString().slice(0, 10);

const toNumber = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const normalizeProjectBoqItems = (boqItems) => {
  return (Array.isArray(boqItems) ? boqItems : []).map((row, index) => ({
    item_no: row?.item_no ?? row?.item_code ?? String(index + 1),
    section: row?.section ?? row?.category ?? "",
    description: row?.description ?? "",
    uom: row?.unit ?? row?.uom ?? "",
    wo_qty: toNumber(row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
    rate: toNumber(row?.rate ?? row?.unit_rate ?? row?.unit_price ?? row?.unitPrice ?? row?.price ?? 0),
  }));
};

const normalizeSavedBoqItems = (boqItems) => {
  return (Array.isArray(boqItems) ? boqItems : []).map((row, index) => ({
    item_no: row?.item_no ?? row?.itemNo ?? row?.item_code ?? String(index + 1),
    section: row?.section ?? row?.category ?? "",
    description: row?.description ?? "",
    uom: row?.unit ?? row?.uom ?? "",
    wo_qty: toNumber(row?.wo_qty ?? row?.qty ?? row?.quantity ?? row?.order_qty ?? 0),
    rate: toNumber(row?.rate ?? row?.unit_rate ?? row?.unit_price ?? row?.unitPrice ?? row?.price ?? 0),
    prev_supply_qty: row?.prev_supply_qty,
    curr_supply_qty: row?.curr_supply_qty,
    prev_install_qty: row?.prev_install_qty,
    curr_install_qty: row?.curr_install_qty,
    prev_tc_qty: row?.prev_tc_qty,
    curr_tc_qty: row?.curr_tc_qty,
    prev_handover_qty: row?.prev_handover_qty,
    curr_handover_qty: row?.curr_handover_qty,
  }));
};

const normalizeBoqIdentity = (value) => String(value ?? "").trim().toLowerCase();

const buildPreferredBoqItems = (savedBoqItems, projectBoqItems) => {
  const projectItems = Array.isArray(projectBoqItems) ? projectBoqItems : [];
  const savedItems = normalizeSavedBoqItems(savedBoqItems);

  if (projectItems.length === 0) return savedItems;
  if (savedItems.length === 0) return projectItems;

  const savedByIdentity = new Map();
  savedItems.forEach((item, index) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    if (itemNoKey) savedByIdentity.set(`item:${itemNoKey}`, item);
    if (descKey) savedByIdentity.set(`desc:${descKey}`, item);
    savedByIdentity.set(`index:${index}`, item);
  });

  return projectItems.map((item, index) => {
    const itemNoKey = normalizeBoqIdentity(item?.item_no);
    const descKey = normalizeBoqIdentity(item?.description);
    const saved =
      (itemNoKey ? savedByIdentity.get(`item:${itemNoKey}`) : null) ||
      (descKey ? savedByIdentity.get(`desc:${descKey}`) : null) ||
      savedByIdentity.get(`index:${index}`) ||
      null;

    if (!saved) return item;

    return {
      ...item,
      prev_supply_qty: saved?.prev_supply_qty,
      curr_supply_qty: saved?.curr_supply_qty,
      prev_install_qty: saved?.prev_install_qty,
      curr_install_qty: saved?.curr_install_qty,
      prev_tc_qty: saved?.prev_tc_qty,
      curr_tc_qty: saved?.curr_tc_qty,
      prev_handover_qty: saved?.prev_handover_qty,
      curr_handover_qty: saved?.curr_handover_qty,
    };
  });
};

const toLegacyInvoiceData = (formData, computed) => {
  const header = withCommonCompanyHeader({
    invoice_number: formData.invoice_number || "",
    invoice_date: formData.invoice_date || "",
    supplier_gstin: formData.supplier_gstin || "",
    pan_number: formData.pan_number || "",
    pf_number: formData.pf_number || "",
    esic_number: formData.esic_number || "",
    ptr_number: formData.ptr_number || "",
    mlwf_number: formData.mlwf_number || "",
    ra_number: formData.ra_number || "",
    work_order_number: formData.work_order_number || "",
    work_order_date: formData.work_order_date || "",
    building_name: formData.building_name || "",
    work_description: formData.work_description || "PLUMBING WORKS",
    user_id: formData.user_id || "",
    user_name: formData.user_name || "",
  });

  const billingShipping = {
    buyer_name: formData.bill_to_name || "",
    buyer_address: formData.bill_to_address || "",
    buyer_state_name: formData.bill_to_state || "",
    buyer_state_code: formData.bill_to_state_code || "",
    buyer_gstin: formData.bill_to_gstin || "",
    receiver_name: formData.bill_to_name || "",
    receiver_address: formData.bill_to_address || "",
    place_of_supply: formData.place_of_supply || "",
  };

  const projectWork = {
    work_order_number: formData.work_order_number || "",
    work_order_date: formData.work_order_date || "",
    plant_name: formData.plant_name || "",
    bill_no: formData.ra_number ? `RA ${formData.ra_number}` : "",
  };

  const taxableValue = computed?.taxable_value ?? 0;
  const cgstAmount = computed?.cgst_amount ?? 0;
  const sgstAmount = computed?.sgst_amount ?? 0;
  const totalInvoice = computed?.total_invoice_amount ?? 0;

  const items = [
    {
      description: formData.work_description || "PLUMBING WORKS",
      sac_code: formData.sac_code || PLUMBING_SAC_CODE,
      uom: "",
      qty: "",
      rate: "",
      total_value_of_goods: taxableValue,
      discount_if: 0,
      value_of_supply: taxableValue,
      discount: 0,
      taxable_value: taxableValue,
      cgst_rate: (toNumber(formData.cgst_rate) || CGST_RATE) * 100,
      cgst_amount: cgstAmount,
      sgst_rate: (toNumber(formData.sgst_rate) || SGST_RATE) * 100,
      sgst_amount: sgstAmount,
      igst_rate: 0,
      igst_amount: 0,
      cess_rate: 0,
      cess_amount: 0,
      line_total: totalInvoice,
    },
  ];

  const totals = {
    total_taxable_value: taxableValue,
    total_cgst: cgstAmount,
    total_sgst: sgstAmount,
    total_igst: 0,
    total_cess: 0,
    total_value: totalInvoice,
    total_invoice_value: totalInvoice,
    total_invoice_value_words: computed?.amount_in_words || "",
  };

  const bankDeclaration = {
    declaration: formData.declaration || "",
    electronic_ref_number: formData.electronic_ref_number || "",
    authorised_signatory: formData.authorised_signatory || "",
  };

  return { header, billingShipping, projectWork, items, totals, bankDeclaration };
};

const fromLegacyInvoiceData = (legacy) => {
  const header = legacy?.header || {};
  const billingShipping = legacy?.billingShipping || {};
  const projectWork = legacy?.projectWork || {};
  const totals = legacy?.totals || {};

  const raText = header.ra_number || projectWork.bill_no || "";
  const raNumber = String(raText).replace(/[^0-9]/g, "");

  return {
    company_name: header.company_name || COMMON_COMPANY_HEADER.company_name,
    company_address: header.company_address || COMMON_COMPANY_HEADER.company_address,
    ra_number: raNumber || header.ra_number || "",
    invoice_number: header.invoice_number || "",
    invoice_date: header.invoice_date || "",
    work_order_number: projectWork.work_order_number || header.work_order_number || "",
    work_order_date: projectWork.work_order_date || header.work_order_date || "",
    plant_name: projectWork.plant_name || "",
    building_name: header.building_name || "",
    place_of_supply: billingShipping.place_of_supply || "",

    supplier_gstin: header.supplier_gstin || "",
    pan_number: header.pan_number || "",
    pf_number: header.pf_number || "",
    esic_number: header.esic_number || "",
    ptr_number: header.ptr_number || "",
    mlwf_number: header.mlwf_number || "",

    bill_to_name: billingShipping.buyer_name || "",
    bill_to_address: billingShipping.buyer_address || "",
    bill_to_gstin: billingShipping.buyer_gstin || "",
    bill_to_state: billingShipping.buyer_state_name || "",
    bill_to_state_code: billingShipping.buyer_state_code || "",

    work_description: header.work_description || "PLUMBING WORKS",
    sac_code: PLUMBING_SAC_CODE,
    cgst_rate: CGST_RATE,
    sgst_rate: SGST_RATE,

    boq_items: [],
    linked_mir_ids: [],
    linked_itr_ids: [],

    status: legacy?.status || "Draft",
    total_taxable_value: totals.total_taxable_value ?? "",
  };
};

export default function LodhaRABill() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { projectId, billId } = useParams();
  const { selectedProject, projects } = useProject();

  const effectiveProjectId = selectedProject?.id ?? selectedProject?.project_id ?? projectId ?? null;
  const projectName =
    selectedProject?.name ||
    selectedProject?.project_name ||
    projects?.find((p) => String(p?.id ?? p?.project_id) === String(effectiveProjectId))?.name ||
    "";

  const [activeTab, setActiveTab] = useState("checklist");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [readonly, setReadonly] = useState(false);

  const [mirs, setMirs] = useState([]);
  const [itrs, setItrs] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [boqMaster, setBoqMaster] = useState([]);

  const [formData, setFormData] = useState(() => ({
    company_name: COMMON_COMPANY_HEADER.company_name,
    company_address: COMMON_COMPANY_HEADER.company_address,
    ra_number: "",
    invoice_number: "",
    invoice_date: todayDateOnly(),
    work_order_number: "",
    work_order_date: "",
    site_address: "",
    work_order_value: "",
    plant_name: "",
    building_name: "",
    place_of_supply: "",

    supplier_gstin: "",
    pan_number: "",
    pf_number: "",
    esic_number: "",
    ptr_number: "",
    mlwf_number: "",

    bill_to_name: "",
    bill_to_address: "",
    bill_to_gstin: "",
    bill_to_state: "",
    bill_to_state_code: "",

    work_description: "PLUMBING WORKS",
    sac_code: PLUMBING_SAC_CODE,
    cgst_rate: CGST_RATE,
    sgst_rate: SGST_RATE,

    boq_items: [],
    linked_mir_ids: [],
    linked_itr_ids: [],
    imported_invoice_ids: [],

    checklist: {},
    status: "Draft",
  }));

  const deferredFormData = useDeferredValue(formData);

  const computed = useMemo(() => {
    const items = Array.isArray(formData.boq_items) ? formData.boq_items : [];
    const curr = items.reduce((sum, item) => {
      const rate = toNumber(item?.rate);
      const supply = toNumber(item?.curr_supply_qty) * PHASE_WEIGHTS.supply * rate;
      const install = toNumber(item?.curr_install_qty) * PHASE_WEIGHTS.install * rate;
      const tc = toNumber(item?.curr_tc_qty) * PHASE_WEIGHTS.tc * rate;
      const handover = toNumber(item?.curr_handover_qty) * PHASE_WEIGHTS.handover * rate;
      return sum + supply + install + tc + handover;
    }, 0);

    const cgstRate = toNumber(formData.cgst_rate) || CGST_RATE;
    const sgstRate = toNumber(formData.sgst_rate) || SGST_RATE;
    const cgstAmount = curr * cgstRate;
    const sgstAmount = curr * sgstRate;
    const total = curr + cgstAmount + sgstAmount;

    return {
      taxable_value: curr,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      total_invoice_amount: total,
      amount_in_words: amountToWords(total),
    };
  }, [formData.boq_items, formData.cgst_rate, formData.sgst_rate]);

  const deferredComputed = useDeferredValue(computed);
  const autosaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef("");

  useEffect(() => {
    if (readonly) return;
    if (!billId) return;
    const snapshot = JSON.stringify({ formData: deferredFormData, computed: deferredComputed });
    if (snapshot === lastSavedSnapshotRef.current) return;

    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setAutosaving(true);
        const legacy = toLegacyInvoiceData(deferredFormData, deferredComputed);
        const payload = lodhaFormToApiPayload(legacy, effectiveProjectId);
        const res = await api.updateLodhaInvoice(billId, payload);
        if (!res?.success) throw new Error(res?.error || "Auto-save failed");
        lastSavedSnapshotRef.current = snapshot;
      } catch (e) {
        toast({ title: "Auto-save failed", description: String(e?.message || e), variant: "destructive" });
      } finally {
        setAutosaving(false);
      }
    }, 2000);

    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [billId, deferredComputed, deferredFormData, effectiveProjectId, readonly, toast]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!effectiveProjectId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [projectRes, boqRes, mirRes, itrRes, dcRes] = await Promise.all([
          api.getProjectById(effectiveProjectId),
          api.getBoqItemsForProject(effectiveProjectId),
          api.getMirsByProject(effectiveProjectId),
          api.getItrsByProject(effectiveProjectId),
          api.getDcsByProject(effectiveProjectId),
        ]);

        const projectRaw = projectRes?.success ? projectRes.data : selectedProject;
        const project = projectRaw || selectedProject || {};
        const buildingName =
          project?.project_name ||
          project?.name ||
          selectedProject?.project_name ||
          selectedProject?.name ||
          "";
        const projectCode = extractProjectCode(buildingName);

        const boqItems = boqRes?.success ? boqRes?.data?.items || boqRes?.data?.data?.items || [] : [];
        const normalizedBoq = normalizeProjectBoqItems(boqItems).map((row) => ({
          ...row,
          amount: toNumber(row?.amount ?? 0),
        }));

        const mirList = mirRes?.success && Array.isArray(mirRes.data) ? mirRes.data : [];
        const itrList = itrRes?.success && Array.isArray(itrRes.data) ? itrRes.data : [];
        const dcList = dcRes?.success && Array.isArray(dcRes.data) ? dcRes.data : [];

        if (!active) return;

        setBoqMaster(normalizedBoq);
        setMirs(mirList);
        setItrs(itrList);
        setDcs(dcList);

        // Load existing bill if editing
        if (billId) {
          const billRes = await api.getLodhaInvoice(billId);
          if (!billRes?.success) throw new Error(billRes?.error || "Failed to load RA bill");
          const rawBill = billRes?.data ?? billRes;
          const legacy = lodhaApiToFormData(rawBill);
          const next = fromLegacyInvoiceData(legacy);
          const savedBoqItems = Array.isArray(rawBill?.boq_items)
            ? rawBill.boq_items
            : Array.isArray(rawBill?.invoice?.boq_items)
              ? rawBill.invoice.boq_items
              : Array.isArray(rawBill?.data?.boq_items)
                ? rawBill.data.boq_items
                : [];
          const preferredBoqItems = buildPreferredBoqItems(savedBoqItems, normalizedBoq);
          setFormData((prev) => ({
            ...prev,
            ...next,
            boq_items: preferredBoqItems,
          }));
          setReadonly(/submitted|approved/i.test(String(next?.status || "")));
        } else {
          setFormData((prev) => {
            const ra = prev.ra_number;
            const invoiceNo = prev.invoice_number || (ra ? generateInvoiceNumber(projectCode, ra) : "");
            return {
              ...prev,
              work_order_number:
                project?.work_order_number ||
                project?.workOrderNo ||
                project?.wo_number ||
                project?.woNumber ||
                prev.work_order_number,
              work_order_date:
                project?.work_order_date ||
                project?.workOrderDate ||
                project?.wo_date ||
                project?.woDate ||
                prev.work_order_date ||
                "",
              building_name: buildingName || prev.building_name,
              site_address: project?.location || project?.site_address || project?.siteAddress || prev.site_address,
              work_order_value: project?.estimate_value || project?.value || prev.work_order_value,
              plant_name: project?.location || prev.plant_name,
              place_of_supply: project?.place_of_supply || project?.placeOfSupply || buildingName || prev.place_of_supply,
              bill_to_name: project?.client_name || project?.client || prev.bill_to_name,
              bill_to_gstin: project?.client_gstin || project?.gstin || prev.bill_to_gstin,
              bill_to_address: project?.client_address || prev.bill_to_address,
              supplier_gstin: project?.contractor_gstin || project?.contractorGstin || project?.supplier_gstin || project?.supplierGstin || prev.supplier_gstin,
              pf_number: project?.pf_number || project?.pfNumber || prev.pf_number,
              esic_number: project?.esic_number || project?.esicNumber || prev.esic_number,
              ptr_number: project?.ptr_number || project?.ptrNumber || prev.ptr_number,
              mlwf_number: project?.mlwf_number || project?.mlwfNumber || prev.mlwf_number,
              invoice_number: invoiceNo,
            };
          });
        }
      } catch (e) {
        if (!active) return;
        toast({ title: "Load failed", description: String(e?.message || e), variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [billId, effectiveProjectId, selectedProject, toast]);

  useEffect(() => {
    if (!effectiveProjectId) return;
    if (!Array.isArray(boqMaster) || boqMaster.length === 0) return;
    setFormData((prev) => {
      const mergedBoqItems = buildPreferredBoqItems(prev.boq_items, boqMaster);
      const prevSerialized = JSON.stringify(Array.isArray(prev.boq_items) ? prev.boq_items : []);
      const mergedSerialized = JSON.stringify(mergedBoqItems);
      if (prevSerialized === mergedSerialized) return prev;
      return {
        ...prev,
        boq_items: mergedBoqItems,
      };
    });
  }, [boqMaster, effectiveProjectId]);

  const projectCode = useMemo(
    () => extractProjectCode(formData.building_name || projectName),
    [formData.building_name, projectName]
  );

  useEffect(() => {
    if (!formData.ra_number) return;
    if (!projectCode) return;
    setFormData((prev) => {
      const nextAuto = generateInvoiceNumber(projectCode, prev.ra_number);
      if (!prev.invoice_number) return { ...prev, invoice_number: nextAuto };
      if (prev.invoice_number === nextAuto) return prev;
      // If user already typed a custom invoice number, don't overwrite.
      if (!prev.invoice_number.startsWith(`ME/${projectCode}-PL/`)) return prev;
      return { ...prev, invoice_number: nextAuto };
    });
  }, [formData.ra_number, projectCode]);

  const backHref = projectId ? `/${projectId}/billing` : "/billing";
  const title = `Lodha RA Bill — ${projectName || "Project"}`;

  const activeTabContent = useMemo(() => {
    switch (activeTab) {
      case "checklist":
        return (
          <LodhaCheckListSheet
            formData={formData}
            readonly={readonly}
            value={formData.checklist}
            onChange={(next) => setFormData((prev) => ({ ...prev, checklist: next }))}
          />
        );
      case "cumm_boq":
        return (
          <LodhaCummBOQSheet
            formData={formData}
            boqMaster={boqMaster}
            readonly={readonly}
            phaseWeights={PHASE_WEIGHTS}
            onBoqItemsChange={(nextItems) => setFormData((prev) => ({ ...prev, boq_items: nextItems }))}
          />
        );
      case "challan_summary":
        return (
          <LodhaChallanSummarySheet
            formData={formData}
            readonly={readonly}
            mirs={mirs}
            dcs={dcs}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          />
        );
      case "mir_summary":
        return (
          <LodhaMirSummarySheet
            formData={formData}
            readonly={readonly}
            mirs={mirs}
            boqMaster={boqMaster}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          />
        );
      case "itr_summary":
        return (
          <LodhaITRSummarySheet
            formData={formData}
            readonly={readonly}
            itrs={itrs}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
          />
        );
      case "illegal_immigration":
        return (
          <div className="rounded-md border bg-white p-6">
            <div className="mx-auto max-w-4xl space-y-8">
              <div className="space-y-2 text-center">
                <h2 className="text-3xl font-semibold tracking-tight">{formData.company_name || COMMON_COMPANY_HEADER.company_name}</h2>
                <p className="text-sm text-muted-foreground">{formData.company_address || COMMON_COMPANY_HEADER.company_address}</p>
              </div>

              <div className="pt-8 text-center">
                <h3 className="text-2xl font-bold underline underline-offset-4">TO WHOM IT MAY CONCERN</h3>
              </div>

              <div className="px-2 text-center text-lg leading-9 sm:px-8">
                We hereby certify that since {formData.work_order_date || "the work order date"} none of the
                Workers/Staff/Personal engaged or employed by us in respect of {formData.plant_name || formData.place_of_supply || "the project"}
                {" "}under work order No. {formData.work_order_number || "-"}
                {formData.work_order_date ? ` dated ${formData.work_order_date}` : ""}
                {" "}is an illegal immigrant.
              </div>

              <div className="pt-16">
                <div className="w-48 border-b border-foreground pb-2 text-xl font-semibold">Signature</div>
              </div>
            </div>
          </div>
        );
      case "amend_boq":
        return (
          <LodhaAmendBOQSheet
            readonly={readonly}
            projectId={effectiveProjectId}
            boqMaster={boqMaster}
            onImported={(items) => {
              setBoqMaster(items);
              setFormData((prev) => ({ ...prev, boq_items: [] }));
            }}
          />
        );
      default:
        return null;
    }
  }, [activeTab, boqMaster, dcs, effectiveProjectId, formData, itrs, mirs, readonly]);

  const handleSaveDraft = async () => {
    if (!effectiveProjectId) {
      toast({ title: "Missing project", description: "Open a project first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const legacy = toLegacyInvoiceData(formData, computed);
      const payload = lodhaFormToApiPayload(legacy, effectiveProjectId);
      const res = billId ? await api.updateLodhaInvoice(billId, payload) : await api.createLodhaInvoice(payload);
      if (!res?.success) throw new Error(res?.error || "Save failed");
      toast({ title: billId ? "Updated" : "Created", description: "RA bill saved successfully." });

      const newId = billId ?? res?.data?.id ?? res?.data?.lodha_invoice_id ?? res?.data?.invoice_id ?? res?.data?._id;
      if (!billId && newId) navigate(`/${projectId}/billing/lodha/${newId}`, { replace: true });
    } catch (e) {
      toast({ title: "Save failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = async () => {
    const legacy = toLegacyInvoiceData(formData, computed);
    await downloadInvoiceExcel("lodha", legacy);
  };

  const handleDownloadPdf = async () => {
    const legacy = toLegacyInvoiceData(formData, computed);
    await downloadInvoicePdf("lodha", legacy);
  };

  const handleSubmit = async () => {
    const ok = window.confirm("Submit this RA bill for approval? This will disable editing.");
    if (!ok) return;
    setFormData((prev) => ({ ...prev, status: "Submitted" }));
    setReadonly(true);
    await handleSaveDraft();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading RA bill...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate(backHref)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div>
            <div className="text-lg font-semibold">{title}</div>
            <div className="text-sm text-muted-foreground">
              Current bill amount: <span className="font-medium text-foreground">{formatCurrencyINR(computed.taxable_value)}</span>
              {autosaving ? " • Saving..." : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={readonly}
            onClick={() => setFormData((prev) => {
              const ra = prev.ra_number;
              const invoiceNo = prev.invoice_number || (ra ? generateInvoiceNumber(projectCode, ra) : "");
              return { ...prev, invoice_number: invoiceNo };
            })}
          >
            Regenerate Invoice No
          </Button>

          <Button onClick={handleSaveDraft} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Draft
          </Button>

          <Button variant="secondary" onClick={handleSubmit} disabled={readonly || !billId}>
            Submit
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                Download <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadExcel}>Download as Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}>Download Tax Invoice PDF</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const ids = (formData.linked_mir_ids || []).map(String);
                  const first = (mirs || []).find((m) => ids.includes(String(m?.mir_id ?? m?.id ?? m?._id)));
                  if (!first) {
                    toast({ title: "No MIR linked", description: "Link at least one MIR in CHALLAN SUMMARY." });
                    return;
                  }
                  downloadMirPdf(first, { fileName: "mir.pdf" });
                }}
              >
                Download MIR PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const ids = (formData.linked_itr_ids || []).map(String);
                  const first = (itrs || []).find((i) => ids.includes(String(i?.itr_id ?? i?.id ?? i?._id)));
                  if (!first) {
                    toast({ title: "No ITR linked", description: "Link at least one ITR in ITR SUMMARY." });
                    return;
                  }
                  downloadItrPdf(first, { fileName: "itr.pdf" });
                }}
              >
                Download ITR PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => startTransition(() => setActiveTab(value))}>
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="checklist">Checklist Sheet</TabsTrigger>
          <TabsTrigger value="cumm_boq">Cumm BOQ</TabsTrigger>
          <TabsTrigger value="challan_summary">Challan Summary</TabsTrigger>
          <TabsTrigger value="mir_summary">MIR Summary</TabsTrigger>
          <TabsTrigger value="itr_summary">ITR Summary</TabsTrigger>
          <TabsTrigger value="illegal_immigration">Illegal Immigration</TabsTrigger>
          <TabsTrigger value="amend_boq">Amend</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>{activeTabContent}</TabsContent>
      </Tabs>
    </div>
  );
}
