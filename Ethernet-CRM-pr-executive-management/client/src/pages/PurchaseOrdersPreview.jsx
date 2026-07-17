import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Minus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/useProject";
import { api } from "@/lib/api";
import { EMPTY_PO, normalizePoData } from "@/pages/poShared";

function Field({ label, children, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  );
}

const parseDecimalValue = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).replace(/,/g, '').trim();
  if (normalized === '') return undefined;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const normalizeDateForApi = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Accept values that include labels like "P.O. Date : 25/11/2025"
  const inlineDayFirstMatch = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (inlineDayFirstMatch) {
    const [, day, month, year] = inlineDayFirstMatch;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const inlineIsoMatch = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (inlineIsoMatch) {
    const [, year, month, day] = inlineIsoMatch;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const dayFirstMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
};

const formatPrNumber = (pr = {}) => {
  const explicit = String(pr.pr_number || pr.pr_no || pr.prNo || "").trim();
  if (explicit) return explicit;
  const sequence = pr.pr_id || pr.id || "0";
  const project = pr.project_id || pr.projectId || "0";
  return `PR-${sequence}-${project}`;
};

const buildItemPayloads = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const payload = {
        srno: item.srNo || item.srno || index + 1,
        hsn: item.hsnCode || item.hsn || "",
        description: item.description || "",
        qty: item.qty || item.quantity || "",
        UOM: item.uom || item.UOM || "",
        Rate: item.rate || item.Rate || "",
        Amount: item.amount || item.Amount || "",
        remark: item.remarks || item.remark || "",
        boq_id: item.boq_id || item.boqId || "",
        boq_qty: item.boq_qty || item.boqQty || item.qty || item.quantity || "",
      };
      const hasContent = payload.description || payload.hsn || payload.qty || payload.Rate || payload.Amount;
      return hasContent ? payload : null;
    })
    .filter(Boolean);
};

const renumberItems = (items) =>
  (Array.isArray(items) ? items : []).map((item, index) => ({
    ...item,
    srNo: String(index + 1),
  }));

const buildPoPayload = (poData, projectId) => ({
  project_id: projectId,
  sample_id: poData.sampleId === "" ? undefined : poData.sampleId,
  company_name: poData.companyName || "",
  company_subtitle: poData.companySubtitle || "",
  company_email: poData.companyEmail || "",
  company_gst: poData.companyGstNo || "",
  indent_no: poData.indentNo || "",
  indent_date: normalizeDateForApi(poData.indentDate),
  order_no: poData.orderNo || "",
  po_date: normalizeDateForApi(poData.poDate),
  vendor_name: poData.vendor.name || "",
  site: poData.vendor.site || "",
  site_address: poData.site_address || poData.vendor.siteAddress || "",
  primary_contact_name: poData.vendor.contacts.primary.name || "",
  primary_contact_number: poData.vendor.contacts.primary.phone || "",
  secondary_contact_name: poData.vendor.contacts.secondary.name || "",
  secondary_contact_number: poData.vendor.contacts.secondary.phone || "",
  items: buildItemPayloads(poData.items),
  discount: parseDecimalValue(poData.discount.percent),
  discount_amount: parseDecimalValue(poData.discount.amount),
  after_discount: parseDecimalValue(poData.afterDiscountAmount),
  cgst: parseDecimalValue(poData.taxes.cgst.percent),
  cgst_amount: parseDecimalValue(poData.taxes.cgst.amount),
  sgst: parseDecimalValue(poData.taxes.sgst.percent),
  sgst_amount: parseDecimalValue(poData.taxes.sgst.amount),
  total_amount: parseDecimalValue(poData.totalAmount),
  delivery: poData.summary.delivery || "",
  payment: poData.summary.payment || "",
  notes: poData.notes.length ? poData.notes.join("\\n") : "",
  status: poData.status || "created",
});

export default function PurchaseOrdersPreview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: routeProjectId } = useParams();
  const { toast } = useToast();
  const { selectedProject } = useProject();
  const projectId = selectedProject?.project_id ?? selectedProject?.id ?? routeProjectId ?? null;
  const [poData, setPoData] = useState(() => normalizePoData(location.state?.poData));
  const [editingPoId, setEditingPoId] = useState(() => location.state?.poId ?? location.state?.poData?.po_id ?? null);
  const [saving, setSaving] = useState(false);
  const [loadingPo, setLoadingPo] = useState(false);
  const [linkedDcsLoading, setLinkedDcsLoading] = useState(false);
  const [linkedDcs, setLinkedDcs] = useState([]);
  const [prOptions, setPrOptions] = useState([]);
  const [loadingPrOptions, setLoadingPrOptions] = useState(false);
  const [sampleOptions, setSampleOptions] = useState([]);
  const [loadingSamples, setLoadingSamples] = useState(false);

  useEffect(() => {
    const loadSamples = async () => {
      if (!projectId) {
        setSampleOptions([]);
        return;
      }
      setLoadingSamples(true);
      try {
        const response = await api.getPosByProject(projectId);
        if (response.success && Array.isArray(response.data)) {
          const uniqueSampleIds = [...new Set(
            response.data
              .map((po) => po?.sample_id)
              .filter((value) => value !== undefined && value !== null && value !== "")
              .map((value) => String(value))
          )];
          setSampleOptions(uniqueSampleIds.map((sampleId) => ({ sample_id: sampleId })));
        } else {
          setSampleOptions([]);
        }
      } catch {
        setSampleOptions([]);
      } finally {
        setLoadingSamples(false);
      }
    };
    loadSamples();
  }, [projectId]);

  useEffect(() => {
    let active = true;
    const loadPrs = async () => {
      if (!projectId) {
        setPrOptions([]);
        return;
      }
      setLoadingPrOptions(true);
      try {
        const res = await api.getPrsByProject(projectId);
        const rows = res?.success && Array.isArray(res.data) ? res.data : [];
        if (!active) return;
        setPrOptions(rows);
      } catch {
        if (!active) return;
        setPrOptions([]);
      } finally {
        if (active) setLoadingPrOptions(false);
      }
    };
    loadPrs();
    return () => {
      active = false;
    };
  }, [projectId]);

  const selectedSampleMissing = Boolean(
    poData.sampleId && !sampleOptions.some((sample) => String(sample.sample_id || sample.id) === poData.sampleId)
  );

  useEffect(() => {
    if (!location.state) return;
    if (location.state.poData) {
      const normalized = normalizePoData(location.state.poData);
      setPoData(recalculatePoAmounts(normalized));
      setEditingPoId(location.state.poId ?? normalized.po_id ?? null);
    }
  }, [location.state]);

  useEffect(() => {
    if (!editingPoId) return;
    let active = true;
    const fetchPo = async () => {
      setLoadingPo(true);
      try {
        const response = await api.getPoById(editingPoId);
        if (response.success && response.data) {
          const normalized = normalizePoData(response.data);
          if (!active) return;
          setPoData(recalculatePoAmounts(normalized));
          setEditingPoId(normalized.po_id ?? editingPoId);
        } else if (active) {
          toast({
            title: "Error",
            description: response.error || "Failed to load purchase order.",
            variant: "destructive",
          });
        }
      } catch (error) {
        if (active) {
          toast({
            title: "Error",
            description: error?.message || "Failed to load purchase order.",
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoadingPo(false);
        }
      }
    };

    fetchPo();
    return () => {
      active = false;
    };
  }, [editingPoId, toast]);

  useEffect(() => {
    let active = true;
    const loadLinkedDcs = async () => {
      if (!editingPoId) {
        setLinkedDcs([]);
        return;
      }
      setLinkedDcsLoading(true);
      try {
        const res = await api.getBackpathByPo(editingPoId, { page: 1, limit: 200 });
        const payload = res?.success ? (res.data ?? res) : null;
        const dcs = Array.isArray(payload?.dcs) ? payload.dcs : [];
        if (!active) return;
        setLinkedDcs(dcs);
      } catch {
        if (!active) return;
        setLinkedDcs([]);
      } finally {
        if (active) setLinkedDcsLoading(false);
      }
    };
    loadLinkedDcs();
    return () => {
      active = false;
    };
  }, [editingPoId]);

  const hasPreview = useMemo(() => {
    return poData.vendor?.name || poData.orderNo || poData.poDate || poData.totalAmount;
  }, [poData]);

  const toNumberOrNull = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(String(value).replace(/,/g, "").trim());
    return Number.isNaN(parsed) ? null : parsed;
  };

  const formatCalculatedNumber = (value) => {
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  };

  const recalculatePoAmounts = (
    nextPoData,
    { discountMode = "auto", cgstMode = "auto", sgstMode = "auto" } = {}
  ) => {
    const subtotal = (nextPoData.items || []).reduce((sum, item) => {
      const amount = toNumberOrNull(item.amount);
      return sum + (amount ?? 0);
    }, 0);

    const discountPercentInput = toNumberOrNull(nextPoData.discount?.percent);
    const discountAmountInput = toNumberOrNull(nextPoData.discount?.amount);

    let discountPercent = discountPercentInput;
    let discountAmount = 0;

    if (discountMode === "amount") {
      discountAmount = discountAmountInput ?? 0;
      discountPercent = subtotal > 0 ? (discountAmount * 100) / subtotal : undefined;
    } else if (discountMode === "percent") {
      discountAmount = discountPercentInput != null ? (subtotal * discountPercentInput) / 100 : 0;
    } else if (discountPercentInput != null) {
      discountAmount = (subtotal * discountPercentInput) / 100;
    } else if (discountAmountInput != null) {
      discountAmount = discountAmountInput;
      discountPercent = subtotal > 0 ? (discountAmount * 100) / subtotal : undefined;
    }

    const afterDiscountAmount = subtotal - discountAmount;

    const calculateTax = (tax, mode) => {
      const percentInput = toNumberOrNull(tax?.percent);
      const amountInput = toNumberOrNull(tax?.amount);

      if (mode === "amount") {
        const amount = amountInput ?? 0;
        const percent = afterDiscountAmount !== 0 ? (amount * 100) / afterDiscountAmount : undefined;
        return { percent, amount };
      }

      if (mode === "percent") {
        const percent = percentInput;
        const amount = percent != null ? (afterDiscountAmount * percent) / 100 : 0;
        return { percent, amount };
      }

      if (percentInput != null) {
        return { percent: percentInput, amount: (afterDiscountAmount * percentInput) / 100 };
      }

      if (amountInput != null) {
        return {
          amount: amountInput,
          percent: afterDiscountAmount !== 0 ? (amountInput * 100) / afterDiscountAmount : undefined,
        };
      }

      return { percent: undefined, amount: 0 };
    };

    const cgst = calculateTax(nextPoData.taxes?.cgst, cgstMode);
    const sgst = calculateTax(nextPoData.taxes?.sgst, sgstMode);
    const totalAmount = afterDiscountAmount + cgst.amount + sgst.amount;
    const toValue = (value) => (value != null ? formatCalculatedNumber(value) : "");

    return {
      ...nextPoData,
      subtotalAmount: subtotal > 0 ? formatCalculatedNumber(subtotal) : "",
      discount: {
        ...nextPoData.discount,
        percent: toValue(discountPercent),
        amount: discountAmount > 0 ? formatCalculatedNumber(discountAmount) : "",
      },
      afterDiscountAmount: subtotal > 0 ? formatCalculatedNumber(afterDiscountAmount) : "",
      taxes: {
        ...nextPoData.taxes,
        cgst: {
          ...nextPoData.taxes.cgst,
          percent: toValue(cgst.percent),
          amount: cgst.amount > 0 ? formatCalculatedNumber(cgst.amount) : "",
        },
        sgst: {
          ...nextPoData.taxes.sgst,
          percent: toValue(sgst.percent),
          amount: sgst.amount > 0 ? formatCalculatedNumber(sgst.amount) : "",
        },
      },
      totalAmount: totalAmount > 0 ? formatCalculatedNumber(totalAmount) : "",
    };
  };

  const updateLinkedTax = (taxKey, field, value, mode) => {
    const linkedTaxKey = taxKey === "cgst" ? "sgst" : "cgst";
    setPoData((prev) =>
      recalculatePoAmounts({
        ...prev,
        taxes: {
          ...prev.taxes,
          [taxKey]: { ...prev.taxes[taxKey], [field]: value },
          [linkedTaxKey]: { ...prev.taxes[linkedTaxKey], [field]: value },
        },
      }, {
        [`${taxKey}Mode`]: mode,
        [`${linkedTaxKey}Mode`]: mode,
      })
    );
  };

  const updateVendor = (key, value) => {
    setPoData((prev) => ({
      ...prev,
      site_address: key === "siteAddress" ? value : prev.site_address,
      vendor: { ...prev.vendor, [key]: value },
    }));
  };

  const updateVendorContact = (key, field, value) => {
    setPoData((prev) => ({
      ...prev,
      vendor: {
        ...prev.vendor,
        contacts: {
          ...prev.vendor.contacts,
          [key]: { ...prev.vendor.contacts[key], [field]: value },
        },
      },
    }));
  };

  const updateItem = (index, field, value) => {
    if (field === "rate" || field === "amount") return;
    setPoData((prev) => {
      const nextItems = [...prev.items];
      const nextItem = { ...nextItems[index], [field]: value };

      if (field === "qty") {
        const qty = toNumberOrNull(nextItem.qty);
        const rate = toNumberOrNull(nextItem.rate);
        nextItem.amount = qty != null && rate != null ? formatCalculatedNumber(qty * rate) : "";
      }

      nextItems[index] = nextItem;
      return recalculatePoAmounts({ ...prev, items: nextItems });
    });
  };

  const addItem = () => {
    setPoData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { srNo: String(prev.items.length + 1), hsnCode: "", description: "", qty: "", uom: "", rate: "", amount: "", remarks: "" },
      ],
    }));
  };

  const removeItem = (index) => {
    setPoData((prev) => ({
      ...recalculatePoAmounts({
        ...prev,
        items: renumberItems(prev.items.filter((_, i) => i !== index)),
      }),
    }));
  };

  const handleSubmit = async () => {
    if (!projectId) {
      toast({ title: "Select project", description: "Choose a project before submitting a PO.", variant: "destructive" });
      return;
    }

    if (!poData.sampleId) {
      toast({ title: "Select sample", description: "Sample ID is required for purchase order.", variant: "destructive" });
      return;
    }

    const numericProjectId = Number(projectId);
    if (Number.isNaN(numericProjectId)) {
      toast({ title: "Select project", description: "Invalid project selected.", variant: "destructive" });
      return;
    }

    const payload = buildPoPayload(poData, numericProjectId);
    setSaving(true);
    try {
      const response = editingPoId
        ? await api.updatePo(editingPoId, payload)
        : await api.createPo(payload);
      if (response.success) {
        const normalized = normalizePoData(response.data || {});
        toast({
          title: editingPoId ? "PO updated" : "PO submitted",
          description: editingPoId
            ? "Purchase order updated successfully."
            : "Purchase order saved successfully.",
        });
        setEditingPoId(normalized.po_id ?? editingPoId ?? null);
        navigate(`/${numericProjectId}/purchase-orders`);
      } else {
        toast({
          title: "Error",
          description: response.error || (editingPoId ? "Failed to update PO." : "Failed to submit PO."),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message || (editingPoId ? "Failed to update PO." : "Failed to submit PO."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Purchase Order Preview</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Review extracted fields and finalize the purchase order.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={saving || loadingPo || !hasPreview || !projectId || !poData.sampleId}>
            {saving ? (editingPoId ? "Updating..." : "Submitting...") : (editingPoId ? "Update PO" : "Submit PO")}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setPoData(EMPTY_PO);
              setEditingPoId(null);
              navigate(-1);
            }}
          >
            Remove PO
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Edit
          </Button>
        </div>
      </div>

      {loadingPo ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Loading purchase order details...
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Header Details</CardTitle>
          <CardDescription>Company identifiers and basic metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Sample ID">
              <Select
                value={poData.sampleId || undefined}
                onValueChange={(value) => setPoData((prev) => ({ ...prev, sampleId: value }))}
                disabled={!projectId || loadingSamples}
              >
                <SelectTrigger>
                  <SelectValue placeholder={projectId ? (loadingSamples ? "Loading samples..." : "Select sample (required)") : "Select project first"} />
                </SelectTrigger>
                <SelectContent>
                  {selectedSampleMissing ? (
                    <SelectItem value={poData.sampleId}>Sample #{poData.sampleId} (current)</SelectItem>
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
            </Field>
            <Field label="Indent No (PR)">
              <Select
                value={poData.indentNo || undefined}
                onValueChange={(value) => setPoData((prev) => ({ ...prev, indentNo: value }))}
                disabled={!projectId || loadingPrOptions}
              >
                <SelectTrigger>
                  <SelectValue placeholder={projectId ? (loadingPrOptions ? "Loading PRs..." : "Select PR") : "Select project first"} />
                </SelectTrigger>
                <SelectContent>
                  {poData.indentNo && !prOptions.some((pr) => String(pr?.pr_number || pr?.pr_no || pr?.prNo || "") === String(poData.indentNo)) ? (
                    <SelectItem value={poData.indentNo}>{poData.indentNo} (current)</SelectItem>
                  ) : null}
                  {prOptions.map((pr) => {
                    const indent = String(pr?.pr_number || pr?.pr_no || pr?.prNo || "").trim();
                    const prId = pr?.pr_id ?? pr?.id;
                    const label = indent || formatPrNumber(pr) || `PR #${prId}`;
                    if (!label) return null;
                    return (
                      <SelectItem key={String(prId || indent)} value={label}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Indent Date"><Input type="date" value={poData.indentDate} onChange={(event) => setPoData((prev) => ({ ...prev, indentDate: event.target.value }))} /></Field>
            <Field label="Order No"><Input value={poData.orderNo} onChange={(event) => setPoData((prev) => ({ ...prev, orderNo: event.target.value }))} /></Field>
            <Field label="PO Date"><Input type="date" value={poData.poDate} onChange={(event) => setPoData((prev) => ({ ...prev, poDate: event.target.value }))} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
          <CardTitle>Vendor Details</CardTitle>
          <CardDescription>Recipient and delivery location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vendor Name"><Input value={poData.vendor.name} onChange={(event) => updateVendor("name", event.target.value)} /></Field>
            <Field label="Site"><Input value={poData.vendor.site} onChange={(event) => updateVendor("site", event.target.value)} /></Field>
            <Field label="Site Address"><Input value={poData.vendor.siteAddress} onChange={(event) => updateVendor("siteAddress", event.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary Contact Name"><Input value={poData.vendor.contacts.primary.name} onChange={(event) => updateVendorContact("primary", "name", event.target.value)} /></Field>
            <Field label="Primary Contact Phone"><Input value={poData.vendor.contacts.primary.phone} onChange={(event) => updateVendorContact("primary", "phone", event.target.value)} /></Field>
            <Field label="Secondary Contact Name"><Input value={poData.vendor.contacts.secondary.name} onChange={(event) => updateVendorContact("secondary", "name", event.target.value)} /></Field>
            <Field label="Secondary Contact Phone"><Input value={poData.vendor.contacts.secondary.phone} onChange={(event) => updateVendorContact("secondary", "phone", event.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>Material lines and pricing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Line Items</div>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="mr-2 h-3 w-3" /> Add Item
            </Button>
          </div>
          {poData.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
              No items added yet.
            </div>
          ) : (
            <>
              <div className="hidden sm:grid sm:grid-cols-8 gap-2 text-xs font-medium text-muted-foreground px-1">
                <div>Sr No</div>
                <div>HSN</div>
                <div className="sm:col-span-2">Description</div>
                <div>Qty</div>
                <div>UOM</div>
                <div>Rate</div>
                <div>Amount</div>
              </div>
              {poData.items.map((item, idx) => (
              <div key={`${item.srNo}-${idx}`} className="grid gap-2 sm:grid-cols-8 items-center">
                <Input className="sm:col-span-1" value={item.srNo} onChange={(event) => updateItem(idx, "srNo", event.target.value)} />
                <Input className="sm:col-span-1" value={item.hsnCode} onChange={(event) => updateItem(idx, "hsnCode", event.target.value)} />
                <Input className="sm:col-span-2" value={item.description} onChange={(event) => updateItem(idx, "description", event.target.value)} />
                <Input className="sm:col-span-1" value={item.qty} onChange={(event) => updateItem(idx, "qty", event.target.value)} />
                <Input className="sm:col-span-1" value={item.uom} onChange={(event) => updateItem(idx, "uom", event.target.value)} />
                <Input className="sm:col-span-1" value={item.rate} readOnly placeholder="Fixed" />
                <div className="flex items-center gap-2 sm:col-span-1">
                  <Input value={item.amount} readOnly />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
                <Input className="sm:col-span-8" placeholder="Remarks" value={item.remarks} onChange={(event) => updateItem(idx, "remarks", event.target.value)} />
              </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing & Terms</CardTitle>
          <CardDescription>Taxes, totals, notes, and delivery/payment terms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Discount %">
              <Input
                value={poData.discount.percent}
                onChange={(event) =>
                  setPoData((prev) =>
                    recalculatePoAmounts({
                      ...prev,
                      discount: { ...prev.discount, percent: event.target.value },
                    }, { discountMode: "percent" })
                  )
                }
              />
            </Field>
            <Field label="Discount Amount">
              <Input
                value={poData.discount.amount}
                onChange={(event) =>
                  setPoData((prev) =>
                    recalculatePoAmounts({
                      ...prev,
                      discount: { ...prev.discount, amount: event.target.value },
                    }, { discountMode: "amount" })
                  )
                }
              />
            </Field>
            <Field label="After Discount Amount"><Input value={poData.afterDiscountAmount} readOnly /></Field>
            <Field label="CGST %">
              <Input
                value={poData.taxes.cgst.percent}
                onChange={(event) => updateLinkedTax("cgst", "percent", event.target.value, "percent")}
              />
            </Field>
            <Field label="CGST Amount">
              <Input
                value={poData.taxes.cgst.amount}
                onChange={(event) => updateLinkedTax("cgst", "amount", event.target.value, "amount")}
              />
            </Field>
            <Field label="SGST %">
              <Input
                value={poData.taxes.sgst.percent}
                onChange={(event) => updateLinkedTax("sgst", "percent", event.target.value, "percent")}
              />
            </Field>
            <Field label="SGST Amount">
              <Input
                value={poData.taxes.sgst.amount}
                onChange={(event) => updateLinkedTax("sgst", "amount", event.target.value, "amount")}
              />
            </Field>
            <Field label="Total Amount"><Input value={poData.totalAmount} readOnly /></Field>
            <Field label="Delivery"><Input value={poData.summary.delivery} onChange={(event) => setPoData((prev) => ({ ...prev, summary: { ...prev.summary, delivery: event.target.value } }))} /></Field>
            <Field label="Payment"><Input value={poData.summary.payment} onChange={(event) => setPoData((prev) => ({ ...prev, summary: { ...prev.summary, payment: event.target.value } }))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Notes (one per line)">
              <Textarea
                value={poData.notes.join("\n")}
                onChange={(event) => setPoData((prev) => ({ ...prev, notes: event.target.value.split(/\n+/).map((line) => line.trim()).filter(Boolean) }))}
              />
            </Field>
            <Field label="Terms & Conditions (one per line)">
              <Textarea
                value={poData.termsAndConditions.join("\n")}
                onChange={(event) => setPoData((prev) => ({ ...prev, termsAndConditions: event.target.value.split(/\n+/).map((line) => line.trim()).filter(Boolean) }))}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {!hasPreview ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Upload or fill the form to see a structured preview here.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Quick Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="PO No" value={poData.orderNo} />
              <InfoItem label="PO Date" value={poData.poDate} />
              <InfoItem label="Vendor" value={poData.vendor?.name} />
              <InfoItem label="Total Amount" value={poData.totalAmount} />
              <InfoItem label="Delivery" value={poData.summary?.delivery} />
              <InfoItem label="Payment" value={poData.summary?.payment} />
            </div>
          </CardContent>
        </Card>
      )}

      {editingPoId ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked Delivery Challans (DC)</CardTitle>
            <CardDescription>DCs connected to this PO.</CardDescription>
          </CardHeader>
          <CardContent>
            {linkedDcsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading linked DCs…
              </div>
            ) : linkedDcs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No DC linked to this PO.
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
                      <TableCell>{dc?.created_at ? new Date(dc.created_at).toLocaleString("en-IN") : "-"}</TableCell>
                      <TableCell>{dc?.status || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
